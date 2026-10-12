/**
 * 直通式处理（STP）小窗功能 —— 第一组：公用件 + 申报工作台 / 成交簿 / 外汇交收 / 交收预警 / 监管日程。
 * 数据：平台自有交易系统（委托 / 成交 / 持仓 / 交收日 / 费用 / 事件流水，永久入库）、实时行情、参考汇率、经济日历。
 * 没有交易记录时显示空状态与下单票据，不编造任何记录。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Bars, useHub } from "@/uc/hubs/kit";
import { heat } from "@/uc/hubs/calc";
import { Seg, Spark } from "@/uc/news/kit";
import { Empty, Kpis, PanelShell, SectionHead, VirtualRows } from "@/uc/panels/kit";
import { OrderTicket, useFills, useOrders, usePositions, useSummary, type Fill } from "@/uc/trade/kit";

export type P = { onClose?: () => void };

/* ------------------------------------------------------------------ 公用件 */
export const TH = "sticky top-0 z-[1] bg-[#0a1726] text-[10px] text-slate-500";
export const TR = "border-t border-[#0f1b29] hover:bg-[#0a1726]";
export const UPC = "#f2495c";
export const DNC = "#1fbf75";

/** 整页外壳：STP 页面直接渲染面板（无外层窗口），这里给出满屏高度 */
export function Frame(props: { code: string; title: string; onClose?: () => void; tabs?: Array<[string, string]>; tab?: string; setTab?: (t: string) => void; right?: React.ReactNode; children: React.ReactNode }) {
  return <div className="h-screen min-h-[560px] bg-[#03070c] text-slate-200"><PanelShell {...props} /></div>;
}

/** 无交易记录时的空状态：说明 + 下单票据 */
export function NoTrades({ what, strategy, loading }: { what: string; strategy?: string; loading?: boolean }) {
  if (loading) return <Empty loading />;
  return (
    <div className="border-b border-[#1a2a3c]">
      <div className="px-3 py-3 text-[11px] text-slate-400">{what}</div>
      <OrderTicket strategy={strategy} />
    </div>
  );
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** 各市场交收路由（与平台撮合引擎的交收规则一致） */
export const ROUTE: Record<string, { name: string; ex: string; csd: string; cycle: string; days: number; ccy: string; lot: string; tz: string }> = {
  CN: { name: "A股", ex: "上交所 / 深交所 / 北交所", csd: "中国证券登记结算", cycle: "T+1", days: 1, ccy: "CNY", lot: "100 股（可转债 10 张）", tz: "Asia/Shanghai" },
  HK: { name: "港股", ex: "香港联交所", csd: "香港中央结算（中央结算系统）", cycle: "T+2", days: 2, ccy: "HKD", lot: "1 股", tz: "Asia/Hong_Kong" },
  US: { name: "美股", ex: "美国全国市场体系", csd: "美国存管信托 / 全国证券清算", cycle: "T+1", days: 1, ccy: "USD", lot: "1 股", tz: "America/New_York" },
  FUT: { name: "期货/外汇", ex: "期货 / 外汇 / 数字资产", csd: "中央对手方当日结算", cycle: "T+0", days: 0, ccy: "USD", lot: "1 单位", tz: "America/New_York" },
  INTL: { name: "其他市场", ex: "其他国际交易所", csd: "当地中央存管", cycle: "T+2", days: 2, ccy: "USD", lot: "1 股", tz: "UTC" },
};
export const mktName = (m: string) => ROUTE[m]?.name ?? m;

/** 由代码推断交易场所 */
export function venueOf(symbol: string, market?: string) {
  const s = symbol.trim();
  if (/^sh/i.test(s)) return "上交所";
  if (/^sz/i.test(s)) return "深交所";
  if (/^bj/i.test(s)) return "北交所";
  if (/\.HK$/i.test(s) || market === "HK") return "港交所";
  if (market === "US") return "美国市场";
  if (market === "FUT") return "期货/外汇";
  if (market === "INTL") return "其他国际市场";
  return mktName(market ?? "");
}
/** 按代码规则识别市场（用于尚未成交的代码；已成交的以成交记录为准） */
const FUT_ROOTS = new Set(["CL", "GC", "SI", "HG", "NG", "ZN", "ZT", "ZF", "ZB", "ES", "NQ", "YM", "RTY", "BRENT", "ZC", "ZS", "ZW", "BTC", "ETH", "DXY"]);
export function marketOfCode(code: string) {
  const s = code.trim();
  if (/^(sh|sz|bj)\d{6}$/i.test(s)) return "CN";
  if (/\.HK$/i.test(s)) return "HK";
  if (/=F$/i.test(s) || FUT_ROOTS.has(s.toUpperCase()) || /^[A-Z]{6}$/.test(s)) return "FUT";
  if (/\.[A-Z]{1,3}$/i.test(s)) return "INTL";
  if (/^\^/.test(s)) return "INTL";
  return "US";
}
export const lotOf = (code: string) => (marketOfCode(code) === "CN" ? (/^(sh|sz)(11|12)/i.test(code) ? 10 : 100) : 1);

export type Fx = { date: string; rates: Record<string, number>; history: Record<string, number[]>; dates: string[]; policy: Array<{ bank: string; rate: number | null; date: string | null }> };
export const useFx = () => usePolled<Fx>("ucHubs.fx", {}, 1800_000);
/** 1 单位某币种折合多少人民币（参考汇率） */
export function cnyPer(ccy: string, fx: Fx | null | undefined) {
  if (ccy === "CNY") return 1;
  const cny = fx?.rates?.CNY;
  if (!cny) return null;
  if (ccy === "USD") return cny;
  const r = fx?.rates?.[ccy];
  return r ? cny / r : null;
}
export const toCny = (v: number, ccy: string, fx: Fx | null | undefined) => { const r = cnyPer(ccy, fx); return r == null ? null : v * r; };
/** 成交对应的交收现金流（买入付款为负，卖出收款为正，含费用） */
export const cashOf = (f: Fill) => (f.side === "B" ? -(f.notional + f.fee + f.tax) : f.notional - f.fee - f.tax);

export const today = () => new Date().toLocaleDateString("sv-SE");
const dUTC = (d: string) => new Date(`${d}T00:00:00Z`);
export function addBiz(date: string, n: number) {
  const d = dUTC(date);
  let k = n;
  while (k > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) k--; }
  return d.toISOString().slice(0, 10);
}
/** a → b 之间的工作日数（b 早于 a 为负） */
export function bizBetween(a: string, b: string) {
  if (a === b) return 0;
  const sign = b > a ? 1 : -1;
  const d = dUTC(sign > 0 ? a : b);
  const end = sign > 0 ? b : a;
  let n = 0;
  while (d.toISOString().slice(0, 10) < end) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n * sign;
}
export const weekdayZh = (d: string) => "日一二三四五六"[dUTC(d).getUTCDay()];
export const isWeekend = (d: string) => [0, 6].includes(dUTC(d).getUTCDay());

