/**
 * 抵押债入口：实时风险预警（全部由真实数据计算）+ 26 个功能入口。
 */
import { useMemo } from "react";
import { usePolled } from "@/uc/market/live";
import { perf, useCloses } from "@/uc/hubs/calc";
import { SectionHead } from "@/uc/news/kit";

const MODULES: Array<[string, string, string]> = [
  ["1", "MBS-1", "抵押债市场概览"], ["2", "SECF", "证券查找"], ["3", "MTGS", "抵押债披露检索"], ["4", "MTGH", "按揭利率历史"], ["5", "NEW", "新发行及发售"], ["6", "MCAL", "结构金融日历"], ["7", "IMGR", "美联储抵押债库存"],
  ["8", "STSH", "抵押池现金流工具"], ["9", "MKT", "当前市场"], ["10", "TBPF", "美联储 TBA 操作"], ["11", "RATG", "信用与评级压力"], ["12", "BMMI", "市场洞察"], ["13", "NEWS", "新闻与研究"], ["14", "FIRS", "快讯与监管首发"],
  ["15", "NI", "结构融资动态"], ["16", "GN", "吉利美深度分析"], ["17", "DES", "证券简介"], ["18", "YT", "收益率表"], ["19", "FIBC", "债券计算器"], ["20", "Q", "市场报价"], ["21", "CMAP", "商业地产地图"],
  ["22", "INDX", "抵押债指数"], ["23", "MCCN", "按揭利差实时监测"], ["24", "ASSET", "资产类别对比"], ["25", "R/C", "住宅 vs 商业"], ["26", "VOL", "成交量与表现"],
];

type Housing = { pmms: Array<{ d: string; m30: number | null }> };
type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }> };
type Soma = Array<{ d: string; mbs: number }>;

