/**
 * 商品 / 市场分组小窗（终端菜单「市场」下的 CTM / WEIF / SPOT / SEAG / CPLY / CCRV / MAP / GP），全部接实时数据：
 *  - CTM  合约表：各品种合约规格 + 实时名义价值 / 最小变动价值 / 单手日波动金额 + 各合约月流动性与移仓状态
 *  - WEIF 周度经济指标：经济日历中的美国周度数据（初请、库存、按揭申请等）实际值 / 预期 / 前值 + 周度市场温度
 *  - SPOT 现货（近月）报价：单位换算、人民币计价、区间表现与 52 周位置、炼油 / 压榨加工价差
 *  - SEAG 季节性：多年真实日线计算月度收益、上涨概率、年内季节路径与当年对比
 *  - CPLY 商品供需：库存周报（实际 vs 预期）、期限结构松紧、产业（生产商 / 互换商）套保持仓
 *  - CCRV 商品期货曲线：多品种曲线归一化对比、展期收益排名、曲线日内形变
 *  - MAP  全球市场地图：按地区的股指 / 货币热力瓦片
 *  - GP   价格走势图：单一标的走势 + 区间统计
 */
import { useMemo, useState } from "react";
import KlineChart from "@/uc/market/KlineChart";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useKline, usePolled, useTicks, type Period } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, drawdown, f2, heat, mean, perf, rets, sgn, std, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { BTN, INP, MiniLine, Note, RangeBar, ROW, TD, TDL, TH, THL, evTime, median, monthsBetween, numOf, pctRank, useCalendarSpan, type EconEvent, type FutCurve, type P } from "./LiveCommon";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];

/* ================================================================== CTM 合约表 */
type Spec = { root: string; sym: string; name: string; ex: string; cat: string; size: string; unit: string; tick: number; tickTxt: string; mult: number };
const SPECS: Spec[] = [
  { root: "CL", sym: "CL", name: "WTI 原油", ex: "NYMEX", cat: "能源", size: "1,000 桶", unit: "美元/桶", tick: 0.01, tickTxt: "0.01", mult: 1000 },
  { root: "BZ", sym: "BRENT", name: "布伦特原油", ex: "NYMEX", cat: "能源", size: "1,000 桶", unit: "美元/桶", tick: 0.01, tickTxt: "0.01", mult: 1000 },
  { root: "NG", sym: "NG", name: "天然气", ex: "NYMEX", cat: "能源", size: "10,000 百万英热", unit: "美元/百万英热", tick: 0.001, tickTxt: "0.001", mult: 10000 },
  { root: "RB", sym: "RB=F", name: "RBOB 汽油", ex: "NYMEX", cat: "能源", size: "42,000 加仑", unit: "美元/加仑", tick: 0.0001, tickTxt: "0.0001", mult: 42000 },
  { root: "HO", sym: "HO=F", name: "取暖油", ex: "NYMEX", cat: "能源", size: "42,000 加仑", unit: "美元/加仑", tick: 0.0001, tickTxt: "0.0001", mult: 42000 },
  { root: "GC", sym: "GC", name: "黄金", ex: "COMEX", cat: "贵金属", size: "100 金衡盎司", unit: "美元/盎司", tick: 0.1, tickTxt: "0.10", mult: 100 },
  { root: "SI", sym: "SI", name: "白银", ex: "COMEX", cat: "贵金属", size: "5,000 金衡盎司", unit: "美元/盎司", tick: 0.005, tickTxt: "0.005", mult: 5000 },
  { root: "PL", sym: "PL", name: "铂金", ex: "NYMEX", cat: "贵金属", size: "50 金衡盎司", unit: "美元/盎司", tick: 0.1, tickTxt: "0.10", mult: 50 },
  { root: "PA", sym: "PA=F", name: "钯金", ex: "NYMEX", cat: "贵金属", size: "100 金衡盎司", unit: "美元/盎司", tick: 0.5, tickTxt: "0.50", mult: 100 },
  { root: "HG", sym: "HG", name: "铜", ex: "COMEX", cat: "工业金属", size: "25,000 磅", unit: "美元/磅", tick: 0.0005, tickTxt: "0.0005", mult: 25000 },
  { root: "ZC", sym: "ZC", name: "玉米", ex: "CBOT", cat: "谷物", size: "5,000 蒲式耳", unit: "美分/蒲式耳", tick: 0.25, tickTxt: "1/4 美分", mult: 50 },
  { root: "ZS", sym: "ZS", name: "大豆", ex: "CBOT", cat: "谷物", size: "5,000 蒲式耳", unit: "美分/蒲式耳", tick: 0.25, tickTxt: "1/4 美分", mult: 50 },
  { root: "ZW", sym: "ZW", name: "小麦", ex: "CBOT", cat: "谷物", size: "5,000 蒲式耳", unit: "美分/蒲式耳", tick: 0.25, tickTxt: "1/4 美分", mult: 50 },
  { root: "KC", sym: "KC=F", name: "咖啡", ex: "ICE 美国", cat: "软商品", size: "37,500 磅", unit: "美分/磅", tick: 0.05, tickTxt: "0.05 美分", mult: 375 },
  { root: "SB", sym: "SB=F", name: "原糖", ex: "ICE 美国", cat: "软商品", size: "112,000 磅", unit: "美分/磅", tick: 0.01, tickTxt: "0.01 美分", mult: 1120 },
  { root: "CC", sym: "CC=F", name: "可可", ex: "ICE 美国", cat: "软商品", size: "10 公吨", unit: "美元/吨", tick: 1, tickTxt: "1", mult: 10 },
  { root: "CT", sym: "CT=F", name: "棉花", ex: "ICE 美国", cat: "软商品", size: "50,000 磅", unit: "美分/磅", tick: 0.01, tickTxt: "0.01 美分", mult: 500 },
  { root: "LE", sym: "LE=F", name: "活牛", ex: "CME", cat: "畜牧", size: "40,000 磅", unit: "美分/磅", tick: 0.025, tickTxt: "0.025 美分", mult: 400 },
  { root: "HE", sym: "HE=F", name: "瘦肉猪", ex: "CME", cat: "畜牧", size: "40,000 磅", unit: "美分/磅", tick: 0.025, tickTxt: "0.025 美分", mult: 400 },
  { root: "ES", sym: "ES", name: "标普 500 期货", ex: "CME", cat: "股指", size: "50 美元 × 指数", unit: "点", tick: 0.25, tickTxt: "0.25 点", mult: 50 },
  { root: "NQ", sym: "NQ", name: "纳指 100 期货", ex: "CME", cat: "股指", size: "20 美元 × 指数", unit: "点", tick: 0.25, tickTxt: "0.25 点", mult: 20 },
  { root: "YM", sym: "YM", name: "道指期货", ex: "CBOT", cat: "股指", size: "5 美元 × 指数", unit: "点", tick: 1, tickTxt: "1 点", mult: 5 },
  { root: "RTY", sym: "RTY", name: "罗素 2000 期货", ex: "CME", cat: "股指", size: "50 美元 × 指数", unit: "点", tick: 0.1, tickTxt: "0.10 点", mult: 50 },
  { root: "ZT", sym: "ZT", name: "2 年美债期货", ex: "CBOT", cat: "利率", size: "面值 20 万美元", unit: "点（面值%）", tick: 1 / 256, tickTxt: "1/8 个 1/32", mult: 2000 },
  { root: "ZF", sym: "ZF", name: "5 年美债期货", ex: "CBOT", cat: "利率", size: "面值 10 万美元", unit: "点（面值%）", tick: 1 / 128, tickTxt: "1/4 个 1/32", mult: 1000 },
  { root: "ZN", sym: "ZN", name: "10 年美债期货", ex: "CBOT", cat: "利率", size: "面值 10 万美元", unit: "点（面值%）", tick: 1 / 64, tickTxt: "1/2 个 1/32", mult: 1000 },
  { root: "ZB", sym: "ZB", name: "30 年美债期货", ex: "CBOT", cat: "利率", size: "面值 10 万美元", unit: "点（面值%）", tick: 1 / 32, tickTxt: "1/32", mult: 1000 },
  { root: "UB", sym: "UB", name: "超长美债期货", ex: "CBOT", cat: "利率", size: "面值 10 万美元", unit: "点（面值%）", tick: 1 / 32, tickTxt: "1/32", mult: 1000 },
];
/** 品种代码 → 连续合约行情代码 */
export const contSym = (root: string) => SPECS.find((x) => x.root === root)?.sym ?? `${root}=F`;
const CTM_CATS = ["全部", "能源", "贵金属", "工业金属", "谷物", "软商品", "畜牧", "股指", "利率"];

