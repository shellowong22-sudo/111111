/**
 * 外汇中心（/forex-hub）：实时汇率看板 · 交叉汇率矩阵 · 货币强弱 · 机构持仓（CFTC）· 参考汇率与政策利率 · 外汇新闻与日历。
 */
import { useMemo, useState } from "react";
import { FxcLive } from "@/components/live/FxcLive";
import { DOWN, UP, fmtCompact, fmtPct, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, SectionHead, Spark, useFeed } from "@/uc/news/kit";
import EconCalendar from "@/uc/news/EconCalendar";
import { Bars, HubShell, LiveBoard, useHub, type BoardRow } from "./kit";

const FUNCS: Array<[string, string, string]> = [["board", "FXIP", "实时汇率"], ["matrix", "FXC", "交叉汇率矩阵"], ["strength", "FXST", "货币强弱"], ["cot", "COT", "机构持仓"], ["ref", "FXFR", "参考汇率与利率"], ["news", "FXN", "外汇新闻与日历"]];
const BOARD: BoardRow[] = [
  ...["DXY", "EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"].map((s) => ({ symbol: s, group: "主要货币" })),
  ...["USDCNH", "USDCNY", "USDHKD", "USDTWD", "USDKRW", "USDSGD", "USDINR", "USDTHB"].map((s) => ({ symbol: s, group: "亚洲货币" })),
  ...["EURJPY", "EURGBP", "EURCHF", "GBPJPY", "AUDJPY", "EURCNY", "CNYJPY"].map((s) => ({ symbol: s, group: "交叉盘" })),
  ...["USDMXN", "USDBRL", "USDZAR", "USDTRY"].map((s) => ({ symbol: s, group: "新兴市场" })),
  ...["BTC", "ETH", "GC"].map((s) => ({ symbol: s, group: "另类" })),
];
// 每个货币对 USD 的报价方式：USD 在前（USDJPY）则 1 USD = x 外币
const CCY: Array<[string, string, boolean]> = [["USD", "", true], ["EUR", "EURUSD", false], ["JPY", "USDJPY", true], ["GBP", "GBPUSD", false], ["CHF", "USDCHF", true], ["AUD", "AUDUSD", false], ["CAD", "USDCAD", true], ["NZD", "NZDUSD", false], ["CNH", "USDCNH", true], ["HKD", "USDHKD", true]];
const CCY_ZH: Record<string, string> = { USD: "美元", EUR: "欧元", JPY: "日元", GBP: "英镑", CHF: "瑞郎", AUD: "澳元", CAD: "加元", NZD: "纽元", CNH: "人民币", HKD: "港币" };

function useUsdRates() {
  const ticks = useTicks(CCY.filter(([, s]) => s).map(([, s]) => s));
  return useMemo(() => {
    // 返回 1 USD 兑多少该货币，以及今日变动（该货币对美元的涨跌，正数=该货币升值）
    const out: Record<string, { perUsd: number | null; chg: number | null }> = { USD: { perUsd: 1, chg: 0 } };
    for (const [c, s, usdFirst] of CCY) {
      if (!s) continue;
      const t = ticks[s];
      if (!t?.price) { out[c] = { perUsd: null, chg: null }; continue; }
      out[c] = { perUsd: usdFirst ? t.price : 1 / t.price, chg: t.changePct == null ? null : usdFirst ? -t.changePct : t.changePct };
    }
    return out;
  }, [ticks]);
}


