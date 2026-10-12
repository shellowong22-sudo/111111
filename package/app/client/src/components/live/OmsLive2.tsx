/**
 * 交易委托管理（第二组），数据全部来自平台自有模拟交易系统与真实行情：
 *  - BBS  买方概览：按发起功能（各交易工作台标记）汇总委托数、成交率、撤单 / 拒单率、成交金额与平均成交耗时
 *  - BSS  卖方概览：按市场与币种汇总成交笔数、成交额、费用与税费、费用率、待交收金额
 *  - BSKT ETF 跟踪偏离：主要 ETF 与其标的指数的实时偏离、近 1 年跟踪误差与跟踪差，点选可直接下单
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { Bars, Lines } from "@/uc/hubs/kit";
import { align, f2, heat, mean, rets, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { OrderTicket, useFills, useOrders } from "@/uc/trade/kit";
import { Note, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";

const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
const STRAT_ZH: Record<string, string> = { GOVT: "国债执行", FIT: "固收执行", FITG: "固收网格", CORP: "公司债", BOLT: "报价列表", AGENCY: "抵押债", EM: "新兴债", EBND: "全球债", MUNI: "地方债", IMGR: "库存", TRDE: "批量委托", PTBB: "组合篮子", IRSWAP: "互换对冲", CDS: "信用对冲", EQUITY: "股票执行", FX: "外汇执行", EMSX: "委托录入", BSKT: "ETF 跟踪" };

/* ================================================================== BBS 买方概览 */
export function BbsLive({ onClose }: P) {
  const orders = useOrders(), fills = useFills();
  const rows = useMemo(() => {
    const m = new Map<string, { n: number; filled: number; cancel: number; reject: number; notional: number; lat: number[] }>();
    const firstFill = new Map<number, number>();
    for (const f of fills.data ?? []) { const t = firstFill.get(f.orderId); if (t == null || f.ts < t) firstFill.set(f.orderId, f.ts); }
    for (const o of orders.data ?? []) {
      const k = o.strategy || "手工下单";
      const r = m.get(k) ?? { n: 0, filled: 0, cancel: 0, reject: 0, notional: 0, lat: [] };
      r.n++;
      if (o.status === "FILLED" || o.status === "PARTIAL") r.filled++;
      if (o.status === "CANCELLED") r.cancel++;
      if (o.status === "REJECTED") r.reject++;
      r.notional += (o.avgPx ?? 0) * o.filledQty;
      const ff = firstFill.get(o.id); if (ff) r.lat.push((ff - o.createdAt) / 1000);
      m.set(k, r);
    }
    return [...m.entries()].map(([k, r]) => ({ k, ...r, rate: r.n ? (r.filled / r.n) * 100 : null, lat: r.lat.length ? r.lat.sort((a, b) => a - b)[Math.floor(r.lat.length / 2)] : null })).sort((a, b) => b.notional - a.notional);
  }, [orders.data, fills.data]);
  return (
    <PanelShell code="BBS" title="买方概览：按发起功能" onClose={onClose}>
      <Kpis items={[["委托总数", String((orders.data ?? []).length)], ["发起功能数", String(rows.length)], ["累计成交额", fmtCompact(rows.reduce((s, r) => s + r.notional, 0))]]} />
      {!rows.length ? <Empty loading={orders.loading} text="暂无委托" /> : (
        <>
          <table className="w-full text-[11px]">
            <thead className={thead}><tr><th className={THL}>发起功能</th><th className={TH}>委托数</th><th className={TH}>成交率</th><th className={TH}>撤单</th><th className={TH}>拒单</th><th className={TH}>成交额</th><th className={TH}>成交耗时中位数</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.k} className={ROW}><td className={`${TDL} text-slate-100`}>{STRAT_ZH[r.k] ? `${STRAT_ZH[r.k]}（${r.k}）` : r.k}</td><td className={`${TD} text-slate-300`}>{r.n}</td><td className={TD} style={{ background: heat(r.rate != null ? r.rate - 50 : null, 50) }}>{f2(r.rate, 0, "%")}</td><td className={`${TD} text-slate-400`}>{r.cancel}</td><td className={TD} style={{ color: r.reject ? "#f87171" : "#64748b" }}>{r.reject}</td><td className={`${TD} text-white`}>{fmtCompact(r.notional)}</td><td className={`${TD} text-slate-300`}>{r.lat == null ? "—" : r.lat < 60 ? `${r.lat.toFixed(1)} 秒` : `${(r.lat / 60).toFixed(1)} 分`}</td></tr>)}</tbody>
          </table>
          <SectionHead title="各功能成交额" />
          <Bars data={rows.map((r) => ({ k: r.k, v: r.notional }))} fmt={fmtCompact} height={110} />
        </>
      )}
      <Note>“发起功能”取委托上的来源标记（各交易工作台下单时自动写入）；成交耗时 = 委托提交到首笔成交的时间。</Note>
    </PanelShell>
  );
}