function CtmSpecs({ cat }: { cat: string }) {
  const list = SPECS.filter((s) => cat === "全部" || s.cat === cat);
  const ticks = useTicks(list.map((s) => s.sym));
  const pack = useCloses(SPECS.map((s) => s.sym), 60);
  const { pick } = useHub();
  return (
    <>
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={THL}>交易所</th><th className={THL}>合约规模</th><th className={THL}>报价单位</th><th className={TH}>最小变动</th><th className={TH}>每跳价值</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>单手名义价值</th><th className={TH}>20日实波</th><th className={TH}>单手日波动金额</th></tr></thead>
        <tbody>
          {list.map((s) => {
            const t = ticks[s.sym];
            const px = t?.price ?? null;
            const c = (pack.data?.[s.sym] ?? []).map((x) => x[1]);
            const vol = annVol(c, 20);
            const notional = px != null ? px * s.mult : null;
            const dayMove = notional != null && vol != null ? (notional * vol) / 100 / Math.sqrt(252) : null;
            return (
              <tr key={s.root} onClick={() => pick(s.sym)} className={`cursor-pointer ${ROW}`}>
                <td className={TDL}><span className="text-slate-100">{s.name}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{s.root}</span></td>
                <td className="px-2 text-[10px] text-slate-400">{s.ex}</td>
                <td className="px-2 text-[10px] text-slate-300">{s.size}</td>
                <td className="px-2 text-[10px] text-slate-400">{s.unit}</td>
                <td className="px-2 text-right text-[10px] text-slate-300">{s.tickTxt}</td>
                <td className={`${TD} text-slate-200`}>${(s.tick * s.mult).toFixed(2)}</td>
                <td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPrice(px)}</td>
                <td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
                <td className={`${TD} text-white`}>{notional == null ? "—" : `$${Math.round(notional).toLocaleString()}`}</td>
                <td className={`${TD} text-slate-300`}>{f2(vol, 1, "%")}</td>
                <td className={`${TD} text-amber-200`}>{dayMove == null ? "—" : `$${Math.round(dayMove).toLocaleString()}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Note>单手名义价值 = 最新价 × 合约乘数；单手日波动金额 = 名义价值 × 20 日年化实现波动率 / √252，可作为单手持仓一个标准差日内盈亏的参考（交易所保证金以各交易所公布为准）。</Note>
    </>
  );
}

function CtmMonths({ cat }: { cat: string }) {
  const roots = SPECS.filter((s) => cat === "全部" || s.cat === cat).map((s) => s.root);
  const many = usePolled<FutCurve[]>("ucHubs.futuresMany", { roots }, 120_000);
  const [sel, setSel] = useState<string | null>(null);
  const { pick } = useHub();
  const list = many.data ?? [];
  const cur = list.find((c) => c.root === (sel ?? list[0]?.root));
  const spec = SPECS.find((s) => s.root === cur?.root);
  const rollState = (c: FutCurve) => {
    const [a, b] = c.points;
    if (!a || !b || a.volume == null || b.volume == null) return "—";
    return b.volume > a.volume ? "移仓中（次月成交已超近月）" : a.volume > 0 && b.volume / a.volume > 0.5 ? "移仓临近" : "近月主导";
  };
  if (!list.length) return <Empty loading={many.loading} />;
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="bg-[#03070c]">
        <SectionHead title="流动性与移仓状态" sub="按全部合约月成交量" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>挂牌月数</th><th className={TH}>总成交</th><th className={TH}>近月占比</th><th className={THL}>状态</th></tr></thead>
          <tbody>
            {list.map((c) => {
              const tot = c.points.reduce((s, p) => s + (p.volume ?? 0), 0);
              const share = tot ? ((c.points[0]?.volume ?? 0) / tot) * 100 : null;
              const st = rollState(c);
              return (
                <tr key={c.root} onClick={() => setSel(c.root)} className={`cursor-pointer ${ROW} ${cur?.root === c.root ? "bg-[#0d2236]" : ""}`}>
                  <td className={TDL}>{c.name}</td>
                  <td className={`${TD} text-slate-300`}>{c.points.length}</td>
                  <td className={`${TD} text-slate-200`}>{fmtCompact(tot)}</td>
                  <td className={`${TD} text-slate-300`}>{f2(share, 0, "%")}</td>
                  <td className={`px-2 text-[10px] ${st.startsWith("移仓中") ? "text-amber-300" : st === "移仓临近" ? "text-cyan-300" : "text-slate-500"}`}>{st}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-[#03070c]">
        <SectionHead title={`${cur?.name ?? ""} 各合约月`} sub={spec ? `${spec.ex} · ${spec.size} · ${spec.unit}` : undefined} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>合约</th><th className={THL}>交割月</th><th className={TH}>距今（月）</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>成交量</th><th className={TH}>成交占比</th><th className={TH}>单手名义价值</th></tr></thead>
          <tbody>
            {(cur?.points ?? []).map((p) => {
              const tot = cur!.points.reduce((s, x) => s + (x.volume ?? 0), 0);
              const now = new Date();
              const m = monthsBetween(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, p.month);
              return (
                <tr key={p.code} onClick={() => spec && pick(spec.sym)} className={`cursor-pointer ${ROW}`}>
                  <td className={`${TDL} font-mono text-slate-200`}>{p.code}</td>
                  <td className="px-2 text-slate-400">{p.month}</td>
                  <td className={`${TD} text-slate-400`}>{m.toFixed(0)}</td>
                  <td className={`${TD} text-white`}>{fmtPrice(p.price)}</td>
                  <td className={TD} style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)}</td>
                  <td className={`${TD} text-slate-300`}>{fmtCompact(p.volume)}</td>
                  <td className={TD}><span className="inline-block h-1.5 bg-cyan-500/70 align-middle" style={{ width: `${tot ? Math.max(1, ((p.volume ?? 0) / tot) * 60) : 0}px` }} /> <span className="text-slate-400">{tot ? (((p.volume ?? 0) / tot) * 100).toFixed(1) : "—"}%</span></td>
                  <td className={`${TD} text-slate-300`}>{spec ? `$${Math.round(p.price * spec.mult).toLocaleString()}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Note>成交量向次月集中通常意味着多头 / 空头正在把头寸从即将到期的合约移到下一个合约（移仓）；点击任一行查看该品种连续合约 K 线。</Note>
      </div>
    </div>
  );
}

export function CtmLive({ onClose }: P) {
  const [tab, setTab] = useState("spec");
  const [cat, setCat] = useState("全部");
  return (
    <PanelShell code="CTM" title="合约表" onClose={onClose} tabs={[["spec", "合约规格与风险"], ["months", "合约月与移仓"]]} tab={tab} setTab={setTab}
      right={<select value={cat} onChange={(e) => setCat(e.target.value)} className={INP}>{CTM_CATS.map((c) => <option key={c}>{c}</option>)}</select>}>
      {tab === "spec" ? <CtmSpecs cat={cat} /> : <CtmMonths cat={cat} />}
    </PanelShell>
  );
}

/* ================================================================== WEIF 周度经济指标 */
const WEEKLY: Array<[RegExp, string, string, 1 | -1]> = [
  [/Initial Jobless Claims(?!.*4-Week)/i, "首次申请失业救济", "就业", -1],
  [/Jobless Claims 4-Week Average/i, "初请四周均值", "就业", -1],
  [/Continuing Jobless Claims/i, "续请失业救济", "就业", -1],
  [/MBA Mortgage Applications/i, "MBA 按揭申请（周环比）", "地产", 1],
  [/MBA Purchase Index/i, "MBA 购房申请指数", "地产", 1],
  [/MBA 30-Year Mortgage Rate/i, "MBA 30 年按揭利率", "地产", -1],
  [/Redbook/i, "红皮书零售（同比）", "消费", 1],
  [/^(?!.*Cushing)(?!.*API).*Crude Oil Inventories/i, "EIA 原油库存", "能源", -1],
  [/Cushing Crude Oil Inventories/i, "库欣原油库存", "能源", -1],
  [/Gasoline Inventories/i, "汽油库存", "能源", -1],
  [/Distillate Fuel Production|Distillate Inventories|Heating Oil Stockpiles/i, "馏分油", "能源", -1],
  [/Refinery Utilization|Refinery Crude Runs/i, "炼厂开工 / 加工量", "能源", 1],
  [/Natural Gas Storage/i, "天然气库存", "能源", -1],
  [/API Weekly Crude Oil Stock/i, "API 原油库存", "能源", -1],
  [/Fed's Balance Sheet/i, "美联储资产负债表", "货币", 1],
  [/Reserve Balances with Federal Reserve/i, "银行准备金余额", "货币", 1],
];
const classify = (e: EconEvent) => WEEKLY.find(([re]) => re.test(e.name));

function WeeklyBody({ tab }: { tab: string }) {
  const cal = useCalendarSpan(30, 8);
  const groups = useMemo(() => {
    const m = new Map<string, { label: string; cat: string; good: 1 | -1; hist: EconEvent[]; next: EconEvent | null }>();
    for (const e of cal.rows) {
      if (!/United States|美国/.test(e.country)) continue;
      const hit = classify(e);
      if (!hit) continue;
      const g = m.get(hit[1]) ?? { label: hit[1], cat: hit[2], good: hit[3], hist: [], next: null };
      if (e.released || e.actual) g.hist.push(e);
      else if (!g.next) g.next = e;
      m.set(hit[1], g);
    }
    return [...m.values()].sort((a, b) => a.cat.localeCompare(b.cat));
  }, [cal.rows]);
  const pack = useCloses(["SPY", "^TNX", "DXY", "CL", "HG", "^VIX", "HYG", "XHB"], 120);
  const { pick } = useHub();
  if (tab === "mkt") {
    const MK: Array<[string, string, string]> = [["SPY", "标普 500", "风险偏好"], ["^TNX", "10 年美债收益率", "增长 / 通胀预期"], ["DXY", "美元指数", "金融条件"], ["CL", "WTI 原油", "需求"], ["HG", "铜", "工业需求"], ["^VIX", "VIX", "避险"], ["HYG", "高收益债", "信用"], ["XHB", "住宅建筑", "地产"]];
    return (
      <>
        <SectionHead title="周度市场温度" sub="最近 1 / 4 / 13 周变化（收益率为基点）" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>指标</th><th className={THL}>反映</th><th className={TH}>最新</th><th className={TH}>1周</th><th className={TH}>4周</th><th className={TH}>13周</th><th className="px-2">26周走势</th></tr></thead>
          <tbody>
            {MK.map(([s, l, k]) => {
              const c = (pack.data?.[s] ?? []).map((x) => x[1]);
              const isY = s === "^TNX";
              const ch = (n: number) => (c.length > n ? (isY ? (c[c.length - 1] - c[c.length - 1 - n]) * 100 : perf(c, n)) : null);
              const weekly = c.filter((_, i) => (c.length - 1 - i) % 5 === 0);
              return (
                <tr key={s} onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}>
                  <td className={TDL}>{l}</td><td className="px-2 text-[10px] text-slate-500">{k}</td>
                  <td className={`${TD} text-white`}>{fmtPrice(c[c.length - 1])}</td>
                  {[5, 20, 65].map((n) => { const v = ch(n); return <td key={n} className={TD} style={{ background: heat(v, isY ? 30 : n === 5 ? 4 : 10) }}>{isY ? sgn(v, 0, "bp") : sgn(v, 1)}</td>; })}
                  <td className="px-2"><MiniLine values={weekly.slice(-26)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    );
  }
  const released = groups.flatMap((g) => g.hist.slice(-1).map((e) => ({ e, g })));
  const scored = released.filter(({ e }) => numOf(e.actual) != null && numOf(e.consensus) != null);
  const better = scored.filter(({ e, g }) => (numOf(e.actual)! - numOf(e.consensus)!) * g.good > 0).length;
  return (
    <>
      <Kpis items={[["跟踪的周度指标", String(groups.length), "近 30 天已公布"], ["最新一期好于预期", scored.length ? `${better} / ${scored.length}` : "—", "按对经济的方向判断"], ["本周待公布", String(groups.filter((g) => g.next).length), "未来 8 天"], ["最近更新", released.length ? released.map(({ e }) => e.date).sort().slice(-1)[0] : "—"]]} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>指标</th><th className={THL}>领域</th><th className={TH}>最新</th><th className={TH}>预期</th><th className={TH}>前值</th><th className={TH}>评估</th><th className="px-2">近期读数</th><th className={TH}>下次公布</th></tr></thead>
        <tbody>
          {groups.map((g) => {
            const last = g.hist[g.hist.length - 1];
            const a = numOf(last?.actual), c = numOf(last?.consensus);
            const dir = a != null && c != null && a !== c ? ((a - c) * g.good > 0 ? 1 : -1) : 0;
            return (
              <tr key={g.label} className={ROW}>
                <td className={TDL}>{g.label}</td><td className="px-2 text-[10px] text-slate-500">{g.cat}</td>
                <td className={`${TD} text-white`}>{last?.actual ?? "—"}</td>
                <td className={`${TD} text-slate-400`}>{last?.consensus ?? "—"}</td>
                <td className={`${TD} text-slate-400`}>{last?.previous ?? "—"}</td>
                <td className="px-2 text-right text-[10px]" style={{ color: dir > 0 ? "#f2495c" : dir < 0 ? "#1fbf75" : "#94a3b8" }}>{dir > 0 ? "好于预期" : dir < 0 ? "差于预期" : "—"}</td>
                <td className="px-2"><MiniLine values={g.hist.map((e) => numOf(e.actual))} w={70} /></td>
                <td className={`${TD} text-[10px] text-slate-400`}>{g.next ? evTime(g.next) : "—"}</td>
              </tr>
            );
          })}
          {!groups.length && <tr><td colSpan={8}><Empty loading={cal.loading} text="近 30 天暂无周度数据" /></td></tr>}
        </tbody>
      </table>
      <Note>数据为经济日历中实际公布的美国周度指标。「评估」按该指标对经济活动的含义判断（例如初请人数低于预期、原油库存降幅大于预期为偏强）。</Note>
    </>
  );
}
export function WeifWeeklyLive({ onClose }: P) {
  const [tab, setTab] = useState("ind");
  return <PanelShell code="WEIF" title="周度经济指标" onClose={onClose} tabs={[["ind", "周度数据"], ["mkt", "周度市场温度"]]} tab={tab} setTab={setTab}><WeeklyBody tab={tab} /></PanelShell>;
}

/* ================================================================== SPOT 现货（近月）报价 */
type SpotDef = { s: string; l: string; cat: string; unit: string; conv?: [string, (p: number, cnh: number) => number, number] };
const OZ_G = 31.1034768, LB_T = 2204.62;
const SPOTS: SpotDef[] = [
  { s: "CL", l: "WTI 原油", cat: "能源", unit: "美元/桶", conv: ["人民币/桶", (p, x) => p * x, 1] },
  { s: "BRENT", l: "布伦特原油", cat: "能源", unit: "美元/桶", conv: ["人民币/桶", (p, x) => p * x, 1] },
  { s: "NG", l: "天然气", cat: "能源", unit: "美元/百万英热", conv: ["人民币/百万英热", (p, x) => p * x, 2] },
  { s: "RB=F", l: "RBOB 汽油", cat: "能源", unit: "美元/加仑", conv: ["美元/桶", (p) => p * 42, 2] },
  { s: "HO=F", l: "超低硫柴油", cat: "能源", unit: "美元/加仑", conv: ["美元/桶", (p) => p * 42, 2] },
  { s: "GC", l: "黄金", cat: "贵金属", unit: "美元/盎司", conv: ["人民币/克", (p, x) => (p * x) / OZ_G, 2] },
  { s: "SI", l: "白银", cat: "贵金属", unit: "美元/盎司", conv: ["人民币/千克", (p, x) => ((p * x) / OZ_G) * 1000, 0] },
  { s: "PL", l: "铂金", cat: "贵金属", unit: "美元/盎司", conv: ["人民币/克", (p, x) => (p * x) / OZ_G, 2] },
  { s: "PA=F", l: "钯金", cat: "贵金属", unit: "美元/盎司", conv: ["人民币/克", (p, x) => (p * x) / OZ_G, 2] },
  { s: "HG", l: "铜", cat: "工业金属", unit: "美元/磅", conv: ["美元/吨", (p) => p * LB_T, 0] },
  { s: "ALI=F", l: "铝", cat: "工业金属", unit: "美元/吨", conv: ["人民币/吨", (p, x) => p * x, 0] },
  { s: "ZC", l: "玉米", cat: "农产品", unit: "美分/蒲式耳", conv: ["美元/吨", (p) => (p / 100) * 39.368, 1] },
  { s: "ZS", l: "大豆", cat: "农产品", unit: "美分/蒲式耳", conv: ["美元/吨", (p) => (p / 100) * 36.7437, 1] },
  { s: "ZW", l: "小麦", cat: "农产品", unit: "美分/蒲式耳", conv: ["美元/吨", (p) => (p / 100) * 36.7437, 1] },
  { s: "ZM=F", l: "豆粕", cat: "农产品", unit: "美元/短吨", conv: ["美元/吨", (p) => p * 1.10231, 1] },
  { s: "ZL=F", l: "豆油", cat: "农产品", unit: "美分/磅", conv: ["美元/吨", (p) => (p / 100) * LB_T, 0] },
  { s: "KC=F", l: "咖啡", cat: "软商品", unit: "美分/磅", conv: ["美元/吨", (p) => (p / 100) * LB_T, 0] },
  { s: "SB=F", l: "原糖", cat: "软商品", unit: "美分/磅", conv: ["美元/吨", (p) => (p / 100) * LB_T, 0] },
  { s: "CC=F", l: "可可", cat: "软商品", unit: "美元/吨", conv: ["人民币/吨", (p, x) => p * x, 0] },
  { s: "CT=F", l: "棉花", cat: "软商品", unit: "美分/磅", conv: ["美元/吨", (p) => (p / 100) * LB_T, 0] },
];
const SPOT_CATS = ["全部", "能源", "贵金属", "工业金属", "农产品", "软商品"];

function SpotBody({ tab, cat }: { tab: string; cat: string }) {
  const list = SPOTS.filter((x) => cat === "全部" || x.cat === cat);
  const syms = [...SPOTS.map((x) => x.s), "USDCNH"];
  const ticks = useTicks(syms);
  const pack = useCloses(SPOTS.map((x) => x.s), 400);
  const { pick } = useHub();
  const cnh = ticks.USDCNH?.price ?? null;
  const closes = (s: string) => (pack.data?.[s] ?? []).map((x) => x[1]);
  const dates = (s: string) => (pack.data?.[s] ?? []).map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10));
  if (tab === "quote") return (
    <>
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>最新</th><th className={THL}>报价单位</th><th className={TH}>涨跌</th><th className={TH}>涨跌幅</th><th className={TH}>日内高</th><th className={TH}>日内低</th><th className={TH}>换算价</th><th className={THL}>换算单位</th></tr></thead>
        <tbody>
          {list.map((d) => {
            const t = ticks[d.s];
            const c = toneOf(t?.changePct);
            const conv = d.conv && t?.price != null && cnh != null ? d.conv[1](t.price, cnh) : null;
            return (
              <tr key={d.s} onClick={() => pick(d.s)} className={`cursor-pointer ${ROW}`}>
                <td className={TDL}><span className="text-slate-100">{d.l}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{d.s}</span></td>
                <td className={`${TD} font-semibold`} style={{ color: c }}>{fmtPrice(t?.price)}</td>
                <td className="px-2 text-[10px] text-slate-500">{d.unit}</td>
                <td className={TD} style={{ color: c }}>{t?.change == null ? "—" : `${t.change > 0 ? "+" : ""}${fmtPrice(t.change)}`}</td>
                <td className={TD} style={{ color: c }}>{fmtPct(t?.changePct)}</td>
                <td className={`${TD} text-slate-400`}>{fmtPrice(t?.high)}</td>
                <td className={`${TD} text-slate-400`}>{fmtPrice(t?.low)}</td>
                <td className={`${TD} text-amber-100`}>{conv == null ? "—" : conv.toLocaleString("zh-CN", { maximumFractionDigits: d.conv![2], minimumFractionDigits: d.conv![2] })}</td>
                <td className="px-2 text-[10px] text-slate-500">{d.conv?.[0]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Note>以各品种最近月（主力）期货作为现货参考价；人民币换算使用实时美元 / 离岸人民币汇率 {fmtPrice(cnh, 4)}，重量换算：1 金衡盎司 = 31.1035 克，1 吨 = 2204.62 磅，玉米 39.37 蒲式耳 / 吨，大豆与小麦 36.74 蒲式耳 / 吨。</Note>
    </>
  );
  if (tab === "perf") return (
    <>
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>1周</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>年初至今</th><th className={TH}>1年</th><th className={TH}>20日实波</th><th className={TH}>52周低</th><th className="px-2">52周位置</th><th className={TH}>52周高</th><th className={TH}>距高点</th></tr></thead>
        <tbody>
          {list.map((d) => {
            const c = closes(d.s);
            const last = ticks[d.s]?.price ?? c[c.length - 1] ?? null;
            const y = c.slice(-252);
            const lo = y.length ? Math.min(...y) : null, hi = y.length ? Math.max(...y) : null;
            return (
              <tr key={d.s} onClick={() => pick(d.s)} className={`cursor-pointer ${ROW}`}>
                <td className={TDL}>{d.l}</td>
                {[[perf(c, 5), 4], [perf(c, 21), 8], [perf(c, 63), 15], [ytd(c, dates(d.s)), 25], [perf(c, 252), 35]].map(([v, sc], i) => <td key={i} className={TD} style={{ background: heat(v as number | null, sc as number) }}>{sgn(v as number | null, 1)}</td>)}
                <td className={`${TD} text-slate-300`}>{f2(annVol(c, 20), 1)}</td>
                <td className={`${TD} text-slate-400`}>{fmtPrice(lo)}</td>
                <td className="px-2 text-center"><RangeBar lo={lo} hi={hi} v={last} /></td>
                <td className={`${TD} text-slate-400`}>{fmtPrice(hi)}</td>
                <td className={`${TD} text-slate-300`}>{hi && last ? sgn((last / hi - 1) * 100, 1) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pack.loading && !pack.data && <Empty loading />}
    </>
  );
  return <SpotMargins />;
}

/** 炼油裂解价差与大豆压榨价差（按真实日线逐日计算） */
function SpotMargins() {
  const syms = ["CL", "RB=F", "HO=F", "ZS", "ZM=F", "ZL=F"];
  const pack = useCloses(syms, 520);
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]);
  const live = useTicks(syms);
  const px = (s: string, i: number) => (i < 0 ? live[s]?.price ?? m[s]?.[m[s].length - 1] : m[s][i]);
  const crack321 = (i: number) => { const cl = px("CL", i), rb = px("RB=F", i), ho = px("HO=F", i); return cl && rb && ho ? (2 * rb * 42 + ho * 42 - 3 * cl) / 3 : null; };
  const gasCrack = (i: number) => { const cl = px("CL", i), rb = px("RB=F", i); return cl && rb ? rb * 42 - cl : null; };
  const dslCrack = (i: number) => { const cl = px("CL", i), ho = px("HO=F", i); return cl && ho ? ho * 42 - cl : null; };
  const crush = (i: number) => { const s = px("ZS", i), ml = px("ZM=F", i), o = px("ZL=F", i); return s && ml && o ? ml * 0.022 + o * 0.11 - s / 100 : null; };
  const defs: Array<[string, string, (i: number) => number | null, string]> = [["crack", "3-2-1 裂解价差", crack321, "美元/桶"], ["gas", "汽油裂解价差", gasCrack, "美元/桶"], ["dsl", "柴油裂解价差", dslCrack, "美元/桶"], ["crush", "大豆压榨价差", crush, "美元/蒲式耳"]];
  const [sel, setSel] = useState("crack");
  const series = (fn: (i: number) => number | null) => dates.map((_, i) => fn(i));
  const cur = defs.find((d) => d[0] === sel)!;
  const hist = series(cur[2]).slice(-260);
  if (!dates.length) return <Empty loading={pack.loading} />;
  return (
    <>
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>加工价差</th><th className={TH}>实时</th><th className={THL}>单位</th><th className={TH}>1月前</th><th className={TH}>1年均值</th><th className={TH}>1年分位</th><th className="px-2">1年走势</th></tr></thead>
        <tbody>
          {defs.map(([k, l, fn, u]) => {
            const s = series(fn).slice(-252).filter((v): v is number => v != null);
            const now = fn(-1);
            return (
              <tr key={k} onClick={() => setSel(k)} className={`cursor-pointer ${ROW} ${sel === k ? "bg-[#0d2236]" : ""}`}>
                <td className={TDL}>{l}</td><td className={`${TD} text-white`}>{f2(now, 2)}</td><td className="px-2 text-[10px] text-slate-500">{u}</td>
                <td className={`${TD} text-slate-400`}>{f2(s[s.length - 22], 2)}</td><td className={`${TD} text-slate-400`}>{f2(mean(s), 2)}</td>
                <td className={`${TD} text-amber-200`}>{now != null ? f2(pctRank(s, now), 0, "%") : "—"}</td>
                <td className="px-2"><MiniLine values={s} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <SectionHead title={`${cur[1]} 近一年（${cur[3]}）`} />
      <Lines series={[{ name: cur[1], color: "#fbbf24", values: hist }]} xLabels={dates.slice(-260).map((d) => d.slice(2))} height={170} />
      <Note>3-2-1 裂解 =（2 × 汽油 + 1 × 柴油 − 3 × 原油）/ 3，汽油、柴油按 42 加仑 / 桶换算；压榨价差 = 豆粕 × 0.022 + 豆油 × 0.11 − 大豆（每蒲式耳大豆约产 44 磅豆粕、11 磅豆油）。价差走阔反映加工利润改善、下游需求偏强。</Note>
    </>
  );
}
export function SpotLive({ onClose }: P) {
  const [tab, setTab] = useState("quote");
  const [cat, setCat] = useState("全部");
  return (
    <PanelShell code="SPOT" title="商品现货价格" onClose={onClose} tabs={[["quote", "现货报价"], ["perf", "区间表现"], ["margin", "加工价差"]]} tab={tab} setTab={setTab}
      right={tab !== "margin" ? <select value={cat} onChange={(e) => setCat(e.target.value)} className={INP}>{SPOT_CATS.map((c) => <option key={c}>{c}</option>)}</select> : null}>
      <SpotBody tab={tab} cat={cat} />
    </PanelShell>
  );
}

/* ================================================================== SEAG 季节性 */
const SEAG_LIST: Array<[string, string]> = [["CL", "WTI 原油"], ["NG", "天然气"], ["RB=F", "RBOB 汽油"], ["HO=F", "取暖油"], ["GC", "黄金"], ["SI", "白银"], ["HG", "铜"], ["ZC", "玉米"], ["ZS", "大豆"], ["ZW", "小麦"], ["KC=F", "咖啡"], ["SB=F", "原糖"], ["CT=F", "棉花"], ["LE=F", "活牛"], ["HE=F", "瘦肉猪"], ["^GSPC", "标普 500"], ["sh000300", "沪深 300"], ["^HSI", "恒生指数"], ["DXY", "美元指数"], ["USDCNH", "美元/离岸人民币"]];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function seasonal(pack: Array<[number, number]>) {
  const rows = pack.map(([t, c]) => { const d = new Date(t + 8 * 3600_000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), doy: Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400_000), c }; });
  // 月度收益：月末收盘 / 上月末收盘
  const monthEnd = new Map<string, { y: number; m: number; c: number }>();
  for (const r of rows) monthEnd.set(`${r.y}-${r.m}`, r);
  const ends = [...monthEnd.values()].sort((a, b) => a.y - b.y || a.m - b.m);
  const mret: Record<number, Record<number, number>> = {};
  for (let i = 1; i < ends.length; i++) {
    const a = ends[i - 1], b = ends[i];
    if ((b.y - a.y) * 12 + (b.m - a.m) !== 1) continue;
    (mret[b.y] ??= {})[b.m] = (b.c / a.c - 1) * 100;
  }
  // 年内路径：以上年末收盘为基准，按自然日（0..365）前值补齐
  const yearEnd = new Map<number, number>();
  for (const r of rows) yearEnd.set(r.y, r.c);
  const paths: Record<number, Array<number | null>> = {};
  for (const r of rows) {
    const base = yearEnd.get(r.y - 1);
    if (base == null) continue;
    (paths[r.y] ??= new Array(366).fill(null))[Math.min(365, r.doy)] = (r.c / base - 1) * 100;
  }
  for (const y of Object.keys(paths)) { const p = paths[+y]; let last: number | null = 0; for (let i = 0; i < 366; i++) { if (p[i] == null) p[i] = last; else last = p[i]; } }
  return { mret, paths, years: Object.keys(mret).map(Number).sort((a, b) => a - b) };
}

function SeagBody({ tab, sym }: { tab: string; sym: string }) {
  const pack = useCloses([sym], 2600);
  const s = useMemo(() => seasonal(pack.data?.[sym] ?? []), [pack.data, sym]);
  const nowY = new Date().getFullYear();
  const nowM = new Date().getMonth();
  const done = s.years.filter((y) => y < nowY);
  const stat = MONTHS.map((_, m) => {
    const v = done.map((y) => s.mret[y]?.[m]).filter((x): x is number => x != null);
    const v5 = done.slice(-5).map((y) => s.mret[y]?.[m]).filter((x): x is number => x != null);
    return { m, n: v.length, avg: v.length ? mean(v) : null, med: median(v), up: v.length ? (v.filter((x) => x > 0).length / v.length) * 100 : null, best: v.length ? Math.max(...v) : null, worst: v.length ? Math.min(...v) : null, avg5: v5.length ? mean(v5) : null, sd: v.length > 2 ? std(v) : null, cur: s.mret[nowY]?.[m] ?? null };
  });
  if (!s.years.length) return <Empty loading={pack.loading} text="该标的历史日线不足" />;
  if (tab === "path") {
    const avgPath = (ys: number[]) => Array.from({ length: 366 }, (_, i) => { const v = ys.map((y) => s.paths[y]?.[i]).filter((x): x is number => x != null); return v.length ? mean(v) : null; }).filter((_, i) => i % 2 === 0);
    const y5 = done.filter((y) => s.paths[y]).slice(-5), y10 = done.filter((y) => s.paths[y]).slice(-10);
    const today = Math.floor((Date.now() - new Date(nowY, 0, 1).getTime()) / 86400_000);
    const curPath = (s.paths[nowY] ?? []).map((v, i) => (i <= today ? v : null)).filter((_, i) => i % 2 === 0);
    const a5 = avgPath(y5), a10 = avgPath(y10);
    const xl = Array.from({ length: 183 }, (_, i) => { const d = new Date(2001, 0, 1 + i * 2); return `${d.getMonth() + 1}/${d.getDate()}`; });
    const idx = Math.floor(today / 2);
    return (
      <>
        <Kpis items={[["今年以来", sgn(curPath[idx] ?? null, 2), `${nowY} 年`], [`近 ${y5.length} 年同期均值`, sgn(a5[idx], 2)], [`近 ${y10.length} 年同期均值`, sgn(a10[idx], 2)], ["近 5 年均值：年内剩余", a5[182] != null && a5[idx] != null ? sgn(a5[182]! - a5[idx]!, 2) : "—", "从今日到年末的平均路径"]]} />
        <SectionHead title="年内累计收益路径（%）" sub="以上年末收盘为基准" />
        <Lines series={[{ name: `${nowY} 年`, color: "#f2495c", values: curPath }, { name: `近 ${y5.length} 年均值`, color: "#38bdf8", values: a5 }, { name: `近 ${y10.length} 年均值`, color: "#94a3b8", values: a10, dash: true }]} xLabels={xl} height={220} zero />
      </>
    );
  }
  if (tab === "month") {
    const next = (nowM + 1) % 12;
    return (
      <>
        <Kpis items={[[`本月（${MONTHS[nowM]}）历史上涨概率`, f2(stat[nowM].up, 0, "%"), `${stat[nowM].n} 年样本，均值 ${sgn(stat[nowM].avg, 2)}`], [`下月（${MONTHS[next]}）历史上涨概率`, f2(stat[next].up, 0, "%"), `均值 ${sgn(stat[next].avg, 2)}，中位 ${sgn(stat[next].med, 2)}`], ["最强月份", (() => { const b = [...stat].filter((x) => x.avg != null).sort((a, b) => b.avg! - a.avg!)[0]; return b ? MONTHS[b.m] : "—"; })(), "按历史平均收益"], ["最弱月份", (() => { const b = [...stat].filter((x) => x.avg != null).sort((a, b) => a.avg! - b.avg!)[0]; return b ? MONTHS[b.m] : "—"; })()]]} />
        <Bars data={stat.map((x) => ({ k: MONTHS[x.m], v: x.avg ?? 0, v2: x.avg5 ?? 0 }))} fmt={(v) => `${v.toFixed(2)}%`} height={140} label={["全样本平均", "近 5 年平均"]} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>月份</th><th className={TH}>样本年数</th><th className={TH}>平均</th><th className={TH}>中位</th><th className={TH}>近5年平均</th><th className={TH}>上涨概率</th><th className={TH}>标准差</th><th className={TH}>最好</th><th className={TH}>最差</th><th className={TH}>今年</th></tr></thead>
          <tbody>{stat.map((x) => <tr key={x.m} className={`${ROW} ${x.m === nowM ? "bg-[#0b1c2c]" : ""}`}><td className={TDL}>{MONTHS[x.m]}</td><td className={`${TD} text-slate-500`}>{x.n}</td><td className={TD} style={{ background: heat(x.avg, 4) }}>{sgn(x.avg, 2)}</td><td className={`${TD} text-slate-300`}>{sgn(x.med, 2)}</td><td className={`${TD} text-slate-300`}>{sgn(x.avg5, 2)}</td><td className={`${TD} text-amber-200`}>{f2(x.up, 0, "%")}</td><td className={`${TD} text-slate-400`}>{f2(x.sd, 2)}</td><td className={`${TD} text-slate-400`}>{sgn(x.best, 1)}</td><td className={`${TD} text-slate-400`}>{sgn(x.worst, 1)}</td><td className={TD} style={{ color: toneOf(x.cur) }}>{sgn(x.cur, 2)}</td></tr>)}</tbody>
        </table>
      </>
    );
  }
  return (
    <>
      <SectionHead title="逐年逐月收益（%）" sub={`${s.years[0]}—${nowY}`} />
      <table className="w-full text-[10px]">
        <thead className="text-slate-500"><tr><th className={THL}>年份</th>{MONTHS.map((m) => <th key={m} className="px-1 text-right font-normal">{m}</th>)}<th className={TH}>全年</th></tr></thead>
        <tbody>
          {[...s.years].reverse().map((y) => {
            const vals = MONTHS.map((_, m) => s.mret[y]?.[m] ?? null);
            const yr = vals.reduce<number | null>((acc, v) => (v == null ? acc : (acc ?? 1) * (1 + v / 100)), null);
            return <tr key={y} className="border-t border-[#0f1b29]"><td className={`${TDL} font-mono text-slate-300`}>{y}</td>{vals.map((v, m) => <td key={m} className="px-1 text-right font-mono text-slate-100" style={{ background: heat(v, 8) }}>{v == null ? "" : v.toFixed(1)}</td>)}<td className={`${TD} text-white`}>{yr == null ? "—" : sgn((yr - 1) * 100, 1)}</td></tr>;
          })}
        </tbody>
      </table>
    </>
  );
}
export function SeagLive({ onClose }: P) {
  const [tab, setTab] = useState("path");
  const [sym, setSym] = useState("CL");
  const [inp, setInp] = useState("");
  return (
    <PanelShell code="SEAG" title="季节性分析" onClose={onClose} tabs={[["path", "季节性走势"], ["month", "月度统计"], ["grid", "逐年明细"]]} tab={tab} setTab={setTab}
      right={<span className="flex items-center gap-1"><select value={SEAG_LIST.some(([s]) => s === sym) ? sym : ""} onChange={(e) => e.target.value && setSym(e.target.value)} className={INP}>{!SEAG_LIST.some(([s]) => s === sym) && <option value="">{sym}</option>}{SEAG_LIST.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</select><form onSubmit={(e) => { e.preventDefault(); if (inp.trim()) { setSym(inp.trim()); setInp(""); } }}><input value={inp} onChange={(e) => setInp(e.target.value)} placeholder="其他代码" className={`${INP} w-20`} /></form></span>}>
      <SeagBody tab={tab} sym={sym} />
      <Note>基于最长约 10 年的真实日线：月度收益 = 月末收盘 / 上月末收盘 − 1；季节路径以每年上年末收盘为基准、按自然日对齐后取平均。季节性只是历史统计规律，不代表未来必然重演。</Note>
    </PanelShell>
  );
}

/* ================================================================== CPLY 商品供需 */
type CotD = { rows: Array<{ key: string; name: string; date: string; oi: number; oiChg: number; pmLong: number; pmShort: number; pmNet: number; pmNetChg: number; swapNet: number; swapNetChg: number; mmNet: number; hist: Array<{ d: string; v: number }> }> };
const INV_RE = /Crude Oil Inventories|Cushing|Gasoline Inventories|Distillate|Refinery|Natural Gas Storage|Crude Runs|Heating Oil|Crude Oil Imports|Gasoline Production/i;
const SUPPLY_ROOTS = ["CL", "BZ", "NG", "RB", "HO", "HG", "GC", "SI", "ZC", "ZS", "ZW", "KC", "SB", "CC", "CT", "LE", "HE"];

function SlopeHist({ root }: { root: string }) {
  const h = usePolled<Array<{ d: string; v: number }>>("ucHubs.series", { series: `fut:${root}:slope`, n: 250 }, 3600_000);
  const v = (h.data ?? []).map((x) => x.v);
  return <MiniLine values={v} w={80} color="#fbbf24" />;
}

function CplyBody({ tab }: { tab: string }) {
  const cal = useCalendarSpan(30, 8);
  const many = usePolled<FutCurve[]>("ucHubs.futuresMany", tab === "tight" ? { roots: SUPPLY_ROOTS } : null, 120_000);
  const cot = usePolled<CotD>("ucHubs.cotCommodities", tab === "hedge" ? {} : null, 6 * 3600_000);
  const { pick } = useHub();
  if (tab === "inv") {
    const rows = cal.rows.filter((e) => /United States|美国/.test(e.country) && INV_RE.test(e.name));
    const released = rows.filter((e) => e.actual).reverse();
    const upcoming = rows.filter((e) => !e.actual);
    return (
      <>
        <SectionHead title="能源库存与炼厂周报" sub="实际 vs 市场预期" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>公布时间</th><th className={THL}>指标</th><th className={TH}>实际</th><th className={TH}>预期</th><th className={TH}>前值</th><th className={TH}>偏离</th><th className={THL}>解读</th></tr></thead>
          <tbody>
            {released.map((e) => {
              const a = numOf(e.actual), c = numOf(e.consensus);
              const inv = /Inventories|Storage|Cushing/i.test(e.name);
              const d = a != null && c != null ? a - c : null;
              const tight = d == null ? null : inv ? d < 0 : d > 0;
              return (
                <tr key={e.id} className={ROW}>
                  <td className="px-2 font-mono text-[10px] text-slate-500">{evTime(e)}</td>
                  <td className={TDL}>{e.nameZh || e.name}</td>
                  <td className={`${TD} text-white`}>{e.actual}</td>
                  <td className={`${TD} text-slate-400`}>{e.consensus ?? "—"}</td>
                  <td className={`${TD} text-slate-400`}>{e.previous ?? "—"}</td>
                  <td className={TD} style={{ color: d == null ? undefined : tight ? "#f2495c" : "#1fbf75" }}>{d == null ? "—" : `${d > 0 ? "+" : ""}${+d.toFixed(3)}`}</td>
                  <td className="px-2 text-[10px]" style={{ color: tight == null ? "#64748b" : tight ? "#f2495c" : "#1fbf75" }}>{tight == null ? (inv && a != null ? (a < 0 ? "去库" : "累库") : "—") : inv ? (tight ? "去库多于预期 · 偏紧" : "累库多于预期 · 偏松") : tight ? "高于预期" : "低于预期"}</td>
                </tr>
              );
            })}
            {!released.length && <tr><td colSpan={7}><Empty loading={cal.loading} text="近 30 天暂无库存周报" /></td></tr>}
          </tbody>
        </table>
        {upcoming.length > 0 && <><SectionHead title="即将公布" /><table className="w-full text-[11px]"><tbody>{upcoming.map((e) => <tr key={e.id} className={ROW}><td className="px-2 font-mono text-[10px] text-slate-500">{evTime(e)}</td><td className={TDL}>{e.nameZh || e.name}</td><td className={`${TD} text-slate-400`}>预期 {e.consensus ?? "—"}</td><td className={`${TD} text-slate-500`}>前值 {e.previous ?? "—"}</td></tr>)}</tbody></table></>}
      </>
    );
  }
  if (tab === "tight") {
    const list = (many.data ?? []).map((c) => {
      const [a, b] = c.points;
      const mo = a && b ? monthsBetween(a.month, b.month) : 0;
      const spr = a && b ? ((b.price - a.price) / a.price) * 100 : null;
      const ann = spr != null && mo > 0 ? (spr / mo) * 12 : null;
      return { c, a, b, spr, ann };
    }).sort((x, y) => (x.ann ?? 0) - (y.ann ?? 0));
    if (!list.length) return <Empty loading={many.loading} />;
    return (
      <>
        <SectionHead title="期限结构隐含的供需松紧" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>近月</th><th className={TH}>次月</th><th className={TH}>次月−近月</th><th className={TH}>年化</th><th className={THL}>判断</th><th className={TH}>整条曲线</th><th className="px-2">曲线斜率历史</th></tr></thead>
          <tbody>
            {list.map(({ c, a, b, spr, ann }) => (
              <tr key={c.root} onClick={() => pick(contSym(c.root))} className={`cursor-pointer ${ROW}`}>
                <td className={TDL}>{c.name}</td>
                <td className={`${TD} text-white`}>{fmtPrice(a?.price)}</td>
                <td className={`${TD} text-slate-300`}>{fmtPrice(b?.price)}</td>
                <td className={`${TD} text-slate-300`}>{sgn(spr, 2)}</td>
                <td className={TD} style={{ background: heat(ann == null ? null : -ann, 15) }}>{sgn(ann, 1)}</td>
                <td className="px-2 text-[10px]" style={{ color: ann == null ? "#64748b" : ann < -3 ? "#f2495c" : ann > 3 ? "#1fbf75" : "#94a3b8" }}>{ann == null ? "—" : ann < -10 ? "显著偏紧" : ann < -3 ? "偏紧" : ann > 10 ? "显著宽松" : ann > 3 ? "偏松" : "均衡"}</td>
                <td className={`${TD} text-slate-400`}>{sgn(c.slopePct, 1)}</td>
                <td className="px-2"><SlopeHist root={c.root} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>年化价差 = （次月 − 近月）/ 近月 ÷ 相隔月数 × 12。深度贴水（近高远低）通常对应库存偏低、现货需求强；深度升水对应库存充裕。斜率历史为平台每日记录的整条曲线斜率。</Note>
      </>
    );
  }
  const rows = cot.data?.rows ?? [];
  if (!rows.length) return <Empty loading={cot.loading} />;
  return (
    <>
      <SectionHead title="产业套保持仓（生产商 / 贸易商 与 互换交易商）" sub={`持仓报告日 ${rows[0]?.date ?? "—"}`} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>总持仓</th><th className={TH}>生产商净头寸</th><th className={TH}>周变化</th><th className={TH}>占持仓</th><th className={TH}>互换商净头寸</th><th className={TH}>周变化</th><th className={TH}>管理基金净头寸</th><th className={THL}>产业动向</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.oi ? (r.pmNet / r.oi) * 100 : null;
            return (
              <tr key={r.key} className={ROW}>
                <td className={TDL}>{r.name}</td>
                <td className={`${TD} text-slate-300`}>{fmtCompact(r.oi)}</td>
                <td className={TD} style={{ color: toneOf(r.pmNet) }}>{fmtCompact(r.pmNet)}</td>
                <td className={TD} style={{ color: toneOf(r.pmNetChg) }}>{r.pmNetChg > 0 ? "+" : ""}{fmtCompact(r.pmNetChg)}</td>
                <td className={`${TD} text-slate-300`}>{sgn(pct, 1)}</td>
                <td className={TD} style={{ color: toneOf(r.swapNet) }}>{fmtCompact(r.swapNet)}</td>
                <td className={TD} style={{ color: toneOf(r.swapNetChg) }}>{r.swapNetChg > 0 ? "+" : ""}{fmtCompact(r.swapNetChg)}</td>
                <td className={`${TD} text-slate-400`}>{fmtCompact(r.mmNet)}</td>
                <td className="px-2 text-[10px] text-slate-400">{r.pmNetChg < 0 ? "生产商加大卖出套保（锁定未来产量售价）" : r.pmNetChg > 0 ? "生产商减少套保 / 用户买入锁价" : "持平"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Note>生产商 / 贸易商通常为净空头（对未来产量做卖出套保），其净空头扩大往往对应产量预期上升或价格处于生产者愿意锁定的高位；互换交易商头寸反映场外客户（如航空、消费企业）的套保需求。</Note>
    </>
  );
}
export function CplyLive({ onClose }: P) {
  const [tab, setTab] = useState("inv");
  return <PanelShell code="CPLY" title="商品供需" onClose={onClose} tabs={[["inv", "库存周报"], ["tight", "供需松紧"], ["hedge", "产业套保"]]} tab={tab} setTab={setTab}><CplyBody tab={tab} /></PanelShell>;
}

/* ================================================================== CCRV 商品期货曲线 */
const CCRV_GROUPS: Record<string, string[]> = { 能源: ["CL", "BZ", "NG", "RB", "HO"], 金属: ["GC", "SI", "HG", "PL", "PA"], 谷物: ["ZC", "ZS", "ZW"], 软商品: ["KC", "SB", "CC", "CT"], 畜牧: ["LE", "HE"] };

function CcrvBody({ tab, group }: { tab: string; group: string }) {
  const roots = CCRV_GROUPS[group];
  const many = usePolled<FutCurve[]>("ucHubs.futuresMany", { roots }, 120_000);
  const list = (many.data ?? []).filter((c) => c.points.length > 1);
  const { pick } = useHub();
  if (!list.length) return <Empty loading={many.loading} />;
  if (tab === "cmp") {
    const n = Math.max(...list.map((c) => c.points.length));
    return (
      <>
        <SectionHead title="曲线形态对比（各合约相对近月 %）" sub="横轴为第 N 个挂牌合约" />
        <Lines series={list.map((c, i) => ({ name: c.name, color: COLORS[i % COLORS.length], values: Array.from({ length: n }, (_, k) => (c.points[k] ? ((c.points[k].price / c.points[0].price) - 1) * 100 : null)) }))} xLabels={Array.from({ length: n }, (_, k) => `M${k + 1}`)} height={230} zero fmt={(v) => `${v.toFixed(1)}%`} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>近月</th><th className={TH}>M3 vs M1</th><th className={TH}>M6 vs M1</th><th className={TH}>最远 vs M1</th><th className={THL}>形态</th><th className={TH}>曲线凸度</th></tr></thead>
          <tbody>{list.map((c) => {
            const p = c.points, rel = (k: number) => (p[k] ? (p[k].price / p[0].price - 1) * 100 : null);
            const mid = p[Math.floor((p.length - 1) / 2)];
            const conv = p.length > 2 ? ((mid.price - (p[0].price + p[p.length - 1].price) / 2) / p[0].price) * 100 : null;
            return <tr key={c.root} onClick={() => pick(contSym(c.root))} className={`cursor-pointer ${ROW}`}><td className={TDL}>{c.name}</td><td className={`${TD} text-white`}>{fmtPrice(p[0].price)}</td><td className={`${TD}`}>{sgn(rel(2), 2)}</td><td className={TD}>{sgn(rel(5), 2)}</td><td className={TD}>{sgn(c.slopePct, 2)}</td><td className="px-2 text-[10px] text-slate-400">{c.structure}</td><td className={`${TD} text-slate-400`} title="中间合约相对两端连线的偏离">{sgn(conv, 2)}</td></tr>;
          })}</tbody>
        </table>
      </>
    );
  }
  if (tab === "roll") {
    const rows = list.map((c) => {
      const [a, b] = c.points;
      const mo = monthsBetween(a.month, b.month);
      const ry = mo > 0 ? ((a.price - b.price) / b.price / mo) * 12 * 100 : null;
      const last = c.points[Math.min(c.points.length - 1, 11)];
      const mo12 = monthsBetween(a.month, last.month);
      const ry12 = mo12 > 0 ? ((a.price - last.price) / last.price / mo12) * 12 * 100 : null;
      return { c, a, b, ry, ry12 };
    }).sort((x, y) => (y.ry ?? -1e9) - (x.ry ?? -1e9));
    return (
      <>
        <SectionHead title="展期收益（多头滚动持有）" />
        <Bars data={rows.map((r) => ({ k: r.c.name.replace(/\s/g, ""), v: r.ry ?? 0, v2: r.ry12 ?? 0 }))} fmt={(v) => `${v.toFixed(1)}%`} height={150} label={["近月→次月", "近月→一年内远月"]} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={THL}>近月</th><th className={TH}>价格</th><th className={THL}>次月</th><th className={TH}>价格</th><th className={TH}>年化展期收益</th><th className={TH}>一年期年化</th></tr></thead>
          <tbody>{rows.map(({ c, a, b, ry, ry12 }) => <tr key={c.root} className={ROW}><td className={TDL}>{c.name}</td><td className="px-2 font-mono text-slate-400">{a.code}</td><td className={`${TD} text-white`}>{fmtPrice(a.price)}</td><td className="px-2 font-mono text-slate-400">{b.code}</td><td className={`${TD} text-slate-200`}>{fmtPrice(b.price)}</td><td className={TD} style={{ background: heat(ry, 20) }}>{sgn(ry, 2)}</td><td className={TD} style={{ background: heat(ry12, 20) }}>{sgn(ry12, 2)}</td></tr>)}</tbody>
        </table>
        <Note>年化展期收益 =（近月 − 远月）/ 远月 ÷ 相隔月数 × 12：价格不变时，多头每次把到期合约换成更便宜（贴水）的远月合约所得到的收益；升水结构下为负，即持有成本。</Note>
      </>
    );
  }
  return (
    <>
      <SectionHead title="曲线日内形变" sub="各合约今日涨跌，判断平移 / 陡峭化 / 平坦化" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>品种</th><th className={TH}>近月涨跌</th><th className={TH}>远月涨跌</th><th className={TH}>远近差变化</th><th className={THL}>形变</th><th className="px-2">各合约涨跌幅</th></tr></thead>
        <tbody>{list.map((c) => {
          const a = c.points[0], z = c.points[c.points.length - 1];
          const d = a.changePct != null && z.changePct != null ? z.changePct - a.changePct : null;
          const kind = d == null ? "—" : Math.abs(d) < 0.15 ? (Math.abs(a.changePct ?? 0) < 0.15 ? "基本不变" : (a.changePct ?? 0) > 0 ? "整体上移" : "整体下移") : d > 0 ? "远端走强（升水加深 / 贴水收窄）" : "近端走强（贴水加深 / 升水收窄）";
          const vals = c.points.map((p) => p.changePct ?? 0);
          const mx = Math.max(0.01, ...vals.map(Math.abs));
          return (
            <tr key={c.root} className={ROW}>
              <td className={TDL}>{c.name}</td>
              <td className={TD} style={{ color: toneOf(a.changePct) }}>{fmtPct(a.changePct)}</td>
              <td className={TD} style={{ color: toneOf(z.changePct) }}>{fmtPct(z.changePct)}</td>
              <td className={TD} style={{ color: toneOf(d) }}>{sgn(d, 2)}</td>
              <td className="px-2 text-[10px] text-slate-300">{kind}</td>
              <td className="px-2"><svg width={120} height={18}>{vals.map((v, i) => { const h = (Math.abs(v) / mx) * 8; return <rect key={i} x={i * (120 / vals.length)} width={Math.max(1, 120 / vals.length - 1)} y={v >= 0 ? 9 - h : 9} height={Math.max(0.5, h)} fill={v >= 0 ? "#f2495c" : "#1fbf75"} />; })}</svg></td>
            </tr>
          );
        })}</tbody>
      </table>
    </>
  );
}
export function CcrvLive({ onClose }: P) {
  const [tab, setTab] = useState("cmp");
  const [group, setGroup] = useState("能源");
  return (
    <PanelShell code="CCRV" title="商品期货曲线" onClose={onClose} tabs={[["cmp", "曲线对比"], ["roll", "展期收益"], ["shift", "曲线形变"]]} tab={tab} setTab={setTab}
      right={<Seg value={group} onChange={setGroup} options={Object.keys(CCRV_GROUPS).map((g) => [g, g] as [string, string])} />}>
      <CcrvBody tab={tab} group={group} />
    </PanelShell>
  );
}

/* ================================================================== MAP 全球市场地图（地区瓦片） */
type Tile = { s: string; l: string };
const MAP_REGIONS: Array<{ k: string; name: string; col: string; row: string; eq: Tile[]; fx: Tile[] }> = [
  { k: "NA", name: "北美", col: "1 / 3", row: "1 / 2", eq: [{ s: "^GSPC", l: "标普500" }, { s: "^NDX", l: "纳指100" }, { s: "^DJI", l: "道指" }, { s: "^RUT", l: "罗素2000" }, { s: "^GSPTSE", l: "加拿大" }], fx: [{ s: "DXY", l: "美元指数" }, { s: "USDCAD", l: "美元/加元" }] },
  { k: "EU", name: "欧洲", col: "3 / 5", row: "1 / 2", eq: [{ s: "^STOXX50E", l: "欧洲50" }, { s: "^GDAXI", l: "德国" }, { s: "^FTSE", l: "英国" }, { s: "^FCHI", l: "法国" }], fx: [{ s: "EURUSD", l: "欧元" }, { s: "GBPUSD", l: "英镑" }, { s: "USDCHF", l: "美元/瑞郎" }] },
  { k: "AS", name: "亚太", col: "5 / 7", row: "1 / 3", eq: [{ s: "sh000001", l: "上证" }, { s: "sh000300", l: "沪深300" }, { s: "sz399006", l: "创业板" }, { s: "^HSI", l: "恒生" }, { s: "^N225", l: "日经" }, { s: "^KS11", l: "韩国" }, { s: "^TWII", l: "台湾" }, { s: "^AXJO", l: "澳洲" }, { s: "^STI", l: "新加坡" }], fx: [{ s: "USDCNH", l: "离岸人民币" }, { s: "USDJPY", l: "日元" }, { s: "USDKRW", l: "韩元" }, { s: "AUDUSD", l: "澳元" }] },
  { k: "LA", name: "拉美", col: "1 / 3", row: "2 / 3", eq: [{ s: "^BVSP", l: "巴西" }, { s: "^MXX", l: "墨西哥" }], fx: [{ s: "USDBRL", l: "雷亚尔" }, { s: "USDMXN", l: "比索" }] },
  { k: "EM", name: "南亚 / 中东 / 非洲", col: "3 / 5", row: "2 / 3", eq: [{ s: "^BSESN", l: "印度SENSEX" }, { s: "^NSEI", l: "印度NIFTY" }], fx: [{ s: "USDINR", l: "卢比" }, { s: "USDZAR", l: "兰特" }, { s: "USDTRY", l: "里拉" }] },
];

function MapBody({ layer, horizon }: { layer: "eq" | "fx"; horizon: string }) {
  const tiles = MAP_REGIONS.flatMap((r) => r[layer].map((t) => t.s));
  const ticks = useTicks(tiles);
  const pack = useCloses(horizon === "d1" ? [] : tiles, 300);
  const { pick } = useHub();
  const val = (s: string) => {
    if (horizon === "d1") return ticks[s]?.changePct ?? null;
    const c = (pack.data?.[s] ?? []).map((x) => x[1]);
    const dts = (pack.data?.[s] ?? []).map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10));
    return horizon === "m1" ? perf(c, 21) : ytd(c, dts);
  };
  // 外汇：统一为「本币对美元」方向（正值 = 本币升值）
  const fxSign = (s: string) => (s.startsWith("USD") ? -1 : 1);
  const shown = (s: string) => { const v = val(s); return v == null ? null : layer === "fx" && s !== "DXY" ? v * fxSign(s) : v; };
  const scale = horizon === "d1" ? 2 : horizon === "m1" ? 6 : 20;
  const stats = MAP_REGIONS.map((r) => { const v = r[layer].map((t) => shown(t.s)).filter((x): x is number => x != null); return { r, avg: v.length ? mean(v) : null }; });
  const best = [...stats].filter((x) => x.avg != null).sort((a, b) => b.avg! - a.avg!);
  return (
    <>
      <Kpis items={[["最强地区", best[0]?.r.name ?? "—", sgn(best[0]?.avg, 2)], ["最弱地区", best[best.length - 1]?.r.name ?? "—", sgn(best[best.length - 1]?.avg, 2)], ["上涨 / 下跌", `${tiles.filter((s) => (shown(s) ?? 0) > 0).length} / ${tiles.filter((s) => (shown(s) ?? 0) < 0).length}`], ["图层", layer === "eq" ? "股票指数" : "货币（对美元，正 = 本币升值）"]]} />
      <div className="grid gap-px bg-[#1a2a3c] p-px" style={{ gridTemplateColumns: "repeat(6, minmax(0,1fr))", gridTemplateRows: "auto auto" }}>
        {stats.map(({ r, avg }) => (
          <div key={r.k} className="bg-[#03070c] p-1.5" style={{ gridColumn: r.col, gridRow: r.row }}>
            <div className="mb-1 flex items-baseline justify-between text-[11px]"><b className="text-cyan-200">{r.name}</b><span className="font-mono" style={{ color: toneOf(avg) }}>{sgn(avg, 2)}</span></div>
            <div className="grid grid-cols-2 gap-px sm:grid-cols-3">
              {r[layer].map((t) => { const v = shown(t.s); return (
                <button key={t.s} type="button" onClick={() => pick(t.s)} className="px-1.5 py-1 text-left hover:outline hover:outline-1 hover:outline-cyan-500" style={{ background: heat(v, scale) ?? "#0a1420" }}>
                  <div className="truncate text-[10px] text-slate-100">{t.l}</div>
                  <div className="font-mono text-[11px] text-white">{sgn(v, 2)}</div>
                  <div className="font-mono text-[9px] text-slate-300/80">{fmtPrice(ticks[t.s]?.price)}</div>
                </button>
              ); })}
            </div>
          </div>
        ))}
      </div>
      <Note>瓦片按地理方位排布，颜色深浅代表所选区间涨跌幅（红涨绿跌）；货币图层统一换算为本币兑美元方向。点击瓦片查看 K 线。</Note>
    </>
  );
}
export function MapMarketsLive({ onClose }: P) {
  const [layer, setLayer] = useState<"eq" | "fx">("eq");
  const [h, setH] = useState("d1");
  return (
    <PanelShell code="MAP" title="全球市场地图" onClose={onClose} tabs={[["eq", "股票指数"], ["fx", "货币"]]} tab={layer} setTab={(t) => setLayer(t as "eq" | "fx")}
      right={<Seg value={h} onChange={setH} options={[["d1", "今日"], ["m1", "1月"], ["ytd", "年初至今"]]} />}>
      <MapBody layer={layer} horizon={h} />
    </PanelShell>
  );
}

/* ================================================================== GP 价格走势图（单标的 + 区间统计） */
const GP_RANGES: Array<[string, string, number]> = [["1M", "1月", 22], ["3M", "3月", 66], ["6M", "6月", 130], ["1Y", "1年", 252], ["3Y", "3年", 756], ["5Y", "5年", 1260]];
function GpBody({ sym, range, kind }: { sym: string; range: string; kind: string }) {
  const n = GP_RANGES.find((r) => r[0] === range)![2];
  const pack = useCloses([sym], Math.max(60, n + 5));
  const k = useKline(kind === "k" ? sym : null, n > 300 ? "1w" : "1d", n > 300 ? Math.ceil(n / 5) : n);
  const pts = (pack.data?.[sym] ?? []).slice(-(n + 1));
  const c = pts.map((x) => x[1]);
  const dts = pts.map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10));
  const r = rets(c);
  const dd = drawdown(c);
  const ret = c.length > 1 ? (c[c.length - 1] / c[0] - 1) * 100 : null;
  const yrs = c.length / 252;
  const cagr = ret != null && yrs >= 1 ? (Math.pow(1 + ret / 100, 1 / yrs) - 1) * 100 : null;
  const vol = annVol(c);
  const hiI = c.length ? c.indexOf(Math.max(...c)) : -1, loI = c.length ? c.indexOf(Math.min(...c)) : -1;
  const upDays = r.length ? (r.filter((x) => x > 0).length / r.length) * 100 : null;
  const ma = (w: number) => c.map((_, i) => (i + 1 >= w ? mean(c.slice(i + 1 - w, i + 1)) : null));
  if (!c.length) return <Empty loading={pack.loading} text="无此标的日线" />;
  return (
    <>
      <Kpis items={[["区间涨跌", sgn(ret, 2), `${dts[0]} 起`], ["年化收益", cagr == null ? "—" : sgn(cagr, 2), "不足 1 年不年化"], ["年化波动", f2(vol, 2, "%")], ["最大回撤", f2(dd.max, 2, "%"), `当前 ${f2(dd.now, 2, "%")}`], ["区间最高", fmtPrice(c[hiI]), dts[hiI]], ["区间最低", fmtPrice(c[loI]), dts[loI]], ["上涨天数占比", f2(upDays, 1, "%"), `${r.length} 个交易日`], ["单日最大涨 / 跌", `${sgn(r.length ? Math.max(...r) * 100 : null, 2)} / ${sgn(r.length ? Math.min(...r) * 100 : null, 2)}`]]} />
      {kind === "k" ? (k.candles.length ? <KlineChart candles={k.candles} period={(n > 300 ? "1w" : "1d") as Period} height={300} overlay="BOLL" subs={["VOL", "MACD"]} signals /> : <Empty loading={k.loading} />)
        : <Lines series={[{ name: "收盘", color: "#38bdf8", values: c }, ...(c.length > 60 ? [{ name: "20日均线", color: "#fbbf24", values: ma(20), dash: true }, { name: "60日均线", color: "#a78bfa", values: ma(60), dash: true }] : [])]} xLabels={dts.map((d) => d.slice(2))} height={280} fmt={(v) => fmtPrice(v)} />}
      <SectionHead title="回撤（%）" />
      <Lines series={[{ name: "距前高回撤", color: "#1fbf75", values: dd.series }]} xLabels={dts.map((d) => d.slice(2))} height={110} fmt={(v) => v.toFixed(1)} />
    </>
  );
}
export function GpMarketsLive({ onClose }: P) {
  const [sym, setSym] = useState("^GSPC");
  const [inp, setInp] = useState("");
  const [range, setRange] = useState("1Y");
  const [kind, setKind] = useState("line");
  const t = useTicks([sym]);
  return (
    <PanelShell code="GP" title={`价格走势图 · ${t[sym]?.name ?? sym}`} onClose={onClose}
      right={<span className="flex items-center gap-1"><form onSubmit={(e) => { e.preventDefault(); if (inp.trim()) { setSym(inp.trim()); setInp(""); } }}><input value={inp} onChange={(e) => setInp(e.target.value)} placeholder="代码，如 AAPL / sh600519 / GC" className={`${INP} w-44`} /></form><Seg value={kind} onChange={setKind} options={[["line", "收盘线"], ["k", "K线"]]} /><Seg value={range} onChange={setRange} options={GP_RANGES.map(([k, l]) => [k, l] as [string, string])} /></span>}>
      <div className="flex items-baseline gap-3 px-2 py-1"><span className="font-mono text-[20px] font-bold" style={{ color: toneOf(t[sym]?.changePct) }}>{fmtPrice(t[sym]?.price)}</span><span className="font-mono text-[12px]" style={{ color: toneOf(t[sym]?.changePct) }}>{fmtPct(t[sym]?.changePct)}</span><span className="font-mono text-[10px] text-slate-500">{sym}</span>{["^GSPC", "^NDX", "sh000300", "^HSI", "GC", "CL", "BTC"].map((s) => <button key={s} type="button" onClick={() => setSym(s)} className={`${BTN} text-[10px]`}>{s}</button>)}</div>
      <GpBody sym={sym} range={range} kind={kind} />
    </PanelShell>
  );
}
