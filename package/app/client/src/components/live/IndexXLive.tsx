/**
 * 市场菜单下的指数小窗（全部实时 / 真实日线计算）：
 *  - CIX  主要指数：全球主要股指盘中结构（交易状态、开盘缺口、较开盘、振幅、日内位置、异常波动倍数）· 归一化走势对比
 *  - CIXX 自定义指数：按成分股真实日线合成的等权篮子指数（可新建、编辑、永久保存），含今日实时贡献
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtPct, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, drawdown, f2, heat, perf, rets, sgn, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, INP, MiniLine, Note, RangeBar, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
const dayOf = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10);

/* ================================================================== CIX 主要指数 */
const IDX: Array<{ s: string; n: string; r: string }> = [
  { s: "^GSPC", n: "标普 500", r: "美洲" }, { s: "^NDX", n: "纳斯达克 100", r: "美洲" }, { s: "^DJI", n: "道琼斯工业", r: "美洲" }, { s: "^RUT", n: "罗素 2000", r: "美洲" },
  { s: "^GSPTSE", n: "多伦多综合", r: "美洲" }, { s: "^BVSP", n: "巴西圣保罗", r: "美洲" },
  { s: "^FTSE", n: "富时 100", r: "欧洲" }, { s: "^GDAXI", n: "德国 DAX", r: "欧洲" }, { s: "^FCHI", n: "法国 CAC40", r: "欧洲" }, { s: "^STOXX50E", n: "欧洲斯托克 50", r: "欧洲" },
  { s: "sh000001", n: "上证指数", r: "亚太" }, { s: "sh000300", n: "沪深 300", r: "亚太" }, { s: "sz399006", n: "创业板指", r: "亚太" }, { s: "^HSI", n: "恒生指数", r: "亚太" },
  { s: "^N225", n: "日经 225", r: "亚太" }, { s: "^KS11", n: "韩国综合", r: "亚太" }, { s: "^TWII", n: "台湾加权", r: "亚太" }, { s: "^BSESN", n: "印度 SENSEX", r: "亚太" }, { s: "^AXJO", n: "澳洲 200", r: "亚太" },
];
const REGIONS = ["全部", "美洲", "欧洲", "亚太"];
const nameOf = (s: string) => IDX.find((x) => x.s === s)?.n ?? s;