/* ================================================================== BSS 卖方概览 */
export function BssLive({ onClose }: P) {
  const fills = useFills();
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const [scope, setScope] = useState<"all" | "today">("all");
  const list = (fills.data ?? []).filter((f) => scope === "all" || f.tradeDate === today);
  const rows = useMemo(() => {
    const m = new Map<string, { n: number; amt: number; fee: number; tax: number; unsettled: number; buy: number; sell: number }>();
    for (const f of list) {
      const k = `${f.market}|${f.ccy}`;
      const r = m.get(k) ?? { n: 0, amt: 0, fee: 0, tax: 0, unsettled: 0, buy: 0, sell: 0 };
      r.n++; r.amt += Math.abs(f.notional); r.fee += f.fee; r.tax += f.tax; if (!f.settled) r.unsettled += f.notional * (f.side === "B" ? -1 : 1);
      if (f.side === "B") r.buy += Math.abs(f.notional); else r.sell += Math.abs(f.notional);
      m.set(k, r);
    }
    return [...m.entries()].map(([k, r]) => { const [mk, ccy] = k.split("|"); return { mk, ccy, ...r, rate: r.amt ? ((r.fee + r.tax) / r.amt) * 10000 : null }; }).sort((a, b) => b.amt - a.amt);
  }, [list]);
  const MK: Record<string, string> = { CN: "A股", HK: "港股", US: "美股", FUT: "期货 / 外汇", INTL: "其他市场" };
  return (
    <PanelShell code="BSS" title="卖方概览：按市场与币种" onClose={onClose} right={<span className="flex gap-1 text-[10px]">{(["all", "today"] as const).map((s) => <button type="button" key={s} onClick={() => setScope(s)} className={`border px-2 ${scope === s ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-500"}`}>{s === "all" ? "全部" : "今日"}</button>)}</span>}>
      {!rows.length ? <Empty loading={fills.loading} text="暂无成交" /> : (
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>市场</th><th className={THL}>币种</th><th className={TH}>成交笔数</th><th className={TH}>成交额</th><th className={TH}>买入</th><th className={TH}>卖出</th><th className={TH}>佣金</th><th className={TH}>税费</th><th className={TH}>综合费率</th><th className={TH}>待交收净额</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.mk + r.ccy} className={ROW}><td className={`${TDL} text-slate-100`}>{MK[r.mk] ?? r.mk}</td><td className={`${TDL} text-slate-400`}>{r.ccy}</td><td className={`${TD} text-slate-300`}>{r.n}</td><td className={`${TD} text-white`}>{fmtCompact(r.amt)}</td><td className={TD} style={{ color: "#f2495c" }}>{fmtCompact(r.buy)}</td><td className={TD} style={{ color: "#1fbf75" }}>{fmtCompact(r.sell)}</td><td className={`${TD} text-slate-300`}>{r.fee.toFixed(2)}</td><td className={`${TD} text-slate-300`}>{r.tax.toFixed(2)}</td><td className={`${TD} text-slate-200`}>{f2(r.rate, 1, "bp")}</td><td className={TD} style={{ color: toneOf(r.unsettled) }}>{fmtCompact(r.unsettled)}</td></tr>)}</tbody>
        </table>
      )}
      <Note>按成交记录的市场与结算币种汇总；待交收净额为尚未到交收日的成交（卖出为正、买入为负）。</Note>
    </PanelShell>
  );
}

