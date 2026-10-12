import { trpc } from "@/lib/trpc";
import { registerQueryClient } from "./lib/queryClientRef";
import { ChartInteractionProvider } from '@/contexts/ChartInteractionContext';
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpBatchStreamLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// Exposes the deployed client revision for cache and support diagnostics.
document.documentElement.dataset.clientRevision = "stock-depth-20260913-r2";

const queryClient = new QueryClient();
registerQueryClient(queryClient);

// Public terminal views deliberately continue in a degraded state when an
// optional persistence service is unavailable. Keep that expected condition
// out of the browser error stream so operators can distinguish it from a real
// rendering or transport failure.
const degradedNotices = new Set<string>();
const isExpectedDegradedError = (error: unknown) => error instanceof TRPCClientError && /DATABASE_UNAVAILABLE|LLM_API_KEY is not configured/.test(error.message);
const reportApiFailure = (kind: "Query" | "Mutation", error: unknown) => {
  if (isExpectedDegradedError(error)) {
    const key = `${kind}:${error instanceof TRPCClientError ? error.message : "degraded"}`;
    if (!degradedNotices.has(key)) {
      degradedNotices.add(key);
      console.warn(`[API ${kind} Degraded] 公共终端服务暂不可用，页面已保留可用状态。`);
    }
    return;
  }
  console.error(`[API ${kind} Error]`, error);
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;
  // 终端包含公开只读观察与受保护工作区并存的查询。匿名浏览时，
  // 某个后台受保护查询的拒绝不应中断同批 WEI 清单等公开数据读取。
  // 受保护接口仍返回 UNAUTHORIZED；这里只避免把整个终端强制带离。
  if (["/terminal", "/news-hub"].includes(window.location.pathname)) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    reportApiFailure("Query", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    reportApiFailure("Mutation", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // An economic source refresh can take several upstream batches. Keep it
      // independent of unrelated auth/feed calls, with a bounded transport wait.
      condition: op => ['legacyMarketData.getEconomicObservations', 'legacyMarketData.getWorldBankPanel', 'freeMarketData.archivedFxReference'].includes(op.path),
      true: httpLink({
        url: '/api/trpc',
        transformer: superjson,
        fetch(input, init) {
          const timeout = AbortSignal.timeout(65_000);
          return globalThis.fetch(input, { ...init, credentials: 'include', signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
        },
      }),
      // 查询走流式批量：同一批里慢的外部接口不再拖住其他接口，先返回的先显示。
      // 变更（登录等需要写 Cookie 的请求）仍走普通批量。
      false: splitLink({
        condition: op => op.type === "query",
        true: httpBatchStreamLink({
          url: "/api/trpc",
          transformer: superjson,
          fetch(input, init) {
            return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
          },
        }),
        false: httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          fetch(input, init) {
            return globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });
          },
        }),
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <ChartInteractionProvider>
        <App />
      </ChartInteractionProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
