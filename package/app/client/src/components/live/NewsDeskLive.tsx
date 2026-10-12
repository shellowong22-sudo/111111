/**
 * 新闻分组 3 个小窗，切面互不重复：
 * FRNT 头版要闻（按综合重要度排序、分地区头版、各版块头条）；
 * BTDY 今日简报（北京时间今日 0 点以来：市场快照、情绪、热词、分栏要点、今日经济日历）；
 * BI 行业情报（按行业：行业资产实时行情、行业情绪对比、行业相对表现、行业新闻按热度）。
 */
import { useMemo, useState } from "react";
import { DOWN, UP, toneOf, usePolled } from "@/uc/market/live";
import { FeedList, QuoteStrip, Seg, Spark, ago, toneColor, useFeed, useNewsCtx, type News } from "@/uc/news/kit";
import EconCalendar from "@/uc/news/EconCalendar";
import { Bars, LiveBoard } from "@/uc/hubs/kit";
import { heat, perf, sgn, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose?: () => void };
type Senti = { byCat: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; byRegion: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; series: Array<{ t: number; pos: number; neg: number; n: number }>; total: number };
type Trends = { terms: Array<{ term: string; count: number; tone: number; momentum: number; hours: number[] }>; volume: Array<{ t: number; n: number; pos: number; neg: number }> };

/* ================================================================== FRNT 头版要闻 */
const REGIONS: Array<[string, string]> = [["all", "全球综合"], ["中国", "中国"], ["美国", "美国"], ["欧洲", "欧洲"], ["日本", "日本"], ["新兴市场", "新兴市场"]];
const DESKS = ["宏观", "央行", "A股", "美股", "港股", "外汇", "债券", "商品", "科技", "地缘", "公司", "政策"];

