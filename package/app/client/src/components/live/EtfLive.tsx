/**
 * ETF 交易型开放式指数基金：股票 / 海外 / 行业主题 / 商品 / A 股 / 港股 ETF 的行情与风险画像。
 *  - 行情：实时价格、涨跌、成交额、52 周区间位置
 *  - 表现与风险：1 月 / 3 月 / 年初至今 / 1 年收益、年化波动、最大回撤、对标普 500 的贝塔与相关
 *  - 类别路径：同组 ETF 以共同起点为 100 的价格路径
 * 固定收益 ETF 在 WETF，成交额与资金方向在 TFLO，此处不重复。
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, drawdown, f2, perf, rets, sgn, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose?: () => void };
type E = { s: string; l: string; g: string };
const U: E[] = [
  { s: "SPY", l: "标普 500", g: "美国宽基" }, { s: "QQQ", l: "纳斯达克 100", g: "美国宽基" }, { s: "IWM", l: "罗素 2000", g: "美国宽基" }, { s: "DIA", l: "道琼斯", g: "美国宽基" }, { s: "VTI", l: "美国全市场", g: "美国宽基" },
  { s: "EFA", l: "发达市场（除美）", g: "海外市场" }, { s: "EEM", l: "新兴市场", g: "海外市场" }, { s: "VGK", l: "欧洲", g: "海外市场" }, { s: "EWJ", l: "日本", g: "海外市场" }, { s: "MCHI", l: "中国（MSCI）", g: "海外市场" }, { s: "INDA", l: "印度", g: "海外市场" },
  { s: "SMH", l: "半导体", g: "行业主题" }, { s: "XLK", l: "信息技术", g: "行业主题" }, { s: "XLF", l: "金融", g: "行业主题" }, { s: "XLE", l: "能源", g: "行业主题" }, { s: "ARKK", l: "颠覆式创新", g: "行业主题" }, { s: "ITB", l: "住宅建筑", g: "行业主题" },
  { s: "GLD", l: "黄金", g: "商品" }, { s: "SLV", l: "白银", g: "商品" }, { s: "USO", l: "原油", g: "商品" }, { s: "UNG", l: "天然气", g: "商品" }, { s: "DBC", l: "综合商品", g: "商品" },
  { s: "sh510300", l: "沪深 300 ETF", g: "A股 ETF" }, { s: "sh510500", l: "中证 500 ETF", g: "A股 ETF" }, { s: "sz159915", l: "创业板 ETF", g: "A股 ETF" }, { s: "sh588000", l: "科创 50 ETF", g: "A股 ETF" }, { s: "sh512880", l: "证券 ETF", g: "A股 ETF" }, { s: "sh512480", l: "半导体 ETF", g: "A股 ETF" },
  { s: "2800.HK", l: "盈富基金", g: "港股 ETF" }, { s: "3033.HK", l: "恒生科技 ETF", g: "港股 ETF" }, { s: "2828.HK", l: "恒生国企 ETF", g: "港股 ETF" },
];
const GROUPS = ["全部", "美国宽基", "海外市场", "行业主题", "商品", "A股 ETF", "港股 ETF"];
const COLORS = ["#22d3ee", "#f5b942", "#a78bfa", "#f472b6", "#34d399", "#f97316"];
const TH = "px-2 py-1 text-right font-normal";
const THL = "px-2 py-1 text-left font-normal";
const TD = "px-2 py-0.5 text-right font-mono";

export function EtfLive({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const [grp, setGrp] = useState("全部");
  const syms = U.map((u) => u.s);
  const t = useTicks(syms);
  const pack = useCloses(syms, 270);
  const { pick } = useHub();
  const shown = U.filter((u) => grp === "全部" || u.g === grp);

  const stats = useMemo(() => {
    const out: Record<string, { p1m: number | null; p3m: number | null; ytd: number | null; p1y: number | null; vol: number | null; mdd: number | null; hi: number | null; lo: number | null; beta: number | null; rho: number | null }> = {};
    const spy = pack.data?.SPY ?? [];
    for (const u of U) {
      const raw = pack.data?.[u.s] ?? [];
      if (raw.length < 30) continue;
      const c = raw.map((x) => x[1]);
      const dates = raw.map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10));
      const last = c.slice(-252);
      let beta: number | null = null, rho: number | null = null;
      if (spy.length > 30 && u.s !== "SPY") {
        const { m } = align({ [u.s]: raw, SPY: spy }, [u.s, "SPY"]);
        const a = rets(m[u.s].slice(-253)), b = rets(m.SPY.slice(-253));
        rho = corr(a, b);
        const mb = b.reduce((s, x) => s + x, 0) / (b.length || 1), ma = a.reduce((s, x) => s + x, 0) / (a.length || 1);
        const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0), vb = b.reduce((s, x) => s + (x - mb) ** 2, 0);
        beta = vb ? cov / vb : null;
      } else if (u.s === "SPY") { beta = 1; rho = 1; }
      out[u.s] = { p1m: perf(c, 21), p3m: perf(c, 63), ytd: ytd(c, dates), p1y: perf(c, 252), vol: annVol(c, 252), mdd: drawdown(last).max, hi: Math.max(...last), lo: Math.min(...last), beta, rho };
    }
    return out;
  }, [pack.data]);

  const pathGroup = grp === "全部" ? "美国宽基" : grp;
  const pathSyms = U.filter((u) => u.g === pathGroup).map((u) => u.s);
  const paths = useMemo(() => {
    const { dates, m } = align(pack.data ?? null, pathSyms);
    return { dates, series: pathSyms.map((s, i) => ({ name: U.find((u) => u.s === s)?.l ?? s, color: COLORS[i % COLORS.length], values: (m[s] ?? []).map((v) => (v / m[s][0]) * 100) })) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.data, pathGroup]);

  return (
    <PanelShell code="ETF" title="交易型开放式指数基金" onClose={onClose} tabs={[["board", "行情"], ["risk", "表现与风险"], ["path", "类别路径"]]} tab={tab} setTab={setTab}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1">{GROUPS.map((g) => <button key={g} type="button" onClick={() => setGrp(g)} className={`border px-1.5 text-[10px] ${grp === g ? "border-cyan-500 bg-cyan-900/30 text-cyan-100" : "border-[#1d3047] text-slate-400 hover:text-slate-200"}`}>{g}</button>)}<span className="ml-auto text-[10px] text-slate-500">单击行看 K 线</span></div>

      {tab === "board" && (
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>ETF</th><th className={THL}>类别</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>成交额</th><th className={TH}>52 周低</th><th className={THL}>52 周区间位置</th><th className={TH}>52 周高</th><th className={TH}>距高点</th></tr></thead>
          <tbody>{shown.map((u) => { const k = t[u.s]; const st = stats[u.s]; const pos = st?.hi != null && st.lo != null && k?.price != null && st.hi > st.lo ? (k.price - st.lo) / (st.hi - st.lo) : null; const amt = k?.amount ?? (k?.volume != null ? k.volume * k.price : null); return (
            <tr key={u.s} onClick={() => pick(u.s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
              <td className="px-2 py-0.5 text-slate-100">{u.l}<span className="ml-1 font-mono text-[9px] text-slate-500">{u.s}</span></td>
              <td className="px-2 text-[10px] text-slate-500">{u.g}</td>
              <td className={`${TD} text-white`}>{fmtPrice(k?.price)}</td>
              <td className={TD} style={{ color: toneOf(k?.changePct) }}>{fmtPct(k?.changePct)}</td>
              <td className={`${TD} text-slate-300`}>{fmtCompact(amt)}</td>
              <td className={`${TD} text-slate-400`}>{fmtPrice(st?.lo)}</td>
              <td className="px-2"><div className="relative h-1.5 w-28 bg-[#13263a]">{pos != null && <div className="absolute top-[-2px] h-2.5 w-1 bg-cyan-300" style={{ left: `${Math.min(1, Math.max(0, pos)) * 100}%` }} />}</div></td>
              <td className={`${TD} text-slate-400`}>{fmtPrice(st?.hi)}</td>
              <td className={TD}>{st?.hi && k?.price ? f2((k.price / st.hi - 1) * 100, 1, "%") : "—"}</td>
            </tr>
          ); })}</tbody>
        </table>
      )}

      {tab === "risk" && (!Object.keys(stats).length ? <Empty loading={pack.loading} /> : (
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>ETF</th><th className={TH}>1 月</th><th className={TH}>3 月</th><th className={TH}>年初至今</th><th className={TH}>1 年</th><th className={TH}>年化波动</th><th className={TH}>1 年最大回撤</th><th className={TH}>收益 / 波动</th><th className={TH}>对标普贝塔</th><th className={TH}>对标普相关</th></tr></thead>
          <tbody>{shown.map((u) => { const st = stats[u.s]; return (
            <tr key={u.s} onClick={() => pick(u.s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
              <td className="px-2 py-0.5 text-slate-100">{u.l}<span className="ml-1 font-mono text-[9px] text-slate-500">{u.s}</span></td>
              {[st?.p1m, st?.p3m, st?.ytd, st?.p1y].map((v, i) => <td key={i} className={TD} style={{ color: toneOf(v) }}>{sgn(v ?? null)}</td>)}
              <td className={`${TD} text-slate-300`}>{f2(st?.vol, 1, "%")}</td>
              <td className={TD} style={{ color: "#1fbf75" }}>{f2(st?.mdd, 1, "%")}</td>
              <td className={TD}>{st?.p1y != null && st.vol ? f2(st.p1y / st.vol, 2) : "—"}</td>
              <td className={TD}>{f2(st?.beta, 2)}</td>
              <td className={TD}>{f2(st?.rho, 2)}</td>
            </tr>
          ); })}</tbody>
        </table>
      ))}

      {tab === "path" && <>
        <SectionHead title={`${pathGroup} · 近一年价格路径`} sub={grp === "全部" ? "选择上方类别切换" : undefined} />
        {paths.dates.length > 2 ? <Lines series={paths.series} xLabels={paths.dates} height={260} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} text="该类别共同历史不足" />}
      </>}
    </PanelShell>
  );
}

export default EtfLive;
