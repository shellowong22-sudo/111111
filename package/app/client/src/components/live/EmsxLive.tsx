/**
 * EMSX 电子交易工作台（第一组：固定收益执行）。全部基于平台自有模拟交易系统（按实时行情撮合、委托 / 成交永久入库）
 * 与真实行情、日线、盘口。没有可授权的交易商报价时，以场内可成交的国债期货与债券基金作为执行标的，不编造报价。
 * 每个功能代码一个执行角度：
 *  - GOVT 国债执行：国债期货与各期限收益率、经验久期与每手 DV01、DV01 对冲张数
 *  - FIT  固收执行：各债券基金今日实际涨跌 vs 10 年利率变动隐含的涨跌，残差反映信用 / 流动性因素
 *  - FITG 固收交易网格：板块 × 区间收益矩阵，点格子直接带入下单
 *  - CORP 公司债执行：投资级 / 高收益债基金相对久期匹配国债的超额收益
 *  - BOLT 买卖报价列表：A 股债券基金五档盘口、价差、买卖盘失衡
 *  - AGENCY 机构抵押债：抵押债基金相对国债超额收益与按揭—国债利差
 *  - EM   新兴市场债：美元债 vs 本币债收益拆分（汇率贡献）
 *  - EBND 全球电子债券：海外债券基金对冲 / 不对冲汇率差异
 *  - MUNI 地方债：地方债基金对国债 Beta 与应税等价收益率计算
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, f2, heat, mean, perf, rets, sgn, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { FillsTable, OrderTicket, OrdersTable, useFills, useOrders } from "@/uc/trade/kit";
import { INP, MiniLine, Note, ROW, TD, TDL, TH, THL, tenorVal, useCurves, type P } from "./LiveCommon";

const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
export type Inst = [string, string];
const dayOf = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10);

/** 经验久期：近 1 年日收益对 10 年美债收益率日变动（百分点）回归系数的相反数 */
export function useEmpDur(syms: string[]) {
  const pack = useCloses([...syms, "^TNX"], 400);
  return useMemo(() => {
    const out: Record<string, number | null> = {};
    if (!pack.data) return out;
    for (const s of syms) {
      const al = align(pack.data, [s, "^TNX"]);
      const c = al.m[s].slice(-253), y = al.m["^TNX"].slice(-253);
      if (c.length < 60) { out[s] = null; continue; }
      const r = c.slice(1).map((v, i) => v / c[i] - 1), dy = y.slice(1).map((v, i) => v - y[i]);
      const mx = mean(dy), my = mean(r); let cv = 0, vx = 0;
      for (let i = 0; i < r.length; i++) { cv += (dy[i] - mx) * (r[i] - my); vx += (dy[i] - mx) ** 2; }
      out[s] = vx > 0 ? -(cv / vx) * 100 : null;
    }
    return out;
  }, [pack.data, syms.join("|")]);
}

