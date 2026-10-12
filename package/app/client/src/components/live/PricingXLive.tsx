/**
 * 定价与风险页补充三个功能（真实数据）：
 *  - 决策看板：持仓一年风险—收益散点、夏普与回撤，以及按规则从真实数据中触发的事实提示（集中度、波动贡献、回撤、价格位置），不给买卖建议
 *  - 合约静态数据：用户自建衍生品库、互换簿与交易账户持仓的合约要素与生命周期（起始、到期、剩余天数、状态）
 *  - 资本占用：交易账户权益、总 / 净敞口、杠杆、待交收资金，以及历史 VaR 与压力损失占权益比例
 */
import { useMemo } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf } from "@/uc/market/live";
import { Bars, useHub } from "@/uc/hubs/kit";
import { drawdown, f2, heat, mean, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, useSaved } from "@/uc/panels/kit";
import { MARKET_ZH, usePositions, useSummary } from "@/uc/trade/kit";
import { Note, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";
import { covar, useBook, useBookReturns } from "./PortOpsLive";

/* ================================================================== 决策看板 */
export function DecisionLive({ onClose }: P) {
  const book = useBook();
  const { pick } = useHub();
  const R = useBookReturns(book, 300, [book.benchmark]);
  const res = useMemo(() => {
    if (!R.have.length || R.rp.length < 60) return null;
    const vp = covar(R.rp, R.rp);
    const items = R.have.map((h, i) => {
      const r = R.R[i];
      const c = R.m[h.symbol] ?? [];
      const ret = c.length > 252 ? (c[c.length - 1] / c[c.length - 253] - 1) * 100 : c.length > 1 ? (c[c.length - 1] / c[0] - 1) * 100 : null;
      const vol = std(r) * Math.sqrt(252) * 100;
      const sharpe = vol ? (mean(r) * 252 * 100) / vol : null;
      const dd = drawdown(c.slice(-252));
      const hi = Math.max(...c.slice(-252)), lo = Math.min(...c.slice(-252));
      const pos = hi > lo ? ((c[c.length - 1] - lo) / (hi - lo)) * 100 : null;
      const riskShare = vp ? (R.w[i] * covar(r, R.rp)) / vp : 0;
      return { h, w: R.w[i], ret, vol, sharpe, ddNow: dd.now, ddMax: dd.max, pos, riskShare };
    });
    const flags: Array<{ lv: 1 | 2; t: string; s?: string }> = [];
    for (const x of items) {
      if (x.w > 0.25) flags.push({ lv: 2, t: `${x.h.name} 权重 ${(x.w * 100).toFixed(1)}%，超过 25%`, s: x.h.symbol });
      if (x.riskShare > 0.4) flags.push({ lv: 2, t: `${x.h.name} 贡献组合波动的 ${(x.riskShare * 100).toFixed(0)}%`, s: x.h.symbol });
      if (x.ddNow < -20) flags.push({ lv: 2, t: `${x.h.name} 距一年高点回撤 ${x.ddNow.toFixed(1)}%`, s: x.h.symbol });
      else if (x.ddNow < -10) flags.push({ lv: 1, t: `${x.h.name} 距一年高点回撤 ${x.ddNow.toFixed(1)}%`, s: x.h.symbol });
      if (x.pos != null && x.pos < 10) flags.push({ lv: 1, t: `${x.h.name} 处于一年区间底部（${x.pos.toFixed(0)}%）`, s: x.h.symbol });
      if (x.pos != null && x.pos > 95) flags.push({ lv: 1, t: `${x.h.name} 处于一年区间顶部（${x.pos.toFixed(0)}%）`, s: x.h.symbol });
    }
    const pv = std(R.rp) * Math.sqrt(252) * 100;
    let nav = 1; const curve = R.rp.map((x) => (nav *= 1 + x));
    return { items: items.sort((a, b) => b.w - a.w), flags: flags.sort((a, b) => b.lv - a.lv), pv, pRet: (curve[curve.length - 1] - 1) * 100, pDd: drawdown(curve).max };
  }, [R]);
  const maxVol = res ? Math.max(...res.items.map((x) => x.vol), 1) : 1;
  const ret = res ? res.items.map((x) => x.ret ?? 0) : [];
  const rMin = Math.min(0, ...ret), rMax = Math.max(1, ...ret);
  return (
    <PanelShell code="DECI" title="决策看板：持仓风险收益与提示" onClose={onClose} right={<span>{book.rows.length} 个持仓 · 近一年</span>}>
      <Kpis items={[["组合年化波动", res ? `${res.pv.toFixed(1)}%` : "—"], ["组合一年收益（按当前权重）", res ? <span style={{ color: toneOf(res.pRet) }}>{sgn(res.pRet)}</span> : "—"], ["最大回撤", res ? `${res.pDd.toFixed(1)}%` : "—"], ["提示数", res ? String(res.flags.length) : "—", res ? `重要 ${res.flags.filter((f) => f.lv === 2).length}` : undefined]]} />
      {!res ? <Empty loading={R.loading || book.loading} text="持仓历史数据不足" /> : <>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[1.2fr_1fr]">
          <div className="bg-[#03070c]">
            <SectionHead title="风险—收益分布（横轴年化波动，纵轴一年收益，圆大小为权重）" />
            <svg viewBox="0 0 400 220" className="h-[220px] w-full">
              <line x1="30" y1={200 - ((0 - rMin) / (rMax - rMin)) * 180} x2="395" y2={200 - ((0 - rMin) / (rMax - rMin)) * 180} stroke="#334155" strokeDasharray="3 3" />
              {res.items.map((x) => { const cx = 30 + (x.vol / maxVol) * 360, cy = 200 - (((x.ret ?? 0) - rMin) / (rMax - rMin)) * 180; return <g key={x.h.symbol} onClick={() => pick(x.h.symbol)} className="cursor-pointer"><circle cx={cx} cy={cy} r={4 + Math.sqrt(Math.abs(x.w)) * 16} fill={(x.ret ?? 0) >= 0 ? "#f2495c55" : "#1fbf7555"} stroke={(x.ret ?? 0) >= 0 ? "#f2495c" : "#1fbf75"} /><text x={cx + 6} y={cy - 4} fontSize="9" fill="#cbd5e1">{x.h.name.slice(0, 8)}</text></g>; })}
              <text x="30" y="215" fontSize="9" fill="#64748b">0</text><text x="370" y="215" fontSize="9" fill="#64748b">{maxVol.toFixed(0)}%</text>
            </svg>
          </div>
          <div className="bg-[#03070c]"><SectionHead title="提示（由真实数据触发，非交易建议）" />
            <div className="max-h-[220px] overflow-auto">{res.flags.map((f, i) => <div key={i} onClick={() => f.s && pick(f.s)} className="flex cursor-pointer items-center gap-2 border-b border-[#0f1b29] px-2 py-1 text-[11px] hover:bg-[#0a1726]"><span className="h-2 w-2 rounded-full" style={{ background: f.lv === 2 ? "#f2495c" : "#fbbf24" }} /><span className="text-slate-200">{f.t}</span></div>)}{!res.flags.length && <Empty text="当前没有触发提示" />}</div></div>
        </div>
        <SectionHead title="持仓风险收益明细" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的</th><th className={TH}>权重</th><th className={TH}>一年收益</th><th className={TH}>年化波动</th><th className={TH}>夏普（无风险利率记 0）</th><th className={TH}>当前回撤</th><th className={TH}>一年最大回撤</th><th className={TH}>一年区间位置</th><th className={TH}>波动贡献</th></tr></thead>
          <tbody>{res.items.map((x) => <tr key={x.h.symbol} onClick={() => pick(x.h.symbol)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{x.h.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.h.symbol}</span></td><td className={TD}>{(x.w * 100).toFixed(1)}%</td><td className={TD} style={{ color: toneOf(x.ret) }}>{sgn(x.ret)}</td><td className={TD}>{x.vol.toFixed(1)}%</td><td className={TD}>{f2(x.sharpe, 2)}</td><td className={TD} style={{ color: toneOf(x.ddNow) }}>{x.ddNow.toFixed(1)}%</td><td className={TD}>{x.ddMax.toFixed(1)}%</td><td className={TD}>{x.pos == null ? "—" : `${x.pos.toFixed(0)}%`}</td><td className={TD} style={{ background: heat(x.riskShare * 100, 60) }}>{(x.riskShare * 100).toFixed(1)}%</td></tr>)}</tbody>
        </table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== 合约静态数据与生命周期 */
type Leg = { id: string; kind: "opt" | "fut"; sym: string; type?: "C" | "P"; strike?: number; exp?: string; qty: number; cost: number; mult: number };
type Swap = { id: string; name: string; notional: number; fixed: number; tenor: number; freq: number; side: "pay" | "rec" };
export function StaticLive({ onClose }: P) {
  const dlib = useSaved<{ legs: Leg[] }>("dlib-book");
  const swaps = useSaved<Swap[]>("swpm-book");
  const pos = usePositions();
  const today = Date.now();
  const rows = useMemo(() => {
    const out: Array<{ id: string; type: string; under: string; start: string | null; exp: string | null; days: number | null; notional: number | null; terms: string }> = [];
    for (const l of dlib.data?.legs ?? []) {
      const days = l.exp ? Math.round((Date.parse(`${l.exp}T20:00:00Z`) - today) / 86400_000) : null;
      out.push({ id: l.id, type: l.kind === "opt" ? (l.type === "P" ? "看跌期权" : "看涨期权") : "期货", under: l.sym, start: null, exp: l.exp ?? null, days, notional: l.qty * l.mult * (l.strike ?? l.cost), terms: l.kind === "opt" ? `行权价 ${l.strike} · ${l.qty} 张 × ${l.mult}` : `${l.qty} 手 × ${l.mult}` });
    }
    for (const s of swaps.data ?? []) {
      const start = Number(s.id) > 1e12 ? new Date(Number(s.id)) : null;
      const end = start ? new Date(start.getTime() + s.tenor * 365.25 * 86400_000) : null;
      out.push({ id: s.id, type: "利率互换", under: "SOFR", start: start ? start.toISOString().slice(0, 10) : null, exp: end ? end.toISOString().slice(0, 10) : null, days: end ? Math.round((end.getTime() - today) / 86400_000) : null, notional: s.notional, terms: `${s.side === "pay" ? "付" : "收"}固定 ${s.fixed.toFixed(3)}% · ${s.tenor} 年 · ${s.freq === 1 ? "年付" : s.freq === 2 ? "半年付" : "季付"}${s.name ? ` · ${s.name}` : ""}` });
    }
    for (const p of (pos.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9)) {
      out.push({ id: `pos-${p.symbol}`, type: p.market === "FUT" ? "期货 / 外汇" : "现货", under: p.symbol, start: new Date(p.firstTs).toISOString().slice(0, 10), exp: null, days: null, notional: p.marketValue, terms: `${p.qty} 股 / 手 · ${MARKET_ZH[p.market] ?? p.market} · ${p.ccy}` });
    }
    return out.sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));
  }, [dlib.data, swaps.data, pos.data, today]);
  const active = rows.filter((r) => r.days == null || r.days >= 0);
  const expired = rows.filter((r) => r.days != null && r.days < 0);
  const soon = active.filter((r) => r.days != null && r.days <= 30);
  const byType = Object.entries(rows.reduce<Record<string, number>>((m, r) => { m[r.type] = (m[r.type] ?? 0) + 1; return m; }, {})).map(([k, v]) => ({ k, v }));
  return (
    <PanelShell code="STAT" title="合约静态数据与生命周期" onClose={onClose}>
      <Kpis items={[["合约总数", String(rows.length)], ["存续", String(active.length)], ["30 天内到期", String(soon.length)], ["已到期", String(expired.length)]]} />
      {!rows.length ? <Empty loading={dlib.loading || swaps.loading || pos.loading} text="暂无合约：在衍生品库（DLIB）、掉期估值（SWPM）中保存，或在交易系统成交后显示" /> : <>
        <Bars data={byType} fmt={(v) => String(v)} height={90} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>类型</th><th className={THL}>标的</th><th className={THL}>要素</th><th className={TH}>起始</th><th className={TH}>到期</th><th className={TH}>剩余天数</th><th className={TH}>名义 / 市值</th><th className={THL}>状态</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className={ROW}><td className={TDL}>{r.type}</td><td className="px-2 font-mono text-slate-200">{r.under}</td><td className="px-2 text-[10px] text-slate-400">{r.terms}</td><td className={TD}>{r.start ?? "—"}</td><td className={TD}>{r.exp ?? "无"}</td><td className={TD} style={{ color: r.days != null && r.days >= 0 && r.days <= 30 ? "#fbbf24" : undefined }}>{r.days ?? "—"}</td><td className={TD}>{fmtCompact(r.notional)}</td><td className="px-2" style={{ color: r.days != null && r.days < 0 ? "#94a3b8" : "#34d399" }}>{r.days != null && r.days < 0 ? "已到期" : "存续"}</td></tr>)}</tbody>
        </table>
        <Note>衍生品与互换来自你保存在平台的合约，现货来自交易账户持仓；互换起始日为保存日期。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== 资本占用 */
export function CapitalLive({ onClose }: P) {
  const pos = usePositions();
  const sum = useSummary();
  const rows = (pos.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9 && r.marketValue != null);
  const pack = useCloses(rows.map((r) => r.symbol), 300);
  const s = sum.data;
  const gross = rows.reduce((a, r) => a + Math.abs(r.marketValue ?? 0), 0);
  const net = rows.reduce((a, r) => a + (r.marketValue ?? 0), 0);
  const risk = useMemo(() => {
    const series = rows.map((r) => { const c = (pack.data?.[r.symbol] ?? []).map(([, v]) => v); return c.slice(1).map((v, i) => v / c[i] - 1); });
    const n = series.length ? Math.min(...series.map((x) => x.length)) : 0;
    if (n < 60) return null;
    const pnl = Array.from({ length: n }, (_, t) => rows.reduce((a, r, k) => a + (r.marketValue ?? 0) * series[k][series[k].length - n + t], 0));
    const sorted = [...pnl].sort((a, b) => a - b);
    const q = (p: number) => -sorted[Math.floor(p * (sorted.length - 1))];
    const worst = sorted[0];
    return { var95: q(0.05), var99: q(0.01), es95: -mean(sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.05)))), worst: -worst, n };
  }, [pack.data, rows.map((r) => `${r.symbol}${Math.round(r.marketValue ?? 0)}`).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const eq = s?.equity ?? 0;
  const pctEq = (v: number | null | undefined) => (v != null && eq ? (v / eq) * 100 : null);
  const stress = [-5, -10, -20].map((sh) => ({ sh, loss: net * (sh / 100) }));
  const byMkt = Object.entries(rows.reduce<Record<string, number>>((m, r) => { m[r.market] = (m[r.market] ?? 0) + Math.abs(r.marketValue ?? 0); return m; }, {})).map(([k, v]) => ({ k: MARKET_ZH[k] ?? k, v }));
  return (
    <PanelShell code="CAP" title="资本占用：敞口、杠杆与风险资本" onClose={onClose} right={<span>平台模拟账户 · 市值按各自币种</span>}>
      <Kpis items={[["账户权益", s ? fmtCompact(s.equity) : "—", s ? `现金 ${fmtCompact(s.cash)}` : undefined], ["总敞口 / 权益", eq ? `${((gross / eq) * 100).toFixed(1)}%` : "—", `总敞口 ${fmtCompact(gross)}`], ["净敞口 / 权益", eq ? `${((net / eq) * 100).toFixed(1)}%` : "—"], ["待交收资金", s ? <span style={{ color: toneOf(s.unsettledCash) }}>{fmtCompact(s.unsettledCash)}</span> : "—"]]} />
      {!rows.length ? <Empty loading={pos.loading} text="交易账户暂无持仓，资本占用为零" /> : <>
        <SectionHead title="风险资本（按当前持仓回看近一年日收益，历史模拟法）" sub={risk ? `${risk.n} 个交易日` : undefined} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>指标</th><th className={TH}>金额</th><th className={TH}>占权益</th><th className="px-2 text-left">占用</th></tr></thead>
          <tbody>{(risk ? [["1 日 VaR（95%）", risk.var95], ["1 日 VaR（99%）", risk.var99], ["1 日预期损失（95%）", risk.es95], ["样本期最差单日", risk.worst]] as Array<[string, number]> : []).concat(stress.map((x) => [`持仓整体 ${x.sh}% 冲击`, -x.loss] as [string, number])).map(([l, v]) => { const p = pctEq(v); return <tr key={l} className={ROW}><td className={TDL}>{l}</td><td className={`${TD} text-white`}>{fmtCompact(v)}</td><td className={TD}>{p == null ? "—" : `${p.toFixed(2)}%`}</td><td className="px-2"><div className="h-2 w-40 bg-[#0a1726]"><div className="h-2" style={{ width: `${Math.min(100, (p ?? 0) * 5)}%`, background: (p ?? 0) > 10 ? "#f2495c" : (p ?? 0) > 5 ? "#fbbf24" : "#38bdf8" }} /></div></td></tr>; })}</tbody>
        </table>
        {!risk && <Empty loading={pack.loading} text="持仓历史数据不足以计算 VaR" />}
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="按市场的敞口" /><Bars data={byMkt} fmt={(v) => fmtCompact(v)} height={120} /></div>
          <div className="bg-[#03070c]"><SectionHead title="单一持仓占权益" />
            <table className="w-full text-[11px]"><tbody>{[...rows].sort((a, b) => Math.abs(b.marketValue ?? 0) - Math.abs(a.marketValue ?? 0)).slice(0, 10).map((r) => { const p = pctEq(Math.abs(r.marketValue ?? 0)); return <tr key={r.symbol} className={ROW}><td className={TDL}>{r.name ?? r.symbol}</td><td className={TD}>{fmtPrice(r.last)}</td><td className={TD} style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className={TD} style={{ background: heat(p, 50) }}>{p == null ? "—" : `${p.toFixed(1)}%`}</td></tr>; })}</tbody></table></div>
        </div>
        <Note>账户以人民币计价，持仓市值为各自交易币种，跨币种账户的占比为近似值；限额设置在电子交易的交易限额与预检（WORKFLOW）。</Note>
      </>}
    </PanelShell>
  );
}
