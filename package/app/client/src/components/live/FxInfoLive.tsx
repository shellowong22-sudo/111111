/**
 * 外汇小窗（FXIP / ECMI / FXIV），全部接实时数据：
 *  - FXIP 外汇信息：实时汇率与官方参考汇率偏离、外汇快讯、深度文章、经济日历
 *  - ECMI 新兴市场货币与经济指标：新兴市场货币区间表现与波动、各国最新公布的经济数据、新兴市场风险资产
 *  - FXIV 外汇隐含波动：以挂牌货币 ETF 期权 30 日隐波推算各货币的预期波幅，对比货币对本身的实现波动
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, useFeed } from "@/uc/news/kit";
import EconCalendar from "@/uc/news/EconCalendar";
import { Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, f2, heat, perf, rets, rollingVol, sgn, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, ROW, TD, TDL, TH, THL, evTime, numOf, useCalendarSpan, type IvRow, type P } from "./LiveCommon";

/* ================================================================== FXIP 外汇信息 */
type FxRef = { date: string; rates: Record<string, number>; history: Record<string, number[]>; dates: string[]; policy: Array<{ bank: string; rate: number | null; date: string | null }> };
/** 货币对 → 参考汇率换算（参考汇率为 1 美元兑各币） */
const FXIP_PAIRS: Array<{ s: string; l: string; ccy: string; inv: boolean }> = [
  { s: "EURUSD", l: "欧元/美元", ccy: "EUR", inv: true }, { s: "USDJPY", l: "美元/日元", ccy: "JPY", inv: false }, { s: "GBPUSD", l: "英镑/美元", ccy: "GBP", inv: true },
  { s: "USDCNH", l: "美元/离岸人民币", ccy: "CNY", inv: false }, { s: "AUDUSD", l: "澳元/美元", ccy: "AUD", inv: true }, { s: "USDCAD", l: "美元/加元", ccy: "CAD", inv: false },
  { s: "USDCHF", l: "美元/瑞郎", ccy: "CHF", inv: false }, { s: "NZDUSD", l: "纽元/美元", ccy: "NZD", inv: true }, { s: "USDHKD", l: "美元/港币", ccy: "HKD", inv: false },
  { s: "USDSGD", l: "美元/新加坡元", ccy: "SGD", inv: false }, { s: "USDKRW", l: "美元/韩元", ccy: "KRW", inv: false }, { s: "USDINR", l: "美元/印度卢比", ccy: "INR", inv: false },
];