export function CixLive({ onClose }: P) {
  const [tab, setTab] = useState("list");
  const [region, setRegion] = useState("全部");
  const [look, setLook] = useState<"63" | "126" | "252">("252");
  const [chosen, setChosen] = useState<string[]>(["^GSPC", "^NDX", "sh000300", "^HSI", "^N225", "^GDAXI"]);
  const syms = IDX.map((x) => x.s);
  const ticks = useTicks([...syms, "^VIX"]);
  const pack = useCloses(syms, 400);
  const { pick } = useHub();
  const st = useMemo(() => {
    const o: Record<string, { adr: number | null; c: number[]; m1: number | null; m3: number | null; ytd: number | null; y1: number | null; vol: number | null; dd: number | null; mdd: number | null; lo: number | null; hi: number | null; cs: number | null }> = {};
    if (!pack.data) return o;
    for (const x of IDX) {
      const raw = (pack.data[x.s] ?? []).map((p) => p[1]);
      if (raw.length < 30) continue;
      const dates = (pack.data[x.s] ?? []).map((p) => dayOf(p[0]));
      const y = raw.slice(-253);
      const hi = Math.max(...y), lo = Math.min(...y);
      const dd = drawdown(y);
      const al = align(pack.data, [x.s, "^GSPC"]);
      const ad = rets(raw.slice(-21)).map((v) => Math.abs(v) * 100);
      o[x.s] = { adr: ad.length ? ad.reduce((a, b) => a + b, 0) / ad.length : null, c: raw.slice(-120), m1: perf(raw, 21), m3: perf(raw, 63), ytd: ytd(raw, dates), y1: perf(raw, 252), vol: annVol(raw, 60), dd: (raw[raw.length - 1] / hi - 1) * 100, mdd: dd.max, lo, hi, cs: x.s === "^GSPC" ? 1 : corr(rets(al.m[x.s].slice(-253)), rets(al.m["^GSPC"].slice(-253))) };
    }
    return o;
  }, [pack.data]);
  const rows = IDX.filter((x) => region === "全部" || x.r === region);
  const up = IDX.filter((x) => (ticks[x.s]?.changePct ?? 0) > 0).length;
  const norm = useMemo(() => {
    if (!pack.data || !chosen.length) return null;
    const al = align(pack.data, chosen);
    const n = Number(look) + 1;
    return { dates: al.dates.slice(-n), series: chosen.map((s, i) => { const c = al.m[s].slice(-n); return { name: nameOf(s), color: COLORS[i % COLORS.length], values: c.map((v) => (v / c[0]) * 100) }; }) };
  }, [pack.data, chosen, look]);
  return (
    <PanelShell code="CIX" title="全球主要指数" onClose={onClose} tabs={[["list", "盘中结构"], ["trend", "走势对比"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["上涨 / 下跌", `${up} / ${IDX.length - up}`], ["标普 500", fmtPrice(ticks["^GSPC"]?.price), fmtPct(ticks["^GSPC"]?.changePct)], ["沪深 300", fmtPrice(ticks.sh000300?.price), fmtPct(ticks.sh000300?.changePct)], ["恒生指数", fmtPrice(ticks["^HSI"]?.price), fmtPct(ticks["^HSI"]?.changePct)], ["波动率指数", fmtPrice(ticks["^VIX"]?.price), fmtPct(ticks["^VIX"]?.changePct)]]} />
      {tab === "list" && (
        <>
          <div className="px-2 py-1"><Seg value={region} options={REGIONS.map((r) => [r, r] as [string, string])} onChange={setRegion} /></div>
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>指数</th><th className={THL}>地区</th><th className={THL}>状态</th><th className={TH}>最新</th><th className={TH}>涨跌</th><th className={TH}>涨跌幅</th><th className={TH}>开盘缺口</th><th className={TH}>较开盘</th><th className={TH}>日内振幅</th><th className={TH}>日内位置</th><th className={TH}>今日波动 / 20 日均值</th><th className={TH}>更新</th></tr></thead>
            <tbody>{rows.map((x) => {
              const t = ticks[x.s], s = st[x.s];
              const live = t?.time ? Date.now() - t.time < 15 * 60_000 : false;
              const gap = t?.open && t.prevClose ? (t.open / t.prevClose - 1) * 100 : null;
              const fromOpen = t?.open ? (t.price / t.open - 1) * 100 : null;
              const amp = t?.high != null && t?.low != null && t.prevClose ? ((t.high - t.low) / t.prevClose) * 100 : null;
              const ratio = t?.changePct != null && s?.adr ? Math.abs(t.changePct) / s.adr : null;
              return (
                <tr key={x.s} onClick={() => pick(x.s)} className={`${ROW} cursor-pointer`}>
                  <td className={`${TDL} text-slate-100`}>{x.n}</td><td className={`${TDL} text-[10px] text-slate-500`}>{x.r}</td>
                  <td className={`${TDL} text-[10px]`} style={{ color: live ? "#f2495c" : "#64748b" }}>{live ? "● 交易中" : "已收盘"}</td>
                  <td className={`${TD} text-white`}>{fmtPrice(t?.price)}</td>
                  <td className={TD} style={{ color: toneOf(t?.change) }}>{t?.change == null ? "—" : `${t.change > 0 ? "+" : ""}${t.change.toFixed(2)}`}</td>
                  <td className={TD} style={{ color: toneOf(t?.changePct), background: heat(t?.changePct, 3) }}>{fmtPct(t?.changePct)}</td>
                  <td className={TD} style={{ color: toneOf(gap) }}>{sgn(gap)}</td>
                  <td className={TD} style={{ color: toneOf(fromOpen) }}>{sgn(fromOpen)}</td>
                  <td className={`${TD} text-slate-300`}>{f2(amp, 2, "%")}</td>
                  <td className={TD}><RangeBar lo={t?.low ?? null} hi={t?.high ?? null} v={t?.price ?? null} w={70} /></td>
                  <td className={TD} style={{ color: (ratio ?? 0) >= 2 ? "#fbbf24" : "#cbd5e1" }}>{ratio == null ? "—" : `${ratio.toFixed(1)} 倍`}</td>
                  <td className={`${TD} text-[10px] text-slate-500`}>{t?.time ? new Date(t.time).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                </tr>
              );
            })}
              {!Object.keys(ticks).length && <tr><td colSpan={12}><Empty loading /></td></tr>}
            </tbody>
          </table>
          <Note>开盘缺口 = 今开相对昨收；较开盘 = 最新相对今开（反映盘中资金方向）；日内位置为最新价在今日最低—最高区间中的位置；「今日波动 / 20 日均值」≥ 2 倍（黄色）提示异常波动。</Note>
        </>
      )}
      {tab === "trend" && (
        <>
          <div className="flex flex-wrap items-center gap-1 px-2 py-1">
            {IDX.map((x) => <button type="button" key={x.s} onClick={() => setChosen((c) => c.includes(x.s) ? c.filter((y) => y !== x.s) : c.length >= 8 ? c : [...c, x.s])} className={`border px-1.5 py-0.5 text-[10px] ${chosen.includes(x.s) ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-500 hover:text-slate-300"}`}>{x.n}</button>)}
            <span className="ml-auto"><Seg value={look} options={[["63", "3 个月"], ["126", "6 个月"], ["252", "1 年"]]} onChange={setLook} /></span>
          </div>
          {norm ? <Lines height={260} xLabels={norm.dates} fmt={(v) => v.toFixed(1)} series={norm.series} /> : <Empty loading={pack.loading} text="请选择指数" />}
          <SectionHead title="区间收益排名" />
          <Bars data={(norm?.series ?? []).map((s) => ({ k: s.name, v: (s.values[s.values.length - 1] ?? 100) - 100 })).sort((a, b) => b.v - a.v)} fmt={(v) => `${v.toFixed(2)}%`} height={120} />
          <Note>以区间首日收盘为 100 归一化；不同市场按共同交易日对齐（休市日沿用前值），最多同时比较 8 个指数。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== CIXX 自定义指数 */
type Basket = { name: string; members: string[] };
const DEFAULT_BASKETS: Basket[] = [
  { name: "人工智能龙头", members: ["NVDA", "MSFT", "GOOGL", "META", "AMZN", "AVGO"] },
  { name: "清洁能源", members: ["ENPH", "FSLR", "NEE", "PLUG", "BE"] },
  { name: "中概科技", members: ["BABA", "PDD", "JD", "BIDU", "0700.HK"] },
  { name: "全球大型银行", members: ["JPM", "BAC", "GS", "HSBC", "UBS"] },
  { name: "A股白酒", members: ["sh600519", "sz000858", "sz000568", "sh600809"] },
];

export function CixxLive({ onClose }: P) {
  const saved = useSaved<{ baskets: Basket[] }>("cixx-baskets");
  const [baskets, setBaskets] = useState<Basket[]>(DEFAULT_BASKETS);
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState("list");
  const [edit, setEdit] = useState<{ name: string; members: string } | null>(null);
  useEffect(() => { if (saved.data?.baskets?.length) setBaskets(saved.data.baskets); }, [saved.data]);
  const all = [...new Set([...baskets.flatMap((b) => b.members), "^GSPC"])].slice(0, 60);
  const ticks = useTicks(all);
  const pack = useCloses(all, 400);
  const idx = useMemo(() => {
    if (!pack.data) return null;
    return baskets.map((b) => {
      const ok = b.members.filter((m) => (pack.data![m] ?? []).length > 30);
      if (!ok.length) return { b, ok, dates: [] as string[], level: [] as number[], bench: [] as number[], ytd: null as number | null, y1: null as number | null, vol: null as number | null, mdd: null as number | null, beta: null as number | null };
      const al = align(pack.data, [...ok, "^GSPC"]);
      const n = Math.min(al.dates.length, 253);
      const dates = al.dates.slice(-n);
      // 等权、每日再平衡：指数日收益 = 成分日收益的算术平均
      const level = [100];
      for (let i = 1; i < n; i++) {
        const r = ok.map((m) => { const c = al.m[m].slice(-n); return c[i] / c[i - 1] - 1; });
        level.push(level[i - 1] * (1 + r.reduce((s, x) => s + x, 0) / r.length));
      }
      const sp = al.m["^GSPC"].slice(-n), bench = sp.map((v) => (v / sp[0]) * 100);
      const dd = drawdown(level);
      const lr = rets(level), br = rets(bench);
      const c = corr(lr, br);
      const vb = annVol(bench), vl = annVol(level);
      return { b, ok, dates, level, bench, ytd: ytd(level, dates), y1: (level[level.length - 1] / 100 - 1) * 100, vol: vl, mdd: dd.max, beta: c != null && vb && vl ? (c * vl) / vb : null };
    });
  }, [pack.data, baskets]);
  const todayOf = (ok: string[]) => { const v = ok.map((m) => ticks[m]?.changePct).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const cur = idx?.[sel];
  const persist = async (next: Basket[]) => {
    setBaskets(next);
    try { await saveItem("cixx-baskets", { baskets: next }); toast.success("自定义指数已保存"); } catch { toast.error("保存失败"); }
  };
  const submit = () => {
    if (!edit) return;
    const members = [...new Set(edit.members.split(/[\s,，;；]+/).map((x) => x.trim()).filter(Boolean).map((x) => (/^(sh|sz|bj)\d{6}$/i.test(x) ? x.toLowerCase() : x.toUpperCase())))];
    if (!edit.name.trim() || members.length < 2) { toast.error("请填写名称，并至少输入 2 个成分代码"); return; }
    if (members.length > 20) { toast.error("单个指数最多 20 个成分"); return; }
    const exists = baskets.findIndex((b) => b.name === edit.name.trim());
    const next = exists >= 0 ? baskets.map((b, i) => (i === exists ? { name: b.name, members } : b)) : [...baskets, { name: edit.name.trim(), members }];
    void persist(next);
    setEdit(null);
  };
  return (
    <PanelShell code="CIXX" title="自定义指数" onClose={onClose} tabs={[["list", "指数一览"], ["detail", "成分与贡献"]]} tab={tab} setTab={setTab}
      right={<button type="button" className={BTN} onClick={() => setEdit({ name: "", members: "" })}>新建指数</button>}>
      {edit && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1.5">
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="指数名称" className={`${INP} w-36`} />
          <input value={edit.members} onChange={(e) => setEdit({ ...edit, members: e.target.value })} placeholder="成分代码，空格或逗号分隔，如 AAPL MSFT sh600519 0700.HK" className={`${INP} min-w-[320px] flex-1`} />
          <button type="button" className={BTN} onClick={submit}>保存</button><button type="button" className={BTN} onClick={() => setEdit(null)}>取消</button>
        </div>
      )}
      {!idx ? <Empty loading={pack.loading} /> : (
        <>
          {tab === "list" && (
            <>
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-slate-500"><tr><th className={THL}>指数</th><th className={TH}>成分数</th><th className={TH}>点位（1年前=100）</th><th className={TH}>今日（实时）</th><th className={TH}>年初至今</th><th className={TH}>近1年</th><th className={TH}>年化波动</th><th className={TH}>最大回撤</th><th className={TH}>对标普 Beta</th><th className={TH}>走势</th><th className={TH} /></tr></thead>
                <tbody>{idx.map((x, i) => (
                  <tr key={x.b.name} onClick={() => { setSel(i); setTab("detail"); }} className={`${ROW} cursor-pointer ${i === sel ? "bg-[#0d2236]" : ""}`}>
                    <td className={`${TDL} text-slate-100`}>{x.b.name}</td><td className={`${TD} text-slate-400`}>{x.ok.length}/{x.b.members.length}</td>
                    <td className={`${TD} text-white`}>{f2(x.level[x.level.length - 1])}</td>
                    <td className={TD} style={{ color: toneOf(todayOf(x.ok)) }}>{sgn(todayOf(x.ok))}</td>
                    <td className={TD} style={{ color: toneOf(x.ytd) }}>{sgn(x.ytd)}</td>
                    <td className={TD} style={{ color: toneOf(x.y1), background: heat(x.y1, 40) }}>{sgn(x.y1)}</td>
                    <td className={`${TD} text-slate-300`}>{f2(x.vol, 1, "%")}</td>
                    <td className={TD} style={{ color: toneOf(x.mdd) }}>{sgn(x.mdd)}</td>
                    <td className={`${TD} text-slate-300`}>{f2(x.beta)}</td>
                    <td className={TD}><MiniLine values={x.level} w={90} color={(x.y1 ?? 0) >= 0 ? "#f2495c" : "#1fbf75"} /></td>
                    <td className={TD}>{baskets.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); setSel(0); void persist(baskets.filter((_, j) => j !== i)); }} className="text-[10px] text-slate-500 hover:text-rose-300">删除</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
              <SectionHead title="各指数 vs 标普 500（1 年前为 100）" />
              <Lines height={220} xLabels={idx[0]?.dates} fmt={(v) => v.toFixed(1)} series={[...idx.filter((x) => x.level.length).map((x, i) => ({ name: x.b.name, color: COLORS[i % COLORS.length], values: x.level })), { name: "标普 500", color: "#64748b", values: idx.find((x) => x.bench.length)?.bench ?? [], dash: true }]} />
              <Note>等权、每日再平衡：指数日收益为各成分日收益的算术平均；跨市场成分按共同交易日对齐。今日涨跌为成分实时涨跌幅的等权平均。自定义指数永久保存在你的个人账户。</Note>
            </>
          )}
          {tab === "detail" && cur && (
            <>
              <div className="flex flex-wrap items-center gap-1 px-2 py-1">{idx.map((x, i) => <button type="button" key={x.b.name} onClick={() => setSel(i)} className={`border px-2 py-0.5 text-[10px] ${i === sel ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-400"}`}>{x.b.name}</button>)}<button type="button" className={`${BTN} ml-auto`} onClick={() => setEdit({ name: cur.b.name, members: cur.b.members.join(" ") })}>编辑成分</button></div>
              <Kpis items={[["点位", f2(cur.level[cur.level.length - 1])], ["今日", sgn(todayOf(cur.ok))], ["近1年", sgn(cur.y1)], ["年化波动", f2(cur.vol, 1, "%")], ["Beta", f2(cur.beta)]]} />
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-slate-500"><tr><th className={THL}>成分</th><th className={TH}>权重</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>今日贡献</th><th className={TH}>近1年</th><th className={TH}>1年贡献（近似）</th><th className={TH}>60日波动</th></tr></thead>
                <tbody>{cur.b.members.map((m) => {
                  const w = cur.ok.includes(m) ? 1 / cur.ok.length : 0;
                  const c = (pack.data?.[m] ?? []).map((p) => p[1]);
                  const y1 = perf(c, Math.min(252, c.length - 1));
                  return (
                    <tr key={m} className={ROW}>
                      <td className={`${TDL} font-mono text-cyan-200`}>{m}{!w && <span className="ml-1 text-[9px] text-slate-500">无日线</span>}</td>
                      <td className={`${TD} text-slate-300`}>{(w * 100).toFixed(1)}%</td>
                      <td className={`${TD} text-white`}>{fmtPrice(ticks[m]?.price)}</td>
                      <td className={TD} style={{ color: toneOf(ticks[m]?.changePct) }}>{fmtPct(ticks[m]?.changePct)}</td>
                      <td className={TD} style={{ color: toneOf(ticks[m]?.changePct) }}>{ticks[m]?.changePct == null ? "—" : sgn(ticks[m]!.changePct! * w, 3)}</td>
                      <td className={TD} style={{ color: toneOf(y1) }}>{sgn(y1)}</td>
                      <td className={TD} style={{ color: toneOf(y1) }}>{y1 == null ? "—" : sgn(y1 * w)}</td>
                      <td className={`${TD} text-slate-300`}>{f2(annVol(c, 60), 1, "%")}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
              <SectionHead title="今日成分贡献（百分点）" />
              <Bars data={cur.ok.map((m) => ({ k: m, v: (ticks[m]?.changePct ?? 0) / cur.ok.length })).sort((a, b) => b.v - a.v)} fmt={(v) => v.toFixed(3)} height={120} />
              <Note>「1 年贡献」按初始等权近似（日度再平衡下实际贡献与之略有差异）。</Note>
            </>
          )}
        </>
      )}
    </PanelShell>
  );
}
