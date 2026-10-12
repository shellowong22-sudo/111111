/**
 * 股票智能驾驶舱的实时部件：多周期实时 K 线（含分钟线）与标的资料 / 实时报价条。
 */
import { useState } from "react";
import KlineChart from "@/uc/market/KlineChart";
import { DEFAULT_PREFS, FeedList, NewsCtx, ReaderDrawer, useFeed, type News } from "@/uc/news/kit";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useLiveKline, useProfile, type Period } from "@/uc/market/live";

const PERIODS: Array<[Period, string]> = [["1m", "1 分"], ["5m", "5 分"], ["15m", "15 分"], ["30m", "30 分"], ["60m", "60 分"], ["1d", "日 K"], ["1w", "周 K"]];

export function CockpitKline({ symbol }: { symbol: string }) {
  const [period, setPeriod] = useState<Period>("5m");
  const k = useLiveKline(symbol, period, period === "1d" || period === "1w" ? 260 : 320);
  return (
    <section className="bg-[#0d1220]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-1.5">
        <h3 className="text-sm font-semibold text-cyan-100">{symbol} · 实时 K 线</h3>
        <div className="flex border border-slate-700 text-[10px]">{PERIODS.map(([p, l]) => <button key={p} type="button" onClick={() => setPeriod(p)} className={`px-2 py-0.5 ${period === p ? "bg-cyan-900/50 text-cyan-50" : "text-slate-400 hover:text-slate-100"}`}>{l}</button>)}</div>
      </div>
      {k.candles.length ? <KlineChart candles={k.candles} period={period} height={380} live overlay="BOLL" subs={["VOL", "MACD", "RSI"]} signals /> : <div className="flex h-[200px] items-center justify-center text-[11px] text-slate-500">{k.loading ? "K 线读取中…" : "该周期暂无 K 线"}</div>}
    </section>
  );
}

function CockpitNewsList({ symbol }: { symbol: string }) {
  const f = useFeed({ symbol, limit: 30 });
  return <FeedList items={f.items} loading={f.loading} empty="暂无与该标的相关的新闻" dense max={12} />;
}

/** 标的相关实时新闻（点击在抽屉中阅读） */
export function CockpitNews({ symbol }: { symbol: string }) {
  const [reading, setReading] = useState<News | null>(null);
  return (
    <NewsCtx.Provider value={{ prefs: DEFAULT_PREFS, open: setReading, openSymbol: () => undefined, selected: reading?.id ?? null }}>
      <section className="bg-[#0d1220]">
        <div className="border-b border-slate-800 px-3 py-1.5 text-sm font-semibold text-cyan-100">{symbol} · 相关新闻</div>
        <CockpitNewsList symbol={symbol} />
      </section>
      <ReaderDrawer item={reading} onClose={() => setReading(null)} />
    </NewsCtx.Provider>
  );
}

export function CockpitQuote({ symbol }: { symbol: string }) {
  const k = useLiveKline(symbol, "1d", 30);
  const p = useProfile(symbol);
  const t = k.tick;
  const pe = p.data?.metrics?.find((m) => /pe|市盈/i.test(m.key) || /市盈/.test(m.label));
  const cap = p.data?.metrics?.find((m) => /cap|市值/i.test(m.key) || /市值/.test(m.label));
  const amt = t?.amount ?? (t?.volume != null && t?.price != null ? t.volume * t.price : null);
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
      <span className="text-slate-100">{p.data?.name ?? t?.name ?? symbol}</span>
      <span className="text-slate-500">{[p.data?.exchange, p.data?.sector, p.data?.industry].filter(Boolean).join(" · ")}</span>
      <span className="font-mono text-[15px] font-semibold" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)}</span>
      <span className="font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</span>
      <span className="text-slate-500">成交额 <span className="font-mono text-slate-200">{fmtCompact(amt)}</span></span>
      {cap?.value != null && <span className="text-slate-500">市值 <span className="font-mono text-slate-200">{fmtCompact(cap.value)}</span></span>}
      {pe?.value != null && <span className="text-slate-500">市盈率 <span className="font-mono text-slate-200">{pe.value.toFixed(1)}</span></span>}
    </div>
  );
}
