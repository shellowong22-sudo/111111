/**
 * 直通式处理（STP）小窗功能 —— 第四组：DTCP 净额交收（逐证券轧差）。
 * 角度：同一交收日、同一证券的买卖先轧差，只交付净数量、只划转净资金；
 * 与 FXSS（按币种轧差资金）、交收日历（按市场汇总资金）互不重复。
 * 数据：平台自有成交记录（永久入库）+ 实时行情 + 参考汇率；无成交时显示空状态与下单票据。
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Kpis, SectionHead } from "@/uc/panels/kit";
import { useFills, type Fill } from "@/uc/trade/kit";
import { DNC, Frame, NoTrades, Pick, TH, TR, UPC, cashOf, mktName, toCny, useFx, weekdayZh, type P } from "@/components/live/STPLive";

type Line = { date: string; market: string; symbol: string; ccy: string; bq: number; sq: number; bn: number; sn: number; gross: number; net: number; n: number; settled: boolean };

function build(fills: Fill[]) {
  const m = new Map<string, Line>();
  for (const f of fills) {
    const k = `${f.settleDate}|${f.symbol}`;
    const g = m.get(k) ?? { date: f.settleDate, market: f.market, symbol: f.symbol, ccy: f.ccy, bq: 0, sq: 0, bn: 0, sn: 0, gross: 0, net: 0, n: 0, settled: f.settled };
    if (f.side === "B") { g.bq += f.qty; g.bn += f.notional; } else { g.sq += f.qty; g.sn += f.notional; }
    g.gross += Math.abs(cashOf(f));
    g.net += cashOf(f);
    g.n++;
    g.settled = g.settled && f.settled;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.net) - Math.abs(a.net));
}

const eff = (gross: number, net: number) => (gross > 0 ? (1 - Math.abs(net) / gross) * 100 : null);

export function StpNET({ onClose }: P) {
  const f = useFills();
  const fx = useFx();
  const fills = f.data ?? [];
  const [scope, setScope] = useState<"PEND" | "ALL">("PEND");
  const used = useMemo(() => (scope === "PEND" ? fills.filter((x) => !x.settled) : fills), [fills, scope]);
  const lines = useMemo(() => build(used), [used]);
  const syms = useMemo(() => [...new Set(lines.map((l) => l.symbol))].slice(0, 60), [lines]);
  const t = useTicks(syms);
  const cny = (v: number, c: string) => toCny(v, c, fx.data) ?? 0;
  const gross = lines.reduce((s, l) => s + cny(l.gross, l.ccy), 0);
  const netAbs = lines.reduce((s, l) => s + Math.abs(cny(l.net, l.ccy)), 0);
  const netSigned = lines.reduce((s, l) => s + cny(l.net, l.ccy), 0);
  const instr = lines.filter((l) => l.bq !== l.sq).length;
  const byDate = useMemo(() => {
    const d = new Map<string, { date: string; n: number; lines: number; gross: number; net: number; zero: number }>();
    for (const l of lines) {
      const g = d.get(l.date) ?? { date: l.date, n: 0, lines: 0, gross: 0, net: 0, zero: 0 };
      g.n += l.n; g.lines++; g.gross += cny(l.gross, l.ccy); g.net += Math.abs(cny(l.net, l.ccy)); if (l.bq === l.sq) g.zero++;
      d.set(l.date, g);
    }
    return [...d.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  }, [lines, fx.data]);
  const e = eff(gross, netAbs);
  return (
    <Frame code="DTCP" title="净额交收（逐证券轧差）" onClose={onClose} right={<Seg value={scope} options={[["PEND", "待交收"], ["ALL", "全部（含已交收）"]]} onChange={setScope} />}>
      <Kpis items={[
        ["成交笔数 → 交收指令", `${used.length} → ${instr}`, "同日同券买卖轧差后，净数量为零的不再生成交付指令"],
        ["全额资金划转", fmtCompact(gross), "逐笔全额收付合计，折合人民币"],
        ["轧差后资金划转", <span style={{ color: toneOf(netSigned) }}>{fmtCompact(netAbs)}</span>, `净方向 ${netSigned >= 0 ? "应收" : "应付"} ${fmtCompact(Math.abs(netSigned))}`],
        ["轧差效率", e == null ? "—" : `${e.toFixed(1)}%`],
      ]} />
      {!used.length ? <NoTrades loading={f.loading && !f.data} what={scope === "PEND" ? "当前没有待交收成交。同一交收日内对同一证券既有买入又有卖出时，这里会把两边轧差，只交付净数量。" : "暂无成交记录。成交后按交收日与证券逐一轧差。"} strategy="DTCP" /> : <>
        <SectionHead title="交收指令（交收日 × 证券）" sub="净数量为正表示应收券，为负表示应交券；资金含佣金与税费" />
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">交收日</th><th className="text-left">证券</th><th className="text-left">市场</th><th className="text-right">笔数</th><th className="text-right">买入量</th><th className="text-right">卖出量</th><th className="text-right">净交付</th><th className="text-right">最新价</th><th className="text-right">全额资金</th><th className="text-right">净资金</th><th className="text-right">轧差效率</th><th className="px-2 text-left">状态</th></tr></thead>
            <tbody>{lines.map((l) => { const nq = l.bq - l.sq; const le = eff(l.gross, Math.abs(l.net)); return (
              <tr key={`${l.date}${l.symbol}`} className={TR}>
                <td className="px-2 py-0.5 font-mono text-slate-300">{l.date}<span className="ml-1 text-[9px] text-slate-600">周{weekdayZh(l.date)}</span></td>
                <td className="text-slate-100"><Pick s={l.symbol}>{t[l.symbol]?.name ?? l.symbol}</Pick><span className="ml-1 font-mono text-[9px] text-slate-600">{l.symbol}</span></td>
                <td className="text-slate-400">{mktName(l.market)}</td>
                <td className="text-right font-mono text-slate-400">{l.n}</td>
                <td className="text-right font-mono" style={{ color: l.bq ? UPC : "#334155" }}>{l.bq || "—"}</td>
                <td className="text-right font-mono" style={{ color: l.sq ? DNC : "#334155" }}>{l.sq || "—"}</td>
                <td className="text-right font-mono text-white">{nq === 0 ? <span className="text-slate-500">轧平</span> : nq > 0 ? `收 ${nq}` : `交 ${-nq}`}</td>
                <td className="text-right font-mono text-slate-300">{fmtPrice(t[l.symbol]?.price)}</td>
                <td className="text-right font-mono text-slate-400">{fmtCompact(l.gross)} <span className="text-[9px] text-slate-600">{l.ccy}</span></td>
                <td className="text-right font-mono" style={{ color: toneOf(l.net) }}>{fmtCompact(l.net)}</td>
                <td className="text-right font-mono text-amber-200">{le == null ? "—" : `${le.toFixed(0)}%`}</td>
                <td className="px-2" style={{ color: l.settled ? "#34d399" : "#fbbf24" }}>{l.settled ? "已交收" : "待交收"}</td>
              </tr>); })}</tbody>
          </table>
        </div>
        <SectionHead title="各交收日轧差效果" sub="效率越高，实际需要划转的资金与证券越少" />
        <table className="w-full text-[11px]">
          <thead className={TH}><tr><th className="px-2 py-1 text-left">交收日</th><th className="text-right">成交笔数</th><th className="text-right">交收指令</th><th className="text-right">轧平证券</th><th className="text-right">全额（人民币）</th><th className="text-right">净额（人民币）</th><th className="px-2 text-left">轧差效率</th></tr></thead>
          <tbody>{byDate.map((g) => { const ge = eff(g.gross, g.net) ?? 0; return (
            <tr key={g.date} className={TR}>
              <td className="px-2 py-0.5 font-mono text-slate-300">{g.date}</td>
              <td className="text-right font-mono text-slate-400">{g.n}</td>
              <td className="text-right font-mono">{g.lines - g.zero}</td>
              <td className="text-right font-mono text-slate-400">{g.zero}</td>
              <td className="text-right font-mono text-slate-300">{fmtCompact(g.gross)}</td>
              <td className="text-right font-mono text-white">{fmtCompact(g.net)}</td>
              <td className="px-2"><div className="flex items-center gap-2"><div className="h-2 w-32 bg-[#0a1726]"><div className="h-2 bg-sky-400/70" style={{ width: `${Math.max(0, Math.min(100, ge))}%` }} /></div><span className="font-mono text-amber-200">{ge.toFixed(1)}%</span></div></td>
            </tr>); })}</tbody>
        </table>
      </>}
    </Frame>
  );
}
