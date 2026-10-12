/**
 * IN 指数浏览器：单一指数的长周期画像（与 WT 盘中走势、GMM 异动、WEI 全球监控不重复）。
 *  - 区间收益阶梯（1 周 → 5 年、年初至今）与年化收益 / 波动 / 最大回撤
 *  - 月度收益热力表（年 × 月）
 *  - 回撤曲线与 60 日滚动波动
 *  - 日收益分布统计（上涨日占比、偏度、峰度、最好 / 最差交易日）
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, drawdown, f2, heat, mean, perf, rets, rollingVol, sgn, std, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose?: () => void };
const L: Array<[string, string, string]> = [
  ["^GSPC", "标普 500", "美国"], ["^NDX", "纳斯达克 100", "美国"], ["^DJI", "道琼斯工业", "美国"], ["^RUT", "罗素 2000", "美国"],
  ["000300.SH", "沪深 300", "中国"], ["000001.SH", "上证指数", "中国"], ["399006.SZ", "创业板指", "中国"], ["^HSI", "恒生指数", "中国香港"],
  ["^N225", "日经 225", "日本"], ["^KS11", "韩国综合", "韩国"], ["^STOXX50E", "欧洲斯托克 50", "欧洲"], ["^GDAXI", "德国 DAX", "欧洲"], ["^FTSE", "富时 100", "英国"],
];
const STEPS: Array<[string, number]> = [["1周", 5], ["1月", 21], ["3月", 63], ["6月", 126], ["1年", 252], ["3年", 756], ["5年", 1260]];
const MON = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const TH = "px-2 py-1 text-right font-normal";
const TD = "px-2 py-0.5 text-right font-mono";

export function IdxIN({ onClose }: P) {
  const [s, setS] = useState(L[0][0]);
  const t = useTicks(L.map(([x]) => x));
  const pack = useCloses([s], 1900);
  const { pick } = useHub();
  const label = L.find(([x]) => x === s)?.[1] ?? s;

  const d = useMemo(() => {
    const { dates, m } = align(pack.data ?? null, [s]);
    const c = m[s] ?? [];
    if (c.length < 30) return null;
    const r = rets(c);
    const years = r.length / 252;
    const annRet = years > 0.2 ? (Math.pow(c[c.length - 1] / c[0], 1 / years) - 1) * 100 : null;
    const annVol = std(r) * Math.sqrt(252) * 100;
    const dd = drawdown(c);
    // 月末收盘 → 月收益
    const monthEnd = new Map<string, number>();
    dates.forEach((dt, i) => monthEnd.set(dt.slice(0, 7), c[i]));
    const keys = [...monthEnd.keys()].sort();
    const monthly: Record<string, Array<number | null>> = {};
    keys.forEach((k, i) => {
      if (i === 0) return;
      const y = k.slice(0, 4), mo = Number(k.slice(5, 7)) - 1;
      (monthly[y] ??= Array(12).fill(null))[mo] = (monthEnd.get(k)! / monthEnd.get(keys[i - 1])! - 1) * 100;
    });
    const yearRet: Record<string, number | null> = {};
    Object.keys(monthly).forEach((y) => { const v = monthly[y].filter((x): x is number => x != null); yearRet[y] = v.length ? (v.reduce((a, x) => a * (1 + x / 100), 1) - 1) * 100 : null; });
    const mu = mean(r), sd = std(r);
    const skew = sd ? r.reduce((a, x) => a + ((x - mu) / sd) ** 3, 0) / r.length : null;
    const kurt = sd ? r.reduce((a, x) => a + ((x - mu) / sd) ** 4, 0) / r.length - 3 : null;
    let bi = 0, wi = 0;
    r.forEach((x, i) => { if (x > r[bi]) bi = i; if (x < r[wi]) wi = i; });
    const up = r.filter((x) => x > 0).length / r.length * 100;
    // 日收益分布直方图（%）
    const pct = r.map((x) => (Math.exp(x) - 1) * 100);
    const edges = [-4, -3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 4];
    const hist = edges.slice(0, -1).map((lo, i) => ({ k: `${lo}~${edges[i + 1]}`, v: pct.filter((x) => x >= lo && x < edges[i + 1]).length }));
    hist.unshift({ k: "< -4", v: pct.filter((x) => x < -4).length });
    hist.push({ k: "≥ 4", v: pct.filter((x) => x >= 4).length });
    const tail = Math.min(c.length, 504);
    return {
      c, dates, annRet, annVol, dd, monthly, yearRet, skew, kurt, up, hist,
      best: { v: (Math.exp(r[bi]) - 1) * 100, d: dates[bi + 1] }, worst: { v: (Math.exp(r[wi]) - 1) * 100, d: dates[wi + 1] },
      steps: STEPS.map(([k, n]) => [k, perf(c, n)] as const), ytd: ytd(c, dates),
      ddTail: dd.series.slice(-tail), volTail: rollingVol(c, 60).slice(-tail), xTail: dates.slice(-tail),
    };
  }, [pack.data, s]);

  const tick = t[s];
  return (
    <PanelShell code="IN" title="指数浏览器" onClose={onClose}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="bg-[#03070c]">
          {L.map(([x, l, reg]) => (
            <button key={x} type="button" onClick={() => setS(x)} className={`flex w-full items-center justify-between border-b border-[#0f1b29] px-2 py-1 text-[11px] ${s === x ? "bg-[#0d2236] text-white" : "text-slate-300 hover:bg-[#0a1726]"}`}>
              <span>{l}<span className="ml-1 text-[9px] text-slate-600">{reg}</span></span>
              <span className="font-mono" style={{ color: toneOf(t[x]?.changePct) }}>{fmtPct(t[x]?.changePct)}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 bg-[#03070c]">
          <SectionHead title={`${label} · 长周期画像`} right={<button type="button" onClick={() => pick(s)} className="text-[10px] text-cyan-300 hover:underline">K 线 ›</button>} />
          <Kpis items={[
            ["最新", <span key="p" style={{ color: toneOf(tick?.changePct) }}>{fmtPrice(tick?.price)} {fmtPct(tick?.changePct)}</span>],
            ["年化收益", d ? sgn(d.annRet) : "—"], ["年化波动", d ? f2(d.annVol, 1, "%") : "—"],
            ["最大回撤", d ? <span key="m" style={{ color: "#1fbf75" }}>{f2(d.dd.max, 1, "%")}</span> : "—"],
            ["距高点", d ? f2(d.dd.now, 1, "%") : "—"],
            ["样本", d ? `${d.dates[0]} 起 · ${d.c.length} 日` : "—"],
          ]} />
          {!d ? <Empty loading={pack.loading} text="该指数日线暂未更新" /> : <>
            <table className="w-full text-[11px]">
              <thead className="text-[10px] text-slate-500"><tr>{d.steps.map(([k]) => <th key={k} className={TH}>{k}</th>)}<th className={TH}>年初至今</th></tr></thead>
              <tbody><tr className="border-t border-[#0f1b29]">{d.steps.map(([k, v]) => <td key={k} className={TD} style={{ color: toneOf(v) }}>{sgn(v)}</td>)}<td className={TD} style={{ color: toneOf(d.ytd) }}>{sgn(d.ytd)}</td></tr></tbody>
            </table>

            <SectionHead title="月度收益热力表（%）"  />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[10px]">
                <thead className="text-slate-500"><tr><th className="px-2 py-1 text-left font-normal">年份</th>{MON.map((m) => <th key={m} className={TH}>{m}</th>)}<th className={TH}>全年</th></tr></thead>
                <tbody>{Object.keys(d.monthly).sort().reverse().map((y) => (
                  <tr key={y} className="border-t border-[#0f1b29]">
                    <td className="px-2 py-0.5 text-slate-300">{y}</td>
                    {d.monthly[y].map((v, i) => <td key={i} className={TD} style={{ background: heat(v, 8), color: v == null ? "#475569" : "#e2e8f0" }}>{v == null ? "" : v.toFixed(1)}</td>)}
                    <td className={`${TD} font-semibold`} style={{ color: toneOf(d.yearRet[y]) }}>{f2(d.yearRet[y], 1)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-2">
              <div className="bg-[#03070c]"><SectionHead title="回撤曲线（近两年，%）" /><Lines series={[{ name: "回撤", color: "#1fbf75", values: d.ddTail }]} xLabels={d.xTail} height={160} fmt={(v) => v.toFixed(1)} zero /></div>
              <div className="bg-[#03070c]"><SectionHead title="60 日滚动年化波动（近两年，%）" /><Lines series={[{ name: "波动", color: "#f5b942", values: d.volTail }]} xLabels={d.xTail} height={160} fmt={(v) => v.toFixed(1)} /></div>
            </div>

            <SectionHead title="日收益分布"  />
            <Kpis items={[
              ["上涨日占比", f2(d.up, 1, "%")], ["偏度", f2(d.skew, 2)], ["超额峰度", f2(d.kurt, 2)],
              ["最好交易日", <span key="b" style={{ color: "#f2495c" }}>{sgn(d.best.v)} · {d.best.d}</span>],
              ["最差交易日", <span key="w" style={{ color: "#1fbf75" }}>{sgn(d.worst.v)} · {d.worst.d}</span>],
            ]} />
            <Bars data={d.hist} fmt={(v) => v.toFixed(0)} height={130}/>
          </>}
        </div>
      </div>
    </PanelShell>
  );
}

export default IdxIN;