function Strength() {
  const r = useUsdRates();
  const ref = usePolled<{ history: Record<string, number[]>; dates: string[] }>("ucHubs.fx", {}, 1800_000);
  const rows = CCY.map(([c]) => c).map((c) => {
    // 今日强弱：该货币对其余各货币的平均涨跌
    const others = CCY.map(([x]) => x).filter((x) => x !== c);
    const vals = others.map((o) => (r[c]?.chg != null && r[o]?.chg != null ? r[c].chg! - r[o].chg! : null)).filter((v): v is number => v != null);
    const today = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const hist = c === "USD" ? null : ref.data?.history[c === "CNH" ? "CNY" : c];
    const m1 = hist && hist.length > 1 ? ((hist[0] / hist[hist.length - 1]) - 1) * 100 : null; // 1 USD 兑外币减少 = 外币升值
    return { c, today, m1, hist };
  }).sort((a, b) => (b.today ?? -99) - (a.today ?? -99));
  const max = Math.max(0.01, ...rows.map((x) => Math.abs(x.today ?? 0)));
  return (
    <div>
      <SectionHead title="货币强弱" sub="今日：对其余 9 种货币的平均涨跌；近一月：对美元的升贬值" />
      {rows.map((x) => (
        <div key={x.c} className="grid grid-cols-[110px_minmax(0,1fr)_70px_70px_100px] items-center gap-2 border-b border-[#0f1b29] px-2 py-1 text-[11px]">
          <span className="text-slate-200">{x.c} <span className="text-slate-500">{CCY_ZH[x.c]}</span></span>
          <span className="relative h-[10px] bg-[#0b1624]"><span className="absolute left-1/2 top-0 h-full w-px bg-slate-600" /><span className="absolute top-0 h-full" style={{ left: (x.today ?? 0) >= 0 ? "50%" : `${50 - (Math.abs(x.today ?? 0) / max) * 50}%`, width: `${(Math.abs(x.today ?? 0) / max) * 50}%`, background: toneOf(x.today) }} /></span>
          <span className="text-right font-mono" style={{ color: toneOf(x.today) }}>{fmtPct(x.today)}</span>
          <span className="text-right font-mono" style={{ color: toneOf(x.m1) }}>{x.c === "USD" ? "—" : fmtPct(x.m1)}</span>
          <span>{x.hist ? <Spark values={x.hist.map((v) => 1 / v)} width={96} height={16} color={toneOf(x.m1)} /> : null}</span>
        </div>
      ))}
    </div>
  );
}