/** 平台内唯一交易标识：市场 + 交易日 + 成交号 + 委托号，确定性生成 */
export const uti = (f: Fill) => `UC${f.market}${f.tradeDate.replace(/-/g, "")}${String(f.id).padStart(8, "0")}${f.orderId.toString(36).toUpperCase()}`;
/** 交易报告截止日：交易日后一个工作日 */
export const dueOf = (f: Fill) => addBiz(f.tradeDate, 1);

const hmIn = (ts: number, tz: string) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ts));
  return (Number(p.find((x) => x.type === "hour")?.value) % 24) * 60 + Number(p.find((x) => x.type === "minute")?.value);
};
/** 成交时间所处的交易时段（按市场当地时间） */
export function sessionOf(market: string, ts: number): "常规时段" | "延长时段" | "非交易时段" | "全天候" {
  const r = ROUTE[market];
  if (!r || market === "FUT") return "全天候";
  const m = hmIn(ts, r.tz);
  const within = (a: number, b: number) => m >= a && m <= b;
  if (market === "CN") return within(555, 690) || within(780, 900) ? "常规时段" : "非交易时段";
  if (market === "HK") return within(540, 720) || within(780, 970) ? "常规时段" : "非交易时段";
  if (market === "US") return within(570, 960) ? "常规时段" : within(240, 1200) ? "延长时段" : "非交易时段";
  return "常规时段";
}