export function MBSRiskCenter({ onModuleOpen }: { onModuleOpen?: (moduleId: string) => void }) {
  const h = usePolled<Housing>("ucHubs.housing", {}, 6 * 3600_000);
  const c = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const soma = usePolled<Soma>("ucHubs.soma", {}, 6 * 3600_000);
  const pack = useCloses(["MBB", "IEI", "CMBS", "AGNC", "NLY", "^MOVE", "BXP", "KRE"], 400);
  const alerts = useMemo(() => {
    const out: Array<{ level: "高" | "中" | "低"; mod: string; text: string; value: string }> = [];
    const col = (s: string) => (pack.data?.[s] ?? []).map((x) => x[1]);
    const pm = h.data?.pmms ?? [];
    const y10 = c.data?.us[0]?.points.find((p) => p.tenor === "10Y")?.value;
    const m30 = pm[pm.length - 1]?.m30;
    if (m30 != null && y10 != null) {
      const s = (m30 - y10) * 100;
      out.push({ level: s > 220 ? "高" : s > 180 ? "中" : "低", mod: "23", text: s > 220 ? "一级按揭利差处于高位：抵押债相对国债便宜" : s < 150 ? "一级按揭利差偏窄：抵押债估值偏贵" : "一级按揭利差处于常态区间", value: `${s.toFixed(0)}bp` });
    }
    const rel = perf(col("MBB"), 21) != null && perf(col("IEI"), 21) != null ? perf(col("MBB"), 21)! - perf(col("IEI"), 21)! : null;
    if (rel != null) out.push({ level: rel < -0.5 ? "高" : rel < 0 ? "中" : "低", mod: "12", text: rel < 0 ? "抵押债近 1 月跑输同久期国债，利差走阔" : "抵押债近 1 月跑赢同久期国债，利差收窄", value: `${rel > 0 ? "+" : ""}${rel.toFixed(2)}%` });
    const mv = col("^MOVE");
    if (mv.length > 20) { const p = (mv.filter((v) => v <= mv[mv.length - 1]).length / mv.length) * 100; out.push({ level: p > 80 ? "高" : p > 60 ? "中" : "低", mod: "9", text: "美债波动率决定提前还款期权价值，波动越高抵押债越承压", value: `分位 ${p.toFixed(0)}%` }); }
    const cm = perf(col("CMBS"), 63), bx = perf(col("BXP"), 63);
    if (cm != null && bx != null) out.push({ level: bx < -10 ? "高" : bx < 0 ? "中" : "低", mod: "21", text: "写字楼信托近 3 月表现（商业抵押债抵押品风险）", value: `${bx > 0 ? "+" : ""}${bx.toFixed(1)}%` });
    const kre = perf(col("KRE"), 21);
    if (kre != null) out.push({ level: kre < -8 ? "高" : kre < -3 ? "中" : "低", mod: "11", text: "地区银行近 1 月表现（商业地产贷款主要持有人）", value: `${kre > 0 ? "+" : ""}${kre.toFixed(1)}%` });
    const s = soma.data ?? [];
    if (s.length > 5) { const d = s[s.length - 1].mbs - s[s.length - 5].mbs; out.push({ level: d < -20 ? "中" : "低", mod: "7", text: "美联储近 4 周抵押债持仓变化（缩表）", value: `${d.toFixed(1)} 十亿` }); }
    const ag = perf(col("AGNC"), 21), nl = perf(col("NLY"), 21);
    if (ag != null && nl != null) { const m = (ag + nl) / 2; out.push({ level: m < -5 ? "高" : m < 0 ? "中" : "低", mod: "20", text: "抵押贷款信托近 1 月表现（杠杆买盘风向）", value: `${m > 0 ? "+" : ""}${m.toFixed(1)}%` }); }
    if (pm.length > 5 && m30 != null) { const d = (m30 - (pm[pm.length - 5].m30 ?? m30)) * 100; out.push({ level: Math.abs(d) > 25 ? "高" : Math.abs(d) > 10 ? "中" : "低", mod: "4", text: d < 0 ? "按揭利率 4 周下行：再融资与提前还款加快" : "按揭利率 4 周上行：久期延长风险上升", value: `${d > 0 ? "+" : ""}${d.toFixed(0)}bp` }); }
    const order = { 高: 0, 中: 1, 低: 2 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }, [h.data, c.data, soma.data, pack.data]);
  const LC = { 高: "#f2495c", 中: "#fbbf24", 低: "#64748b" };
  return (
    <div className="flex h-full min-h-[420px] flex-col bg-[#03070c] text-slate-200">
      <div className="flex items-center gap-2 border-b border-[#1a2a3c] bg-[#060d16] px-2 py-1"><span className="font-mono text-[11px] text-amber-300">MBS</span><span className="text-[12px] font-semibold text-white">抵押债 · 实时风险预警中心</span><span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />实时</span></div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SectionHead title="风险预警（由实时行情、按揭利率、美联储持仓计算）" sub={alerts.length ? `${alerts.filter((a) => a.level === "高").length} 项高、${alerts.filter((a) => a.level === "中").length} 项中` : "计算中…"} />
        <table className="w-full text-[11px]"><tbody>{alerts.map((a, i) => <tr key={i} onClick={() => onModuleOpen?.(a.mod)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="w-10 px-2 py-1 font-semibold" style={{ color: LC[a.level] }}>{a.level}</td><td className="text-slate-200">{a.text}</td><td className="text-right font-mono text-white">{a.value}</td><td className="px-2 text-right text-[10px] text-cyan-300">打开 ›</td></tr>)}</tbody></table>
        <SectionHead title="功能入口" />
        <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map(([id, code, name]) => <button key={id} type="button" onClick={() => onModuleOpen?.(id)} className="bg-[#050b13] px-2 py-1.5 text-left hover:bg-[#0a1726]"><span className="font-mono text-[10px] text-amber-300">{code}</span><span className="ml-1.5 text-[11px] text-slate-200">{name}</span></button>)}
        </div>
      </div>
    </div>
  );
}
