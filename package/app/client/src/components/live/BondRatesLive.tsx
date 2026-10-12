/**
 * 利率 / 债券小窗（DES / CDSW / HS / WBF / WBMV / IFMO / MAP），全部接真实数据：
 *  - DES  债券描述：近期美债拍卖券的完整条款与拍卖结果，按最新收益率曲线计算现价、应计利息、久期、凸性、DV01 与现金流
 *  - CDSW 信用违约互换：按用户输入的多期限 CDS 报价剥离分段危险率，美债曲线贴现，给出头寸估值、CS01、IR01、违约跳跃损益
 *  - HS   历史利差：任意两个期限的美债利差或任意两标的比价的历史分布统计
 *  - WBF  全球债券期货：美债期货 32 进制报价、合约月成交，用真实日线回归得到经验 DV01 与曲线交易对冲比
 *  - WBMV 全球债券市场概览：美 / 欧收益率曲线变动、欧洲主权 10 年、债券 ETF 成交异动、债市新闻情绪与数据意外
 *  - IFMO 通胀预测监控：通胀数据实际 vs 预期、市场隐含通胀方向、全球通胀读数
 *  - MAP  利率地图与自设地图：各国 10 年期国债收益率地图 + 个人自定义的行情地图（永久保存）
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useKline, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, f2, heat, mean, perf, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, INP, MiniLine, Note, ROW, TD, TDL, TENORS, TH, THL, diffs, evTime, median, numOf, pctRank, slope, tenorVal, useCalendarSpan, useCurves, yieldFn, type FutCurve, type P } from "./LiveCommon";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6"];

/* ================================================================== DES 债券描述 */
type Auction = { cusip: string; type: string; term: string; reopening: boolean; announce: string; auction: string; issue: string; maturity: string; offering: number | null; coupon: number | null; highYield: number | null; highDiscount: number | null; btc: number | null; total: number | null; tendered: number | null; direct: number | null; indirect: number | null; dealer: number | null; allotted: number | null; tips: boolean; frn: boolean; closing: string };
type Auctions = { upcoming: Auction[]; results: Auction[] };
const TYPE_ZH: Record<string, string> = { Bill: "短期国库券", Note: "中期国债", Bond: "长期国债", TIPS: "通胀保值国债", FRN: "浮动利率票据", CMB: "现金管理券" };
const kindOf = (a: Auction) => (a.tips ? "TIPS" : a.frn ? "FRN" : a.type);
const dt = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
const addMonths = (t: number, m: number) => { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + m); return d.getTime(); };

/** 半年付息固定利率债：给定收益率（小数）求现金流、全价、净价、应计、久期、凸性 */
function bondMath(couponPct: number, maturity: string, y: number, settle = Date.now()) {
  const mat = dt(maturity);
  const dates: number[] = [];
  for (let k = 0; ; k++) { const d = addMonths(mat, -6 * k); if (d <= settle) { dates.unshift(d); break; } dates.unshift(d); if (k > 200) break; }
  const prev = dates[0];
  const flows = dates.slice(1);
  const next = flows[0];
  const cpn = couponPct / 2;
  const frac = (next - settle) / Math.max(1, next - prev);
  const accrued = cpn * (1 - frac);
  let dirty = 0, dur = 0, conv = 0;
  const cf = flows.map((d, i) => {
    const amt = cpn + (i === flows.length - 1 ? 100 : 0);
    const n = frac + i;
    const df = Math.pow(1 + y / 2, -n);
    const pv = amt * df;
    dirty += pv;
    dur += (n / 2) * pv;
    conv += (n * (n + 1)) / 4 * pv / Math.pow(1 + y / 2, 2);
    return { d, amt, pv, t: n / 2 };
  });
  const mac = dur / dirty;
  const mod = mac / (1 + y / 2);
  return { dirty, clean: dirty - accrued, accrued, mac, mod, conv: conv / dirty, dv01: mod * dirty * 0.0001 * 10000, cf, next };
}

