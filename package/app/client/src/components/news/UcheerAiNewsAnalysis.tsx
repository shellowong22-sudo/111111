import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Props = {
  title: string;
  excerpt?: string | null;
  category?: string | null;
};

export default function UcheerAiNewsAnalysis({ title, excerpt, category }: Props) {
  const status = trpc.ucheerAi.status.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const analysis = trpc.ucheerAi.analyzeNews.useMutation();
  const result = analysis.data;
  const run = () => analysis.mutate({
    capability: "news_sentiment",
    title,
    excerpt: excerpt ?? "",
    category: category ?? "",
  });

  const configured = status.data?.runtime === "configured";
  const detail = result?.analysis;
  const direction = detail && "direction" in detail ? detail.direction : null;
  const strength = detail && "strength" in detail ? detail.strength : null;
  const directionLabel = direction === "positive" ? "偏积极" : direction === "negative" ? "偏谨慎" : "中性";
  const directionClass = direction === "positive"
    ? "text-emerald-300"
    : direction === "negative"
      ? "text-rose-300"
      : "text-slate-300";

  return (
    <section className="mt-4 rounded border border-violet-900/60 bg-violet-950/10 p-3" data-ucheer-ai-analysis="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          <p className="text-[10px] font-semibold tracking-wide text-violet-200">Ucheer AI · 新闻分析</p>
          <span className={`rounded border px-1.5 py-0.5 text-[8px] ${configured ? "border-emerald-800 text-emerald-300" : "border-amber-800 text-amber-300"}`}>
            {configured ? "模型已连接" : "待配置"}
          </span>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={analysis.isPending}
          className="inline-flex items-center gap-1 rounded border border-violet-800 px-2 py-1 text-[9px] text-violet-100 disabled:opacity-50"
        >
          {analysis.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {analysis.isPending ? "分析中" : result ? "重新分析" : "运行 Ucheer AI"}
        </button>
      </div>

      {!result && !analysis.isPending && (
        <p className="mt-2 text-[9px] leading-4 text-slate-500">
          在当前文章详情内运行结构化分析；不会改变原文，也不会把分析结果当作行情或交易建议。
        </p>
      )}
      {analysis.isPending && <p className="mt-2 text-[9px] text-violet-200">正在读取当前文章内容并生成结构化结果…</p>}
      {analysis.error && (
        <p role="alert" className="mt-2 text-[9px] text-rose-200">
          <AlertCircle className="mr-1 inline h-3 w-3" />{analysis.error.message}
        </p>
      )}
      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[9px]">
            <span className="text-slate-500">内容归类</span>
            <span className="rounded bg-violet-950/50 px-1.5 py-0.5 text-violet-100">{result.classification.category}</span>
            {result.analysis && "direction" in result.analysis && (
              <span className={`font-semibold ${directionClass}`}>{directionLabel}{strength ? ` · ${strength === "strong" ? "强" : strength === "moderate" ? "中" : "弱"}` : ""}</span>
            )}
          </div>
          {result.status === "unavailable" && (
            <p className="rounded border border-amber-900/60 bg-amber-950/20 p-2 text-[9px] leading-4 text-amber-200">{result.message}</p>
          )}
          {result.status === "error" && (
            <p className="rounded border border-rose-900/60 bg-rose-950/20 p-2 text-[9px] leading-4 text-rose-200">{result.message}</p>
          )}
          {result.status === "available" && result.analysis && (
            <div className="space-y-2">
              {"rationale" in result.analysis && <p className="text-[10px] leading-4 text-slate-300">{result.analysis.rationale}</p>}
              {"summary" in result.analysis && <p className="text-[10px] leading-4 text-slate-300">{result.analysis.summary}</p>}
              <ul className="space-y-1 text-[9px] leading-4 text-slate-400">
                {("keyPoints" in result.analysis ? result.analysis.keyPoints : []).map((point, index) => (
                  <li key={`${point}-${index}`}><CheckCircle2 className="mr-1 inline h-3 w-3 text-violet-300" />{point}</li>
                ))}
              </ul>
              <p className="text-[8px] text-slate-600">结果仅基于当前文章文字；生成时间 {new Date(result.generatedAt).toLocaleString("zh-CN", { hour12: false })}。</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