type Cot = Array<{ name: string; symbol: string; date: string; oi: number; dealerNet: number; assetMgrNet: number; levNet: number; assetMgrNetChg: number; levNetChg: number; levLongPct: number }>;
export function CotView({ filter }: { filter: (symbol: string) => boolean }) {
  const cot = usePolled<Cot>("ucHubs.cot", {}, 3600_000);
  const list = (cot.data ?? []).filter((x) => filter(x.symbol));
  const { pick } = useHub();
  return (
    <div>
      <SectionHead title="机构持仓（CFTC 每周持仓报告）" sub={list[0] ? `报告日 ${list[0].date}` : undefined} />
      <Bars data={list.map((x) => ({ k: x.name, v: x.levNet, v2: x.assetMgrNet }))} label={["杠杆基金净头寸", "资产管理人净头寸"]} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">品种</th><th className="text-right">未平仓</th><th className="text-right">杠杆基金净</th><th className="text-right">周变动</th><th className="text-right">多头占比</th><th className="text-right">资管净</th><th className="text-right">周变动</th><th className="px-2 text-right">交易商净</th></tr></thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.symbol} onClick={() => pick(x.symbol)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
              <td className="px-2 py-1 text-slate-100">{x.name}</td>
              <td className="text-right font-mono text-slate-400">{fmtCompact(x.oi)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(x.levNet) }}>{fmtCompact(x.levNet)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(x.levNetChg) }}>{x.levNetChg > 0 ? "+" : ""}{fmtCompact(x.levNetChg)}</td>
              <td className="text-right font-mono text-slate-300">{x.levLongPct.toFixed(1)}%</td>
              <td className="text-right font-mono" style={{ color: toneOf(x.assetMgrNet) }}>{fmtCompact(x.assetMgrNet)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(x.assetMgrNetChg) }}>{x.assetMgrNetChg > 0 ? "+" : ""}{fmtCompact(x.assetMgrNetChg)}</td>
              <td className="px-2 text-right font-mono" style={{ color: toneOf(x.dealerNet) }}>{fmtCompact(x.dealerNet)}</td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={8} className="px-2 py-6 text-center text-slate-500">{cot.loading ? "读取中…" : "暂无数据"}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RefRates() {
  const ref = usePolled<{ date: string; rates: Record<string, number>; history: Record<string, number[]>; policy: Array<{ bank: string; rate: number | null; date: string | null }> }>("ucHubs.fx", {}, 1800_000);
  const d = ref.data;
  const NAMES: Record<string, string> = { EUR: "欧元", JPY: "日元", GBP: "英镑", CNY: "人民币", HKD: "港币", AUD: "澳元", CAD: "加元", CHF: "瑞郎", NZD: "纽元", SGD: "新加坡元", KRW: "韩元", INR: "印度卢比", BRL: "巴西雷亚尔", MXN: "墨西哥比索", ZAR: "南非兰特", TRY: "土耳其里拉", SEK: "瑞典克朗", NOK: "挪威克朗", DKK: "丹麦克朗", PLN: "波兰兹罗提", CZK: "捷克克朗", HUF: "匈牙利福林", THB: "泰铢", IDR: "印尼盾", MYR: "马来西亚林吉特", PHP: "菲律宾比索", ILS: "以色列谢克尔", ISK: "冰岛克朗", RON: "罗马尼亚列伊", BGN: "保加利亚列弗" };
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="bg-[#03070c]">
        <SectionHead title="官方参考汇率（1 美元兑）" sub={d?.date} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">货币</th><th className="text-right">汇率</th><th className="text-right">近一月</th><th className="px-2">走势</th></tr></thead>
          <tbody>
            {d && Object.entries(d.rates).map(([c, v]) => {
              const h = d.history[c] ?? [];
              const chg = h.length > 1 ? ((v / h[0]) - 1) * 100 : null;
              return <tr key={c} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{c} <span className="text-slate-500">{NAMES[c] ?? ""}</span></td><td className="text-right font-mono text-slate-100">{v >= 100 ? v.toFixed(2) : v.toFixed(4)}</td><td className="text-right font-mono" style={{ color: toneOf(chg == null ? null : -chg) }}>{fmtPct(chg == null ? null : -chg)}</td><td className="px-2"><Spark values={h.map((x) => 1 / x)} width={90} height={14} /></td></tr>;
            })}
          </tbody>
        </table>
        <div className="px-2 py-1 text-[10px] text-slate-500">“近一月”为该货币对美元的升（红）贬（绿）幅度</div>
      </div>
      <div className="bg-[#03070c]">
        <SectionHead title="政策利率" />
        {(d?.policy ?? []).map((p) => <div key={p.bank} className="flex justify-between border-b border-[#0f1b29] px-2 py-1.5 text-[11px]"><span className="text-slate-300">{p.bank}</span><span className="font-mono text-white">{p.rate == null ? "—" : `${p.rate.toFixed(2)}%`}<span className="ml-2 text-[10px] text-slate-500">{p.date}</span></span></div>)}
        {d && d.policy.length === 2 && d.policy[0].rate != null && d.policy[1].rate != null && <div className="px-2 py-1.5 text-[11px] text-slate-400">美欧利差 <b className="font-mono" style={{ color: d.policy[0].rate - d.policy[1].rate > 0 ? UP : DOWN }}>{((d.policy[0].rate - d.policy[1].rate) * 100).toFixed(0)}bp</b>（利差越大越支撑美元）</div>}
      </div>
    </div>
  );
}

export default function FxTerminal() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "board");
  const feed = useFeed(func === "news" ? { cats: ["外汇"], limit: 120, hours: 72 } : null);
  return (
    <HubShell title="外汇中心" code="FX" funcs={FUNCS} func={func} setFunc={setFunc}>
      {func === "board" && <LiveBoard rows={BOARD} />}
      {func === "matrix" && <FxcLive />}
      {func === "strength" && <Strength />}
      {func === "cot" && <CotView filter={(s) => ["EURUSD", "USDJPY", "GBPUSD", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD", "USDMXN", "DXY", "BTC"].includes(s)} />}
      {func === "ref" && <RefRates />}
      {func === "news" && (
        <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-2">
          <div className="min-w-0 bg-[#03070c]"><SectionHead title="外汇新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></div>
          <div className="min-w-0 bg-[#03070c]"><EconCalendar /></div>
        </div>
      )}
    </HubShell>
  );
}
