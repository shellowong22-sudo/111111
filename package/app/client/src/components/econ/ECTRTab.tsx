/**
 * ECTR 贸易流量（全部真实数据，原占位 / 未接入的视图已移除）：
 *  - 贸易差额：世界银行各国贸易差额（WorldBankExistingView）
 *  - 美国贸易伙伴：按国别的进出口、差额与占比（年度官方统计）
 *  - 贸易量增速：IMF 各经济体商品与服务出口 / 进口实际增速（含预测年份）
 *  - 贸易敏感资产：航运、物流、工业金属与出口型市场的实时行情
 * 经常账户 / GDP 在 ECST（经济统计）中，不在此重复。
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { fmtCompact, toneOf, usePolled } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, LiveBoard, type BoardRow } from "@/uc/hubs/kit";
import { f2, sgn } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { WorldBankExistingView } from "./WorldBankExistingViews";

type Imf = { economies: Array<{ iso: string; name: string; region: string }>; indicators: Record<string, { label: string; data: Record<string, Array<{ y: number; v: number }>> }> };
const ROW = "border-t border-[#0f1b29] hover:bg-[#0a1726]";
const TH = "px-2 py-1 text-right font-normal";
const THL = "px-2 py-1 text-left font-normal";
const TD = "px-2 py-0.5 text-right font-mono";
const BOARD: BoardRow[] = [
  { symbol: "BDRY", label: "干散货运价 ETF", group: "航运" }, { symbol: "ZIM", label: "以星航运", group: "航运" }, { symbol: "MATX", label: "美森轮船", group: "航运" },
  { symbol: "FDX", label: "联邦快递", group: "物流" }, { symbol: "UPS", label: "联合包裹", group: "物流" },
  { symbol: "HG", label: "铜期货", group: "工业金属" }, { symbol: "ALI=F", label: "铝期货", group: "工业金属" },
  { symbol: "EWT", label: "台湾市场 ETF", group: "出口型市场" }, { symbol: "EWY", label: "韩国市场 ETF", group: "出口型市场" }, { symbol: "EWG", label: "德国市场 ETF", group: "出口型市场" }, { symbol: "EWW", label: "墨西哥市场 ETF", group: "出口型市场" },
  { symbol: "sh000001", label: "上证指数", group: "出口型市场" },
];

function Partners() {
  const q = trpc.legacyMarketData.getEctrTradePartners.useQuery({ refresh: false }, { staleTime: 6 * 3600_000, retry: false });
  const [sort, setSort] = useState<"balance" | "share" | "total">("total");
  const rows = (q.data?.rows ?? []).filter((r) => r.status === "available" && r.exports != null && r.imports != null);
  const sorted = [...rows].sort((a, b) => sort === "balance" ? (a.balance ?? 0) - (b.balance ?? 0) : sort === "share" ? (b.share ?? 0) - (a.share ?? 0) : ((b.exports ?? 0) + (b.imports ?? 0)) - ((a.exports ?? 0) + (a.imports ?? 0)));
  const totX = rows.reduce((s, r) => s + (r.exports ?? 0), 0), totM = rows.reduce((s, r) => s + (r.imports ?? 0), 0);
  return (
    <>
      <Kpis items={[["统计年度", q.data?.observationYear ? String(q.data.observationYear) : "—"], ["对列示伙伴出口", rows.length ? `${fmtCompact(totX * 1e9)} 美元` : "—"], ["自列示伙伴进口", rows.length ? `${fmtCompact(totM * 1e9)} 美元` : "—"], ["合计差额", rows.length ? <span style={{ color: toneOf(totX - totM) }}>{fmtCompact((totX - totM) * 1e9)} 美元</span> : "—"]]} />
      <div className="flex items-center gap-2 px-2 py-1"><Seg value={sort} options={[["total", "按贸易额"], ["balance", "按逆差"], ["share", "按占比"]]} onChange={setSort} /></div>
      {!rows.length ? <Empty loading={q.isLoading} text="贸易伙伴数据暂未更新" /> : <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>伙伴</th><th className={TH}>美国出口（十亿美元）</th><th className={TH}>美国进口</th><th className={TH}>差额</th><th className={TH}>贸易额</th><th className={TH}>占列示伙伴贸易额 %</th></tr></thead>
          <tbody>{sorted.map((r) => <tr key={r.partnerISO ?? r.partner} className={ROW}><td className="px-2 py-0.5 text-slate-100">{r.partner}</td><td className={TD}>{f2(r.exports, 1)}</td><td className={TD}>{f2(r.imports, 1)}</td><td className={TD} style={{ color: toneOf(r.balance) }}>{f2(r.balance, 1)}</td><td className={`${TD} text-white`}>{f2((r.exports ?? 0) + (r.imports ?? 0), 1)}</td><td className={TD}>{f2(r.share, 1)}</td></tr>)}</tbody>
        </table>
        <SectionHead title="美国对各伙伴贸易差额（十亿美元）" />
        <Bars data={sorted.map((r) => ({ k: r.partner, v: r.balance ?? 0 }))} fmt={(v) => v.toFixed(0)} height={150} />
      </>}
    </>
  );
}

function Volumes() {
  const imf = usePolled<Imf>("ucHubs.imf", { codes: ["TX_RPCH", "TM_RPCH"] }, 12 * 3600_000);
  const year = new Date().getFullYear();
  const rows = useMemo(() => {
    const d = imf.data; if (!d) return [];
    const x = d.indicators.TX_RPCH?.data ?? {}, m = d.indicators.TM_RPCH?.data ?? {};
    const at = (a: Array<{ y: number; v: number }> | undefined, y: number) => a?.find((p) => p.y === y)?.v ?? null;
    return d.economies.map((e) => ({ e, x0: at(x[e.iso], year - 1), x1: at(x[e.iso], year), x2: at(x[e.iso], year + 1), m0: at(m[e.iso], year - 1), m1: at(m[e.iso], year), m2: at(m[e.iso], year + 1) })).filter((r) => r.x1 != null || r.m1 != null);
  }, [imf.data, year]);
  return !rows.length ? <Empty loading={imf.loading} text="贸易量数据暂未更新" /> : (
    <>
      <SectionHead title="商品与服务贸易量实际增速（%）" sub={`${year - 1} 年为实际值，${year} / ${year + 1} 年为预测`} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>经济体</th><th className={THL}>地区</th><th className={TH}>出口 {year - 1}</th><th className={TH}>出口 {year}</th><th className={TH}>出口 {year + 1}</th><th className={TH}>进口 {year - 1}</th><th className={TH}>进口 {year}</th><th className={TH}>进口 {year + 1}</th><th className={TH}>出口 − 进口（{year}）</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.e.iso} className={ROW}><td className="px-2 py-0.5 text-slate-100">{r.e.name}</td><td className="px-2 text-[10px] text-slate-500">{r.e.region}</td>{[r.x0, r.x1, r.x2, r.m0, r.m1, r.m2].map((v, i) => <td key={i} className={TD} style={{ color: toneOf(v) }}>{sgn(v, 1, "")}</td>)}<td className={TD} style={{ color: toneOf(r.x1 != null && r.m1 != null ? r.x1 - r.m1 : null) }}>{r.x1 != null && r.m1 != null ? sgn(r.x1 - r.m1, 1, "") : "—"}</td></tr>)}</tbody>
      </table>
    </>
  );
}

export default function ECTRTab() {
  const [view, setView] = useState("partners");
  return (
    <div className="min-h-[560px]">
      <PanelShell code="ECTR" title="贸易流量" tabs={[["partners", "美国贸易伙伴"], ["balance", "各国贸易差额"], ["volume", "贸易量增速"], ["assets", "贸易敏感资产"]]} tab={view} setTab={setView}>
        {view === "partners" && <Partners />}
        {view === "balance" && <div className="p-2"><WorldBankExistingView mode="balance" /></div>}
        {view === "volume" && <Volumes />}
        {view === "assets" && <><SectionHead title="贸易敏感资产实时行情" sub="航运、物流、工业金属与出口型市场；点击看 K 线" /><LiveBoard rows={BOARD} /></>}
      </PanelShell>
    </div>
  );
}
