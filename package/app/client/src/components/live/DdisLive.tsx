/**
 * DDIS 股息分析：以美股 / A 股 / 港股红利与股息增长类 ETF 观察股息策略的表现、相对强弱与利率敏感度。
 * 个股股息明细（除息日、派息、增长年数）待后端 ucHubs.dividends 接口提供后加入（见 HANDOFF §0.2）。
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, drawdown, f2, perf, rets, sgn, useCloses } from "@/uc/hubs/calc";
import { Empty, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose?: () => void };
const U: Array<[string, string, string, string]> = [
  ["VIG", "股息增长", "美股", "SPY"], ["SCHD", "高股息质量", "美股", "SPY"], ["DVY", "精选高股息", "美股", "SPY"], ["HDV", "核心高股息", "美股", "SPY"], ["NOBL", "股息贵族", "美股", "SPY"], ["SDY", "标普高股息", "美股", "SPY"], ["VYM", "高股息收益", "美股", "SPY"],
  ["IDV", "国际精选股息", "海外", "EFA"],
  ["sh510880", "红利 ETF", "A股", "sh510300"], ["sh515080", "中证红利 ETF", "A股", "sh510300"], ["sh512890", "红利低波 ETF", "A股", "sh510300"],
  ["3110.HK", "恒生高股息 ETF", "港股", "2800.HK"],
];
const BENCH: Record<string, string> = { SPY: "标普 500", EFA: "发达市场", sh510300: "沪深 300", "2800.HK": "盈富基金" };
const TH = "px-2 py-1 text-right font-normal";
const TD = "px-2 py-0.5 text-right font-mono";

export function DdisLive({ onClose }: P) {
  const syms = useMemo(() => [...new Set([...U.flatMap(([s, , , b]) => [s, b]), "TLT"])], []);
  const t = useTicks(syms);
  const pack = useCloses(syms, 520);
  const { pick } = useHub();
  const [sel, setSel] = useState("SCHD");

  const rows = useMemo(() => U.map(([s, l, g, b]) => {
    const { m } = align(pack.data ?? null, [s, b, "TLT"]);
    const c = m[s] ?? [], cb = m[b] ?? [], ct = m.TLT ?? [];
    if (c.length < 60) return { s, l, g, b, ok: false as const };
    const r = rets(c.slice(-253)), rb = rets(cb.slice(-253)), rt = rets(ct.slice(-253));
    const p1y = perf(c, 252), pb1y = perf(cb, 252);
    return {
      s, l, g, b, ok: true as const,
      p3m: perf(c, 63), p1y, excess: p1y != null && pb1y != null ? p1y - pb1y : null,
      vol: annVol(c, 252), volB: annVol(cb, 252), mdd: drawdown(c.slice(-253)).max,
      rhoB: corr(r, rb), rhoT: corr(r, rt),
    };
  }), [pack.data]);

  const rel = useMemo(() => {
    const row = U.find(([s]) => s === sel);
    if (!row) return null;
    const { dates, m } = align(pack.data ?? null, [row[0], row[3]]);
    const a = m[row[0]] ?? [], b = m[row[3]] ?? [];
    if (a.length < 30) return null;
    return { dates, ratio: a.map((v, i) => (v / a[0]) / (b[i] / b[0]) * 100), bench: row[3] };
  }, [pack.data, sel]);

  const selLabel = U.find(([s]) => s === sel)?.[1] ?? sel;
  return (
    <PanelShell code="DDIS" title="股息分析" onClose={onClose}>
      <SectionHead title="股息策略 ETF：表现、相对基准与利率敏感度" sub="单击行看相对强弱，双击看 K 线" />
      {!rows.some((r) => r.ok) ? <Empty loading={pack.loading} /> : (
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left font-normal">ETF</th><th className="px-2 py-1 text-left font-normal">市场</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>3 月</th><th className={TH}>1 年</th><th className={TH}>相对基准 1 年</th><th className={TH}>年化波动</th><th className={TH}>基准波动</th><th className={TH}>1 年最大回撤</th><th className={TH}>与基准相关</th><th className={TH}>与长债相关</th></tr></thead>
          <tbody>{rows.map((r) => { const k = t[r.s]; return (
            <tr key={r.s} onClick={() => setSel(r.s)} onDoubleClick={() => pick(r.s)} className={`cursor-pointer border-t border-[#0f1b29] ${sel === r.s ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
              <td className="px-2 py-0.5 text-slate-100">{r.l}<span className="ml-1 font-mono text-[9px] text-slate-500">{r.s}</span></td>
              <td className="px-2 text-[10px] text-slate-500">{r.g} · {BENCH[r.b]}</td>
              <td className={`${TD} text-white`}>{fmtPrice(k?.price)}</td>
              <td className={TD} style={{ color: toneOf(k?.changePct) }}>{fmtPct(k?.changePct)}</td>
              {r.ok ? <>
                <td className={TD} style={{ color: toneOf(r.p3m) }}>{sgn(r.p3m)}</td>
                <td className={TD} style={{ color: toneOf(r.p1y) }}>{sgn(r.p1y)}</td>
                <td className={TD} style={{ color: toneOf(r.excess) }}>{sgn(r.excess)}</td>
                <td className={`${TD} text-slate-300`}>{f2(r.vol, 1, "%")}</td>
                <td className={`${TD} text-slate-500`}>{f2(r.volB, 1, "%")}</td>
                <td className={TD} style={{ color: "#1fbf75" }}>{f2(r.mdd, 1, "%")}</td>
                <td className={TD}>{f2(r.rhoB, 2)}</td>
                <td className={TD}>{f2(r.rhoT, 2)}</td>
              </> : <td colSpan={8} className="px-2 text-[10px] text-slate-500">历史不足</td>}
            </tr>
          ); })}</tbody>
        </table>
      )}
      <SectionHead title={`${selLabel} 相对 ${rel ? BENCH[rel.bench] : "基准"} 强弱（近两年）`} />
      {rel ? <Lines series={[{ name: "相对强弱", color: "#f5b942", values: rel.ratio }]} xLabels={rel.dates} height={180} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} />}
    </PanelShell>
  );
}

export default DdisLive;
