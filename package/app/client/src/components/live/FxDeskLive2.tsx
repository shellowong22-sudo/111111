/**
 * 外汇窗口（第二组，全部实时 / 真实数据计算，分析角度与其他外汇功能互不重复）：
 *  - MARS FX 外汇组合风险：个人外汇头寸（永久保存）按货币净敞口、历史模拟 VaR / ES、历史压力情景回放、边际风险贡献
 *  - TOP FX  货币新闻热度与情绪：各货币在新闻中的提及量、情绪均值、24 小时变化，点开看该货币的高热度头条
 *  - BICO    行业的货币敏感度：美股 / A 股行业对美元指数与人民币汇率的 Beta、相关，以及当前汇率环境下的受益 / 受损行业
 *  - MYQ     个人外汇监控：自选货币对与提醒价位（永久保存），距提醒距离、日内区间、平均真实波幅
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtPct, toneOf, useTicks } from "@/uc/market/live";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, f2, gbs, heat, mean, perf, rets, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, INP, MiniLine, Note, RangeBar, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";
import { fmtRate } from "./RatesFxLive3";
import { FX_CCYS, useCbRates, type Ccy } from "./FxDeskLive";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
const USD: Ccy = { c: "USD", zh: "美元", sym: "DXY", inv: false, r: "美洲", cb: "US", g10: true };
const ALL = [USD, ...FX_CCYS];
const zhOf = (c: string) => ALL.find((x) => x.c === c)?.zh ?? c;
/** 常用货币对（报价代码即行情代码） */
const PAIRS = ["EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "USDCNH", "EURJPY", "EURGBP", "EURCHF", "GBPJPY", "AUDJPY", "EURCNH", "USDHKD", "USDSGD", "USDKRW", "USDINR", "USDBRL", "USDMXN", "USDZAR", "USDTRY"];
const legs = (p: string) => [p.slice(0, 3), p.slice(3, 6)] as [string, string];

/* ================================================================== MARS FX 外汇组合风险 */
type Pos = { pair: string; amt: number };
const DEFAULT_POS: Pos[] = [{ pair: "EURUSD", amt: 1_000_000 }, { pair: "USDJPY", amt: -500_000 }, { pair: "AUDUSD", amt: 800_000 }, { pair: "USDCNH", amt: 600_000 }];
const EPISODES: Array<[string, string, string]> = [["2015-08-10", "2015-08-25", "2015 年人民币汇改"], ["2016-06-22", "2016-06-28", "英国脱欧公投"], ["2020-03-06", "2020-03-23", "2020 年疫情流动性冲击"], ["2022-09-20", "2022-09-28", "2022 年英国减税风波"], ["2024-07-29", "2024-08-06", "2024 年日元套息平仓"], ["2025-04-01", "2025-04-10", "2025 年关税冲击"]];
export function MarsFxLive({ onClose }: P) {
  const saved = useSaved<{ pos: Pos[] }>("marsfx-positions");
  const [pos, setPos] = useState<Pos[]>(DEFAULT_POS);
  const [draft, setDraft] = useState({ pair: "EURUSD", amt: "" });
  const [conf, setConf] = useState<"95" | "99">("99");
  useEffect(() => { if (saved.data?.pos?.length) setPos(saved.data.pos); }, [saved.data]);
  const syms = [...new Set(pos.map((p) => p.pair))];
  const ticks = useTicks(syms);
  const pack = useCloses(syms, 2600);
  const persist = async (next: Pos[]) => { setPos(next); try { await saveItem("marsfx-positions", { pos: next }); } catch { toast.error("保存失败"); } };
  /** 头寸美元价值：以基础货币计的名义本金 → 美元 */
  const usdOf = (p: Pos, px: number | null | undefined) => { if (!px) return null; const [b, q] = legs(p.pair); if (b === "USD") return p.amt; if (q === "USD") return p.amt * px; const qUsd = ticks[`USD${q}`]?.price; return qUsd ? (p.amt * px) / qUsd : null; };
  const model = useMemo(() => {
    if (!pack.data || !pos.length) return null;
    const al = align(pack.data, syms);
    if (al.dates.length < 300) return null;
    const lastPx = Object.fromEntries(syms.map((s) => [s, al.m[s][al.m[s].length - 1]]));
    // 每日组合损益（美元近似）= Σ 头寸美元价值 × 报价日收益
    const val = pos.map((p) => usdOf(p, ticks[p.pair]?.price ?? lastPx[p.pair]) ?? 0);
    const pr = syms.reduce<Record<string, number[]>>((o, s) => { const c = al.m[s]; o[s] = c.slice(1).map((v, i) => v / c[i] - 1); return o; }, {});
    const pnl = al.dates.slice(1).map((_, i) => pos.reduce((s, p, j) => s + val[j] * pr[p.pair][i], 0));
    const win = pnl.slice(-500);
    const sorted = [...win].sort((a, b) => a - b);
    const q = conf === "99" ? 0.01 : 0.05;
    const idx = Math.max(0, Math.floor(q * sorted.length) - 1);
    const varv = -sorted[idx], es = -mean(sorted.slice(0, idx + 1));
    const vol = std(win) * Math.sqrt(252);
    // 边际贡献：头寸日损益与组合日损益的协方差 / 组合方差 × VaR
    const pv = std(win) ** 2;
    const contrib = pos.map((p, j) => { const x = pr[p.pair].slice(-500).map((r) => r * val[j]); const mx = mean(x), mp = mean(win); const cov = x.reduce((s, v, i) => s + (v - mx) * (win[i] - mp), 0) / (x.length - 1); return pv > 0 ? (cov / pv) * varv : 0; });
    const eps = EPISODES.map(([a, b, name]) => { const ia = al.dates.findIndex((d) => d >= a), ib = al.dates.findIndex((d) => d >= b); if (ia < 0 || ib <= ia) return { name, v: null as number | null }; return { name, v: pos.reduce((s, p, j) => s + val[j] * (al.m[p.pair][ib] / al.m[p.pair][ia] - 1), 0) }; });
    // 按货币净敞口（美元）
    const net: Record<string, number> = {};
    pos.forEach((p, j) => { const [b, qq] = legs(p.pair); const u = val[j]; net[b] = (net[b] ?? 0) + u; net[qq] = (net[qq] ?? 0) - u; });
    const cum: number[] = []; win.reduce((s, v) => { cum.push(s + v); return s + v; }, 0);
    return { val, varv, es, vol, contrib, eps, net, cum, dates: al.dates.slice(-win.length), gross: val.reduce((s, v) => s + Math.abs(v), 0) };
  }, [pack.data, pos, conf, ticks]);
  const add = () => { const a = Number(draft.amt.replace(/,/g, "")); if (!a) { toast.error("请输入名义本金（做空填负数）"); return; } void persist([...pos.filter((p) => p.pair !== draft.pair), { pair: draft.pair, amt: a }]); setDraft({ ...draft, amt: "" }); };
  const usd = (v: number | null | undefined) => (v == null ? "—" : `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  return (
    <PanelShell code="MARS FX" title="外汇组合风险" onClose={onClose} right={<span className="flex items-center gap-1 text-[10px] text-slate-500">置信度 <Seg value={conf} options={[["95", "95%"], ["99", "99%"]]} onChange={setConf} /></span>}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <select value={draft.pair} onChange={(e) => setDraft({ ...draft, pair: e.target.value })} className={INP}>{PAIRS.map((p) => <option key={p}>{p}</option>)}</select>
        <input value={draft.amt} onChange={(e) => setDraft({ ...draft, amt: e.target.value })} placeholder="名义本金（基础货币，空头为负）" className={`${INP} w-52`} />
        <button type="button" onClick={add} className={BTN}>添加 / 更新头寸</button>
        <span className="text-[10px] text-slate-500">头寸永久保存在你的个人账户</span>
      </div>
      <Kpis items={[["总名义（美元）", usd(model?.gross)], [`1 日 VaR（${conf}%）`, usd(model?.varv)], [`1 日 ES（${conf}%）`, usd(model?.es)], ["年化损益波动", usd(model?.vol)], ["VaR / 总名义", model?.gross ? `${((model.varv / model.gross) * 100).toFixed(2)}%` : "—"]]} />
      {!model ? <Empty loading={pack.loading} text="请添加头寸" /> : (
        <>
          <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
            <div className="bg-[#03070c]">
              <SectionHead title="头寸与边际风险贡献" />
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-slate-500"><tr><th className={THL}>货币对</th><th className={TH}>名义本金</th><th className={TH}>实时</th><th className={TH}>今日</th><th className={TH}>美元价值</th><th className={TH}>今日损益</th><th className={TH}>VaR 贡献</th><th className={TH} /></tr></thead>
                <tbody>{pos.map((p, j) => { const t = ticks[p.pair]; return (
                  <tr key={p.pair} className={ROW}>
                    <td className={`${TDL} font-mono text-cyan-200`}>{p.pair}</td><td className={TD} style={{ color: toneOf(p.amt) }}>{p.amt.toLocaleString("en-US")}</td>
                    <td className={`${TD} text-white`}>{fmtRate(t?.price)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
                    <td className={`${TD} text-slate-300`}>{usd(model.val[j])}</td>
                    <td className={TD} style={{ color: toneOf(t?.changePct != null ? model.val[j] * t.changePct : null) }}>{t?.changePct == null ? "—" : usd((model.val[j] * t.changePct) / 100)}</td>
                    <td className={`${TD} text-slate-200`}>{usd(model.contrib[j])}</td>
                    <td className={TD}><button type="button" onClick={() => void persist(pos.filter((x) => x.pair !== p.pair))} className="text-[10px] text-slate-500 hover:text-rose-300">移除</button></td>
                  </tr>); })}</tbody>
              </table>
              <SectionHead title="按货币的净敞口（美元）" />
              <Bars data={Object.entries(model.net).filter(([c]) => c !== "USD").map(([c, v]) => ({ k: zhOf(c), v })).sort((a, b) => b.v - a.v)} fmt={(v) => usd(v)} height={110} />
            </div>
            <div className="bg-[#03070c]">
              <SectionHead title="历史压力情景回放" sub="按当前头寸回放真实历史区间的汇率变动" />
              <table className="w-full text-[11px]"><tbody>{model.eps.map((e) => <tr key={e.name} className={ROW}><td className={`${TDL} text-slate-300`}>{e.name}</td><td className={TD} style={{ color: toneOf(e.v) }}>{e.v == null ? "无数据" : usd(e.v)}</td></tr>)}</tbody></table>
              <SectionHead title="当前头寸的近 2 年模拟累计损益" />
              <Lines height={150} zero xLabels={model.dates} fmt={(v) => usd(v)} series={[{ name: "累计损益", color: COLORS[0], values: model.cum }]} />
            </div>
          </div>
          <Note>历史模拟法：以近 500 个交易日的真实汇率日收益作用于当前头寸；美元价值按实时汇率折算，非美元交叉盘经美元腿换算。边际贡献之和等于组合 VaR。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== TOP FX 货币新闻热度与情绪 */
const KW: Record<string, RegExp> = {
  USD: /美元|美联储|\bUSD\b|dollar|\bFed\b|Powell|鲍威尔/i, EUR: /欧元|欧洲央行|\bEUR\b|\beuro\b|\bECB\b|Lagarde|拉加德/i, JPY: /日元|日本央行|日银|\bJPY\b|\byen\b|\bBOJ\b|植田/i,
  GBP: /英镑|英国央行|英格兰银行|\bGBP\b|sterling|\bpound\b|\bBOE\b/i, CHF: /瑞郎|瑞士法郎|瑞士央行|\bCHF\b|\bSNB\b/i, AUD: /澳元|澳洲联储|澳大利亚央行|\bAUD\b|\bRBA\b|Aussie/i,
  NZD: /纽元|新西兰元|新西兰联储|\bNZD\b|\bRBNZ\b|kiwi/i, CAD: /加元|加拿大央行|\bCAD\b|loonie|\bBOC\b/i, CNH: /人民币|中国人民银行|央行.*中间价|\bCNY\b|\bCNH\b|\byuan\b|\bPBOC\b|renminbi/i,
  HKD: /港元|港币|金管局|\bHKD\b|\bHKMA\b/i, KRW: /韩元|韩国央行|\bKRW\b|\bwon\b/i, INR: /卢比|印度央行|\bINR\b|rupee|\bRBI\b/i, MXN: /墨西哥比索|\bMXN\b|peso/i, BRL: /雷亚尔|\bBRL\b|\breal\b.*Brazil/i, TRY: /里拉|\bTRY\b|\blira\b/i,
};
export function TopFxLive({ onClose }: P) {
  const [sel, setSel] = useState("USD");
  const feed = useFeed({ cats: ["外汇", "央行", "宏观"], hours: 72, limit: 400, sort: "time" }, 120_000);
  const now = Date.now();
  const stat = useMemo(() => Object.entries(KW).map(([c, re]) => {
    const hits = feed.items.filter((n) => re.test(n.title) || (n.summary ? re.test(n.summary) : false));
    const d1 = hits.filter((n) => now - n.time < 24 * 3600_000), d0 = hits.filter((n) => now - n.time >= 24 * 3600_000 && now - n.time < 48 * 3600_000);
    const hourly = Array.from({ length: 24 }, (_, h) => hits.filter((n) => now - n.time >= (23 - h) * 3600_000 * 3 && now - n.time < (24 - h) * 3600_000 * 3).length);
    const tone = d1.length ? mean(d1.map((n) => n.tone)) : null;
    return { c, hits, n24: d1.length, n72: hits.length, chg: d1.length - d0.length, tone, pos: d1.filter((n) => n.tone > 0).length, neg: d1.filter((n) => n.tone < 0).length, heat: d1.reduce((s, n) => s + (n.heat ?? 0), 0), hourly };
  }).sort((a, b) => b.n24 - a.n24), [feed.items]);
  const cur = stat.find((x) => x.c === sel);
  const top = (cur?.hits ?? []).filter((n) => now - n.time < 48 * 3600_000).sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0)).slice(0, 30);
  return (
    <PanelShell code="TOP FX" title="货币新闻热度与情绪" onClose={onClose}>
      <Kpis items={[["样本（72 小时）", String(feed.items.length)], ["24 小时最受关注", stat[0] ? `${zhOf(stat[0].c)}（${stat[0].n24}）` : "—"], ["关注度升温最快", [...stat].sort((a, b) => b.chg - a.chg)[0] ? zhOf([...stat].sort((a, b) => b.chg - a.chg)[0].c) : "—"], ["情绪最偏负面", [...stat].filter((x) => x.tone != null).sort((a, b) => a.tone! - b.tone!)[0] ? zhOf([...stat].filter((x) => x.tone != null).sort((a, b) => a.tone! - b.tone!)[0].c) : "—"]]} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]">
          <table className="w-full text-[11px]">
            <thead className={thead}><tr><th className={THL}>货币</th><th className={TH}>24 小时提及</th><th className={TH}>较前 24 小时</th><th className={TH}>72 小时</th><th className={TH}>正面 / 负面</th><th className={TH}>情绪均值</th><th className={TH}>热度</th><th className={TH}>72 小时分布</th></tr></thead>
            <tbody>{stat.map((x) => (
              <tr key={x.c} onClick={() => setSel(x.c)} className={`${ROW} cursor-pointer ${sel === x.c ? "bg-[#0d2236]" : ""}`}>
                <td className={`${TDL} text-slate-100`}>{zhOf(x.c)} <span className="font-mono text-[10px] text-slate-500">{x.c}</span></td>
                <td className={`${TD} text-white`}>{x.n24}</td>
                <td className={TD} style={{ color: toneOf(x.chg) }}>{x.chg > 0 ? `+${x.chg}` : x.chg}</td>
                <td className={`${TD} text-slate-400`}>{x.n72}</td>
                <td className={TD}><span style={{ color: "#f2495c" }}>{x.pos}</span> / <span style={{ color: "#1fbf75" }}>{x.neg}</span></td>
                <td className={TD} style={{ color: toneOf(x.tone), background: heat(x.tone, 1) }}>{f2(x.tone)}</td>
                <td className={`${TD} text-slate-300`}>{x.heat ? x.heat.toFixed(0) : "—"}</td>
                <td className={TD}><MiniLine values={x.hourly} w={90} color="#fbbf24" /></td>
              </tr>
            ))}{!feed.items.length && <tr><td colSpan={8}><Empty loading={feed.loading} /></td></tr>}</tbody>
          </table>
          <Note>按标题与摘要识别货币、对应央行及官员名称；情绪均值取 −1（负面）~ +1（正面）；分布为 72 小时内每 3 小时的提及量。</Note>
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title={`${zhOf(sel)} · 近 48 小时高热度报道`} sub="按多源转载热度排序，点击在终端内阅读" />
          <FeedList items={top} loading={feed.loading} ranked dense empty="近 48 小时没有相关报道" />
        </div>
      </div>
    </PanelShell>
  );
}

/* ================================================================== BICO 行业的货币敏感度 */
const SECTORS: Array<[string, string, string]> = [
  ["XLK", "信息技术", "美股"], ["XLE", "能源", "美股"], ["XLF", "金融", "美股"], ["XLI", "工业", "美股"], ["XLB", "原材料", "美股"], ["XLY", "可选消费", "美股"],
  ["XLP", "必需消费", "美股"], ["XLV", "医疗保健", "美股"], ["XLU", "公用事业", "美股"], ["XLRE", "房地产", "美股"], ["XLC", "通信服务", "美股"],
  ["sh512480", "半导体", "A股"], ["sh512880", "证券", "A股"], ["sh512800", "银行", "A股"], ["sh515220", "煤炭", "A股"], ["sh512400", "有色金属", "A股"], ["sh512690", "白酒", "A股"],
  ["sh512010", "医药", "A股"], ["sh515030", "新能源车", "A股"], ["sh512660", "军工", "A股"], ["sz159865", "养殖", "A股"],
];
export function BicoLive({ onClose }: P) {
  const [mkt, setMkt] = useState<"美股" | "A股">("美股");
  const [win, setWin] = useState<"126" | "252">("252");
  const list = SECTORS.filter((s) => s[2] === mkt);
  const fx = mkt === "美股" ? "DXY" : "USDCNH";
  const bench = mkt === "美股" ? "^GSPC" : "sh000300";
  const pack = useCloses([...list.map((s) => s[0]), fx, bench], 600);
  const ticks = useTicks([fx]);
  const res = useMemo(() => {
    if (!pack.data) return null;
    const n = Number(win) + 1;
    const fxc = (pack.data[fx] ?? []).map((x) => x[1]);
    const fx1m = perf(fxc, 21);
    return { fx1m, rows: list.map(([s, name]) => {
      const al = align(pack.data, [s, fx, bench]);
      if (al.dates.length < 80) return { s, name, b: null, c: null, ex: null, roll: [] as Array<number | null>, m1: null };
      const rs = rets(al.m[s].slice(-n)), rf = rets(al.m[fx].slice(-n)), rb = rets(al.m[bench].slice(-n));
      // 剔除大盘后的汇率 Beta：对 [汇率, 大盘] 做二元回归，取汇率系数
      const mfx = mean(rf), mb = mean(rb), ms = mean(rs);
      let sff = 0, sbb = 0, sfb = 0, sfy = 0, sby = 0;
      for (let i = 0; i < rs.length; i++) { const a = rf[i] - mfx, b = rb[i] - mb, y = rs[i] - ms; sff += a * a; sbb += b * b; sfb += a * b; sfy += a * y; sby += b * y; }
      const det = sff * sbb - sfb * sfb;
      const ex = det ? (sfy * sbb - sby * sfb) / det : null;
      const b = sff ? sfy / sff : null;
      const all = rets(al.m[s]), allf = rets(al.m[fx]);
      const roll: Array<number | null> = [];
      for (let i = 60; i <= all.length; i += 5) roll.push(corr(all.slice(i - 60, i), allf.slice(i - 60, i)));
      return { s, name, b, c: corr(rs, rf), ex, roll, m1: perf(al.m[s], 21) };
    }) };
  }, [pack.data, mkt, win]);
  const fxName = mkt === "美股" ? "美元指数" : "美元兑离岸人民币";
  return (
    <PanelShell code="BICO" title="行业的货币敏感度" onClose={onClose} right={<span className="flex items-center gap-1 text-[10px] text-slate-500"><Seg value={mkt} options={[["美股", "美股行业"], ["A股", "A股行业"]]} onChange={setMkt} /> 窗口 <Seg value={win} options={[["126", "6 月"], ["252", "1 年"]]} onChange={setWin} /></span>}>
      <Kpis items={[[fxName, fmtRate(ticks[fx]?.price), fmtPct(ticks[fx]?.changePct)], [`${fxName} 近 1 月`, sgn(res?.fx1m)], ["当前环境受益（剔除大盘 Beta 同向）", (res?.rows ?? []).filter((r) => r.ex != null && res!.fx1m != null && Math.sign(r.ex) === Math.sign(res!.fx1m) && Math.abs(r.ex) > 0.1).map((r) => r.name).slice(0, 4).join("、") || "—"]]} />
      {!res ? <Empty loading={pack.loading} /> : (
        <>
          <table className="w-full text-[11px]">
            <thead className={thead}><tr><th className={THL}>行业</th><th className={TH}>汇率 Beta</th><th className={TH}>剔除大盘后的汇率 Beta</th><th className={TH}>与汇率相关</th><th className={THL}>方向</th><th className={TH}>行业近 1 月</th><th className={TH}>60 日滚动相关</th></tr></thead>
            <tbody>{[...res.rows].sort((a, b) => (b.ex ?? -9) - (a.ex ?? -9)).map((r) => (
              <tr key={r.s} className={ROW}>
                <td className={`${TDL} text-slate-100`}>{r.name} <span className="font-mono text-[10px] text-slate-500">{r.s}</span></td>
                <td className={`${TD} text-slate-300`}>{f2(r.b)}</td>
                <td className={TD} style={{ color: toneOf(r.ex), background: heat(r.ex, 1) }}>{f2(r.ex)}</td>
                <td className={`${TD} text-slate-300`}>{f2(r.c)}</td>
                <td className={`${TDL} text-[10px] text-slate-400`}>{r.ex == null ? "—" : mkt === "美股" ? (r.ex > 0.1 ? "美元走强时相对占优" : r.ex < -0.1 ? "美元走弱时相对占优" : "汇率中性") : (r.ex > 0.1 ? "人民币贬值时相对占优" : r.ex < -0.1 ? "人民币升值时相对占优" : "汇率中性")}</td>
                <td className={TD} style={{ color: toneOf(r.m1) }}>{sgn(r.m1)}</td>
                <td className={TD}><MiniLine values={r.roll} w={90} /></td>
              </tr>
            ))}</tbody>
          </table>
          <SectionHead title="剔除大盘后的汇率 Beta" />
          <Bars data={res.rows.filter((r) => r.ex != null).map((r) => ({ k: r.name, v: r.ex! })).sort((a, b) => b.v - a.v)} fmt={(v) => v.toFixed(2)} height={140} />
          <Note>美股行业用行业 ETF、A 股行业用对应行业 ETF 代表；Beta 为日对数收益回归系数。A 股以「美元兑离岸人民币」为汇率因子：正值表示人民币贬值时该行业相对受益（如出口型行业）。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== MYQ 个人外汇监控 */
type Watch = { pair: string; up: number | null; dn: number | null; note: string };
const DEFAULT_WATCH: Watch[] = [{ pair: "EURUSD", up: null, dn: null, note: "" }, { pair: "USDJPY", up: null, dn: null, note: "" }, { pair: "USDCNH", up: null, dn: null, note: "" }];
export function MyqLive({ onClose }: P) {
  const saved = useSaved<{ items: Watch[] }>("myq-fx");
  const [items, setItems] = useState<Watch[]>(DEFAULT_WATCH);
  const [add, setAdd] = useState("GBPUSD");
  const [edit, setEdit] = useState<{ i: number; up: string; dn: string; note: string } | null>(null);
  useEffect(() => { if (saved.data?.items?.length) setItems(saved.data.items); }, [saved.data]);
  const syms = items.map((x) => x.pair);
  const ticks = useTicks(syms);
  const pack = useCloses(syms, 120);
  const { pick } = useHub();
  const persist = async (next: Watch[]) => { setItems(next); try { await saveItem("myq-fx", { items: next }); } catch { toast.error("保存失败"); } };
  const atr = (s: string) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const r = rets(c.slice(-15)).map((v) => Math.abs(v) * 100); return r.length ? mean(r) : null; };
  const alerts = items.filter((w) => { const p = ticks[w.pair]?.price; return p != null && ((w.up != null && p >= w.up) || (w.dn != null && p <= w.dn)); });
  useEffect(() => { if (alerts.length) toast.warning(`已触发提醒：${alerts.map((a) => a.pair).join("、")}`); }, [alerts.map((a) => a.pair).join("|")]);
  return (
    <PanelShell code="MYQ" title="个人外汇监控" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <select value={add} onChange={(e) => setAdd(e.target.value)} className={INP}>{PAIRS.filter((p) => !syms.includes(p)).map((p) => <option key={p}>{p}</option>)}</select>
        <button type="button" className={BTN} onClick={() => { if (!syms.includes(add)) void persist([...items, { pair: add, up: null, dn: null, note: "" }]); }}>加入监控</button>
        <span className="text-[10px] text-slate-500">提醒价位与备注永久保存；触及时在终端内弹出提示</span>
      </div>
      <Kpis items={[["监控数量", String(items.length)], ["已触发提醒", alerts.length ? alerts.map((a) => a.pair).join("、") : "无"]]} />
      <table className="w-full text-[11px]">
        <thead className={thead}><tr><th className={THL}>货币对</th><th className={TH}>实时</th><th className={TH}>今日</th><th className={TH}>日内区间位置</th><th className={TH}>14 日平均日波幅</th><th className={TH}>上方提醒</th><th className={TH}>距上方</th><th className={TH}>下方提醒</th><th className={TH}>距下方</th><th className={THL}>备注</th><th className={TH} /></tr></thead>
        <tbody>{items.map((w, i) => { const t = ticks[w.pair]; const p = t?.price; const a = atr(w.pair); const du = p != null && w.up != null ? (w.up / p - 1) * 100 : null, dd = p != null && w.dn != null ? (w.dn / p - 1) * 100 : null; const hit = alerts.includes(w); return edit?.i === i ? (
          <tr key={w.pair} className={ROW}><td className={`${TDL} font-mono text-cyan-200`}>{w.pair}</td><td colSpan={4} className={`${TD} text-white`}>{fmtRate(p)}</td>
            <td className={TD}><input value={edit.up} onChange={(e) => setEdit({ ...edit, up: e.target.value })} className={`${INP} w-20`} /></td><td />
            <td className={TD}><input value={edit.dn} onChange={(e) => setEdit({ ...edit, dn: e.target.value })} className={`${INP} w-20`} /></td><td />
            <td className={TDL}><input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} className={`${INP} w-32`} /></td>
            <td className={TD}><button type="button" className="text-[10px] text-cyan-300" onClick={() => { void persist(items.map((x, j) => j === i ? { ...x, up: Number(edit.up) || null, dn: Number(edit.dn) || null, note: edit.note.slice(0, 60) } : x)); setEdit(null); }}>保存</button></td></tr>
        ) : (
          <tr key={w.pair} className={`${ROW} ${hit ? "bg-[#2a1a05]" : ""}`}>
            <td className={`${TDL} cursor-pointer font-mono text-cyan-200 hover:underline`} onClick={() => pick(w.pair)}>{w.pair}</td>
            <td className={`${TD} text-white`}>{fmtRate(p)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
            <td className={TD}><RangeBar lo={t?.low ?? null} hi={t?.high ?? null} v={p ?? null} w={70} /></td>
            <td className={`${TD} text-slate-300`}>{f2(a, 2, "%")}</td>
            <td className={`${TD} text-slate-200`}>{fmtRate(w.up)}</td><td className={TD} style={{ color: du != null && a ? (Math.abs(du) < a ? "#fbbf24" : "#94a3b8") : "#475569" }}>{sgn(du)}</td>
            <td className={`${TD} text-slate-200`}>{fmtRate(w.dn)}</td><td className={TD} style={{ color: dd != null && a ? (Math.abs(dd) < a ? "#fbbf24" : "#94a3b8") : "#475569" }}>{sgn(dd)}</td>
            <td className={`${TDL} text-[10px] text-slate-400`}>{w.note}</td>
            <td className={TD}><button type="button" className="mr-2 text-[10px] text-cyan-300" onClick={() => setEdit({ i, up: w.up?.toString() ?? "", dn: w.dn?.toString() ?? "", note: w.note })}>设置</button><button type="button" className="text-[10px] text-slate-500 hover:text-rose-300" onClick={() => void persist(items.filter((_, j) => j !== i))}>移除</button></td>
          </tr>); })}</tbody>
      </table>
      <Note>距提醒价位小于 14 日平均日波幅时以黄色标出（一个交易日内可能触及）。点击货币对在右侧打开 K 线。</Note>
    </PanelShell>
  );
}
