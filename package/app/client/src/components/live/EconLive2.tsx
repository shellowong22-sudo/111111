/**
 * 经济数据中心（第二组，全部真实数据，角度互不重复）：
 *  - ECWB 经济工作台：从平台自有宏观数据库（政策利率、通胀、有效汇率、年度宏观）自选序列叠加作图，组合永久保存
 *  - ECOB 关键指标矩阵：主要经济体 × 核心指标（通胀、增长、就业、景气、消费、工业）最近一次公布值、预期、意外方向
 *  - SHOK 数据冲击与市场反应：近 30 天重要数据的意外幅度，与公布当日股、债、汇的真实变动对照
 *  - FOMS 联储声明比对：读取美联储货币政策声明原文，逐词比对新旧两版的增删，并统计鹰派 / 鸽派措辞
 *  - MOSP 预测市场：宏观、央行、政策类合约的实时隐含概率、成交与流动性，概率逐日入库
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtCompact, fmtPct, toneOf, usePolled, ucGet } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines } from "@/uc/hubs/kit";
import { f2, heat, mean, sgn, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, MiniLine, Note, ROW, TD, TDL, TH, THL, evTime, numOf, useCalendarSpan, type EconEvent, type P } from "./LiveCommon";

const CB_ZH: Record<string, string> = { US: "美国", XM: "欧元区", GB: "英国", JP: "日本", CH: "瑞士", CA: "加拿大", AU: "澳大利亚", NZ: "新西兰", SE: "瑞典", NO: "挪威", CN: "中国", HK: "中国香港", KR: "韩国", IN: "印度", ID: "印度尼西亚", TH: "泰国", MY: "马来西亚", PH: "菲律宾", BR: "巴西", MX: "墨西哥", CL: "智利", CO: "哥伦比亚", ZA: "南非", TR: "土耳其", PL: "波兰", CZ: "捷克", HU: "匈牙利", SA: "沙特" };
const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";

/* ================================================================== ECWB 经济工作台 */
type SeriesDef = { id: string; label: string };
const KINDS: Array<[string, string]> = [["cbpol", "政策利率"], ["cpi", "通胀同比"], ["reer", "实际有效汇率"], ["neer", "名义有效汇率"]];
const IMF_KINDS: Array<[string, string]> = [["NGDP_RPCH", "实际GDP增速（年）"], ["PCPIPCH", "通胀（年）"], ["LUR", "失业率（年）"], ["GGXWDG_NGDP", "政府债务/GDP（年）"], ["BCA_NGDPD", "经常账户/GDP（年）"]];
const IMF_ISO: Array<[string, string]> = [["USA", "美国"], ["CHN", "中国"], ["JPN", "日本"], ["DEU", "德国"], ["GBR", "英国"], ["FRA", "法国"], ["IND", "印度"], ["BRA", "巴西"], ["KOR", "韩国"], ["CAN", "加拿大"], ["AUS", "澳大利亚"], ["WEOWORLD", "全球"]];
function useSeriesMany(ids: string[]) {
  const [data, setData] = useState<Record<string, Array<{ d: string; v: number }>>>({});
  const key = ids.join("|");
  useEffect(() => {
    let live = true;
    void Promise.all(ids.map((id) => ucGet<Array<{ d: string; v: number }>>("ucHubs.series", { series: id, n: 600 }).then((r) => [id, r] as const).catch(() => [id, []] as const))).then((rows) => { if (live) setData(Object.fromEntries(rows)); });
    return () => { live = false; };
  }, [key]);
  return data;
}
export function EcwbLive({ onClose }: P) {
  const saved = useSaved<{ items: SeriesDef[] }>("ecwb-series");
  const [items, setItems] = useState<SeriesDef[]>([{ id: "cbpol:US", label: "美国 · 政策利率" }, { id: "cpi:US", label: "美国 · 通胀同比" }, { id: "cbpol:XM", label: "欧元区 · 政策利率" }]);
  const [kind, setKind] = useState("cbpol");
  const [area, setArea] = useState("CN");
  const [ik, setIk] = useState("NGDP_RPCH");
  const [iso, setIso] = useState("CHN");
  const [norm, setNorm] = useState<"raw" | "idx">("raw");
  useEffect(() => { if (saved.data?.items?.length) setItems(saved.data.items); }, [saved.data]);
  const data = useSeriesMany(items.map((x) => x.id));
  const persist = (next: SeriesDef[]) => { setItems(next); void saveItem("ecwb-series", { items: next }).catch(() => toast.error("保存失败")); };
  const add = (def: SeriesDef) => { if (items.some((x) => x.id === def.id)) return; if (items.length >= 8) { toast.error("最多叠加 8 条序列"); return; } persist([...items, def]); };
  const xs = useMemo(() => [...new Set(items.flatMap((x) => (data[x.id] ?? []).map((p) => p.d)))].sort(), [data, items]);
  const series = items.map((x, i) => { const m = new Map((data[x.id] ?? []).map((p) => [p.d, p.v])); let last: number | null = null; const vals = xs.map((d) => { const v = m.get(d); if (v != null) last = v; return v ?? (last != null && d.length === 7 ? last : null); }); const base = vals.find((v) => v != null) ?? null; return { name: x.label, color: COLORS[i % COLORS.length], values: norm === "idx" && base ? vals.map((v) => (v == null ? null : (v / base) * 100)) : vals }; });
  return (
    <PanelShell code="ECWB" title="经济工作台" onClose={onClose} right={<Seg value={norm} options={[["raw", "原值"], ["idx", "起点=100"]]} onChange={setNorm} />}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <span className="text-slate-500">月度</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 text-white">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 text-white">{Object.entries(CB_ZH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button type="button" className={BTN} onClick={() => add({ id: `${kind}:${area}`, label: `${CB_ZH[area]} · ${KINDS.find((k) => k[0] === kind)?.[1]}` })}>加入</button>
        <span className="ml-3 text-slate-500">年度</span>
        <select value={ik} onChange={(e) => setIk(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 text-white">{IMF_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={iso} onChange={(e) => setIso(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 text-white">{IMF_ISO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button type="button" className={BTN} onClick={() => add({ id: `imf:${ik}:${iso}`, label: `${IMF_ISO.find((x) => x[0] === iso)?.[1]} · ${IMF_KINDS.find((x) => x[0] === ik)?.[1]}` })}>加入</button>
      </div>
      <div className="flex flex-wrap gap-1 px-2 py-1">{items.map((x, i) => <span key={x.id} className="flex items-center gap-1 border border-[#1d3047] px-1.5 py-0.5 text-[10px]" style={{ color: COLORS[i % COLORS.length] }}>{x.label}<span className="text-slate-500">（{(data[x.id] ?? []).length} 期）</span><button type="button" onClick={() => persist(items.filter((y) => y.id !== x.id))} className="text-slate-500 hover:text-white">✕</button></span>)}</div>
      {xs.length ? <Lines height={280} xLabels={xs} fmt={(v) => v.toFixed(2)} series={series} /> : <Empty text="所选序列在平台数据库中暂无记录（相关页面首次打开后即开始入库）" />}
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>序列</th><th className={TH}>最新期</th><th className={TH}>最新值</th><th className={TH}>上一期</th><th className={TH}>变化</th><th className={TH}>区间最高</th><th className={TH}>区间最低</th></tr></thead>
        <tbody>{items.map((x) => { const s = data[x.id] ?? []; const a = s.at(-1), b = s.at(-2); const vs = s.map((p) => p.v); return <tr key={x.id} className={ROW}><td className={`${TDL} text-slate-100`}>{x.label}</td><td className={`${TD} text-slate-400`}>{a?.d ?? "—"}</td><td className={`${TD} text-white`}>{f2(a?.v)}</td><td className={`${TD} text-slate-400`}>{f2(b?.v)}</td><td className={TD} style={{ color: toneOf(a && b ? a.v - b.v : null) }}>{a && b ? sgn(a.v - b.v, 2, "") : "—"}</td><td className={`${TD} text-slate-300`}>{vs.length ? Math.max(...vs).toFixed(2) : "—"}</td><td className={`${TD} text-slate-300`}>{vs.length ? Math.min(...vs).toFixed(2) : "—"}</td></tr>; })}</tbody>
      </table>
      <Note>序列全部取自平台自有数据库（各数据页面采集后永久入库）；月度与年度序列混合叠加时，年度值按所在年份显示。组合永久保存在你的个人账户。</Note>
    </PanelShell>
  );
}

/* ================================================================== ECOB 关键指标矩阵 */
const ECOB_COUNTRIES = ["美国", "欧元区", "中国", "日本", "英国", "德国", "加拿大", "澳大利亚"];
const ECOB_IND: Array<[string, RegExp]> = [["通胀", /\bCPI\b|Consumer Price|通胀|消费者物价/i], ["增长", /\bGDP\b|国内生产总值/i], ["就业", /Unemployment Rate|失业率|Nonfarm|非农/i], ["制造业景气", /Manufacturing PMI|制造业PMI|ISM Manufacturing/i], ["服务业景气", /Services PMI|服务业PMI|Non-Manufacturing/i], ["消费", /Retail Sales|零售销售|社会消费品/i], ["工业", /Industrial Production|工业产出|工业增加值/i], ["贸易", /Trade Balance|贸易差额|贸易帐/i]];
export function EcobLive({ onClose }: P) {
  const cal = useCalendarSpan(30, 10);
  const cell = (country: string, re: RegExp) => {
    const hits = cal.rows.filter((e) => e.region === country && re.test(`${e.name} ${e.nameZh}`));
    const done = hits.filter((e) => e.released && e.actual != null).sort((a, b) => (b.importance - a.importance) || ((b.time ?? 0) - (a.time ?? 0)));
    const next = hits.filter((e) => !e.released).sort((a, b) => (a.time ?? 0) - (b.time ?? 0))[0];
    return { last: done[0] ?? null, next: next ?? null };
  };
  const grid = ECOB_COUNTRIES.map((c) => ({ c, cells: ECOB_IND.map(([, re]) => cell(c, re)) }));
  const beats = grid.flatMap((g) => g.cells.map((x) => x.last)).filter((e): e is EconEvent => e != null && e.surprise != null);
  return (
    <PanelShell code="ECOB" title="关键指标矩阵" onClose={onClose}>
      <Kpis items={[["近 30 天已公布", String(grid.flatMap((g) => g.cells).filter((x) => x.last).length)], ["高于预期 / 低于预期", `${beats.filter((e) => e.surprise! > 0).length} / ${beats.filter((e) => e.surprise! < 0).length}`], ["未来 10 天待公布", String(grid.flatMap((g) => g.cells).filter((x) => x.next).length)]]} />
      {cal.loading && !cal.rows.length ? <Empty loading /> : (
        <div className="overflow-auto">
          <table className="w-full text-[11px]">
            <thead className={thead}><tr><th className={THL}>经济体</th>{ECOB_IND.map(([n]) => <th key={n} className={TH}>{n}</th>)}</tr></thead>
            <tbody>{grid.map((g) => (
              <tr key={g.c} className={ROW}>
                <td className={`${TDL} text-slate-100`}>{g.c}</td>
                {g.cells.map((x, i) => (
                  <td key={i} className="px-1.5 py-1 text-right align-top" style={{ background: x.last?.surprise != null ? heat(x.last.surprise, 2) : undefined }}>
                    {x.last ? <><div className="font-mono text-white">{x.last.actual}</div><div className="text-[9px] text-slate-400">预期 {x.last.consensus ?? "—"} · 前 {x.last.previous ?? "—"}</div><div className="truncate text-[9px] text-slate-500" title={x.last.nameZh || x.last.name}>{x.last.date.slice(5)} {x.last.nameZh || x.last.name}</div></> : <span className="text-slate-600">—</span>}
                    {x.next && <div className="text-[9px] text-amber-300">下次 {x.next.date.slice(5)}</div>}
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Note>每格为该经济体该类指标近 30 天最近一次公布值（同类有多项时优先显示重要性最高者），底色红 = 高于市场预期、绿 = 低于预期；黄字为未来 10 天内的下一次公布日。</Note>
    </PanelShell>
  );
}

/* ================================================================== SHOK 数据冲击与市场反应 */
const MKT: Array<[string, string, "pct" | "bp"]> = [["^GSPC", "标普 500", "pct"], ["^TNX", "10 年美债", "bp"], ["DXY", "美元指数", "pct"], ["GC", "黄金", "pct"]];
export function ShokLive({ onClose }: P) {
  const [region, setRegion] = useState("美国");
  const cal = useCalendarSpan(30, 1);
  const pack = useCloses(MKT.map((m) => m[0]), 60);
  const dayMove = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const [s, , u] of MKT) {
      const arr = pack.data?.[s] ?? [];
      for (let i = 1; i < arr.length; i++) { const d = new Date(arr[i][0] + 8 * 3600_000).toISOString().slice(0, 10); (out[d] ??= {})[s] = u === "bp" ? (arr[i][1] - arr[i - 1][1]) * 10 : (arr[i][1] / arr[i - 1][1] - 1) * 100; }
    }
    return out;
  }, [pack.data]);
  const events = cal.rows.filter((e) => e.released && e.importance >= 2 && e.surprise != null && (region === "全部" || e.region === region)).sort((a, b) => Math.abs(b.surprise!) - Math.abs(a.surprise!)).slice(0, 40);
  const pos = events.filter((e) => e.surprise! > 0), neg = events.filter((e) => e.surprise! < 0);
  const avgMove = (list: EconEvent[], s: string) => { const v = list.map((e) => dayMove[e.date]?.[s]).filter((x): x is number => x != null); return v.length ? mean(v) : null; };
  return (
    <PanelShell code="SHOK" title="数据冲击与市场反应" onClose={onClose} right={<Seg value={region} options={["美国", "欧元区", "中国", "日本", "英国", "全部"].map((r) => [r, r] as [string, string])} onChange={setRegion} />}>
      <SectionHead title="正 / 负意外时的平均当日市场变动" sub={`近 30 天重要数据：高于预期 ${pos.length} 项，低于预期 ${neg.length} 项`} />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>情形</th>{MKT.map(([, l, u]) => <th key={l} className={TH}>{l}（{u === "bp" ? "bp" : "%"}）</th>)}</tr></thead>
        <tbody>{([["高于预期", pos], ["低于预期", neg]] as Array<[string, EconEvent[]]>).map(([n, l]) => <tr key={n} className={ROW}><td className={`${TDL} text-slate-200`}>{n}</td>{MKT.map(([s, , u]) => { const v = avgMove(l, s); return <td key={s} className={TD} style={{ color: toneOf(v) }}>{v == null ? "—" : u === "bp" ? v.toFixed(1) : sgn(v)}</td>; })}</tr>)}</tbody></table>
      <SectionHead title="按意外幅度排序的数据与当日市场变动" />
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>公布</th><th className={THL}>经济体</th><th className={THL}>指标</th><th className={TH}>实际</th><th className={TH}>预期</th><th className={TH}>意外</th>{MKT.map(([, l]) => <th key={l} className={TH}>{l}</th>)}</tr></thead>
          <tbody>{events.map((e) => <tr key={e.id} className={ROW}><td className={`${TDL} font-mono text-[10px] text-slate-400`}>{evTime(e)}</td><td className={`${TDL} text-slate-300`}>{e.region}</td><td className={`${TDL} text-slate-100`}>{e.nameZh || e.name}</td><td className={`${TD} text-white`}>{e.actual}</td><td className={`${TD} text-slate-400`}>{e.consensus ?? "—"}</td><td className={TD} style={{ color: toneOf(e.surprise), background: heat(e.surprise, 2) }}>{f2(e.surprise)}</td>{MKT.map(([s, , u]) => { const v = dayMove[e.date]?.[s]; return <td key={s} className={TD} style={{ color: toneOf(v) }}>{v == null ? "—" : u === "bp" ? v.toFixed(1) : sgn(v)}</td>; })}</tr>)}{!events.length && <tr><td colSpan={10}><Empty loading={cal.loading} text="近 30 天没有带预期值的重要数据" /></td></tr>}</tbody>
        </table>
      </div>
      <Note>意外 = 标准化后的（实际 − 预期）；市场变动为公布当日（美国时间）收盘相对前一日的变化，美债以收益率基点计。同日有多项数据时，市场变动为当日全部信息的综合结果。</Note>
    </PanelShell>
  );
}

/* ================================================================== FOMS 联储声明比对 */
type Press = { id: string; title: string; link: string; date: number; desc: string; label: string };
const HAWK = ["inflation remains elevated", "elevated", "tighten", "firming", "additional", "upside risks", "strong", "solid", "vigilant", "higher"];
const DOVE = ["moderated", "eased", "softened", "downside risks", "cut", "lower", "weakened", "slowed", "accommodative", "support"];
function wordDiff(a: string[], b: string[]) {
  const n = a.length, m = b.length;
  if (n * m > 4_000_000) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Array<{ t: string; k: 0 | 1 | -1 }> = [];
  let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push({ t: a[i], k: 0 }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: a[i], k: -1 }); i++; } else { out.push({ t: b[j], k: 1 }); j++; } }
  while (i < n) out.push({ t: a[i++], k: -1 });
  while (j < m) out.push({ t: b[j++], k: 1 });
  return out;
}
export function FomsLive({ onClose }: P) {
  const st = usePolled<Array<{ date: string; url: string }>>("ucHubs.fomc", {}, 3600_000);
  const list = (st.data ?? []).filter((x) => x.date <= new Date().toISOString().slice(0, 10)).map((x) => ({ id: x.url, title: `${x.date} 议息声明`, link: x.url, date: Date.parse(x.date) }));
  const [ai, setAi] = useState(0);
  const [bi, setBi] = useState(1);
  const A = list[ai], B = list[bi];
  const ta = usePolled<{ text: string }>("ucNews.article", A?.link ? { url: A.link } : null, 86_400_000);
  const tb = usePolled<{ text: string }>("ucNews.article", B?.link ? { url: B.link } : null, 86_400_000);
  const pr = st;
  const body = (t: string | undefined) => { const x = (t ?? "").replace(/#+\s*/g, "").replace(/\s+/g, " "); const i = x.search(/vote:\s|statement for release[^:]*:/i); const y = i >= 0 ? x.slice(x.indexOf(":", i) + 1) : x; return y.split(/\s(?=Voting for the monetary policy action|Voting for this action|For media inquiries|Implementation Note)/)[0].trim(); };
  const ca = body(ta.data?.text), cbb = body(tb.data?.text);
  const diff = useMemo(() => (ca && cbb ? wordDiff(cbb.split(" "), ca.split(" ")) : null), [ca, cbb]);
  const count = (txt: string, words: string[]) => words.reduce((s, w) => s + (txt.toLowerCase().split(w).length - 1), 0);
  const fmtD = (t?: number) => (t ? new Date(t).toLocaleDateString("zh-CN") : "—");
  return (
    <PanelShell code="FOMS" title="联储声明比对" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]">
        <span className="text-slate-500">新版</span><select value={ai} onChange={(e) => setAi(Number(e.target.value))} className="border border-[#1d3047] bg-[#07111c] px-1 text-white">{list.map((x, i) => <option key={x.id} value={i}>{fmtD(x.date)} {x.title.slice(0, 50)}</option>)}</select>
        <span className="text-slate-500">对比旧版</span><select value={bi} onChange={(e) => setBi(Number(e.target.value))} className="border border-[#1d3047] bg-[#07111c] px-1 text-white">{list.map((x, i) => <option key={x.id} value={i}>{fmtD(x.date)} {x.title.slice(0, 50)}</option>)}</select>
      </div>
      <Kpis items={[["新版发布", fmtD(A?.date)], ["旧版发布", fmtD(B?.date)], ["新版字数 / 旧版字数", ca && cbb ? `${ca.split(" ").length} / ${cbb.split(" ").length}` : "—"], ["新增 / 删除词数", diff ? `${diff.filter((x) => x.k === 1).length} / ${diff.filter((x) => x.k === -1).length}` : "—"], ["鹰派措辞（新 / 旧）", ca && cbb ? `${count(ca, HAWK)} / ${count(cbb, HAWK)}` : "—"], ["鸽派措辞（新 / 旧）", ca && cbb ? `${count(ca, DOVE)} / ${count(cbb, DOVE)}` : "—"]]} />
      {!list.length ? <Empty loading={pr.loading} text="暂未读取到货币政策声明" /> : !diff ? <Empty loading={ta.loading || tb.loading} text="正在读取声明全文…" /> : (
        <div className="px-3 py-2 text-[12px] leading-6 text-slate-300">
          {diff.map((w, i) => <span key={i} className={w.k === 1 ? "bg-[rgba(242,73,92,0.25)] text-white" : w.k === -1 ? "text-slate-500 line-through" : ""}>{w.t} </span>)}
        </div>
      )}
      <Note>原文为美联储发布的英文声明；红底为新版新增措辞，删除线为旧版中被删去的措辞。鹰派 / 鸽派词表为常用政策措辞的计数，仅作参考。</Note>
    </PanelShell>
  );
}

/* ================================================================== MOSP 预测市场 */
type Pm = { at: number; events: Array<{ id: string; tag: string; title: string; end: string | null; volume: number | null; volume24h: number | null; liquidity: number | null; markets: Array<{ id: string; label: string; question: string; yes: number | null; bid: number | null; ask: number | null; volume: number | null; end: string | null }> }> };
const TAG_ZH: Record<string, string> = { "fed-rates": "联储利率", fed: "美联储", economy: "经济", inflation: "通胀", recession: "衰退", tariffs: "关税", china: "中国", gdp: "增长" };
export function MospLive({ onClose }: P) {
  const pm = usePolled<Pm>("ucHubs.predict", {}, 300_000);
  const [tag, setTag] = useState("全部");
  const [sel, setSel] = useState<string | null>(null);
  const evs = (pm.data?.events ?? []).filter((e) => tag === "全部" || TAG_ZH[e.tag] === tag);
  const cur = evs.find((e) => e.id === sel) ?? evs[0];
  const hist = useSeriesMany(cur ? cur.markets.slice(0, 6).map((m) => `pm:${m.id}`) : []);
  const xs = [...new Set(Object.values(hist).flatMap((a) => a.map((p) => p.d)))].sort();
  return (
    <PanelShell code="MOSP" title="预测市场" onClose={onClose} right={<Seg value={tag} options={["全部", ...new Set(Object.values(TAG_ZH))].map((t) => [t, t] as [string, string])} onChange={setTag} />}>
      <Kpis items={[["活跃合约组", String(evs.length)], ["24 小时成交（合计）", fmtCompact(evs.reduce((s, e) => s + (e.volume24h ?? 0), 0))], ["更新", pm.data ? new Date(pm.data.at).toLocaleTimeString("zh-CN", { hour12: false }) : "—"]]} />
      {!evs.length ? <Empty loading={pm.loading} text="暂无相关合约" /> : (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="max-h-[520px] overflow-auto bg-[#03070c]">
            <table className="w-full text-[11px]">
              <thead className={thead}><tr><th className={THL}>主题</th><th className={THL}>类别</th><th className={TH}>领先选项</th><th className={TH}>隐含概率</th><th className={TH}>24 小时成交</th><th className={TH}>到期</th></tr></thead>
              <tbody>{evs.map((e) => <tr key={e.id} onClick={() => setSel(e.id)} className={`${ROW} cursor-pointer ${cur?.id === e.id ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} text-slate-100`}>{e.title}</td><td className={`${TDL} text-[10px] text-slate-500`}>{TAG_ZH[e.tag] ?? e.tag}</td><td className={`${TD} text-slate-300`}>{e.markets[0]?.label}</td><td className={`${TD} text-white`}>{e.markets[0]?.yes != null ? `${(e.markets[0].yes * 100).toFixed(1)}%` : "—"}</td><td className={`${TD} text-slate-300`}>{fmtCompact(e.volume24h)}</td><td className={`${TD} text-[10px] text-slate-500`}>{e.end?.slice(0, 10) ?? "—"}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="bg-[#03070c]">
            {cur && <>
              <SectionHead title={cur.title} sub={`总成交 ${fmtCompact(cur.volume)} · 流动性 ${fmtCompact(cur.liquidity)}`} />
              <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>选项</th><th className={TH}>隐含概率</th><th className={TH}>买 / 卖</th><th className={TH}>成交</th><th className={TH}>入库走势</th></tr></thead>
                <tbody>{cur.markets.map((m) => <tr key={m.id} className={ROW}><td className={`${TDL} text-slate-100`}>{m.label}</td><td className={TD}><div className="ml-auto h-2 w-24 bg-[#0a1726]"><div className="h-2 bg-cyan-600" style={{ width: `${(m.yes ?? 0) * 100}%` }} /></div><span className="text-white">{m.yes != null ? `${(m.yes * 100).toFixed(1)}%` : "—"}</span></td><td className={`${TD} text-slate-400`}>{m.bid != null && m.ask != null ? `${(m.bid * 100).toFixed(1)} / ${(m.ask * 100).toFixed(1)}` : "—"}</td><td className={`${TD} text-slate-300`}>{fmtCompact(m.volume)}</td><td className={TD}><MiniLine values={(hist[`pm:${m.id}`] ?? []).map((p) => p.v)} w={80} /></td></tr>)}</tbody></table>
              {xs.length > 1 && <><SectionHead title="主要选项隐含概率（平台逐日入库）" /><Lines height={150} xLabels={xs} fmt={(v) => `${(v * 100).toFixed(1)}%`} series={cur.markets.slice(0, 6).map((m, i) => { const mp = new Map((hist[`pm:${m.id}`] ?? []).map((p) => [p.d, p.v])); return { name: m.label, color: COLORS[i % COLORS.length], values: xs.map((d) => mp.get(d) ?? null) }; })} /></>}
            </>}
          </div>
        </div>
      )}
      <Note>隐含概率 = 合约“是”的最新成交价（0~1），反映市场对事件发生概率的定价；合约主题保留原文。概率每次读取都写入平台数据库，用于绘制历史走势。</Note>
    </PanelShell>
  );
}
