import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  evaluatePreferredTerm,
  executionAnalysis,
  parseExecutionFills,
  type ExecutionFill,
} from "./preferredToolAnalytics";

const button =
  "border border-slate-700 px-2 py-1 text-xs text-cyan-200 hover:bg-slate-800 disabled:text-slate-600";
const input = "input-terminal min-w-0 px-2 py-1 text-xs";
const tooltip = {
  contentStyle: {
    background: "#0b1320",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 11,
  },
};
const fmt = (value: number | null, digits = 4) =>
  value == null ? "—" : value.toFixed(digits);
function exportCsv(filename: string, rows: unknown[][]) {
  const cell = (value: unknown) =>
    `"${(typeof value === "number" ? String(value) : String(value ?? "").replace(/^[=+@-]/, "'$&")).replaceAll('"', '""')}"`;
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF", rows.map(row => row.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" }
    )
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="border-b border-slate-700 bg-slate-950 text-slate-400">
          <tr>
            {headers.map(header => (
              <th key={header} className="whitespace-nowrap p-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-800">
              {row.map((value, column) => (
                <td key={column} className="p-2 align-top">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Workbench({
  code,
  title,
  onClose,
  children,
}: {
  code: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className="min-w-0 bg-[#090f18] text-xs text-slate-200"
      aria-label={`${code} 分析工作台`}
      onKeyDown={event => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-700 p-2">
        <h2 className="text-sm">
          <b className="mr-2 font-mono text-cyan-200">{code}</b>
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`关闭 ${code}`}
          className={button}
        >
          关闭
        </button>
      </header>
      {children}
    </section>
  );
}

function RuleSplit({ children }: { children: React.ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const target = container.current;
    if (!target || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.width < 560)
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={container}
      className="min-w-0"
      style={{ height: compact ? 900 : 610 }}
    >
      <ResizablePanelGroup direction={compact ? "vertical" : "horizontal"}>
        {children}
      </ResizablePanelGroup>
    </div>
  );
}

/** SEC issuer search belongs to research. This tool screens actual account terms. */
export function PreferredTermScreeningTool({
  onClose,
}: {
  onClose: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const terms = trpc.preferredStockResearch.listTerms.useQuery(
    { limit: 1000 },
    {
      enabled: isAuthenticated,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  );
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [status, setStatus] = useState("all"),
    [selectedId, setSelectedId] = useState<number | null>(null);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10)),
    [coupon, setCoupon] = useState(""),
    [callDays, setCallDays] = useState(""),
    [maxAge, setMaxAge] = useState("");
  const [sort, setSort] = useState("identifier"),
    [page, setPage] = useState(1);
  const [chartView, setChartView] = useState<"rules" | "dividend" | "calls">(
    "rules"
  );
  const ruleErrors = [
    !asOf && "请选择评估日期。",
    coupon &&
      (!Number.isFinite(+coupon) || +coupon < 0 || +coupon > 100) &&
      "分配率门槛须为 0–100%。",
    callDays &&
      (!Number.isFinite(+callDays) || +callDays < 0) &&
      "首赎保护期不能为负。",
    maxAge &&
      (!Number.isFinite(+maxAge) || +maxAge < 0) &&
      "条款时效上限不能为负。",
  ].filter(Boolean);
  const evaluations = useMemo(
    () =>
      (terms.data ?? []).map(term =>
        evaluatePreferredTerm(term, {
          asOf,
          minimumCoupon: coupon === "" ? null : +coupon,
          minimumCallDays: callDays === "" ? null : +callDays,
          maximumAgeDays: maxAge === "" ? null : +maxAge,
        })
      ),
    [terms.data, asOf, coupon, callDays, maxAge]
  );
  const source = ruleErrors.length ? [] : evaluations;
  const filtered = source
    .filter(row => {
      const term = row.term;
      return (
        (!query ||
          `${term.securityIdentifier} ${term.issuerName} ${term.securityName ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (type === "all" || term.dividendType === type) &&
        (status === "all" || row.status === status)
      );
    })
    .sort((a, b) =>
      sort === "gaps"
        ? b.unknown - a.unknown ||
          a.term.securityIdentifier.localeCompare(b.term.securityIdentifier)
        : sort === "completeness"
          ? b.completenessPct - a.completenessPct ||
            a.term.securityIdentifier.localeCompare(b.term.securityIdentifier)
          : a.term.securityIdentifier.localeCompare(b.term.securityIdentifier)
    );
  const selected =
    filtered.find(row => row.term.id === selectedId) ?? filtered[0];
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    currentPage = Math.min(page, pages);
  const coverage = ["符合当前规则", "待补证", "不符合"].map(label => ({
    label,
    count: filtered.filter(row => row.status === label).length,
  }));
  const dividendMix = useMemo(() => {
    const labels: Record<string, string> = {
      fixed: "固定",
      floating: "浮动",
      fixed_to_float: "固定转浮动",
      other: "其他",
    };
    return Object.entries(
      filtered.reduce((map: Record<string, number>, row) => {
        const key = row.term.dividendType ?? "other";
        map[key] = (map[key] ?? 0) + 1;
        return map;
      }, {})
    ).map(([key, count]) => ({ label: labels[key] ?? key, count }));
  }, [filtered]);
  const callLadder = useMemo(() => {
    const years = filtered.reduce((map: Record<string, number>, row) => {
      const value = row.term.firstCallDate;
      if (!value) return map;
      const parsed = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(parsed.getTime())) return map;
      const year = String(parsed.getUTCFullYear());
      map[year] = (map[year] ?? 0) + 1;
      return map;
    }, {});
    return Object.entries(years)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([year, count]) => ({ year, count }));
  }, [filtered]);
  return (
    <Workbench code="SECF" title="账户条款规则筛选与证据判定" onClose={onClose}>
      <div
        role="toolbar"
        className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"
      >
        <input
          aria-label="SECF 条款筛选"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="证券 / 主体"
          className={input}
        />
        <select
          aria-label="SECF 分配类型"
          className={input}
          value={type}
          onChange={event => {
            setType(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">全部分配类型</option>
          <option value="fixed">固定</option>
          <option value="floating">浮动</option>
          <option value="fixed_to_float">固定转浮动</option>
          <option value="other">其他</option>
        </select>
        <select
          aria-label="SECF 规则状态"
          className={input}
          value={status}
          onChange={event => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">全部规则状态</option>
          {["符合当前规则", "待补证", "不符合"].map(label => (
            <option key={label}>{label}</option>
          ))}
        </select>
        <select
          aria-label="SECF 排序"
          className={input}
          value={sort}
          onChange={event => {
            setSort(event.target.value);
            setPage(1);
          }}
        >
          <option value="identifier">证券标识</option>
          <option value="completeness">证据完整度降序</option>
          <option value="gaps">待补证项降序</option>
        </select>
        <button
          type="button"
          className={button}
          disabled={!isAuthenticated || terms.isFetching}
          onClick={() => void terms.refetch()}
        >
          刷新账户条款
        </button>
      </div>
      <div className="flex flex-wrap gap-3 border-b border-slate-800 p-2">
        {[
          ["coupon", "最低分配率 %", coupon, setCoupon],
          ["call", "最低首赎保护天数", callDays, setCallDays],
          ["age", "最高条款年龄天数", maxAge, setMaxAge],
        ].map(([key, label, value, setter]) => (
          <label key={String(key)} className="text-[11px] text-slate-400">
            {String(label)}
            <input
              aria-label={`SECF ${label}`}
              type="number"
              min="0"
              placeholder="不限制"
              className={`${input} ml-2 w-24`}
              value={String(value)}
              onChange={event => {
                (setter as React.Dispatch<React.SetStateAction<string>>)(
                  event.target.value
                );
                setPage(1);
              }}
            />
          </label>
        ))}
        <label className="text-[11px] text-slate-400">
          评估日
          <input
            aria-label="SECF 评估日期"
            type="date"
            value={asOf}
            onChange={event => setAsOf(event.target.value)}
            className={`${input} ml-2`}
          />
        </label>
      </div>
      {ruleErrors.length > 0 ? (
        <p role="alert" className="p-3 text-amber-200">
          {ruleErrors.join(" ")}
        </p>
      ) : !isAuthenticated ? (
        <div role="status">
          <p className="border-b border-slate-800 p-3 text-amber-200">
            登录后读取账户已导入条款；本工具不加载内置证券、评级、收益率或买卖信号。
          </p>
          <Table
            headers={["分析数据层", "记录粒度", "必需字段", "当前状态"]}
            rows={[
              [
                "账户条款池",
                "一行一只已导入证券",
                "证券标识、发行主体、来源、观察日",
                "未认证，不读取账户数据",
              ],
              [
                "条款规则判定",
                "一行一项证券×规则",
                "分配类型、票面率、频率、首赎日、字段时效",
                "等待账户条款，不生成替代值",
              ],
              [
                "筛选后规则分布",
                "符合 / 待补证 / 不符合",
                "仅按实际账户条款聚合",
                "无实际记录时不绘制样例图",
              ],
              [
                "分配类型结构",
                "固定 / 浮动 / 固定转浮动 / 其他",
                "账户条款中的分配类型",
                "无实际记录时不绘制样例图",
              ],
              [
                "首次赎回年度梯队",
                "一行一个已核验首次赎回年度",
                "首次赎回日与评估日",
                "未核验日期不进入梯队",
              ],
            ]}
          />
        </div>
      ) : terms.isLoading ? (
        <p role="status" className="p-3">
          正在读取账户条款…
        </p>
      ) : terms.isError ? (
        <p role="alert" className="p-3 text-amber-200">
          条款读取失败，当前结果不再视为已刷新。请使用工具栏重试。
        </p>
      ) : !filtered.length ? (
        <p role="status" className="p-3 text-amber-200">
          {terms.data?.length
            ? "无匹配条款；调整筛选可恢复。"
            : "账户尚无条款。请在 PSCH 现有导入入口接入有来源的证券条款；不提供模拟筛选结果。"}
        </p>
      ) : (
        <RuleSplit>
          <ResizablePanel defaultSize={53} minSize={28}>
            <div className="h-full overflow-auto">
              <Table
                headers={["证券", "规则结果", "失败 / 待补证", "证据完整度 %"]}
                rows={filtered
                  .slice((currentPage - 1) * 20, currentPage * 20)
                  .map(row => [
                    <button
                      onClick={() => setSelectedId(row.term.id)}
                      className="font-mono text-cyan-200 underline"
                    >
                      {row.term.securityIdentifier}
                    </button>,
                    row.status,
                    `${row.failed} / ${row.unknown}`,
                    fmt(row.completenessPct, 0),
                  ])}
              />
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-800 p-2">
                <span>
                  {filtered.length} 条 · {currentPage}/{pages} 页
                </span>
                <div className="flex gap-1">
                  <button
                    className={button}
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    上一页
                  </button>
                  <button
                    className={button}
                    disabled={currentPage >= pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    下一页
                  </button>
                </div>
              </div>
              <div className="border-b border-slate-800">
                <nav
                  role="tablist"
                  aria-label="SECF 条款分析图层"
                  className="flex overflow-x-auto border-b border-slate-800"
                >
                  {[
                    ["rules", "规则分布"],
                    ["dividend", "分配类型结构"],
                    ["calls", "首次赎回年度梯队"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={chartView === id}
                      onClick={() =>
                        setChartView(id as "rules" | "dividend" | "calls")
                      }
                      className={`border-r border-slate-800 px-2 py-1.5 text-[10px] ${
                        chartView === id
                          ? "bg-cyan-950/30 text-cyan-200"
                          : "text-slate-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="h-52 p-2">
                  {chartView === "calls" && !callLadder.length ? (
                    <p
                      role="status"
                      className="py-16 text-center text-amber-200"
                    >
                      筛选结果没有已核验首次赎回日，不补绘赎回梯队。
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={
                          chartView === "rules"
                            ? coverage
                            : chartView === "dividend"
                              ? dividendMix
                              : callLadder
                        }
                      >
                        <CartesianGrid stroke="#263345" />
                        <XAxis
                          dataKey={chartView === "calls" ? "year" : "label"}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip {...tooltip} />
                        <Bar
                          dataKey="count"
                          name="实际条款数"
                          fill={
                            chartView === "rules"
                              ? "#22d3ee"
                              : chartView === "dividend"
                                ? "#a78bfa"
                                : "#f59e0b"
                          }
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <p className="px-2 pb-2 text-[10px] text-slate-500">
                  图层只聚合当前筛选后的账户真实条款；赎回梯队按首次赎回日年份计数，不代表发行人一定执行赎回。
                </p>
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="调整 SECF 规则明细分栏" />
          <ResizablePanel defaultSize={47} minSize={28}>
            <div className="h-full overflow-auto">
              <h3 className="border-b border-slate-800 p-2 font-mono text-cyan-200">
                {selected?.term.securityIdentifier} · 逐项规则证据
              </h3>
              {selected && (
                <Table
                  headers={["规则", "实际字段", "结论", "计算边界"]}
                  rows={selected.rules.map(rule => [
                    rule.label,
                    rule.value,
                    {
                      passed: "通过",
                      failed: "不符合",
                      unknown: "待补证",
                      not_requested: "未启用",
                    }[rule.state],
                    rule.reason,
                  ])}
                />
              )}
              <p className="p-2 text-[10px] leading-5 text-slate-400">
                完整度仅统计来源、CIK、票面率、频率和观察日期是否提供；不代表信用、收益、价格预测或投资推荐。SEC
                主体目录只保留在本功能的数据研究页。
              </p>
              <button
                className={`${button} m-2`}
                onClick={() =>
                  exportCsv("SECF-rule-screening.csv", [
                    ["证券", "规则", "字段值", "结论", "评估日"],
                    ...filtered.flatMap(row =>
                      row.rules.map(rule => [
                        row.term.securityIdentifier,
                        rule.label,
                        rule.value,
                        rule.state,
                        asOf,
                      ])
                    ),
                  ])
                }
              >
                导出逐项判定
              </button>
            </div>
          </ResizablePanel>
        </RuleSplit>
      )}
      <footer className="border-t border-slate-800 p-2 text-[10px] text-slate-400">
        来源：当前账户导入条款 · 每60秒查询 ·{" "}
        {terms.dataUpdatedAt
          ? `读取 ${new Date(terms.dataUpdatedAt).toISOString()}`
          : "尚未读取"}{" "}
        · 规则参数是用户假设，不是市场数据。
      </footer>
    </Workbench>
  );
}

/** Actual user-supplied fills only; no invented order book, execution or status. */
export function PreferredExecutionAnalysisTool({
  onClose,
}: {
  onClose: () => void;
}) {
  const uid = useId();
  const [draft, setDraft] = useState(""),
    [fills, setFills] = useState<ExecutionFill[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [scope, setScope] = useState(""),
    [view, setView] = useState(0),
    [selectedOrder, setSelectedOrder] = useState("all");
  const scopes = [
    ...new Set(fills.map(row => `${row.instrumentId}|${row.currency}`)),
  ];
  const currentScope = scopes.includes(scope) ? scope : (scopes[0] ?? "");
  const scopedFills = fills.filter(
    row => `${row.instrumentId}|${row.currency}` === currentScope
  );
  const orders = [...new Set(scopedFills.map(row => row.orderId))];
  const activeOrder = orders.includes(selectedOrder) ? selectedOrder : "all";
  const model = executionAnalysis(
    scopedFills.filter(
      row => activeOrder === "all" || row.orderId === activeOrder
    )
  );
  const tabs = ["成交逐笔复核", "价格差额与费用", "累计成本路径"];
  const currency = model?.rows[0]?.currency ?? "—";
  const apply = () => {
    const parsed = parseExecutionFills(draft);
    setErrors(parsed.errors);
    if (!parsed.errors.length) {
      setFills(parsed.rows);
      setSelectedOrder("all");
    }
  };
  const exportAnalysis = () => {
    if (!model) return;
    exportCsv("FIT-execution-review.csv", [
      [
        "orderId",
        "fillId",
        "instrumentId",
        "timestamp",
        "side",
        "quantity",
        "price",
        "benchmark",
        "fee",
        "currency",
        "source",
        "signedPriceDifference",
        "totalCost",
        "costBps",
      ],
      ...model.rows.map(row => [
        row.orderId,
        row.fillId,
        row.instrumentId,
        row.timestamp,
        row.side,
        row.quantity,
        row.price,
        row.benchmark,
        row.fee,
        row.currency,
        row.source,
        row.slippage,
        row.totalCost,
        row.costBps,
      ]),
    ]);
  };
  return (
    <Workbench code="FIT" title="成交记录与执行成本复核" onClose={onClose}>
      <details open={!fills.length} className="border-b border-slate-800">
        <summary className="cursor-pointer p-2 text-cyan-200">
          载入已发生的成交记录 · 不发送订单
        </summary>
        <div className="px-2 pb-2">
          <p className="mb-2 text-[11px] leading-5 text-slate-400">
            每行11列，以制表符分隔：委托ID、成交ID、证券ID、含时区时间、BUY/SELL、数量、成交价、同委托决策基准价、费用、三位币种、来源。基准价必须由你提供；不是系统获取的VWAP。
          </p>
          <textarea
            aria-label="FIT 成交记录 TSV"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            className={`${input} h-32 w-full font-mono`}
            spellCheck={false}
          />
          <button
            className={`${button} mt-2`}
            onClick={apply}
            disabled={!draft.trim()}
          >
            校验并载入成交
          </button>
          {errors.length > 0 && (
            <div role="alert" className="mt-2 text-amber-200">
              {errors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
              <p>未替换当前已载入记录。</p>
            </div>
          )}
        </div>
      </details>
      <div
        role="toolbar"
        className="flex flex-wrap gap-2 border-b border-slate-800 p-2"
      >
        <select
          aria-label="FIT 证券与币种"
          className={input}
          value={currentScope}
          onChange={event => {
            setScope(event.target.value);
            setSelectedOrder("all");
          }}
        >
          <option value="" disabled>
            未载入证券
          </option>
          {scopes.map(value => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="FIT 委托筛选"
          value={activeOrder}
          onChange={event => setSelectedOrder(event.target.value)}
          className={input}
        >
          <option value="all">当前证券全部委托</option>
          {orders.map(order => (
            <option key={order}>{order}</option>
          ))}
        </select>
        <button className={button} disabled={!model} onClick={exportAnalysis}>
          导出成本复核
        </button>
      </div>
      <nav
        role="tablist"
        aria-label="FIT 分析图层"
        className="flex overflow-x-auto border-b border-slate-800"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${uid}-${index}`}
            aria-controls={`${uid}-panel`}
            aria-selected={view === index}
            tabIndex={view === index ? 0 : -1}
            onClick={() => setView(index)}
            onKeyDown={event => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : null;
              if (next != null) {
                event.preventDefault();
                setView(next);
                (
                  event.currentTarget.parentElement?.children[
                    next
                  ] as HTMLElement
                )?.focus();
              }
            }}
            className={`border-r border-slate-800 px-3 py-2 ${view === index ? "bg-cyan-950/30 text-cyan-200" : "text-slate-400"}`}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-${view}`}
      >
        {!model ? (
          <p role="status" className="p-4 text-amber-200">
            尚无已校验的成交记录。授权经纪商/订单簿接口未配置，不生成成交、盘口、执行效率或暗池匹配率。
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-800 p-2">
              <span>{model.rows.length} 笔实际输入记录</span>
              <span>成交数量 {fmt(model.quantity, 2)}</span>
              <span>
                成交均价 {fmt(model.executedVwap)} {currency}
              </span>
              <span>
                执行差额及费用 {fmt(model.totalCost)} {currency} /{" "}
                {fmt(model.totalBps, 2)} bp
              </span>
            </div>
            {view === 0 && (
              <Table
                headers={[
                  "委托 / 成交",
                  "证券",
                  "时间 UTC",
                  "方向",
                  "数量",
                  "成交价",
                  "决策基准",
                  "费用",
                  "成本 bp",
                  "来源",
                ]}
                rows={model.rows.map(row => [
                  `${row.orderId} / ${row.fillId}`,
                  row.instrumentId,
                  row.timestamp,
                  row.side,
                  row.quantity,
                  row.price,
                  row.benchmark,
                  row.fee,
                  fmt(row.costBps, 2),
                  row.source,
                ])}
              />
            )}
            {view === 1 && (
              <>
                <Table
                  headers={["成本组成", `金额 ${currency}`, "基点", "计算口径"]}
                  rows={[
                    [
                      "有向价格差额",
                      fmt(model.slippage),
                      fmt(model.slippageBps, 2),
                      "买入：(成交-基准)×数量；卖出：(基准-成交)×数量",
                    ],
                    [
                      "明确记录的费用",
                      fmt(model.fees),
                      fmt(model.feeBps, 2),
                      "仅汇总用户已提供的实际费用，不估计税费",
                    ],
                    [
                      "合计",
                      fmt(model.totalCost),
                      fmt(model.totalBps, 2),
                      "差额+费用；基点分母为决策基准名义金额合计",
                    ],
                  ]}
                />
                <div className="h-72 p-2">
                  <ResponsiveContainer>
                    <BarChart
                      data={[
                        { component: "价格差额", value: model.slippage },
                        { component: "费用", value: model.fees },
                      ]}
                    >
                      <CartesianGrid stroke="#263345" />
                      <XAxis dataKey="component" />
                      <YAxis />
                      <Tooltip {...tooltip} />
                      <Bar
                        dataKey="value"
                        name={currency}
                        fill="#22d3ee"
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
            {view === 2 && (
              <>
                <div className="h-72 p-2">
                  <ResponsiveContainer>
                    <LineChart data={model.rows}>
                      <CartesianGrid stroke="#263345" />
                      <XAxis
                        dataKey="timestamp"
                        minTickGap={60}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis />
                      <Tooltip {...tooltip} />
                      <Line
                        dataKey="cumulativeCost"
                        name={`累计差额+费用 ${currency}`}
                        type="linear"
                        stroke="#a78bfa"
                        dot={model.rows.length < 20}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <Table
                  headers={[
                    "成交时点",
                    "成交 ID",
                    `本笔 ${currency}`,
                    `累计 ${currency}`,
                  ]}
                  rows={model.rows.map(row => [
                    row.timestamp,
                    row.fillId,
                    fmt(row.totalCost),
                    fmt(row.cumulativeCost),
                  ])}
                />
              </>
            )}
          </>
        )}
      </div>
      <footer className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-400">
        仅本会话的有来源成交观察。价格差额不能分解为可识别的市场冲击和时机因果；没有未成交委托数量，因此不计算完成率或未成交机会成本。混合买卖方向时不显示单一成交均价。不生成交易建议、不路由订单、不伪造交易成功。
      </footer>
    </Workbench>
  );
}