function DesBody() {
  const auc = usePolled<Auctions>("ucHubs.auctions", {}, 1200_000);
  const curves = useCurves();
  const [kind, setKind] = useState("Note");
  const [cusip, setCusip] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const list = (auc.data?.results ?? []).filter((a) => (kind === "all" || kindOf(a) === kind) && (!q || a.cusip.includes(q.toUpperCase()) || a.term.toLowerCase().includes(q.toLowerCase())));
  const a = (auc.data?.results ?? []).find((x) => x.cusip === cusip) ?? list[0];
  const cur = curves.data?.us[0];
  const yf = useMemo(() => yieldFn(cur?.points ?? []), [cur]);
  const T = a ? (dt(a.maturity) - Date.now()) / (365.25 * 86400_000) : 0;
  const mkt = a && T > 0 ? yf(T) : null;
  const coupon = a?.coupon ?? null;
  const fixed = a && !a.tips && !a.frn && a.type !== "Bill" && a.type !== "CMB" && coupon != null;
  const bm = fixed && mkt != null ? bondMath(coupon!, a!.maturity, mkt) : null;
  const atAuction = fixed && a!.highYield != null ? bondMath(coupon!, a!.maturity, a!.highYield / 100) : null;
  const days = a ? Math.max(0, Math.round((dt(a.maturity) - Date.now()) / 86400_000)) : 0;
  const billPx = a && !fixed && !a.tips && !a.frn && mkt != null ? 100 / (1 + mkt * days / 365) : null;
  if (!auc.data) return <Empty loading={auc.loading} />;
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="bg-[#03070c]">
        <div className="flex flex-wrap items-center gap-1 px-2 py-1"><Seg value={kind} onChange={setKind} options={[["Note", "中期"], ["Bond", "长期"], ["Bill", "短期"], ["TIPS", "通胀保值"], ["FRN", "浮息"], ["all", "全部"]]} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="CUSIP / 期限" className={`${INP} w-24`} /></div>
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-[11px]"><tbody>{list.map((x) => (
            <tr key={`${x.cusip}-${x.auction}`} onClick={() => setCusip(x.cusip)} className={`cursor-pointer ${ROW} ${a?.cusip === x.cusip ? "bg-[#0d2236]" : ""}`}>
              <td className="px-2 py-0.5"><div className="text-slate-100">{x.term} {TYPE_ZH[kindOf(x)] ?? x.type}{x.reopening ? <span className="ml-1 text-[9px] text-amber-300">续发</span> : null}</div><div className="font-mono text-[9px] text-slate-500">{x.cusip} · 拍卖 {x.auction}</div></td>
              <td className="px-2 text-right font-mono text-slate-300">{f2(x.highYield ?? x.highDiscount, 3, "%")}</td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>
      <div className="min-w-0 bg-[#03070c]">
        {a ? <>
          <SectionHead title={`美国国债 ${a.coupon != null ? `${a.coupon.toFixed(3)}%` : ""} ${a.maturity.replace(/-/g, "/")}`} sub={`${TYPE_ZH[kindOf(a)] ?? a.type} · CUSIP ${a.cusip}`} />
          <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
            <table className="bg-[#03070c] text-[11px]"><tbody>
              {([["发行人", "美国财政部"], ["品种", `${a.term} ${TYPE_ZH[kindOf(a)] ?? a.type}${a.reopening ? "（续发）" : ""}`], ["票面利率", a.coupon != null ? `${a.coupon.toFixed(3)}%` : a.frn ? "浮动（13 周国库券 + 利差）" : "贴现发行"], ["付息频率", a.type === "Bill" || a.type === "CMB" ? "到期一次还本" : a.frn ? "按季" : "每半年"], ["计息基准", a.type === "Bill" || a.type === "CMB" ? "实际/360（贴现率）" : "实际/实际"], ["公告日", a.announce], ["拍卖日", a.auction], ["发行日", a.issue], ["到期日", a.maturity], ["剩余期限", `${T.toFixed(2)} 年（${days} 天）`], ["最小面额", "100 美元"]] as Array<[string, string]>).map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-500">{k}</td><td className="px-2 text-right text-slate-100">{v}</td></tr>)}
            </tbody></table>
            <table className="bg-[#03070c] text-[11px]"><tbody>
              {([["发行规模", a.offering ? `${fmtCompact(a.offering)} 美元` : "—"], ["投标总额", a.tendered ? `${fmtCompact(a.tendered)} 美元` : "—"], ["中标总额", a.total ? `${fmtCompact(a.total)} 美元` : "—"], ["中标收益率", a.highYield != null ? `${a.highYield.toFixed(3)}%` : "—"], ["中标贴现率", a.highDiscount != null ? `${a.highDiscount.toFixed(3)}%` : "—"], ["投标倍数", f2(a.btc, 2)], ["直接投标人占比", f2(a.direct, 1, "%")], ["间接投标人占比（含境外）", f2(a.indirect, 1, "%")], ["一级交易商占比", f2(a.dealer, 1, "%")], ["最高收益率配售比例", f2(a.allotted, 2, "%")]] as Array<[string, string]>).map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-500">{k}</td><td className="px-2 text-right font-mono text-slate-100">{v}</td></tr>)}
            </tbody></table>
          </div>
          <SectionHead title="按最新收益率曲线估值" sub={cur ? `曲线日期 ${cur.date}，按剩余期限线性插值` : "读取曲线…"} />
          {bm ? <>
            <Kpis items={[["市场收益率", `${(mkt! * 100).toFixed(3)}%`, a.highYield != null ? `较拍卖 ${sgn((mkt! * 100 - a.highYield) * 100, 1, "bp")}` : undefined], ["净价", bm.clean.toFixed(4), atAuction ? `拍卖时 ${atAuction.clean.toFixed(4)}` : undefined], ["应计利息", bm.accrued.toFixed(4), `下次付息 ${new Date(bm.next).toISOString().slice(0, 10)}`], ["全价", bm.dirty.toFixed(4)], ["麦考利久期", `${bm.mac.toFixed(3)} 年`], ["修正久期", bm.mod.toFixed(3)], ["凸性", bm.conv.toFixed(2)], ["DV01（每百万面值）", `$${bm.dv01.toFixed(0)}`]]} />
            <SectionHead title="剩余现金流（每 100 面值）" />
            <div className="max-h-[200px] overflow-y-auto"><table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>付款日</th><th className={TH}>距今（年）</th><th className={TH}>现金流</th><th className={TH}>现值</th></tr></thead><tbody>{bm.cf.map((c) => <tr key={c.d} className={ROW}><td className="px-2 font-mono text-slate-300">{new Date(c.d).toISOString().slice(0, 10)}</td><td className={`${TD} text-slate-400`}>{c.t.toFixed(2)}</td><td className={`${TD} text-white`}>{c.amt.toFixed(4)}</td><td className={`${TD} text-slate-300`}>{c.pv.toFixed(4)}</td></tr>)}</tbody></table></div>
          </> : billPx != null ? <Kpis items={[["市场收益率", `${(mkt! * 100).toFixed(3)}%`], ["估算价格", billPx.toFixed(4), "每 100 面值"], ["剩余天数", String(days)], ["DV01（每百万面值）", `$${((days / 365) / (1 + mkt! * days / 365) * billPx * 0.0001 * 10000).toFixed(0)}`]]} />
            : <Note>{a.tips ? "通胀保值国债按实际收益率定价，名义收益率曲线不适用；以上为拍卖实际收益率。" : a.frn ? "浮动利率票据随 13 周国库券利率按周重置，价格接近面值；以上为拍卖确定的利差。" : "读取收益率曲线中…"}</Note>}
        </> : <Empty text="暂无符合条件的券" />}
      </div>
    </div>
  );
}
export function DesBondLive({ onClose }: P) {
  return <PanelShell code="DES" title="债券描述 · 美国国债" onClose={onClose}><DesBody /></PanelShell>;
}

/* ================================================================== CDSW 期限结构剥离估值 */
const CDS_TENORS = [1, 2, 3, 5, 7, 10];
type CdsCurveIn = { name: string; rec: number; spreads: number[] };
/** 分段常数危险率剥离：每个期限的平价利差依次求解该段危险率（季度付息，违约发生在区间中点） */
function bootstrap(spreads: number[], rec: number, zero: (t: number) => number) {
  const lams: number[] = [];
  const surv = (t: number, l: number[]) => { let s = 0, prev = 0; for (let k = 0; k < CDS_TENORS.length; k++) { const end = CDS_TENORS[k]; const lam = l[k] ?? l[l.length - 1] ?? 0; if (t <= end) { s += lam * (t - prev); return Math.exp(-s); } s += lam * (end - prev); prev = end; } return Math.exp(-s - (l[l.length - 1] ?? 0) * (t - prev)); };
  const legs = (T: number, l: number[]) => { let rpv = 0, prot = 0, q0 = 1; for (let i = 1; i <= Math.round(T * 4); i++) { const t = i / 4; const q = surv(t, l); const df = Math.exp(-zero(t) * t); const dfm = Math.exp(-zero(t - 0.125) * (t - 0.125)); rpv += 0.25 * df * (q + q0) / 2; prot += (1 - rec) * dfm * (q0 - q); q0 = q; } return { rpv, prot }; };
  for (let k = 0; k < CDS_TENORS.length; k++) {
    const target = spreads[k] / 10000;
    let lo = 0, hi = 5;
    for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; const g = legs(CDS_TENORS[k], [...lams, mid]); const par = g.prot / g.rpv; if (par > target) hi = mid; else lo = mid; }
    lams.push((lo + hi) / 2);
  }
  return { lams, surv: (t: number) => surv(t, lams), legs: (T: number) => legs(T, lams) };
}
function CdswBody() {
  const curves = useCurves();
  const saved = useSaved<CdsCurveIn[]>("cdsw");
  const [local, setLocal] = useState<CdsCurveIn[] | null>(null);
  const mine = local ?? saved.data ?? [];
  const [inp, setInp] = useState<CdsCurveIn>({ name: "", rec: 40, spreads: [0, 0, 0, 0, 0, 0] });
  const [mat, setMat] = useState(5);
  const [coupon, setCoupon] = useState(100);
  const [notional, setNotional] = useState(10_000_000);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const cur = curves.data?.us[0];
  const yf = useMemo(() => yieldFn(cur?.points ?? []), [cur]);
  const zero = (t: number) => yf(Math.max(t, 1 / 12)) ?? 0.04;
  const zeroUp = (t: number) => zero(t) + 0.0001;
  const valid = inp.spreads.every((s) => s > 0);
  const rec = inp.rec / 100;
  const b = valid ? bootstrap(inp.spreads, rec, zero) : null;
  const sign = side === "buy" ? 1 : -1;
  const val = (bb: ReturnType<typeof bootstrap> | null) => { if (!bb) return null; const g = bb.legs(mat); return { ...g, upfront: g.prot - (coupon / 10000) * g.rpv, par: (g.prot / g.rpv) * 10000 }; };
  const v0 = val(b);
  const vCs = valid ? val(bootstrap(inp.spreads.map((s) => s + 1), rec, zero)) : null;
  const vIr = valid ? val(bootstrap(inp.spreads, rec, zeroUp)) : null;
  const mtm = v0 ? v0.upfront * notional * sign : null;
  const cs01 = v0 && vCs ? (vCs.upfront - v0.upfront) * notional * sign : null;
  const ir01 = v0 && vIr ? (vIr.upfront - v0.upfront) * notional * sign : null;
  const jtd = v0 ? sign * ((1 - rec) * notional - v0.upfront * notional) : null;
  const save = async () => {
    if (!inp.name.trim() || !valid) return;
    const next = [...mine.filter((c) => c.name !== inp.name.trim()), { ...inp, name: inp.name.trim() }].slice(-30);
    setLocal(next);
    await saveItem("cdsw", next);
  };
  const del = async (name: string) => { const next = mine.filter((c) => c.name !== name); setLocal(next); await saveItem("cdsw", next); };
  const box = "w-16 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-right font-mono text-[11px] text-white";
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="bg-[#03070c] p-2 text-[11px]">
        <SectionHead title="参考实体 CDS 报价（bp）" />
        <div className="mt-1 flex items-center gap-1"><input value={inp.name} onChange={(e) => setInp({ ...inp, name: e.target.value })} placeholder="参考实体名称" className={`${INP} flex-1`} /></div>
        <table className="mt-1 w-full"><tbody>
          {CDS_TENORS.map((t, i) => <tr key={t} className="border-t border-[#0f1b29]"><td className="py-0.5 text-slate-400">{t} 年</td><td className="text-right"><input type="number" value={inp.spreads[i] || ""} placeholder="利差" onChange={(e) => { const s = [...inp.spreads]; s[i] = Number(e.target.value) || 0; setInp({ ...inp, spreads: s }); }} className={box} /></td></tr>)}
          <tr className="border-t border-[#0f1b29]"><td className="py-0.5 text-slate-400">回收率 %</td><td className="text-right"><input type="number" value={inp.rec} onChange={(e) => setInp({ ...inp, rec: Number(e.target.value) || 0 })} className={box} /></td></tr>
        </tbody></table>
        <div className="mt-1 flex gap-1"><button type="button" onClick={() => void save()} disabled={!valid || !inp.name.trim()} className={`${BTN} disabled:opacity-40`}>保存曲线</button></div>
        <SectionHead title="头寸" />
        {([["方向", null], ["名义本金（美元）", [notional, setNotional]], ["到期（年）", [mat, setMat]]] as Array<[string, [number, (v: number) => void] | null]>).map(([l, c]) => <div key={l} className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">{l}</span>{c ? <input type="number" value={c[0]} onChange={(e) => c[1](Math.max(0, Number(e.target.value) || 0))} className={`${box} w-28`} /> : <Seg value={side} onChange={setSide} options={[["buy", "买保护"], ["sell", "卖保护"]]} />}</div>)}
        <div className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">标准票息（bp）</span><Seg value={String(coupon)} onChange={(v) => setCoupon(Number(v))} options={[["100", "100"], ["500", "500"]]} /></div>
        {mine.length > 0 && <><SectionHead title="我保存的曲线" /><table className="w-full"><tbody>{mine.map((c) => <tr key={c.name} className={ROW}><td className="cursor-pointer py-0.5 text-cyan-200" onClick={() => setInp(c)}>{c.name}</td><td className="text-right font-mono text-[10px] text-slate-400">5Y {c.spreads[3]}</td><td className="text-right"><button type="button" onClick={() => void del(c.name)} className="px-1 text-[10px] text-slate-500 hover:text-red-300">删除</button></td></tr>)}</tbody></table></>}
      </div>
      <div className="min-w-0 bg-[#03070c]">
        {!b ? <Note>CDS 报价不属于免费公开数据，请在左侧输入参考实体各期限的市场报价（基点）后计算；贴现曲线自动取最新美债收益率曲线{cur ? `（${cur.date}）` : ""}。输入的曲线可保存，下次直接调用。</Note> : <>
          <Kpis items={[["盯市价值（美元）", mtm == null ? "—" : Math.round(mtm).toLocaleString(), `前端费用 ${v0 ? (v0.upfront * 100 * sign).toFixed(3) : "—"}%`], [`${mat} 年平价利差`, v0 ? `${v0.par.toFixed(1)} bp` : "—"], ["CS01（全期限 +1bp）", cs01 == null ? "—" : Math.round(cs01).toLocaleString()], ["IR01（利率 +1bp）", ir01 == null ? "—" : Math.round(ir01).toLocaleString()], ["违约跳跃损益", jtd == null ? "—" : Math.round(jtd).toLocaleString(), "立即违约时的损益"], ["风险年金 RPV01", v0 ? v0.rpv.toFixed(4) : "—"], [`${mat} 年累计违约概率`, `${((1 - b.surv(mat)) * 100).toFixed(2)}%`], ["贴现曲线", cur?.date ?? "—", "美国国债"]]} />
          <SectionHead title="期限结构剥离结果" />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>报价（bp）</th><th className={TH}>分段危险率</th><th className={TH}>生存概率</th><th className={TH}>累计违约</th><th className={TH}>区间违约（远期）</th><th className={TH}>无风险贴现率</th></tr></thead>
            <tbody>{CDS_TENORS.map((t, k) => { const q = b.surv(t), q0 = k ? b.surv(CDS_TENORS[k - 1]) : 1; return <tr key={t} className={ROW}><td className={TDL}>{t} 年</td><td className={`${TD} text-white`}>{inp.spreads[k]}</td><td className={`${TD} text-amber-200`}>{(b.lams[k] * 100).toFixed(3)}%</td><td className={`${TD} text-slate-200`}>{(q * 100).toFixed(2)}%</td><td className={`${TD} text-red-300`}>{((1 - q) * 100).toFixed(2)}%</td><td className={`${TD} text-slate-300`}>{((1 - q / q0) * 100).toFixed(2)}%</td><td className={`${TD} text-slate-400`}>{(zero(t) * 100).toFixed(3)}%</td></tr>; })}</tbody>
          </table>
          <SectionHead title="生存概率曲线（%）" />
          <Lines series={[{ name: "生存概率", color: "#38bdf8", values: Array.from({ length: 41 }, (_, i) => b.surv(i / 4) * 100) }]} xLabels={Array.from({ length: 41 }, (_, i) => `${(i / 4).toFixed(1)}Y`)} height={140} />
          <Note>剥离方法：从最短期限开始，依次求解使该期限平价利差等于报价的分段常数危险率；季度付息、违约发生在付息区间中点。CS01 为全部期限报价同时 +1bp 重新剥离后的价值变化，IR01 为美债曲线平行上移 1bp 的价值变化。</Note>
        </>}
      </div>
    </div>
  );
}
export function CdswLive({ onClose }: P) {
  return <PanelShell code="CDSW" title="信用违约互换 · 期限结构估值" onClose={onClose}><CdswBody /></PanelShell>;
}

/* ================================================================== HS 历史利差 */
const HS_PERIODS: Array<[string, string, number]> = [["1M", "1月", 21], ["3M", "3月", 63], ["6M", "6月", 126], ["1Y", "1年", 252], ["3Y", "3年", 756], ["5Y", "5年", 1260]];
function SpreadStats({ vals, unit, dates, name }: { vals: number[]; unit: string; dates: string[]; name: string }) {
  if (vals.length < 5) return <Empty text="样本不足" />;
  const last = vals[vals.length - 1];
  const m = mean(vals), sd = std(vals), md = median(vals);
  const z = sd ? (last - m) / sd : null;
  const d = unit === "bp" ? 0 : 4;
  return (
    <>
      <Kpis items={[["最新", `${last.toFixed(d)}${unit}`], ["均值", `${m.toFixed(d)}${unit}`], ["距均值", `${sgn(last - m, d, unit)}`], ["中值", `${md?.toFixed(d)}${unit}`], ["标准差", `${sd.toFixed(d)}${unit}`], ["Z 值（距均值标准差数）", f2(z, 2)], ["历史百分位", f2(pctRank(vals, last), 1, "%")], ["区间最高 / 最低", `${Math.max(...vals).toFixed(d)} / ${Math.min(...vals).toFixed(d)}`]]} />
      <Lines series={[{ name, color: "#38bdf8", values: vals }, { name: "均值", color: "#94a3b8", values: vals.map(() => m), dash: true }, { name: "+1σ", color: "#f2495c", values: vals.map(() => m + sd), dash: true }, { name: "−1σ", color: "#1fbf75", values: vals.map(() => m - sd), dash: true }]} xLabels={dates.map((x) => x.slice(2))} height={220} zero={unit === "bp"} fmt={(v) => v.toFixed(d)} />
      <SectionHead title="分布（直方图）" />
      <Bars data={(() => { const lo = Math.min(...vals), hi = Math.max(...vals); const nb = 20; const w = (hi - lo) / nb || 1; const cnt = new Array(nb).fill(0); vals.forEach((v) => cnt[Math.min(nb - 1, Math.floor((v - lo) / w))]++); return cnt.map((c, i) => ({ k: (lo + w * (i + 0.5)).toFixed(d), v: c })); })()} height={100} fmt={(v) => `${v} 天`} />
    </>
  );
}
function HsBody() {
  const [mode, setMode] = useState("rates");
  const [a, setA] = useState("10Y");
  const [b, setB] = useState("2Y");
  const [sa, setSa] = useState("HYG");
  const [sb, setSb] = useState("IEF");
  const [period, setPeriod] = useState("1Y");
  const curves = useCurves();
  const n = HS_PERIODS.find((p) => p[0] === period)![2];
  const pack = useCloses(mode === "px" ? [sa, sb] : [], Math.max(60, n + 5));
  const al = useMemo(() => align(pack.data ?? null, [sa, sb]), [pack.data, sa, sb]);
  const rates = useMemo(() => {
    const us = [...(curves.data?.us ?? [])].reverse();
    const rows = us.map((r) => ({ d: r.date, v: tenorVal(r, a) != null && tenorVal(r, b) != null ? (tenorVal(r, a)! - tenorVal(r, b)!) * 100 : null })).filter((x): x is { d: string; v: number } => x.v != null);
    return rows.slice(-n);
  }, [curves.data, a, b, n]);
  const ratio = al.dates.map((d, i) => ({ d, v: al.m[sa][i] / al.m[sb][i] })).slice(-n);
  const presets: Array<[string, string, string]> = [["2s10s", "10Y", "2Y"], ["3m10y", "10Y", "3M"], ["5s30s", "30Y", "5Y"], ["2s5s", "5Y", "2Y"], ["10s30s", "30Y", "10Y"]];
  const pxPresets: Array<[string, string, string]> = [["高收益/中期国债", "HYG", "IEF"], ["投资级/国债", "LQD", "IEF"], ["通胀保值/名义", "TIP", "IEF"], ["长债/短债", "TLT", "SHY"], ["金/银", "GC", "SI"], ["铜/金", "HG", "GC"]];
  const sel = "border border-[#1d3047] bg-[#07111c] px-1 text-[11px] text-slate-200";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <Seg value={mode} onChange={setMode} options={[["rates", "收益率利差"], ["px", "两标的比价"]]} />
        {mode === "rates" ? <>
          <select value={a} onChange={(e) => setA(e.target.value)} className={sel}>{TENORS.map((t) => <option key={t}>{t}</option>)}</select><span className="text-slate-500">−</span>
          <select value={b} onChange={(e) => setB(e.target.value)} className={sel}>{TENORS.map((t) => <option key={t}>{t}</option>)}</select>
          {presets.map(([l, x, y]) => <button key={l} type="button" onClick={() => { setA(x); setB(y); }} className={`${BTN} text-[10px]`}>{l}</button>)}
        </> : <>
          <input value={sa} onChange={(e) => setSa(e.target.value.trim())} className={`${INP} w-20`} /><span className="text-slate-500">÷</span><input value={sb} onChange={(e) => setSb(e.target.value.trim())} className={`${INP} w-20`} />
          {pxPresets.map(([l, x, y]) => <button key={l} type="button" onClick={() => { setSa(x); setSb(y); }} className={`${BTN} text-[10px]`}>{l}</button>)}
        </>}
        <span className="ml-auto"><Seg value={period} onChange={setPeriod} options={(mode === "rates" ? HS_PERIODS.slice(0, 4) : HS_PERIODS).map(([k, l]) => [k, l] as [string, string])} /></span>
      </div>
      {mode === "rates"
        ? (rates.length ? <SpreadStats vals={rates.map((r) => r.v)} dates={rates.map((r) => r.d)} unit="bp" name={`${a}−${b}`} /> : <Empty loading={curves.loading} />)
        : (ratio.length ? <SpreadStats vals={ratio.map((r) => r.v)} dates={ratio.map((r) => r.d)} unit="" name={`${sa}/${sb}`} /> : <Empty loading={pack.loading} />)}
      <Note>{mode === "rates" ? "美国国债收益率期限利差（基点），每日官方收盘曲线，最长回看约一年。" : "两标的日收盘价之比，最长回看 5 年；比价越高代表前者相对后者越强。"}百分位 = 历史上不高于当前值的天数占比。</Note>
    </>
  );
}
export function HsLive({ onClose }: P) {
  return <PanelShell code="HS" title="历史利差分析" onClose={onClose}><HsBody /></PanelShell>;
}