/** 工作台骨架：标的看板（点选）+ 下单票据 + 该功能的分析 + 本功能相关委托与成交 */
export function Desk({ code, title, uni, children, note }: { code: string; title: string; uni: Inst[]; children?: (sel: string, setSel: (s: string) => void) => React.ReactNode; note?: string }) {
  const [sel, setSel] = useState(uni[0]?.[0] ?? "");
  const ticks = useTicks(uni.map((u) => u[0]));
  const pack = useCloses(uni.map((u) => u[0]), 120);
  const orders = useOrders(), fills = useFills();
  const set = new Set(uni.map((u) => u[0]));
  const mine = (s: string, st?: string | null) => set.has(s) || st === code;
  const { pick } = useHub();
  return (
    <PanelShell code={code} title={title}>
      <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="max-h-[360px] overflow-auto bg-[#03070c]">
          <table className="w-full text-[11px]">
            <thead className={thead}><tr><th className={THL}>代码</th><th className={THL}>名称</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>成交量</th><th className={TH}>1 月</th><th className={TH}>近半年</th></tr></thead>
            <tbody>{uni.map(([s, n]) => { const t = ticks[s]; const c = (pack.data?.[s] ?? []).map((x) => x[1]); return (
              <tr key={s} onClick={() => setSel(s)} onDoubleClick={() => pick(s)} className={`${ROW} cursor-pointer ${sel === s ? "bg-[#0d2236]" : ""}`}>
                <td className={`${TDL} font-mono text-cyan-200`}>{s}</td><td className={`${TDL} text-slate-100`}>{n}</td>
                <td className={`${TD} text-white`}>{fmtPrice(t?.price)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
                <td className={`${TD} text-slate-400`}>{fmtCompact(t?.volume)}</td><td className={TD} style={{ color: toneOf(perf(c, 21)) }}>{sgn(perf(c, 21))}</td><td className={TD}><MiniLine values={c} w={70} /></td>
              </tr>); })}</tbody>
          </table>
        </div>
        <div className="bg-[#03070c]"><SectionHead title={`下单：${sel}`} sub="单击左侧切换标的，双击打开 K 线" /><OrderTicket key={sel} initial={sel} strategy={code} compact /></div>
      </div>
      {children?.(sel, setSel)}
      <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-2">
        <div className="max-h-[260px] overflow-auto bg-[#03070c]"><SectionHead title="本功能相关委托" /><OrdersTable rows={orders.data ?? []} filter={(o) => mine(o.symbol, o.strategy)} max={60} /></div>
        <div className="max-h-[260px] overflow-auto bg-[#03070c]"><SectionHead title="本功能相关成交" /><FillsTable rows={(fills.data ?? []).filter((f) => set.has(f.symbol))} max={60} /></div>
      </div>
      <Note>{note ?? "执行在平台模拟账户中按实时行情撮合，委托与成交永久入库。"}</Note>
    </PanelShell>
  );
}

/* ================================================================== GOVT 国债执行 */
const FUTS: Array<[string, string, number, string]> = [["ZT", "2 年美债期货", 2000, "2Y"], ["ZF", "5 年美债期货", 1000, "5Y"], ["ZN", "10 年美债期货", 1000, "10Y"], ["ZB", "30 年美债期货", 1000, "30Y"], ["UB", "超长美债期货", 1000, "30Y"]];
export function useFutDv01() {
  const ticks = useTicks(FUTS.map((f) => f[0]));
  const dur = useEmpDur(FUTS.map((f) => f[0]));
  return FUTS.map(([s, n, mult, ten]) => { const px = ticks[s]?.price ?? null; const D = dur[s] ?? null; return { s, n, ten, mult, px, D, dv01: px != null && D != null ? px * mult * D * 0.0001 : null }; });
}
export function GovtLive({ onClose: _ }: P) {
  const dv = useFutDv01();
  const cur = useCurves();
  const last = cur.data?.us.at(-1), prev = cur.data?.us.at(-2);
  const [hedge, setHedge] = useState("10000");
  return (
    <Desk code="GOVT" title="国债执行" uni={FUTS.map(([s, n]) => [s, n] as Inst)}>
      {() => (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]">
            <SectionHead title={`美债收益率（${last?.date ?? "—"}）`} />
            <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>收益率</th><th className={TH}>日变动</th></tr></thead>
              <tbody>{["3M", "2Y", "5Y", "10Y", "30Y"].map((t) => { const a = tenorVal(last, t), b = tenorVal(prev, t); return <tr key={t} className={ROW}><td className={`${TDL} text-slate-200`}>{t}</td><td className={`${TD} text-white`}>{f2(a, 3, "%")}</td><td className={TD} style={{ color: toneOf(a != null && b != null ? a - b : null) }}>{a != null && b != null ? `${((a - b) * 100).toFixed(1)}bp` : "—"}</td></tr>; })}</tbody></table>
          </div>
          <div className="bg-[#03070c]">
            <SectionHead title="每手 DV01 与对冲张数" right={<span className="text-[10px] text-slate-500">待对冲 DV01（美元/bp）<input value={hedge} onChange={(e) => setHedge(e.target.value.replace(/[^\d.]/g, ""))} className={`${INP} ml-1 w-20`} /></span>} />
            <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>合约</th><th className={TH}>最新</th><th className={TH}>经验久期</th><th className={TH}>每手 DV01</th><th className={TH}>所需张数</th></tr></thead>
              <tbody>{dv.map((r) => <tr key={r.s} className={ROW}><td className={`${TDL} text-slate-100`}>{r.n}</td><td className={`${TD} text-white`}>{fmtPrice(r.px)}</td><td className={`${TD} text-slate-300`}>{f2(r.D, 2)}</td><td className={`${TD} text-slate-200`}>{r.dv01 == null ? "—" : `$${r.dv01.toFixed(1)}`}</td><td className={`${TD} text-amber-200`}>{r.dv01 ? (Number(hedge) / r.dv01).toFixed(1) : "—"}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
    </Desk>
  );
}

/* ================================================================== FIT 固收执行：利率隐含公允变动 */
const FIT_UNI: Inst[] = [["AGG", "美国综合债"], ["BND", "美国全债市"], ["SHY", "1-3 年国债"], ["IEF", "7-10 年国债"], ["TLT", "20 年以上国债"], ["TIP", "通胀保值国债"], ["LQD", "投资级公司债"], ["HYG", "高收益债"], ["MUB", "市政债"], ["EMB", "新兴市场美元债"], ["MBB", "抵押支持债"]];
type Depth = { levels: number; last: number; bids: Array<{ px: number; qty: number }>; asks: Array<{ px: number; qty: number }> };
export function FitLive({ onClose: _ }: P) {
  return <Desk code="FIT" title="固收执行：利率隐含公允变动" uni={FIT_UNI}>{(sel) => <FitFair sel={sel} />}</Desk>;
}
function FitFair({ sel }: { sel: string }) {
  const syms = FIT_UNI.map((x) => x[0]);
  const dur = useEmpDur(syms);
  const ticks = useTicks([...syms, "^TNX"]);
  const d = usePolled<Depth>("ucMarket.depth", { symbol: sel }, 5000);
  const dy = ticks["^TNX"]?.change ?? null;
  const bid = d.data?.bids[0]?.px, ask = d.data?.asks[0]?.px;
  const spreadBp = bid && ask ? ((ask - bid) / ((ask + bid) / 2)) * 10000 : null;
  return (
    <div className="bg-[#03070c]">
      <SectionHead title="今日实际涨跌 vs 利率隐含涨跌" sub={`10 年美债收益率今日变动 ${dy == null ? "—" : `${(dy * 100).toFixed(1)}bp`}；隐含涨跌 = −经验久期 × 收益率变动`} right={<span className="text-[10px] text-slate-500">{sel} 买卖价差 {f2(spreadBp, 1, "bp")}</span>} />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>经验久期</th><th className={TH}>实际涨跌</th><th className={TH}>利率隐含</th><th className={TH}>残差（信用 / 流动性）</th></tr></thead>
        <tbody>{FIT_UNI.map(([s, n]) => { const D = dur[s] ?? null; const imp = D != null && dy != null ? -D * dy : null; const act = ticks[s]?.changePct ?? null; const res = imp != null && act != null ? act - imp : null; return <tr key={s} className={`${ROW} ${s === sel ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} text-slate-100`}>{n} <span className="font-mono text-[10px] text-slate-500">{s}</span></td><td className={`${TD} text-slate-300`}>{f2(D, 2)}</td><td className={TD} style={{ color: toneOf(act) }}>{fmtPct(act)}</td><td className={TD} style={{ color: toneOf(imp) }}>{sgn(imp)}</td><td className={TD} style={{ color: toneOf(res), background: heat(res, 0.5) }}>{sgn(res, 2)}</td></tr>; })}</tbody></table>
      <Note>残差为正：该品种今日表现好于利率变动所能解释的幅度（信用利差收窄或资金流入）；为负则相反。可作为择时下单参考。</Note>
    </div>
  );
}

/* ================================================================== FITG 固收交易网格 */
const GRID: Array<[string, Inst[]]> = [["国债", [["SHY", "短端"], ["IEI", "3-7 年"], ["IEF", "7-10 年"], ["TLT", "长端"]]], ["通胀保值", [["STIP", "短端"], ["TIP", "全期限"], ["LTPZ", "长端"]]], ["投资级", [["VCSH", "短端"], ["VCIT", "中端"], ["VCLT", "长端"]]], ["高收益", [["SHYG", "短端"], ["HYG", "全期限"]]], ["市政", [["SUB", "短端"], ["MUB", "全期限"], ["TFI", "长端"]]], ["抵押 / 新兴", [["MBB", "抵押支持"], ["EMB", "新兴美元"], ["EMLC", "新兴本币"]]]];
export function FitgLive({ onClose: _ }: P) {
  const all = GRID.flatMap((g) => g[1]);
  const [h, setH] = useState<"d" | "w" | "m" | "q" | "ytd">("m");
  const pack = useCloses(all.map((x) => x[0]), 400);
  const ticks = useTicks(all.map((x) => x[0]));
  const val = (s: string) => { if (h === "d") return ticks[s]?.changePct ?? null; const a = pack.data?.[s] ?? []; const c = a.map((x) => x[1]); return h === "w" ? perf(c, 5) : h === "m" ? perf(c, 21) : h === "q" ? perf(c, 63) : ytd(c, a.map((x) => dayOf(x[0]))); };
  return (
    <Desk code="FITG" title="固收交易网格" uni={all}>
      {(sel, setSel) => (
        <div className="bg-[#03070c]">
          <SectionHead title="板块 × 期限收益网格" right={<Seg value={h} options={[["d", "今日"], ["w", "1 周"], ["m", "1 月"], ["q", "3 月"], ["ytd", "年内"]]} onChange={setH} />} />
          <table className="w-full text-[11px]"><tbody>{GRID.map(([g, xs]) => <tr key={g} className="border-t border-[#0f1b29]"><td className={`${TDL} w-24 text-slate-300`}>{g}</td>{xs.map(([s, n]) => { const v = val(s); return <td key={s} onClick={() => setSel(s)} className={`cursor-pointer px-2 py-1 text-center ${sel === s ? "outline outline-1 outline-cyan-500" : ""}`} style={{ background: heat(v, h === "d" ? 1 : h === "w" ? 2 : 6) }}><div className="text-[10px] text-slate-400">{n} · {s}</div><div className="font-mono" style={{ color: toneOf(v) }}>{sgn(v)}</div></td>; })}</tr>)}</tbody></table>
          <Note>点击格子把该品种带入上方下单票据。</Note>
        </div>
      )}
    </Desk>
  );
}

/* ================================================================== CORP 公司债执行 */
const CORP_UNI: Inst[] = [["LQD", "投资级（全期限）"], ["VCIT", "投资级中期"], ["VCSH", "投资级短期"], ["IGIB", "投资级 5-10 年"], ["HYG", "高收益（全期限）"], ["JNK", "高收益"], ["SHYG", "高收益短期"], ["USHY", "高收益广谱"]];
const CORP_BENCH: Record<string, string> = { LQD: "IEF", VCIT: "IEI", VCSH: "SHY", IGIB: "IEF", HYG: "IEI", JNK: "IEI", SHYG: "SHY", USHY: "IEI" };
export function CorpLive({ onClose: _ }: P) {
  const syms = CORP_UNI.map((x) => x[0]);
  const pack = useCloses([...syms, "IEF", "IEI", "SHY"], 400);
  const ex = useMemo(() => {
    if (!pack.data) return null;
    return syms.map((s) => {
      const b = CORP_BENCH[s];
      const al = align(pack.data, [s, b]);
      const a = al.m[s], c = al.m[b];
      const exr = (n: number) => (a.length > n ? ((a[a.length - 1] / a[a.length - 1 - n]) - (c[c.length - 1] / c[c.length - 1 - n])) * 100 : null);
      const roll = a.map((v, i) => (i >= 63 ? ((v / a[i - 63]) - (c[i] / c[i - 63])) * 100 : null));
      return { s, b, m1: exr(21), m3: exr(63), y1: exr(252), roll, dates: al.dates };
    });
  }, [pack.data]);
  return (
    <Desk code="CORP" title="公司债执行" uni={CORP_UNI}>
      {(sel) => { const cur = ex?.find((x) => x.s === sel); return !ex ? <Empty loading={pack.loading} /> : (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="相对久期匹配国债的超额收益" />
            <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>信用债</th><th className={THL}>对标国债</th><th className={TH}>1 月</th><th className={TH}>3 月</th><th className={TH}>1 年</th></tr></thead>
              <tbody>{ex.map((x) => <tr key={x.s} className={`${ROW} ${x.s === sel ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} font-mono text-cyan-200`}>{x.s}</td><td className={`${TDL} font-mono text-slate-400`}>{x.b}</td>{[x.m1, x.m3, x.y1].map((v, i) => <td key={i} className={TD} style={{ color: toneOf(v) }}>{sgn(v)}</td>)}</tr>)}</tbody></table></div>
          <div className="bg-[#03070c]"><SectionHead title={`${sel} 滚动 3 个月超额收益`} />{cur && <Lines height={180} zero xLabels={cur.dates} fmt={(v) => `${v.toFixed(2)}%`} series={[{ name: "超额收益", color: "#38bdf8", values: cur.roll }]} />}</div>
        </div>
      ); }}
    </Desk>
  );
}

/* ================================================================== BOLT 买卖报价列表（A 股债券基金五档） */
const BOLT_UNI: Inst[] = [["sh511010", "国债 ETF"], ["sh511260", "十年国债 ETF"], ["sh511090", "三十年国债 ETF"], ["sh511020", "活跃国债 ETF"], ["sh511030", "公司债 ETF"], ["sh511220", "城投债 ETF"], ["sh511360", "短融 ETF"], ["sh511880", "银华日利（货币）"]];
export function BoltLive({ onClose: _ }: P) {
  return <Desk code="BOLT" title="买卖报价列表" uni={BOLT_UNI} note="五档盘口为交易所实时行情；执行在平台模拟账户中按实时行情撮合。">{(sel) => <BoltDepth sel={sel} />}</Desk>;
}
function BoltDepth({ sel }: { sel: string }) {
  const d = usePolled<Depth>("ucMarket.depth", { symbol: sel }, 3000);
  const b = d.data?.bids ?? [], a = d.data?.asks ?? [];
  const mid = b[0] && a[0] ? (b[0].px + a[0].px) / 2 : null;
  const bq = b.reduce((s, x) => s + x.qty, 0), aq = a.reduce((s, x) => s + x.qty, 0);
  const imb = bq + aq ? ((bq - aq) / (bq + aq)) * 100 : null;
  const maxQ = Math.max(1, ...b.map((x) => x.qty), ...a.map((x) => x.qty));
  return (
    <div className="bg-[#03070c]">
      <Kpis items={[["中间价", mid?.toFixed(3) ?? "—"], ["价差", b[0] && a[0] && mid ? `${(((a[0].px - b[0].px) / mid) * 10000).toFixed(1)}bp` : "—"], ["五档买量 / 卖量", `${fmtCompact(bq)} / ${fmtCompact(aq)}`], ["买卖盘失衡", <span style={{ color: toneOf(imb) }}>{sgn(imb, 1)}</span>]]} />
      {!b.length && !a.length ? <Empty loading={d.loading} text="暂无盘口（非交易时段）" /> : (
        <table className="w-full text-[11px]"><tbody>
          {[...a].reverse().map((x, i) => <tr key={`a${i}`} className={ROW}><td className={`${TDL} text-slate-400`}>卖{a.length - i}</td><td className={`${TD}`} style={{ color: "#1fbf75" }}>{x.px.toFixed(3)}</td><td className={`${TD} text-slate-300`}>{fmtCompact(x.qty)}</td><td className="w-1/2 px-2"><div className="h-2" style={{ width: `${(x.qty / maxQ) * 100}%`, background: "rgba(31,191,117,0.5)" }} /></td></tr>)}
          {b.map((x, i) => <tr key={`b${i}`} className={ROW}><td className={`${TDL} text-slate-400`}>买{i + 1}</td><td className={TD} style={{ color: "#f2495c" }}>{x.px.toFixed(3)}</td><td className={`${TD} text-slate-300`}>{fmtCompact(x.qty)}</td><td className="w-1/2 px-2"><div className="h-2" style={{ width: `${(x.qty / maxQ) * 100}%`, background: "rgba(242,73,92,0.5)" }} /></td></tr>)}
        </tbody></table>
      )}
    </div>
  );
}

/* ================================================================== AGENCY 机构抵押债 */
const AG_UNI: Inst[] = [["MBB", "抵押支持债"], ["VMBS", "抵押支持债（低费率）"], ["SPMB", "抵押支持债（宽基）"], ["JMBS", "抵押支持债（主动）"], ["GNMA", "吉利美抵押债"]];
export function AgencyLive({ onClose: _ }: P) {
  const pack = useCloses(["MBB", "IEF", "IEI"], 800);
  const hs = usePolled<{ pmms: Array<{ d: string; m30: number | null }> }>("ucHubs.housing", {}, 3600_000);
  const cur = useCurves();
  const spread = useMemo(() => {
    const ten = new Map((cur.data?.us ?? []).map((c) => [c.date, tenorVal(c, "10Y")]));
    const dates = [...ten.keys()].sort();
    return (hs.data?.pmms ?? []).map((p) => { const d = dates.filter((x) => x <= p.d).at(-1); const y = d ? ten.get(d) : null; return { d: p.d, m30: p.m30, y10: y ?? null, sp: p.m30 != null && y != null ? p.m30 - y : null }; }).filter((x) => x.sp != null).slice(-104);
  }, [hs.data, cur.data]);
  const exr = useMemo(() => { if (!pack.data) return null; const al = align(pack.data, ["MBB", "IEI"]); const a = al.m.MBB, b = al.m.IEI; return { dates: al.dates, roll: a.map((v, i) => (i >= 63 ? ((v / a[i - 63]) - (b[i] / b[i - 63])) * 100 : null)) }; }, [pack.data]);
  const last = spread.at(-1);
  return (
    <Desk code="AGENCY" title="机构抵押债" uni={AG_UNI}>
      {() => (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="按揭利率与 10 年国债利差" sub={last ? `${last.d}：${last.m30?.toFixed(2)}% − ${last.y10?.toFixed(2)}% = ${last.sp!.toFixed(2)} 个百分点` : ""} /><Lines height={170} xLabels={spread.map((x) => x.d)} fmt={(v) => v.toFixed(2)} series={[{ name: "按揭−国债利差", color: "#fbbf24", values: spread.map((x) => x.sp) }]} /></div>
          <div className="bg-[#03070c]"><SectionHead title="抵押支持债相对 3-7 年国债的滚动 3 个月超额收益" />{exr ? <Lines height={170} zero xLabels={exr.dates} fmt={(v) => `${v.toFixed(2)}%`} series={[{ name: "超额收益", color: "#38bdf8", values: exr.roll }]} /> : <Empty loading={pack.loading} />}</div>
        </div>
      )}
    </Desk>
  );
}

/* ================================================================== EM 新兴市场债 */
const EM_UNI: Inst[] = [["EMB", "新兴美元主权债"], ["PCY", "新兴美元主权债（等权）"], ["CEMB", "新兴美元公司债"], ["EMHY", "新兴高收益"], ["EMLC", "新兴本币债"], ["LEMB", "新兴本币债（宽基）"]];
export function EmLive({ onClose: _ }: P) {
  const pack = useCloses(["EMB", "EMLC", "CEW"], 800);
  const dec = useMemo(() => {
    if (!pack.data) return null;
    const hs = [21, 63, 126, 252];
    return hs.map((n) => { const c = (s: string) => (pack.data![s] ?? []).map((x) => x[1]); const usd = perf(c("EMB"), n), loc = perf(c("EMLC"), n), fx = perf(c("CEW"), n); return { n, usd, loc, fx, diff: usd != null && loc != null ? loc - usd : null }; });
  }, [pack.data]);
  return (
    <Desk code="EM" title="新兴市场债" uni={EM_UNI}>
      {() => (
        <div className="bg-[#03070c]"><SectionHead title="美元债 vs 本币债：汇率贡献拆分" sub="本币债 − 美元债 ≈ 新兴货币对美元的贡献（与新兴货币篮子对照）" />
          {!dec ? <Empty loading={pack.loading} /> : <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>区间</th><th className={TH}>美元主权债</th><th className={TH}>本币债</th><th className={TH}>本币 − 美元</th><th className={TH}>新兴货币篮子</th></tr></thead>
            <tbody>{dec.map((x) => <tr key={x.n} className={ROW}><td className={`${TDL} text-slate-200`}>{x.n === 21 ? "1 个月" : x.n === 63 ? "3 个月" : x.n === 126 ? "6 个月" : "1 年"}</td>{[x.usd, x.loc, x.diff, x.fx].map((v, i) => <td key={i} className={TD} style={{ color: toneOf(v) }}>{sgn(v)}</td>)}</tr>)}</tbody></table>}
        </div>
      )}
    </Desk>
  );
}

/* ================================================================== EBND 全球电子债券 */
const EB_UNI: Inst[] = [["BNDX", "国际债（汇率对冲）"], ["BWX", "国际国债（不对冲）"], ["IGOV", "发达国家国债（不对冲）"], ["IAGG", "国际综合债（对冲）"], ["ISHG", "国际短期国债（不对冲）"], ["BNDW", "全球综合债"]];
export function EbndLive({ onClose: _ }: P) {
  const pack = useCloses(["BNDX", "BWX", "DXY"], 800);
  const d = useMemo(() => {
    if (!pack.data) return null;
    const al = align(pack.data, ["BNDX", "BWX", "DXY"]);
    const h = al.m.BNDX, u = al.m.BWX, x = al.m.DXY;
    const diff = h.map((v, i) => (i >= 63 ? ((u[i] / u[i - 63]) - (v / h[i - 63])) * 100 : null));
    const dx = x.map((v, i) => (i >= 63 ? (v / x[i - 63] - 1) * 100 : null));
    const pairs = diff.map((v, i) => [v, dx[i]] as const).filter((p): p is readonly [number, number] => p[0] != null && p[1] != null);
    const c = pairs.length > 30 ? (() => { const a = pairs.map((p) => p[0]), b = pairs.map((p) => p[1]); const ma = mean(a), mb = mean(b); let cv = 0, va = 0, vb = 0; for (let i = 0; i < a.length; i++) { cv += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return cv / Math.sqrt(va * vb); })() : null;
    return { dates: al.dates, diff, dx, c };
  }, [pack.data]);
  return (
    <Desk code="EBND" title="全球电子债券" uni={EB_UNI}>
      {() => !d ? <Empty loading={pack.loading} /> : (
        <div className="bg-[#03070c]"><SectionHead title="对冲与不对冲收益差（滚动 3 个月）与美元指数" sub={`两者相关系数 ${f2(d.c)}：美元走强时不对冲的海外债明显跑输`} />
          <Lines height={190} zero xLabels={d.dates} fmt={(v) => `${v.toFixed(2)}%`} series={[{ name: "不对冲 − 对冲", color: "#38bdf8", values: d.diff }, { name: "美元指数 3 个月变动", color: "#f2495c", values: d.dx, dash: true }]} />
        </div>
      )}
    </Desk>
  );
}

/* ================================================================== MUNI 地方债 */
const MUNI_UNI: Inst[] = [["MUB", "市政债（全期限）"], ["VTEB", "市政债（低费率）"], ["SUB", "短期市政债"], ["SHM", "短期市政债（2）"], ["TFI", "长期市政债"], ["HYD", "高收益市政债"]];
export function MuniLive({ onClose: _ }: P) {
  const [yld, setYld] = useState("3.2");
  const [tax, setTax] = useState("37");
  const [st, setSt] = useState("5");
  const pack = useCloses([...MUNI_UNI.map((x) => x[0]), "IEF"], 400);
  const beta = useMemo(() => {
    if (!pack.data) return {} as Record<string, number | null>;
    return Object.fromEntries(MUNI_UNI.map(([s]) => { const al = align(pack.data!, [s, "IEF"]); const a = rets(al.m[s].slice(-253)), b = rets(al.m.IEF.slice(-253)); const mb = mean(b), ma = mean(a); let cv = 0, vb = 0; for (let i = 0; i < a.length; i++) { cv += (b[i] - mb) * (a[i] - ma); vb += (b[i] - mb) ** 2; } return [s, vb > 0 ? cv / vb : null]; }));
  }, [pack.data]);
  const tey = Number(yld) / (1 - (Number(tax) + Number(st)) / 100);
  return (
    <Desk code="MUNI" title="地方债" uni={MUNI_UNI}>
      {() => (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="应税等价收益率" />
            <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px] text-slate-400">免税收益率 %<input value={yld} onChange={(e) => setYld(e.target.value)} className={`${INP} w-16`} />联邦税率 %<input value={tax} onChange={(e) => setTax(e.target.value)} className={`${INP} w-14`} />州税率 %<input value={st} onChange={(e) => setSt(e.target.value)} className={`${INP} w-14`} /></div>
            <Kpis items={[["应税等价收益率", Number.isFinite(tey) ? `${tey.toFixed(2)}%` : "—"], ["税收优势", Number.isFinite(tey) ? `${((tey - Number(yld)) * 100).toFixed(0)}bp` : "—"]]} />
          </div>
          <div className="bg-[#03070c]"><SectionHead title="对 7-10 年国债的 Beta（1 年）" sub="Beta 低于久期比例说明市政债有独立的供需驱动" /><Bars data={MUNI_UNI.filter(([s]) => beta[s] != null).map(([s]) => ({ k: s, v: beta[s]! }))} fmt={(v) => v.toFixed(2)} height={130} /></div>
        </div>
      )}
    </Desk>
  );
}