function Hero({ n }: { n: News }) {
  const { open } = useNewsCtx();
  return (
    <button type="button" onClick={() => open(n)} className="block w-full border-b border-[#1a2a3c] bg-[#060d16] px-3 py-2 text-left hover:bg-[#0a1726]">
      <div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="border border-amber-500/60 px-1 text-amber-300">头条</span><span>{n.region}</span><span>{n.cats.slice(0, 3).join(" · ")}</span><span>{ago(n.time)}</span><span style={{ color: toneColor(n.tone) }}>{n.tone > 0 ? "利好" : n.tone < 0 ? "利空" : "中性"}</span>{n.heat > 1 && <span className="text-orange-300">热度 {n.heat}</span>}</div>
      <div className="mt-1 text-[16px] font-semibold leading-snug text-white">{n.title}</div>
      {n.summary && <div className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-300">{n.summary}</div>}
    </button>
  );
}
function DeskHeads({ items }: { items: News[] }) {
  const { open } = useNewsCtx();
  const used = new Set<string>();
  const rows = DESKS.map((d) => { const n = items.find((x) => x.cats.includes(d) && !used.has(x.id)); if (n) used.add(n.id); return [d, n] as const; }).filter(([, n]) => n);
  return (
    <div className="grid grid-cols-1 gap-px bg-[#1a2a3c] sm:grid-cols-2">
      {rows.map(([d, n]) => <button key={d} type="button" onClick={() => open(n!)} className="bg-[#050b13] px-2 py-1.5 text-left hover:bg-[#0a1726]"><div className="flex items-center gap-2 text-[10px]"><span className="text-cyan-300">{d}</span><span className="text-slate-600">{ago(n!.time)}</span></div><div className="line-clamp-2 text-[11px] text-slate-100">{n!.title}</div></button>)}
    </div>
  );
}
export function FrontPageLive({ onClose }: P) {
  const [region, setRegion] = useState("all");
  const [win, setWin] = useState("12");
  const reg = region;
  const main = useFeed({ sort: "score", hours: Number(win), limit: 60, dedupe: true, ...(reg === "all" ? {} : { region: reg }) }, 60_000);
  const items = main.items;
  const hero = items.find((n) => n.summary) ?? items[0];
  const rest = items.filter((n) => n !== hero);
  const st = usePolled<{ last24h: number; lastHour: number; byRegion: Record<string, number> }>("ucNews.stats", {}, 60_000);
  return (
    <PanelShell code="FRNT" title="头版要闻" onClose={onClose} tabs={REGIONS} tab={region} setTab={setRegion} right={<span className="flex items-center gap-2">{st.data && <span>近 1 小时 {st.data.lastHour} 条 · 24 小时 {st.data.last24h} 条</span>}<Seg value={win} onChange={setWin} options={[["6", "6 小时"], ["12", "12 小时"], ["24", "24 小时"]]} /></span>}>
      {hero ? <Hero n={hero} /> : <Empty loading={main.loading} />}
      {items.length > 1 && <>
        <SectionHead title="各版块头条" sub="每个版块取综合重要度最高、且未在其他版块出现的一条" />
        <DeskHeads items={rest} />
        <SectionHead title="要闻排行" sub="按多家报道热度、时效与重要性综合排序，同一事件只保留一条" right={<span>{rest.length} 条</span>} />
        <FeedList items={rest} ranked max={40} />
      </>}
    </PanelShell>
  );
}

/* ================================================================== BTDY 今日简报 */
const SECTIONS: Array<[string, string, string[]]> = [["macro", "宏观与政策", ["宏观", "政策", "央行", "地缘"]], ["mkt", "市场", ["A股", "港股", "美股", "欧洲", "日本", "外汇", "债券", "商品", "能源", "加密"]], ["corp", "公司与产业", ["公司", "IPO", "科技", "金融", "地产", "消费", "医药", "汽车"]]];
const SNAP = ["sh000001", "sh000300", "sz399006", "^GSPC", "^NDX", "USDCNH", "DXY", "^TNX", "GC", "CL", "BTC"];
const SNAP_ZH: Record<string, string> = { sh000001: "上证指数", sh000300: "沪深 300", sz399006: "创业板指", "^GSPC": "标普 500", "^NDX": "纳指 100", USDCNH: "离岸人民币", DXY: "美元指数", "^TNX": "美 10 年收益率", GC: "黄金", CL: "原油", BTC: "比特币" };
function bjHoursToday() {
  const now = Date.now();
  const bj = new Date(now + 8 * 3600e3);
  const mid = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - 8 * 3600e3;
  return Math.max(1, Math.min(96, Math.ceil((now - mid) / 3600e3)));
}
export function DailyBriefLive({ onClose }: P) {
  const [tab, setTab] = useState("brief");
  const [lookback, setLookback] = useState("today");
  const h = lookback === "today" ? bjHoursToday() : Math.min(96, bjHoursToday() + 24);
  const feed = useFeed({ sort: "score", hours: h, limit: 300, dedupe: true }, 90_000);
  const senti = usePolled<Senti>("ucNews.sentiment", { hours: Math.max(3, h) }, 120_000);
  const tr = usePolled<Trends>("ucNews.trends", { hours: Math.max(3, h) }, 180_000);
  const sections = useMemo(() => {
    const used = new Set<string>();
    return SECTIONS.map(([id, name, cats]) => { const list = feed.items.filter((n) => !used.has(n.id) && n.cats.some((c) => cats.includes(c))).slice(0, 8); list.forEach((n) => used.add(n.id)); return { id, name, list }; });
  }, [feed.items]);
  const s = senti.data;
  const pos = s?.series.reduce((a, x) => a + x.pos, 0) ?? 0, neg = s?.series.reduce((a, x) => a + x.neg, 0) ?? 0;
  const idx = s && s.total ? Math.round(((pos - neg) / s.total) * 100) : null;
  const date = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  return (
    <PanelShell code="BTDY" title={`今日简报 · ${date}`} onClose={onClose} tabs={[["brief", "简报"], ["pulse", "情绪与热词"], ["cal", "今日日程"]]} tab={tab} setTab={setTab} right={<Seg value={lookback} onChange={setLookback} options={[["today", "今日（北京时间）"], ["2d", "含昨日"]]} />}>
      <QuoteStrip symbols={SNAP} labels={SNAP_ZH} />
      {tab === "brief" && <>
        <Kpis items={[["统计时段新闻", s ? s.total.toLocaleString() : "—", `近 ${h} 小时`], ["市场情绪指数", idx == null ? "—" : <span style={{ color: toneOf(idx) }}>{idx > 0 ? "+" : ""}{idx}</span>, "(利好 − 利空) / 总数"], ["利好 / 利空", s ? <span><span style={{ color: UP }}>{pos}</span> / <span style={{ color: DOWN }}>{neg}</span></span> : "—"], ["最热话题", tr.data?.terms[0]?.term ?? "—", tr.data?.terms[0] ? `${tr.data.terms[0].count} 次提及` : undefined]]} />
        {sections.map((sec) => <div key={sec.id}><SectionHead title={sec.name} right={<span>{sec.list.length} 条要点</span>} /><FeedList items={sec.list} dense empty="本时段暂无要点" loading={feed.loading} /></div>)}
      </>}
      {tab === "pulse" && <>
        <SectionHead title="每小时新闻量（利好 / 利空）" />
        <Bars data={(s?.series ?? []).map((x) => ({ k: new Date(x.t + 8 * 3600e3).toISOString().slice(11, 13), v: x.pos, v2: x.neg }))} label={["利好", "利空"]} fmt={(x) => x.toFixed(0)} height={120} />
        <SectionHead title="今日热词" />
        <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">词</th><th className="text-right">提及</th><th className="text-right">动量</th><th className="text-right">情绪</th><th className="px-2">逐小时</th></tr></thead>
          <tbody>{(tr.data?.terms ?? []).slice(0, 20).map((t) => <tr key={t.term} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{t.term}</td><td className="text-right font-mono text-white">{t.count}</td><td className="text-right font-mono" style={{ color: toneOf(t.momentum) }}>{t.momentum > 0 ? "+" : ""}{t.momentum}</td><td className="text-right font-mono" style={{ color: toneOf(t.tone) }}>{t.tone.toFixed(2)}</td><td className="px-2"><Spark values={t.hours} /></td></tr>)}{!tr.data && <tr><td colSpan={5}><Empty loading={tr.loading} /></td></tr>}</tbody></table>
        <SectionHead title="分地区情绪" />
        <table className="w-full text-[11px]"><tbody>{(s?.byRegion ?? []).slice(0, 10).map((r) => <tr key={r.key} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{r.key}</td><td className="text-right font-mono text-slate-300">{r.count}</td><td className="text-right font-mono" style={{ color: UP }}>{r.pos}</td><td className="text-right font-mono" style={{ color: DOWN }}>{r.neg}</td><td className="px-2 text-right font-mono" style={{ background: heat(r.index, 60) }}>{r.index > 0 ? "+" : ""}{r.index}</td></tr>)}</tbody></table>
      </>}
      {tab === "cal" && <EconCalendar compact />}
    </PanelShell>
  );
}

/* ================================================================== BI 行业情报 */
const IND: Array<{ id: string; name: string; cat: string; q?: string; rows: Array<[string, string]> }> = [
  { id: "tech", name: "科技与半导体", cat: "科技", rows: [["XLK", "美股科技"], ["SMH", "美股半导体"], ["NVDA", "英伟达"], ["0700.HK", "腾讯控股"], ["sh512480", "A股半导体"], ["sh515000", "A股科技"]] },
  { id: "fin", name: "金融", cat: "金融", rows: [["XLF", "美股金融"], ["KBE", "美股银行"], ["JPM", "摩根大通"], ["sh512800", "A股银行"], ["sh512880", "A股证券"], ["0939.HK", "建设银行"]] },
  { id: "energy", name: "能源", cat: "能源", rows: [["XLE", "美股能源"], ["CL", "WTI 原油"], ["NG", "天然气"], ["XOM", "埃克森美孚"], ["sh515220", "A股煤炭"], ["sh515790", "A股光伏"]] },
  { id: "re", name: "房地产", cat: "地产", rows: [["VNQ", "美股房地产信托"], ["XHB", "美股住宅建筑"], ["sh512200", "A股房地产"], ["1109.HK", "华润置地"], ["^TNX", "美 10 年收益率"]] },
  { id: "cons", name: "消费", cat: "消费", rows: [["XLY", "美股可选消费"], ["XLP", "美股必选消费"], ["sh512690", "A股白酒"], ["sh600519", "贵州茅台"], ["9988.HK", "阿里巴巴"]] },
  { id: "health", name: "医药", cat: "医药", rows: [["XLV", "美股医疗"], ["XBI", "美股生物科技"], ["LLY", "礼来"], ["sh512010", "A股医药"], ["sh600276", "恒瑞医药"]] },
  { id: "auto", name: "汽车", cat: "汽车", rows: [["TSLA", "特斯拉"], ["1211.HK", "比亚迪股份"], ["sh515030", "A股新能源车"], ["TM", "丰田汽车"], ["LI", "理想汽车"]] },
];
const PROXY: Array<[string, string]> = [["XLK", "科技"], ["XLF", "金融"], ["XLE", "能源"], ["VNQ", "地产"], ["XLY", "可选消费"], ["XLP", "必选消费"], ["XLV", "医疗"], ["XLI", "工业"], ["XLB", "材料"], ["XLU", "公用事业"], ["XLC", "通信"]];
export function IndustryIntelLive({ onClose }: P) {
  const [id, setId] = useState("tech");
  const [sort, setSort] = useState<"heat" | "time">("heat");
  const ind = IND.find((x) => x.id === id)!;
  const feed = useFeed({ cats: [ind.cat], sort, hours: 48, limit: 60, dedupe: true }, 90_000);
  const senti = usePolled<Senti>("ucNews.sentiment", { hours: 48 }, 180_000);
  const pack = useCloses(PROXY.map(([s]) => s), 300);
  const catRows = IND.map((x) => ({ x, s: senti.data?.byCat.find((c) => c.key === x.cat) }));
  const me = catRows.find((r) => r.x.id === id)?.s;
  const perfRows = PROXY.map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((p) => p[1]); return { s, l, m1: perf(c, 21), m3: perf(c, 63), m12: perf(c, 252) }; });
  const toneMix = feed.items.reduce((a, n) => { a[n.tone + 1]++; return a; }, [0, 0, 0]);
  return (
    <PanelShell code="BI" title="行业情报" onClose={onClose} tabs={IND.map((x) => [x.id, x.name] as [string, string])} tab={id} setTab={setId}>
      <Kpis items={[[`${ind.name} · 48 小时新闻`, me ? me.count.toLocaleString() : "—"], ["行业情绪指数", me ? <span style={{ color: toneOf(me.index) }}>{me.index > 0 ? "+" : ""}{me.index}</span> : "—", "(利好 − 利空) / 总数"], ["利好 / 利空", me ? <span><span style={{ color: UP }}>{me.pos}</span> / <span style={{ color: DOWN }}>{me.neg}</span></span> : "—"], ["当前列表情绪构成", feed.items.length ? `${toneMix[2]} / ${toneMix[1]} / ${toneMix[0]}` : "—", "利好 / 中性 / 利空"]]} />
      <SectionHead title={`${ind.name} · 核心资产实时行情`} sub="点击查看 K 线" />
      <LiveBoard rows={ind.rows.map(([symbol, label]) => ({ symbol, label }))} />
      <SectionHead title={`${ind.name} · 行业新闻`} right={<Seg value={sort} onChange={setSort} options={[["heat", "按热度"], ["time", "按时间"]]} />} />
      <FeedList items={feed.items} loading={feed.loading} max={40} />
      <SectionHead title="各行业新闻情绪对比（48 小时）" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">行业</th><th className="text-right">新闻数</th><th className="text-right">利好</th><th className="text-right">利空</th><th className="px-2 text-right">情绪指数</th></tr></thead>
        <tbody>{catRows.map(({ x, s }) => <tr key={x.id} onClick={() => setId(x.id)} className={`cursor-pointer border-t border-[#0f1b29] ${x.id === id ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5 text-slate-100">{x.name}</td><td className="text-right font-mono text-slate-300">{s?.count ?? "—"}</td><td className="text-right font-mono" style={{ color: UP }}>{s?.pos ?? "—"}</td><td className="text-right font-mono" style={{ color: DOWN }}>{s?.neg ?? "—"}</td><td className="px-2 text-right font-mono" style={{ background: heat(s?.index ?? null, 60) }}>{s ? `${s.index > 0 ? "+" : ""}${s.index}` : "—"}</td></tr>)}</tbody></table>
      <SectionHead title="美股行业相对表现" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">行业</th><th className="text-right">1 月</th><th className="text-right">3 月</th><th className="px-2 text-right">1 年</th></tr></thead>
        <tbody>{perfRows.map((r) => <tr key={r.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td>{[r.m1, r.m3, r.m12].map((v, i) => <td key={i} className={`text-right font-mono ${i === 2 ? "px-2" : ""}`} style={{ background: heat(v, [5, 10, 25][i]) }}>{sgn(v, 1)}</td>)}</tr>)}{!pack.data && <tr><td colSpan={4}><Empty loading={pack.loading} /></td></tr>}</tbody></table>
    </PanelShell>
  );
}
