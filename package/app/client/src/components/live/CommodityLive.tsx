/**
 * 商品分析小窗（全部实时 / 真实日线计算）：
 *  - COSY 商品综合分析：宏观敏感度（股市上 / 下行 Beta、美元与美债相关、波动分位）· 商品间相关矩阵 · 投机持仓拥挤度 · 商品与相关股票的传导与背离
 *  - CMRV 商品比值与相对价值：金银比、金油比、铜金比等比值的历史均值 / 标准差 / Z 值 · 比值走势 · 均值回归信号
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, f2, heat, mean, perf, rets, sgn, std, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, RangeBar, ROW, TD, TDL, TH, THL, type IvRow, type P } from "./LiveCommon";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];

type Cm = { sym: string; name: string; cat: string; cot?: string; etf?: string };
const CMDTY: Cm[] = [
  { sym: "CL", name: "WTI 原油", cat: "能源", cot: "CL", etf: "USO" },
  { sym: "BRENT", name: "布伦特原油", cat: "能源", cot: "BZ", etf: "BNO" },
  { sym: "NG", name: "天然气", cat: "能源", cot: "NG", etf: "UNG" },
  { sym: "RB=F", name: "RBOB 汽油", cat: "能源", cot: "RB", etf: "UGA" },
  { sym: "HO=F", name: "取暖油", cat: "能源", cot: "HO" },
  { sym: "GC", name: "黄金", cat: "贵金属", cot: "GC", etf: "GLD" },
  { sym: "SI", name: "白银", cat: "贵金属", cot: "SI", etf: "SLV" },
  { sym: "PL", name: "铂金", cat: "贵金属", cot: "PL", etf: "PPLT" },
  { sym: "HG", name: "铜", cat: "工业金属", cot: "HG", etf: "CPER" },
  { sym: "ZC", name: "玉米", cat: "谷物", cot: "ZC", etf: "CORN" },
  { sym: "ZS", name: "大豆", cat: "谷物", cot: "ZS", etf: "SOYB" },
  { sym: "ZW", name: "小麦", cat: "谷物", cot: "ZW", etf: "WEAT" },
  { sym: "KC=F", name: "咖啡", cat: "软商品", cot: "KC" },
  { sym: "SB=F", name: "原糖", cat: "软商品", cot: "SB" },
  { sym: "CC=F", name: "可可", cat: "软商品", cot: "CC" },
  { sym: "CT=F", name: "棉花", cat: "软商品", cot: "CT" },
  { sym: "LE=F", name: "活牛", cat: "畜牧", cot: "LE" },
  { sym: "HE=F", name: "瘦肉猪", cat: "畜牧", cot: "HE" },
];
const CATS = ["全部", "能源", "贵金属", "工业金属", "谷物", "软商品", "畜牧"];
const BENCH = ["^GSPC", "DXY", "^TNX"];

/** 对数收益回归 Beta */
function betaOf(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 20) return null;
  const x = b.slice(-n), y = a.slice(-n);
  const mx = mean(x), my = mean(y);
  let cov = 0, vx = 0;
  for (let i = 0; i < n; i++) { cov += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; }
  return vx > 0 ? cov / vx : null;
}

