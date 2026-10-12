/**
 *  - RealEstateDesk（/real-estate）：房地产信托与地产股看板 · 按揭利率（周度，2000 年至今）· 住房物价与建筑就业 · 地产板块表现 · 地产新闻
 *  - ConvertibleDesk（/ovcv）：A股可转债全市场（实时价格 / 正股 / 转股价值 / 溢价率 / 双低）· 强赎与回售临近 · 单券估值
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled } from "@/uc/market/live";
import { FeedList, SectionHead, Seg, useFeed } from "@/uc/news/kit";
import { Bars, HubShell, LiveBoard, Lines, useHub, type BoardRow } from "./kit";
import { VirtualRows } from "@/uc/panels/kit";
import { f2, gbs, heat, perf, sgn, useCloses } from "./calc";

type Housing = { pmms: Array<{ d: string; m30: number | null; m15: number | null }>; bls: Array<{ id: string; name: string; points: Array<{ d: string; v: number }> }> };
const RE_BOARD: BoardRow[] = [
  ...[["VNQ", "美国房地产信托 ETF"], ["IYR", "美国地产 ETF"], ["REM", "按揭信托 ETF"], ["VNQI", "海外房地产信托 ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "地产 ETF" })),
  ...[["PLD", "安博（物流仓储）"], ["AMT", "美国电塔"], ["EQIX", "易昆尼克斯（数据中心）"], ["WELL", "Welltower（医疗养老）"], ["SPG", "西蒙地产（商场）"], ["O", "Realty Income（零售净租赁）"], ["PSA", "Public Storage（自助仓储）"], ["AVB", "AvalonBay（公寓）"], ["BXP", "BXP（写字楼）"]].map(([s, l]) => ({ symbol: s, label: l, group: "美国房地产信托" })),
  ...[["ITB", "住宅建筑 ETF"], ["XHB", "家居建筑 ETF"], ["DHI", "霍顿房屋"], ["LEN", "莱纳建筑"], ["NVR", "NVR"]].map(([s, l]) => ({ symbol: s, label: l, group: "住宅建筑商" })),
  ...[["0016.HK", "新鸿基地产"], ["1113.HK", "长实集团"], ["0688.HK", "中国海外发展"], ["1109.HK", "华润置地"], ["0823.HK", "领展房产基金"], ["sz000002", "万科A"], ["sh600048", "保利发展"], ["sh600383", "金地集团"], ["sh512200", "房地产 ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "港股与A股地产" })),
];
const SEGS: Array<[string, string]> = [["PLD", "物流仓储"], ["EQIX", "数据中心"], ["AMT", "通信铁塔"], ["WELL", "医疗养老"], ["PSA", "自助仓储"], ["AVB", "公寓"], ["O", "零售净租赁"], ["SPG", "购物中心"], ["BXP", "写字楼"], ["ITB", "住宅建筑"], ["REM", "按揭信托"]];

export function RealEstateDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "board");
  const h = usePolled<Housing>("ucHubs.housing", ["mort", "macro"].includes(func) ? {} : null, 6 * 3600_000);
  const pack = useCloses(SEGS.map(([s]) => s), 400);
  const feed = useFeed(func === "news" ? { cats: ["地产"], limit: 150, hours: 96 } : null);
  const [range, setRange] = useState("260");
  const pm = (h.data?.pmms ?? []).slice(-Number(range));
  const last = h.data?.pmms[h.data.pmms.length - 1];
  const yago = h.data?.pmms[h.data.pmms.length - 53];
  return (
    <HubShell title="房地产市场" code="REIT" func={func} setFunc={setFunc}
      funcs={[["board", "REBD", "地产看板"], ["seg", "RESG", "细分业态表现"], ["mort", "MTGE", "按揭利率"], ["macro", "HSNG", "住房物价与就业"], ["news", "REN", "地产新闻"]]}
      right={last ? <span>30 年按揭 <b className="font-mono text-white">{last.m30?.toFixed(2)}%</b>（{last.d}）</span> : null}>
      {func === "board" && <LiveBoard rows={RE_BOARD} />}
      {func === "seg" && (
        <div>
          <SectionHead title="美国地产细分业态区间表现（以代表性龙头 / ETF 计）" sub={pack.loading && !pack.data ? "读取日线…" : undefined} />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">业态</th><th className="text-left">代表</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">6月</th><th className="px-2 text-right">1年</th></tr></thead>
            <tbody>{SEGS.map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); return <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{l}</td><td className="font-mono text-slate-400">{s}</td>{[[21, 8], [63, 15], [126, 25], [252, 35]].map(([n, sc]) => { const v = perf(c, n); return <td key={n} className="text-right font-mono last:px-2" style={{ background: heat(v, sc), color: "#f1f5f9" }}>{sgn(v, 1)}</td>; })}</tr>; })}</tbody>
          </table>
          <Bars data={SEGS.map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); return { k: l, v: perf(c, 63) ?? 0, v2: perf(c, 252) ?? 0 }; })} label={["3 个月", "1 年"]} fmt={(v) => `${v.toFixed(1)}%`} height={150} />
        </div>
      )}
      {func === "mort" && (
        <div>
          <SectionHead title="美国按揭利率（周度，%）" sub={last ? `最新 ${last.d}：30 年 ${f2(last.m30)}% · 15 年 ${f2(last.m15)}% · 一年前 30 年 ${f2(yago?.m30)}%` : "读取中…"} right={<Seg value={range} onChange={setRange} options={[["52", "1年"], ["260", "5年"], ["520", "10年"], ["1400", "全部"]]} />} />
          <Lines series={[{ name: "30 年固定", color: "#38bdf8", values: pm.map((p) => p.m30) }, { name: "15 年固定", color: "#fbbf24", values: pm.map((p) => p.m15) }]} xLabels={pm.map((p) => p.d.slice(0, 7))} height={260} />
          <SectionHead title="近 12 周" />
          <table className="w-full text-[11px]"><tbody>{(h.data?.pmms ?? []).slice(-12).reverse().map((p, i, a) => <tr key={p.d} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-300">{p.d}</td><td className="text-right font-mono text-white">{f2(p.m30)}%</td><td className="text-right font-mono" style={{ color: toneOf(a[i + 1] && p.m30 != null && a[i + 1].m30 != null ? p.m30 - a[i + 1].m30! : null) }}>{a[i + 1] && p.m30 != null && a[i + 1].m30 != null ? `${p.m30 - a[i + 1].m30! > 0 ? "+" : ""}${Math.round((p.m30 - a[i + 1].m30!) * 100)}bp` : ""}</td><td className="px-2 text-right font-mono text-slate-400">{f2(p.m15)}%</td></tr>)}</tbody></table>
        </div>
      )}
      {func === "macro" && (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          {(h.data?.bls ?? []).map((s) => {
            const isIdx = s.id.startsWith("CUUR");
            const yoy = isIdx ? s.points.map((p, i) => (i >= 12 ? ((p.v / s.points[i - 12].v) - 1) * 100 : null)) : null;
            const lastP = s.points[s.points.length - 1];
            return (
              <div key={s.id} className="bg-[#03070c]">
                <div className="flex items-baseline gap-2 px-2 pt-1 text-[11px]"><b className="text-white">{s.name}</b><span className="text-[10px] text-slate-500">{lastP?.d}</span><span className="ml-auto font-mono text-white">{isIdx ? `同比 ${f2(yoy?.[yoy.length - 1] ?? null, 2, "%")}` : fmtCompact(lastP?.v)}</span></div>
                <Lines series={[{ name: isIdx ? "同比 %" : "千人", color: isIdx ? "#f472b6" : "#38bdf8", values: isIdx ? yoy!.slice(12) : s.points.map((p) => p.v) }]} xLabels={(isIdx ? s.points.slice(12) : s.points).map((p) => p.d.slice(2))} height={150} />
              </div>
            );
          })}
          {!h.data && <div className="bg-[#03070c] px-3 py-6 text-[11px] text-slate-500">读取中…</div>}
        </div>
      )}
      {func === "news" && <><SectionHead title="房地产新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </HubShell>
  );
}

/* ================================================================== 可转债 */
type Cb = { code: string; name: string; stock: string; stockName: string; convPrice: number; rating: string | null; expire: string; listing: string | null; scale: number | null; price: number | null; changePct: number | null; amount: number | null; stockPrice: number | null; stockChg: number | null; convValue: number | null; premium: number | null; doubleLow: number | null; years: number; nearRedeem: boolean; nearResale: boolean };
function cbValue(cb: Cb, vol: number, r: number) {
  // 债底（按 3% 信用贴现、到期按面值 + 末期补偿约 10% 估算） + 转股期权（以转股价为行权价的看涨期权 × 转换比例）
  if (!cb.stockPrice) return null;
  const T = Math.max(0.05, cb.years);
  const bondFloor = 110 / Math.pow(1 + r + 0.03, T);
  const ratio = 100 / cb.convPrice;
  const call = gbs("C", cb.stockPrice, cb.convPrice, T, r, r, vol).price * ratio;
  return { bondFloor, option: call, fair: bondFloor + call };
}
export function ConvertibleDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "list");
  const d = usePolled<{ at: number; rows: Cb[] }>("ucHubs.convertibles", {}, 20_000);
  const rows = d.data?.rows ?? [];
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof Cb>("doubleLow");
  const [asc, setAsc] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [vol, setVol] = useState(35);
  const { pick } = useHub();
  const listed = rows.filter((r) => r.price != null);
  const filtered = listed.filter((r) => !q || r.name.includes(q) || r.code.includes(q) || r.stockName.includes(q));
  const sorted = [...filtered].sort((a, b) => { const x = (a[sort] as number | null) ?? (asc ? 1e9 : -1e9), y = (b[sort] as number | null) ?? (asc ? 1e9 : -1e9); return asc ? x - y : y - x; });
  const th = (k: keyof Cb, l: string) => <th className="cursor-pointer text-right hover:text-white" onClick={() => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(true); } }}>{l}{sort === k ? (asc ? " ▲" : " ▼") : ""}</th>;
  const stats = useMemo(() => {
    const p = listed.map((r) => r.price!).sort((a, b) => a - b);
    const pr = listed.map((r) => r.premium).filter((x): x is number => x != null).sort((a, b) => a - b);
    const med = (a: number[]) => (a.length ? a[Math.floor(a.length / 2)] : null);
    return { n: listed.length, pending: rows.length - listed.length, medPrice: med(p), medPrem: med(pr), up: listed.filter((r) => (r.changePct ?? 0) > 0).length, down: listed.filter((r) => (r.changePct ?? 0) < 0).length, amount: listed.reduce((s, r) => s + (r.amount ?? 0), 0), below100: listed.filter((r) => r.price! < 100).length };
  }, [rows]);
  const cur = rows.find((r) => r.code === sel) ?? sorted[0];
  const val = cur ? cbValue(cur, vol / 100, 0.018) : null;
  const buckets = [[0, 100], [100, 110], [110, 120], [120, 130], [130, 150], [150, 1e9]].map(([a, b]) => ({ k: b > 1e8 ? `${a}+` : `${a}-${b}`, v: listed.filter((r) => r.price! >= a && r.price! < b).length }));
  return (
    <HubShell title="可转债" code="OVCV" func={func} setFunc={setFunc}
      funcs={[["list", "CBLS", "全市场行情"], ["dist", "CBST", "市场分布"], ["clause", "CBCL", "强赎 / 回售临近"], ["value", "CBVL", "单券估值"], ["news", "CBN", "转债新闻"]]}
      right={<span>{stats.n} 只在交易 · 中位价 <b className="font-mono text-white">{f2(stats.medPrice, 2)}</b> · 中位溢价 <b className="font-mono text-white">{f2(stats.medPrem, 1, "%")}</b> · 涨 <b style={{ color: "#f2495c" }}>{stats.up}</b> 跌 <b style={{ color: "#1fbf75" }}>{stats.down}</b></span>}>
      {func === "list" && (
        <div>
          <div className="flex items-center gap-2 px-2 py-1"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="代码 / 转债 / 正股" className="w-48 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" /><span className="text-[10px] text-slate-500">{d.loading && !d.data ? "读取全市场转债…" : `${sorted.length} 只 · 每 20 秒刷新 · 双低 = 价格 + 溢价率`}</span></div>
          <div className="overflow-x-auto"><div className="min-w-[1080px]">
            <VirtualRows rows={sorted} height={620} rowH={23} header={<thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">转债</th><th className="text-left">正股</th>{th("price", "价格")}{th("changePct", "涨跌幅")}{th("stockPrice", "正股价")}{th("stockChg", "正股涨跌")}{th("convPrice", "转股价")}{th("convValue", "转股价值")}{th("premium", "溢价率")}{th("doubleLow", "双低")}<th className="text-center">评级</th>{th("years", "剩余年限")}{th("scale", "规模(亿)")}{th("amount", "成交额")}</tr></thead>} render={(r) => (
                  <tr key={r.code} onClick={() => { setSel(r.code); pick(r.code); }} className={`cursor-pointer border-t border-[#0f1b29] ${cur?.code === r.code ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                    <td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.code.slice(2)}</span>{r.nearRedeem && <span className="ml-1 text-[9px] text-red-300">强赎区</span>}{r.nearResale && <span className="ml-1 text-[9px] text-emerald-300">回售区</span>}</td>
                    <td className="text-slate-400">{r.stockName}</td>
                    <td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPrice(r.price, 3)}</td>
                    <td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td>
                    <td className="text-right font-mono text-slate-300">{fmtPrice(r.stockPrice)}</td>
                    <td className="text-right font-mono" style={{ color: toneOf(r.stockChg) }}>{fmtPct(r.stockChg)}</td>
                    <td className="text-right font-mono text-slate-400">{r.convPrice.toFixed(2)}</td>
                    <td className="text-right font-mono text-slate-200">{f2(r.convValue, 2)}</td>
                    <td className="text-right font-mono" style={{ background: heat(r.premium != null ? -r.premium : null, 60) }}>{f2(r.premium, 2, "%")}</td>
                    <td className="text-right font-mono text-amber-200">{f2(r.doubleLow, 1)}</td>
                    <td className="text-center text-slate-400">{r.rating ?? "—"}</td>
                    <td className="text-right font-mono text-slate-400">{r.years.toFixed(2)}</td>
                    <td className="text-right font-mono text-slate-400">{f2(r.scale, 2)}</td>
                    <td className="px-2 text-right font-mono text-slate-400">{fmtCompact(r.amount)}</td>
                  </tr>
                )} />
          </div></div>
        </div>
      )}
      {func === "dist" && (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="价格分布（只）" sub={`低于面值 ${stats.below100} 只`} /><Bars data={buckets} fmt={(v) => v.toFixed(0)} height={170} /></div>
          <div className="bg-[#03070c]"><SectionHead title="溢价率分布（只）" /><Bars data={[[-1e9, 0], [0, 10], [10, 20], [20, 40], [40, 80], [80, 1e9]].map(([a, b]) => ({ k: a < -1e8 ? "<0%" : b > 1e8 ? `${a}%+` : `${a}-${b}%`, v: listed.filter((r) => r.premium != null && r.premium >= a && r.premium < b).length }))} fmt={(v) => v.toFixed(0)} height={170} /></div>
          <div className="bg-[#03070c]"><SectionHead title="评级分布（只）" /><Bars data={["AAA", "AA+", "AA", "AA-", "A+", "A", "A-"].map((k) => ({ k, v: listed.filter((r) => r.rating === k).length }))} fmt={(v) => v.toFixed(0)} height={150} /></div>
          <div className="bg-[#03070c]"><SectionHead title="今日涨幅榜 / 跌幅榜" /><table className="w-full text-[11px]"><tbody>{[...listed].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 5).concat([...listed].sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 5)).map((r) => <tr key={r.code} onClick={() => pick(r.code)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-100">{r.name}</td><td className="text-right font-mono text-white">{fmtPrice(r.price, 3)}</td><td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className="px-2 text-right font-mono text-slate-400">溢价 {f2(r.premium, 1, "%")}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {func === "clause" && (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          {([["正股 ≥ 转股价 130%（触发强赎条件区间）", listed.filter((r) => r.nearRedeem), "#f2495c"], ["正股 ≤ 转股价 70%（触发回售 / 下修条件区间）", listed.filter((r) => r.nearResale), "#1fbf75"]] as Array<[string, Cb[], string]>).map(([t, list, c]) => (
            <div key={t} className="bg-[#03070c]">
              <SectionHead title={t} sub={`${list.length} 只；以当日价格判断，条款需连续满足一定天数`} />
              <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">转债</th><th className="text-right">价格</th><th className="text-right">正股 / 转股价</th><th className="text-right">溢价率</th><th className="px-2 text-right">剩余年限</th></tr></thead><tbody>{list.slice(0, 80).map((r) => <tr key={r.code} onClick={() => pick(r.code)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 text-[10px] text-slate-500">{r.stockName}</span></td><td className="text-right font-mono text-white">{fmtPrice(r.price, 3)}</td><td className="text-right font-mono" style={{ color: c }}>{r.stockPrice ? `${((r.stockPrice / r.convPrice) * 100).toFixed(0)}%` : "—"}</td><td className="text-right font-mono text-slate-300">{f2(r.premium, 1, "%")}</td><td className="px-2 text-right font-mono text-slate-400">{r.years.toFixed(2)}</td></tr>)}</tbody></table>
            </div>
          ))}
        </div>
      )}
      {func === "value" && cur && (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="bg-[#03070c] p-2 text-[11px]">
            <SectionHead title="选择转债" />
            <select value={cur.code} onChange={(e) => setSel(e.target.value)} className="w-full border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-[11px] text-slate-200">{sorted.slice(0, 600).map((r) => <option key={r.code} value={r.code}>{r.name}（{r.stockName}）</option>)}</select>
            <div className="mt-2 flex items-center justify-between"><span className="text-slate-400">正股波动率假设 %</span><input type="number" value={vol} onChange={(e) => setVol(Number(e.target.value) || 1)} className="w-20 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-white" /></div>
            
          </div>
          <div className="bg-[#03070c]">
            <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] md:grid-cols-4">
              {[["转债价格", fmtPrice(cur.price, 3)], ["转股价值", f2(cur.convValue, 2)], ["溢价率", f2(cur.premium, 2, "%")], ["正股价格", fmtPrice(cur.stockPrice)], ["债底估算", f2(val?.bondFloor, 2)], ["转股期权价值", f2(val?.option, 2)], ["模型理论价", f2(val?.fair, 2)], ["市价相对理论", val && cur.price ? sgn((cur.price / val.fair - 1) * 100, 2) : "—"]].map(([k, v]) => (
                <div key={k} className="bg-[#050b13] px-2 py-1.5"><div className="text-[10px] text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div></div>
              ))}
            </div>
            <SectionHead title="正股价格情景下的理论价（元）" />
            <Bars data={[-30, -20, -10, 0, 10, 20, 30].map((p) => { const sp = (cur.stockPrice ?? 0) * (1 + p / 100); const v = cbValue({ ...cur, stockPrice: sp }, vol / 100, 0.018); return { k: `${p > 0 ? "+" : ""}${p}%`, v: v?.fair ?? 0 }; })} fmt={(v) => v.toFixed(1)} height={160} />
          </div>
        </div>
      )}
      {func === "news" && <CbNews />}
    </HubShell>
  );
}
function CbNews() {
  const feed = useFeed({ q: "可转债 OR 转债 OR convertible bond", limit: 150, hours: 168 });
  return <><SectionHead title="可转债新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>;
}