/* ================================================================== BSKT ETF 跟踪偏离 */
const PAIRS: Array<[string, string, string]> = [["SPY", "^GSPC", "标普 500"], ["QQQ", "^NDX", "纳指 100"], ["DIA", "^DJI", "道琼斯"], ["IWM", "^RUT", "罗素 2000"], ["sh510300", "sh000300", "沪深 300"], ["sh510500", "sh000905", "中证 500"], ["sh510050", "sh000016", "上证 50"], ["sz159915", "sz399006", "创业板指"], ["2800.HK", "^HSI", "恒生指数"], ["EWJ", "^N225", "日经 225（美元计）"]];
export function BsktLive({ onClose }: P) {
  const syms = PAIRS.flatMap((p) => [p[0], p[1]]);
  const ticks = useTicks(syms);
  const pack = useCloses(syms, 400);
  const [sel, setSel] = useState(PAIRS[0][0]);
  const st = useMemo(() => {
    if (!pack.data) return {} as Record<string, { te: number | null; td: number | null; dev: Array<number | null>; dates: string[] }>;
    return Object.fromEntries(PAIRS.map(([e, i]) => {
      const al = align(pack.data!, [e, i]);
      const a = rets(al.m[e].slice(-253)), b = rets(al.m[i].slice(-253));
      if (a.length < 60) return [e, { te: null, td: null, dev: [], dates: [] }];
      const d = a.map((x, k) => x - b[k]);
      const ea = al.m[e].slice(-253), ia = al.m[i].slice(-253);
      return [e, { te: std(d) * Math.sqrt(252) * 100, td: ((ea[ea.length - 1] / ea[0]) / (ia[ia.length - 1] / ia[0]) - 1) * 100, dev: d.map((x) => x * 10000), dates: al.dates.slice(-d.length) }];
    }));
  }, [pack.data]);
  const cur = st[sel];
  return (
    <PanelShell code="BSKT" title="ETF 跟踪偏离" onClose={onClose}>
      <table className="w-full text-[11px]">
        <thead className={thead}><tr><th className={THL}>ETF</th><th className={THL}>标的指数</th><th className={TH}>ETF 今日</th><th className={TH}>指数今日</th><th className={TH}>今日偏离</th><th className={TH}>跟踪误差（年化）</th><th className={TH}>1 年跟踪差</th></tr></thead>
        <tbody>{PAIRS.map(([e, i, n]) => { const te = ticks[e]?.changePct, ti = ticks[i]?.changePct; const dv = te != null && ti != null ? (te - ti) * 100 : null; return (
          <tr key={e} onClick={() => setSel(e)} className={`${ROW} cursor-pointer ${sel === e ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} font-mono text-cyan-200`}>{e}</td><td className={`${TDL} text-slate-300`}>{n}</td><td className={TD} style={{ color: toneOf(te) }}>{fmtPct(te)}</td><td className={TD} style={{ color: toneOf(ti) }}>{fmtPct(ti)}</td><td className={TD} style={{ color: toneOf(dv), background: heat(dv, 30) }}>{dv == null ? "—" : `${dv.toFixed(1)}bp`}</td><td className={`${TD} text-slate-300`}>{f2(st[e]?.te, 2, "%")}</td><td className={TD} style={{ color: toneOf(st[e]?.td) }}>{sgn(st[e]?.td)}</td></tr>); })}</tbody>
      </table>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]"><SectionHead title={`${sel} 每日跟踪偏离（bp）`} />{cur?.dev.length ? <Lines height={170} zero xLabels={cur.dates} fmt={(v) => v.toFixed(0)} series={[{ name: "偏离", color: "#38bdf8", values: cur.dev }]} /> : <Empty loading={pack.loading} />}</div>
        <div className="bg-[#03070c]"><SectionHead title={`下单：${sel}`} /><OrderTicket key={sel} initial={sel} strategy="BSKT" compact /><div className="px-2 text-[10px] text-slate-500">{sel} 实时 {fmtPrice(ticks[sel]?.price)}；跟踪偏离平均 {f2(cur?.dev.length ? mean(cur.dev.filter((x): x is number => x != null)) : null, 1, "bp")} / 日</div></div>
      </div>
      <Note>跟踪误差 = 日偏离的年化标准差；跟踪差 = 近 1 年 ETF 价格收益相对指数价格收益之差（含分红差异与费用）。</Note>
    </PanelShell>
  );
}
