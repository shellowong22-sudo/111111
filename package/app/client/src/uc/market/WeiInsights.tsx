/**
 * WEI 个股分析三联：技术面综合评分 · 基本面（估值 + 财务趋势）· 相关新闻（利好 / 利空 / 主题标签）。
 * 全部跟随主图所选标的实时更新。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import KlineChart from "./KlineChart";
import { DOWN, FLAT, UP, fmtCompact, useLiveKline, useNews, useProfile, type Candle, type Period } from "./live";
import { technicalSummary, tradeSignals } from "./indicators";
import { ReaderDrawer, toNews } from "@/uc/news/kit";

const PERIOD_LABEL: Record<Period, string> = { "1m": "分时", "5m": "5分钟", "15m": "15分钟", "30m": "30分钟", "60m": "60分钟", "1d": "日线", "1w": "周线", "1M": "月线" };

function Panel({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 bg-[#060f1b]">
      <div className="flex items-center justify-between border-b border-[#15304a] px-3 py-1.5">
        <span className="text-[11px] font-semibold text-cyan-200">{title}</span>
        <span className="text-[9px] text-slate-500">{extra}</span>
      </div>
      {children}
    </section>
  );
}

export function TechnicalPanel({ candles: main, period: mainPeriod, symbol }: { candles: Candle[]; period: Period; symbol?: string | null }) {
  // 主图周期 K 线不足（如分时刚开盘、指数无分钟数据）时自动改用日线评分，保证始终有完整的技术面判断
  const enough = main.length >= 60;
  const daily = useLiveKline(!enough && symbol ? symbol : null, "1d", 260);
  const candles = enough ? main : daily.candles;
  const period: Period = enough ? mainPeriod : "1d";
  const summary = useMemo(() => technicalSummary(candles), [candles]);
  const trades = useMemo(() => tradeSignals(candles).slice(-6).reverse(), [candles]);
  const buy = summary.signals.filter((s) => s.verdict > 0).length;
  const sell = summary.signals.filter((s) => s.verdict < 0).length;
  const neutral = summary.signals.length - buy - sell;
  const angle = Math.max(-1, Math.min(1, summary.score)) * 90;
  const color = summary.score >= 0.15 ? UP : summary.score <= -0.15 ? DOWN : FLAT;
  return (
    <Panel title="技术面分析" extra={`${PERIOD_LABEL[period]} · 随行情实时计算`}>
      <div className="flex items-center gap-3 px-3 py-2">
        <svg width={120} height={68} viewBox="0 0 120 68" aria-label={`技术评分 ${summary.label}`}>
          <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#1e293b" strokeWidth={10} />
          <path d="M10 62 A50 50 0 0 1 43 15" fill="none" stroke={DOWN} strokeOpacity={0.6} strokeWidth={10} />
          <path d="M77 15 A50 50 0 0 1 110 62" fill="none" stroke={UP} strokeOpacity={0.6} strokeWidth={10} />
          <line x1={60} y1={62} x2={60 + 44 * Math.sin((angle * Math.PI) / 180)} y2={62 - 44 * Math.cos((angle * Math.PI) / 180)} stroke="#e2e8f0" strokeWidth={2} />
          <circle cx={60} cy={62} r={4} fill="#e2e8f0" />
        </svg>
        <div>
          <div className="text-[18px] font-bold" style={{ color }}>{summary.label}</div>
          <div className="mt-0.5 flex gap-2 font-mono text-[10px]"><span style={{ color: UP }}>看多 {buy}</span><span className="text-slate-400">中性 {neutral}</span><span style={{ color: DOWN }}>看空 {sell}</span></div>
        </div>
      </div>
      <table className="w-full text-[10px]">
        <tbody className="divide-y divide-[#102538]">
          {summary.signals.map((s) => (
            <tr key={s.name}>
              <td className="px-3 py-1 font-mono text-slate-300">{s.name}</td>
              <td className="font-mono text-slate-400">{s.value}</td>
              <td className="text-slate-500">{s.note}</td>
              <td className="px-3 text-right" style={{ color: s.verdict > 0 ? UP : s.verdict < 0 ? DOWN : FLAT }}>{s.verdict > 0 ? "看多" : s.verdict < 0 ? "看空" : "中性"}</td>
            </tr>
          ))}
          {!summary.signals.length && <tr><td className="px-3 py-3 text-slate-600">{daily.loading ? "日线读取中…" : "该标的历史K线不足，暂不评分"}</td></tr>}
        </tbody>
      </table>
      <div className="border-t border-[#15304a] px-3 py-1 text-[10px] text-slate-500">最近买卖点（多指标共振，随行情实时刷新）</div>
      <table className="w-full text-[10px]"><tbody className="divide-y divide-[#102538]">
        {trades.map((t) => (
          <tr key={t.i}>
            <td className="px-3 py-1 font-mono font-bold" style={{ color: t.side === "B" ? UP : DOWN }}>{t.side === "B" ? "B 买" : "S 卖"}</td>
            <td className="font-mono text-slate-400">{new Date(candles[t.i].t + 8 * 3600e3).toISOString().slice(period.endsWith("m") && period !== "1M" ? 5 : 0, period.endsWith("m") && period !== "1M" ? 16 : 10).replace("T", " ")}{t.i === candles.length - 1 ? " · 实时" : ""}</td>
            <td className="px-3 text-slate-400">{t.reasons.join(" + ")}</td>
          </tr>
        ))}
        {!trades.length && <tr><td className="px-3 py-2 text-slate-600">近期没有多指标共振的买卖点</td></tr>}
      </tbody></table>
    </Panel>
  );
}

const fmtMetric = (v: number | null, key: string, unit?: string, currency?: string | null) => {
  if (v == null) return "—";
  if (key === "mcap" || key === "float") return `${fmtCompact(v)}${currency ? ` ${currency}` : ""}`;
  if (unit === "%") return `${v > 0 && /YoY/.test(key) ? "+" : ""}${v.toFixed(2)}%`;
  return Math.abs(v) >= 1000 ? fmtCompact(v) : v.toFixed(2);
};

export function FundamentalPanel({ symbol }: { symbol: string }) {
  const { data, loading } = useProfile(symbol);
  const [finIdx, setFinIdx] = useState(0);
  const fin = data?.financials[Math.min(finIdx, (data?.financials.length ?? 1) - 1)];
  const maxAbs = fin ? Math.max(...fin.points.map((p) => Math.abs(p.value)), 1) : 1;
  return (
    <Panel title="基本面" extra={data ? [data.exchange, data.currency].filter(Boolean).join(" · ") : undefined}>
      {loading && !data && <div className="px-3 py-6 text-center text-[10px] text-slate-500">基本面读取中…</div>}
      {!loading && !data && <div className="px-3 py-6 text-center text-[10px] text-slate-500">该标的为指数 / 期货 / 外汇，以技术面与新闻为主</div>}
      {data && (
        <div className="space-y-2 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
            <span className="font-semibold text-slate-100">{data.name ?? symbol}</span>
            {data.sector && <span className="rounded-sm bg-cyan-500/10 px-1 text-[9px] text-cyan-200">{data.sector}</span>}
            {data.industry && <span className="text-[9px] text-slate-500">{data.industry}</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {data.metrics.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-1">
                <span className="text-slate-500">{m.label}</span>
                <span className="font-mono" style={{ color: /YoY|margin/.test(m.key) && m.value != null ? (m.value > 0 ? UP : m.value < 0 ? DOWN : FLAT) : "#cbd5e1" }}>{fmtMetric(m.value, m.key, m.unit, data.currency)}</span>
              </div>
            ))}
          </div>
          {data.financials.length > 0 && fin && (
            <div>
              <div className="mb-1 flex flex-wrap gap-1">
                {data.financials.map((f, i) => (
                  <button key={f.label} type="button" onClick={() => setFinIdx(i)} className={`px-1.5 py-0.5 text-[9px] ${i === finIdx ? "bg-cyan-600/30 text-cyan-100" : "bg-[#0a1b2d] text-slate-400 hover:text-slate-100"}`}>{f.label}</button>
                ))}
              </div>
              <div className="flex h-[92px] items-end gap-1">
                {fin.points.map((p, i) => {
                  const prev = fin.points[i - 1]?.value;
                  const growth = prev ? ((p.value - prev) / Math.abs(prev)) * 100 : null;
                  return (
                    <div key={p.period} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`${p.period}：${fmtCompact(p.value)}${growth != null ? `（${growth > 0 ? "+" : ""}${growth.toFixed(1)}%）` : ""}`}>
                      <span className="font-mono text-[8px] text-slate-400">{fin.unit === "per" ? p.value.toFixed(2) : fmtCompact(p.value)}</span>
                      <div className="w-full max-w-[26px]" style={{ height: `${Math.max(2, (Math.abs(p.value) / maxAbs) * 58)}px`, background: p.value >= 0 ? "#0ea5e9" : DOWN, opacity: 0.55 + (i / fin.points.length) * 0.45 }} />
                      <span className="mt-0.5 font-mono text-[8px] text-slate-500">{p.period.slice(2, 7)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function ago(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}分钟前`;
  if (s < 86400) return `${Math.round(s / 3600)}小时前`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}天前`;
  return new Date(t).toLocaleDateString("zh-CN");
}

export function NewsPanel({ symbol, name }: { symbol: string; name: string | null }) {
  const { data, loading } = useNews(symbol, name);
  const [filter, setFilter] = useState<"all" | "pos" | "neg">("all");
  const [reading, setReading] = useState<ReturnType<typeof toNews> | null>(null);
  const list = (data ?? []).filter((n) => (filter === "pos" ? n.tone > 0 : filter === "neg" ? n.tone < 0 : true));
  const pos = (data ?? []).filter((n) => n.tone > 0).length;
  const neg = (data ?? []).filter((n) => n.tone < 0).length;
  const total = data?.length ?? 0;
  return (
    <Panel title="相关新闻 · 消息面" extra={total ? `${total} 条 · 每 2 分钟更新` : undefined}>
      {total > 0 && (
        <div className="flex items-center gap-2 border-b border-[#102538] px-3 py-1.5 text-[10px]">
          {([["all", `全部 ${total}`], ["pos", `利好 ${pos}`], ["neg", `利空 ${neg}`]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`px-1.5 py-0.5 ${filter === k ? "bg-cyan-600/30 text-cyan-100" : "text-slate-400 hover:text-slate-100"}`}>{label}</button>
          ))}
          <div className="ml-auto flex h-1.5 w-24 overflow-hidden rounded-sm bg-slate-700" title="消息面情绪">
            <div style={{ width: `${(pos / total) * 100}%`, background: UP }} />
            <div style={{ width: `${((total - pos - neg) / total) * 100}%`, background: FLAT }} />
            <div style={{ width: `${(neg / total) * 100}%`, background: DOWN }} />
          </div>
        </div>
      )}
      <div className="max-h-[360px] divide-y divide-[#102538] overflow-y-auto">
        {loading && !data && <div className="px-3 py-6 text-center text-[10px] text-slate-500">新闻读取中…</div>}
        {!loading && !total && <div className="px-3 py-6 text-center text-[10px] text-slate-500">暂无相关新闻</div>}
        {list.map((n) => (
          <div key={n.id} role="button" tabIndex={0} onClick={() => setReading(toNews(n, [symbol]))} className="block cursor-pointer px-3 py-1.5 hover:bg-[#0a1a2b]">
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0 rounded-sm px-1 text-[9px]" style={{ color: n.tone > 0 ? UP : n.tone < 0 ? DOWN : FLAT, background: n.tone > 0 ? "rgba(242,73,92,.12)" : n.tone < 0 ? "rgba(31,191,117,.12)" : "rgba(148,163,184,.1)" }}>{n.tone > 0 ? "利好" : n.tone < 0 ? "利空" : "中性"}</span>
              <span className="text-[11px] leading-4 text-slate-200">{n.title}</span>
            </div>
            {n.summary && <p className="mt-0.5 line-clamp-2 pl-8 text-[10px] leading-4 text-slate-500">{n.summary}</p>}
            <div className="mt-0.5 flex gap-1.5 pl-8 text-[9px] text-slate-600">
              <span>{ago(n.time)}</span>
              {n.tags.map((t) => <span key={t} className="text-cyan-500/80">#{t}</span>)}
            </div>
          </div>
        ))}
      </div>
      <ReaderDrawer item={reading} onClose={() => setReading(null)} />
    </Panel>
  );
}

/** 证券详情里的实时日 K（带成交量、MACD 与买卖点） */
export function ListingKline({ symbol }: { symbol: string | null }) {
  const [period, setPeriod] = useState<Period>("1d");
  const k = useLiveKline(symbol, period, 260);
  if (!symbol) return null;
  return (
    <div className="border-t border-[#15304a] bg-[#050b13]">
      <div className="flex items-center justify-between px-2 py-1 text-[10px]">
        <span className="text-cyan-200">{symbol} · 实时K线</span>
        <span className="flex border border-[#1d3b58]">{(["5m", "60m", "1d", "1w"] as Period[]).map((p) => <button key={p} type="button" onClick={() => setPeriod(p)} className={`px-1.5 ${period === p ? "bg-cyan-600/30 text-cyan-100" : "text-slate-400"}`}>{PERIOD_LABEL[p]}</button>)}</span>
      </div>
      {k.candles.length ? <KlineChart candles={k.candles} period={period} height={260} live overlay="MA" subs={["VOL", "MACD"]} signals /> : <div className="flex h-[120px] items-center justify-center text-[10px] text-slate-500">{k.loading ? "K线读取中…" : "该证券暂无K线"}</div>}
    </div>
  );
}

/** 行情表里的迷你 K 线（进入视口才加载） */
export function MiniKline({ symbol, width = 96, height = 26 }: { symbol: string; width?: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const k = useLiveKline(visible ? symbol : null, "1d", 40);
  return <div ref={ref} style={{ width, height }}>{k.candles.length > 2 ? <KlineChart candles={k.candles} period="1d" height={height} mini /> : null}</div>;
}
