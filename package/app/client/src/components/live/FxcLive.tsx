/** FXC 外汇交叉汇率：即期矩阵与远期。 */
import { useState } from "react";
import { fmtPct, toneOf } from "@/uc/market/live";
import { useHub } from "@/uc/hubs/kit";
import { f2 } from "@/uc/hubs/calc";
import { Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { CCYS, CCY_ZH, MatrixTable, crossOf, fmtRate, pairSymbol, useUsdValues } from "./RatesFxLive3";
import { useCbRates } from "./FxDeskLive";

type P = { onClose?: () => void };
const TENORS: Array<[string, number]> = [["1 月", 1 / 12], ["3 月", 0.25], ["6 月", 0.5], ["1 年", 1]];
const RATE_CCY: Record<string, string> = { CNH: "CNY" };
const TH = "px-2 py-1 text-right font-normal";
const TD = "px-2 py-0.5 text-right font-mono";

export function FxcLive({ onClose }: P) {
  const [tab, setTab] = useState("spot");
  const [base, setBase] = useState("USD");
  const v = useUsdValues();
  const cb = useCbRates();
  const { pick } = useHub();
  const rateOf = (c: string) => { const row = cb.data?.rows?.find((r) => r.ccy === (RATE_CCY[c] ?? c)); return row?.rate ?? null; };
  const rb = rateOf(base);
  const quotes = CCYS.filter((c) => c !== base);

  return (
    <PanelShell code="FXC" title="外汇交叉汇率" onClose={onClose} tabs={[["spot", "即期矩阵"], ["fwd", "理论远期"]]} tab={tab} setTab={setTab}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 text-[10px]"><span className="text-slate-500">基准货币</span>{CCYS.map((c) => <button key={c} type="button" onClick={() => setBase(c)} className={`border px-1.5 ${base === c ? "border-cyan-500 bg-cyan-900/30 text-cyan-100" : "border-[#1d3047] text-slate-400 hover:text-slate-200"}`}>{c}</button>)}</div>

      {tab === "spot" && <>
        <SectionHead title="实时交叉汇率矩阵（1 单位行货币兑列货币）" sub="点击单元格看该货币对 K 线" />
        <MatrixTable cols={CCYS} v={v} onCell={(b, q) => pick(pairSymbol(b, q))} />
        <SectionHead title={`${CCY_ZH[base] ?? base} 兑各货币 · 今日涨跌`} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left font-normal">货币对</th><th className={TH}>汇率</th><th className={TH}>今日涨跌</th><th className={TH}>反向汇率</th></tr></thead>
          <tbody>{quotes.map((q) => { const x = crossOf(v, base, q); return (
            <tr key={q} onClick={() => pick(pairSymbol(base, q))} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
              <td className="px-2 py-0.5 text-slate-100">{base}/{q}<span className="ml-1 text-[9px] text-slate-500">{CCY_ZH[q]}</span></td>
              <td className={`${TD} text-white`}>{fmtRate(x.rate)}</td>
              <td className={TD} style={{ color: toneOf(x.chg) }}>{fmtPct(x.chg)}</td>
              <td className={`${TD} text-slate-400`}>{x.rate ? fmtRate(1 / x.rate) : "—"}</td>
            </tr>
          ); })}</tbody>
        </table>
      </>}

      {tab === "fwd" && <>
        <Kpis items={[["基准货币", `${base} ${CCY_ZH[base] ?? ""}`], ["基准货币政策利率", rb == null ? "—" : `${rb.toFixed(2)}%`]]} />
        <SectionHead title={`${base} 兑各货币远期`} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left font-normal">货币对</th><th className={TH}>即期</th><th className={TH}>报价货币利率</th><th className={TH}>利差</th>{TENORS.map(([k]) => <th key={k} className={TH}>{k} 远期</th>)}{TENORS.map(([k]) => <th key={`p${k}`} className={TH}>{k} 点</th>)}</tr></thead>
          <tbody>{quotes.map((q) => {
            const s = crossOf(v, base, q).rate; const rq = rateOf(q);
            const fw = TENORS.map(([, t]) => (s != null && rb != null && rq != null ? (s * (1 + (rq / 100) * t)) / (1 + (rb / 100) * t) : null));
            const scale = s != null && s >= 20 ? 100 : 10000;
            return (
              <tr key={q} onClick={() => pick(pairSymbol(base, q))} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
                <td className="px-2 py-0.5 text-slate-100">{base}/{q}</td>
                <td className={`${TD} text-white`}>{fmtRate(s)}</td>
                <td className={`${TD} text-slate-400`}>{rq == null ? "—" : `${rq.toFixed(2)}%`}</td>
                <td className={TD} style={{ color: toneOf(rq != null && rb != null ? rq - rb : null) }}>{rq != null && rb != null ? f2(rq - rb, 2, "%") : "—"}</td>
                {fw.map((f, i) => <td key={i} className={`${TD} text-slate-200`}>{fmtRate(f)}</td>)}
                {fw.map((f, i) => <td key={`p${i}`} className={TD} style={{ color: toneOf(f != null && s != null ? f - s : null) }}>{f != null && s != null ? ((f - s) * scale).toFixed(1) : "—"}</td>)}
              </tr>
            );
          })}</tbody>
        </table>
      </>}
    </PanelShell>
  );
}

export default FxcLive;