export function downloadCsv(name: string, rows: Array<Array<string | number | null>>) {
  const text = rows.map((r) => r.map((c) => { const s = c == null ? "" : String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  const blob = new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const Btn = ({ onClick, children, tone = "cyan", disabled }: { onClick: () => void; children: React.ReactNode; tone?: "cyan" | "amber" | "red"; disabled?: boolean }) => (
  <button type="button" disabled={disabled} onClick={onClick} className={`border px-2 text-[10px] disabled:opacity-40 ${tone === "amber" ? "border-amber-700 text-amber-200" : tone === "red" ? "border-red-800 text-red-200" : "border-cyan-800 text-cyan-200"}`}>{children}</button>
);
/** 点击标的在窗口右侧打开实时 K 线（须在 Frame 内部渲染才能取到上下文） */
export function Pick({ s, children }: { s: string; children: React.ReactNode }) {
  const { pick } = useHub();
  return <span className="cursor-pointer hover:underline" onClick={() => pick(s)}>{children}</span>;
}
export const SideTxt = ({ s }: { s: "B" | "S" }) => <span style={{ color: s === "B" ? UPC : DNC }}>{s === "B" ? "买" : "卖"}</span>;
export const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
export const fmtDur = (ms: number | null) => { if (ms == null || !Number.isFinite(ms)) return "—"; const s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return `${s} 秒`; if (s < 3600) return `${Math.floor(s / 60)} 分 ${s % 60} 秒`; if (s < 86400) return `${Math.floor(s / 3600)} 时 ${Math.floor((s % 3600) / 60)} 分`; return `${Math.floor(s / 86400)} 天 ${Math.floor((s % 86400) / 3600)} 时`; };
export const utcIso = (ts: number) => new Date(ts).toISOString().replace("T", " ").slice(0, 19);

/* ================================================================== RESD 交易申报工作台 */
export function StpRESD({ onClose }: P) {
  const f = useFills();
  const o = useOrders();
  const now = useNow(1000);
  const [tab, setTab] = useState("rec");
  const names = useMemo(() => new Map((o.data ?? []).map((x) => [x.id, x.name])), [o.data]);
  const rows = useMemo(() => (f.data ?? []).map((x) => ({ f: x, uti: uti(x), due: dueOf(x), sess: sessionOf(x.market, x.ts), name: names.get(x.orderId) ?? null })), [f.data, names]);
  type R = (typeof rows)[number];
  const td = today();
  const open = rows.filter((r) => r.due >= td).sort((a, b) => a.due.localeCompare(b.due) || a.f.ts - b.f.ts);
  const dueMs = (d: string) => new Date(`${d}T23:59:59`).getTime();
  const checks: Array<[string, (r: R) => boolean]> = [
    ["数量为正", (r) => r.f.qty > 0],
    ["价格为正", (r) => r.f.px > 0],
    ["名义金额 = 数量 × 价格", (r) => Math.abs(r.f.notional - r.f.qty * r.f.px) <= Math.max(0.01, r.f.notional * 1e-6)],
    ["交收日不早于交易日", (r) => r.f.settleDate >= r.f.tradeDate],
    ["交收周期符合市场规则", (r) => bizBetween(r.f.tradeDate, r.f.settleDate) === (ROUTE[r.f.market]?.days ?? -1)],
    ["成交时间在交易时段内", (r) => r.sess !== "非交易时段"],
    ["证券简称可识别", (r) => !!r.name],
    ["交收币种已登记", (r) => !!r.f.ccy],
  ];
  const fails = (r: R) => checks.filter(([, fn]) => !fn(r)).map(([k]) => k);
  const exportCsv = () => downloadCsv(`交易申报_${td}.csv`, [["UTI", "成交号", "委托号", "执行时间(UTC)", "交易日", "交收日", "申报截止", "市场", "场所", "代码", "简称", "方向", "数量", "价格", "币种", "名义金额", "佣金", "税费", "时段", "校验"], ...rows.map((r) => [r.uti, r.f.id, r.f.orderId, utcIso(r.f.ts), r.f.tradeDate, r.f.settleDate, r.due, mktName(r.f.market), venueOf(r.f.symbol, r.f.market), r.f.symbol, r.name, r.f.side === "B" ? "买入" : "卖出", r.f.qty, r.f.px, r.f.ccy, r.f.notional.toFixed(2), r.f.fee.toFixed(2), r.f.tax.toFixed(2), r.sess, fails(r).join("；") || "通过"])]);
  const empty = !rows.length;
  return (
    <Frame code="RESD" title="交易报告申报工作台" onClose={onClose} tabs={[["rec", "申报记录"], ["chk", "字段校验"], ["due", "申报时限"]]} tab={tab} setTab={setTab} right={rows.length ? <Btn onClick={exportCsv}>导出申报文件</Btn> : null}>
      <Kpis items={[["可申报成交", String(rows.length), "每笔成交生成一条交易报告"], ["今日新增", String(rows.filter((r) => r.f.tradeDate === td).length)], ["申报窗口内", String(open.length), "截止 = 交易日后一个工作日"], ["校验未通过", String(rows.filter((r) => fails(r).length).length), "见“字段校验”"]]} />
      {empty ? <NoTrades loading={f.loading && !f.data} what="尚无成交，因此没有需要申报的交易报告。提交委托并成交后，系统按每笔成交自动生成交易标识（UTI）与申报字段。" strategy="RESD" /> : <>
        {tab === "rec" && <>
          <SectionHead title="逐笔交易报告" sub="交易标识按 市场 + 交易日 + 成交号 + 委托号 确定性生成，同一笔成交始终对应同一标识" />
          <VirtualRows rows={rows} height={560} header={<thead className={TH}><tr><th className="px-2 py-1 text-left">交易标识</th><th className="text-left">执行时间(UTC)</th><th className="text-left">场所</th><th className="text-left">标的</th><th className="text-center">方向</th><th className="text-right">数量</th><th className="text-right">价格</th><th className="text-right">名义金额</th><th className="text-left pl-2">币种</th><th className="text-left">截止</th><th className="px-2 text-left">状态</th></tr></thead>} render={(r) => { const bad = fails(r); return <tr key={r.f.id} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-cyan-200">{r.uti}</td><td className="font-mono text-[10px] text-slate-400">{utcIso(r.f.ts)}</td><td className="text-slate-400">{venueOf(r.f.symbol, r.f.market)}</td><td className="text-slate-100">{r.name ?? r.f.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.f.symbol}</span></td><td className="text-center"><SideTxt s={r.f.side} /></td><td className="text-right font-mono">{r.f.qty}</td><td className="text-right font-mono text-white">{fmtPrice(r.f.px)}</td><td className="text-right font-mono text-slate-300">{fmtCompact(r.f.notional)}</td><td className="pl-2 text-slate-400">{r.f.ccy}</td><td className="font-mono text-[10px] text-slate-400">{r.due}</td><td className="px-2" style={{ color: bad.length ? "#fbbf24" : r.due >= td ? "#38bdf8" : "#34d399" }} title={bad.join("；")}>{bad.length ? `待修正(${bad.length})` : r.due >= td ? "窗口内" : "已归档"}</td></tr>; }} />
        </>}
        {tab === "chk" && <>
          <SectionHead title="申报字段校验规则" sub="对每笔成交逐项校验，失败项会在导出文件的“校验”列列出" />
          <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">规则</th><th className="text-right">通过</th><th className="text-right">未通过</th><th className="px-2 text-right">通过率</th></tr></thead>
            <tbody>{checks.map(([k, fn]) => { const ok = rows.filter(fn).length; const pct = (ok / rows.length) * 100; return <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-200">{k}</td><td className="text-right font-mono text-emerald-300">{ok}</td><td className="text-right font-mono" style={{ color: rows.length - ok ? "#fbbf24" : "#64748b" }}>{rows.length - ok}</td><td className="px-2 text-right font-mono" style={{ background: heat(pct - 100, 20) }}>{pct.toFixed(1)}%</td></tr>; })}</tbody></table>
          <SectionHead title="未通过校验的记录" />
          <table className="w-full text-[11px]"><tbody>{rows.filter((r) => fails(r).length).slice(0, 200).map((r) => <tr key={r.f.id} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-cyan-200">{r.uti}</td><td className="text-slate-200">{r.f.symbol}</td><td className="px-2 text-amber-200">{fails(r).join("；")}</td></tr>)}{!rows.some((r) => fails(r).length) && <tr><td className="px-2 py-4 text-slate-500">全部记录通过校验。</td></tr>}</tbody></table>
          <SectionHead title="按交易时段分布" sub="按各市场当地时间判断成交所在时段" />
          <table className="w-full text-[11px]"><tbody>{Object.entries(rows.reduce<Record<string, number>>((a, r) => { const k = `${mktName(r.f.market)} · ${r.sess}`; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-300">{k}</td><td className="px-2 text-right font-mono text-white">{n}</td></tr>)}</tbody></table>
        </>}
        {tab === "due" && <>
          <SectionHead title="申报时限倒计时" sub="截止时间按本地时间截止日 23:59:59 计" />
          <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">交易标识</th><th className="text-left">标的</th><th className="text-left">交易日</th><th className="text-left">截止日</th><th className="px-2 text-right">剩余</th></tr></thead>
            <tbody>{open.map((r) => { const left = dueMs(r.due) - now; return <tr key={r.f.id} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-cyan-200">{r.uti}</td><td className="text-slate-200">{r.name ?? r.f.symbol}</td><td className="font-mono text-slate-400">{r.f.tradeDate}</td><td className="font-mono text-slate-300">{r.due}（周{weekdayZh(r.due)}）</td><td className="px-2 text-right font-mono" style={{ color: left < 4 * 3600e3 ? "#f87171" : left < 24 * 3600e3 ? "#fbbf24" : "#e2e8f0" }}>{fmtDur(left)}</td></tr>; })}{!open.length && <tr><td colSpan={5} className="px-2 py-4 text-slate-500">当前没有处于申报窗口内的成交，历史记录均已过截止日。</td></tr>}</tbody></table>
        </>}
      </>}
    </Frame>
  );
}

/* ================================================================== BLOT 实时成交簿 */
export function StpBLOT({ onClose }: P) {
  const f = useFills();
  const fx = useFx();
  const fills = f.data ?? [];
  const [side, setSide] = useState<"ALL" | "B" | "S">("ALL");
  const [ticket, setTicket] = useState(false);
  const syms = useMemo(() => [...new Set(fills.slice(0, 300).map((x) => x.symbol))].slice(0, 60), [fills]);
  const t = useTicks(syms);
  const td = today();
  const sign = (x: Fill) => (x.side === "B" ? 1 : -1);
  const mtm = (x: Fill) => { const p = t[x.symbol]?.price; return p ? (p - x.px) * x.qty * sign(x) : null; };
  const bps = (x: Fill) => { const p = t[x.symbol]?.price; return p ? (p / x.px - 1) * 1e4 * sign(x) : null; };
  const list = fills.filter((x) => side === "ALL" || x.side === side);
  const tdF = fills.filter((x) => x.tradeDate === td);
  const sumCny = (arr: Fill[], fn: (x: Fill) => number | null) => arr.reduce((s, x) => { const v = fn(x); const c = v == null ? null : toCny(v, x.ccy, fx.data); return c == null ? s : s + c; }, 0);
  const bpsAll = fills.map(bps).filter((v): v is number => v != null);
  const grid = useMemo(() => { const g = Array.from({ length: 7 }, () => new Array(24).fill(0)); for (const x of fills) { const d = new Date(x.ts); g[(d.getDay() + 6) % 7][d.getHours()] += 1; } return g; }, [fills]);
  const gmax = Math.max(1, ...grid.flat());
  const bySym = useMemo(() => Object.values(fills.reduce<Record<string, { s: string; ccy: string; bq: number; bn: number; sq: number; sn: number; n: number }>>((a, x) => { const r = (a[x.symbol] ??= { s: x.symbol, ccy: x.ccy, bq: 0, bn: 0, sq: 0, sn: 0, n: 0 }); r.n++; if (x.side === "B") { r.bq += x.qty; r.bn += x.notional; } else { r.sq += x.qty; r.sn += x.notional; } return a; }, {})).sort((a, b) => b.bn + b.sn - a.bn - a.sn), [fills]);
  return (
    <Frame code="BLOT" title="实时成交簿" onClose={onClose} right={<><Seg value={side} options={[["ALL", "全部"], ["B", "买入"], ["S", "卖出"]]} onChange={setSide} /><Btn onClick={() => setTicket((v) => !v)}>{ticket ? "收起下单" : "下单"}</Btn></>}>
      {ticket && <OrderTicket strategy="BLOT" />}
      <Kpis items={[["今日成交", `${tdF.length} 笔`, `折合人民币 ${fmtCompact(sumCny(tdF, (x) => x.notional))}`], ["买 / 卖笔数", `${fills.filter((x) => x.side === "B").length} / ${fills.filter((x) => x.side === "S").length}`, `累计 ${fills.length} 笔`], ["执行后价值变动", <span style={{ color: toneOf(sumCny(fills, mtm)) }}>{fmtCompact(sumCny(fills, mtm))}</span>, "按最新价相对成交价，折合人民币"], ["执行后表现中位数", <span style={{ color: toneOf(median(bpsAll)) }}>{median(bpsAll) == null ? "—" : `${median(bpsAll)!.toFixed(1)} 基点`}</span>, "买入看上涨、卖出看下跌"]]} />
      {!fills.length ? <NoTrades loading={f.loading && !f.data} what="成交簿为空。下单成交后，每笔成交会实时出现在这里，并按最新行情计算执行后的价值变动。" strategy="BLOT" /> : <>
        <SectionHead title="成交流水（按最新行情盯市）" sub="点击标的在右侧查看实时 K 线" />
        <VirtualRows rows={list} height={360} header={<thead className={TH}><tr><th className="px-2 py-1 text-left">时间</th><th className="text-left">标的</th><th className="text-center">方向</th><th className="text-right">数量</th><th className="text-right">成交价</th><th className="text-right">最新价</th><th className="text-right">执行后(基点)</th><th className="text-right">价值变动</th><th className="text-right">费用</th><th className="px-2 text-left">交收</th></tr></thead>} render={(x) => <tr key={x.id} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-slate-500">{new Date(x.ts).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td><td className="text-slate-100"><Pick s={x.symbol}>{t[x.symbol]?.name ?? x.symbol}</Pick><span className="ml-1 font-mono text-[9px] text-slate-600">{x.symbol}</span></td><td className="text-center"><SideTxt s={x.side} /></td><td className="text-right font-mono">{x.qty}</td><td className="text-right font-mono text-white">{fmtPrice(x.px)}</td><td className="text-right font-mono text-slate-300">{fmtPrice(t[x.symbol]?.price)}</td><td className="text-right font-mono" style={{ color: toneOf(bps(x)) }}>{bps(x) == null ? "—" : bps(x)!.toFixed(1)}</td><td className="text-right font-mono" style={{ color: toneOf(mtm(x)) }}>{fmtCompact(mtm(x))} <span className="text-[9px] text-slate-600">{x.ccy}</span></td><td className="text-right font-mono text-slate-500">{(x.fee + x.tax).toFixed(2)}</td><td className="px-2" style={{ color: x.settled ? "#34d399" : "#fbbf24" }}>{x.settled ? "已交收" : x.settleDate.slice(5)}</td></tr>} />
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]">
            <SectionHead title="成交时段分布（本地时间，按笔数）" />
            <table className="w-full table-fixed text-[9px]"><thead><tr><th className="w-6" />{Array.from({ length: 24 }, (_, h) => <th key={h} className="font-mono font-normal text-slate-600">{h % 3 === 0 ? h : ""}</th>)}</tr></thead>
              <tbody>{grid.map((row, d) => <tr key={d}><td className="px-1 text-slate-500">周{"一二三四五六日"[d]}</td>{row.map((v, h) => <td key={h} title={`周${"一二三四五六日"[d]} ${h}时：${v} 笔`} className="h-4 border border-[#03070c]" style={{ background: v ? `rgba(56,189,248,${0.15 + (v / gmax) * 0.85})` : "#07111c" }} />)}</tr>)}</tbody></table>
          </div>
          <div className="bg-[#03070c]">
            <SectionHead title="按标的汇总" sub="买卖均价差反映已完成的往返交易效果" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">笔数</th><th className="text-right">买入量</th><th className="text-right">买入均价</th><th className="text-right">卖出量</th><th className="text-right">卖出均价</th><th className="px-2 text-right">净量</th></tr></thead>
              <tbody>{bySym.slice(0, 30).map((r) => <tr key={r.s} className={TR}><td className="px-2 py-0.5 text-slate-100"><Pick s={r.s}>{t[r.s]?.name ?? r.s}</Pick></td><td className="text-right font-mono text-slate-400">{r.n}</td><td className="text-right font-mono">{r.bq || ""}</td><td className="text-right font-mono" style={{ color: UPC }}>{r.bq ? fmtPrice(r.bn / r.bq) : ""}</td><td className="text-right font-mono">{r.sq || ""}</td><td className="text-right font-mono" style={{ color: DNC }}>{r.sq ? fmtPrice(r.sn / r.sq) : ""}</td><td className="px-2 text-right font-mono text-white">{r.bq - r.sq}</td></tr>)}</tbody></table>
          </div>
        </div>
      </>}
    </Frame>
  );
}

/* ================================================================== FXSS 外汇确认与交收 */
export function StpFXSS({ onClose }: P) {
  const f = useFills();
  const p = usePositions();
  const fx = useFx();
  const t = useTicks(["USDCNH", "USDJPY", "EURUSD", "DXY"]);
  const fills = f.data ?? [];
  const pend = fills.filter((x) => !x.settled);
  const ccys = [...new Set(["CNY", ...fills.map((x) => x.ccy)])];
  const dates = [...new Set(pend.map((x) => x.settleDate))].sort();
  const cell = (d: string, c: string) => pend.filter((x) => x.settleDate === d && x.ccy === c).reduce((s, x) => s + cashOf(x), 0);
  const netCcy = (c: string) => pend.filter((x) => x.ccy === c).reduce((s, x) => s + cashOf(x), 0);
  const totCny = ccys.reduce((s, c) => s + (toCny(netCcy(c), c, fx.data) ?? 0), 0);
  const refUsdCny = cnyPer("USD", fx.data);
  const cnh = t.USDCNH?.price;
  const hist = (c: string) => { const h = fx.data?.history; if (!h?.CNY) return []; if (c === "USD") return h.CNY; const o = h[c]; return o ? h.CNY.map((v, i) => (o[i] ? v / o[i] : NaN)).filter(Number.isFinite) : []; };
  const pos = (p.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9);
  const expo = Object.values(pos.reduce<Record<string, { c: string; mv: number }>>((a, r) => { const e = (a[r.ccy] ??= { c: r.ccy, mv: 0 }); e.mv += r.marketValue ?? 0; return a; }, {}));
  const months = useMemo(() => { const m: Record<string, Record<string, number>> = {}; for (const x of fills.filter((y) => y.settled)) { const k = x.settleDate.slice(0, 7); (m[k] ??= {})[x.ccy] = (m[k][x.ccy] ?? 0) + Math.abs(cashOf(x)); } return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12); }, [fills]);
  return (
    <Frame code="FXSS" title="外汇确认与交收" onClose={onClose} right={fx.data ? <span>参考汇率日期 {fx.data.date}</span> : null}>
      <Kpis items={[...ccys.slice(0, 3).map((c) => [`${c} 待交收净额`, <span style={{ color: toneOf(netCcy(c)) }}>{fmtCompact(netCcy(c))}</span>, `${pend.filter((x) => x.ccy === c).length} 笔`] as [string, React.ReactNode, string]), ["折合人民币合计", <span style={{ color: toneOf(totCny) }}>{fmtCompact(totCny)}</span>, "正为应收、负为应付"]]} />
      <SectionHead title="交收币种参考汇率（折合人民币）" sub="近 35 个交易日走势；离岸人民币为实时报价" />
      <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">币种</th><th className="text-right">1 单位 = 人民币</th><th className="text-right">区间变动</th><th className="px-2">走势</th></tr></thead>
        <tbody>{["USD", "HKD", "EUR", "JPY", "GBP"].map((c) => { const h = hist(c); const ch = h.length > 1 ? (h[h.length - 1] / h[0] - 1) * 100 : null; return <tr key={c} className={TR}><td className="px-2 py-0.5 text-slate-100">{c}{ccys.includes(c) && <span className="ml-1 text-[9px] text-amber-300">账户在用</span>}</td><td className="text-right font-mono text-white">{f2x(cnyPer(c, fx.data), c === "JPY" ? 5 : 4)}</td><td className="text-right font-mono" style={{ color: toneOf(ch) }}>{fmtPct(ch)}</td><td className="px-2"><Spark values={h.map((v) => v - Math.min(...h) + 1e-9)} width={120} /></td></tr>; })}
          <tr className={TR}><td className="px-2 py-0.5 text-slate-100">离岸人民币（美元兑）</td><td className="text-right font-mono text-white">{fmtPrice(cnh, 4)}</td><td className="text-right font-mono" style={{ color: toneOf(t.USDCNH?.changePct) }}>{fmtPct(t.USDCNH?.changePct)}</td><td className="px-2 text-[10px] text-slate-400">{cnh && refUsdCny ? `离岸 − 在岸参考 ${((cnh - refUsdCny) * 1e4).toFixed(0)} 点` : ""}</td></tr></tbody></table>
      {!fills.length ? <NoTrades loading={f.loading && !f.data} what="暂无成交，因此没有外币交收。港股以港元、美股与期货以美元、A股以人民币交收；成交后此处按交收日与币种轧差。" strategy="FXSS" /> : <>
        <SectionHead title="交收日 × 币种 轧差矩阵（未交收）" sub="买入付款（含费用）为负，卖出收款为正" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">交收日</th>{ccys.map((c) => <th key={c} className="text-right">{c}</th>)}<th className="px-2 text-right">折合人民币</th></tr></thead>
          <tbody>{dates.map((d) => { const cny = ccys.reduce((s, c) => s + (toCny(cell(d, c), c, fx.data) ?? 0), 0); return <tr key={d} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{d}（周{weekdayZh(d)}）</td>{ccys.map((c) => { const v = cell(d, c); return <td key={c} className="text-right font-mono" style={{ color: v ? toneOf(v) : "#334155" }}>{v ? fmtCompact(v) : "—"}</td>; })}<td className="px-2 text-right font-mono text-white">{fmtCompact(cny)}</td></tr>; })}{!dates.length && <tr><td colSpan={ccys.length + 2} className="px-2 py-4 text-slate-500">全部成交已完成交收。</td></tr>}</tbody></table>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="持仓外汇敞口" sub="按持仓计价币种，人民币 ±1% 变动的影响" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">币种</th><th className="text-right">市值（原币）</th><th className="text-right">折合人民币</th><th className="px-2 text-right">±1% 影响</th></tr></thead>
              <tbody>{expo.map((e) => { const c = toCny(e.mv, e.c, fx.data); return <tr key={e.c} className={TR}><td className="px-2 py-0.5 text-slate-100">{e.c}</td><td className="text-right font-mono">{fmtCompact(e.mv)}</td><td className="text-right font-mono text-white">{fmtCompact(c)}</td><td className="px-2 text-right font-mono text-slate-400">{e.c === "CNY" ? "无" : `±${fmtCompact((c ?? 0) * 0.01)}`}</td></tr>; })}{!expo.length && <tr><td colSpan={4}><Empty text="暂无持仓" /></td></tr>}</tbody></table></div>
          <div className="bg-[#03070c]"><SectionHead title="已交收金额（按月、原币总额）" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">月份</th>{ccys.map((c) => <th key={c} className="text-right">{c}</th>)}<th className="px-2" /></tr></thead>
              <tbody>{months.map(([m, v]) => <tr key={m} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{m}</td>{ccys.map((c) => <td key={c} className="text-right font-mono text-slate-200">{v[c] ? fmtCompact(v[c]) : "—"}</td>)}<td className="px-2" /></tr>)}{!months.length && <tr><td colSpan={ccys.length + 2}><Empty text="尚无已交收记录" /></td></tr>}</tbody></table></div>
        </div>
      </>}
    </Frame>
  );
}
const f2x = (v: number | null, d: number) => (v == null ? "—" : v.toFixed(d));

/* ================================================================== FSTN 交收预警工作站 */
type EconEvent = { id: string; date: string; time: number | null; country: string; region: string; name: string; nameZh: string; actual: string | null; consensus: string | null; previous: string | null; importance: 1 | 2 | 3; surprise: number | null; released: boolean };
export function StpFSTN({ onClose }: P) {
  const f = useFills();
  const o = useOrders();
  const p = usePositions();
  const s = useSummary();
  const fx = useFx();
  const td = today();
  const cal = usePolled<EconEvent[]>("ucNews.calendar", { from: td, days: 5 }, 900_000);
  const fills = f.data ?? [];
  const pend = fills.filter((x) => !x.settled).sort((a, b) => a.settleDate.localeCompare(b.settleDate));
  const posMap = new Map((p.data?.rows ?? []).map((r) => [`${r.account}|${r.symbol}`, r]));
  const cash = s.data?.cash ?? null;
  const evOn = (d: string) => (cal.data ?? []).filter((e) => e.date === d && e.importance === 3);
  const items = pend.map((x) => {
    const pos = posMap.get(`${x.account}|${x.symbol}`);
    const flags: string[] = [];
    if (x.side === "S" && pos && pos.qty < 0) flags.push("证券不足（净空头）");
    if (x.side === "B" && cash != null && cash < 0) flags.push("资金不足");
    if (x.settleDate < td) flags.push("超过交收日未完成");
    if (isWeekend(x.settleDate)) flags.push("交收日为周末");
    const ev = evOn(x.settleDate);
    return { x, flags, left: bizBetween(td, x.settleDate), ev };
  });
  const rej = (o.data ?? []).filter((x) => x.status === "REJECTED");
  const rejBy = Object.entries(rej.reduce<Record<string, number>>((a, x) => { const k = (x.reject ?? "未说明").replace(/\d+(\.\d+)?/g, "#"); a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const frozen = (p.data?.rows ?? []).filter((r) => r.unsettledQty !== 0 && Math.abs(r.qty) > 1e-9);
  const pendCny = pend.reduce((a, x) => a + (toCny(cashOf(x), x.ccy, fx.data) ?? 0), 0);
  return (
    <Frame code="FSTN" title="交收预警工作站" onClose={onClose}>
      <Kpis items={[["待交收", `${pend.length} 笔`, `净额折合人民币 ${fmtCompact(pendCny)}`], ["预警", <span style={{ color: items.some((i) => i.flags.length) ? "#f87171" : "#34d399" }}>{items.filter((i) => i.flags.length).length} 笔</span>, "证券 / 资金 / 交收日检查"], ["交收前拦截", `${rej.length} 笔`, "下单时被风控拒绝"], ["可用资金", fmtCompact(cash), "已扣除全部待交收款项"]]} />
      {!fills.length && !rej.length ? <NoTrades loading={f.loading && !f.data} what="暂无成交与拒单记录，交收队列为空。成交后系统按 A股 T+1、港股 T+2、美股 T+1 生成交收义务并在此逐笔检查。" strategy="FSTN" /> : <>
        <SectionHead title="待交收队列与检查结果" sub="交收日当天重要宏观事件一并提示" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">成交号</th><th className="text-left">标的</th><th className="text-left">交收类型</th><th className="text-right">数量</th><th className="text-right">交收金额</th><th className="text-left pl-2">交收日</th><th className="text-right">剩余工作日</th><th className="text-left pl-2">当日重要事件</th><th className="px-2 text-left">检查</th></tr></thead>
          <tbody>{items.map(({ x, flags, left, ev }) => <tr key={x.id} className={TR}><td className="px-2 py-0.5 font-mono text-slate-400">{x.id}</td><td className="text-slate-100">{x.symbol}<span className="ml-1 text-[9px] text-slate-500">{mktName(x.market)}</span></td><td style={{ color: x.side === "S" ? DNC : UPC }}>{x.side === "S" ? "交券收款" : "收券付款"}</td><td className="text-right font-mono">{x.qty}</td><td className="text-right font-mono" style={{ color: toneOf(cashOf(x)) }}>{fmtCompact(cashOf(x))} <span className="text-[9px] text-slate-600">{x.ccy}</span></td><td className="pl-2 font-mono text-slate-300">{x.settleDate}</td><td className="text-right font-mono text-white">{left}</td><td className="pl-2 text-[10px] text-slate-400" title={ev.map((e) => `${e.country} ${e.nameZh || e.name}`).join("\n")}>{ev.length ? `${ev.length} 项（${ev[0].nameZh || ev[0].name}…）` : "—"}</td><td className="px-2" style={{ color: flags.length ? "#f87171" : "#34d399" }}>{flags.length ? flags.join("；") : "正常"}</td></tr>)}{!items.length && <tr><td colSpan={9} className="px-2 py-4 text-slate-500">没有待交收的成交。</td></tr>}</tbody></table>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="交收前拦截原因（拒单）" sub="数字已归并，便于按原因统计" />
            <table className="w-full text-[11px]"><tbody>{rejBy.map(([k, n]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-200">{k}</td><td className="px-2 text-right font-mono text-red-300">{n}</td></tr>)}{!rejBy.length && <tr><td className="px-2 py-4 text-slate-500">没有被拦截的委托。</td></tr>}</tbody></table>
            <table className="w-full text-[11px]"><tbody>{rej.slice(0, 15).map((x) => <tr key={x.id} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-slate-500">{new Date(x.createdAt).toLocaleString("zh-CN", { hour12: false })}</td><td className="text-slate-200">{x.symbol} <SideTxt s={x.side} /> {x.qty}</td><td className="px-2 text-[10px] text-red-200">{x.reject}</td></tr>)}</tbody></table></div>
          <div className="bg-[#03070c]"><SectionHead title="交收中持仓（受交收周期约束）" sub="A股当日买入部分须到交收后方可卖出" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">持仓</th><th className="text-right">待交收</th><th className="px-2 text-right">当前可卖</th></tr></thead>
              <tbody>{frozen.map((r) => <tr key={`${r.account}|${r.symbol}`} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.name ?? r.symbol}</td><td className="text-right font-mono">{r.qty}</td><td className="text-right font-mono text-amber-200">{r.unsettledQty}</td><td className="px-2 text-right font-mono text-white">{r.market === "CN" ? Math.max(0, r.qty - Math.max(0, r.unsettledQty)) : r.qty}</td></tr>)}{!frozen.length && <tr><td colSpan={4} className="px-2 py-4 text-slate-500">没有处于交收中的持仓。</td></tr>}</tbody></table></div>
        </div>
      </>}
    </Frame>
  );
}

/* ================================================================== BRRS 监管日程总览 */
export function StpBRRS({ onClose }: P) {
  const f = useFills();
  const fx = useFx();
  const td = today();
  const cal = usePolled<EconEvent[]>("ucNews.calendar", { from: td, days: 10 }, 900_000);
  const fills = f.data ?? [];
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => { const d = new Date(`${td}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); }), [td]);
  const [sel, setSel] = useState(td);
  const settleOn = (d: string) => fills.filter((x) => x.settleDate === d && !x.settled);
  const dueOn = (d: string) => fills.filter((x) => dueOf(x) === d);
  const evOn = (d: string) => (cal.data ?? []).filter((e) => e.date === d);
  const cnyNet = (arr: Fill[]) => arr.reduce((a, x) => a + (toCny(cashOf(x), x.ccy, fx.data) ?? 0), 0);
  const hist = useMemo(() => Array.from({ length: 30 }, (_, i) => { const d = new Date(`${td}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 29 + i); const k = d.toISOString().slice(0, 10); return { k: k.slice(5), v: fills.filter((x) => x.tradeDate === k).length }; }), [fills, td]);
  const selEv = evOn(sel).sort((a, b) => b.importance - a.importance || (a.time ?? 0) - (b.time ?? 0));
  const allPend = fills.filter((x) => !x.settled);
  return (
    <Frame code="BRRS" title="监管与交收日程总览" onClose={onClose}>
      <Kpis items={[["未来 10 日交收净额", <span style={{ color: toneOf(cnyNet(allPend)) }}>{fmtCompact(cnyNet(allPend))}</span>, "折合人民币"], ["待申报交易报告", String(fills.filter((x) => dueOf(x) >= td).length)], ["重要宏观事件", String((cal.data ?? []).filter((e) => e.importance === 3).length), "未来 10 天"], ["下一个交收日", allPend.length ? allPend.map((x) => x.settleDate).sort()[0] : "—"]]} />
      <SectionHead title="未来 10 天日程" sub="点击日期查看当日明细；周末无交收" />
      <div className="grid grid-cols-5 gap-px bg-[#1a2a3c] lg:grid-cols-10">
        {days.map((d) => { const st = settleOn(d); const du = dueOn(d); const ev = evOn(d); const hi = ev.filter((e) => e.importance === 3).length; const wk = isWeekend(d); return (
          <button key={d} type="button" onClick={() => setSel(d)} className={`min-h-[92px] p-1.5 text-left align-top ${sel === d ? "bg-[#0d2236]" : wk ? "bg-[#05090f]" : "bg-[#050b13] hover:bg-[#0a1726]"}`}>
            <div className="flex items-baseline justify-between"><span className={`font-mono text-[11px] ${d === td ? "text-amber-300" : "text-slate-200"}`}>{d.slice(5)}</span><span className="text-[10px] text-slate-500">周{weekdayZh(d)}</span></div>
            {wk ? <div className="mt-1 text-[10px] text-slate-600">休市</div> : <>
              <div className="mt-1 text-[10px] text-slate-400">交收 <b className="font-mono text-white">{st.length}</b>{st.length ? <span className="ml-1 font-mono" style={{ color: toneOf(cnyNet(st)) }}>{fmtCompact(cnyNet(st))}</span> : null}</div>
              <div className="text-[10px] text-slate-400">申报截止 <b className="font-mono text-white">{du.length}</b></div>
            </>}
            <div className="text-[10px] text-slate-400">宏观事件 <b className="font-mono text-white">{ev.length}</b>{hi ? <span className="ml-1 text-red-300">重要 {hi}</span> : null}</div>
          </button>
        ); })}
      </div>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title={`${sel}（周${weekdayZh(sel)}）宏观事件`} sub="重要性三级为市场高度关注" />
          <table className="w-full text-[11px]"><tbody>{selEv.map((e) => <tr key={e.id} className={TR}><td className="w-[46px] px-2 py-0.5 font-mono text-[10px] text-slate-500">{e.time ? new Date(e.time).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" }) : "全天"}</td><td className="w-[60px] text-slate-400">{e.country}</td><td className="text-slate-100">{e.nameZh || e.name}</td><td className="text-amber-300">{"★".repeat(e.importance)}</td><td className="px-2 text-right font-mono text-[10px] text-slate-400">{e.actual ? `公布 ${e.actual}` : e.consensus ? `预期 ${e.consensus}` : e.previous ? `前值 ${e.previous}` : ""}</td></tr>)}{!selEv.length && <tr><td><Empty loading={cal.loading} text="当日无经济日历事件" /></td></tr>}</tbody></table></div>
        <div className="bg-[#03070c]"><SectionHead title={`${sel} 交收与申报明细`} />
          {!fills.length ? <NoTrades loading={f.loading && !f.data} what="暂无成交，日程中只显示宏观事件。成交后，交收日与申报截止日会自动排入日程。" strategy="BRRS" /> :
            <table className="w-full text-[11px]"><tbody>{[...settleOn(sel).map((x) => ({ x, k: "交收" })), ...dueOn(sel).map((x) => ({ x, k: "申报截止" }))].map(({ x, k }) => <tr key={`${k}${x.id}`} className={TR}><td className="px-2 py-0.5 text-cyan-300">{k}</td><td className="text-slate-100">{x.symbol}</td><td><SideTxt s={x.side} /> {x.qty}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(cashOf(x)) }}>{fmtCompact(cashOf(x))} {x.ccy}</td></tr>)}{!settleOn(sel).length && !dueOn(sel).length && <tr><td className="px-2 py-4 text-slate-500">当日没有交收与申报事项。</td></tr>}</tbody></table>}
        </div>
      </div>
      <SectionHead title="近 30 天每日可申报成交笔数" />
      <Bars data={hist} fmt={(v) => `${v} 笔`} height={110} />
    </Frame>
  );
}
