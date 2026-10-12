/**
 * 实时经济日历：昨天 / 今天 / 明天 / 未来一周的全球经济数据发布，公布后自动出实际值并标出超预期 / 不及预期。
 * 点击任一事件：查看实际值 vs 预期 vs 前值、对市场的影响方向、相关市场实时行情和相关新闻（站内阅读）。
 */
import { useEffect, useMemo, useState } from "react";
import { DOWN, FLAT, UP, usePolled } from "@/uc/market/live";
import { DEFAULT_PREFS, FeedList, NewsCtx, QuoteStrip, Reader, SectionHead, Seg, useFeed, type News } from "./kit";

export type EconEvent = { id: string; date: string; time: number | null; country: string; region: string; name: string; nameZh: string; actual: string | null; consensus: string | null; previous: string | null; importance: 1 | 2 | 3; surprise: number | null; released: boolean };

const dayStr = (offset: number) => new Date(Date.now() + offset * 86400e3).toISOString().slice(0, 10);
const REGION_MARKETS: Record<string, string[]> = {
  美国: ["^GSPC", "DXY", "ZN", "GC"], 中国: ["000001.SH", "USDCNH", "^HSI"], 欧元区: ["^STOXX50E", "EURUSD"], 德国: ["^GDAXI", "EURUSD"], 法国: ["^FCHI", "EURUSD"], 英国: ["^FTSE", "GBPUSD"],
  日本: ["^N225", "USDJPY"], 加拿大: ["^GSPTSE"], 澳大利亚: ["^AXJO", "AUDUSD"], 中国香港: ["^HSI"], 印度: ["^BSESN"], 韩国: ["^KS11"], 巴西: ["^BVSP"],
};
const INFLATION = /CPI|PPI|PCE|通胀|物价|Inflation|Price/i;
const JOBS = /就业|失业|Payroll|Jobless|Unemployment|ADP|JOLTS|时薪|Earnings/i;
const GROWTH = /GDP|PMI|零售|工业|Retail|Industrial|ISM|订单|Orders|信心|Sentiment|Confidence|销售|Sales/i;

function impact(e: EconEvent): { text: string; tone: number } | null {
  if (e.surprise == null || !e.actual) return null;
  const s = e.surprise;
  if (Math.abs(s) < 1e-9) return { text: "与预期一致，市场影响有限", tone: 0 };
  const unemployment = /失业|Unemployment|Jobless/i.test(e.name + e.nameZh);
  if (INFLATION.test(e.name + e.nameZh)) return s > 0 ? { text: "通胀高于预期：加息 / 推迟降息预期升温，偏利空股市与债券、利多本币", tone: -1 } : { text: "通胀低于预期：降息预期升温，偏利多股市与债券", tone: 1 };
  if (JOBS.test(e.name + e.nameZh)) {
    const strong = unemployment ? s < 0 : s > 0;
    return strong ? { text: "就业强于预期：经济韧性好，但降息预期可能降温，利多本币", tone: 1 } : { text: "就业弱于预期：经济放缓担忧，降息预期升温，利多债券", tone: -1 };
  }
  if (GROWTH.test(e.name + e.nameZh)) return s > 0 ? { text: "增长数据好于预期：利多股市与本币", tone: 1 } : { text: "增长数据不及预期：利空股市，利多债券", tone: -1 };
  return s > 0 ? { text: "高于预期", tone: 1 } : { text: "低于预期", tone: -1 };
}

