/**
 * 固定收益中心（/fixed-income）：收益率曲线（美债 + 欧元区，可对比历史）· 利差走势 · 收益率变动热力 · 国债期货与债券 ETF · 机构持仓 · 债市新闻与日历。
 */
import { useState } from "react";
import { DOWN, UP, toneOf, usePolled } from "@/uc/market/live";
import { FeedList, SectionHead, Seg, useFeed } from "@/uc/news/kit";
import EconCalendar from "@/uc/news/EconCalendar";
import { HubShell, LiveBoard, Lines, type BoardRow } from "./kit";
import { CotView } from "./FxTerminal";

type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }>; eu: Array<{ tenor: string; value: number }>; euDate: string | null; spreads: Array<{ date: string; s2s10: number | null; s3m10: number | null; s5s30: number | null; y10: number | null; y2: number | null }> };
const FUNCS: Array<[string, string, string]> = [["curve", "GC", "收益率曲线"], ["spread", "CRVS", "利差走势"], ["heat", "YCRV", "曲线变动热力"], ["market", "WB", "国债期货与ETF"], ["cot", "COT", "机构持仓"], ["news", "BN", "债市新闻与日历"]];
const COMPARE: Array<[string, string, number]> = [["1d", "前一日", 1], ["1w", "一周前", 5], ["1m", "一月前", 21], ["3m", "三月前", 63], ["1y", "一年前", 250]];
const BOARD: BoardRow[] = [
  ...["^IRX", "^FVX", "^TNX", "^TYX", "^MOVE"].map((s) => ({ symbol: s, group: "美债收益率与波动率" })),
  ...["ZT", "ZF", "ZN", "ZB", "UB"].map((s) => ({ symbol: s, group: "国债期货" })),
  ...[["SHY", "1-3年美债ETF"], ["IEF", "7-10年美债ETF"], ["TLT", "20年以上美债ETF"], ["TIP", "通胀保值债ETF"], ["BND", "全市场债券ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "利率债 ETF" })),
  ...[["LQD", "投资级公司债ETF"], ["HYG", "高收益债ETF"], ["JNK", "高收益债ETF（二）"], ["EMB", "新兴市场美元债ETF"], ["MUB", "市政债ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "信用债 ETF" })),
];

function CurveChart({ now, then, eu, thenLabel }: { now: Curves["us"][number] | undefined; then: Curves["us"][number] | undefined; eu: Curves["eu"]; thenLabel: string }) {
  if (!now) return <div className="px-3 py-8 text-[11px] text-slate-500">读取中…</div>;
  const tenors = now.points.map((p) => p.tenor);
  const all = [...now.points.map((p) => p.value), ...(then?.points.map((p) => p.value) ?? []), ...eu.map((p) => p.value)];
  const lo = Math.min(...all) - 0.15;
  const hi = Math.max(...all) + 0.15;
  const W = 760, H = 260, L = 38;
  const x = (t: string) => L + (tenors.indexOf(t) / Math.max(1, tenors.length - 1)) * (W - L - 10);
  const y = (v: number) => 10 + ((hi - v) / (hi - lo)) * (H - 34);
  const line = (pts: Array<{ tenor: string; value: number }>) => pts.filter((p) => tenors.includes(p.tenor)).map((p) => `${x(p.tenor)},${y(p.value)}`).join(" ");
  return (
    <div>
      <div className="flex gap-4 px-2 text-[10px]"><span className="text-sky-300">━ 美债 {now.date}</span>{then && <span className="text-slate-400">┅ 美债 {thenLabel}（{then.date}）</span>}{eu.length > 0 && <span className="text-amber-300">━ 欧元区 AAA</span>}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => { const v = lo + (hi - lo) * f; return <g key={f}><line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#132233" /><text x={2} y={y(v) + 3} fontSize={10} fill="#5f7891">{v.toFixed(2)}%</text></g>; })}
        {then && <polyline points={line(then.points)} fill="none" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.2} />}
        {eu.length > 0 && <polyline points={line(eu)} fill="none" stroke="#fbbf24" strokeWidth={1.5} />}
        <polyline points={line(now.points)} fill="none" stroke="#38bdf8" strokeWidth={2} />
        {now.points.map((p) => <g key={p.tenor}><circle cx={x(p.tenor)} cy={y(p.value)} r={2.5} fill="#38bdf8" /><text x={x(p.tenor)} y={y(p.value) - 6} fontSize={9} textAnchor="middle" fill="#e2e8f0">{p.value.toFixed(2)}</text><text x={x(p.tenor)} y={H - 6} fontSize={10} textAnchor="middle" fill="#7d93a8">{p.tenor}</text></g>)}
      </svg>
    </div>
  );
}

function CurveView({ data }: { data: Curves | null }) {
  const [cmp, setCmp] = useState("1m");
  const now = data?.us[0];
  const idx = COMPARE.find(([k]) => k === cmp)?.[2] ?? 21;
  const then = data?.us[Math.min(idx, (data?.us.length ?? 1) - 1)];
  return (
    <div>
      <SectionHead title="收益率曲线" right={<Seg value={cmp} onChange={setCmp} options={COMPARE.map(([k, l]) => [k, l] as [string, string])} />} />
      <CurveChart now={now} then={then} eu={data?.eu ?? []} thenLabel={COMPARE.find(([k]) => k === cmp)?.[1] ?? ""} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">美债</th><th className="text-right">较{COMPARE.find(([k]) => k === cmp)?.[1]}</th><th className="text-right">欧元区 AAA</th><th className="px-2 text-right">美欧利差</th></tr></thead>
        <tbody>
          {now?.points.map((p) => {
            const old = then?.points.find((q) => q.tenor === p.tenor)?.value;
            const eu = data?.eu.find((q) => q.tenor === p.tenor)?.value;
            const d = old != null ? Math.round((p.value - old) * 100) : null;
            return <tr key={p.tenor} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-200">{p.tenor}</td><td className="text-right font-mono text-white">{p.value.toFixed(2)}%</td><td className="text-right font-mono" style={{ color: toneOf(d) }}>{d == null ? "—" : `${d > 0 ? "+" : ""}${d}bp`}</td><td className="text-right font-mono text-amber-200">{eu == null ? "—" : `${eu.toFixed(2)}%`}</td><td className="px-2 text-right font-mono text-slate-300">{eu == null ? "—" : `${Math.round((p.value - eu) * 100)}bp`}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpreadView({ data }: { data: Curves | null }) {
  const [range, setRange] = useState("250");
  const s = (data?.spreads ?? []).slice(-Number(range));
  const last = s[s.length - 1];
  return (
    <div>
      <SectionHead title="期限利差（bp）" sub={last ? `最新 ${last.date}：2s10s ${last.s2s10}bp · 3m10y ${last.s3m10}bp · 5s30s ${last.s5s30}bp` : undefined} right={<Seg value={range} onChange={setRange} options={[["21", "1月"], ["63", "3月"], ["126", "半年"], ["250", "1年"]]} />} />
      <Lines zero series={[{ name: "2s10s", color: "#38bdf8", values: s.map((x) => x.s2s10) }, { name: "3m10y", color: "#f472b6", values: s.map((x) => x.s3m10) }, { name: "5s30s", color: "#fbbf24", values: s.map((x) => x.s5s30) }]} xLabels={s.map((x) => x.date.slice(5))} fmt={(v) => `${v.toFixed(0)}`} height={220} />
      <SectionHead title="2年 / 10年收益率（%）" />
      <Lines series={[{ name: "10年", color: "#38bdf8", values: s.map((x) => x.y10) }, { name: "2年", color: "#a78bfa", values: s.map((x) => x.y2) }]} xLabels={s.map((x) => x.date.slice(5))} height={200} />
      <div className="px-2 py-1 text-[10px] text-slate-500">利差为负（曲线倒挂）通常被视为经济衰退的领先信号；倒挂解除、曲线陡峭化往往出现在降息周期。</div>
    </div>
  );
}

function HeatView({ data }: { data: Curves | null }) {
  const now = data?.us[0];
  const cols = COMPARE;
  const max = 60;
  return (
    <div>
      <SectionHead title="收益率变动热力（bp）" sub="红：收益率上行（债价下跌）；绿：收益率下行" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">当前</th>{cols.map(([k, l]) => <th key={k} className="text-center">{l}</th>)}</tr></thead>
        <tbody>
          {now?.points.map((p) => (
            <tr key={p.tenor} className="border-t border-[#0f1b29]">
              <td className="px-2 py-1 text-slate-200">{p.tenor}</td>
              <td className="text-right font-mono text-white">{p.value.toFixed(2)}</td>
              {cols.map(([k, , i]) => {
                const old = data?.us[Math.min(i, data.us.length - 1)]?.points.find((q) => q.tenor === p.tenor)?.value;
                const d = old != null ? Math.round((p.value - old) * 100) : null;
                const a = d == null ? 0 : Math.min(1, Math.abs(d) / max);
                return <td key={k} className="text-center font-mono" style={{ background: d == null ? undefined : d > 0 ? `rgba(242,73,92,${0.12 + a * 0.6})` : `rgba(31,191,117,${0.12 + a * 0.6})`, color: "#f1f5f9" }}>{d == null ? "—" : `${d > 0 ? "+" : ""}${d}`}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BondTerminal() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "curve");
  const curves = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const feed = useFeed(func === "news" ? { cats: ["债券", "央行"], limit: 120, hours: 72 } : null);
  const d = curves.data;
  const s = d?.spreads[d.spreads.length - 1];
  return (
    <HubShell title="固定收益中心" code="FI" funcs={FUNCS} func={func} setFunc={setFunc} right={s ? <span>10Y <b className="font-mono text-white">{s.y10?.toFixed(2)}%</b> · 2s10s <b className="font-mono" style={{ color: (s.s2s10 ?? 0) < 0 ? DOWN : UP }}>{s.s2s10}bp</b></span> : null}>
      {func === "curve" && <CurveView data={d} />}
      {func === "spread" && <SpreadView data={d} />}
      {func === "heat" && <HeatView data={d} />}
      {func === "market" && <LiveBoard rows={BOARD} />}
      {func === "cot" && <CotView filter={(x) => ["ZT", "ZF", "ZN", "ZB", "TN", "SR3", "ZQ"].includes(x)} />}
      {func === "news" && (
        <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-2">
          <div className="min-w-0 bg-[#03070c]"><SectionHead title="债市与利率新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></div>
          <div className="min-w-0 bg-[#03070c]"><EconCalendar /></div>
        </div>
      )}
    </HubShell>
  );
}
