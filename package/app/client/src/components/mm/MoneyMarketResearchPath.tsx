import { ArrowRight, Route, Star } from "lucide-react";
import { MoneyMarketSection as Card } from "./MoneyMarketWorkbench";
import type { DistinctMoneyMarketModuleId } from "./MoneyMarketDistinctiveLayer";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Step = { id: DistinctMoneyMarketModuleId; label: string; reason: string };
const PATHS: Record<DistinctMoneyMarketModuleId, Step[]> = {
  "des-mm": [
    { id: "pgm", label: "PGM 研究范围", reason: "定义本次核验主题与来源" },
    { id: "source-mm", label: "SOURCE 时效", reason: "确认公开观察是否仍可用" },
  ],
  pgm: [
    {
      id: "crvf-mmkt",
      label: "CRVF MMKT 资料路由",
      reason: "按研究目的定位公开来源",
    },
    { id: "mmflow", label: "MMFLOW 交付包", reason: "整理已核验来源清单" },
  ],
  mktbeat: [
    { id: "tcon", label: "TCON 走廊分解", reason: "核对政策实施边界" },
    { id: "rv", label: "RV 差值矩阵", reason: "查看同日基准位置" },
    { id: "source-mm", label: "SOURCE 时效", reason: "复核观察发布状态" },
  ],
  btmm: [
    { id: "boom", label: "BOOM 拍卖日历", reason: "追踪已发布官方事件" },
    { id: "gc", label: "GC 曲线证据", reason: "导出短端序列证据" },
    { id: "mmflow", label: "MMFLOW 交付包", reason: "组装拍卖与曲线来源" },
  ],
  boom: [
    { id: "btmm", label: "BTMM 拍卖对比", reason: "比较已发布 Bill 记录" },
    { id: "source-mm", label: "SOURCE 时效", reason: "检查事件数据可用性" },
  ],
  tcon: [
    { id: "mktbeat", label: "MKTBEAT 观察", reason: "回看公开隔夜基准" },
    { id: "rv", label: "RV 差值", reason: "定位走廊相关差值" },
  ],
  rv: [
    { id: "mktbeat", label: "MKTBEAT 基准", reason: "查看原始历史观察" },
    { id: "mmidx", label: "MMIDX 离散带宽", reason: "检验多基准分散度" },
  ],
  ycqsim: [
    { id: "gc", label: "GC 公开曲线", reason: "对照可读历史序列" },
    { id: "fibc", label: "FIBC 日计数", reason: "核对用户输入计息口径" },
  ],
  gc: [
    { id: "crvf", label: "CRVF 兼容性", reason: "核对来源频率与覆盖" },
    { id: "mmflow", label: "MMFLOW 交付包", reason: "提交图表证据来源" },
  ],
  "crvf-mmkt": [
    { id: "crvf", label: "CRVF 兼容性", reason: "比较地区与频率边界" },
    { id: "pgm", label: "PGM 研究范围", reason: "固化选定资料范围" },
  ],
  crvf: [
    { id: "cenb", label: "CENB 覆盖拓扑", reason: "核对央行与来源覆盖" },
    { id: "mmflow", label: "MMFLOW 交付包", reason: "导出经核验资料清单" },
  ],
  fibc: [
    { id: "ycqsim", label: "YCQSIM 节点冲击", reason: "形成输入驱动情景" },
    { id: "etrade", label: "ETRADE 释放控制", reason: "完成来源与审批确认" },
  ],
  cdie: [
    { id: "crvf", label: "CRVF 兼容性", reason: "核对 CDI 与其他口径边界" },
    { id: "source-mm", label: "SOURCE 时效", reason: "检查公开观察状态" },
  ],
  efsf: [
    { id: "news-mm", label: "NEWS 原始资料包", reason: "导出官方文件引用" },
    { id: "mmflow", label: "MMFLOW 交付包", reason: "形成可审阅来源交付物" },
  ],
  mmidx: [
    { id: "rv", label: "RV 差值矩阵", reason: "查看配对基准位置" },
    { id: "mktbeat", label: "MKTBEAT 观察", reason: "回到公开基准细节" },
  ],
  etrade: [
    { id: "source-mm", label: "SOURCE 时效", reason: "确认来源仍在阈值内" },
    { id: "mmflow", label: "MMFLOW 交付包", reason: "提交审批所需来源包" },
  ],
  edsf: [
    { id: "fibc", label: "FIBC 日计数", reason: "核对期间与日计数假设" },
    { id: "wbf", label: "WBF 因子桥接", reason: "延伸用户输入基差分析" },
  ],
  wbf: [
    { id: "edsf", label: "EDSF FRA 生命周期", reason: "核对期限区间输入" },
    { id: "etrade", label: "ETRADE 释放控制", reason: "完成用户确认检查" },
  ],
  pboc: [
    { id: "cenb", label: "CENB 资料覆盖", reason: "比较央行资料范围" },
    { id: "news-mm", label: "NEWS 原始资料包", reason: "导出官方证据引用" },
  ],
  twdi: [
    { id: "source-mm", label: "SOURCE 时效", reason: "检查公开观察连续性" },
    { id: "crvf", label: "CRVF 兼容性", reason: "查看跨来源并列边界" },
  ],
  cenb: [
    { id: "pboc", label: "PBOC 官方域名", reason: "进入特定央行原件核验" },
    { id: "news-mm", label: "NEWS 原始资料包", reason: "整理引用证据" },
  ],
  "news-mm": [
    { id: "mmflow", label: "MMFLOW 交付包", reason: "进入团队审阅交付流程" },
    { id: "source-mm", label: "SOURCE 时效", reason: "确认引用公开资料状态" },
  ],
  "source-mm": [
    { id: "des-mm", label: "DES 口径对照", reason: "理解序列来源与边界" },
    { id: "mmflow", label: "MMFLOW 交付包", reason: "把当前可读来源纳入交付" },
  ],
  mmflow: [
    { id: "source-mm", label: "SOURCE 时效", reason: "在提交前复核资料状态" },
    { id: "pgm", label: "PGM 研究范围", reason: "回到研究范围定义" },
  ],
};
export default function MoneyMarketResearchPath({
  moduleId,
}: {
  moduleId: DistinctMoneyMarketModuleId;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const steps = PATHS[moduleId];
  const preferencesQuery =
    trpc.moneyMarketResearch.listMmResearchPathFavorites.useQuery(undefined, {
      enabled: Boolean(user),
      staleTime: 30_000,
    });
  const preferenceByTarget = useMemo(
    () =>
      new Map(
        (preferencesQuery.data ?? [])
          .filter(item => item.fromModuleId === moduleId)
          .map(item => [item.toModuleId, item])
      ),
    [preferencesQuery.data, moduleId]
  );
  const rankedSteps = useMemo(
    () =>
      [...steps].sort((left, right) => {
        const leftPref = preferenceByTarget.get(left.id);
        const rightPref = preferenceByTarget.get(right.id);
        return (
          Number(Boolean(rightPref?.isFavorited)) -
            Number(Boolean(leftPref?.isFavorited)) ||
          (rightPref?.usageCount ?? 0) - (leftPref?.usageCount ?? 0)
        );
      }),
    [steps, preferenceByTarget]
  );
  const favorite =
    trpc.moneyMarketResearch.toggleMmResearchPathFavorite.useMutation({
      onSuccess: () =>
        utils.moneyMarketResearch.listMmResearchPathFavorites.invalidate(),
    });
  const usage = trpc.moneyMarketResearch.recordMmResearchPathUsage.useMutation({
    onSuccess: () =>
      utils.moneyMarketResearch.listMmResearchPathFavorites.invalidate(),
  });
  const openStep = (step: Step) => {
    if (navigatingTo) return;
    if (user) usage.mutate({ fromModuleId: moduleId, toModuleId: step.id });
    setNavigatingTo(step.id);
    toast.info(`正在打开 ${step.label}…`);
    window.setTimeout(() => window.location.assign(`/?module=money-market&open=${step.id}`), 180);
  };
  return (
    <Card
      title="跨模块研究路径推荐"
      action={<Route className="h-4 w-4 text-cyan-300" />}
    >
      <p className="mb-2 text-[11px] text-slate-500">
        路径仅串联来源核验、观察、计算、资料与交付步骤，不构成投资、政策或交易建议。登录后可收藏；同一入口内会按收藏和实际使用次数优先展示。
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {rankedSteps.map(step => {
          const preference = preferenceByTarget.get(step.id);
          const isOpening = navigatingTo === step.id;
          return (
            <div
              key={step.id}
              className={`flex rounded border transition-all duration-200 hover:border-cyan-800 ${isOpening ? "translate-x-1 border-cyan-600 bg-cyan-950/20" : "border-slate-800"}`}
            >
              <button
                type="button"
                disabled={Boolean(navigatingTo)}
                onClick={() => openStep(step)}
                className="flex min-w-0 flex-1 items-center justify-between p-3 text-left disabled:cursor-wait"
              >
                <span>
                  <b className="text-xs text-slate-200">{step.label}</b>
                  <span className="mt-1 block text-[10px] text-slate-500">
                    {isOpening
                      ? "正在切换终端模块…"
                      : `${step.reason}${user && preference?.usageCount ? ` · 已使用 ${preference.usageCount} 次` : ""}`}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
              </button>
              {user && (
                <button
                  type="button"
                  aria-label={`收藏 ${step.label}`}
                  disabled={Boolean(navigatingTo)}
                  onClick={() =>
                    favorite.mutate({
                      fromModuleId: moduleId,
                      toModuleId: step.id,
                    })
                  }
                  className={`border-l border-slate-800 px-3 transition-colors duration-150 disabled:opacity-50 ${preference?.isFavorited ? "text-amber-300" : "text-slate-600 hover:text-amber-200"}`}
                >
                  <Star
                    className={`h-4 w-4 ${preference?.isFavorited ? "fill-current" : ""}`}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
