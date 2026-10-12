import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type View = "table" | "sentiment";

type Position = {
  label: string;
  long: number | null;
  short: number | null;
  net: number | null;
};

const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "—";

const signed = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
};

const positionDefinitions: Array<{
  key: string;
  label: string;
}> = [
  { key: "producer", label: "生产商/贸易商" },
  { key: "swap", label: "掉期交易商" },
  { key: "managedMoney", label: "管理资金" },
  { key: "otherReport", label: "其他报告机构" },
  { key: "nonReportable", label: "非报告机构" },
];

function position(fields: Record<string, unknown>, key: string, label: string): Position {
  return {
    label,
    long: typeof fields[`${key}Long`] === "number" ? fields[`${key}Long`] as number : null,
    short: typeof fields[`${key}Short`] === "number" ? fields[`${key}Short`] as number : null,
    net: typeof fields[`${key}Net`] === "number" ? fields[`${key}Net`] as number : null,
  };
}

export default function CftcCommodityPanel() {
  const [view, setView] = useState<View>("table");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const query = trpc.derivativesResearch.getFinceptCftcSnapshot.useQuery(undefined, {
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
  const history = query.data?.history ?? [];
  const selected = history.find((item) => item.symbol === selectedSymbol) ?? history[0] ?? null;
  const fields = (selected?.fields ?? {}) as Record<string, unknown>;
  const positions = useMemo(
    () => positionDefinitions.map(({ key, label }) => position(fields, key, label)),
    [fields],
  );

  return (
    <section className="min-h-full bg-slate-950 p-4 text-slate-200">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-900/70 pb-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-amber-300">CFTC · COMMITMENTS OF TRADERS</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">全球期货持仓周报</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Fincept CFTC 能力已绑定到大宗商品第 13 项。显示官方报告中的合约名称、多空持仓和净仓；
            这是周度监管报告，不是实时行情、成交或订单簿。
          </p>
        </div>
        <span className={`rounded border px-2 py-1 text-[10px] ${query.data?.available ? "border-emerald-700 text-emerald-300" : "border-amber-700 text-amber-300"}`}>
          {query.isFetching ? "正在读取官方周报…" : query.data?.available ? `已读取 ${history.length} 个合约` : "暂无可验证周报"}
        </span>
      </header>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[10px] text-slate-500">
          合约
          <select
            value={selected?.symbol ?? ""}
            onChange={(event) => setSelectedSymbol(event.target.value)}
            className="input-terminal mt-1 min-w-72 text-xs"
            disabled={!history.length}
          >
            {!history.length && <option value="">暂无实际合约</option>}
            {history.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {String(item.fields.name ?? item.symbol)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1">
          {([
            ["table", "持仓明细"],
            ["sentiment", "净仓观察"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`rounded border px-3 py-1.5 text-xs ${view === value ? "border-amber-500 bg-amber-950/50 text-amber-200" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-500">
          报告日 {String(fields.reportDate ?? selected?.date ?? "—")} · 时效：周度发布
        </span>
      </div>

      {query.error ? (
        <p className="mt-4 rounded border border-rose-900 bg-rose-950/20 p-3 text-xs text-rose-200">
          CFTC 官方周报读取失败，前端不会用模拟值补齐：{query.error.message}
        </p>
      ) : !selected ? (
        <p className="mt-4 rounded border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">
          当前没有可验证的 CFTC 周报记录，系统不会把旧数据或其他功能数据复制到这里。
        </p>
      ) : view === "table" ? (
        <div className="mt-4 overflow-x-auto rounded border border-slate-800">
          <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
            <span className="font-semibold text-amber-200">{String(fields.contractName ?? selected.symbol)}</span>
            <span className="ml-2 text-slate-500">未平仓量 {number(fields.openInterest)} · CFTC Disaggregated</span>
          </div>
          <table className="min-w-[720px] w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="px-3 py-2">报告类别</th>
                <th>多头</th>
                <th>空头</th>
                <th>净仓</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((row) => (
                <tr key={row.label} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-200">{row.label}</td>
                  <td>{number(row.long)}</td>
                  <td>{number(row.short)}</td>
                  <td className={row.net == null ? "text-slate-500" : row.net >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {signed(row.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {positions.map((row) => (
            <article key={row.label} className="rounded border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] text-slate-500">{row.label}</p>
              <p className={`mt-2 text-xl font-semibold ${row.net == null ? "text-slate-500" : row.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {signed(row.net)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">多头 {number(row.long)} · 空头 {number(row.short)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
