import { useState } from "react";
import {
  AlertTriangle,
  Database,
  FileText,
  Newspaper,
  X,
  Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface Props {
  onClose?: () => void;
}

const ACCENT = "#8b5cf6";
const tabs = ["news", "research", "alerts"] as const;

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="m-4 rounded border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function impactColor(impact: string | null) {
  return impact === "Positive"
    ? "text-green-400"
    : impact === "Negative"
      ? "text-red-400"
      : "text-gray-400";
}

function impactBg(impact: string | null) {
  return impact === "Positive"
    ? "border-green-500/30 bg-green-500/10"
    : impact === "Negative"
      ? "border-red-500/30 bg-red-500/10"
      : "border-gray-700 bg-gray-800/50";
}

export default function CNDSPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("news");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const status = trpc.municipalResearch.getCndsMunicipalNewsStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = status.data;
  const news = data?.news ?? [];
  const selected = news.find(item => item.id === selectedId) ?? null;
  const limitation =
    data?.limitation ??
    "正在检查地方债新闻与研究数据契约；失败时不会回退到新闻中心或静态新闻。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            CNDS
          </span>
          <span className="text-sm font-semibold text-white">
            地方债新闻与研究
          </span>
          <span className="rounded border border-slate-600 bg-slate-700/30 px-2 py-0.5 text-[10px] text-slate-400">
            未接入
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex items-start gap-2 border-b border-purple-900/70 bg-purple-950/20 px-4 py-3 text-xs text-purple-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-purple-300/70">
            {data?.dataContractId ?? "municipal-cnds-news-research"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <nav className="flex shrink-0 border-b border-gray-800 bg-gray-900">
        {tabs.map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "border-b-2 px-4 py-2 text-xs font-medium transition-colors",
              tab === item
                ? "border-purple-400 text-purple-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {item === "news"
              ? "实时新闻"
              : item === "research"
                ? "研究报告"
                : "信用预警"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "news" &&
          (news.length ? (
            <div className="flex h-full">
              <div className="w-80 shrink-0 overflow-auto border-r border-gray-800">
                {news.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "block w-full border-b border-gray-800/50 p-3 text-left transition-colors",
                      selectedId === item.id
                        ? "border-l-2 border-l-purple-500 bg-purple-500/10"
                        : "hover:bg-gray-800/30"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-gray-500">
                        {item.publishedAt}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-semibold",
                          impactColor(item.impact)
                        )}
                      >
                        {item.impact ?? "—"}
                      </span>
                    </div>
                    <div className="mb-0.5 text-[10px] text-purple-400">
                      {item.category}
                    </div>
                    <div className="line-clamp-2 text-xs leading-tight text-white">
                      {item.title}
                    </div>
                  </button>
                ))}
              </div>
              {selected && (
                <div className="flex-1 overflow-auto p-4">
                  <div
                    className={cn(
                      "mb-4 rounded border p-4",
                      impactBg(selected.impact)
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        {selected.category} · {selected.publishedAt}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-bold",
                          impactColor(selected.impact)
                        )}
                      >
                        {selected.impact ?? "—"}
                      </span>
                    </div>
                    <h3 className="mb-3 text-sm font-bold text-white">
                      {selected.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-gray-300">
                      {selected.summary ?? "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selected.tags.map(tag => (
                        <span
                          key={tag}
                          className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                      {selected.rating && (
                        <span className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400">
                          {selected.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded border border-purple-500/30 bg-gray-900 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-400">
                        站内分析状态
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-gray-300">
                      当前只展示后端清洗后的事件文本；没有授权事件分类和研究模型时，不生成投资建议或交易方向。
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="实时新闻未接入"
              detail="需要地方债专属、可审计的新闻事件与发布时间。当前不复制新闻中心、评级页面或发行页面内容。"
            />
          ))}

        {tab === "research" &&
          (data?.researchReports.length ? (
            <div className="p-4">
              <h3 className="mb-4 text-sm font-semibold text-white">
                最新研究报告
              </h3>
              <div className="space-y-2">
                {data.researchReports.map(report => (
                  <div
                    key={report.id}
                    className="flex items-center gap-4 rounded border border-gray-800 bg-gray-900 p-3"
                  >
                    <FileText className="h-8 w-8 shrink-0 text-purple-400" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        {report.title}
                      </div>
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {report.firm} · {report.reportType} ·{" "}
                        {report.pages == null
                          ? "页数未披露"
                          : `${report.pages}页`}{" "}
                        · {report.publishedAt}
                      </div>
                    </div>
                    <span className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-[10px] text-gray-400">
                      {report.recommendation ?? "未披露"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="研究报告未接入"
              detail="需要获准的机构研究元数据和摘要。当前不生成机构名称、页数、评级建议或重复外部报告卡片。"
            />
          ))}

        {tab === "alerts" &&
          (data?.creditAlerts.length ? (
            <div className="space-y-3 p-4">
              <h3 className="mb-2 text-sm font-semibold text-white">
                信用预警监控
              </h3>
              {data.creditAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="rounded border border-gray-800 bg-gray-900 p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {alert.issuer}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-400">
                        {alert.rating ?? "—"}
                      </span>
                      <span className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
                        {alert.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">{alert.alert}</p>
                  <p className="mt-1 text-[9px] text-gray-600">
                    {alert.observedAt} · {alert.level}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="信用预警未接入"
              detail="需要有来源审计的信用事件、评级变更或披露异常。当前不生成减持、回避或关注建议。"
            />
          ))}
      </div>
    </div>
  );
}
