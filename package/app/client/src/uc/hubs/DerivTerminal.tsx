/**
 * 衍生品中心（/derivatives-trader）：期权链（希腊值 / 隐含波动率）· 波动率曲面（期限结构 + 微笑）· 持仓分布（最大痛点 / 伽马敞口）· 异动期权 · 期货看板 · 波动率指数 · 机构持仓。
 */
import { useState } from "react";
import { DOWN, UP, fmtCompact, fmtPct, fmtPrice, toneOf, usePolled } from "@/uc/market/live";
import { FeedList, SectionHead, Seg, useFeed } from "@/uc/news/kit";
import { Bars, HubShell, LiveBoard, Lines, useHub, type BoardRow } from "./kit";
import { CotView } from "./FxTerminal";

type Opt = { strike: number; type: "C" | "P"; bid: number; ask: number; last: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; volume: number };
type Chain = {
  symbol: string; timestamp: string | null; spot: number; change: number; changePct: number; iv30: number; iv30Change: number;
  expiries: string[]; expiry: string; chain: Array<{ strike: number; call: Opt | null; put: Opt | null }>; maxPain: number; gex: Array<{ strike: number; gex: number }>;
  stats: { callVolume: number; putVolume: number; callOi: number; putOi: number; pcVolumeAll: number; pcOiAll: number; atmIv: number | null; skew25: number | null; netGex: number; totalContracts: number };
  term: Array<{ exp: string; iv: number | null; oi: number }>;
  unusual: Array<Opt & { exp: string }>;
};
const FUNCS: Array<[string, string, string]> = [["chain", "OMON", "期权链"], ["vol", "SKEW", "波动率曲面"], ["oi", "OI", "持仓分布与伽马"], ["flow", "UOA", "异动期权"], ["fut", "FUT", "期货看板"], ["vix", "VIX", "波动率指数"], ["cot", "COT", "机构持仓"], ["news", "DN", "衍生品新闻"]];
const UNDERLYINGS = ["SPY", "QQQ", "^GSPC", "IWM", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "AMD", "TLT", "GLD", "^VIX"];
const FUT: BoardRow[] = [
  ...["ES", "NQ", "YM", "RTY", "NKD"].map((s) => ({ symbol: s, group: "股指期货" })),
  ...["ZT", "ZF", "ZN", "ZB"].map((s) => ({ symbol: s, group: "利率期货" })),
  ...["CL", "BRENT", "NG", "GC", "SI", "HG", "PL"].map((s) => ({ symbol: s, group: "商品期货" })),
  ...["ZC", "ZS", "ZW"].map((s) => ({ symbol: s, group: "农产品期货" })),
];
const VIXB: BoardRow[] = [["^VIX9D", "9日VIX"], ["^VIX", "VIX"], ["^VIX3M", "3个月VIX"], ["^VIX6M", "6个月VIX"], ["^VVIX", "VIX的波动率"], ["^SKEW", "尾部风险SKEW"], ["^MOVE", "美债波动率MOVE"]].map(([s, l]) => ({ symbol: s, label: l }));

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function ChainView({ c }: { c: Chain }) {
  const [range, setRange] = useState("20");
  const atm = c.chain.reduce((best, r) => (Math.abs(r.strike - c.spot) < Math.abs(best - c.spot) ? r.strike : best), c.chain[0]?.strike ?? 0);
  const i0 = c.chain.findIndex((r) => r.strike === atm);
  const n = Number(range);
  const rows = n ? c.chain.slice(Math.max(0, i0 - n), i0 + n + 1) : c.chain;
  const cell = (o: Opt | null, k: keyof Opt, f: (v: number) => string = (v) => v.toFixed(2)) => (o && Number(o[k]) ? f(Number(o[k])) : "—");
  return (
    <div>
      <SectionHead title={`期权链 · 到期 ${c.expiry}`} sub={`标的 ${fmtPrice(c.spot)}（${fmtPct(c.changePct)}）· 最大痛点 ${c.maxPain}`} right={<Seg value={range} onChange={setRange} options={[["10", "平值±10"], ["20", "±20"], ["40", "±40"], ["0", "全部"]]} />} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-[10.5px]">
          <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500">
            <tr><th colSpan={7} className="border-r border-[#1a2a3c] py-0.5 text-center text-red-300">看涨 CALL</th><th className="bg-[#101e2e] text-center">行权价</th><th colSpan={7} className="border-l border-[#1a2a3c] text-center text-emerald-300">看跌 PUT</th></tr>
            <tr>{["持仓", "成交", "隐波", "Delta", "Gamma", "买价", "卖价"].map((h) => <th key={`c${h}`} className="px-1 text-right">{h}</th>)}<th className="bg-[#101e2e]" />{["买价", "卖价", "Delta", "Gamma", "隐波", "成交", "持仓"].map((h) => <th key={`p${h}`} className="px-1 text-right">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const itmC = r.strike < c.spot;
              return (
                <tr key={r.strike} className={`border-t border-[#0f1b29] ${r.strike === atm ? "outline outline-1 outline-amber-500/60" : ""}`}>
                  <td className={`px-1 text-right font-mono ${itmC ? "bg-red-500/[0.06]" : ""}`}>{cell(r.call, "oi", (v) => fmtCompact(v))}</td>
                  <td className={`px-1 text-right font-mono ${itmC ? "bg-red-500/[0.06]" : ""}`}>{cell(r.call, "volume", (v) => fmtCompact(v))}</td>
                  <td className={`px-1 text-right font-mono text-amber-200 ${itmC ? "bg-red-500/[0.06]" : ""}`}>{cell(r.call, "iv", pct)}</td>
                  <td className={`px-1 text-right font-mono ${itmC ? "bg-red-500/[0.06]" : ""}`}>{cell(r.call, "delta")}</td>
                  <td className={`px-1 text-right font-mono ${itmC ? "bg-red-500/[0.06]" : ""}`}>{cell(r.call, "gamma", (v) => v.toFixed(4))}</td>
                  <td className={`px-1 text-right font-mono text-red-300 ${itmC ? "bg-red-500/[0.06]" : ""}`}>{cell(r.call, "bid")}</td>
                  <td className={`border-r border-[#1a2a3c] px-1 text-right font-mono text-red-300 ${itmC ? "bg-red-500/[0.06]" : ""}`}>{cell(r.call, "ask")}</td>
                  <td className={`bg-[#101e2e] px-2 text-center font-mono font-semibold ${r.strike === c.maxPain ? "text-amber-300" : "text-white"}`}>{r.strike}</td>
                  <td className={`border-l border-[#1a2a3c] px-1 text-right font-mono text-emerald-300 ${!itmC ? "bg-emerald-500/[0.06]" : ""}`}>{cell(r.put, "bid")}</td>
                  <td className={`px-1 text-right font-mono text-emerald-300 ${!itmC ? "bg-emerald-500/[0.06]" : ""}`}>{cell(r.put, "ask")}</td>
                  <td className={`px-1 text-right font-mono ${!itmC ? "bg-emerald-500/[0.06]" : ""}`}>{cell(r.put, "delta")}</td>
                  <td className={`px-1 text-right font-mono ${!itmC ? "bg-emerald-500/[0.06]" : ""}`}>{cell(r.put, "gamma", (v) => v.toFixed(4))}</td>
                  <td className={`px-1 text-right font-mono text-amber-200 ${!itmC ? "bg-emerald-500/[0.06]" : ""}`}>{cell(r.put, "iv", pct)}</td>
                  <td className={`px-1 text-right font-mono ${!itmC ? "bg-emerald-500/[0.06]" : ""}`}>{cell(r.put, "volume", (v) => fmtCompact(v))}</td>
                  <td className={`px-1 text-right font-mono ${!itmC ? "bg-emerald-500/[0.06]" : ""}`}>{cell(r.put, "oi", (v) => fmtCompact(v))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VolView({ c }: { c: Chain }) {
  const smile = c.chain.filter((r) => Math.abs(r.strike / c.spot - 1) < 0.25);
  return (
    <div>
      <SectionHead title="隐含波动率期限结构（平值）" sub={`30日隐波 ${c.iv30.toFixed(2)}（${c.iv30Change >= 0 ? "+" : ""}${c.iv30Change.toFixed(2)}）· 25Delta 偏度 ${c.stats.skew25 == null ? "—" : pct(c.stats.skew25)}`} />
      <Lines series={[{ name: "平值隐波", color: "#fbbf24", values: c.term.map((t) => (t.iv == null ? null : t.iv * 100)) }]} xLabels={c.term.map((t) => t.exp.slice(5))} fmt={(v) => `${v.toFixed(1)}%`} height={190} />
      <SectionHead title={`波动率微笑 · ${c.expiry}`} sub="横轴为行权价，标的价附近 ±25%" />
      <Lines series={[{ name: "看涨隐波", color: "#f2495c", values: smile.map((r) => (r.call?.iv ? r.call.iv * 100 : null)) }, { name: "看跌隐波", color: "#1fbf75", values: smile.map((r) => (r.put?.iv ? r.put.iv * 100 : null)) }]} xLabels={smile.map((r) => String(r.strike))} fmt={(v) => `${v.toFixed(1)}%`} height={210} />
      <div className="px-2 py-1 text-[10px] text-slate-500">看跌隐波高于看涨（左侧翘起）说明市场为下跌保护付出溢价；期限结构倒挂（近月高于远月）通常出现在恐慌时期。</div>
    </div>
  );
}

function OiView({ c }: { c: Chain }) {
  const near = c.chain.filter((r) => Math.abs(r.strike / c.spot - 1) < 0.15);
  const gex = c.gex.filter((g) => Math.abs(g.strike / c.spot - 1) < 0.15);
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-[#1a2a3c] px-3 py-2 text-[11px] sm:grid-cols-4">
        <div><div className="text-slate-500">看跌/看涨 成交比</div><div className="font-mono text-[16px] text-white">{c.stats.pcVolumeAll.toFixed(2)}</div></div>
        <div><div className="text-slate-500">看跌/看涨 持仓比</div><div className="font-mono text-[16px] text-white">{c.stats.pcOiAll.toFixed(2)}</div></div>
        <div><div className="text-slate-500">最大痛点</div><div className="font-mono text-[16px] text-amber-300">{c.maxPain}</div></div>
        <div><div className="text-slate-500">净伽马敞口（每1%）</div><div className="font-mono text-[16px]" style={{ color: c.stats.netGex >= 0 ? UP : DOWN }}>{fmtCompact(c.stats.netGex)}</div></div>
      </div>
      <SectionHead title="各行权价持仓量" sub={`${c.expiry} · 红为看涨，绿为看跌`} />
      <Bars data={near.map((r) => ({ k: String(r.strike), v: r.call?.oi ?? 0, v2: r.put?.oi ?? 0 }))} label={["看涨持仓", "看跌持仓"]} height={170} />
      <SectionHead title="伽马敞口分布" sub="正值区间做市商对冲会抑制波动，负值区间会放大波动" />
      <Bars data={gex.map((g) => ({ k: String(g.strike), v: g.gex }))} height={170} />
    </div>
  );
}

function FlowView({ c }: { c: Chain }) {
  return (
    <div>
      <SectionHead title="异动期权" sub="成交量远超持仓量的合约（新开仓资金）" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">到期</th><th className="text-left">类型</th><th className="text-right">行权价</th><th className="text-right">成交</th><th className="text-right">持仓</th><th className="text-right">量/仓</th><th className="text-right">隐波</th><th className="text-right">Delta</th><th className="px-2 text-right">最新价</th></tr></thead>
        <tbody>
          {c.unusual.map((o) => (
            <tr key={`${o.exp}${o.type}${o.strike}`} className="border-t border-[#0f1b29]">
              <td className="px-2 py-1 font-mono text-slate-300">{o.exp}</td>
              <td style={{ color: o.type === "C" ? UP : DOWN }}>{o.type === "C" ? "看涨" : "看跌"}</td>
              <td className="text-right font-mono text-white">{o.strike}</td>
              <td className="text-right font-mono text-amber-200">{fmtCompact(o.volume)}</td>
              <td className="text-right font-mono text-slate-400">{fmtCompact(o.oi)}</td>
              <td className="text-right font-mono text-orange-300">{o.oi ? (o.volume / o.oi).toFixed(1) : "新"}</td>
              <td className="text-right font-mono">{pct(o.iv)}</td>
              <td className="text-right font-mono">{o.delta.toFixed(2)}</td>
              <td className="px-2 text-right font-mono">{o.last.toFixed(2)}</td>
            </tr>
          ))}
          {!c.unusual.length && <tr><td colSpan={9} className="px-2 py-6 text-center text-slate-500">今天还没有明显的异动合约</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PickButton({ symbol }: { symbol: string }) {
  const { pick } = useHub();
  return <button type="button" onClick={() => pick(symbol)} className="text-cyan-300 hover:text-white">标的K线</button>;
}

export default function DerivTerminal() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "chain");
  const [sym, setSym] = useState("SPY");
  const [exp, setExp] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const needsChain = ["chain", "vol", "oi", "flow"].includes(func);
  const chain = usePolled<Chain | null>("ucHubs.options", needsChain ? { symbol: sym, expiry: exp } : null, 60_000);
  const feed = useFeed(func === "news" ? { q: undefined, cats: ["美股"], limit: 100, hours: 48 } : null);
  const c = chain.data;
  return (
    <HubShell title="衍生品中心" code="DRV" funcs={FUNCS} func={func} setFunc={setFunc}>
      {needsChain && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1 text-[10px]">
          <span className="text-slate-400">标的</span>
          <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { setSym(input.trim()); setExp(undefined); setInput(""); } }} placeholder="美股 / ETF / 指数代码" className="h-5 w-[140px] border border-[#1d3047] bg-[#050b13] px-1.5 font-mono text-slate-100 outline-none" />
          {UNDERLYINGS.map((s) => <button key={s} type="button" onClick={() => { setSym(s); setExp(undefined); }} className={s === sym ? "text-cyan-200" : "text-slate-500 hover:text-slate-200"}>{s}</button>)}
          {c && <select value={c.expiry} onChange={(e) => setExp(e.target.value)} className="ml-auto h-5 border border-[#1d3047] bg-[#050b13] text-slate-100">{c.expiries.map((e) => <option key={e} value={e}>{e}</option>)}</select>}
          {c && <PickButton symbol={sym} />}
        </div>
      )}
      {needsChain && !c && <div className="px-3 py-10 text-center text-[11px] text-slate-500">{chain.loading ? "期权链读取中（合约较多，首次约需数秒）…" : "该标的暂无期权数据（目前覆盖美国上市期权）"}</div>}
      {c && func === "chain" && <ChainView c={c} />}
      {c && func === "vol" && <VolView c={c} />}
      {c && func === "oi" && <OiView c={c} />}
      {c && func === "flow" && <FlowView c={c} />}
      {func === "fut" && <LiveBoard rows={FUT} />}
      {func === "vix" && <div><LiveBoard rows={VIXB} /><div className="px-2 py-2 text-[10px] text-slate-500">9日 → 3个月 → 6个月 VIX 依次走高为正常结构；短端高于长端（倒挂）代表市场恐慌。</div></div>}
      {func === "cot" && <CotView filter={(x) => ["ES", "NQ", "RTY", "YM", "^VIX", "BTC"].includes(x)} />}
      {func === "news" && <div><SectionHead title="衍生品与市场新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></div>}
    </HubShell>
  );
}
