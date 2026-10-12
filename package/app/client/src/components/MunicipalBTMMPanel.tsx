import { useMemo, useState } from "react";
import { Database, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Tab = "funding" | "bills" | "check";
const SERIES = [
  ["FEDFUNDS", "联邦基金有效利率"],
  ["SOFR", "隔夜融资参考"],
  ["DGS3MO", "3月期节点"],
  ["DGS6MO", "6月期节点"],
  ["DGS1", "1年期节点"],
  ["DGS2", "2年期节点"],
  ["DGS10", "10年期节点"],
] as const;

const format = (value: number | null | undefined) =>
  value == null ? "—" : `${value.toFixed(3)}%`;

export default function MunicipalBTMMPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("funding");
  const snapshot = trpc.municipalResearch.getMunicipalBtmmStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000, refetchOnReconnect: true }
  );
  const data = snapshot.data;
  const rates = data?.rates ?? {};
  const spread = useMemo(() => {
    const sofr = rates.SOFR?.latest ?? null;
    const fed = rates.FEDFUNDS?.latest ?? null;
    return sofr == null || fed == null ? null : sofr - fed;
  }, [rates]);
  const billSlope = useMemo(() => {
    const short = rates.DGS3MO?.latest ?? null;
    const oneYear = rates.DGS1?.latest ?? null;
    return short == null || oneYear == null ? null : oneYear - short;
  }, [rates]);
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080d16] text-xs text-slate-200" aria-label="地方债 BTMM 短端融资">
      <header className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <Database className="h-4 w-4 text-cyan-300" />
        <b className="font-mono text-cyan-300">BTMM</b>
        <span>短端融资与期限结构</span>
        <span role="status" className="text-[10px] text-slate-500">
          {snapshot.isFetching ? "正在读取清洗观察" : data?.dataStatus === "available" ? `观测日 ${data.observedAt ?? "—"}` : "未接入 / —"}
        </span>
        <button type="button" aria-label="刷新 BTMM" onClick={() => void snapshot.refetch()} className="ml-auto p-1 text-slate-400 hover:text-cyan-200"><RefreshCw className={`h-3.5 w-3.5 ${snapshot.isFetching ? "animate-spin" : ""}`} /></button>
        <button type="button" aria-label="关闭 BTMM" onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
      </header>
      <p className="border-b border-slate-800 px-3 py-1.5 text-[10px] text-slate-500">{data?.limitation ?? "正在检查地方债短端融资契约；不回退到主权债组件或静态数据。"}</p>
      <nav className="flex border-b border-slate-800">
        {(["funding", "bills", "check"] as Tab[]).map(item => <button key={item} type="button" onClick={() => setTab(item)} className={`border-r border-slate-800 px-3 py-2 text-[10px] ${tab === item ? "border-b-2 border-b-cyan-400 text-cyan-200" : "text-slate-500"}`}>{item === "funding" ? "融资参考" : item === "bills" ? "短端期限结构" : "抵押与交收核验"}</button>)}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === "funding" && <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="联邦基金" value={format(rates.FEDFUNDS?.latest)} /><Metric label="隔夜融资" value={format(rates.SOFR?.latest)} /><Metric label="隔夜差额" value={format(spread)} /><Metric label="3月节点" value={format(rates.DGS3MO?.latest)} /></div>
          <RateTable rates={rates} keys={["FEDFUNDS", "SOFR", "DGS3MO"]} />
        </>}
        {tab === "bills" && <><div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="3月" value={format(rates.DGS3MO?.latest)} /><Metric label="6月" value={format(rates.DGS6MO?.latest)} /><Metric label="1年" value={format(rates.DGS1?.latest)} /><Metric label="1Y − 3M" value={format(billSlope)} /></div><RateTable rates={rates} keys={["DGS3MO", "DGS6MO", "DGS1", "DGS2", "DGS10"]} /></>}
        {tab === "check" && <div className="rounded border border-slate-800 bg-slate-950/60 p-4 text-[11px] leading-6 text-slate-400"><p className="text-slate-200">抵押与交收核验</p><p>本入口只提供公开短端观察，不含逐券抵押品、交易对手报价、保证金协议或交收状态。</p><p>未配置获准的逐笔融资和抵押品接口时，现金需求、折扣率和执行结果保持 —。</p></div>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded border border-slate-800 bg-slate-950/60 p-2"><div className="text-[10px] text-slate-500">{label}</div><div className="font-mono text-sm text-cyan-200">{value}</div></div>; }

function RateTable({ rates, keys }: { rates: Record<string, { latest: number | null; observations: Array<{ date: string; value: number }> }>; keys: string[] }) { return <table className="w-full text-[10px]"><thead className="text-left text-slate-500"><tr><th className="p-2">序列</th><th>最新值</th><th>观测数</th><th>最后观测</th></tr></thead><tbody>{keys.map(key => <tr key={key} className="border-t border-slate-800"><td className="p-2 text-slate-300">{SERIES.find(item => item[0] === key)?.[1] ?? key}</td><td className="font-mono text-cyan-200">{format(rates[key]?.latest)}</td><td>{rates[key]?.observations.length ?? 0}</td><td>{rates[key]?.observations.at(-1)?.date ?? "—"}</td></tr>)}</tbody></table>; }
