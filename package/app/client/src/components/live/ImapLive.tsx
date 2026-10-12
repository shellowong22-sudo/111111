/**
 * IMAP 日内市场图：美股板块与细分行业 ETF 的盘中地图。
 *  - 瓦片：面积按今日成交额，颜色按今日涨跌（涨红跌绿）
 *  - 盘中路径：所选板块 vs 标普 500 的日内累计涨跌（5 分钟线）
 *  - 盘中广度与分化：各时点上涨板块数、板块涨跌幅横截面标准差
 * 与 WEI（全球股指）、BMAP（国家热力图）、TFLO（成交额与资金方向）角度不同。
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { Lines, useHub } from "@/uc/hubs/kit";
import { heat, mean, std } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { useBars } from "./EqFlowKit";

type P = { onClose?: () => void };
const SECTORS: Array<[string, string]> = [
  ["XLK", "信息技术"], ["XLF", "金融"], ["XLV", "医疗保健"], ["XLY", "可选消费"], ["XLC", "通信服务"], ["XLI", "工业"],
  ["XLP", "必需消费"], ["XLE", "能源"], ["XLU", "公用事业"], ["XLRE", "房地产"], ["XLB", "原材料"],
];
const INDUSTRIES: Array<[string, string]> = [
  ["SOXX", "半导体"], ["IGV", "软件"], ["KRE", "地区银行"], ["IBB", "生物科技"], ["XHB", "住宅建筑"], ["ITA", "航空国防"],
  ["XRT", "零售"], ["XOP", "油气开采"], ["GDX", "金矿"], ["ICLN", "清洁能源"], ["JETS", "航空"], ["TAN", "光伏"],
];
const BENCH = "SPY";
const ALL = [...SECTORS, ...INDUSTRIES];
const etDay = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const etHm = (t: number) => new Date(t).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
const regular = (t: number) => { const hm = etHm(t); return hm >= "09:30" && hm <= "16:00"; };
const etTime = (t: number) => new Date(t).toLocaleTimeString("zh-CN", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });

export function ImapLive({ onClose }: P) {
  const syms = useMemo(() => [BENCH, ...ALL.map(([s]) => s)], []);
  const t = useTicks(syms);
  const bars = useBars(syms, 240, "5m", 120_000);
  const [sel, setSel] = useState("XLK");
  const [ring, setRing] = useState<"sector" | "industry">("sector");
  const { pick } = useHub();

  const turnover = (s: string) => { const k = t[s]; if (!k) return null; return k.amount ?? (k.volume != null ? k.volume * k.price : null); };
  const list = ring === "sector" ? SECTORS : INDUSTRIES;
  const totalTurn = list.reduce((a, [s]) => a + (turnover(s) ?? 0), 0);

  // 盘中路径：以昨收为基准的累计涨跌（只取最新交易日的常规时段）
  const paths = useMemo(() => {
    const out: Record<string, Map<number, number>> = {};
    let day: string | null = null;
    const ref = bars.data[BENCH];
    if (ref?.length) day = ref.filter((c) => !c.s && regular(c.t)).map((c) => etDay(c.t)).sort().at(-1) ?? null;
    if (!day) return { times: [] as number[], out, day };
    for (const s of syms) {
      const all = (bars.data[s] ?? []).filter((c) => !c.s && regular(c.t)).sort((a, b) => a.t - b.t);
      const cs = all.filter((c) => etDay(c.t) === day);
      const before = all.filter((c) => etDay(c.t) < day!);
      // 基准 = 上一交易日最后一根 5 分钟线收盘（与所示交易日一致）；没有上一日数据时用该日开盘
      const prev = before.length ? before[before.length - 1].c : cs[0]?.o;
      if (!cs.length || !prev) continue;
      // 未走完的最新一根时间戳不在整 5 分钟上，统一归到所属 5 分钟桶
      out[s] = new Map(cs.map((c) => [Math.floor(c.t / 300_000) * 300_000, (c.c / prev - 1) * 100]));
    }
    const times = [...new Set(Object.values(out).flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
    // 个别标的某一桶缺失时沿用其上一桶的值，避免广度统计只数到部分标的
    for (const m of Object.values(out)) {
      let last: number | undefined;
      for (const x of times) { const v = m.get(x); if (v != null) last = v; else if (last != null) m.set(x, last); }
    }
    return { times, out, day };
  }, [bars.data, syms]);

  const series = (s: string) => paths.times.map((x) => paths.out[s]?.get(x) ?? null);
  const breadth = paths.times.map((x) => {
    const v = list.map(([s]) => paths.out[s]?.get(x)).filter((y): y is number => y != null);
    return v.length ? { up: v.filter((y) => y > 0).length, disp: std(v) } : null;
  });

  const chg = list.map(([s]) => t[s]?.changePct).filter((v): v is number => v != null);
  const up = chg.filter((v) => v > 0).length;
  const sorted = [...list].sort((a, b) => (t[b[0]]?.changePct ?? -99) - (t[a[0]]?.changePct ?? -99));
  const selLabel = ALL.find(([s]) => s === sel)?.[1] ?? sel;
  const xLabels = paths.times.map(etTime);

  return (
    <PanelShell code="IMAP" title="日内市场图" onClose={onClose}
      right={<span className="inline-flex gap-1">{([["sector", "11 大板块"], ["industry", "细分行业"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setRing(k)} className={`border px-1.5 text-[10px] ${ring === k ? "border-cyan-500 bg-cyan-900/30 text-cyan-100" : "border-[#1d3047] text-slate-400"}`}>{l}</button>)}</span>}>
      <Kpis items={[
        ["标普 500", <span key="s" style={{ color: toneOf(t[BENCH]?.changePct) }}>{fmtPrice(t[BENCH]?.price)} {fmtPct(t[BENCH]?.changePct)}</span>],
        ["上涨 / 下跌", chg.length ? <span key="b"><span style={{ color: "#f2495c" }}>{up}</span> / <span style={{ color: "#1fbf75" }}>{chg.length - up}</span></span> : "—"],
        ["平均涨跌", chg.length ? <span key="m" style={{ color: toneOf(mean(chg)) }}>{fmtPct(mean(chg))}</span> : "—"],
        ["横截面分化", chg.length > 2 ? `${std(chg).toFixed(2)}%` : "—"],
        ["领涨", sorted[0] ? `${sorted[0][1]} ${fmtPct(t[sorted[0][0]]?.changePct)}` : "—"],
        ["领跌", sorted.at(-1) ? `${sorted.at(-1)![1]} ${fmtPct(t[sorted.at(-1)![0]]?.changePct)}` : "—"],
      ]} />

      <SectionHead title="市场地图" sub="单击看盘中路径，双击看 K 线" />
      {!chg.length ? <Empty loading text="行情读取中" /> : (
        <div className="flex flex-wrap gap-px bg-[#1a2a3c] p-px">
          {list.map(([s, l]) => {
            const k = t[s]; const w = totalTurn > 0 ? (turnover(s) ?? 0) / totalTurn : 1 / list.length;
            return (
              <button key={s} type="button" onClick={() => setSel(s)} onDoubleClick={() => pick(s)}
                style={{ flexGrow: Math.max(w * 100, 2), flexBasis: `${Math.max(8, w * 100)}%`, background: heat(k?.changePct, 3) ?? "#0a1726", outline: sel === s ? "1px solid #22d3ee" : undefined }}
                className="min-h-[64px] px-2 py-1 text-left">
                <div className="text-[11px] text-white">{l}<span className="ml-1 font-mono text-[9px] text-slate-300">{s}</span></div>
                <div className="font-mono text-[13px] font-semibold text-white">{fmtPct(k?.changePct)}</div>
                <div className="font-mono text-[9px] text-slate-300">额 {fmtCompact(turnover(s))} · {(w * 100).toFixed(1)}%</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-2">
        <div className="bg-[#03070c]">
          <SectionHead title={`${selLabel} vs 标普 500 · 盘中累计涨跌（%）`} sub={`交易日 ${paths.day ?? "—"}`} />
          {paths.times.length ? <Lines series={[{ name: selLabel, color: "#22d3ee", values: series(sel) }, { name: "标普 500", color: "#94a3b8", values: series(BENCH), dash: true }]} xLabels={xLabels} height={170} fmt={(v) => v.toFixed(2)} zero /> : <Empty loading={bars.loading} text="今日盘中数据暂未生成（非交易时段显示最近交易日）" />}
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title="盘中广度与分化" sub={`上涨${ring === "sector" ? "板块" : "行业"}数与分化度`} />
          {paths.times.length ? <Lines series={[{ name: "上涨数", color: "#f2495c", values: breadth.map((b) => b?.up ?? null) }, { name: "分化度", color: "#f5b942", values: breadth.map((b) => (b ? b.disp : null)) }]} xLabels={xLabels} height={170} fmt={(v) => v.toFixed(1)} /> : <Empty loading={bars.loading} />}
        </div>
      </div>

      <SectionHead title="明细" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left font-normal">名称</th><th className="px-2 text-right font-normal">最新</th><th className="px-2 text-right font-normal">今日</th><th className="px-2 text-right font-normal">相对标普</th><th className="px-2 text-right font-normal">日内振幅</th><th className="px-2 text-right font-normal">开盘以来</th><th className="px-2 text-right font-normal">成交额</th></tr></thead>
        <tbody>{sorted.map(([s, l]) => { const k = t[s]; const rel = k?.changePct != null && t[BENCH]?.changePct != null ? k.changePct - t[BENCH]!.changePct! : null; const amp = k?.high != null && k?.low != null && k.prevClose ? (k.high - k.low) / k.prevClose * 100 : null; const fromOpen = k?.open ? (k.price / k.open - 1) * 100 : null; return (
          <tr key={s} onClick={() => setSel(s)} onDoubleClick={() => pick(s)} className={`cursor-pointer border-t border-[#0f1b29] ${sel === s ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
            <td className="px-2 py-0.5 text-slate-100">{l}<span className="ml-1 font-mono text-[9px] text-slate-500">{s}</span></td>
            <td className="px-2 text-right font-mono text-white">{fmtPrice(k?.price)}</td>
            <td className="px-2 text-right font-mono" style={{ color: toneOf(k?.changePct) }}>{fmtPct(k?.changePct)}</td>
            <td className="px-2 text-right font-mono" style={{ color: toneOf(rel) }}>{fmtPct(rel)}</td>
            <td className="px-2 text-right font-mono text-slate-300">{amp == null ? "—" : `${amp.toFixed(2)}%`}</td>
            <td className="px-2 text-right font-mono" style={{ color: toneOf(fromOpen) }}>{fmtPct(fromOpen)}</td>
            <td className="px-2 text-right font-mono text-slate-300">{fmtCompact(turnover(s))}</td>
          </tr>
        ); })}</tbody>
      </table>
    </PanelShell>
  );
}

export default ImapLive;