/* ================================================================== WBF 全球债券期货 */
const BF: Array<{ root: string; sym: string; name: string; tenor: string; mult: number }> = [
  { root: "ZT", sym: "ZT", name: "2 年美债期货", tenor: "2Y", mult: 2000 },
  { root: "ZF", sym: "ZF", name: "5 年美债期货", tenor: "5Y", mult: 1000 },
  { root: "ZN", sym: "ZN", name: "10 年美债期货", tenor: "10Y", mult: 1000 },
  { root: "ZB", sym: "ZB", name: "30 年美债期货", tenor: "20Y", mult: 1000 },
  { root: "UB", sym: "UB", name: "超长美债期货", tenor: "30Y", mult: 1000 },
];
/** 价格 → 32 进制报价（如 110-16+ 表示 110 又 16.5/32） */
function to32(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return "—";
  const whole = Math.floor(p);
  const t = (p - whole) * 32;
  const n = Math.floor(t + 1e-9);
  const rem = t - n;
  const q = Math.round(rem * 4) / 4;
  const tail = q === 0.5 ? "+" : q === 0.25 ? "2" : q === 0.75 ? "6" : "";
  return `${whole}-${String(n).padStart(2, "0")}${tail}`;
}
function WbfBody({ tab }: { tab: string }) {
  const many = usePolled<FutCurve[]>("ucHubs.futuresMany", { roots: BF.map((b) => b.root) }, 120_000);
  const ticks = useTicks(BF.map((b) => b.sym));
  const curves = useCurves();
  const pack = useCloses(tab === "risk" ? BF.map((b) => b.sym) : [], 300);
  const { pick } = useHub();
  if (tab === "quote") {
    return (
      <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={THL}>合约</th><th className={TH}>最新（32进制）</th><th className={TH}>小数</th><th className={TH}>涨跌（/32）</th><th className={TH}>涨跌幅</th><th className={TH}>成交量</th><th className={THL}>次月</th><th className={TH}>次月价格</th><th className={TH}>次月−近月（/32）</th><th className={TH}>对应现券收益率</th></tr></thead>
          <tbody>
            {BF.map((b) => {
              const c = (many.data ?? []).find((x) => x.root === b.root);
              const [p0, p1] = c?.points ?? [];
              const t = ticks[b.sym];
              const px = t?.price ?? p0?.price ?? null;
              const ch = t?.change ?? p0?.change ?? null;
              return (
                <tr key={b.root} onClick={() => pick(b.sym)} className={`cursor-pointer ${ROW}`}>
                  <td className={TDL}>{b.name}</td>
                  <td className="px-2 font-mono text-slate-400">{p0?.code ?? b.root}</td>
                  <td className={`${TD} font-semibold`} style={{ color: toneOf(ch) }}>{to32(px)}</td>
                  <td className={`${TD} text-slate-400`}>{fmtPrice(px, 4)}</td>
                  <td className={TD} style={{ color: toneOf(ch) }}>{ch == null ? "—" : `${ch > 0 ? "+" : ""}${(ch * 32).toFixed(1)}`}</td>
                  <td className={TD} style={{ color: toneOf(t?.changePct ?? p0?.changePct) }}>{fmtPct(t?.changePct ?? p0?.changePct)}</td>
                  <td className={`${TD} text-slate-300`}>{fmtCompact(p0?.volume)}</td>
                  <td className="px-2 font-mono text-slate-500">{p1?.code ?? "—"}</td>
                  <td className={`${TD} text-slate-300`}>{to32(p1?.price)}</td>
                  <td className={`${TD} text-slate-300`}>{p0 && p1 ? `${p1.price - p0.price > 0 ? "+" : ""}${((p1.price - p0.price) * 32).toFixed(1)}` : "—"}</td>
                  <td className={`${TD} text-amber-200`}>{f2(tenorVal(curves.data?.us[0], b.tenor), 3, "%")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Note>美债期货以 32 分之一点报价：「110-16+」= 110 + 16.5/32；「2」「6」后缀分别表示 1/4、3/4 个 1/32。现券收益率为同期限美债最新官方收盘收益率（30 年期货对应 20 年附近的最便宜可交割券区间）。</Note>
      </>
    );
  }
  // 风险：用真实日线回归价格变化对收益率变化的敏感度
  const us = curves.data?.us ?? [];
  const yMap = new Map(us.map((r) => [r.date, r]));
  const rows = BF.map((b) => {
    const pts = (pack.data?.[b.sym] ?? []).map(([t, c]) => [new Date(t + 8 * 3600_000).toISOString().slice(0, 10), c] as [string, number]).filter(([d]) => yMap.has(d));
    const px = pts.map((x) => x[1]);
    const ys = pts.map(([d]) => tenorVal(yMap.get(d), b.tenor)).map((v) => v ?? NaN);
    const ok = px.map((_, i) => i).filter((i) => Number.isFinite(ys[i]));
    const dp = diffs(ok.map((i) => px[i])), dy = diffs(ok.map((i) => ys[i]));
    const s = slope(dy, dp); // 点 / 百分点
    const dv01 = s != null ? (-s / 100) * b.mult : null;
    return { b, dv01, n: dp.length, px: px[px.length - 1] ?? null };
  });
  const pairs: Array<[string, string, string]> = [["2s10s 陡峭化", "ZT", "ZN"], ["5s30s 陡峭化", "ZF", "ZB"], ["10s30s 陡峭化", "ZN", "ZB"], ["2s5s 陡峭化", "ZT", "ZF"], ["10 年 vs 超长", "ZN", "UB"]];
  const al = align(pack.data ?? null, BF.map((b) => b.sym));
  return (
    <>
      <SectionHead title="经验 DV01（收益率每变动 1bp，单手价格变化）" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>最新</th><th className={TH}>经验 DV01（美元/手）</th><th className={TH}>隐含价格久期（年）</th><th className={TH}>样本天数</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.b.root} onClick={() => pick(r.b.sym)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{r.b.name}</td><td className={`${TD} text-white`}>{to32(r.px)}</td><td className={`${TD} text-amber-200`}>{r.dv01 == null ? "—" : `$${r.dv01.toFixed(1)}`}</td><td className={`${TD} text-slate-300`}>{r.dv01 != null && r.px ? f2((r.dv01 / r.b.mult / r.px) * 10000, 2) : "—"}</td><td className={`${TD} text-slate-500`}>{r.n}</td></tr>)}</tbody>
      </table>
      <SectionHead title="曲线交易：DV01 中性手数比" sub="按经验 DV01 配平，使组合只暴露于曲线形态" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>交易</th><th className={THL}>买入</th><th className={THL}>卖出</th><th className={TH}>每卖 1 手长端需买短端</th><th className={TH}>价差日收益相关</th></tr></thead>
        <tbody>{pairs.map(([l, x, y]) => {
          const dx = rows.find((r) => r.b.root === x)?.dv01, dy = rows.find((r) => r.b.root === y)?.dv01;
          const ratio = dx && dy ? dy / dx : null;
          const ca = al.m[x] ?? [], cb = al.m[y] ?? [];
          const ra = diffs(ca), rb = diffs(cb);
          const n2 = Math.min(ra.length, rb.length);
          const mx = mean(ra.slice(-n2)), my = mean(rb.slice(-n2));
          let sxy = 0, sxx = 0, syy = 0;
          for (let i = 0; i < n2; i++) { const p = ra[ra.length - n2 + i] - mx, q = rb[rb.length - n2 + i] - my; sxy += p * q; sxx += p * p; syy += q * q; }
          const cr = sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
          return <tr key={l} className={ROW}><td className={TDL}>{l}</td><td className="px-2 font-mono text-slate-300">{x}</td><td className="px-2 font-mono text-slate-300">{y}</td><td className={`${TD} text-white`}>{f2(ratio, 2)}</td><td className={`${TD} text-slate-400`}>{f2(cr, 2)}</td></tr>;
        })}</tbody>
      </table>
      {!pack.data && <Empty loading={pack.loading} />}
      <Note>经验 DV01 由真实价格与收益率日变化回归得到，已隐含最便宜可交割券与转换因子的影响；实际交易前请以最新可交割券数据复核。</Note>
    </>
  );
}
export function WbfLive({ onClose }: P) {
  const [tab, setTab] = useState("quote");
  return <PanelShell code="WBF" title="全球债券期货" onClose={onClose} tabs={[["quote", "期货报价"], ["risk", "DV01 与对冲"]]} tab={tab} setTab={setTab}><WbfBody tab={tab} /></PanelShell>;
}

/* ================================================================== WBMV 全球债券市场概览 */
type Sov = { countries: Array<{ code: string; name: string; date: string; y: number; spread: number | null; chg1m: number | null; chg12m: number | null; hist: Array<{ d: string; y: number; s: number | null }> }> };
const BOND_ETF: Array<[string, string]> = [["TLT", "20 年以上美债"], ["IEF", "7-10 年美债"], ["SHY", "1-3 年美债"], ["LQD", "投资级公司债"], ["HYG", "高收益公司债"], ["TIP", "通胀保值债"], ["EMB", "新兴市场美元债"], ["BNDX", "国际债券（对冲）"]];
function VolSpike({ s, l }: { s: string; l: string }) {
  const k = useKline(s, "1d", 70);
  const { pick } = useHub();
  const c = k.candles;
  const vols = c.map((x) => x.v ?? 0);
  const last = vols[vols.length - 1];
  const base = vols.slice(-61, -1);
  const m = mean(base), sd = std(base);
  const z = sd ? (last - m) / sd : null;
  const ch = c.length > 1 ? (c[c.length - 1].c / c[c.length - 2].c - 1) * 100 : null;
  return (
    <tr onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}>
      <td className={TDL}>{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td>
      <td className={TD} style={{ color: toneOf(ch) }}>{fmtPct(ch)}</td>
      <td className={`${TD} text-slate-200`}>{fmtCompact(last)}</td>
      <td className={`${TD} text-slate-400`}>{fmtCompact(m)}</td>
      <td className={TD} style={{ background: z != null && z > 2 ? "rgba(251,191,36,.35)" : undefined, color: z != null && z > 2 ? "#fde68a" : "#cbd5e1" }}>{f2(z, 2)}</td>
      <td className="px-2 text-[10px] text-slate-400">{z == null ? "—" : z > 3 ? "极端放量" : z > 2 ? "显著放量" : z < -1 ? "缩量" : "正常"}</td>
      <td className="px-2"><MiniLine values={vols.slice(-40)} w={80} color="#a78bfa" /></td>
    </tr>
  );
}
function WbmvBody({ tab }: { tab: string }) {
  const curves = useCurves();
  const sov = usePolled<Sov>("ucHubs.sovereign", tab === "yld" ? {} : null, 6 * 3600_000);
  const feed = useFeed(tab === "drv" ? { cats: ["债券", "央行"], limit: 150, hours: 72 } : null);
  const cal = useCalendarSpan(tab === "drv" ? 14 : 0, 3);
  const us = curves.data?.us ?? [];
  if (tab === "yld") {
    const at = (k: number) => us[Math.min(k, us.length - 1)];
    const tens = ["1M", "3M", "6M", "1Y", "2Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
    const eu = curves.data?.eu ?? [];
    return (
      <>
        <SectionHead title="美国国债收益率曲线变动" sub={us[0] ? `截至 ${us[0].date}` : undefined} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>收益率</th><th className={TH}>1日（bp）</th><th className={TH}>1周</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>1年区间位置</th></tr></thead>
          <tbody>{tens.map((t) => {
            const v = tenorVal(us[0], t);
            const ch = (k: number) => { const p = tenorVal(at(k), t); return v != null && p != null ? (v - p) * 100 : null; };
            const hist = us.map((r) => tenorVal(r, t)).filter((x): x is number => x != null);
            return <tr key={t} className={ROW}><td className={TDL}>{t}</td><td className={`${TD} text-white`}>{f2(v, 3)}</td>{[[1, 8], [5, 15], [21, 30], [63, 50]].map(([k, sc]) => <td key={k} className={TD} style={{ background: heat(ch(k), sc) }}>{sgn(ch(k), 1, "")}</td>)}<td className={`${TD} text-slate-400`}>{v != null && hist.length ? f2(pctRank(hist, v), 0, "%") : "—"}</td></tr>;
          })}</tbody>
        </table>
        {!us.length && <Empty loading={curves.loading} />}
        <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
          <div className="bg-[#03070c]">
            <SectionHead title="美 / 欧收益率曲线（%）" sub={curves.data?.euDate ? `欧元区 ${curves.data.euDate}` : undefined} />
            <Lines series={[{ name: "美国", color: "#38bdf8", values: ["3M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"].map((t) => tenorVal(us[0], t)) }, { name: "美国 1 月前", color: "#38bdf8", dash: true, values: ["3M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"].map((t) => tenorVal(at(21), t)) }, { name: "欧元区 AAA", color: "#fbbf24", values: ["3M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"].map((t) => eu.find((x) => x.tenor === t)?.value ?? null) }]} xLabels={["3M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"]} height={170} />
          </div>
          <div className="bg-[#03070c]">
            <SectionHead title="欧洲主权 10 年期（月度）" sub={sov.data?.countries[0]?.date} />
            <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>国家</th><th className={TH}>收益率</th><th className={TH}>对德利差</th><th className={TH}>1月变化</th><th className={TH}>12月变化</th></tr></thead>
              <tbody>{(sov.data?.countries ?? []).slice(0, 14).map((c) => <tr key={c.code} className={ROW}><td className={TDL}>{c.name}</td><td className={`${TD} text-white`}>{f2(c.y, 2)}</td><td className={`${TD} text-slate-300`}>{c.spread ?? "—"}</td><td className={TD} style={{ color: toneOf(c.chg1m) }}>{sgn(c.chg1m, 0, "")}</td><td className={TD} style={{ color: toneOf(c.chg12m) }}>{sgn(c.chg12m, 0, "")}</td></tr>)}</tbody>
            </table>
            {!sov.data && <Empty loading={sov.loading} />}
          </div>
        </div>
      </>
    );
  }
  if (tab === "vol") return (
    <>
      <SectionHead title="债券 ETF 成交异动" sub="> 2 视为显著放量" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>涨跌幅</th><th className={TH}>最新成交</th><th className={TH}>60日均量</th><th className={TH}>Z 值</th><th className={THL}>判断</th><th className="px-2">40日成交</th></tr></thead>
        <tbody>{BOND_ETF.map(([s, l]) => <VolSpike key={s} s={s} l={l} />)}</tbody>
      </table>
    </>
  );
  const items = feed.items;
  const tone = { pos: items.filter((n) => n.tone > 0).length, neg: items.filter((n) => n.tone < 0).length };
  const surprises = cal.rows.filter((e) => /United States|美国/.test(e.country) && e.importance >= 2 && e.actual && e.consensus).reverse().slice(0, 20);
  return (
    <>
      <Kpis items={[["债市 / 央行新闻（72 小时）", String(items.length)], ["利好 / 利空", `${tone.pos} / ${tone.neg}`, "按标题情绪判定（对所述资产）"], ["净情绪", items.length ? sgn(((tone.pos - tone.neg) / items.length) * 100, 0) : "—"], ["近两周美国重要数据", String(surprises.length), "实际 vs 预期"]]} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]">
          <SectionHead title="宏观数据意外（美国）" sub="高于预期通常推升收益率" />
          <table className="w-full text-[11px]"><tbody>{surprises.map((e) => { const d = numOf(e.actual)! - numOf(e.consensus)!; return <tr key={e.id} className={ROW}><td className="px-2 font-mono text-[10px] text-slate-500">{evTime(e)}</td><td className={TDL}>{e.nameZh || e.name}</td><td className={`${TD} text-white`}>{e.actual}</td><td className={`${TD} text-slate-500`}>{e.consensus}</td><td className={TD} style={{ color: toneOf(d) }}>{d > 0 ? "高于预期" : d < 0 ? "低于预期" : "符合"}</td></tr>; })}</tbody></table>
          {!surprises.length && <Empty loading={cal.loading} text="近两周暂无" />}
        </div>
        <div className="bg-[#03070c]"><SectionHead title="债市与央行新闻" /><FeedList items={items} loading={feed.loading} dense max={60} /></div>
      </div>
    </>
  );
}
export function WbmvLive({ onClose }: P) {
  const [tab, setTab] = useState("yld");
  return <PanelShell code="WBMV" title="全球债券市场概览" onClose={onClose} tabs={[["yld", "收益率变动"], ["vol", "成交异动"], ["drv", "驱动因素"]]} tab={tab} setTab={setTab}><WbmvBody tab={tab} /></PanelShell>;
}

/* ================================================================== IFMO 通胀预测监控 */
const INFL_RE = /CPI|PCE|PPI|Inflation|Price Index|Import Prices|Export Prices|Inflation Expectations|Michigan.*(Inflation|Expectations)|Average Hourly Earnings|Employment Cost/i;
type Macro = { rates: Array<{ key: string; label: string; value: number | null; date: string | null }> };
function IfmoBody({ tab }: { tab: string }) {
  const cal = useCalendarSpan(30, 10);
  const macro = usePolled<Macro>("ucNews.macro", {}, 1800_000);
  const pack = useCloses(tab === "mkt" ? ["TIP", "IEF", "GC", "CL", "DBC", "^TNX"] : [], 520);
  const curves = useCurves();
  const cpi = macro.data?.rates.find((r) => r.key === "CPI");
  if (tab === "us" || tab === "glb") {
    const rows = cal.rows.filter((e) => INFL_RE.test(e.name) && (tab === "us" ? /United States/.test(e.country) : !/United States/.test(e.country)));
    const done = rows.filter((e) => e.actual).reverse();
    const next = rows.filter((e) => !e.actual);
    const beat = done.filter((e) => numOf(e.actual) != null && numOf(e.consensus) != null);
    const hot = beat.filter((e) => numOf(e.actual)! > numOf(e.consensus)!).length;
    return (
      <>
        {tab === "us" && <Kpis items={[["美国 CPI 同比（最新）", f2(cpi?.value, 2, "%"), cpi?.date ?? undefined], ["近 30 天通胀数据", String(done.length)], ["高于 / 低于预期", `${hot} / ${beat.filter((e) => numOf(e.actual)! < numOf(e.consensus)!).length}`, "预期 = 分析师一致预期"], ["未来 10 天待公布", String(next.length)]]} />}
        <SectionHead title={tab === "us" ? "美国通胀数据：实际 vs 分析师预期" : "全球通胀读数"} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>时间</th>{tab === "glb" && <th className={THL}>地区</th>}<th className={THL}>指标</th><th className={TH}>实际</th><th className={TH}>预期</th><th className={TH}>前值</th><th className={TH}>意外</th></tr></thead>
          <tbody>
            {[...next, ...done].map((e) => { const a = numOf(e.actual), c = numOf(e.consensus); const d = a != null && c != null ? a - c : null; return (
              <tr key={e.id} className={`${ROW} ${!e.actual ? "opacity-70" : ""}`}>
                <td className="px-2 font-mono text-[10px] text-slate-500">{evTime(e)}</td>
                {tab === "glb" && <td className="px-2 text-[10px] text-slate-400">{e.region || e.country}</td>}
                <td className={TDL}><span className="mr-1 text-amber-300">{"★".repeat(e.importance)}</span>{e.nameZh || e.name}</td>
                <td className={`${TD} ${e.actual ? "text-white" : "text-slate-600"}`}>{e.actual ?? "待公布"}</td>
                <td className={`${TD} text-slate-300`}>{e.consensus ?? "—"}</td>
                <td className={`${TD} text-slate-500`}>{e.previous ?? "—"}</td>
                <td className={TD} style={{ color: toneOf(d) }}>{d == null ? "" : d > 0 ? `+${+d.toFixed(3)} 偏热` : d < 0 ? `${+d.toFixed(3)} 偏冷` : "符合"}</td>
              </tr>
            ); })}
          </tbody>
        </table>
        {!rows.length && <Empty loading={cal.loading} text="近期暂无通胀相关数据" />}
      </>
    );
  }
  const { dates, m } = align(pack.data ?? null, ["TIP", "IEF"]);
  const ratio = dates.map((_, i) => (m.TIP[i] / m.IEF[i]) * 100);
  const r0 = ratio[ratio.length - 1];
  const chg = (n: number) => (ratio.length > n ? (r0 / ratio[ratio.length - 1 - n] - 1) * 100 : null);
  const c = (s: string) => (pack.data?.[s] ?? []).map((x) => x[1]);
  const sp = curves.data?.spreads ?? [];
  return (
    <>
      <Kpis items={[["通胀保值 / 名义国债比价", f2(r0, 2), "上升 = 市场通胀预期抬升"], ["比价 1 月变化", sgn(chg(21), 2)], ["比价 3 月变化", sgn(chg(63), 2)], ["比价 1 年分位", r0 != null ? f2(pctRank(ratio.slice(-252), r0), 0, "%") : "—"]]} />
      <SectionHead title="通胀保值国债相对名义国债（近两年）" />
      <Lines series={[{ name: "比价 ×100", color: "#fbbf24", values: ratio }]} xLabels={dates.map((d) => d.slice(2))} height={170} />
      <SectionHead title="通胀敏感资产（1 / 3 / 12 月）" />
      <table className="w-full text-[11px]"><tbody>{([["GC", "黄金"], ["CL", "WTI 原油"], ["DBC", "商品指数基金"], ["TIP", "通胀保值国债"]] as Array<[string, string]>).map(([s, l]) => <tr key={s} className={ROW}><td className={TDL}>{l}</td>{[21, 63, 252].map((n) => <td key={n} className={TD} style={{ background: heat(perf(c(s), n), n === 252 ? 30 : 10) }}>{sgn(perf(c(s), n), 1)}</td>)}<td className="px-2"><MiniLine values={c(s).slice(-252)} /></td></tr>)}</tbody></table>
      <SectionHead title="10 年美债收益率与 2s10s 利差" />
      <Lines series={[{ name: "10Y %", color: "#38bdf8", values: sp.map((x) => x.y10) }, { name: "2Y %", color: "#a78bfa", values: sp.map((x) => x.y2) }]} xLabels={sp.map((x) => x.date.slice(2))} height={140} />
      <Note>市场隐含通胀方向用通胀保值国债与相近久期名义国债的相对表现度量：两者的利率风险大致相抵，比价上升意味着盈亏平衡通胀率上行。该比价反映方向与幅度，不等同于精确的盈亏平衡通胀率数值。</Note>
    </>
  );
}
export function IfmoLive({ onClose }: P) {
  const [tab, setTab] = useState("us");
  return <PanelShell code="IFMO" title="通胀预测监控" onClose={onClose} tabs={[["us", "美国通胀 vs 预期"], ["mkt", "市场隐含通胀"], ["glb", "全球通胀"]]} tab={tab} setTab={setTab}><IfmoBody tab={tab} /></PanelShell>;
}

/* ================================================================== MAP 利率地图 + 自设地图 */
type MyMap = { id: string; name: string; symbols: string[]; at: string };
const BUCKETS: Array<[number, string, string]> = [[1.5, "<1.5%", "#1e3a8a"], [2.5, "1.5-2.5%", "#1d4ed8"], [3.5, "2.5-3.5%", "#15803d"], [4.5, "3.5-4.5%", "#a16207"], [6, "4.5-6%", "#c2410c"], [99, ">6%", "#b91c1c"]];
const bucketOf = (y: number) => BUCKETS.find(([hi]) => y < hi)!;
const SOV_REGION: Record<string, string> = { DE: "核心欧元区", NL: "核心欧元区", AT: "核心欧元区", FI: "核心欧元区", BE: "核心欧元区", FR: "核心欧元区", LU: "核心欧元区", IE: "核心欧元区", IT: "南欧", ES: "南欧", PT: "南欧", GR: "南欧", CY: "南欧", MT: "南欧", SI: "中东欧", SK: "中东欧", LT: "中东欧", LV: "中东欧", EE: "中东欧", HR: "中东欧", BG: "中东欧", CZ: "欧盟非欧元区", PL: "欧盟非欧元区", HU: "欧盟非欧元区", RO: "欧盟非欧元区", SE: "欧盟非欧元区", DK: "欧盟非欧元区" };
function RateMap() {
  const sov = usePolled<Sov>("ucHubs.sovereign", {}, 6 * 3600_000);
  const curves = useCurves();
  const us = curves.data?.us ?? [];
  const usY = tenorVal(us[0], "10Y");
  const usM = tenorVal(us[Math.min(21, us.length - 1)], "10Y");
  const tiles = [
    ...(usY != null ? [{ code: "US", name: "美国", y: usY, region: "北美", spread: null as number | null, chg1m: usM != null ? Math.round((usY - usM) * 100) : null, date: us[0]?.date ?? "" }] : []),
    ...(sov.data?.countries ?? []).map((c) => ({ code: c.code, name: c.name, y: c.y, region: SOV_REGION[c.code] ?? "欧洲其他", spread: c.spread, chg1m: c.chg1m, date: c.date })),
  ];
  const regions = [...new Set(tiles.map((t) => t.region))];
  const [view, setView] = useState("yield");
  if (!tiles.length) return <Empty loading={sov.loading || curves.loading} />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[10px]"><Seg value={view} onChange={setView} options={[["yield", "收益率"], ["spread", "对德利差"], ["chg", "1月变化"]]} />{view === "yield" && BUCKETS.map(([, l, c]) => <span key={l} className="flex items-center gap-1 text-slate-400"><span className="inline-block h-2 w-3" style={{ background: c }} />{l}</span>)}</div>
      {regions.map((r) => (
        <div key={r}>
          <div className="bg-[#07111c] px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{r}</div>
          <div className="grid grid-cols-3 gap-px bg-[#1a2a3c] p-px sm:grid-cols-5 lg:grid-cols-7">
            {tiles.filter((t) => t.region === r).sort((a, b) => b.y - a.y).map((t) => {
              const bg = view === "yield" ? bucketOf(t.y)[2] : view === "spread" ? heat(t.spread, 200) : heat(t.chg1m, 40);
              return <div key={t.code} className="px-1.5 py-1" style={{ background: bg ?? "#0a1420" }}><div className="flex justify-between text-[10px] text-slate-100"><span>{t.name}</span><span className="font-mono text-slate-300/70">{t.code}</span></div><div className="font-mono text-[13px] text-white">{t.y.toFixed(2)}%</div><div className="font-mono text-[9px] text-slate-200/80">利差 {t.spread ?? "—"} · 1月 {sgn(t.chg1m, 0, "bp")}</div></div>;
            })}
          </div>
        </div>
      ))}
      <Note>欧洲各国为长期国债（10 年左右）月度收益率，最新月份 {sov.data?.countries[0]?.date ?? "—"}；美国为最新日收盘 10 年期收益率（{us[0]?.date ?? "—"}）。利差相对德国（基点）。</Note>
    </>
  );
}
function MyMaps() {
  const saved = useSaved<MyMap[]>("maps");
  const [local, setLocal] = useState<MyMap[] | null>(null);
  const maps = local ?? saved.data ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [syms, setSyms] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const cur = maps.find((m) => m.id === (open ?? maps[0]?.id));
  const persist = async (next: MyMap[]) => { setLocal(next); await saveItem("maps", next); };
  const submit = async () => {
    const list = [...new Set(syms.split(/[\s,，;；]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 40);
    if (!name.trim() || !list.length) return;
    const id = editing ?? `m${Date.now().toString(36)}`;
    const item = { id, name: name.trim(), symbols: list, at: new Date().toISOString().slice(0, 10) };
    await persist(editing ? maps.map((m) => (m.id === id ? item : m)) : [...maps, item].slice(-20));
    setOpen(id); setEditing(null); setName(""); setSyms("");
  };
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="bg-[#03070c] p-2 text-[11px]">
        <SectionHead title={editing ? "编辑地图" : "新建地图"} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="地图名称" className={`${INP} mt-1 w-full`} />
        <textarea value={syms} onChange={(e) => setSyms(e.target.value)} placeholder="标的代码，逗号或空格分隔，如 ^TNX ^FVX TLT HYG EURUSD sh000300" rows={4} className={`${INP} mt-1 w-full font-mono`} />
        <div className="mt-1 flex gap-1"><button type="button" onClick={() => void submit()} className={BTN}>{editing ? "保存修改" : "创建"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setName(""); setSyms(""); }} className={BTN}>取消</button>}</div>
        <SectionHead title="我的地图" sub={`${maps.length} 个`} />
        {maps.map((m) => <div key={m.id} className={`flex items-center border-b border-[#0f1b29] py-0.5 ${cur?.id === m.id ? "bg-[#0d2236]" : ""}`}><button type="button" onClick={() => setOpen(m.id)} className="flex-1 truncate px-1 text-left text-slate-100">{m.name}<span className="ml-1 text-[9px] text-slate-500">{m.symbols.length} 项</span></button><button type="button" onClick={() => { setEditing(m.id); setName(m.name); setSyms(m.symbols.join(" ")); }} className="px-1 text-[10px] text-slate-400 hover:text-white">编辑</button><button type="button" onClick={() => void persist(maps.filter((x) => x.id !== m.id))} className="px-1 text-[10px] text-slate-500 hover:text-red-300">删除</button></div>)}
        {!maps.length && <div className="py-2 text-[10px] text-slate-500">{saved.loading ? "读取中…" : "尚未创建地图。创建后永久保存，任何设备登录同一账户可见。"}</div>}
      </div>
      <div className="min-w-0 bg-[#03070c]">{cur ? <MapTiles map={cur} /> : <Empty text="在左侧创建一个自设地图" />}</div>
    </div>
  );
}
function MapTiles({ map }: { map: MyMap }) {
  const ticks = useTicks(map.symbols);
  const { pick } = useHub();
  const vals = map.symbols.map((s) => ticks[s]?.changePct).filter((v): v is number => v != null);
  return (
    <>
      <SectionHead title={map.name} sub={`创建 / 修改于 ${map.at}`} right={<span>平均 <b className="font-mono" style={{ color: toneOf(vals.length ? mean(vals) : null) }}>{vals.length ? sgn(mean(vals), 2) : "—"}</b></span>} />
      <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] p-px sm:grid-cols-4 lg:grid-cols-6">
        {map.symbols.map((s) => { const t = ticks[s]; return <button key={s} type="button" onClick={() => pick(s)} className="px-1.5 py-1 text-left hover:outline hover:outline-1 hover:outline-cyan-500" style={{ background: heat(t?.changePct, 3) ?? "#0a1420" }}><div className="truncate text-[10px] text-slate-100">{t?.name ?? s}</div><div className="font-mono text-[12px] text-white">{fmtPrice(t?.price)}</div><div className="font-mono text-[10px] text-slate-200">{fmtPct(t?.changePct)}</div></button>; })}
      </div>
    </>
  );
}
export function MapRatesLive({ onClose }: P) {
  const [tab, setTab] = useState("rates");
  return <PanelShell code="MAP" title="利率地图 / 自设地图" onClose={onClose} tabs={[["rates", "全球利率地图"], ["mine", "自设地图"]]} tab={tab} setTab={setTab}>{tab === "rates" ? <RateMap /> : <MyMaps />}</PanelShell>;
}
