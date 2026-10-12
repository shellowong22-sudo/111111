import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { scrubSources, shouldScrub } from "../uc/scrub";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
/**
 * 前端接口统一抹掉数据来源（管理员在管理后台里不受影响）。
 */
const scrubSourceLabels = t.middleware(async ({ ctx, next, path }) => {
  const result = await next();
  // 佑诚数据工作台（管理后台）的接口本来就要显示来源，不处理
  if (!result.ok || path.startsWith("ucAdmin.") || !shouldScrub(ctx)) return result;
  try {
    return { ...result, data: scrubSources(result.data) };
  } catch {
    return result;
  }
});

export const publicProcedure = t.procedure.use(scrubSourceLabels);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