/* ------------------------------------------------------------------ COSY：宏观敏感度 */
function CosySens() {
  const [cat, setCat] = useState("全部");
  const list = CMDTY.filter((c) => cat === "全部" || c.cat === cat);
  const syms = [...CMDTY.map((c) => c.sym), ...BENCH];
  const pack = useCloses(syms, 800);
  const { pick } = useHub();
  const stats = useMemo(() => {
    const out: Record<string, { beta: number | null; usd: number | null; y10: number | null; up: number | null; dn: number | null; vol20: number | null; volPct: number | null; spark: Array<number | null> }> = {};
    if (!pack.data) return out;
    for (const c of CMDTY) {
      const al = align(pack.data, [c.sym, ...BENCH]);
      const n = Math.min(253, al.dates.length);
      if (n < 60) continue;
      const cr = rets(al.m[c.sym].slice(-n)), sr = rets(al.m["^GSPC"].slice(-n)), ur = rets(al.m.DXY.slice(-n));
      const y = al.m["^TNX"].slice(-n), yr = y.slice(1).map((v, i) => v - y[i]);
      // 上行 / 下行 Beta：分别只取标普上涨日、下跌日回归
      const upI = sr.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0), dnI = sr.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
      const raw = (pack.data[c.sym] ?? []).map((x) => x[1]);
      const rr = rets(raw);
      const vols: number[] = [];
      for (let i = 20; i <= rr.length; i++) vols.push(std(rr.slice(i - 20, i)) * Math.sqrt(252) * 100);
      const vnow = vols.at(-1) ?? null;
      out[c.sym] = { beta: betaOf(cr, sr), usd: corr(cr, ur), y10: corr(cr, yr), up: betaOf(upI.map((i) => cr[i]), upI.map((i) => sr[i])), dn: betaOf(dnI.map((i) => cr[i]), dnI.map((i) => sr[i])), vol20: vnow, volPct: vnow != null && vols.length ? (vols.filter((x) => x <= vnow).length / vols.length) * 100 : null, spark: vols.slice(-250) };
    }
    return out;
  }, [pack.data]);
  const avg = (k: "beta" | "usd" | "y10") => CATS.slice(1).map((g) => { const v = CMDTY.filter((c) => c.cat === g).map((c) => stats[c.sym]?.[k]).filter((x): x is number => x != null); return { k: g, v: v.length ? mean(v) : 0 }; });
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1"><Seg value={cat} options={CATS.map((c) => [c, c] as [string, string])} onChange={setCat} /><span className="text-[10px] text-slate-500">点行在右侧打开 K 线</span></div>
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={THL}>板块</th><th className={TH}>对标普 Beta</th><th className={TH}>上行 Beta</th><th className={TH}>下行 Beta</th><th className={TH}>与美元相关</th><th className={TH}>与美债收益率相关</th><th className={THL}>宏观属性</th><th className={TH}>20 日波动</th><th className={TH}>波动 3 年分位</th><th className={TH}>波动走势(1年)</th></tr></thead>
          <tbody>
            {list.map((c) => {
              const s = stats[c.sym];
              const tag = !s ? "—" : (s.usd ?? 0) < -0.3 ? "美元敏感" : (s.beta ?? 0) > 0.6 ? "增长敏感" : (s.y10 ?? 0) > 0.2 ? "通胀 / 利率敏感" : (s.beta ?? 0) < 0.1 ? "低相关（分散化）" : "混合";
              return (
                <tr key={c.sym} onClick={() => pick(c.sym)} className={`${ROW} cursor-pointer`}>
                  <td className={`${TDL} text-slate-100`}>{c.name}</td><td className={`${TDL} text-[10px] text-slate-500`}>{c.cat}</td>
                  <td className={`${TD} text-white`}>{f2(s?.beta)}</td>
                  <td className={`${TD} text-slate-300`}>{f2(s?.up)}</td>
                  <td className={TD} style={{ color: (s?.dn ?? 0) > (s?.up ?? 0) + 0.2 ? "#fbbf24" : "#cbd5e1" }}>{f2(s?.dn)}</td>
                  <td className={TD} style={{ background: heat(s?.usd, 1) }}>{f2(s?.usd)}</td>
                  <td className={TD} style={{ background: heat(s?.y10, 1) }}>{f2(s?.y10)}</td>
                  <td className={`${TDL} text-[10px] text-slate-300`}>{tag}</td>
                  <td className={`${TD} text-slate-300`}>{f2(s?.vol20, 1, "%")}</td>
                  <td className={TD} style={{ background: s?.volPct == null ? undefined : heat((s.volPct - 50) / 50, 1) }}>{f2(s?.volPct, 0, "%")}</td>
                  <td className={TD}><MiniLine values={s?.spark ?? []} w={90} color="#a78bfa" /></td>
                </tr>
              );
            })}
            {!pack.data && <tr><td colSpan={11}><Empty loading={pack.loading} /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-3">
        <div className="bg-[#03070c]"><SectionHead title="板块平均 · 对标普 Beta" /><Bars data={avg("beta")} fmt={(v) => v.toFixed(2)} height={110} /></div>
        <div className="bg-[#03070c]"><SectionHead title="板块平均 · 与美元相关" /><Bars data={avg("usd")} fmt={(v) => v.toFixed(2)} height={110} /></div>
        <div className="bg-[#03070c]"><SectionHead title="板块平均 · 与美债收益率相关" /><Bars data={avg("y10")} fmt={(v) => v.toFixed(2)} height={110} /></div>
      </div>
      <Note>均以近 1 年共同交易日计算：Beta 为品种日收益对标普 500 的回归斜率，上行 / 下行 Beta 分别只取标普上涨日 / 下跌日；美债取 10 年期收益率日变动。下行 Beta 明显高于上行时（黄色）说明该品种在股市下跌时跟跌更多。波动分位 = 当前 20 日波动在近 3 年滚动波动中的位置。</Note>
    </>
  );
}

