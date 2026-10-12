import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, RefreshCw, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useModuleLiveFeed } from "@/hooks/useModuleLiveFeed";
import {
  MUNICIPAL_TOOLS,
  type MunicipalToolId,
} from "@shared/municipalWorkbench";
import type {
  OfficialSeries,
  TerritoryId,
} from "../../../../server/municipalWorkbenchData";
import MunicipalIssuerEvidenceWorkspace from "./MunicipalIssuerEvidenceWorkspace";
import MunicipalIssuerEvidenceBatchUploader from "./MunicipalIssuerEvidenceBatchUploader";
import MunicipalIssuerEvidenceSearchPanel from "./MunicipalIssuerEvidenceSearchPanel";
import { parseMunicipalTradeFile } from "@shared/municipalTradeFile";
import "./municipal-workbench.css";

const DraftContext = createContext<{
  current: Record<string, Record<string, number>>;
} | null>(null);
const fmt = (n: number | null | undefined, digits = 2) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const tip = {
  contentStyle: {
    background: "#0a1117",
    border: "1px solid #263442",
    fontSize: 11,
  },
  labelStyle: { color: "#b6c8d8" },
};
const latest = (s?: OfficialSeries) =>
  s?.history.filter(r => r.value !== null).at(-1);
function change(s: OfficialSeries) {
  const last = latest(s);
  if (!last || last.value == null) return null;
  const priorDate = `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4)}`;
  const prior = s.history.find(r => r.date === priorDate);
  return prior?.value != null && prior.value !== 0
    ? s.unit === "%"
      ? last.value - prior.value
      : (last.value / prior.value - 1) * 100
    : null;
}
function exportRows(
  name: string,
  headers: string[],
  rows: Array<Array<string | number | null>>
) {
  const escape = (x: string | number | null) =>
    `"${String(x ?? "")
      .replace(/^[\t\r =+@-]/, match =>
        typeof x === "number" ? match : "'" + match
      )
      .replace(/"/g, '""')}"`;
  const blob = new Blob(
    [
      "\uFEFF" +
        [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
function useConnection() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true),
      down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
function Pending({ error, retry }: { error?: string; retry?: () => void }) {
  return (
    <div className="mw-state" role={error ? "alert" : "status"}>
      {error ? `读取未完成：${error}` : "正在读取对应数据…"}
      {retry && <button onClick={retry}>重新读取</button>}
    </div>
  );
}
function Curve({
  rows,
  line = false,
  x = "label",
  y = "value",
  unit = "",
  selected,
  onSelect,
}: {
  rows: any[];
  line?: boolean;
  x?: string;
  y?: string;
  unit?: string;
  selected?: string;
  onSelect?: (label: string) => void;
}) {
  return (
    <div className="mw-chart">
      <ResponsiveContainer width="100%" height="100%">
        {line ? (
          <LineChart
            data={rows}
            onClick={(e: any) =>
              e?.activeLabel && onSelect?.(String(e.activeLabel))
            }
          >
            <CartesianGrid stroke="#25303a" strokeDasharray="3 4" />
            <XAxis
              dataKey={x}
              tick={{ fill: "#91a3b5", fontSize: 10 }}
              minTickGap={35}
            />
            <YAxis
              tick={{ fill: "#91a3b5", fontSize: 10 }}
              domain={["auto", "auto"]}
              tickFormatter={v => fmt(v)}
            />
            <Tooltip
              {...tip}
              formatter={(v: number) => `${fmt(v, 4)} ${unit}`}
            />
            {selected && (
              <ReferenceLine
                x={selected}
                stroke="#f59e0b"
                strokeDasharray="3 3"
              />
            )}
            <Line
              type="linear"
              dataKey={y}
              name={unit || "数值"}
              stroke="#00b8cf"
              dot={rows.length < 30}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <BarChart
            data={rows}
            onClick={(e: any) =>
              e?.activeLabel && onSelect?.(String(e.activeLabel))
            }
          >
            <CartesianGrid stroke="#25303a" strokeDasharray="3 4" />
            <XAxis
              dataKey={x}
              tick={{ fill: "#91a3b5", fontSize: 10 }}
              minTickGap={25}
            />
            <YAxis
              tick={{ fill: "#91a3b5", fontSize: 10 }}
              tickFormatter={v => fmt(v)}
            />
            <Tooltip
              {...tip}
              formatter={(v: number) => `${fmt(v, 4)} ${unit}`}
            />
            <ReferenceLine y={0} stroke="#637380" />
            <Bar dataKey={y} name={unit || "数值"} isAnimationActive={false}>
              {rows.map((r, i) => (
                <Cell
                  key={`${r[x]}-${i}`}
                  fill={
                    r[x] === selected
                      ? "#f59e0b"
                      : r[y] < 0
                        ? "#ef4444"
                        : "#16bf78"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
function ToolWorkspace({
  id,
  initialValues,
  provenance,
}: {
  id: MunicipalToolId;
  initialValues?: Record<string, number>;
  provenance?: string;
}) {
  const spec = MUNICIPAL_TOOLS[id];
  const drafts = useContext(DraftContext);
  const [values, setValues] = useState<Record<string, number>>(
    () =>
      drafts?.current[id] ??
      Object.fromEntries(
        spec.fields.map(f => [f.key, initialValues?.[f.key] ?? f.value])
      )
  );
  const [request, setRequest] = useState(values),
    [selected, setSelected] = useState<string>("");
  useEffect(() => {
    if (drafts) drafts.current[id] = values;
    const t = setTimeout(() => setRequest(values), 160);
    return () => clearTimeout(t);
  }, [values]);
  const query = trpc.municipalResearch.calculateWorkspace.useQuery(
    { moduleId: id, values: request },
    { retry: false, staleTime: 30_000 }
  );
  const [referenceApplied, setReferenceApplied] = useState("");
  const ref = trpc.municipalResearch.getReference.useQuery(
    { kind: "funding" },
    { enabled: id === "BMA", staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data;
  const [chartKey, setChartKey] = useState("value");
  const amountUnit = data?.columns.find(c => c.key === chartKey)?.unit ?? "";
  const online = useConnection();
  const recalculating =
    JSON.stringify(values) !== JSON.stringify(request) || query.isFetching;
  return (
    <>
      <div className="mw-subhead">
        <h3>{spec.title}</h3>
        <span className="mw-assumption">
          用户假设 · 非市场报价{provenance ? ` · 参考：${provenance}` : ""}
        </span>
      </div>
      <div className="mw-parameters">
        {spec.fields.map(f => (
          <label key={f.key}>
            {f.label}
            <span>{f.unit}</span>
            <input
              aria-label={f.label}
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={values[f.key]}
              onChange={e => {
                if (e.target.value === "") return;
                setValues({ ...values, [f.key]: Number(e.target.value) });
              }}
            />
            <input
              aria-label={`${f.label}滑块`}
              type="range"
              min={f.min}
              max={
                f.key === "face"
                  ? Math.min(f.max, Math.max(500, values[f.key]))
                  : f.max
              }
              step={f.step}
              value={values[f.key]}
              onChange={e =>
                setValues({ ...values, [f.key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      {id === "BMA" && (
        <div className="mw-toolbar">
          <button
            disabled={
              !ref.data?.series.find(s => s.id === "SOFR")?.history.length
            }
            onClick={() => {
              const point = latest(
                ref.data?.series.find(s => s.id === "SOFR") as OfficialSeries
              );
              if (point?.value != null) {
                setValues({ ...values, taxable: point.value });
                setReferenceApplied(
                  `SOFR ${point.date} 的已发布观察；免税端仍为假设`
                );
              }
            }}
          >
            采用官方 SOFR 作应税参照
          </button>
          <span>
            {referenceApplied ||
              "SOFR 不等于 SIFMA/BMA，使用时仅作为应税融资参照。"}
          </span>
        </div>
      )}
      {!online ? (
        <Pending error="网络断开，计算尚未同步" />
      ) : query.error ? (
        <Pending error={query.error.message} retry={() => query.refetch()} />
      ) : !data ? (
        <Pending />
      ) : (
        <>
          <div className="mw-toolbar">
            <span role="status">
              {recalculating ? "参数计算中，结果待更新…" : "服务端计算已同步"}
            </span>
            <span className="mw-muted">{spec.purpose}</span>
            <button
              onClick={() =>
                exportRows(
                  `${id}-scenario`,
                  data.columns.map(
                    c => `${c.label}${c.unit ? " (" + c.unit + ")" : ""}`
                  ),
                  data.rows.map(r => data.columns.map(c => r[c.key] ?? null))
                )
              }
            >
              <Download size={13} />
              导出测算
            </button>
          </div>
          {!!data.metrics.length && (
            <div className="mw-metrics">
              {data.metrics.map(m => (
                <div key={m.label}>
                  <span>{m.label}</span>
                  <b>
                    {fmt(m.value, 4)} <small>{m.unit}</small>
                  </b>
                </div>
              ))}
            </div>
          )}
          <div className="mw-toolbar">
            <label>
              图形指标{" "}
              <select
                aria-label="图形指标"
                value={chartKey}
                onChange={e => setChartKey(e.target.value)}
              >
                {data.columns
                  .filter(c => c.key !== "label")
                  .map(c => (
                    <option key={c.key} value={c.key}>
                      {c.label} {c.unit}
                    </option>
                  ))}
              </select>
            </label>
            <span>选择表行定位情景；切换指标查看对应数据层。</span>
          </div>
          <Curve
            rows={data.rows}
            line={data.chart === "line"}
            y={chartKey}
            unit={amountUnit}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="mw-table-wrap">
            <table>
              <thead>
                <tr>
                  {data.columns.map(c => (
                    <th key={c.key}>
                      {c.label}
                      {c.unit && <small> {c.unit}</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr
                    key={r.label}
                    tabIndex={0}
                    aria-selected={r.label === selected}
                    onClick={() => setSelected(r.label)}
                    onKeyDown={e => e.key === "Enter" && setSelected(r.label)}
                  >
                    {data.columns.map(c => (
                      <td key={c.key}>
                        {typeof r[c.key] === "number"
                          ? fmt(r[c.key] as number, 4)
                          : r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <p className="mw-note">
              已联动选择：{selected}
              。图中橙色标记对应本行；改变参数会重新计算整张表。
            </p>
          )}
          <p className="mw-note">{data.formula}</p>
        </>
      )}
    </>
  );
}
function IssuerWorkbench({ screen = false }: { screen?: boolean }) {
  const [id, setId] = useState<TerritoryId>("CA"),
    [tab, setTab] = useState(screen ? "compare" : "profile"),
    [metric, setMetric] = useState(0),
    [years, setYears] = useState(5),
    [search, setSearch] = useState(""),
    [point, setPoint] = useState("");
  const online = useConnection();
  const directory = trpc.municipalResearch.getIssuerDirectory.useQuery();
  const query = trpc.municipalResearch.getIssuerFundamentals.useQuery(
    { id },
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      retry: 1,
    }
  );
  const peerId: TerritoryId = id === "TX" ? "CA" : "TX";
  const peer = trpc.municipalResearch.getIssuerFundamentals.useQuery(
    { id: peerId },
    { enabled: tab === "compare", staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data,
    s = data?.series[metric] ?? data?.series[0];
  const rows = useMemo(
    () =>
      s?.history.filter(
        r => Number(r.date.slice(0, 4)) >= new Date().getFullYear() - years
      ) ?? [],
    [s, years]
  );
  const chartRows = useMemo(() => {
    if (tab === "health")
      return rows.map(r => {
        const prior = s?.history.find(
          p => p.date === `${Number(r.date.slice(0, 4)) - 1}${r.date.slice(4)}`
        );
        return {
          date: r.date,
          value:
            r.value != null &&
            prior?.value != null &&
            (s?.unit === "%" || prior.value !== 0)
              ? s?.unit === "%"
                ? r.value - prior.value
                : (r.value / prior.value - 1) * 100
              : null,
        };
      });
    return rows;
  }, [rows, s, tab]);
  const chartUnit =
    tab === "health" ? (s?.unit === "%" ? "百分点" : "%") : (s?.unit ?? "");
  const picked = chartRows.find(r => r.date === point);
  return (
    <>
      <div className="mw-toolbar">
        <Search size={14} />
        <input
          aria-label="筛选发行地区"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="州 / 城市 / 代码"
        />
        <select
          aria-label="发行地区"
          value={id}
          onChange={e => {
            setId(e.target.value as TerritoryId);
            setMetric(0);
            setPoint("");
          }}
        >
          {directory.data
            ?.filter(
              t =>
                `${t.id} ${t.name} ${t.english}`
                  .toLowerCase()
                  .includes(search.toLowerCase()) || t.id === id
            )
            .map(t => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.id} · {t.type}
              </option>
            ))}
        </select>
        <select
          aria-label="观察年数"
          value={years}
          onChange={e => setYears(Number(e.target.value))}
        >
          <option value={3}>3年</option>
          <option value={5}>5年</option>
          <option value={10}>10年</option>
          <option value={16}>全部观察</option>
        </select>
        <button onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={13} />
          刷新数据
        </button>
        <span className={online ? "mw-live" : "mw-error"}>
          {!online
            ? "离线 · 联网后重读"
            : query.isFetching
              ? "读取中…"
              : "每60秒核验发布更新"}
        </span>
      </div>
      <nav className="mw-subtabs" aria-label="发行人分析">
        {(screen
          ? [
              ["compare", "地区筛选对比"],
              ["profile", "指标下钻"],
            ]
          : [
              ["profile", "财务档案"],
              ["health", "健康雷达"],
              ["debt", "债务结构"],
              ["compare", "横向对比"],
            ]
        ).map(([key, label]) => (
          <button
            aria-pressed={tab === key}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "debt" ? (
        <ToolWorkspace id="SMUN" />
      ) : query.error ? (
        <Pending error={query.error.message} retry={() => query.refetch()} />
      ) : !data ? (
        <Pending />
      ) : (
        <>
          <div className="mw-subhead">
            <h3>
              {data.territory.name} ·{" "}
              {tab === "health" ? "基本面变化监测" : "经济与税基观察"}
            </h3>
            <span>{data.scope}</span>
          </div>
          {tab === "profile" ? (
            <div className="mw-metrics">
              {data.series.map((item, i) => {
                const p = latest(item as OfficialSeries);
                return (
                  <button
                    key={item.id}
                    aria-pressed={metric === i}
                    onClick={() => {
                      setMetric(i);
                      setPoint("");
                    }}
                  >
                    <span>
                      {item.label} · {item.unit}
                    </span>
                    <b>{fmt(p?.value)}</b>
                    <small>
                      {p?.date ?? "未取得记录"} · {item.frequency}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mw-toolbar">
              <label>
                分析指标{" "}
                <select
                  aria-label="发行人分析指标"
                  value={metric}
                  onChange={e => {
                    setMetric(Number(e.target.value));
                    setPoint("");
                  }}
                >
                  {data.series.map((item, i) => (
                    <option key={item.id} value={i}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {tab === "health"
                  ? "同比历史：失业率以百分点，其他维度以同比百分比展示。"
                  : "地区比较：只有同频同日且地域口径一致才绘制比较图。"}
              </span>
            </div>
          )}
          {tab === "compare" &&
            s &&
            (() => {
              if (peer.isLoading) return <Pending />;
              if (peer.error) return <Pending error={peer.error.message} retry={() => peer.refetch()} />;
              const p = peer.data?.series.find(
                  item => item.label === s.label && item.unit === s.unit
                ),
                a = latest(s as OfficialSeries),
                b = latest(p as OfficialSeries);
              return id !== "NYC" && a && b && a.date === b.date ? (
                <Curve
                  rows={[
                    { label: data.territory.name, value: a.value },
                    { label: peer.data!.territory.name, value: b.value },
                  ]}
                  unit={s.unit}
                />
              ) : (
                <p className="mw-note">
                  比较口径尚未对齐；仅展示下表原值与日期，不生成排名。
                </p>
              );
            })()}
          {s && tab !== "compare" && (
            <>
              <div className="mw-toolbar">
                <strong>
                  {s.label}
                  {tab === "health" ? "同比变化" : "历史"}
                </strong>
                <span>
                  {s.id}
                </span>
                <span>
                  {s.status === "stale"
                    ? "上游异常，保留最近成功读取并标注日期"
                    : s.status === "unavailable"
                      ? `未读取：${s.reason}`
                      : `核验 ${new Date(s.checkedAt).toLocaleTimeString()}`}
                </span>
                <button
                  onClick={() =>
                    exportRows(
                      `${id}-${s.id}`,
                      ["date", s.label + " (" + chartUnit + ")"],
                      chartRows.map(r => [r.date, r.value])
                    )
                  }
                >
                  <Download size={13} />
                  导出本序列
                </button>
              </div>
              {chartRows.some(r => r.value !== null) ? (
                <Curve
                  rows={chartRows}
                  line
                  x="date"
                  unit={chartUnit}
                  selected={point}
                  onSelect={setPoint}
                />
              ) : (
                <Pending
                  error={s.reason ?? "此口径当前无观测"}
                  retry={() => query.refetch()}
                />
              )}
              <p className="mw-note">
                {picked
                  ? `选中 ${picked.date}：${fmt(picked.value, 4)} ${chartUnit}。`
                  : ""}
                {s.definition} 缺失观察断线展示，不插值补造。
                <span >
                  原始序列
                </span>
              </p>
            </>
          )}
          {tab === "health" ? (
            <div className="mw-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>监测维度</th>
                    <th>同比变化</th>
                    <th>解释</th>
                    <th>观测频率</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map(item => {
                    const delta = change(item as OfficialSeries);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setMetric(data.series.indexOf(item))}
                      >
                        <td>{item.label}</td>
                        <td
                          className={
                            delta != null && delta < 0
                              ? "mw-negative"
                              : "mw-positive"
                          }
                        >
                          {fmt(delta)} {item.unit === "%" ? "百分点" : "%"}
                        </td>
                        <td>
                          {delta == null
                            ? "缺少可比年度观察"
                            : item.unit === "%"
                              ? "失业率上升可能增加税基压力，下降不等于评级改善"
                              : item.unit === "千人"
                                ? "常住人口规模变化，反映潜在税基及公共服务需求"
                                : "名义变化；须结合通胀与财政披露判断"}
                        </td>
                        <td>{item.frequency}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mw-note">
                以实际同比替代无依据的 AI 0–100 健康评分；不是信用评级。
              </p>
            </div>
          ) : tab === "compare" ? (
            <div className="mw-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>指标 / 口径</th>
                    <th>{data.territory.name}</th>
                    <th>{peer.data?.territory.name ?? "比较地区"}</th>
                    <th>可比性</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map((item, i) => {
                    const p = peer.data?.series.find(
                        candidate =>
                          candidate.label === item.label &&
                          candidate.unit === item.unit
                      ),
                      a = latest(item as OfficialSeries),
                      b = latest(p as OfficialSeries);
                    const comparable =
                      id !== "NYC" &&
                      !!a &&
                      !!b &&
                      item.frequency === p?.frequency &&
                      a.date === b.date;
                    return (
                      <tr key={item.id}>
                        <td>
                          {item.label} / {item.unit}
                        </td>
                        <td>
                          {fmt(a?.value)} · {a?.date}
                        </td>
                        <td>
                          {fmt(b?.value)} · {b?.date}
                        </td>
                        <td>
                          {comparable
                            ? "同频同日可比"
                            : "日期/地域/季调不同，禁止直接排名"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mw-table-wrap mw-observations">
              <table>
                <thead>
                  <tr>
                    <th>观察日</th>
                    <th>
                      {s?.label} · {s?.unit}
                    </th>
                    <th>数据标识</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice()
                    .reverse()
                    .map(r => (
                      <tr
                        key={r.date}
                        aria-selected={point === r.date}
                        onClick={() => setPoint(r.date)}
                      >
                        <td>{r.date}</td>
                        <td>{fmt(r.value, 4)}</td>
                        <td>
                          {s?.id}:{r.date}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
function ReferenceWorkbench({ kind }: { kind: "curve" | "funding" }) {
  const query = trpc.municipalResearch.getReference.useQuery(
    { kind },
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      retry: 1,
    }
  );
  const [view, setView] = useState("levels"),
    [id, setId] = useState(""),
    [window, setWindow] = useState(250),
    [historyPoint, setHistoryPoint] = useState("");
  const all = query.data?.series ?? [],
    s = all.find(s => s.id === id) ?? all[0];
  const commonDate = all.length
    ? all[0].history
        .filter(p => p.value !== null)
        .map(p => p.date)
        .reverse()
        .find(d =>
          all.every(series =>
            series.history.some(p => p.date === d && p.value !== null)
          )
        )
    : null;
  const cross = all.map(a => ({
    label: a.label,
    value: a.history.find(p => p.date === commonDate)?.value ?? null,
  }));
  const history =
    s?.history.slice(-window).map(r => ({ label: r.date, value: r.value })) ??
    [];
  return (
    <>
      <div className="mw-toolbar">
        <strong>
          {kind === "curve" ? "国债参考期限结构" : "短端融资基准"}
        </strong>
        <button onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={13} />
          核验更新
        </button>
        <span>官方日频 · 60秒核验 · 不伪称逐笔实时</span>
      </div>
      <nav className="mw-subtabs">
        <button
          aria-pressed={view === "levels"}
          onClick={() => setView("levels")}
        >
          {kind === "curve" ? "同日截面" : "融资矩阵"}
        </button>
        <button
          aria-pressed={view === "history"}
          onClick={() => setView("history")}
        >
          单序列历史
        </button>
        {kind === "curve" && (
          <button
            aria-pressed={view === "scenario"}
            onClick={() => setView("scenario")}
          >
            用户期限情景
          </button>
        )}
      </nav>
      {view === "scenario" ? (
        <ToolWorkspace
          id="AAA"
          initialValues={
            latest(s as OfficialSeries)?.value != null
              ? {
                  yield: latest(s as OfficialSeries)!.value!,
                  years: Number(s!.label.replace("Y", "")),
                }
              : undefined
          }
          provenance={
            latest(s as OfficialSeries)?.value != null
              ? `${s!.id} / ${latest(s as OfficialSeries)!.date}，可修改`
              : undefined
          }
        />
      ) : query.error ? (
        <Pending error={query.error.message} retry={() => query.refetch()} />
      ) : !query.data ? (
        <Pending />
      ) : (
        <>
          <div className="mw-toolbar">
            {view === "history" ? (
              <>
                <select
                  aria-label="参考序列"
                  value={s?.id}
                  onChange={e => setId(e.target.value)}
                >
                  {all.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="历史窗口"
                  value={window}
                  onChange={e => setWindow(Number(e.target.value))}
                >
                  <option value={30}>30条</option>
                  <option value={250}>250条</option>
                  <option value={1000}>1000条</option>
                </select>
              </>
            ) : (
              <span>
                共同观察日：{commonDate ?? "暂无共同观察日；不拼接不同日期曲线"}
              </span>
            )}
          </div>
          <Curve
            rows={view === "history" ? history : cross}
            selected={view === "history" ? historyPoint : undefined}
            line
            unit="%"
            onSelect={label => {
              if (view === "history") {
                setHistoryPoint(label);
                return;
              }
              const selected = all.find(a => a.label === label);
              if (selected) {
                setId(selected.id);
                setView("history");
              }
            }}
          />
          {view === "history" ? (
            <>
              <div className="mw-toolbar">
                <strong>
                  {s?.id}
                </strong>
                <button
                  onClick={() =>
                    exportRows(
                      s?.id ?? "series",
                      ["date", "value", "unit"],
                      history.map(r => [r.label, r.value, "%"])
                    )
                  }
                >
                  导出历史观察
                </button>
                <span>
                  {s?.status === "available"
                    ? "已读取"
                    : s?.status === "stale"
                      ? "上游更新失败，保留旧观察"
                      : s?.reason}
                </span>
              </div>
              <div className="mw-table-wrap mw-observations">
                <table>
                  <thead>
                    <tr>
                      <th>观察日</th>
                      <th>{s?.label} %</th>
                      <th>唯一观察标识</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history
                      .slice()
                      .reverse()
                      .map(r => (
                        <tr
                          key={r.label}
                          tabIndex={0}
                          aria-selected={historyPoint === r.label}
                          onClick={() => setHistoryPoint(r.label)}
                          onKeyDown={e =>
                            e.key === "Enter" && setHistoryPoint(r.label)
                          }
                        >
                          <td>{r.label}</td>
                          <td>{fmt(r.value, 4)}</td>
                          <td>
                            {s?.id}:{r.label}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="mw-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>基准</th>
                    <th>最新观察</th>
                    <th>日期</th>
                    <th>来源状态</th>
                    <th>深度</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map(item => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{fmt(latest(item as OfficialSeries)?.value, 4)}%</td>
                      <td>{latest(item as OfficialSeries)?.date ?? "—"}</td>
                      <td>
                        {item.status === "available"
                          ? "已读取"
                          : item.status === "stale"
                            ? "更新失败 · 保留旧观测"
                            : item.reason}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setId(item.id);
                            setView("history");
                          }}
                        >
                          查看历史 {item.history.length} 条
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mw-note">
            {kind === "curve"
              ? "H.15 国债收益率仅作利率参照，不是 BVAL AAA 地方债曲线。"
              : "SOFR、EFFR、OBFR 与 3 个月国债收益率为官方日度数据。"}{" "}
            点击图中期限/基准切换历史；日期不一致时不计算跨基准利差。
          </p>
        </>
      )}
    </>
  );
}
function SlgsWorkbench() {
  const query = trpc.municipalResearch.getSnapshot.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
  });
  const [date, setDate] = useState(""),
    [measure, setMeasure] = useState<
      | "newSubscriptionsAmount"
      | "cancelledSubscriptionsAmount"
      | "demandDepositRedemptionsAmount"
      | "timeDepositRedemptionsAmount"
    >("newSubscriptionsAmount");
  const rows = query.data?.slgs ?? [],
    selected = rows.find(r => r.recordDate === date) ?? rows.at(-1);
  const names = {
    newSubscriptionsAmount: "认购",
    cancelledSubscriptionsAmount: "撤销",
    demandDepositRedemptionsAmount: "活期赎回",
    timeDepositRedemptionsAmount: "定期赎回",
  };
  return (
    <>
      <div className="mw-toolbar">
        <strong>SLGS 财政部证券活动</strong>
        <select
          aria-label="活动指标"
          value={measure}
          onChange={e => setMeasure(e.target.value as typeof measure)}
        >
          {Object.entries(names).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={13} />
          刷新发布记录
        </button>
        <span>
          {query.data?.dataStatus === "stale"
            ? "上游读取失败，显示最近成功记录"
            : query.data?.dataStatus === "unavailable"
              ? "财政部当前未能读取"
              : "实际发布更新 · 非流通证券"}
        </span>
      </div>
      {!selected ? (
        <Pending
          error={
            query.isError
              ? query.error.message
              : query.isLoading
                ? undefined
                : "暂未取得财政部记录"
          }
          retry={() => query.refetch()}
        />
      ) : (
        <>
          <Curve
            line
            rows={rows.map(r => ({
              label: r.recordDate,
              value: r[measure] == null ? null : r[measure]! / 1e6,
            }))}
            unit="百万美元"
            onSelect={setDate}
          />
          <div className="mw-toolbar">
            <strong>{selected.recordDate} · 期限结构</strong>
            <select
              aria-label="SLGS观察日"
              value={selected.recordDate}
              onChange={e => setDate(e.target.value)}
            >
              {rows
                .slice()
                .reverse()
                .map(r => (
                  <option key={r.recordDate}>{r.recordDate}</option>
                ))}
            </select>
            <button
              onClick={() =>
                exportRows(
                  "slgs-activity",
                  ["date", ...Object.values(names)],
                  rows.map(r => [
                    r.recordDate,
                    ...Object.keys(names).map(k => r[k as typeof measure]),
                  ])
                )
              }
            >
              导出原始金额
            </button>
          </div>
          <div className="mw-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>期限桶</th>
                  <th>发行金额（美元）</th>
                  <th>发行笔数</th>
                  <th>未偿金额（美元）</th>
                  <th>未偿笔数</th>
                </tr>
              </thead>
              <tbody>
                {selected.buckets.map(b => (
                  <tr key={b.id}>
                    <td>{b.label}</td>
                    <td>{fmt(b.issuedAmount)}</td>
                    <td>{fmt(b.issuedCount, 0)}</td>
                    <td>{fmt(b.outstandingAmount)}</td>
                    <td>{fmt(b.outstandingCount, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mw-note">
            点击历史图或日期筛选，期限表同步切换到对应观察；空值显示“—”，不当作0。SLGS不是地方政府债券成交或BVAL收益率。
          </p>
        </>
      )}
    </>
  );
}

function TradeDataWorkbench({ screen }: { screen: boolean }) {
  const [text, setText] = useState(""),
    [filter, setFilter] = useState(""),
    [min, setMin] = useState(0),
    [selected, setSelected] = useState("");
  const parsed = useMemo(() => parseMunicipalTradeFile(text), [text]);
  const rows = parsed.errors.length
    ? []
    : parsed.rows.filter(
        r =>
          r.label.toLowerCase().includes(filter.toLowerCase()) &&
          r.quantity >= min
      );
  const total = rows.reduce((a, r) => a + r.quantity, 0),
    weighted = total
      ? rows.reduce((a, r) => a + r.quantity * r.price, 0) / total
      : null;
  return (
    <>
      <div className="mw-subhead">
        <h3>{screen ? "自有债券清单筛选" : "成交文件去重与分布统计"}</h3>
        <span>只分析粘贴数据 · 不冒充 MSRB 成交流</span>
      </div>
      <textarea
        aria-label="粘贴债券数据"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={
          "粘贴已授权CSV，表头：id,price,quantity,yield\n字段：债券/成交ID，净价，面值数量，收益率（%）"
        }
      />
      <div className="mw-toolbar">
        <input
          aria-label="筛选债券代码"
          placeholder="筛选代码"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <label>
          最低数量{" "}
          <input
            aria-label="最低数量"
            type="number"
            min={0}
            value={min}
            onChange={e => setMin(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <button onClick={() => setText("")}>清空输入</button>
        <span>
          精确重复拦截 {parsed.duplicates} 行 · 校验失败 {parsed.errors.length}{" "}
          行
        </span>
      </div>
      {parsed.errors.length > 0 && (
        <div role="alert" className="mw-error">
          {parsed.errors.slice(0, 5).join("；")}。请修正后再分析。
        </div>
      )}
      {rows.length > 0 ? (
        <>
          <div className="mw-metrics">
            <div>
              <span>匹配行数</span>
              <b>{rows.length}</b>
            </div>
            <div>
              <span>数量加权净价</span>
              <b>{fmt(weighted, 4)}</b>
            </div>
            <div>
              <span>合计面值数量</span>
              <b>{fmt(total)}</b>
            </div>
          </div>
          <Curve
            rows={rows.map(r => ({
              label: r.label,
              value: screen ? r.yield : r.quantity,
            }))}
            unit={screen ? "%" : "面值数量"}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="mw-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>标识</th>
                  <th>净价</th>
                  <th>面值数量</th>
                  <th>收益率 %</th>
                  <th>净价金额</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.label}-${i}`}
                    aria-selected={selected === r.label}
                    onClick={() => setSelected(r.label)}
                  >
                    <td>{r.label}</td>
                    <td>{fmt(r.price)}</td>
                    <td>{fmt(r.quantity)}</td>
                    <td>{fmt(r.yield)}</td>
                    <td>{fmt((r.quantity * r.price) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mw-note">
          等待授权数据输入。支持最多1000行，不静默截断；同一ID的数值冲突会阻止整批分析，精确重复只计一次。此页不会填入演示债券。
        </p>
      )}
    </>
  );
}

const MODULE_WORKSPACES: Record<string, string> = {
  "1": "证券设定",
  MSRC: "清单筛选",
  SMUN: "发行人分析",
  AAA: "曲线工作台",
  BTMM: "短端融资",
  PICK: "发行计划",
  MBWD: "询价比较",
  CDRN: "承销费用",
  CDRC: "竞标成本",
  CDRA: "付息安排",
  CNDS: "短票资金",
  CDRV: "浮息重设",
  DEAL: "交收核算",
  CACT: "事件压力",
  MCAL: "支付瀑布",
  MBIX: "组合归因",
  VRDN: "回售备付",
  BMA: "税率平衡",
  BOOM: "融资库存",
  MSRB: "成交统计",
  SLGS: "官方活动",
};
function SecuritySettingsWorkbench() {
  const fields = [
    ["证券标识", "CUSIP / ISIN / 内部代码", "唯一键"],
    ["计息日惯例", "ACT/360、30/360、ACT/ACT", "现金流日历"],
    ["曲线构建", "Bootstrap / Nelson-Siegel / Svensson", "用户默认"],
    ["估值模型", "现值、久期、DV01、凸性", "结果口径"],
    ["市场与币种", "USD · 美国市政债", "用户偏好"],
    ["数据状态", "来源、观察日、修订号、时效", "发布记录"],
  ];
  return (
    <>
      <div className="mw-subhead">
        <h3>证券设定与字段</h3>
        <span>只维护估值口径，不展示行情、不复制 21 项业务数据。</span>
      </div>
      <div className="mw-table-wrap">
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>可选口径</th>
              <th>用途</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([field, value, purpose]) => (
              <tr key={field}>
                <td>{field}</td>
                <td className="mw-wrap-cell">{value}</td>
                <td>{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function cleanDeliveryBody(body: string) {
  return body
    .replace(/\s*资料地址\s*[:：]\s*https?:\/\/\S+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function deliveryDataLayer(body: string) {
  const pick = (pattern: RegExp) => body.match(pattern)?.[1]?.trim() ?? '—';
  return [
    ['观察值', pick(/观察值\s*([^。]+)/)],
    ['上一有效观察', pick(/上一有效观察\s*([^。]+)/)],
    ['历史范围', pick(/最近\s*\d+\s*个有效观察范围\s*([^，。]+)/)],
    ['历史均值', pick(/均值\s*([^。]+)/)],
    ['序列', pick(/序列\s*([^。]+)/)],
    ['频率', pick(/频率\s*([^。]+)/)],
    ['定义', pick(/定义：?\s*([^。]+)/)],
    ['机构', pick(/机构：?\s*([^。]+)/)],
  ];
}

function deliveryChartValues(body: string) {
  const number = (value: string) => Number(value.replace(/,/g, '').replace(/%/g, '').trim());
  const observed = body.match(/观察值\s*([-+]?\d[\d,]*(?:\.\d+)?)/)?.[1];
  const previous = body.match(/上一有效观察[^：:]*[：:]\s*([-+]?\d[\d,]*(?:\.\d+)?)/)?.[1];
  const range = body.match(/最近\s*\d+\s*个有效观察范围\s*([-+]?\d[\d,]*(?:\.\d+)?)\s*[—-]\s*([-+]?\d[\d,]*(?:\.\d+)?)/);
  const values = [observed ? number(observed) : NaN, previous ? number(previous) : NaN, range?.[1] ? number(range[1]) : NaN, range?.[2] ? number(range[2]) : NaN];
  return values.every(Number.isFinite) ? values : null;
}

export default function MunicipalTerminalWorkbench({
  moduleId,
  original,
}: {
  moduleId: string;
  original: ReactNode;
}) {
  const [mode, setMode] = useState("work"),
    [archiveTab, setArchiveTab] = useState("files"),
    [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const drafts = useRef<Record<string, Record<string, number>>>({});
  const feed = useModuleLiveFeed(`/terminal?open=${moduleId}&module=local-bonds`, true, { acknowledge: mode === "records", publicOnly: true });
  const label = MODULE_WORKSPACES[moduleId];
  // 原“业务操作”面板依赖的市政债行情接口处于受限状态（全部为空），不再展示；工作台各页均为真实数据或用户输入计算
  if (!label) return <>{original}</>;
  return (
    <DraftContext.Provider value={drafts}>
      <div className="municipal-workbench" data-municipal-workbench={moduleId}>
        <nav className="mw-tabs" aria-label={`${moduleId}工作区`}>
          <b>{moduleId}</b>
          <button
            aria-pressed={mode === "work"}
            onClick={() => setMode("work")}
          >
            {label}
          </button>
          {moduleId === "SMUN" && (
            <button
              aria-pressed={mode === "archive"}
              onClick={() => setMode("archive")}
            >
              文件归档
            </button>
          )}
          <button aria-pressed={mode === "records"} onClick={() => setMode("records")}>资料记录{feed.items.length ? ` · ${feed.items.length}` : ""}</button>
          <span>参数 / 数据 / 图表 / 明细联动</span>
        </nav>
        {mode === "records" ? (
          <div className="mw-content">
            <div className="mw-toolbar"><strong>{label} · 定向资料</strong><span>{feed.connection === "live" ? "更新通道已连接" : "备用读取 · 15秒重试"}</span><button onClick={() => feed.refetch()}>重新读取资料</button></div>
            {feed.error ? <Pending error={feed.error.message} retry={() => feed.refetch()} /> : feed.isLoading ? <Pending /> : feed.items.length ? (
              <div className="mw-table-wrap"><table><thead><tr><th>日期</th><th>资料</th><th>完整内容</th></tr></thead><tbody>
                {feed.items.map(item => <Fragment key={item.itemKey}><tr data-delivery-item={item.itemKey}>
                  <td>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "未标明"}</td>
                  <td className="mw-wrap-cell">{item.title}</td><td className="mw-wrap-cell"><div>{cleanDeliveryBody(item.body)}</div><button type="button" className="mt-1 rounded border border-cyan-900 px-2 py-1 text-[10px] text-cyan-200" onClick={() => setExpandedDelivery(expandedDelivery === item.itemKey ? null : item.itemKey)}>{expandedDelivery === item.itemKey ? "收起数据层" : "查看数据层"}</button></td>
                </tr>{expandedDelivery === item.itemKey && <tr><td colSpan={3} className="bg-slate-950/70 p-2"><div className="rounded border border-cyan-950 bg-slate-950/80 p-2"><div className="mb-2 flex items-center justify-between"><strong className="text-xs text-cyan-100">实时可视化数据层</strong><span className="text-[10px] text-emerald-300">实时流 · 当前记录已接收</span></div><div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">{(() => { const values = deliveryChartValues(item.body); const labels = ['当前值', '上期值', '历史下界', '历史上界']; const tableRows = deliveryDataLayer(item.body); return <><div className="min-h-[170px] rounded border border-slate-800 bg-slate-950/60 p-2">{values ? (() => { const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1; const points = values.map((value, index) => `${34 + index * 92},${126 - ((value - min) / span) * 82}`).join(' '); return <svg viewBox="0 0 420 160" className="h-40 w-full" role="img" aria-label="当前值、上期值与历史区间实时对比图"><line x1="28" y1="126" x2="390" y2="126" stroke="#334155" /><line x1="28" y1="22" x2="28" y2="126" stroke="#334155" /><polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="2.5" /><line x1="34" y1="126" x2="310" y2="126" stroke="#334155" strokeDasharray="3 4" />{values.map((value, index) => { const x = 34 + index * 92; const y = 126 - ((value - min) / span) * 82; return <Fragment key={labels[index]}><circle cx={x} cy={y} r="4" fill={index < 2 ? '#22d3ee' : '#94a3b8'} /><text x={x} y="145" textAnchor="middle" fill="#94a3b8" fontSize="10">{labels[index]}</text><text x={x} y={y - 8} textAnchor="middle" fill="#e2e8f0" fontSize="9">{value.toLocaleString()}</text></Fragment>; })}</svg>; })() : <p className="p-3 text-[11px] text-slate-500">该记录缺少可绘图数值，保留参考表。</p>}</div><div className="overflow-x-auto rounded border border-slate-800"><table className="w-full text-left text-[11px]"><thead className="bg-slate-900 text-slate-500"><tr><th className="px-2 py-2">字段</th><th className="px-2 py-2">参考值</th><th className="px-2 py-2">更新时间</th><th className="px-2 py-2">状态</th></tr></thead><tbody>{tableRows.map(([label, value]) => <tr key={label} className="border-t border-slate-800"><td className="px-2 py-1.5 text-slate-400">{label}</td><td className="px-2 py-1.5 font-mono text-cyan-100">{value}</td><td className="px-2 py-1.5 text-slate-500">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : item.publishedAt ? new Date(item.publishedAt).toLocaleString() : '—'}</td><td className="px-2 py-1.5 text-emerald-300">已接收</td></tr>)}</tbody></table></div></>; })()}</div></div></td></tr>}</Fragment>)}
              </tbody></table></div>
            ) : <p className="mw-note">此功能尚无已核验资料。定向内容到达后自动显示；不会借用其他功能的数据补齐。</p>}
          </div>
        ) : mode === "archive" ? (
          <>
            <nav className="mw-subtabs">
              {[
                ["files", "证据与文件"],
                ["upload", "批量导入"],
                ["search", "归档检索"],
              ].map(([k, v]) => (
                <button
                  key={k}
                  aria-pressed={archiveTab === k}
                  onClick={() => setArchiveTab(k)}
                >
                  {v}
                </button>
              ))}
            </nav>
            {archiveTab === "files" ? (
              <MunicipalIssuerEvidenceWorkspace />
            ) : archiveTab === "upload" ? (
              <MunicipalIssuerEvidenceBatchUploader />
            ) : (
              <MunicipalIssuerEvidenceSearchPanel />
            )}
          </>
        ) : (
          <div className="mw-content">
            {moduleId === "1" ? (
              <SecuritySettingsWorkbench />
            ) : moduleId === "SMUN" ? (
              <IssuerWorkbench />
            ) : moduleId === "MSRC" ? (
              <TradeDataWorkbench screen />
            ) : moduleId === "MSRB" ? (
              <TradeDataWorkbench screen={false} />
            ) : moduleId === "AAA" ? (
              <ReferenceWorkbench kind="curve" />
            ) : moduleId === "BTMM" ? (
              <ReferenceWorkbench kind="funding" />
            ) : moduleId === "SLGS" ? (
              <SlgsWorkbench />
            ) : moduleId in MUNICIPAL_TOOLS ? (
              <ToolWorkspace key={moduleId} id={moduleId as MunicipalToolId} />
            ) : null}
          </div>
        )}
      </div>
    </DraftContext.Provider>
  );
}
