import { useMemo, useState } from "react";
import { Activity, Database, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

type DatasetMode = "realtime" | "history" | "basic" | "edb" | "iwencai";

const DEFAULT_FIELDS = [
  "preClose",
  "open",
  "high",
  "low",
  "latest",
  "change",
  "changeRatio",
  "amount",
  "volume",
  "bid1",
  "ask1",
  "bidSize1",
  "askSize1",
  "inflow",
  "outflow",
];

const CATEGORY_SYMBOLS: Record<string, string> = {
  "global-data": "600000.SH",
  bonds: "019547.SH",
  indices: "000001.SH",
  funds: "510300.SH",
  forex: "USDCNY.FX",
  futures: "IF00.CFE",
  spot: "AU9999.SGE",
  options: "10000001.SH",
  companies: "600000.SH",
  "cn-sectors": "885001.TI",
  "hk-sectors": "HSI.HI",
  "us-sectors": "SPX.GI",
  functions: "600000.SH",
};

const isoOffset = (years: number, months: number) => {
  const value = new Date();
  value.setUTCFullYear(value.getUTCFullYear() - years);
  value.setUTCMonth(value.getUTCMonth() - months);
  return value.toISOString().slice(0, 10);
};

const displayValue = (value: unknown) => {
  if (value == null || value === "") return "—";
  if (typeof value === "number")
    return Number.isFinite(value)
      ? value.toLocaleString("zh-CN", { maximumFractionDigits: 6 })
      : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function IfindSdkDataWorkbench() {
  const catalog = trpc.equityListings.ifindCatalog.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnReconnect: true,
  });
  const [categoryId, setCategoryId] = useState("indices");
  const [mode, setMode] = useState<DatasetMode>("realtime");
  const [symbolText, setSymbolText] = useState(CATEGORY_SYMBOLS.indices);
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_FIELDS);
  const [edbText, setEdbText] = useState("M001620326");
  const [queryText, setQueryText] = useState("沪深A股最新涨跌幅");
  const [beginDate, setBeginDate] = useState(() => isoOffset(0, 1));
  const [endDate, setEndDate] = useState(() => isoOffset(0, 0));
  const [submitted, setSubmitted] = useState<any>(null);

  const dataset = trpc.equityListings.ifindDataset.useQuery(submitted, {
    enabled: submitted !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const categories = catalog.data?.categories ?? [];
  const activeCategory = categories.find(item => item.id === categoryId);
  const allFields = useMemo(() => {
    if (mode === "basic")
      return (catalog.data?.fieldGroups.basic ?? []).map(item => ({
        id: item.id,
        label: item.label,
      }));
    const source =
      mode === "history"
        ? catalog.data?.fieldGroups.history
        : catalog.data?.fieldGroups.realtime;
    return (source ?? []).map(id => ({ id, label: id }));
  }, [catalog.data, mode]);

  const changeCategory = (next: string) => {
    setCategoryId(next);
    setSymbolText(CATEGORY_SYMBOLS[next] ?? "600000.SH");
    setSubmitted(null);
  };
  const changeMode = (next: DatasetMode) => {
    setMode(next);
    setBeginDate(next === "edb" ? isoOffset(5, 0) : isoOffset(0, 1));
    setEndDate(isoOffset(0, 0));
    setSelectedFields(
      next === "basic"
        ? (catalog.data?.fieldGroups.basic ?? []).slice(0, 6).map(item => item.id)
        : DEFAULT_FIELDS
    );
    setSubmitted(null);
  };
  const runQuery = () => {
    const base = {
      categoryId,
      mode,
      begin: beginDate,
      end: endDate,
    };
    if (mode === "edb") {
      setSubmitted({
        ...base,
        indicators: edbText.split(/[,;\s]+/).map(item => item.trim()).filter(Boolean),
      });
      return;
    }
    if (mode === "iwencai") {
      setSubmitted({ ...base, query: queryText.trim(), domain: "stock" });
      return;
    }
    setSubmitted({
      ...base,
      symbols: symbolText.split(/[,;\s]+/).map(item => item.trim().toUpperCase()).filter(Boolean),
      fields: selectedFields,
    });
  };

  const resultColumns = dataset.data?.columns ?? [];
  const resultRows = dataset.data?.rows ?? [];
  const configured = catalog.data?.provider.configured === true;
  const needsDateRange = mode === "history" || mode === "edb";
  const dateRangeValid = !needsDateRange || Boolean(beginDate && endDate && beginDate <= endDate);

  return (
    <section id="wei-ifind-sdk" aria-label="同花顺 iFinD SDK 数据中心" className="border-b border-cyan-950 bg-[#07111e]">
      <div className="flex flex-wrap items-center gap-2 border-b border-cyan-950 bg-[#081a2b] px-2 py-1.5">
        <span className="flex items-center gap-1.5 border-r border-slate-700 pr-3 text-[11px] font-semibold text-cyan-200">
          <Database className="h-3.5 w-3.5" /> iFinD SDK 数据中心
        </span>
        <select
          aria-label="iFinD 数据类别"
          value={categoryId}
          onChange={event => changeCategory(event.target.value)}
          className="h-6 min-w-[132px] border border-cyan-900 bg-slate-950 px-1.5 text-[9px] text-cyan-100"
        >
          {categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <select
          aria-label="iFinD 查询接口"
          value={mode}
          onChange={event => changeMode(event.target.value as DatasetMode)}
          className="h-6 border border-slate-700 bg-slate-950 px-1.5 text-[9px] text-slate-200"
        >
          <option value="realtime">实时行情</option>
          <option value="history">历史行情</option>
          <option value="basic">基础数据</option>
          <option value="edb">EDB 经济指标</option>
          <option value="iwencai">i问财筛选</option>
        </select>
        {mode === "edb" ? (
          <input aria-label="EDB 指标代码" value={edbText} onChange={event => setEdbText(event.target.value)} className="h-6 min-w-[210px] flex-1 border border-slate-700 bg-slate-950 px-2 font-mono text-[9px] text-slate-200 outline-none" placeholder="EDB 指标代码，逗号分隔" />
        ) : mode === "iwencai" ? (
          <input aria-label="i问财查询" value={queryText} onChange={event => setQueryText(event.target.value)} className="h-6 min-w-[210px] flex-1 border border-slate-700 bg-slate-950 px-2 text-[9px] text-slate-200 outline-none" placeholder="输入自然语言筛选条件" />
        ) : (
          <input aria-label="iFinD 证券代码" value={symbolText} onChange={event => setSymbolText(event.target.value)} className="h-6 min-w-[190px] flex-1 border border-slate-700 bg-slate-950 px-2 font-mono text-[9px] text-slate-200 outline-none" placeholder="证券代码，逗号分隔" />
        )}
        {needsDateRange && <>
          <input type="date" aria-label="iFinD 开始日期" value={beginDate} max={endDate} onChange={event => { setBeginDate(event.target.value); setSubmitted(null); }} className="h-6 w-[116px] border border-slate-700 bg-slate-950 px-1 font-mono text-[8px] text-slate-200" />
          <span className="text-[8px] text-slate-600">至</span>
          <input type="date" aria-label="iFinD 结束日期" value={endDate} min={beginDate} onChange={event => { setEndDate(event.target.value); setSubmitted(null); }} className="h-6 w-[116px] border border-slate-700 bg-slate-950 px-1 font-mono text-[8px] text-slate-200" />
        </>}
        <button type="button" onClick={runQuery} disabled={!configured || dataset.isFetching || !dateRangeValid} className="flex h-6 items-center gap-1 border border-cyan-700 bg-cyan-950 px-2 text-[9px] text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
          {dataset.isFetching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          {dataset.isFetching ? "读取中" : "读取授权数据"}
        </button>
        <span className={`ml-auto flex items-center gap-1 text-[8px] ${configured ? "text-emerald-400" : "text-amber-300"}`}>
          {configured ? <ShieldCheck className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
          {configured ? "SDK 与加密凭据已配置" : catalog.isLoading ? "检测 SDK…" : "SDK 或凭据未配置"}
        </span>
      </div>

      <div className="grid min-h-[220px] grid-cols-1 xl:grid-cols-[285px_minmax(0,1fr)]">
        <div className="border-r border-cyan-950 bg-[#061426]">
          <div className="border-b border-slate-800 px-2 py-1.5 text-[9px] leading-4 text-slate-400">
            <div className="font-semibold text-cyan-200">{activeCategory?.label ?? "数据目录"}</div>
            <div>{activeCategory?.description ?? "正在读取 SDK 能力目录…"}</div>
            <div className="mt-1 text-slate-500">接口：{activeCategory?.interfaces.join(" / ") ?? "—"}</div>
          </div>
          {mode === "realtime" || mode === "history" || mode === "basic" ? (
            <div className="max-h-[255px] overflow-y-auto p-1.5">
              <div className="mb-1 flex items-center justify-between text-[8px] text-slate-500">
                <span>指标字段 {selectedFields.length}/{allFields.length}</span>
                <span className="flex gap-2">
                  <button type="button" className="text-cyan-300" onClick={() => setSelectedFields(allFields.map(item => item.id))}>全选</button>
                  <button type="button" className="text-slate-400" onClick={() => setSelectedFields([])}>清空</button>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-1">
                {allFields.map(field => (
                  <label key={field.id} className="flex min-w-0 items-center gap-1 border-b border-slate-900 py-1 text-[8px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.id)}
                      onChange={event => setSelectedFields(current => event.target.checked ? [...current, field.id] : current.filter(id => id !== field.id))}
                      className="h-3 w-3 accent-cyan-500"
                    />
                    <span className="truncate" title={`${field.label} (${field.id})`}>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2 text-[8px] leading-4 text-slate-500">
              {mode === "edb" ? "输入账户授权的 EDB 指标代码，可一次读取最多 40 个指标。" : "i问财按账户授权实时执行，结果逐列原样返回，不生成替代记录。"}
            </div>
          )}
          <div className="border-t border-slate-800 p-2 text-[8px] leading-4 text-slate-500">
            已登记 {catalog.data?.functions.length ?? 0} 个 SDK 函数接口、{catalog.data?.categories.length ?? 0} 个数据类别。目录不等于账户授权；以本次返回状态为准。
          </div>
        </div>

        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1.5 text-[8px] text-slate-500">
            <span>SDK 原始字段结果 · {dataset.data?.available ? `${resultRows.length} 行` : "等待查询"}</span>
            <span>{dataset.data?.queriedAt ? new Date(dataset.data.queriedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</span>
          </div>
          {dataset.isError ? (
            <div className="p-4 text-[9px] text-rose-300">SDK 查询接口失败：{dataset.error.message}</div>
          ) : dataset.data && !dataset.data.available ? (
            <div className="p-4 text-[9px] leading-5 text-amber-300">
              本次数据不可用：{dataset.data.reason}
              <div className="text-slate-500">没有使用静态值、随机数或其他证券替代。</div>
            </div>
          ) : dataset.data?.available && resultRows.length ? (
            <div className="max-h-[300px] overflow-auto">
              <table className="min-w-full border-collapse font-mono text-[8px]">
                <thead className="sticky top-0 z-10 bg-[#0b2033] text-cyan-200">
                  <tr>{resultColumns.map(column => <th key={column} className="whitespace-nowrap border-b border-r border-cyan-950 px-2 py-1.5 text-left font-medium">{column}</th>)}</tr>
                </thead>
                <tbody>
                  {resultRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-slate-900 hover:bg-cyan-950/20">
                      {resultColumns.map(column => <td key={column} className="max-w-[240px] whitespace-nowrap border-r border-slate-900 px-2 py-1 text-slate-300" title={displayValue((row as any)[column])}>{displayValue((row as any)[column])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-[185px] items-center justify-center px-4 text-center text-[9px] leading-5 text-slate-500">
              选择数据类别、查询接口、证券及指标后读取。数据直接来自本机同花顺 iFinD SDK，权限外数据保持为空。
            </div>
          )}
          {dataset.data?.available && dataset.data.truncated && <div className="border-t border-amber-900/50 px-2 py-1 text-[8px] text-amber-300">结果超过工作台单次上限，已显示前 1,000 行；请缩小证券或日期范围。</div>}
        </div>
      </div>
    </section>
  );
}
