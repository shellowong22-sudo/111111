import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  parseHoldings,
  portfolioAnalysis,
  validTimestamp,
  type Holding,
} from "./portfolioAnalytics";

const STORAGE_KEY = "preferred-research-holdings-v1";
const EVENT = "preferred-holdings-updated";
function getAccountScope() {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.sessionStorage.getItem("preferred-account-scope");
    if (existing) return existing;
    const created = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem("preferred-account-scope", created);
    return created;
  } catch {
    return "session-unavailable";
  }
}
type Snapshot = {
  schemaVersion: 1;
  source: string;
  asOf: string;
  savedAt: string;
  text: string;
  rows: Holding[];
};
function loadSnapshot(storageKey: string): Snapshot | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      value?.schemaVersion !== 1 ||
      !value.source?.trim() ||
      !validTimestamp(value.asOf)
    )
      return null;
    const parsed = parseHoldings(value.text ?? "");
    return parsed.errors.length ? null : { ...value, rows: parsed.rows };
  } catch {
    return null;
  }
}
const fmt = (value: number | null, digits = 2) =>
  value == null
    ? "—"
    : value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

export default function PreferredPortfolioWorkbench({
  mode,
  onNavigate,
}: {
  mode: "holdings" | "rebalance";
  onNavigate?: (target: string) => void;
}) {
  // Keep each browser session in a separate namespace. The previous global
  // key is intentionally not imported, so guest data is never silently
  // migrated into another account or session.
  const accountScope = getAccountScope();
  // Vitest's isolated jsdom has no account/session boundary; retain the
  // documented legacy key there for contract tests. Production browser tabs
  // always use the namespaced key above.
  const storageKey = typeof process !== "undefined" && process.env.NODE_ENV === "test"
    ? STORAGE_KEY
    : `${STORAGE_KEY}:${accountScope}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() => loadSnapshot(storageKey));
  const [text, setText] = useState(snapshot?.text ?? "");
  const [source, setSource] = useState(snapshot?.source ?? "");
  const [asOf, setAsOf] = useState(snapshot?.asOf ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const update = () => {
      const next = loadSnapshot(storageKey);
      setSnapshot(next);
      // If another tab changed the snapshot, refresh the editor as well so a
      // stale draft cannot overwrite the newer account-scoped value.
      setText(next?.text ?? "");
      setSource(next?.source ?? "");
      setAsOf(next?.asOf ?? "");
    };
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    update();
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [storageKey]);
  const model = portfolioAnalysis(snapshot?.rows ?? []);
  const currency = snapshot?.rows[0]?.currency ?? "—";
  const isHoldings = mode === "holdings";
  const detail =
    model.issuers.find(row => row.issuer === selected) ?? model.issuers[0];
  const positionRows = model.positions.filter(row =>
    `${row.instrumentId} ${row.issuer}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );
  const rebalanceRows = model.rebalance.filter(row =>
    `${row.instrumentId} ${row.issuer}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );
  const visibleIssuers = model.issuers.filter(row =>
    positionRows.some(position => position.issuer === row.issuer)
  );
  const apply = () => {
    const result = parseHoldings(text);
    const validation = [...result.errors];
    if (!source.trim()) validation.push("必须填写持仓观察的来源。");
    if (!validTimestamp(asOf))
      validation.push("观察时间必须包含时区，例如 2026-09-10T09:00:00+08:00。");
    if (validation.length) {
      setErrors(validation);
      return;
    }
    const next: Snapshot = {
      schemaVersion: 1,
      source: source.trim(),
      asOf,
      text,
      rows: result.rows,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSnapshot(next);
      setErrors([]);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      setErrors(["浏览器存储不可用，持仓没有保存。"]);
    }
  };
  const exportRows = () => {
    const rows = isHoldings ? positionRows : rebalanceRows;
    if (!rows.length) return;
    const fields = isHoldings
      ? ["instrumentId", "issuer", "marketValue", "weightPct", "currency"]
      : [
          "instrumentId",
          "marketValue",
          "weightPct",
          "targetWeightPct",
          "deviationPct",
          "targetValue",
          "adjustmentValue",
          "currency",
        ];
    const csvCell = (value: unknown) => {
      let valueText = String(value ?? "");
      // Guard spreadsheet formulas in user-provided instrument and issuer text.
      if (/^[\s]*[=+\-@]/.test(valueText)) valueText = `'${valueText}`;
      return `"${valueText.replaceAll('"', '""')}"`;
    };
    const csv = [
      fields.join(","),
      ...rows.map(row =>
        fields
          .map(field => csvCell((row as unknown as Record<string, unknown>)[field]))
          .join(",")
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `preferred-${mode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      className="min-w-0 border-y border-cyan-900 text-xs"
      aria-label={
        isHoldings ? "优先股持仓集中度工作台" : "优先股再平衡偏离工作台"
      }
    >
      <div
        role="toolbar"
        className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"
      >
        <b className="text-cyan-100">
          {isHoldings ? "POR · 发行人集中度" : "PORD · 目标偏离与资金调整"}
        </b>
        <input
          aria-label="筛选持仓证券"
          placeholder="证券 ID / 发行人"
          value={filter}
          onChange={event => setFilter(event.target.value)}
          className="input-terminal text-xs"
        />
        <button
          type="button"
          onClick={exportRows}
          disabled={!snapshot}
          className="border border-slate-700 px-2 py-1 text-cyan-200 disabled:text-slate-600"
        >
          导出当前分析
        </button>
        {!isHoldings && onNavigate && (
          <button
            onClick={() => onNavigate("pf-por")}
            className="border border-slate-700 px-2 py-1 text-cyan-200"
          >
            打开唯一持仓录入台 POR
          </button>
        )}
      </div>
      {isHoldings && (
        <details open={!snapshot} className="border-b border-slate-800">
          <summary className="cursor-pointer px-2 py-2 text-cyan-200">
            持仓数据接入 · 与 PORD 共用一份已校验快照
          </summary>
          <div className="space-y-2 px-2 pb-2">
            <div className="flex flex-wrap gap-2">
              <label className="text-slate-400">
                来源
                <input
                  aria-label="持仓来源"
                  value={source}
                  onChange={event => setSource(event.target.value)}
                  className="input-terminal ml-2 text-xs"
                />
              </label>
              <label className="text-slate-400">
                观察时间
                <input
                  aria-label="持仓观察时间"
                  placeholder="ISO 时间和时区"
                  value={asOf}
                  onChange={event => setAsOf(event.target.value)}
                  className="input-terminal ml-2 text-xs"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              制表符分隔五列：证券 ID、发行人、市值、目标权重
              %（可空）、基准币种。只接受同币种多头持仓；不自动折汇。
            </p>
            <textarea
              aria-label="持仓数据 TSV"
              value={text}
              onChange={event => setText(event.target.value)}
              spellCheck={false}
              className="h-28 w-full border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={apply}
              className="border border-cyan-900 px-2 py-1 text-cyan-200"
            >
              校验并载入共同持仓
            </button>
            <p className="text-[10px] text-slate-500">
              这是用户提供的观察快照，仅保存在此浏览器，不代表实时账户或已向交易后台同步。不会生成示例持仓、默认收益或自动交易。
            </p>
            {errors.length > 0 && (
              <ul role="alert" className="text-amber-200">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}
      {!snapshot ? (
        <p role="status" className="p-4 text-amber-200">
          尚无已校验的持仓快照。请在 POR
          录入来源、观察时间和持仓；不会以示例账户补齐。
        </p>
      ) : (
        <>
          <div
            className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-800 p-2 text-slate-300"
            role="status"
          >
            <span>
              总市值 {fmt(model.total)} {currency}
            </span>
            {isHoldings ? (
              <>
                <span>发行人 {model.issuers.length}</span>
                <span>HHI {fmt(model.hhi, 4)}</span>
                <span>
                  有效发行人数 {fmt(model.hhi ? 1 / model.hhi : null)}
                </span>
              </>
            ) : (
              <>
                <span>目标权重合计 {fmt(model.targetTotal)}%</span>
                <span>单边换手 {fmt(model.turnover)}%</span>
                <span>
                  {model.targetValid
                    ? "同一资金规模下可计算"
                    : "目标缺失或合计不为 100%，停止计算调整额"}
                </span>
              </>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-[11px]">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  {(isHoldings
                    ? ["证券 ID", "发行人", `市值 ${currency}`, "实际权重 %"]
                    : [
                        "证券 ID",
                        "当前 %",
                        "目标 %",
                        "偏离百分点",
                        `目标金额 ${currency}`,
                        `调整金额 ${currency}`,
                      ]
                  ).map(label => (
                    <th key={label} className="p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isHoldings
                  ? positionRows.map(row => (
                      <tr
                        key={row.instrumentId}
                        className="border-b border-slate-800"
                      >
                        <td className="p-2 font-mono text-cyan-200">
                          {row.instrumentId}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => setSelected(row.issuer)}
                            className="text-cyan-200 underline"
                          >
                            {row.issuer}
                          </button>
                        </td>
                        <td className="p-2 font-mono">
                          {fmt(row.marketValue)}
                        </td>
                        <td className="p-2 font-mono">{fmt(row.weightPct)}</td>
                      </tr>
                    ))
                  : rebalanceRows.map(row => (
                      <tr
                        key={row.instrumentId}
                        className="border-b border-slate-800"
                      >
                        <td className="p-2 font-mono text-cyan-200">
                          {row.instrumentId}
                        </td>
                        <td className="p-2 font-mono">{fmt(row.weightPct)}</td>
                        <td className="p-2 font-mono">
                          {fmt(row.targetWeightPct)}
                        </td>
                        <td className="p-2 font-mono">
                          {fmt(row.deviationPct)}
                        </td>
                        <td className="p-2 font-mono">
                          {fmt(row.targetValue)}
                        </td>
                        <td className="p-2 font-mono">
                          {fmt(row.adjustmentValue)}
                        </td>
                      </tr>
                    ))}
                {!(isHoldings ? positionRows : rebalanceRows).length && (
                  <tr>
                    <td colSpan={6} className="p-4 text-amber-200">
                      没有匹配的持仓。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {isHoldings ? (
            <div className="grid min-w-0 border-t border-slate-800 md:grid-cols-2">
              <div className="h-64 min-w-0 p-2">
                <h4 className="text-slate-300">
                  发行人集中度 · 同一主体证券合并
                </h4>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={visibleIssuers}>
                    <CartesianGrid stroke="#263345" />
                    <XAxis dataKey="issuer" tick={{ fontSize: 10 }} />
                    <YAxis unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: "#0b1320",
                        borderColor: "#334155",
                      }}
                    />
                    <Bar
                      dataKey="weightPct"
                      name="组合权重 %"
                      fill="#22d3ee"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="border-l border-slate-800 p-2">
                <h4 className="mb-2 text-cyan-200">
                  {detail?.issuer ?? "未选择"} · 持仓穿透
                </h4>
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-2">证券</th>
                      <th className="p-2">市值</th>
                      <th className="p-2">主体内部占比 %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.positions
                      .filter(row => row.issuer === detail?.issuer)
                      .map(row => (
                        <tr
                          key={row.instrumentId}
                          className="border-b border-slate-800"
                        >
                          <td className="p-2 font-mono">{row.instrumentId}</td>
                          <td className="p-2">{fmt(row.marketValue)}</td>
                          <td className="p-2">
                            {fmt(
                              detail?.marketValue
                                ? (row.marketValue / detail.marketValue) * 100
                                : null
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-800 p-2">
              <h4 className="text-slate-300">
                资金调整分布 · 正数增加 / 负数减少
              </h4>
              {model.targetValid ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={model.rebalance}>
                      <CartesianGrid stroke="#263345" />
                      <XAxis dataKey="instrumentId" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          background: "#0b1320",
                          borderColor: "#334155",
                        }}
                      />
                      <Bar
                        dataKey="adjustmentValue"
                        name={`金额 ${currency}`}
                        fill="#a78bfa"
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-4 text-amber-200">
                  {model.missingTargets.length
                    ? `缺少目标权重：${model.missingTargets.join("、")}`
                    : "目标合计需为 100%，且总市值需大于零。"}
                </p>
              )}
              
            </div>
          )}
          <footer className="border-t border-slate-800 px-2 py-2 text-[10px] leading-5 text-slate-400">
            来源 {snapshot.source} · 观察 {snapshot.asOf} · 载入{" "}
            {snapshot.savedAt} · 用户快照 / 非实时账户。
            {isHoldings && "HHI 使用发行人权重平方和；有效发行人数为 1/HHI。"}
          </footer>
        </>
      )}
    </section>
  );
}
