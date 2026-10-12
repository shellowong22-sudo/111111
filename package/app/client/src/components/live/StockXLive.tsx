/**
 * 股票小窗（全部真实数据，角度互不重复）：
 *  - MOST 最活跃证券：美股 / A 股 / 港股按成交额、成交量、涨跌幅、相对放量的全市场实时排行
 *  - ANR  分析师建议：美股个股的分析师评级分布、一致目标价与区间、相对现价空间、年度 / 季度每股收益一致预期与上下调家数
 *  - RV   相对估值：自选同业组的市盈率、市净率、市销率、净利率、营收与净利增速横向比较与组内分位
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks, ucGet } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, useHub } from "@/uc/hubs/kit";
import { f2, heat, sgn } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, INP, Note, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";

const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";

/* ================================================================== MOST 最活跃证券 */
type Row = { symbol: string; name: string; price: number | null; changePct: number | null; volume: number | null; amount: number | null; mcap: number | null; relVol: number | null };
export function MostLive({ onClose }: P) {
  const [mkt, setMkt] = useState<"us" | "cn" | "hk">("cn");
  const [list, setList] = useState("成交额最活跃");
  const d = usePolled<{ at: number; lists: Record<string, Row[]> }>("ucHubs.most", { market: mkt }, 60_000);
  const rows = d.data?.lists[list] ?? [];
  const ticks = useTicks(rows.slice(0, 30).map((r) => r.symbol));
  const { pick } = useHub();
  const all = Object.values(d.data?.lists ?? {}).flat();
  const top = d.data?.lists["成交额最活跃"] ?? [];
  const share = top.length ? top.slice(0, 10).reduce((s, r) => s + (r.amount ?? 0), 0) / Math.max(1, top.reduce((s, r) => s + (r.amount ?? 0), 0)) * 100 : null;
  const cur = mkt === "us" ? "美元" : mkt === "cn" ? "人民币" : "港元";
  return (
    <PanelShell code="MOST" title="最活跃证券" onClose={onClose} right={<Seg value={mkt} options={[["cn", "A 股"], ["hk", "港股"], ["us", "美股"]]} onChange={setMkt} />}>
      <Kpis items={[["榜单更新", d.data ? new Date(d.data.at).toLocaleTimeString("zh-CN", { hour12: false }) : "—"], ["成交额第一", top[0] ? `${top[0].name}` : "—", top[0] ? `${fmtCompact(top[0].amount)} ${cur}` : ""], ["前 10 占前 30 成交额", f2(share, 1, "%")], ["上榜去重证券数", String(new Set(all.map((r) => r.symbol)).size)]]} />
      <div className="px-2 py-1"><Seg value={list} options={Object.keys(d.data?.lists ?? { 成交额最活跃: [] }).map((k) => [k, k] as [string, string])} onChange={setList} /></div>
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>#</th><th className={THL}>代码</th><th className={THL}>名称</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>成交量</th><th className={TH}>成交额（{cur}）</th><th className={TH}>相对 10 日量</th><th className={TH}>总市值</th></tr></thead>
          <tbody>{rows.map((r, i) => { const t = ticks[r.symbol]; const pct = t?.changePct ?? r.changePct; return (
            <tr key={r.symbol} onClick={() => pick(r.symbol)} className={`${ROW} cursor-pointer`}>
              <td className={`${TDL} text-slate-500`}>{i + 1}</td><td className={`${TDL} font-mono text-cyan-200`}>{r.symbol}</td><td className={`${TDL} text-slate-100`}>{r.name}</td>
              <td className={`${TD} text-white`}>{fmtPrice(t?.price ?? r.price)}</td>
              <td className={TD} style={{ color: toneOf(pct), background: heat(pct, 10) }}>{fmtPct(pct)}</td>
              <td className={`${TD} text-slate-300`}>{fmtCompact(r.volume)}</td><td className={`${TD} text-slate-200`}>{fmtCompact(r.amount)}</td>
              <td className={TD} style={{ color: (r.relVol ?? 0) >= 2 ? "#fbbf24" : "#cbd5e1" }}>{r.relVol == null ? "—" : `${r.relVol.toFixed(2)} 倍`}</td>
              <td className={`${TD} text-slate-400`}>{fmtCompact(r.mcap)}</td>
            </tr>); })}{!rows.length && <tr><td colSpan={9}><Empty loading={d.loading} text="榜单暂不可用" /></td></tr>}</tbody>
        </table>
      </div>
      <Note>全市场扫描，每分钟刷新；涨跌幅榜只统计当日成交额达到一定规模的证券，避免低流动性个股干扰。相对放量 ≥ 2 倍（黄色）为显著放量。点击行打开 K 线。</Note>
    </PanelShell>
  );
}

