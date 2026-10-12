/**
 * 「实时行情K线」模块模板：数据集里列出代码，前端每个代码一张实时跳动的 K 线卡片，点开看大图。
 * 管理后台预览用的是同一个组件。
 */
import { useState } from "react";
import KlineChart from "./KlineChart";
import { fmtPct, fmtPrice, toneOf, useFlash, useLiveKline, useTicks, type Period, type Tick } from "./live";

function Card({ symbol, name, tick, period, onOpen, active }: { symbol: string; name: string; tick: Tick | null | undefined; period: Period; onOpen: () => void; active: boolean }) {
  const { candles, loading } = useLiveKline(symbol, period, 64);
  const tone = toneOf(tick?.changePct);
  const flash = useFlash(tick?.price);
  return (
    <button type="button" onClick={onOpen} className={`flex min-w-0 flex-col rounded-lg border text-left transition-colors ${active ? "border-teal-400/60 bg-teal-400/[0.06]" : "border-white/5 bg-black/20 hover:border-white/15"}`}>
      <div className="flex items-baseline justify-between gap-1 px-2 pt-1.5">
        <span className="truncate text-[11px] text-slate-200">{tick?.name ?? name}</span>
        <span className="shrink-0 font-mono text-[9px] text-slate-500">{symbol}</span>
      </div>
      <div className="flex items-baseline justify-between gap-1 px-2">
        <span className="font-mono text-[14px] font-semibold transition-colors" style={{ color: tone, backgroundColor: flash === "up" ? "rgba(242,73,92,.2)" : flash === "down" ? "rgba(31,191,117,.2)" : "transparent" }}>{fmtPrice(tick?.price)}</span>
        <span className="font-mono text-[10px]" style={{ color: tone }}>{fmtPct(tick?.changePct)}</span>
      </div>
      <div className="px-1 pb-1">{candles.length ? <KlineChart candles={candles} period={period} height={48} mini live prevClose={tick?.prevClose} /> : <div className="flex h-12 items-center justify-center text-[9px] text-slate-600">{loading ? "读取中…" : "暂无K线"}</div>}</div>
    </button>
  );
}

function Big({ symbol, period }: { symbol: string; period: Period }) {
  const [p, setP] = useState<Period>(period);
  const { candles, tick, loading } = useLiveKline(symbol, p, 240);
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-2">
      <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px]">
        {(["1m", "5m", "15m", "60m", "1d", "1w", "1M"] as Period[]).map((x) => (
          <button key={x} type="button" onClick={() => setP(x)} className={`rounded px-1.5 py-0.5 ${p === x ? "bg-teal-500/20 text-teal-100" : "text-slate-400 hover:text-slate-200"}`}>{{ "1m": "分时", "5m": "5分", "15m": "15分", "30m": "30分", "60m": "60分", "1d": "日K", "1w": "周K", "1M": "月K" }[x]}</button>
        ))}
      </div>
      {candles.length ? <KlineChart candles={candles} period={p} height={300} live prevClose={p === "1m" ? tick?.prevClose : null} /> : <div className="flex h-[300px] items-center justify-center text-xs text-slate-500">{loading ? "K线读取中…" : "暂无K线"}</div>}
    </div>
  );
}

export default function LiveBoard({ rows, symbolField, nameField, period }: { rows: Array<Record<string, unknown>>; symbolField?: string; nameField?: string; period: Period }) {
  const list = rows
    .map((r) => ({ symbol: String(r[symbolField ?? "代码"] ?? "").trim(), name: String(r[nameField ?? "名称"] ?? "") }))
    .filter((x) => x.symbol)
    .slice(0, 40);
  const ticks = useTicks(list.map((x) => x.symbol));
  const [open, setOpen] = useState<string | null>(null);
  if (!list.length) return <div className="py-8 text-center text-xs text-slate-500">没有代码字段，请在模块配置里选择“代码字段”</div>;
  return (
    <div className="space-y-2">
      {open && <Big key={open} symbol={open} period={period} />}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((x) => <Card key={x.symbol} symbol={x.symbol} name={x.name || x.symbol} tick={ticks[x.symbol]} period={period} active={open === x.symbol} onOpen={() => setOpen(open === x.symbol ? null : x.symbol)} />)}
      </div>
    </div>
  );
}
