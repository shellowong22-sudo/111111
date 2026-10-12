/**
 * 衍生品窗口（全部基于真实期权链 / 实时行情）：
 *  - OV   期权情景估值：选定一张真实挂牌合约，按“标的价格 × 剩余天数”“标的价格 × 波动率变化”两张情景矩阵估值，
 *         时间价值衰减路径与持有损益；与估值引擎（模型对比）、期权交易控制台（曲面 / 策略分布）角度不同
 *  - DLIB 个人衍生品库：自建的期权 / 期货持仓（永久保存），按真实期权链与实时行情逐笔重估，汇总净希腊值与到期分布
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { f2, gbs, heat, sgn } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, INP, Note, ROW, TD, TDL, TH, THL, tenorVal, useCurves, type P } from "./LiveCommon";

type Opt = { strike: number; type: "C" | "P"; bid: number; ask: number; last: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; volume: number };
type Chain = { symbol: string; spot: number; changePct: number; iv30: number; expiries: string[]; expiry: string; chain: Array<{ strike: number; call: Opt | null; put: Opt | null }> };
const mid = (o: Opt | null | undefined) => (!o ? null : o.bid > 0 && o.ask > 0 ? (o.bid + o.ask) / 2 : o.last > 0 ? o.last : null);
const daysTo = (exp: string) => Math.max(0, (Date.parse(`${exp}T20:00:00Z`) - Date.now()) / 86400_000);
const QUICK = ["SPY", "QQQ", "IWM", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GLD", "TLT"];
const useRate = () => { const c = useCurves(); const v = tenorVal(c.data?.us.at(-1), "3M"); return v == null ? 0.04 : v / 100; };

/* ================================================================== OV 期权情景估值 */
export function OvLive({ onClose }: P) {
  const [sym, setSym] = useState("SPY");
  const [input, setInput] = useState("SPY");
  const [exp, setExp] = useState<string | null>(null);
  const [type, setType] = useState<"C" | "P">("C");
  const [strike, setStrike] = useState<number | null>(null);
  const [qty, setQty] = useState("1");
  const [side, setSide] = useState<"long" | "short">("long");
  const ch = usePolled<Chain>("ucHubs.options", exp ? { symbol: sym, expiry: exp } : { symbol: sym }, 60_000);
  const t = useTicks([sym]);
  const r = useRate();
  const c = ch.data;
  useEffect(() => { setExp(null); setStrike(null); }, [sym]);
  const S = t[sym]?.price ?? c?.spot ?? null;
  const rows = c?.chain ?? [];
  const atm = rows.length && S ? rows.reduce((a, b) => (Math.abs(b.strike - S) < Math.abs(a.strike - S) ? b : a)).strike : null;
  const K = strike ?? atm;
  const row = rows.find((x) => x.strike === K);
  const o = type === "C" ? row?.call : row?.put;
  const D = c ? daysTo(c.expiry) : 0;
  const iv = o?.iv && o.iv > 0 ? o.iv : (c?.iv30 ?? 20) / 100;
  const px0 = mid(o);
  const n = (Number(qty) || 1) * 100 * (side === "long" ? 1 : -1);
  const val = (s: number, d: number, v: number) => gbs(type, s, K ?? s, Math.max(d, 0) / 365, r, r, v).price;
  const theo = S && K ? val(S, D, iv) : null;
  const moves = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10];
  const dayCols = D > 0 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(D * f)) : [0];
  const volShifts = [-10, -5, -2, 0, 2, 5, 10];
  const decay = D > 0 && S ? Array.from({ length: Math.min(60, Math.ceil(D)) + 1 }, (_, i) => { const d = D - (D * i) / Math.min(60, Math.ceil(D)); return { d, v: val(S, d, iv) }; }) : [];
  const base = px0 ?? theo ?? 0;
  return (
    <PanelShell code="OV" title="期权情景估值" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]">
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) setSym(input.trim().toUpperCase()); }}><input value={input} onChange={(e) => setInput(e.target.value)} className={`${INP} w-20`} /></form>
        {QUICK.map((q) => <button type="button" key={q} onClick={() => { setSym(q); setInput(q); }} className={`border px-1.5 py-0.5 text-[10px] ${sym === q ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-500"}`}>{q}</button>)}
      </div>
      {!c ? <Empty loading={ch.loading} text="该标的暂无挂牌期权" /> : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-y border-[#1a2a3c] px-2 py-1 text-[11px]">
            <span className="text-slate-500">到期</span><select value={c.expiry} onChange={(e) => setExp(e.target.value)} className={INP}>{c.expiries.filter((e) => daysTo(e) >= 0).slice(0, 24).map((e) => <option key={e} value={e}>{e}（{Math.ceil(daysTo(e))} 天）</option>)}</select>
            <Seg value={type} options={[["C", "看涨"], ["P", "看跌"]]} onChange={setType} />
            <span className="text-slate-500">行权价</span><select value={K ?? ""} onChange={(e) => setStrike(Number(e.target.value))} className={INP}>{rows.map((x) => <option key={x.strike} value={x.strike}>{x.strike}</option>)}</select>
            <Seg value={side} options={[["long", "买入"], ["short", "卖出"]]} onChange={setSide} />
            <span className="text-slate-500">张数</span><input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className={`${INP} w-14`} />
          </div>
          <Kpis items={[["标的（实时）", fmtPrice(S), fmtPct(t[sym]?.changePct ?? c.changePct)], ["买 / 卖", o ? `${o.bid.toFixed(2)} / ${o.ask.toFixed(2)}` : "—"], ["中间价", f2(px0)], ["合约隐含波动", f2(iv * 100, 1, "%")], ["理论价（自身隐波）", f2(theo)], ["持仓量 / 成交", o ? `${o.oi.toLocaleString()} / ${o.volume.toLocaleString()}` : "—"], ["Delta / Gamma", o ? `${o.delta.toFixed(3)} / ${o.gamma.toFixed(4)}` : "—"], ["Theta / Vega（每张）", o ? `${(o.theta * 100).toFixed(1)} / ${(o.vega * 100).toFixed(1)}` : "—"]]} />
          {S && K ? (
            <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-2">
              <div className="bg-[#03070c]">
                <SectionHead title="情景一：标的价格 × 剩余天数（持仓损益，美元）" sub={`以中间价 ${base.toFixed(2)} 建仓；隐波保持 ${(iv * 100).toFixed(1)}%`} />
                <table className="w-full text-[11px]">
                  <thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的变动</th><th className={TH}>标的价</th>{dayCols.map((d) => <th key={d} className={TH}>{d === 0 ? "到期" : `剩 ${d} 天`}</th>)}</tr></thead>
                  <tbody>{moves.map((m) => { const s = S * (1 + m / 100); return <tr key={m} className={ROW}><td className={`${TDL} text-slate-400`}>{sgn(m, 1)}</td><td className={`${TD} text-slate-300`}>{s.toFixed(2)}</td>{dayCols.map((d) => { const pnl = (val(s, d, iv) - base) * n; return <td key={d} className={TD} style={{ color: toneOf(pnl), background: heat(pnl, Math.abs(base * n) || 1) }}>{pnl.toFixed(0)}</td>; })}</tr>; })}</tbody>
                </table>
              </div>
              <div className="bg-[#03070c]">
                <SectionHead title="情景二：标的价格 × 隐含波动变化（今日估值，美元）" sub="列为隐波的绝对变化（波动点）" />
                <table className="w-full text-[11px]">
                  <thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的变动</th>{volShifts.map((v) => <th key={v} className={TH}>{v > 0 ? `+${v}` : v}</th>)}</tr></thead>
                  <tbody>{moves.map((m) => { const s = S * (1 + m / 100); return <tr key={m} className={ROW}><td className={`${TDL} text-slate-400`}>{sgn(m, 1)}</td>{volShifts.map((v) => { const pnl = (val(s, D, Math.max(0.01, iv + v / 100)) - base) * n; return <td key={v} className={TD} style={{ color: toneOf(pnl), background: heat(pnl, Math.abs(base * n) || 1) }}>{pnl.toFixed(0)}</td>; })}</tr>; })}</tbody>
                </table>
              </div>
            </div>
          ) : null}
          <SectionHead title="时间价值衰减（标的与隐波不变）" sub="横轴为剩余天数，越往右越接近到期" />
          <Lines height={150} xLabels={decay.map((x) => x.d.toFixed(0))} fmt={(v) => v.toFixed(2)} series={[{ name: "期权理论价", color: "#a78bfa", values: decay.map((x) => x.v) }]} />
          <Note>估值用广义 Black-Scholes（股息率按 0 处理，无风险利率取美债 3 个月收益率），波动率取该合约自身隐含波动；美式提前行权价值未计入。每张合约乘数 100。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== DLIB 个人衍生品库 */
type Leg = { id: string; kind: "opt" | "fut"; sym: string; type?: "C" | "P"; strike?: number; exp?: string; qty: number; cost: number; mult: number; note?: string };
const FUT_MULT: Record<string, number> = { ES: 50, NQ: 20, YM: 5, RTY: 50, CL: 1000, NG: 10000, GC: 100, SI: 5000, HG: 25000, ZN: 1000, ZB: 1000, ZC: 50, ZS: 50, ZW: 50 };
function useLegChains(legs: Leg[]) {
  const keys = [...new Set(legs.filter((l) => l.kind === "opt").map((l) => `${l.sym}|${l.exp}`))].slice(0, 6);
  const q = keys.map((k) => { const [s, e] = k.split("|"); return { s, e }; });
  const a = usePolled<Chain>("ucHubs.options", q[0] ? { symbol: q[0].s, expiry: q[0].e } : null, 120_000);
  const b = usePolled<Chain>("ucHubs.options", q[1] ? { symbol: q[1].s, expiry: q[1].e } : null, 120_000);
  const c = usePolled<Chain>("ucHubs.options", q[2] ? { symbol: q[2].s, expiry: q[2].e } : null, 120_000);
  const d = usePolled<Chain>("ucHubs.options", q[3] ? { symbol: q[3].s, expiry: q[3].e } : null, 120_000);
  const e = usePolled<Chain>("ucHubs.options", q[4] ? { symbol: q[4].s, expiry: q[4].e } : null, 120_000);
  const f = usePolled<Chain>("ucHubs.options", q[5] ? { symbol: q[5].s, expiry: q[5].e } : null, 120_000);
  const all = [a, b, c, d, e, f];
  return Object.fromEntries(keys.map((k, i) => [k, all[i].data])) as Record<string, Chain | null>;
}
export function DlibLive({ onClose }: P) {
  const saved = useSaved<{ legs: Leg[] }>("dlib-book");
  const [legs, setLegs] = useState<Leg[]>([]);
  const [tab, setTab] = useState("book");
  const [d, setD] = useState({ kind: "opt" as "opt" | "fut", sym: "SPY", type: "C" as "C" | "P", strike: "", exp: "", qty: "1", cost: "" });
  useEffect(() => { if (saved.data?.legs) setLegs(saved.data.legs); }, [saved.data]);
  const helper = usePolled<Chain>("ucHubs.options", d.kind === "opt" && d.sym ? (d.exp ? { symbol: d.sym, expiry: d.exp } : { symbol: d.sym }) : null, 300_000);
  const chains = useLegChains(legs);
  const ticks = useTicks([...new Set(legs.map((l) => l.sym))]);
  const persist = async (next: Leg[]) => { setLegs(next); try { await saveItem("dlib-book", { legs: next }); } catch { toast.error("保存失败"); } };
  const add = () => {
    const qty = Number(d.qty), cost = Number(d.cost);
    if (!d.sym || !qty) { toast.error("请填写标的与数量（空头为负数）"); return; }
    if (d.kind === "opt") {
      const exp = d.exp || helper.data?.expiry; const strike = Number(d.strike);
      if (!exp || !strike) { toast.error("请选择到期日与行权价"); return; }
      const row = helper.data?.chain.find((x) => x.strike === strike); const o = d.type === "C" ? row?.call : row?.put;
      void persist([...legs, { id: `${Date.now()}`, kind: "opt", sym: d.sym.toUpperCase(), type: d.type, strike, exp, qty, cost: cost || mid(o) || 0, mult: 100 }]);
    } else {
      const s = d.sym.toUpperCase();
      void persist([...legs, { id: `${Date.now()}`, kind: "fut", sym: s, qty, cost: cost || ticks[s]?.price || 0, mult: FUT_MULT[s] ?? 1 }]);
    }
    setD({ ...d, strike: "", cost: "" });
  };
  const val = legs.map((l) => {
    if (l.kind === "fut") { const p = ticks[l.sym]?.price ?? null; return { l, px: p, pnl: p != null ? (p - l.cost) * l.qty * l.mult : null, delta: l.qty * l.mult, gamma: 0, vega: 0, theta: 0, notional: p != null ? p * l.qty * l.mult : null, S: p }; }
    const ch = chains[`${l.sym}|${l.exp}`]; const row = ch?.chain.find((x) => x.strike === l.strike); const o = l.type === "C" ? row?.call : row?.put; const px = mid(o); const S = ticks[l.sym]?.price ?? ch?.spot ?? null; const k = l.qty * l.mult;
    return { l, px, pnl: px != null ? (px - l.cost) * k : null, delta: o ? o.delta * k : 0, gamma: o ? o.gamma * k : 0, vega: o ? o.vega * k : 0, theta: o ? o.theta * k : 0, notional: S != null && o ? o.delta * k * S : null, S };
  });
  const tot = val.reduce((s, v) => ({ pnl: s.pnl + (v.pnl ?? 0), delta: s.delta + (v.notional ?? 0), vega: s.vega + v.vega, theta: s.theta + v.theta }), { pnl: 0, delta: 0, vega: 0, theta: 0 });
  const byExp = Object.entries(legs.filter((l) => l.kind === "opt").reduce<Record<string, number>>((m, l) => { const k = l.exp!.slice(0, 7); m[k] = (m[k] ?? 0) + Math.abs(l.qty); return m; }, {})).sort().map(([k, v]) => ({ k, v }));
  const bySym = Object.entries(val.reduce<Record<string, number>>((m, v) => { m[v.l.sym] = (m[v.l.sym] ?? 0) + (v.notional ?? 0); return m; }, {})).map(([k, v]) => ({ k, v }));
  const { pick } = useHub();
  return (
    <PanelShell code="DLIB" title="个人衍生品库" onClose={onClose} tabs={[["book", "持仓与重估"], ["risk", "风险汇总"]]} tab={tab} setTab={setTab}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <Seg value={d.kind} options={[["opt", "期权"], ["fut", "期货"]]} onChange={(k) => setD({ ...d, kind: k, sym: k === "fut" ? "ES" : "SPY" })} />
        <input value={d.sym} onChange={(e) => setD({ ...d, sym: e.target.value.toUpperCase(), exp: "", strike: "" })} placeholder={d.kind === "opt" ? "标的，如 SPY" : "期货品种，如 ES / CL / GC"} className={`${INP} w-28`} />
        {d.kind === "opt" && <>
          <Seg value={d.type} options={[["C", "看涨"], ["P", "看跌"]]} onChange={(v) => setD({ ...d, type: v })} />
          <select value={d.exp || helper.data?.expiry || ""} onChange={(e) => setD({ ...d, exp: e.target.value, strike: "" })} className={INP}>{(helper.data?.expiries ?? []).filter((e) => daysTo(e) >= 0).slice(0, 24).map((e) => <option key={e}>{e}</option>)}</select>
          <select value={d.strike} onChange={(e) => setD({ ...d, strike: e.target.value })} className={INP}><option value="">行权价</option>{(helper.data?.chain ?? []).map((x) => <option key={x.strike} value={x.strike}>{x.strike}</option>)}</select>
        </>}
        <input value={d.qty} onChange={(e) => setD({ ...d, qty: e.target.value })} placeholder="数量（空头为负）" className={`${INP} w-24`} />
        <input value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} placeholder="成本（空 = 按现价）" className={`${INP} w-28`} />
        <button type="button" className={BTN} onClick={add}>加入衍生品库</button>
      </div>
      <Kpis items={[["持仓笔数", String(legs.length)], ["浮动盈亏", <span style={{ color: toneOf(tot.pnl) }}>{tot.pnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>], ["净 Delta 名义", tot.delta.toLocaleString("en-US", { maximumFractionDigits: 0 })], ["净 Vega（每 1 波动点）", tot.vega.toFixed(0)], ["净 Theta（每日）", tot.theta.toFixed(0)]]} />
      {!legs.length ? <div className="px-3 py-8 text-center text-[11px] text-slate-500">衍生品库为空：在上方选择真实挂牌的期权合约或期货品种加入，记录永久保存在你的个人账户。</div> : (
        <>
          {tab === "book" && (
            <table className="w-full text-[11px]">
              <thead className="text-[10px] text-slate-500"><tr><th className={THL}>合约</th><th className={TH}>剩余天数</th><th className={TH}>数量</th><th className={TH}>成本</th><th className={TH}>现价</th><th className={TH}>标的</th><th className={TH}>浮动盈亏</th><th className={TH}>Delta 名义</th><th className={TH}>Vega</th><th className={TH}>Theta</th><th className={TH} /></tr></thead>
              <tbody>{val.map((v) => (
                <tr key={v.l.id} className={ROW}>
                  <td className={`${TDL} cursor-pointer font-mono text-cyan-200 hover:underline`} onClick={() => pick(v.l.sym)}>{v.l.kind === "opt" ? `${v.l.sym} ${v.l.exp} ${v.l.strike}${v.l.type === "C" ? " 看涨" : " 看跌"}` : `${v.l.sym} 期货（×${v.l.mult}）`}</td>
                  <td className={`${TD} text-slate-400`}>{v.l.exp ? Math.ceil(daysTo(v.l.exp)) : "—"}</td>
                  <td className={TD} style={{ color: toneOf(v.l.qty) }}>{v.l.qty}</td>
                  <td className={`${TD} text-slate-300`}>{fmtPrice(v.l.cost)}</td>
                  <td className={`${TD} text-white`}>{fmtPrice(v.px)}</td>
                  <td className={`${TD} text-slate-400`}>{fmtPrice(v.S)}</td>
                  <td className={TD} style={{ color: toneOf(v.pnl) }}>{v.pnl == null ? "—" : v.pnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td className={`${TD} text-slate-300`}>{v.notional == null ? "—" : v.notional.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td className={`${TD} text-slate-300`}>{v.vega.toFixed(0)}</td>
                  <td className={`${TD} text-slate-300`}>{v.theta.toFixed(0)}</td>
                  <td className={TD}><button type="button" className="text-[10px] text-slate-500 hover:text-rose-300" onClick={() => void persist(legs.filter((x) => x.id !== v.l.id))}>移除</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {tab === "risk" && (
            <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
              <div className="bg-[#03070c]"><SectionHead title="按标的的 Delta 名义敞口" /><Bars data={bySym} fmt={(v) => v.toLocaleString("en-US", { maximumFractionDigits: 0 })} height={150} /></div>
              <div className="bg-[#03070c]"><SectionHead title="期权按到期月份的张数分布" /><Bars data={byExp} fmt={(v) => v.toFixed(0)} height={150} /></div>
            </div>
          )}
          <Note>期权按真实期权链中间价重估、希腊值取期权链数据；期货按实时价格与合约乘数重估。浮动盈亏未含手续费。</Note>
        </>
      )}
    </PanelShell>
  );
}
