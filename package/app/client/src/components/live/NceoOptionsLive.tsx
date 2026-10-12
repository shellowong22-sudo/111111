/**
 * 股票驾驶舱内的期权摘要卡：当前标的的隐含波动、偏度、持仓结构与平值附近报价（真实期权链）。
 * 完整期权链在衍生品终端（OMON），此处只做摘要，不给出买卖结论。
 */
import { fmtPrice, usePolled } from "@/uc/market/live";
import { f2 } from "@/uc/hubs/calc";

type Q = { strike: number; bid: number; ask: number; last: number; iv: number; delta: number; oi: number; volume: number };
type Chain = {
  spot: number; iv30: number | null; expiry: string; expiries: string[]; maxPain: number | null;
  chain: Array<{ strike: number; call: Q | null; put: Q | null }>;
  term: Array<{ exp: string; iv: number | null; oi: number }>;
  stats: { atmIv: number | null; skew25: number | null; pcOiAll: number | null; pcVolumeAll: number | null; callOi: number; putOi: number };
};
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v <= 0 ? "—" : `${(v > 1.5 ? v : v * 100).toFixed(1)}%`);

export function NceoOptionsCard({ symbol, onOpen }: { symbol: string; onOpen?: () => void }) {
  const q = usePolled<Chain>("ucHubs.options", { symbol }, 120_000);
  const d = q.data;
  const atm = d?.chain?.length ? d.chain.reduce((a, b) => (Math.abs(b.strike - d.spot) < Math.abs(a.strike - d.spot) ? b : a)) : null;
  const i = d && atm ? d.chain.indexOf(atm) : -1;
  const strip = d && i >= 0 ? d.chain.slice(Math.max(0, i - 4), i + 5) : [];
  return (
    <section className="border border-violet-900/70 bg-[#0d1220] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-violet-200">{symbol} · 期权摘要</h3>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">{d ? `最近到期 ${d.expiry} · 共 ${d.expiries?.length ?? 0} 个到期日` : q.loading ? "读取期权链…" : "该标的暂无上市期权"}</p>
        </div>
        {onOpen && d && <button type="button" onClick={onOpen} className="border border-violet-800 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-950">完整期权链 ›</button>}
      </div>
      {d && <>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] sm:grid-cols-6">
          {([["30 日隐波", pct(d.iv30)], ["平值隐波", pct(d.stats?.atmIv)], ["25Δ 偏度", d.stats?.skew25 == null ? "—" : f2((d.stats.skew25 > 1.5 ? d.stats.skew25 : d.stats.skew25 * 100), 1, " 点")], ["看跌/看涨 持仓", f2(d.stats?.pcOiAll, 2)], ["看跌/看涨 成交", f2(d.stats?.pcVolumeAll, 2)], ["最大痛点", fmtPrice(d.maxPain)]] as Array<[string, string]>).map(([k, v]) => (
            <div key={k} className="border border-slate-800 px-2 py-1"><div className="text-slate-500">{k}</div><div className="font-mono text-slate-100">{v}</div></div>
          ))}
        </div>
        {strip.length > 0 && (
          <table className="mt-2 w-full text-[10px]">
            <thead className="text-slate-500"><tr><th className="px-1 text-right font-normal">看涨 买/卖</th><th className="px-1 text-right font-normal">隐波</th><th className="px-1 text-right font-normal">Δ</th><th className="px-1 text-center font-normal">行权价</th><th className="px-1 text-right font-normal">Δ</th><th className="px-1 text-right font-normal">隐波</th><th className="px-1 text-right font-normal">看跌 买/卖</th></tr></thead>
            <tbody>{strip.map((r) => (
              <tr key={r.strike} className={`border-t border-slate-800 font-mono ${r === atm ? "bg-violet-950/40" : ""}`}>
                <td className="px-1 text-right text-slate-200">{r.call ? `${r.call.bid.toFixed(2)} / ${r.call.ask.toFixed(2)}` : "—"}</td>
                <td className="px-1 text-right text-slate-400">{r.call ? pct(r.call.iv) : "—"}</td>
                <td className="px-1 text-right text-slate-400">{r.call ? r.call.delta.toFixed(2) : "—"}</td>
                <td className="px-1 text-center text-white">{r.strike}</td>
                <td className="px-1 text-right text-slate-400">{r.put ? r.put.delta.toFixed(2) : "—"}</td>
                <td className="px-1 text-right text-slate-400">{r.put ? pct(r.put.iv) : "—"}</td>
                <td className="px-1 text-right text-slate-200">{r.put ? `${r.put.bid.toFixed(2)} / ${r.put.ask.toFixed(2)}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {d.term?.length > 1 && <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">期限结构：{d.term.slice(0, 8).map((x) => <span key={x.exp} className="font-mono">{x.exp.slice(5)} {pct(x.iv)}</span>)}</div>}
      </>}
    </section>
  );
}