/* ------------------------------------------------------------------ COSY：相关矩阵 */
function CosyCorr() {
  const [win, setWin] = useState<"63" | "126" | "252">("252");
  const set = CMDTY.filter((c) => ["CL", "NG", "GC", "SI", "HG", "ZC", "ZS", "ZW", "KC=F", "SB=F"].includes(c.sym));
  const extra: Array<[string, string]> = [];
  const syms = [...set.map((c) => c.sym), ...extra.map((x) => x[0])];
  const names = [...set.map((c) => c.name), ...extra.map((x) => x[1])];
  const pack = useCloses(syms, 400);
  const mat = useMemo(() => {
    if (!pack.data) return null;
    const al = align(pack.data, syms);
    const n = Number(win) + 1;
    const r = syms.map((s) => rets(al.m[s].slice(-n)));
    return r.map((a) => r.map((b) => corr(a, b)));
  }, [pack.data, win]);
  const pairs = useMemo(() => {
    if (!mat) return [];
    const out: Array<{ k: string; v: number }> = [];
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) if (mat[i][j] != null) out.push({ k: `${names[i]}/${names[j]}`, v: mat[i][j]! });
    return out.sort((a, b) => b.v - a.v);
  }, [mat]);
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1"><span className="text-[10px] text-slate-500">窗口</span><Seg value={win} options={[["63", "3 个月"], ["126", "6 个月"], ["252", "1 年"]]} onChange={setWin} /></div>
      {!mat ? <Empty loading={pack.loading} /> : (
        <div className="overflow-auto">
          <table className="text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL} />{names.map((n) => <th key={n} className="px-1 py-1 font-normal">{n}</th>)}</tr></thead>
            <tbody>{mat.map((row, i) => <tr key={syms[i]} className="border-t border-[#0f1b29]"><td className={`${TDL} text-slate-300`}>{names[i]}</td>{row.map((v, j) => <td key={j} className="px-1 py-0.5 text-center font-mono" style={{ background: i === j ? "#0a1726" : heat(v, 1), color: i === j ? "#475569" : "#e2e8f0" }}>{v == null ? "—" : v.toFixed(2)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="相关最高的商品组合" /><Bars data={pairs.slice(0, 8)} fmt={(v) => v.toFixed(2)} height={130} /></div>
        <div className="bg-[#03070c]"><SectionHead title="相关最低的商品组合（分散化候选）" /><Bars data={pairs.slice(-8).reverse()} fmt={(v) => v.toFixed(2)} height={130} /></div>
      </div>
      <Note>日对数收益的皮尔逊相关系数；红色为正相关，绿色为负相关。</Note>
    </>
  );
}

/* ------------------------------------------------------------------ COSY：投机持仓拥挤度 */
type CotRow = { key: string; name: string; date: string; oi: number; oiChg: number; mmLong: number; mmShort: number; mmNet: number; mmNetChg: number; mmNetPctOi: number; pmNet: number; swapNet: number; hist: Array<{ d: string; v: number }> };
function CosyCot() {
  const cot = usePolled<{ rows: CotRow[] }>("ucHubs.cotCommodities", {}, 3600_000);
  const pack = useCloses(CMDTY.map((c) => c.sym), 60);
  const rows = (cot.data?.rows ?? []).map((r) => {
    const h = r.hist.map((x) => x.v);
    const lo = h.length ? Math.min(...h) : null, hi = h.length ? Math.max(...h) : null;
    const pct = h.length ? (h.filter((x) => x <= r.mmNet).length / h.length) * 100 : null;
    const sd = std(h), z = sd > 0 ? (r.mmNet - mean(h)) / sd : null;
    const cm = CMDTY.find((c) => c.cot === r.key);
    const px = cm ? (pack.data?.[cm.sym] ?? []).map((x) => x[1]) : [];
    const p4 = perf(px, 20);
    const agree = p4 == null || r.mmNetChg === 0 ? null : Math.sign(p4) === Math.sign(r.mmNetChg);
    return { ...r, lo, hi, pct, z, p4, agree, spark: h };
  }).sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0));
  const longest = rows.filter((r) => r.pct != null && r.pct >= 90), shortest = rows.filter((r) => r.pct != null && r.pct <= 10);
  return (
    <>
      <Kpis items={[["报告日", rows[0]?.date ?? "—"], ["覆盖品种", String(rows.length)], ["多头拥挤（≥90 分位）", longest.map((r) => r.name).join("、") || "无"], ["空头拥挤（≤10 分位）", shortest.map((r) => r.name).join("、") || "无"]]} />
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>历史分位</th><th className={TH}>Z 值</th><th className={TH}>区间位置</th><th className={TH}>4 周价格</th><th className={TH}>资金与价格</th><th className={TH}>净持仓历史</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={ROW}>
                <td className={`${TDL} text-slate-100`}>{r.name}</td>
                <td className={TD} style={{ background: r.pct == null ? undefined : heat((r.pct - 50) / 50, 1) }}>{f2(r.pct, 0, "%")}</td>
                <td className={TD} style={{ color: toneOf(r.z) }}>{f2(r.z)}</td>
                <td className={TD}><RangeBar lo={r.lo} hi={r.hi} v={r.mmNet} w={70} /></td>
                <td className={TD} style={{ color: toneOf(r.p4) }}>{sgn(r.p4)}</td>
                <td className={`${TD} text-[10px]`} style={{ color: r.agree == null ? "#64748b" : r.agree ? "#e2e8f0" : "#fbbf24" }}>{r.agree == null ? "—" : r.agree ? "同向" : "背离"}</td>
                <td className={TD}><MiniLine values={r.spark} w={90} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7}><Empty loading={cot.loading} text="持仓报告暂不可用" /></td></tr>}
          </tbody>
        </table>
      </div>
      <Note>拥挤度 = 管理基金（对冲基金 / CTA）净持仓在报告期历史中的分位与 Z 值；「背离」指本周资金加减仓方向与近 4 周价格方向相反，常见于趋势末端。按 Z 值绝对值排序。</Note>
    </>
  );
}

/* ------------------------------------------------------------------ COSY：商品与相关股票传导 */
const LINKS: Array<{ c: string; e: string; name: string; en: string }> = [
  { c: "CL", e: "XLE", name: "WTI 原油", en: "能源股" },
  { c: "CL", e: "XOP", name: "WTI 原油", en: "油气开采股" },
  { c: "NG", e: "FCG", name: "天然气", en: "天然气生产商" },
  { c: "GC", e: "GDX", name: "黄金", en: "金矿股" },
  { c: "SI", e: "SIL", name: "白银", en: "银矿股" },
  { c: "HG", e: "COPX", name: "铜", en: "铜矿股" },
  { c: "ZC", e: "MOO", name: "玉米", en: "农业综合股" },
  { c: "ZS", e: "ADM", name: "大豆", en: "粮商（ADM）" },
];
function CosyEq() {
  const [sel, setSel] = useState(0);
  const syms = [...new Set(LINKS.flatMap((l) => [l.c, l.e]))];
  const pack = useCloses(syms, 400);
  const rows = useMemo(() => {
    if (!pack.data) return null;
    return LINKS.map((l) => {
      const al = align(pack.data, [l.c, l.e]);
      const c = al.m[l.c], e = al.m[l.e];
      if (c.length < 80) return { l, ok: false as const };
      const rc = rets(c.slice(-253)), re = rets(e.slice(-253));
      const ratio = e.map((v, i) => v / c[i]).slice(-253);
      const w = ratio.slice(-60), z = std(w) > 0 ? (ratio[ratio.length - 1] - mean(w)) / std(w) : null;
      const c1 = perf(c, 21), e1 = perf(e, 21), c3 = perf(c, 63), e3 = perf(e, 63);
      return { l, ok: true as const, dates: al.dates.slice(-253), ratio, c1, e1, c3, e3, gap: e3 != null && c3 != null ? e3 - c3 : null, corr: corr(rc.slice(-60), re.slice(-60)), beta: betaOf(re, rc), z, base: c.slice(-253).map((v) => (v / c[c.length - 253 >= 0 ? c.length - 253 : 0]) * 100), eq: e.slice(-253).map((v) => (v / e[e.length - 253 >= 0 ? e.length - 253 : 0]) * 100) };
    });
  }, [pack.data]);
  const cur = rows?.[sel];
  return !rows ? <Empty loading={pack.loading} /> : (
    <>
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>商品</th><th className={THL}>相关股票</th><th className={TH}>商品 1 月</th><th className={TH}>股票 1 月</th><th className={TH}>商品 3 月</th><th className={TH}>股票 3 月</th><th className={TH}>3 月表现差</th><th className={TH}>股票对商品 Beta</th><th className={TH}>60 日相关</th><th className={TH}>股/商比 Z 值</th><th className={THL}>解读</th></tr></thead>
        <tbody>{rows.map((r, i) => r.ok ? (
          <tr key={`${r.l.c}-${r.l.e}`} onClick={() => setSel(i)} className={`${ROW} cursor-pointer ${i === sel ? "bg-[#0d2236]" : ""}`}>
            <td className={`${TDL} text-slate-100`}>{r.l.name}</td><td className={`${TDL} text-slate-300`}>{r.l.en} <span className="font-mono text-[10px] text-slate-500">{r.l.e}</span></td>
            {[r.c1, r.e1, r.c3, r.e3].map((v, j) => <td key={j} className={TD} style={{ color: toneOf(v) }}>{sgn(v)}</td>)}
            <td className={TD} style={{ color: toneOf(r.gap), background: heat(r.gap, 20) }}>{sgn(r.gap)}</td>
            <td className={`${TD} text-slate-300`}>{f2(r.beta)}</td><td className={`${TD} text-slate-300`}>{f2(r.corr)}</td>
            <td className={TD} style={{ color: toneOf(r.z) }}>{f2(r.z)}</td>
            <td className={`${TDL} text-[10px] text-slate-400`}>{r.z == null ? "—" : r.z > 1.5 ? "股票领先上行 / 商品滞涨" : r.z < -1.5 ? "股票未确认商品涨势" : (r.corr ?? 0) < 0.3 ? "传导减弱" : "同步"}</td>
          </tr>) : <tr key={`${r.l.c}-${r.l.e}`} className={ROW}><td className={`${TDL} text-slate-500`} colSpan={11}>{r.l.name} / {r.l.en}：历史数据不足</td></tr>)}</tbody>
      </table>
      {cur?.ok && <>
        <SectionHead title={`${cur.l.name} vs ${cur.l.en}（1 年前为 100）`} />
        <Lines height={190} xLabels={cur.dates} fmt={(v) => v.toFixed(1)} series={[{ name: cur.l.name, color: COLORS[2], values: cur.base }, { name: cur.l.en, color: COLORS[0], values: cur.eq }]} />
      </>}
      <Note>股票对商品 Beta 为近 1 年股票日收益对商品日收益的回归斜率（经营杠杆的体现）；股/商比 Z 值 = 股票与商品价格比相对 60 日均值的标准化偏离，用于识别两者走势背离。</Note>
    </>
  );
}

export function COSYLive({ onClose }: P) {
  const [tab, setTab] = useState("sector");
  return (
    <PanelShell code="COSY" title="商品综合分析" onClose={onClose} tabs={[["sector", "宏观敏感度"], ["corr", "相关矩阵"], ["cot", "持仓拥挤度"], ["eq", "商品—股票传导"]]} tab={tab} setTab={setTab}>
      {tab === "sector" && <CosySens />}
      {tab === "corr" && <CosyCorr />}
      {tab === "cot" && <CosyCot />}
      {tab === "eq" && <CosyEq />}
    </PanelShell>
  );
}

/* ================================================================== CMRV 商品比值 / 相对价值 */
type Pair = { a: string; b: string; name: string; note: string };
const PAIRS: Pair[] = [
  { a: "GC", b: "SI", name: "金银比", note: "避险 vs 工业属性" },
  { a: "GC", b: "CL", name: "金油比", note: "衰退担忧 vs 需求" },
  { a: "HG", b: "GC", name: "铜金比", note: "增长预期，常与美债收益率同向" },
  { a: "BRENT", b: "CL", name: "布伦特 / WTI", note: "跨区原油价差" },
  { a: "CL", b: "NG", name: "油气比", note: "能源替代关系" },
  { a: "ZW", b: "ZC", name: "麦玉比", note: "饲料替代" },
  { a: "ZS", b: "ZC", name: "豆玉比", note: "种植面积竞争" },
  { a: "PL", b: "GC", name: "铂金比", note: "工业贵金属相对强弱" },
  { a: "SI", b: "HG", name: "银铜比", note: "贵金属 vs 工业金属" },
];
const LOOKS: Array<[string, string]> = [["252", "1 年"], ["756", "3 年"], ["1260", "5 年"]];

export function CmrvLive({ onClose }: P) {
  const [tab, setTab] = useState("ratios");
  const [look, setLook] = useState("756");
  const [sel, setSel] = useState(0);
  const syms = [...new Set(PAIRS.flatMap((p) => [p.a, p.b]))];
  const ticks = useTicks(syms);
  const pack = useCloses(syms, 1400);
  const base = useMemo(() => {
    if (!pack.data) return null;
    return PAIRS.map((p) => {
      const al = align(pack.data, [p.a, p.b]);
      const n = Number(look);
      const ra = al.m[p.a].slice(-n), rb = al.m[p.b].slice(-n);
      const ratio = ra.map((v, i) => (rb[i] > 0 ? v / rb[i] : NaN)).filter((x) => Number.isFinite(x));
      const m = mean(ratio), sd = std(ratio);
      const ca = rets(ra.slice(-253)), cb = rets(rb.slice(-253));
      // 半衰期：对比值对数做 AR(1)，h = −ln2 / ln(φ)
      const lr = ratio.map(Math.log);
      let phi: number | null = null;
      if (lr.length > 60) { const x = lr.slice(0, -1), y = lr.slice(1); const mx = mean(x), my = mean(y); let c = 0, v = 0; for (let i = 0; i < x.length; i++) { c += (x[i] - mx) * (y[i] - my); v += (x[i] - mx) ** 2; } phi = v > 0 ? c / v : null; }
      const hl = phi != null && phi > 0 && phi < 1 ? -Math.log(2) / Math.log(phi) : null;
      const sorted = [...ratio].sort((a, b) => a - b);
      return { p, ratio, sorted, dates: al.dates.slice(-ratio.length), m, sd, lo: sorted[0] ?? null, hi: sorted[sorted.length - 1] ?? null, c: corr(ca, cb), chg20: perf(ratio, 20), hl };
    });
  }, [pack.data, look]);
  const data = base?.map((d) => {
    const ta = ticks[d.p.a]?.price, tb = ticks[d.p.b]?.price;
    const now = ta != null && tb ? ta / tb : d.ratio[d.ratio.length - 1] ?? null;
    const z = now != null && d.sd > 0 ? (now - d.m) / d.sd : null;
    let k = 0; if (now != null) while (k < d.sorted.length && d.sorted[k] <= now) k++;
    const pct = now != null && d.sorted.length ? (k / d.sorted.length) * 100 : null;
    return { ...d, now, z, pct };
  }) ?? null;
  const cur = data?.[sel];
  const dig = (v: number | null | undefined) => (v == null ? "—" : Math.abs(v) < 0.1 ? v.toFixed(5) : Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(2));
  const signals = (data ?? []).filter((d) => d.z != null && Math.abs(d.z) >= 1.5).sort((a, b) => Math.abs(b.z!) - Math.abs(a.z!));
  return (
    <PanelShell code="CMRV" title="商品比值与相对价值" onClose={onClose} tabs={[["ratios", "比值矩阵"], ["history", "比值走势"], ["signals", "均值回归信号"]]} tab={tab} setTab={setTab}
      right={<span className="flex items-center gap-1 text-[10px] text-slate-500">统计区间 <Seg value={look} options={LOOKS} onChange={setLook} /></span>}>
      {!data ? <Empty loading={pack.loading} /> : (
        <>
          {tab === "ratios" && (
            <div className="overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>比值</th><th className={THL}>含义</th><th className={TH}>当前（实时）</th><th className={TH}>区间均值</th><th className={TH}>标准差</th><th className={TH}>Z 值</th><th className={TH}>历史分位</th><th className={TH}>区间位置</th><th className={TH}>20日变化</th><th className={TH}>两腿相关(1年)</th><th className={TH}>回归半衰期</th></tr></thead>
                <tbody>{data.map((d, i) => (
                  <tr key={d.p.name} onClick={() => { setSel(i); setTab("history"); }} className={`${ROW} cursor-pointer`}>
                    <td className={`${TDL} text-slate-100`}>{d.p.name}</td><td className={`${TDL} text-[10px] text-slate-500`}>{d.p.note}</td>
                    <td className={`${TD} text-white`}>{dig(d.now)}</td><td className={`${TD} text-slate-300`}>{dig(d.m)}</td><td className={`${TD} text-slate-400`}>{dig(d.sd)}</td>
                    <td className={TD} style={{ color: toneOf(d.z), background: heat(d.z, 3) }}>{f2(d.z)}</td>
                    <td className={`${TD} text-slate-300`}>{f2(d.pct, 0, "%")}</td>
                    <td className={TD}><RangeBar lo={d.lo} hi={d.hi} v={d.now} w={70} /></td>
                    <td className={TD} style={{ color: toneOf(d.chg20) }}>{sgn(d.chg20)}</td>
                    <td className={`${TD} text-slate-300`}>{f2(d.c)}</td>
                    <td className={`${TD} text-slate-300`}>{d.hl == null ? "—" : `${d.hl.toFixed(0)} 日`}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {tab === "history" && cur && (
            <>
              <div className="flex flex-wrap gap-1 px-2 py-1">{data.map((d, i) => <button type="button" key={d.p.name} onClick={() => setSel(i)} className={`border px-2 py-0.5 text-[10px] ${i === sel ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-400 hover:text-slate-200"}`}>{d.p.name}</button>)}</div>
              <Kpis items={[["当前", dig(cur.now)], ["均值", dig(cur.m)], ["±1σ", `${dig(cur.m - cur.sd)} ~ ${dig(cur.m + cur.sd)}`], ["Z 值", f2(cur.z)], ["历史分位", f2(cur.pct, 0, "%")]]} />
              <SectionHead title={`${cur.p.name} 走势（${LOOKS.find((x) => x[0] === look)?.[1]}）`} sub="实线为比值，虚线为区间均值与 ±2σ 带" />
              <Lines height={220} fmt={dig} xLabels={cur.dates} series={[
                { name: cur.p.name, color: COLORS[0], values: cur.ratio },
                { name: "均值", color: "#94a3b8", values: cur.ratio.map(() => cur.m), dash: true },
                { name: "+2σ", color: "#f2495c", values: cur.ratio.map(() => cur.m + 2 * cur.sd), dash: true },
                { name: "−2σ", color: "#1fbf75", values: cur.ratio.map(() => cur.m - 2 * cur.sd), dash: true },
              ]} />
              <SectionHead title="滚动 Z 值（60 日窗口）" />
              <Lines height={110} zero fmt={(v) => v.toFixed(2)} xLabels={cur.dates} series={[{ name: "Z", color: COLORS[2], values: cur.ratio.map((_, i) => { if (i < 60) return null; const w = cur.ratio.slice(i - 60, i + 1); const s = std(w); return s > 0 ? (cur.ratio[i] - mean(w)) / s : null; }) }]} />
            </>
          )}
          {tab === "signals" && (
            <>
              <SectionHead title="偏离 ≥ 1.5σ 的比值" sub="Z < 0 反之" />
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-slate-500"><tr><th className={THL}>比值</th><th className={TH}>Z 值</th><th className={TH}>历史分位</th><th className={THL}>回归方向</th><th className={TH}>半衰期</th><th className={TH}>两腿相关</th><th className={THL}>提示</th></tr></thead>
                <tbody>{signals.map((d) => {
                  const [na, nb] = [CMDTY.find((c) => c.sym === d.p.a)?.name ?? d.p.a, CMDTY.find((c) => c.sym === d.p.b)?.name ?? d.p.b];
                  return (
                    <tr key={d.p.name} className={ROW}>
                      <td className={`${TDL} text-slate-100`}>{d.p.name}</td>
                      <td className={TD} style={{ color: toneOf(d.z) }}>{f2(d.z)}</td>
                      <td className={`${TD} text-slate-300`}>{f2(d.pct, 0, "%")}</td>
                      <td className={`${TDL} text-slate-200`}>{d.z! > 0 ? `空 ${na} / 多 ${nb}` : `多 ${na} / 空 ${nb}`}</td>
                      <td className={`${TD} text-slate-300`}>{d.hl == null ? "无回归迹象" : `${d.hl.toFixed(0)} 日`}</td>
                      <td className={`${TD} text-slate-300`}>{f2(d.c)}</td>
                      <td className={`${TDL} text-[10px] text-slate-500`}>{d.hl == null || d.hl > 120 ? "回归慢，偏离可能为结构性" : (d.c ?? 0) < 0.3 ? "两腿相关弱，对冲效果有限" : "统计上具备回归特征"}</td>
                    </tr>
                  );
                })}{!signals.length && <tr><td colSpan={7} className="px-2 py-3 text-center text-slate-500">当前统计区间内没有偏离 1.5σ 以上的比值</td></tr>}</tbody>
              </table>
              <Note>信号仅基于价格比值的统计偏离，不含基差、持有成本与合约规模换算；半衰期由比值对数的 AR(1) 系数估计。</Note>
            </>
          )}
        </>
      )}
    </PanelShell>
  );
}
