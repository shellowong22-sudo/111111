import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Newspaper } from "lucide-react";
import { trpc } from "@/lib/trpc";

const sentimentText: Record<string, string> = {
  positive: "偏正面",
  neutral: "中性",
  negative: "偏负面",
  uncertain: "不确定",
};
const sentimentClass: Record<string, string> = {
  positive: "text-[#f2495c]",
  neutral: "text-amber-200",
  negative: "text-[#1fbf75]",
  uncertain: "text-slate-300",
};

export function StockCockpitNewsPanel({ symbol }: { symbol: string }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const publishedQuery = trpc.adminNewsIngestion.getPublished.useQuery(
    { limit: 60 },
    { retry: false }
  );
  const articles = useMemo(
    () =>
      (publishedQuery.data ?? []).filter(article =>
        article.tickers?.some(
          (ticker: string) => ticker.toUpperCase() === symbol.toUpperCase()
        )
      ),
    [publishedQuery.data, symbol]
  );
  const selected = articles.find(article => article.id === selectedId) ?? null;
  const categoryData = useMemo(
    () =>
      [
        ...articles
          .reduce((map, article) => {
            const key = article.category || "未分类";
            map.set(key, (map.get(key) ?? 0) + 1);
            return map;
          }, new Map<string, number>())
          .entries(),
      ].map(([name, count]) => ({ name, count })),
    [articles]
  );
  const sentimentData = useMemo(
    () =>
      ["positive", "neutral", "negative", "uncertain"].map(name => ({
        name: sentimentText[name],
        count: articles.filter(
          article => (article.sentiment ?? "uncertain") === name
        ).length,
      })),
    [articles]
  );

  return (
    <section
      aria-label="股票相关财经新闻与数据图"
      className="border border-amber-900/60 bg-[#0d1220] p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-100">
            <Newspaper className="h-4 w-4 text-amber-300" />
            {symbol} · 已审核财经新闻观察
          </h3>
          <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">
            仅汇总管理员已审核并发布、且关联当前标的的站内新闻摘要。分类和情绪图只统计这些真实文章元数据，不生成新闻后的价格反应或交易结论。
          </p>
        </div>
        <span className="border border-amber-900/70 bg-amber-950/30 px-2 py-1 font-mono text-[10px] text-amber-100">
          已关联 {publishedQuery.isLoading ? "—" : articles.length} 篇
        </span>
      </div>
      {publishedQuery.isLoading ? (
        <div className="mt-3 border border-dashed border-slate-700 p-3 text-[10px] text-slate-500">
          正在读取已审核发布的站内新闻…
        </div>
      ) : publishedQuery.isError ? (
        <div className="mt-3 border border-rose-900/60 bg-rose-950/20 p-3 text-[10px] text-rose-200">
          新闻元数据暂不可读取；系统不使用固定头条或模拟图表替代。
        </div>
      ) : !articles.length ? (
        <div className="mt-3 border border-dashed border-slate-700 p-3 text-[10px] text-slate-500">
            暂无与 {symbol}{" "}
            关联的已审核发布新闻。完成审核并发布后，此处会显示文章与数据图。
        </div>
      ) : (
        <>
          <div className="mt-3 grid divide-y divide-slate-800 border border-slate-800 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
            <div className="bg-[#080b13] p-2">
              <div className="mb-1 text-[10px] text-slate-500">
                发布新闻分类
              </div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#080b13",
                        border: "1px solid #78350f",
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="篇数"
                      fill="#f59e0b"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-[#080b13] p-2">
              <div className="mb-1 text-[10px] text-slate-500">
                发布新闻情绪标签
              </div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sentimentData}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#080b13",
                        border: "1px solid #78350f",
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="篇数"
                      fill="#22d3ee"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-3 grid border border-slate-800 xl:grid-cols-[.9fr_1.1fr]">
            <div className="divide-y divide-slate-800 xl:border-r xl:border-slate-800">
              {articles.map(article => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setSelectedId(article.id)}
                  className={`w-full border-0 p-2 text-left text-[10px] ${selectedId === article.id ? "bg-amber-950/20" : "bg-[#080b13] hover:bg-slate-900"}`}
                >
                  <div className="flex gap-2">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <span className="min-w-0 flex-1 leading-4 text-slate-100">
                      {article.title}
                    </span>
                    <span
                      className={`shrink-0 ${sentimentClass[article.sentiment ?? "uncertain"]}`}
                    >
                      {sentimentText[article.sentiment ?? "uncertain"]}
                    </span>
                  </div>
                  <div className="mt-1 pl-5 text-[9px] text-slate-500">
                    {article.category ?? "未分类"} ·{" "}
                    {article.publishedAt
                      ? new Date(article.publishedAt).toLocaleString("zh-CN")
                      : "—"}
                  </div>
                </button>
              ))}
            </div>
            {selected ? (
              <article className="bg-[#080b13] p-3">
                <div className="text-[10px] text-amber-300">
                  {selected.category ?? "未分类"} ·{" "}
                  {sentimentText[selected.sentiment ?? "uncertain"]}
                </div>
                <h4 className="mt-1 text-sm font-semibold leading-5 text-slate-100">
                  {selected.title}
                </h4>
                <p className="mt-2 text-xs leading-6 text-slate-300">
                  {selected.summary}
                </p>
                <div className="mt-3 border-t border-slate-800 pt-2 text-[9px] leading-4 text-slate-500">
                  发布时间：
                  {selected.publishedAt
                    ? new Date(selected.publishedAt).toLocaleString("zh-CN")
                    : "—"}
                  ；内容为审核发布的站内摘要。
                </div>
              </article>
            ) : (
              <div className="grid min-h-36 place-items-center bg-[#080b13] text-[10px] text-slate-500">
                选择一篇文章查看其站内摘要。
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
