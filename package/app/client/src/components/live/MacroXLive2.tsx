/**
 * 宏观 / 风险组（实时数据版，二）：
 * ExpertMonitor 观点与定价对照 · GMM 全球宏观驱动者（敏感度 / 回归归因 / 传导）
 * MEDI 媒体资讯监测（流量 / 热词 / 地区 / 热门） · HELP_INDX 指数中心功能索引
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, usePolled, useTicks, UP, DOWN } from "@/uc/market/live";
import { FeedList, Seg, Spark, useFeed, type News } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines } from "@/uc/hubs/kit";
import { align, corr, f2, heat, mean, perf, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { Note, ROW, TD, TDL, TH, THL, yld, type P } from "./MacroXLive";

/* ================================================================== 观点监控 */
const TOPICS: Array<{ k: string; re: RegExp; sym: string; label: string; yieldLike?: boolean }> = [
  { k: "利率债市", re: /国债|收益率|债市|债券|久期|Treasur|yield|bond/i, sym: "^TNX", label: "美 10 年收益率", yieldLike: true },
  { k: "央行通胀", re: /美联储|央行|降息|加息|通胀|CPI|Fed|ECB|BOJ|rate cut|inflation|hike/i, sym: "ZT", label: "2 年期国债期货" },
  { k: "股市", re: /股市|美股|A股|港股|标普|纳指|股指|stock|equit|S&P|Nasdaq/i, sym: "^GSPC", label: "标普 500" },
  { k: "汇率", re: /美元|汇率|人民币|日元|欧元|dollar|currency|yen|euro|FX/i, sym: "DXY", label: "美元指数" },
  { k: "商品", re: /原油|黄金|铜|大宗|油价|oil|gold|copper|commodit/i, sym: "GC", label: "黄金" },
  { k: "科技", re: /AI|芯片|半导体|科技|英伟达|Nvidia|chip|tech/i, sym: "^NDX", label: "纳指 100" },
];
type Senti = { byCat: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; series: Array<{ t: number; pos: number; neg: number; n: number }>; total: number };
export function MacroExpert({ onClose }: P) {
  const [tab, setTab] = useState("feed");
  const feed = useFeed({ cats: ["观点"], limit: 150, hours: 72 }, 60_000);
  const [topic, setTopic] = useState("全部");
  const inTopic = (n: News, k: string) => { const t = TOPICS.find((x) => x.k === k); return !t || t.re.test(`${n.title} ${n.summary ?? ""}`); };
  const shown = feed.items.filter((n) => topic === "全部" || inTopic(n, topic));
  const agg = TOPICS.map((t) => {
    const xs = feed.items.filter((n) => t.re.test(`${n.title} ${n.summary ?? ""}`));
    const pos = xs.filter((n) => n.tone > 0).length, neg = xs.filter((n) => n.tone < 0).length;
    return { ...t, n: xs.length, pos, neg, net: xs.length ? ((pos - neg) / xs.length) * 100 : null, div: pos + neg ? 1 - Math.abs(pos - neg) / (pos + neg) : null };
  });
  const sen = usePolled<Senti>("ucNews.sentiment", tab === "div" ? { hours: 48 } : null, 120_000);
  const CATS = ["观点", "央行", "宏观", "债券", "美股", "A股", "港股", "外汇", "商品", "能源", "科技", "地缘"];
  const cats = (sen.data?.byCat ?? []).filter((c) => CATS.includes(c.key)).map((c) => ({ ...c, div: c.pos + c.neg ? 1 - Math.abs(c.pos - c.neg) / (c.pos + c.neg) : null }));
  const t = useTicks(TOPICS.map((x) => x.sym));
  const pack = useCloses(tab === "px" ? TOPICS.map((x) => x.sym) : [], 60);
  return (
    <PanelShell code="EXPM" title="观点监控与市场定价对照" onClose={onClose} tabs={[["feed", "观点流"], ["div", "情绪与分歧"], ["px", "观点 vs 定价"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["72 小时观点文章", String(feed.items.length)], ["偏多 / 偏空", `${feed.items.filter((n) => n.tone > 0).length} / ${feed.items.filter((n) => n.tone < 0).length}`], ["最集中主题", [...agg].sort((a, b) => b.n - a.n)[0]?.k ?? "—"], ["分歧最大主题", [...agg].filter((a) => a.n >= 4).sort((a, b) => (b.div ?? 0) - (a.div ?? 0))[0]?.k ?? "—"]]} />
      {tab === "feed" && <>
        <div className="flex items-center gap-2 px-2 py-1"><Seg value={topic} onChange={setTopic} options={[["全部", "全部"], ...TOPICS.map((x) => [x.k, x.k] as [string, string])]} /><span className="text-[10px] text-slate-500">{shown.length} 篇 · 点击标题在终端内阅读</span></div>
        <FeedList items={shown} loading={feed.loading} empty="近 72 小时该主题暂无观点文章" />
      </>}
      {tab === "div" && <>
        <SectionHead title="各主题观点倾向（近 72 小时观点文章）" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>主题</th><th className={TH}>篇数</th><th className={TH}>偏多</th><th className={TH}>偏空</th><th className={TH}>净倾向</th><th className={TH}>分歧度</th></tr></thead>
          <tbody>{agg.map((a) => <tr key={a.k} onClick={() => { setTopic(a.k); setTab("feed"); }} className={`${ROW} cursor-pointer`}><td className={`${TDL} text-slate-100`}>{a.k}</td><td className={`${TD} text-slate-300`}>{a.n}</td><td className={TD} style={{ color: UP }}>{a.pos}</td><td className={TD} style={{ color: DOWN }}>{a.neg}</td><td className={TD} style={{ background: heat(a.net, 60) }}>{f2(a.net, 0)}</td><td className={`${TD} text-amber-200`}>{f2(a.div, 2)}</td></tr>)}</tbody>
        </table>
        <SectionHead title="各资讯类别情绪指数（近 48 小时）" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>类别</th><th className={TH}>条数</th><th className={TH}>利好</th><th className={TH}>利空</th><th className={TH}>情绪指数</th><th className={TH}>分歧度</th></tr></thead>
          <tbody>{cats.map((c) => <tr key={c.key} className={ROW}><td className={`${TDL} text-slate-100`}>{c.key}</td><td className={`${TD} text-slate-300`}>{c.count}</td><td className={TD} style={{ color: UP }}>{c.pos}</td><td className={TD} style={{ color: DOWN }}>{c.neg}</td><td className={TD} style={{ background: heat(c.index, 60) }}>{c.index}</td><td className={`${TD} text-amber-200`}>{f2(c.div, 2)}</td></tr>)}{!cats.length && <tr><td colSpan={6}><Empty loading={sen.loading} /></td></tr>}</tbody>
        </table>
        <SectionHead title="全市场逐小时情绪净值" />
        {sen.data ? <Bars data={sen.data.series.map((s) => ({ k: new Date(s.t).getHours() + "时", v: s.pos - s.neg }))} fmt={(v) => v.toFixed(0)} height={110} /> : <Empty loading={sen.loading} />}
      </>}
      {tab === "px" && <>
        <Note>把每个主题的观点净倾向与对应市场的实际走势放在一起：方向一致说明观点已被定价，方向背离可能意味着观点领先或市场未认同。收益率类以收益率上行视为该主题“偏空”（债价下跌）。</Note>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>主题</th><th className={THL}>对应市场</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>3 日</th><th className={TH}>观点净倾向</th><th className={THL}>对照</th></tr></thead>
          <tbody>{agg.map((a) => {
            const c = (pack.data?.[a.sym] ?? []).map((x) => x[1]);
            const p3 = perf(c, 3);
            const mkt = p3 == null ? null : a.yieldLike ? -p3 : p3;
            const ok = mkt == null || a.net == null || Math.abs(a.net) < 10 ? null : Math.sign(mkt) === Math.sign(a.net);
            return (
              <tr key={a.k} className={ROW}>
                <td className={`${TDL} text-slate-100`}>{a.k}</td><td className={`${TDL} text-slate-400`}>{a.label}</td>
                <td className={`${TD} text-white`}>{a.yieldLike ? f2(yld(t[a.sym]?.price), 3, "%") : fmtPrice(t[a.sym]?.price)}</td>
                <td className={TD} style={{ color: toneOf(t[a.sym]?.changePct) }}>{fmtPct(t[a.sym]?.changePct)}</td>
                <td className={TD} style={{ color: toneOf(p3) }}>{sgn(p3, 2)}</td>
                <td className={TD} style={{ background: heat(a.net, 60) }}>{f2(a.net, 0)}</td>
                <td className={`${TDL} text-[10px]`} style={{ color: ok == null ? "#64748b" : ok ? "#22d3ee" : "#f59e0b" }}>{ok == null ? "观点中性 / 数据不足" : ok ? "一致" : "背离"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== GMM 全球宏观驱动者 */
const DRV: Array<[string, string, boolean]> = [["^TNX", "美 10 年收益率", true], ["DXY", "美元指数", false], ["CL", "原油", false], ["GC", "黄金", false], ["HG", "铜", false], ["HYG", "高收益信用", false], ["^VIX", "波动率", false], ["BTC", "比特币", false]];
const TGT: Array<[string, string]> = [["^GSPC", "标普 500"], ["^STOXX50E", "欧洲斯托克 50"], ["^N225", "日经 225"], ["^HSI", "恒生指数"], ["sh000300", "沪深 300"], ["EEM", "新兴市场"]];
/** 最小二乘：X 为 n×k（含常数项），返回系数 */
function ols(X: number[][], y: number[]) {
  const k = X[0]?.length ?? 0;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b]; A[a][k] += X[i][a] * y[i]; }
  for (let a = 0; a < k; a++) A[a][a] += 1e-12;
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-18) return null;
    for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j]; }
  }
  return A.map((row, i) => row[k] / row[i]);
}
export function MacroGMM({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const [win, setWin] = useState<"60" | "120" | "250">("120");
  const [tgt, setTgt] = useState("^GSPC");
  const syms = [...DRV.map((d) => d[0]), ...TGT.map((x) => x[0])];
  const pack = useCloses(syms, 520);
  const data = useMemo(() => {
    const a = align(pack.data ?? null, syms);
    const keep = a.dates.map((d, i) => ({ d, i })).filter(({ d }) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; });
    const dates = keep.map((x) => x.d);
    const lv: Record<string, number[]> = Object.fromEntries(syms.map((s) => [s, keep.map((x) => a.m[s][x.i])]));
    const chg: Record<string, number[]> = {};
    for (const s of syms) {
      const isY = DRV.find((d) => d[0] === s)?.[2];
      const c = lv[s];
      chg[s] = c.slice(1).map((v, i) => (isY ? ((yld(v) ?? 0) - (yld(c[i]) ?? 0)) * 100 : Math.log(v / c[i]) * 100));
    }
    return { dates, lv, chg };
  }, [pack.data]);
  const W = Number(win);
  const n = data.dates.length;
  const tail = (s: string, w = W) => data.chg[s]?.slice(-w) ?? [];
  const reg = useMemo(() => {
    const y = tail(tgt);
    if (y.length < 40) return null;
    const X = y.map((_, i) => [1, ...DRV.map(([s]) => tail(s)[i] ?? 0)]);
    const b = ols(X, y);
    if (!b) return null;
    const fit = X.map((r) => r.reduce((s, x, j) => s + x * b[j], 0));
    const my = mean(y);
    const r2 = 1 - y.reduce((s, v, i) => s + (v - fit[i]) ** 2, 0) / Math.max(1e-12, y.reduce((s, v) => s + (v - my) ** 2, 0));
    const L = 20;
    const contrib = DRV.map(([s, l], j) => ({ s, l, beta: b[j + 1], c: tail(s).slice(-L).reduce((acc, x) => acc + x * b[j + 1], 0) }));
    const actual = y.slice(-L).reduce((a2, v) => a2 + v, 0);
    const explained = contrib.reduce((a2, x) => a2 + x.c, 0);
    return { r2, contrib, actual, resid: actual - explained - b[0] * L, alpha: b[0] };
  }, [data, tgt, W]);
  const roll = (a: string, b: string, w = 60) => { const xa = data.chg[a] ?? [], xb = data.chg[b] ?? []; return xa.map((_, i) => (i + 1 >= w ? corr(xa.slice(i + 1 - w, i + 1), xb.slice(i + 1 - w, i + 1)) : null)); };
  const z20 = (s: string) => {
    const c = data.lv[s] ?? [];
    if (c.length < 120) return null;
    const isY = DRV.find((d) => d[0] === s)?.[2];
    const ch = c.slice(20).map((v, i) => (isY ? ((yld(v) ?? 0) - (yld(c[i]) ?? 0)) : Math.log(v / c[i])));
    const last = ch[ch.length - 1];
    const sd = std(ch.slice(-250));
    return sd ? (last - mean(ch.slice(-250))) / sd : null;
  };
  return (
    <PanelShell code="GMM" title="全球宏观市场驱动者" onClose={onClose} tabs={[["board", "驱动因子"], ["sens", "敏感度矩阵"], ["attr", "回归归因"], ["regime", "传导状态"]]} tab={tab} setTab={setTab} right={<span>样本 {n} 个交易日</span>}>
      {tab === "board" && <>
        <SectionHead title="八大宏观驱动因子实时" sub="20 日变动 Z 值：近 20 日变动相对过去一年 20 日变动分布的标准分，|Z| > 2 为极端" />
        <LiveBoard rows={DRV.map(([s, l]) => ({ symbol: s, label: l }))} extra={[{ head: "1月", cell: (s) => { const p = perf(data.lv[s] ?? [], 21); return <span style={{ color: toneOf(p) }}>{sgn(p, 1)}</span>; } }, { head: "20日Z", cell: (s) => { const z = z20(s); return <span style={{ background: heat(z, 3) }} className="px-1 text-white">{f2(z, 2)}</span>; } }]} />
        <SectionHead title="被驱动资产" />
        <LiveBoard rows={TGT.map(([s, l]) => ({ symbol: s, label: l }))} showMini={false} />
      </>}
      {tab === "sens" && <>
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-500">窗口<Seg value={win} onChange={setWin} options={[["60", "60 日"], ["120", "120 日"], ["250", "250 日"]]} /><span>单元格 = 日变动相关系数；括号内 = 驱动因子 1 个标准差变动对应的资产涨跌（%）</span></div>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>资产 \ 因子</th>{DRV.map(([, l]) => <th key={l} className={TH}>{l}</th>)}</tr></thead>
          <tbody>{TGT.map(([ts, tl]) => (
            <tr key={ts} className={ROW}><td className={`${TDL} text-slate-100`}>{tl}</td>{DRV.map(([ds]) => { const c = corr(tail(ts), tail(ds)); const imp = c != null ? c * std(tail(ts)) : null; return <td key={ds} className={TD} style={{ background: heat(c, 0.8) }}><div className="text-white">{f2(c, 2)}</div><div className="text-[9px] text-slate-300">({sgn(imp, 2)})</div></td>; })}</tr>
          ))}</tbody>
        </table>
        {pack.loading && <Empty loading />}
      </>}
      {tab === "attr" && <>
        <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[10px] text-slate-500">资产<Seg value={tgt} onChange={setTgt} options={TGT.map(([s, l]) => [s, l] as [string, string])} />回归窗口<Seg value={win} onChange={setWin} options={[["60", "60 日"], ["120", "120 日"], ["250", "250 日"]]} /></div>
        {reg ? <>
          <Kpis items={[["近 20 日实际涨跌", sgn(reg.actual, 2)], ["因子解释部分", sgn(reg.contrib.reduce((a, x) => a + x.c, 0), 2)], ["残差（特质部分）", sgn(reg.resid, 2)], ["拟合优度 R²", f2(reg.r2, 2)]]} />
          <SectionHead title="近 20 个交易日涨跌的因子贡献（%）" sub="收益率因子以基点计" />
          <Bars data={reg.contrib.map((x) => ({ k: x.l, v: x.c }))} fmt={(v) => `${v.toFixed(2)}%`} height={140} />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>因子</th><th className={TH}>回归系数</th><th className={TH}>20 日因子变动</th><th className={TH}>贡献 %</th></tr></thead>
            <tbody>{reg.contrib.map((x) => <tr key={x.s} className={ROW}><td className={`${TDL} text-slate-200`}>{x.l}</td><td className={`${TD} text-slate-300`}>{x.beta.toFixed(3)}</td><td className={`${TD} text-slate-400`}>{sgn(tail(x.s).slice(-20).reduce((a, v) => a + v, 0), 2, DRV.find((d) => d[0] === x.s)?.[2] ? "bp" : "%")}</td><td className={TD} style={{ color: toneOf(x.c) }}>{sgn(x.c, 2)}</td></tr>)}</tbody></table>
          <Note>多元线性回归：资产日收益（%）对八个因子的日变动（收益率为基点变动，其余为对数收益 %）在所选窗口内估计；系数为其他因子不变时的边际影响。</Note>
        </> : <Empty loading={pack.loading} text="样本不足" />}
      </>}
      {tab === "regime" && <>
        <SectionHead title="股债相关（标普日收益 vs 10 年收益率日变动，60 日滚动）" sub="正值：利率上行时股市上涨（增长驱动）；负值：利率上行压制股市（通胀 / 紧缩驱动）" />
        {n ? <Lines series={[{ name: "股债相关", color: "#fbbf24", values: roll("^GSPC", "^TNX") }, { name: "股汇相关（美元）", color: "#38bdf8", values: roll("^GSPC", "DXY") }, { name: "股与信用", color: "#a78bfa", values: roll("^GSPC", "HYG") }]} xLabels={data.dates.slice(1).map((d) => d.slice(2))} height={200} fmt={(v) => v.toFixed(2)} zero /> : <Empty loading={pack.loading} />}
        <SectionHead title="风险资产与避险资产（60 日滚动相关）" />
        {n ? <Lines series={[{ name: "标普 vs 黄金", color: "#f59e0b", values: roll("^GSPC", "GC") }, { name: "标普 vs 比特币", color: "#22d3ee", values: roll("^GSPC", "BTC") }, { name: "沪深 300 vs 铜", color: "#f472b6", values: roll("sh000300", "HG") }]} xLabels={data.dates.slice(1).map((d) => d.slice(2))} height={170} fmt={(v) => v.toFixed(2)} zero /> : null}
      </>}
    </PanelShell>
  );
}

/* ================================================================== MEDI 媒体资讯监测 */
type Stats = { total: number; last24h: number; lastHour: number; newest: number; channelsOk: number; channels: number; byCat: Record<string, number>; byRegion: Record<string, number> };
type Trends = { terms: Array<{ term: string; count: number; tone: number; momentum: number; hours: number[] }>; volume: Array<{ t: number; n: number; pos: number; neg: number }> };
export function MacroMEDI({ onClose }: P) {
  const [tab, setTab] = useState("flow");
  const [hours, setHours] = useState<"12" | "24" | "48">("24");
  const st = usePolled<Stats>("ucNews.stats", {}, 60_000);
  const tr = usePolled<Trends>("ucNews.trends", { hours: Number(hours) }, 120_000);
  const sen = usePolled<{ byRegion: Array<{ key: string; count: number; pos: number; neg: number; index: number }> }>("ucNews.sentiment", tab === "region" ? { hours: Number(hours) } : null, 120_000);
  const hot = useFeed(tab === "hot" ? { sort: "heat", limit: 60, hours: Number(hours) } : null, 60_000);
  const vol = tr.data?.volume ?? [];
  const cats = Object.entries(st.data?.byCat ?? {}).sort((a, b) => b[1] - a[1]);
  const regions = Object.entries(st.data?.byRegion ?? {}).sort((a, b) => b[1] - a[1]);
  const perHour = vol.length ? vol.reduce((a, b) => a + b.n, 0) / vol.length : null;
  const [sortT, setSortT] = useState<"count" | "momentum">("count");
  return (
    <PanelShell code="MEDI" title="媒体资讯监测" onClose={onClose} tabs={[["flow", "资讯流量"], ["terms", "热词追踪"], ["region", "地区分布"], ["hot", "热门报道"]]} tab={tab} setTab={setTab} right={<Seg value={hours} onChange={setHours} options={[["12", "12时"], ["24", "24时"], ["48", "48时"]]} />}>
      <Kpis items={[["近 1 小时", st.data ? String(st.data.lastHour) : "—", perHour != null ? `区间小时均值 ${perHour.toFixed(0)}` : undefined], ["近 24 小时", st.data ? String(st.data.last24h) : "—"], ["库内资讯", st.data ? String(st.data.total) : "—"], ["采集通道在线", st.data ? `${st.data.channelsOk}/${st.data.channels}` : "—", st.data?.newest ? `最新 ${new Date(st.data.newest).toLocaleTimeString("zh-CN", { hour12: false })}` : undefined]]} />
      {tab === "flow" && <>
        <SectionHead title="逐小时资讯量（红 = 利好，绿 = 利空）" />
        {vol.length ? <Bars data={vol.map((v) => ({ k: `${new Date(v.t).getHours()}时`, v: v.pos, v2: v.neg }))} fmt={(v) => v.toFixed(0)} height={130} label={["利好", "利空"]} /> : <Empty loading={tr.loading} />}
        <SectionHead title="逐小时总量" />
        {vol.length ? <Lines series={[{ name: "条数", color: "#38bdf8", values: vol.map((v) => v.n) }, { name: "情绪净值", color: "#fbbf24", values: vol.map((v) => v.pos - v.neg) }]} xLabels={vol.map((v) => `${new Date(v.t).getHours()}时`)} height={140} fmt={(v) => v.toFixed(0)} zero /> : null}
        <SectionHead title="近 24 小时类别分布" />
        <table className="w-full text-[11px]"><tbody>{cats.map(([k, v]) => <tr key={k} className={ROW}><td className={`${TDL} w-24 text-slate-200`}>{k}</td><td className={`${TD} w-16 text-white`}>{v}</td><td className="px-2"><div className="h-2 bg-cyan-700/70" style={{ width: `${(v / (cats[0]?.[1] || 1)) * 100}%` }} /></td></tr>)}{!cats.length && <tr><td><Empty loading={st.loading} /></td></tr>}</tbody></table>
      </>}
      {tab === "terms" && <>
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-500">排序<Seg value={sortT} onChange={setSortT} options={[["count", "热度"], ["momentum", "升温速度"]]} /><span>升温 = 最近 1/4 区间出现次数 − 最早 1/4 区间出现次数</span></div>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>#</th><th className={THL}>热词</th><th className={TH}>出现</th><th className={TH}>升温</th><th className={TH}>情绪</th><th className="px-2 text-left font-normal">逐小时</th></tr></thead>
          <tbody>{[...(tr.data?.terms ?? [])].sort((a, b) => b[sortT] - a[sortT]).slice(0, 50).map((x, i) => <tr key={x.term} className={ROW}><td className={`${TDL} font-mono text-slate-600`}>{i + 1}</td><td className={`${TDL} text-slate-100`}>{x.term}</td><td className={`${TD} text-white`}>{x.count}</td><td className={TD} style={{ color: toneOf(x.momentum) }}>{x.momentum > 0 ? `+${x.momentum}` : x.momentum}</td><td className={TD} style={{ color: toneOf(x.tone) }}>{x.tone.toFixed(2)}</td><td className="px-2"><Spark values={x.hours} width={120} color={x.momentum > 0 ? UP : "#38bdf8"} /></td></tr>)}{!tr.data && <tr><td colSpan={6}><Empty loading={tr.loading} /></td></tr>}</tbody>
        </table>
      </>}
      {tab === "region" && <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>地区</th><th className={TH}>近 24 小时条数</th><th className={TH}>区间条数</th><th className={TH}>利好</th><th className={TH}>利空</th><th className={TH}>情绪指数</th></tr></thead>
          <tbody>{regions.map(([k, v]) => { const s = sen.data?.byRegion.find((x) => x.key === k); return <tr key={k} className={ROW}><td className={`${TDL} text-slate-100`}>{k || "其他"}</td><td className={`${TD} text-white`}>{v}</td><td className={`${TD} text-slate-300`}>{s?.count ?? "—"}</td><td className={TD} style={{ color: UP }}>{s?.pos ?? "—"}</td><td className={TD} style={{ color: DOWN }}>{s?.neg ?? "—"}</td><td className={TD} style={{ background: heat(s?.index, 60) }}>{s?.index ?? "—"}</td></tr>; })}{!regions.length && <tr><td colSpan={6}><Empty loading={st.loading} /></td></tr>}</tbody>
        </table>
        <Note>情绪指数 = （利好条数 − 利空条数）÷ 总条数 × 100。</Note>
      </>}
      {tab === "hot" && <FeedList items={hot.items} loading={hot.loading} ranked empty="暂无热门报道" />}
    </PanelShell>
  );
}

/* ================================================================== HELP_INDX 指数中心功能索引 */
const FUNCS: Array<{ code: string; name: string; cat: string; desc: string; sym?: string }> = [
  { code: "SECF", name: "全球证券检索", cat: "检索与行情", desc: "按名称 / 代码 / 行业关键词检索全球股票、ETF、指数、期货、外汇与加密资产，查看概要与实时报价。", sym: "^GSPC" },
  { code: "IN", name: "指数检索与走势", cat: "检索与行情", desc: "查找指数并查看历史走势。", sym: "^NDX" },
  { code: "WT", name: "指数实时走势", cat: "检索与行情", desc: "主要指数分时与日内走势。", sym: "^DJI" },
  { code: "WEIF", name: "全球股指期货与基差", cat: "衍生品", desc: "期货与现货的实时基差、各季月合约价格与期现相关。", sym: "ES" },
  { code: "INDEX_DERIV", name: "指数期权总览", cat: "衍生品", desc: "指数期权链、隐含波动率期限结构与持仓分布。", sym: "^VIX" },
  { code: "WBIX", name: "全球债券指数", cat: "固收与宏观", desc: "全球债券指数代理的区间收益、波动与最大回撤。", sym: "AGG" },
  { code: "BBG", name: "债券 · 商品 · 通胀指数族", cat: "固收与宏观", desc: "债券、商品、通胀挂钩指数族横向比较。", sym: "TIP" },
  { code: "FDFD", name: "议息会议利率概率", cat: "固收与宏观", desc: "由利率期货推算的各次议息会议利率路径与概率。", sym: "^IRX" },
  { code: "GMM", name: "全球宏观异动", cat: "固收与宏观", desc: "找出全球显著异动资产。", sym: "DXY" },
  { code: "RRG", name: "相对旋转图", cat: "相对强弱", desc: "行业 / 国家 / 资产相对基准的强度与动量四象限轮动。", sym: "XLK" },
  { code: "OTHER_INDEX", name: "因子 / 加权 / 主题指数", cat: "相对强弱", desc: "因子、等权、主题与可持续指数的表现比较。", sym: "MTUM" },
  { code: "AGG", name: "自建合成指数", cat: "自定义指数", desc: "自选成分与权重合成指数，定义永久保存，并与标普对比。" },
  { code: "CIX", name: "自定义组合指数", cat: "自定义指数", desc: "组合多个标的生成自定义序列。" },
  { code: "CIXB", name: "行情篮子与权重快照", cat: "自定义指数", desc: "构建标的篮子并记录权重快照。" },
  { code: "CIXN", name: "行情表达式计算器", cat: "工具", desc: "对实时行情做四则运算表达式计算。" },
  { code: "CIXS", name: "双腿报价差值工具", cat: "工具", desc: "两个标的的价差实时计算。" },
  { code: "CIXR", name: "相对价格比率", cat: "工具", desc: "两个标的的价格比率。" },
  { code: "CIXC", name: "行情单位换算", cat: "工具", desc: "价格单位与币种换算。" },
  { code: "CIXX", name: "本地 CSV 时间序列导入", cat: "工具", desc: "导入本地 CSV 时间序列。" },
  { code: "CIXI", name: "手工时间序列与版本快照", cat: "工具", desc: "手工录入时间序列并保存版本。" },
  { code: "INP", name: "可下载市场快照", cat: "工具", desc: "导出当前市场快照。" },
];
type Plat = { areas: Array<{ area: string; n: number; avg?: number; ms?: number; err: number }>; feeds: { total: number; online: number }; uptimeSec: number; streamClients: number };
export function MacroHELPINDX({ onClose }: P) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("全部");
  const saved = useSaved<string[]>("helpidx");
  const [favs, setFavs] = useState<string[] | null>(null);
  const fav = favs ?? saved.data ?? [];
  const toggle = (c: string) => { const next = fav.includes(c) ? fav.filter((x) => x !== c) : [...fav, c]; setFavs(next); void saveItem("helpidx", next); };
  const cats = ["全部", "收藏", ...new Set(FUNCS.map((f) => f.cat))];
  const list = FUNCS.filter((f) => (cat === "全部" || (cat === "收藏" ? fav.includes(f.code) : f.cat === cat)) && (!q || `${f.code} ${f.name} ${f.desc}`.toLowerCase().includes(q.toLowerCase())));
  const t = useTicks(FUNCS.filter((f) => f.sym).map((f) => f.sym!));
  const plat = usePolled<Plat>("ucHubs.platform", {}, 30_000);
  const open = (code: string) => window.location.assign(`/index-hub?panel=${code}`);
  return (
    <PanelShell code="HELP INDX" title="指数中心功能索引" onClose={onClose} right={<span>收藏永久保存</span>}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索功能代码 / 名称 / 说明" className="w-64 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" />
        <Seg value={cat} onChange={setCat} options={cats.map((c) => [c, c] as [string, string])} />
        <span className="text-[10px] text-slate-500">{list.length} 项 · 点击“打开”进入功能</span>
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>代码</th><th className={THL}>功能</th><th className={THL}>类别</th><th className={THL}>说明</th><th className={TH}>代表标的</th><th className={TH}>涨跌幅</th><th className={TH} /></tr></thead>
        <tbody>{list.map((f) => (
          <tr key={f.code} className={ROW}>
            <td className={`${TDL} font-mono text-amber-300`}>{f.code}</td>
            <td className={`${TDL} text-slate-100`}>{f.name}</td>
            <td className={`${TDL} text-[10px] text-slate-500`}>{f.cat}</td>
            <td className={`${TDL} text-[10px] text-slate-400`}>{f.desc}</td>
            <td className={`${TD} text-white`}>{f.sym ? <><span className="mr-1 text-[9px] text-slate-500">{f.sym}</span>{fmtPrice(t[f.sym]?.price)}</> : "—"}</td>
            <td className={TD} style={{ color: toneOf(f.sym ? t[f.sym]?.changePct : null) }}>{f.sym ? fmtPct(t[f.sym]?.changePct) : ""}</td>
            <td className="whitespace-nowrap px-2 text-right">
              <button type="button" onClick={() => toggle(f.code)} className={`mr-1 border px-1.5 text-[10px] ${fav.includes(f.code) ? "border-amber-500 text-amber-300" : "border-[#1d3047] text-slate-500"}`}>{fav.includes(f.code) ? "★ 已收藏" : "☆ 收藏"}</button>
              <button type="button" onClick={() => open(f.code)} className="border border-cyan-700 px-1.5 text-[10px] text-cyan-200 hover:bg-[#0a1726]">打开</button>
            </td>
          </tr>
        ))}{!list.length && <tr><td colSpan={7}><Empty text={cat === "收藏" ? "尚未收藏任何功能" : "无匹配功能"} /></td></tr>}</tbody>
      </table>
      <SectionHead title="平台运行状态" sub="各数据区接口调用量、平均延迟与错误数（本次服务运行以来）" />
      {plat.data ? <>
        <Kpis items={[["已运行", `${(plat.data.uptimeSec / 3600).toFixed(1)} 小时`], ["实时推送连接", String(plat.data.streamClients)], ["资讯通道在线", `${plat.data.feeds.online}/${plat.data.feeds.total}`], ["接口调用总数", String(plat.data.areas.reduce((a, x) => a + x.n, 0))]]} />
        <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>数据区</th><th className={TH}>调用</th><th className={TH}>平均延迟</th><th className={TH}>错误</th></tr></thead>
          <tbody>{plat.data.areas.map((a) => { const avg = a.avg ?? (a.ms != null && a.n ? a.ms / a.n : null); return <tr key={a.area} className={ROW}><td className={`${TDL} text-slate-200`}>{a.area}</td><td className={`${TD} text-white`}>{a.n}</td><td className={`${TD} text-slate-300`}>{avg != null ? `${avg.toFixed(0)}ms` : "—"}</td><td className={TD} style={{ color: a.err ? DOWN : "#64748b" }}>{a.err}</td></tr>; })}</tbody></table>
      </> : <Empty loading={plat.loading} />}
    </PanelShell>
  );
}