function FxipBody({ tab }: { tab: string }) {
  const ref = usePolled<FxRef>("ucHubs.fx", {}, 1800_000);
  const ticks = useTicks(["DXY", ...FXIP_PAIRS.map((p) => p.s)]);
  const flash = useFeed(tab === "news" ? { cats: ["外汇", "央行"], kind: "flash", limit: 120, hours: 48 } : null);
  const deep = useFeed(tab === "deep" ? { cats: ["外汇", "央行"], kind: "article", limit: 80, hours: 24 * 7 } : null);
  const { pick } = useHub();
  if (tab === "news") return <FeedList items={flash.items} loading={flash.loading} dense />;
  if (tab === "deep") return <FeedList items={deep.items} loading={deep.loading} />;
  if (tab === "cal") return <EconCalendar compact />;
  const d = ref.data;
  const refOf = (p: (typeof FXIP_PAIRS)[number], i?: number) => {
    const v = i == null ? d?.rates[p.ccy] : d?.history[p.ccy]?.[i];
    return v ? (p.inv ? 1 / v : v) : null;
  };
  const dx = ticks.DXY;
  return (
    <>
      <Kpis items={[["美元指数", fmtPrice(dx?.price), fmtPct(dx?.changePct)], ["美元/离岸人民币", fmtPrice(ticks.USDCNH?.price, 4), fmtPct(ticks.USDCNH?.changePct)], ["欧元/美元", fmtPrice(ticks.EURUSD?.price, 4), fmtPct(ticks.EURUSD?.changePct)], ["美元/日元", fmtPrice(ticks.USDJPY?.price, 3), fmtPct(ticks.USDJPY?.changePct)]]} />
      <SectionHead title="实时汇率 vs 官方参考汇率" sub={d ? `参考汇率日期 ${d.date}（欧洲央行每日定盘，人民币为在岸参考）` : "读取参考汇率…"} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>货币对</th><th className={TH}>实时</th><th className={TH}>今日</th><th className={TH}>参考汇率</th><th className={TH}>实时偏离</th><th className={TH}>约 1 月前参考</th><th className={TH}>1 月变化</th><th className="px-2">参考汇率走势</th></tr></thead>
        <tbody>
          {FXIP_PAIRS.map((p) => {
            const t = ticks[p.s];
            const r = refOf(p);
            const r0 = refOf(p, 0);
            const dev = t?.price && r ? (t.price / r - 1) * 100 : null;
            const ch = r && r0 ? (r / r0 - 1) * 100 : null;
            const digits = (t?.price ?? 1) > 20 ? 2 : 4;
            return (
              <tr key={p.s} onClick={() => pick(p.s)} className={`cursor-pointer ${ROW}`}>
                <td className={TDL}>{p.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{p.s}</span></td>
                <td className={`${TD} font-semibold`} style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price, digits)}</td>
                <td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
                <td className={`${TD} text-slate-300`}>{fmtPrice(r, digits)}</td>
                <td className={`${TD} text-amber-200`}>{sgn(dev, 2)}</td>
                <td className={`${TD} text-slate-500`}>{fmtPrice(r0, digits)}</td>
                <td className={TD} style={{ color: toneOf(ch) }}>{sgn(ch, 2)}</td>
                <td className="px-2"><MiniLine values={(d?.history[p.ccy] ?? []).map((v) => (p.inv ? 1 / v : v))} w={80} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Note>「实时偏离」= 实时汇率相对最近一次官方参考定盘价的偏离，可用于判断定盘后的市场走向；参考汇率每个工作日更新一次。</Note>
    </>
  );
}
export function FxipLive({ onClose }: P) {
  const [tab, setTab] = useState("ov");
  return <PanelShell code="FXIP" title="外汇信息" onClose={onClose} tabs={[["ov", "市场概览"], ["news", "外汇快讯"], ["deep", "深度文章"], ["cal", "经济日历"]]} tab={tab} setTab={setTab}><FxipBody tab={tab} /></PanelShell>;
}

/* ================================================================== ECMI 新兴市场货币与经济指标 */
const EM: Array<{ s: string; ccy: string; l: string; country: RegExp; zh: string }> = [
  { s: "USDCNH", ccy: "CNH", l: "离岸人民币", country: /^China$/, zh: "中国" },
  { s: "USDINR", ccy: "INR", l: "印度卢比", country: /^India$/, zh: "印度" },
  { s: "USDKRW", ccy: "KRW", l: "韩元", country: /Korea/, zh: "韩国" },
  { s: "USDTWD", ccy: "TWD", l: "新台币", country: /Taiwan/, zh: "中国台湾" },
  { s: "USDSGD", ccy: "SGD", l: "新加坡元", country: /Singapore/, zh: "新加坡" },
  { s: "USDTHB", ccy: "THB", l: "泰铢", country: /Thailand/, zh: "泰国" },
  { s: "USDBRL", ccy: "BRL", l: "巴西雷亚尔", country: /Brazil/, zh: "巴西" },
  { s: "USDMXN", ccy: "MXN", l: "墨西哥比索", country: /Mexico/, zh: "墨西哥" },
  { s: "USDZAR", ccy: "ZAR", l: "南非兰特", country: /South Africa/, zh: "南非" },
  { s: "USDTRY", ccy: "TRY", l: "土耳其里拉", country: /Turkey|Türkiye/, zh: "土耳其" },
];

function EcmiBody({ tab }: { tab: string }) {
  const syms = EM.map((e) => e.s);
  const pack = useCloses([...syms, "DXY", "EEM", "EMB", "CEW"], 400);
  const ticks = useTicks(syms);
  const cal = useCalendarSpan(tab === "eco" ? 14 : 0, 7);
  const { pick } = useHub();
  const { dates, m } = useMemo(() => align(pack.data ?? null, [...syms, "DXY"]), [pack.data]);
  // 本币兑美元方向：USDxxx 上涨 = 本币贬值，统一取负号
  const loc = (v: number | null) => (v == null ? null : -v);
  if (tab === "fx") {
    return (
      <>
        <SectionHead title="新兴市场货币（本币兑美元，正值 = 本币升值）" sub={dates.length ? `截至 ${dates[dates.length - 1]}` : undefined} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>货币</th><th className={TH}>美元兑本币</th><th className={TH}>今日</th><th className={TH}>1周</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>年初至今</th><th className={TH}>1年</th><th className={TH}>3月实波</th><th className={TH}>与美元指数相关</th></tr></thead>
          <tbody>
            {EM.map((e) => {
              const c = m[e.s] ?? [];
              const t = ticks[e.s];
              const rc = corr(rets(c.slice(-64)), rets((m.DXY ?? []).slice(-64)));
              return (
                <tr key={e.s} onClick={() => pick(e.s)} className={`cursor-pointer ${ROW}`}>
                  <td className={TDL}>{e.zh} · {e.l}</td>
                  <td className={`${TD} text-white`}>{fmtPrice(t?.price, (t?.price ?? 0) > 100 ? 2 : 4)}</td>
                  <td className={TD} style={{ color: toneOf(loc(t?.changePct ?? null)) }}>{sgn(loc(t?.changePct ?? null), 2)}</td>
                  {[[perf(c, 5), 2], [perf(c, 21), 4], [perf(c, 63), 8], [ytd(c, dates), 12], [perf(c, 252), 20]].map(([v, sc], i) => <td key={i} className={TD} style={{ background: heat(loc(v as number | null), sc as number) }}>{sgn(loc(v as number | null), 2)}</td>)}
                  <td className={`${TD} text-slate-300`}>{f2(annVol(c, 63), 1, "%")}</td>
                  <td className={`${TD} text-slate-400`}>{f2(rc, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!dates.length && <Empty loading={pack.loading} />}
      </>
    );
  }
  if (tab === "eco") {
    return (
      <>
        <SectionHead title="各国经济数据（近 14 天已公布 + 未来 7 天）" />
        {EM.map((e) => {
          const ev = cal.rows.filter((x) => e.country.test(x.country)).slice(-12);
          if (!ev.length) return null;
          return (
            <div key={e.s}>
              <div className="flex items-center justify-between bg-[#07111c] px-2 py-0.5 text-[10px]"><b className="text-cyan-300">{e.zh}</b><button type="button" onClick={() => pick(e.s)} className="font-mono text-slate-400 hover:text-white">{e.s} {sgn(loc(ticks[e.s]?.changePct ?? null), 2)}</button></div>
              <table className="w-full text-[11px]"><tbody>
                {ev.map((x) => {
                  const a = numOf(x.actual), c = numOf(x.consensus);
                  return (
                    <tr key={x.id} className={ROW}>
                      <td className="w-[86px] px-2 font-mono text-[10px] text-slate-500">{evTime(x)}</td>
                      <td className={TDL}><span className="mr-1 text-amber-300">{"★".repeat(x.importance)}</span>{x.nameZh || x.name}</td>
                      <td className={`${TD} ${x.actual ? "text-white" : "text-slate-600"}`}>{x.actual ?? "待公布"}</td>
                      <td className={`${TD} text-slate-400`}>{x.consensus ?? "—"}</td>
                      <td className={`${TD} text-slate-500`}>{x.previous ?? "—"}</td>
                      <td className={TD} style={{ color: a != null && c != null ? toneOf(a - c) : undefined }}>{a != null && c != null ? `${a - c > 0 ? "+" : ""}${+(a - c).toFixed(3)}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            </div>
          );
        })}
        {!cal.rows.some((x) => EM.some((e) => e.country.test(x.country))) && <Empty loading={cal.loading} text="近期暂无新兴市场经济数据" />}
        <Note>列依次为：时间、指标、实际、预期、前值、实际与预期之差。</Note>
      </>
    );
  }
  const R: Array<[string, string]> = [["EEM", "新兴市场股票"], ["EMB", "新兴市场美元主权债"], ["CEW", "新兴市场货币篮子"], ["DXY", "美元指数"]];
  const pr = (s: string) => (pack.data?.[s] ?? []).map((x) => x[1]);
  const cew = pr("CEW");
  const rv = rollingVol(cew, 20).slice(-250);
  return (
    <>
      <Kpis items={R.map(([s, l]) => [l, sgn(perf(pr(s), 21), 2), `1 月 · 3 月 ${sgn(perf(pr(s), 63), 1)}`] as [string, string, string])} />
      <SectionHead title="新兴市场货币篮子 20 日实现波动率（%）" sub="波动率抬升通常伴随资本外流与风险偏好下降" />
      <Lines series={[{ name: "货币篮子 20日实波", color: "#fbbf24", values: rv }]} height={150} />
      <SectionHead title="风险资产相对表现（近一年，起点为 100）" />
      <Lines series={R.map(([s, l], i) => { const c = pr(s).slice(-252); return { name: l, color: ["#38bdf8", "#a78bfa", "#fbbf24", "#94a3b8"][i], values: c.map((v) => (v / c[0]) * 100) }; })} height={170} />
    </>
  );
}
export function EcmiLive({ onClose }: P) {
  const [tab, setTab] = useState("fx");
  return <PanelShell code="ECMI" title="新兴市场货币与经济指标" onClose={onClose} tabs={[["fx", "货币表现"], ["eco", "经济数据"], ["risk", "风险资产"]]} tab={tab} setTab={setTab}><EcmiBody tab={tab} /></PanelShell>;
}

/* ================================================================== FXIV 外汇隐含波动 */
const FXIV_MAP: Array<{ etf: string; pair: string; l: string; inv: boolean; pip: number }> = [
  { etf: "FXE", pair: "EURUSD", l: "欧元", inv: false, pip: 0.0001 },
  { etf: "FXY", pair: "USDJPY", l: "日元", inv: true, pip: 0.01 },
  { etf: "FXB", pair: "GBPUSD", l: "英镑", inv: false, pip: 0.0001 },
  { etf: "FXA", pair: "AUDUSD", l: "澳元", inv: false, pip: 0.0001 },
  { etf: "FXC", pair: "USDCAD", l: "加元", inv: true, pip: 0.0001 },
  { etf: "UUP", pair: "DXY", l: "美元指数", inv: false, pip: 0.01 },
];

function FxivBody({ sel, setSel }: { sel: string; setSel: (s: string) => void }) {
  const iv = usePolled<IvRow[]>("ucHubs.ivScan", { symbols: FXIV_MAP.map((x) => x.etf) }, 300_000);
  const pack = useCloses(FXIV_MAP.map((x) => x.pair), 300);
  const ticks = useTicks(FXIV_MAP.map((x) => x.pair));
  const { pick } = useHub();
  const row = (etf: string) => (iv.data ?? []).find((r) => r.symbol === etf);
  const cur = FXIV_MAP.find((x) => x.pair === sel) ?? FXIV_MAP[2];
  const r = row(cur.etf);
  const c = (pack.data?.[cur.pair] ?? []).map((x) => x[1]);
  const S = ticks[cur.pair]?.price ?? c[c.length - 1] ?? null;
  const rv = (n: number) => annVol(c, n);
  const vol = r?.iv30 ?? null;
  const moves = S && vol ? [["1 日", 1 / 252], ["1 周", 5 / 252], ["2 周", 10 / 252], ["1 月", 21 / 252], ["3 月", 63 / 252]].map(([l, t]) => { const sd = S * (vol / 100) * Math.sqrt(t as number); return { l: l as string, sd, pips: sd / cur.pip, lo1: S - sd, hi1: S + sd, lo2: S - 2 * sd, hi2: S + 2 * sd }; }) : [];
  const rv20 = rollingVol(c, 20).slice(-250);
  const digits = (S ?? 1) > 20 ? 3 : 5;
  return (
    <>
      <div className="flex flex-wrap gap-1 px-2 py-1">{FXIV_MAP.map((x) => <button key={x.pair} type="button" onClick={() => setSel(x.pair)} className={`border px-2 py-0.5 text-[11px] ${sel === x.pair ? "border-cyan-500 bg-[#0d2236] text-white" : "border-[#1d3047] text-slate-400 hover:text-white"}`}>{x.l} <span className="font-mono text-[9px]">{x.pair}</span></button>)}</div>
      <Kpis items={[[`${cur.pair} 现价`, fmtPrice(S, digits), fmtPct(ticks[cur.pair]?.changePct)], ["30 日隐含波动", f2(vol, 2, "%"), r?.iv30Chg != null ? `日变化 ${sgn(r.iv30Chg, 2, "")}` : "取自对应货币 ETF 期权"], ["20 日实现波动", f2(rv(20), 2, "%"), `10 日 ${f2(rv(10), 2)} · 60 日 ${f2(rv(60), 2)}`], ["隐波 − 实波", vol != null && rv(20) != null ? sgn(vol - rv(20)!, 2, "") : "—", r?.ivRank != null ? `隐波排名 ${f2(r.ivRank, 0)} · 分位 ${f2(r.ivPct, 0)}` : "排名样本积累中"]]} />
      <SectionHead title="隐含波动推算的预期波幅" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>1σ 波幅</th><th className={TH}>点数</th><th className={TH}>68% 区间下沿</th><th className={TH}>68% 区间上沿</th><th className={TH}>95% 区间下沿</th><th className={TH}>95% 区间上沿</th></tr></thead>
        <tbody>{moves.map((x) => <tr key={x.l} className={ROW}><td className={TDL}>{x.l}</td><td className={`${TD} text-white`}>{x.sd.toFixed(digits)}</td><td className={`${TD} text-amber-200`}>{Math.round(x.pips).toLocaleString()}</td><td className={`${TD} text-slate-300`}>{x.lo1.toFixed(digits)}</td><td className={`${TD} text-slate-300`}>{x.hi1.toFixed(digits)}</td><td className={`${TD} text-slate-500`}>{x.lo2.toFixed(digits)}</td><td className={`${TD} text-slate-500`}>{x.hi2.toFixed(digits)}</td></tr>)}</tbody>
      </table>
      {!moves.length && <Empty loading={iv.loading || pack.loading} />}
      <SectionHead title={`${cur.pair} 20 日实现波动率（近一年）与当前隐波`} />
      <Lines series={[{ name: "20 日实波", color: "#38bdf8", values: rv20 }, ...(vol != null ? [{ name: "当前 30 日隐波", color: "#f2495c", values: rv20.map(() => vol), dash: true }] : [])]} height={150} />
      <SectionHead title="各货币隐波对比" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>货币</th><th className={TH}>30日隐波</th><th className={TH}>货币对20日实波</th><th className={TH}>溢价</th><th className={TH}>隐波排名</th><th className={TH}>1 周 1σ 点数</th></tr></thead>
        <tbody>{FXIV_MAP.map((x) => {
          const rr = row(x.etf);
          const cc = (pack.data?.[x.pair] ?? []).map((p) => p[1]);
          const s = ticks[x.pair]?.price ?? cc[cc.length - 1];
          const rv2 = annVol(cc, 20);
          const wk = s && rr?.iv30 ? (s * (rr.iv30 / 100) * Math.sqrt(5 / 252)) / x.pip : null;
          return <tr key={x.pair} onClick={() => { setSel(x.pair); pick(x.pair); }} className={`cursor-pointer ${ROW} ${sel === x.pair ? "bg-[#0d2236]" : ""}`}><td className={TDL}>{x.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.pair}</span></td><td className={`${TD} text-white`}>{f2(rr?.iv30, 2)}</td><td className={`${TD} text-slate-300`}>{f2(rv2, 2)}</td><td className={TD} style={{ background: heat(rr?.iv30 != null && rv2 != null ? rr.iv30 - rv2 : null, 4) }}>{rr?.iv30 != null && rv2 != null ? sgn(rr.iv30 - rv2, 2, "") : "—"}</td><td className={`${TD} text-slate-400`}>{f2(rr?.ivRank, 0)}</td><td className={`${TD} text-amber-200`}>{wk == null ? "—" : Math.round(wk).toLocaleString()}</td></tr>;
        })}</tbody>
      </table>
      <Note>货币的隐含波动率取自挂牌的对应货币 ETF 期权 30 日隐波（ETF 与货币对的波动率等价，方向相反不影响波幅）；预期波幅 = 现价 × 隐波 × √(天数/252)。</Note>
    </>
  );
}
export function FxivLive({ onClose, ticker }: P & { ticker?: string }) {
  const init = (ticker ?? "GBPUSD").toUpperCase().replace(/\s*CURNCY$/, "").replace(/[^A-Z]/g, "");
  const [sel, setSel] = useState(FXIV_MAP.some((x) => x.pair === init) ? init : "GBPUSD");
  return (
    <PanelShell code="FXIV" title="外汇隐含波动" onClose={onClose}>
      <FxivBody sel={sel} setSel={setSel} />
    </PanelShell>
  );
}