function countdown(t: number | null) {
  if (!t) return "";
  const s = Math.round((t - Date.now()) / 1000);
  if (s <= 0) return "";
  if (s < 3600) return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒后`;
  if (s < 86400) return `${Math.floor(s / 3600)}小时${Math.floor((s % 3600) / 60)}分后`;
  return "";
}

export function EventDetail({ e, onClose }: { e: EconEvent; onClose: () => void }) {
  const [reading, setReading] = useState<News | null>(null);
  const keyword = e.nameZh.replace(/（.*?）|\s.*$/g, "");
  const { items, loading } = useFeedWithin({ q: `${keyword}`, limit: 40, hours: 96 });
  const imp = impact(e);
  const vals = [["实际", e.actual], ["预期", e.consensus], ["前值", e.previous]] as const;
  const nums = vals.map(([, v]) => (v ? Number(/-?\d+(?:\.\d+)?/.exec(v.replace(/,/g, ""))?.[0]) : NaN));
  const max = Math.max(1e-9, ...nums.filter(Number.isFinite).map(Math.abs));
  return (
    <NewsCtx.Provider value={{ prefs: DEFAULT_PREFS, open: setReading, openSymbol: () => undefined, selected: reading?.id ?? null }}>
      <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" onClick={onClose}>
        <div className="flex h-full w-full max-w-[640px] flex-col border-l border-[#1a2a3c] bg-[#050a11]" onClick={(ev) => ev.stopPropagation()}>
          {reading ? <Reader item={reading} onClose={() => setReading(null)} /> : (
            <>
              <div className="flex items-center justify-between border-b border-[#1a2a3c] bg-[#08121e] px-3 py-1 text-[11px]"><span className="font-semibold text-cyan-200">经济数据详情</span><button type="button" onClick={onClose} className="text-slate-400 hover:text-white">关闭 ✕</button></div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-3 py-2">
                  <div className="text-[10px] text-slate-500">{e.region} · {e.date} {e.time ? new Date(e.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "全天"}（北京时间）· {"★".repeat(e.importance)}</div>
                  <div className="mt-1 text-[16px] font-semibold text-white">{e.nameZh}</div>
                  {e.nameZh !== e.name && <div className="text-[10px] text-slate-500">{e.name}</div>}
                </div>
                <div className="space-y-1 border-y border-[#1a2a3c] px-3 py-2">
                  {vals.map(([label, v], i) => (
                    <div key={label} className="grid grid-cols-[40px_80px_minmax(0,1fr)] items-center gap-2 text-[11px]">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono text-slate-100">{v ?? "—"}</span>
                      <span className="h-[8px] bg-[#0b1624]"><span className="block h-full" style={{ width: `${Number.isFinite(nums[i]) ? (Math.abs(nums[i]) / max) * 100 : 0}%`, background: i === 0 ? "#38bdf8" : i === 1 ? "#a78bfa" : "#475569" }} /></span>
                    </div>
                  ))}
                  {e.surprise != null && <div className="text-[11px] text-slate-400">预期差 <b className="font-mono" style={{ color: e.surprise > 0 ? UP : e.surprise < 0 ? DOWN : FLAT }}>{e.surprise > 0 ? "+" : ""}{e.surprise}</b></div>}
                  {imp ? <div className="text-[11px]" style={{ color: imp.tone > 0 ? UP : imp.tone < 0 ? DOWN : FLAT }}>影响：{imp.text}</div> : <div className="text-[11px] text-slate-500">{e.actual ? "" : `尚未公布${countdown(e.time) ? `，${countdown(e.time)}` : ""}；公布后自动更新实际值`}</div>}
                </div>
                <SectionHead title="相关市场" />
                <QuoteStrip symbols={REGION_MARKETS[e.region] ?? ["^GSPC", "DXY", "GC"]} />
                <SectionHead title="相关新闻" sub={`${items.length} 条`} />
                <FeedList items={items} loading={loading} dense empty="暂无相关新闻" />
              </div>
            </>
          )}
        </div>
      </div>
    </NewsCtx.Provider>
  );
}
function useFeedWithin(input: Parameters<typeof useFeed>[0]) {
  return useFeed(input, 120_000);
}

export default function EconCalendar({ compact }: { compact?: boolean }) {
  const [range, setRange] = useState<"y" | "t" | "m" | "w">("t");
  const [region, setRegion] = useState("全部");
  const [minImp, setMinImp] = useState<"1" | "2" | "3">("1");
  const [pick, setPick] = useState<EconEvent | null>(null);
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const input = range === "y" ? { from: dayStr(-1), days: 1 } : range === "t" ? { from: dayStr(0), days: 1 } : range === "m" ? { from: dayStr(1), days: 1 } : { from: dayStr(0), days: 7 };
  const cal = usePolled<EconEvent[]>("ucNews.calendar", input, range === "t" ? 30_000 : 300_000);
  const regions = useMemo(() => ["全部", ...[...new Set((cal.data ?? []).map((e) => e.region))].sort((a, b) => (a === "美国" ? -1 : b === "美国" ? 1 : a === "中国" ? -1 : b === "中国" ? 1 : 0))], [cal.data]);
  const list = (cal.data ?? []).filter((e) => (region === "全部" || e.region === region) && e.importance >= Number(minImp));
  const next = list.find((e) => !e.actual && e.time && e.time > Date.now());
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 px-2 py-1">
        <span className="mr-1 text-[11px] font-semibold text-cyan-100">经济日历</span>
        <Seg value={range} onChange={setRange} options={[["y", "昨天"], ["t", "今天"], ["m", "明天"], ["w", "未来7天"]]} />
        <Seg value={minImp} onChange={setMinImp} options={[["1", "全部"], ["2", "★★"], ["3", "★★★"]]} />
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-5 border border-[#1d3047] bg-[#050b13] text-[10px] text-slate-200">{regions.map((r) => <option key={r}>{r}</option>)}</select>
        <span className="ml-auto text-[10px] text-slate-500">{next ? <>下一项 <b className="text-amber-300">{next.nameZh}</b> {countdown(next.time)}</> : cal.loading ? "读取中…" : `${list.length} 项`}</span>
      </div>
      <div className={`${compact ? "max-h-[300px]" : "max-h-[560px]"} overflow-auto`}>
        <table className="w-full min-w-[520px] text-left text-[10px]">
          <thead className="sticky top-0 bg-[#0b1b2d] text-slate-500"><tr><th className="px-2 py-1">时间</th><th>地区</th><th>事件</th><th className="text-right">实际</th><th className="text-right">预期</th><th className="px-2 text-right">前值</th></tr></thead>
          <tbody>
            {list.map((e) => {
              const imp = impact(e);
              const upcoming = !e.actual && e.time && e.time > Date.now();
              const justNow = e.actual && e.time && Date.now() - e.time < 30 * 60e3;
              return (
                <tr key={e.id} onClick={() => setPick(e)} className={`cursor-pointer border-t border-slate-800/80 ${justNow ? "bg-amber-500/10" : "hover:bg-slate-900"}`}>
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-400">{range === "w" ? `${e.date.slice(5)} ` : ""}{e.time ? new Date(e.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "全天"}{upcoming && countdown(e.time) ? <span className="ml-1 text-amber-300/80">{countdown(e.time)}</span> : null}</td>
                  <td className="whitespace-nowrap text-slate-400">{e.region}</td>
                  <td className="text-slate-100"><span className="mr-1 text-amber-400">{"★".repeat(e.importance)}</span>{e.nameZh}</td>
                  <td className="text-right font-mono font-semibold" style={{ color: imp ? (imp.tone > 0 ? UP : imp.tone < 0 ? DOWN : "#e2e8f0") : "#e2e8f0" }}>{e.actual ?? (upcoming ? "待公布" : "—")}</td>
                  <td className="text-right font-mono text-slate-400">{e.consensus ?? "—"}</td>
                  <td className="px-2 text-right font-mono text-slate-500">{e.previous ?? "—"}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={6} className="px-2 py-8 text-center text-slate-500">{cal.loading ? "读取中…" : "该时段没有符合条件的数据发布"}</td></tr>}
          </tbody>
        </table>
      </div>
      {pick && <EventDetail e={pick} onClose={() => setPick(null)} />}
    </div>
  );
}