/* ================================================================== ANR 分析师建议 */
type Anr = { symbol: string; target: number | null; high: number | null; low: number | null; buy: number | null; hold: number | null; sell: number | null; meanRating: string | null; brokers: string[]; yearly: Array<{ period: string; eps: number | null; hi: number | null; lo: number | null; count: number | null; up: number | null; down: number | null }>; quarterly: Array<{ period: string; eps: number | null; hi: number | null; lo: number | null; count: number | null; up: number | null; down: number | null }> };
const RATING_ZH: Record<string, string> = { "Strong Buy": "强烈买入", Buy: "买入", Hold: "持有", Sell: "卖出", "Strong Sell": "强烈卖出" };
const ANR_QUICK = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD", "JPM", "BABA"];
export function AnrLive({ onClose }: P) {
  const [sym, setSym] = useState("NVDA");
  const [input, setInput] = useState("NVDA");
  const a = usePolled<Anr>("ucHubs.analyst", { symbol: sym }, 3600_000);
  const t = useTicks([sym]);
  const [cmp, setCmp] = useState<Array<Anr & { px: number | null }>>([]);
  const cmpTicks = useTicks(ANR_QUICK);
  useEffect(() => {
    let live = true;
    void Promise.all(ANR_QUICK.map((s) => ucGet<Anr>("ucHubs.analyst", { symbol: s }).catch(() => null))).then((rs) => { if (live) setCmp(rs.filter((x): x is Anr => !!x).map((x) => ({ ...x, px: null }))); });
    return () => { live = false; };
  }, []);
  const d = a.data;
  const px = t[sym]?.price ?? null;
  const up = d?.target != null && px ? (d.target / px - 1) * 100 : null;
  const total = (d?.buy ?? 0) + (d?.hold ?? 0) + (d?.sell ?? 0);
  return (
    <PanelShell code="ANR" title="分析师建议" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]">
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) setSym(input.trim().toUpperCase()); }}><input value={input} onChange={(e) => setInput(e.target.value)} className={`${INP} w-20`} placeholder="美股代码" /></form>
        {ANR_QUICK.map((q) => <button type="button" key={q} onClick={() => { setSym(q); setInput(q); }} className={`border px-1.5 py-0.5 text-[10px] ${sym === q ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-500"}`}>{q}</button>)}
      </div>
      {!d || d.target == null && !d.yearly.length ? <Empty loading={a.loading} text="该证券暂无分析师覆盖数据（仅支持美股）" /> : (
        <>
          <Kpis items={[["现价（实时）", fmtPrice(px), fmtPct(t[sym]?.changePct)], ["一致目标价", fmtPrice(d.target), `区间 ${fmtPrice(d.low)} ~ ${fmtPrice(d.high)}`], ["相对现价空间", <span style={{ color: toneOf(up) }}>{sgn(up)}</span>], ["平均评级", RATING_ZH[d.meanRating ?? ""] ?? d.meanRating ?? "—"], ["覆盖机构", `${total || d.brokers.length} 家`]]} />
          <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
            <div className="bg-[#03070c]">
              <SectionHead title="评级分布" />
              <div className="px-3 py-2">
                <div className="flex h-5 w-full overflow-hidden">{([["买入", d.buy, "#f2495c"], ["持有", d.hold, "#94a3b8"], ["卖出", d.sell, "#1fbf75"]] as Array<[string, number | null, string]>).map(([l, v, c]) => <div key={l} style={{ width: `${total ? ((v ?? 0) / total) * 100 : 0}%`, background: c }} className="text-center text-[10px] leading-5 text-black">{v ? `${l} ${v}` : ""}</div>)}</div>
              </div>
              <SectionHead title="目标价区间与现价" />
              <div className="px-3 py-3">
                {d.low != null && d.high != null && d.high > d.low && <div className="relative h-6">
                  <div className="absolute top-2.5 h-1 w-full bg-[#1d3047]" />
                  {([["最低", d.low, "#1fbf75"], ["一致", d.target, "#38bdf8"], ["最高", d.high, "#f2495c"], ["现价", px, "#fbbf24"]] as Array<[string, number | null, string]>).filter((x) => x[1] != null).map(([l, v, c]) => { const f = Math.min(1, Math.max(0, (v! - Math.min(d.low!, px ?? d.low!)) / (Math.max(d.high!, px ?? d.high!) - Math.min(d.low!, px ?? d.low!)))); return <div key={l} className="absolute -translate-x-1/2 text-center text-[9px]" style={{ left: `${f * 100}%`, color: c }}><div className="mx-auto h-4 w-1" style={{ background: c }} />{l} {v!.toFixed(1)}</div>; })}
                </div>}
              </div>
              <SectionHead title="覆盖机构" />
              <div className="flex flex-wrap gap-1 px-2 pb-2 text-[10px] text-slate-400">{d.brokers.map((b) => <span key={b} className="border border-[#1d3047] px-1">{b}</span>)}</div>
            </div>
            <div className="bg-[#03070c]">
              <SectionHead title="每股收益一致预期" sub="上调 / 下调为近期调整预测的机构数" />
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-slate-500"><tr><th className={THL}>财年 / 季度</th><th className={TH}>一致预期</th><th className={TH}>最高</th><th className={TH}>最低</th><th className={TH}>机构数</th><th className={TH}>上调</th><th className={TH}>下调</th></tr></thead>
                <tbody>{[...d.yearly.map((r) => ({ ...r, k: "年" })), ...d.quarterly.map((r) => ({ ...r, k: "季" }))].map((r) => <tr key={r.k + r.period} className={ROW}><td className={`${TDL} text-slate-200`}>{r.period}（{r.k}）</td><td className={`${TD} text-white`}>{f2(r.eps)}</td><td className={`${TD} text-slate-400`}>{f2(r.hi)}</td><td className={`${TD} text-slate-400`}>{f2(r.lo)}</td><td className={`${TD} text-slate-300`}>{r.count ?? "—"}</td><td className={TD} style={{ color: "#f2495c" }}>{r.up ?? "—"}</td><td className={TD} style={{ color: "#1fbf75" }}>{r.down ?? "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <SectionHead title="大型科技与权重股：目标价空间对比" />
          <Bars data={cmp.filter((x) => x.target != null && cmpTicks[x.symbol]?.price).map((x) => ({ k: x.symbol, v: (x.target! / cmpTicks[x.symbol]!.price - 1) * 100 })).sort((a2, b2) => b2.v - a2.v)} fmt={(v) => `${v.toFixed(1)}%`} height={120} />
          <Note>一致目标价、评级与盈利预测为覆盖该股的卖方机构汇总，每 6 小时刷新并逐日入库；目标价空间以实时价格计算。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== RV 相对估值 */
type Prof = { symbol: string; name: string | null; industry: string | null; sector: string | null; metrics: Array<{ key: string; label: string; value: number | null; unit?: string }> };
const RV_KEYS: Array<[string, string, boolean]> = [["pe", "市盈率", false], ["pb", "市净率", false], ["ps", "市销率", false], ["margin", "净利率", true], ["revYoY", "营收同比", true], ["niYoY", "净利同比", true], ["mcap", "总市值", true]];
const RV_DEFAULT: Record<string, string[]> = { "美股半导体": ["NVDA", "AMD", "AVGO", "INTC", "QCOM", "TXN", "MU"], "A股白酒": ["sh600519", "sz000858", "sz000568", "sh600809", "sz002304"], "港股互联网": ["0700.HK", "9988.HK", "3690.HK", "1810.HK", "9618.HK"] };
export function RvLive({ onClose }: P) {
  const saved = useSaved<{ groups: Record<string, string[]> }>("rv-groups");
  const [groups, setGroups] = useState<Record<string, string[]>>(RV_DEFAULT);
  const [g, setG] = useState("美股半导体");
  const [add, setAdd] = useState("");
  const [profs, setProfs] = useState<Record<string, Prof | null>>({});
  useEffect(() => { if (saved.data?.groups) setGroups(saved.data.groups); }, [saved.data]);
  const list = groups[g] ?? [];
  const ticks = useTicks(list);
  const { pick } = useHub();
  useEffect(() => {
    let live = true;
    void Promise.all(list.map((s) => ucGet<Prof>("ucMarket.profile", { symbol: s }).then((p) => [s, p] as const).catch(() => [s, null] as const))).then((r) => { if (live) setProfs((o) => ({ ...o, ...Object.fromEntries(r) })); });
    return () => { live = false; };
  }, [list.join("|")]);
  const persist = (next: Record<string, string[]>) => { setGroups(next); void saveItem("rv-groups", { groups: next }).catch(() => toast.error("保存失败")); };
  const mv = (s: string, k: string) => profs[s]?.metrics.find((m) => m.key === k)?.value ?? null;
  const stats = useMemo(() => Object.fromEntries(RV_KEYS.map(([k]) => { const v = list.map((s) => mv(s, k)).filter((x): x is number => x != null && Number.isFinite(x) && (k === "pe" ? x > 0 : true)).sort((a, b) => a - b); return [k, { med: v.length ? v[Math.floor(v.length / 2)] : null, all: v }]; })), [profs, list.join("|")]);
  const pct = (k: string, x: number | null) => { const a = stats[k]?.all ?? []; return x == null || !a.length ? null : (a.filter((y) => y <= x).length / a.length) * 100; };
  return (
    <PanelShell code="RV" title="相对估值" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <Seg value={g} options={Object.keys(groups).map((k) => [k, k] as [string, string])} onChange={setG} />
        <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="加入代码，如 TSM / sh601318 / 0005.HK" className={`${INP} w-56`} />
        <button type="button" className={BTN} onClick={() => { const s = add.trim(); if (!s) return; const v = /^(sh|sz|bj)\d{6}$/i.test(s) ? s.toLowerCase() : s.toUpperCase(); if (list.includes(v)) return; persist({ ...groups, [g]: [...list, v].slice(0, 15) }); setAdd(""); }}>加入本组</button>
        <button type="button" className={BTN} onClick={() => { const n =`自建组 ${Object.keys(groups).length + 1}`; persist({ ...groups, [n]: [] }); setG(n); }}>新建组</button>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>代码</th><th className={THL}>名称</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th>{RV_KEYS.map(([k, l]) => <th key={k} className={TH}>{l}</th>)}<th className={TH}>估值分位（市盈率）</th><th className={TH} /></tr></thead>
          <tbody>{list.map((s) => { const t = ticks[s]; return (
            <tr key={s} className={ROW}>
              <td className={`${TDL} cursor-pointer font-mono text-cyan-200 hover:underline`} onClick={() => pick(s)}>{s}</td>
              <td className={`${TDL} text-slate-100`}>{profs[s]?.name ?? t?.name ?? "—"}</td>
              <td className={`${TD} text-white`}>{fmtPrice(t?.price)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
              {RV_KEYS.map(([k, , pctUnit]) => { const v = mv(s, k); const med = stats[k]?.med; const rel = v != null && med ? (v / med - 1) : null; return <td key={k} className={TD} style={{ background: k === "mcap" || rel == null ? undefined : heat(k === "pe" || k === "pb" || k === "ps" ? -rel : rel, 1) }}>{v == null ? "—" : k === "mcap" ? fmtCompact(v) : pctUnit ? `${v.toFixed(1)}%` : v.toFixed(2)}</td>; })}
              <td className={`${TD} text-slate-300`}>{f2(pct("pe", mv(s, "pe")), 0, "%")}</td>
              <td className={TD}><button type="button" className="text-[10px] text-slate-500 hover:text-rose-300" onClick={() => persist({ ...groups, [g]: list.filter((x) => x !== s) })}>移除</button></td>
            </tr>); })}
            <tr className="border-t border-[#1d3047] bg-[#07111c]"><td className={`${TDL} text-amber-300`} colSpan={4}>组内中位数</td>{RV_KEYS.map(([k, , pu]) => <td key={k} className={`${TD} text-amber-200`}>{stats[k]?.med == null ? "—" : k === "mcap" ? fmtCompact(stats[k].med) : pu ? `${stats[k].med!.toFixed(1)}%` : stats[k].med!.toFixed(2)}</td>)}<td colSpan={2} /></tr>
          </tbody>
        </table>
      </div>
      <SectionHead title="市盈率相对组内中位数" />
      <Bars data={list.map((s) => ({ k: s, v: mv(s, "pe") != null && stats.pe?.med ? (mv(s, "pe")! / stats.pe.med! - 1) * 100 : 0 }))} fmt={(v) => `${v.toFixed(1)}%`} height={120} />
      <Note>估值与财务指标为各证券最新公布数据；底色以组内中位数为基准——估值倍数低于中位数、盈利与增长高于中位数显示为红色（相对有利）。同业组与成员永久保存在你的个人账户。</Note>
    </PanelShell>
  );
}
