import { useMemo, useState } from "react";
import { ExternalLink, FileSearch, Highlighter, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LoadingState } from "@/components/sovereign/PanelKit";
import {
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";

const categoryLabel = {
  key_rate: "关键利率",
  policy_action: "政策动作",
  forward_guidance: "前瞻性指引",
} as const;
export default function CentralBankPolicyEvidencePanel({
  initialSourceId = "FED",
  lockSource = false,
}: {
  initialSourceId?: "FED" | "ECB" | "BOE" | "PBOC" | "CBC" | "BCB";
  lockSource?: boolean;
}) {
  const sourcesQuery = trpc.moneyMarketPolicy.getSources.useQuery();
  const [sourceId, setSourceId] = useState(initialSourceId);
  const source = useMemo(
    () => (sourcesQuery.data?.sources ?? []).find(item => item.id === sourceId),
    [sourcesQuery.data, sourceId]
  );
  const [url, setUrl] = useState("");
  const inspect = trpc.moneyMarketPolicy.inspectDocument.useMutation();
  const inspectCurrent = () => {
    const value = url.trim() || source?.homeUrl;
    if (value) inspect.mutate({ sourceId, url: value });
  };
  return (
    <Card
      title="央行原始政策文件证据高亮"
      action={
        <span className="text-[10px] text-slate-500">
          关键词辅助 · 原文优先
        </span>
      }
    >
      <p className="mb-3 text-[11px] text-slate-500">
        选择中央银行并粘贴同一官方域名下的具体
        HTML/文本政策文件。系统只提取原文中的利率、政策动作和前瞻性表述命中片段；不会自动给出政策立场、利率预测或投资结论。
      </p>
      <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
        {lockSource ? (
          <div className="flex items-center border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
            {source?.label ?? "读取人民银行目录…"}
          </div>
        ) : (
          <select
            value={sourceId}
            onChange={e => {
              setSourceId(e.target.value as typeof sourceId);
              setUrl("");
            }}
            className="input-terminal text-xs"
          >
            {sourcesQuery.data?.sources.map(item => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.region}
              </option>
            ))}
          </select>
        )}
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="input-terminal text-xs"
          placeholder={source?.homeUrl || "加载官方来源…"}
        />
        <button
          type="button"
          onClick={inspectCurrent}
          disabled={inspect.isPending || !source}
          className="rounded border border-cyan-800 px-3 text-xs text-cyan-200 disabled:text-slate-600"
        >
          <FileSearch className="mr-1 inline h-3 w-3" />
          读取原文
        </button>
      </div>
      {source && (
        <a
          href={source.homeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-300"
        >
          <ExternalLink className="h-3 w-3" />
          {source.label} 官方资料目录
        </a>
      )}
      {inspect.isPending && (
        <div className="mt-3">
          <LoadingState label="正在读取选定的央行原始文件…" />
        </div>
      )}
      {inspect.error && (
        <p className="mt-3 rounded border border-rose-900 bg-rose-950/20 p-2 text-xs text-rose-200">
          {inspect.error.message}。仅允许已列入目录的官方 HTTPS 域名与
          HTML/文本文件。
        </p>
      )}
      {inspect.data && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric
              label="读取时点"
              value={new Date(inspect.data.retrievedAt).toLocaleString()}
              tone="info"
            />
            <Metric
              label="关键词命中"
              value={`${inspect.data.highlights.length}`}
              tone="info"
            />
            <Metric label="原文来源" value={inspect.data.source.label} />
          </div>
          <a
            href={inspect.data.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-cyan-300"
          >
            <ExternalLink className="h-3 w-3" />
            打开并完整核验原始文件
          </a>
          <div className="space-y-2">
            {inspect.data.highlights.map((item, index) => (
              <div
                key={`${item.start}-${index}`}
                className="rounded border border-slate-800 p-3"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${item.category === "key_rate" ? "bg-cyan-950 text-cyan-200" : item.category === "policy_action" ? "bg-amber-950 text-amber-200" : "bg-violet-950 text-violet-200"}`}
                >
                  <Highlighter className="mr-1 inline h-3 w-3" />
                  {categoryLabel[item.category]}
                </span>
                <b className="ml-2 text-xs text-slate-200">{item.phrase}</b>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {item.context}
                </p>
              </div>
            ))}
            {!inspect.data.highlights.length && (
              <p className="rounded border border-dashed border-slate-700 p-2 text-[11px] text-slate-500">
                原文未命中当前关键词词表。这不代表文件没有政策信息；请打开原件完成完整阅读，或使用符合官方域名的具体决议页面重试。
              </p>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            {inspect.data.limitation}
          </p>
        </div>
      )}
    </Card>
  );
}
