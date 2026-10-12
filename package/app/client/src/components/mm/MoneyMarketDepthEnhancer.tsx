import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileCheck2,
  Filter,
  GitCompareArrows,
  Landmark,
  ShieldCheck,
} from "lucide-react";
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
import {
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";

type Snapshot = {
  rates: Array<{
    id: string;
    label: string;
    value: number | null;
    observationDate: string | null;
    history: Array<{ date: string; value: number }>;
    status: "available" | "unavailable";
    limitation: string;
  }>;
  sources: Array<{
    id: string;
    label: string;
    region: string;
    frequency: string;
    url: string;
    scope: string;
  }>;
};
type ModuleId =
  | "pgm"
  | "mktbeat"
  | "btmm"
  | "tcon"
  | "rv"
  | "ycqsim"
  | "gc"
  | "crvf-mmkt"
  | "crvf"
  | "fibc"
  | "cdie"
  | "efsf"
  | "mmidx"
  | "etrade"
  | "edsf"
  | "pboc"
  | "twdi"
  | "news-mm";
const downloadCsv = (
  name: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
) => {
  const q = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const href = URL.createObjectURL(
    new Blob(
      [
        `\uFEFF${[headers, ...rows].map(row => row.map(q).join(",")).join("\r\n")}`,
      ],
      { type: "text/csv;charset=utf-8" }
    )
  );
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
};
const sourceKind = (source: Snapshot["sources"][number]) =>
  source.id === "TREASURY-AUCTIONS"
    ? "拍卖日历"
    : source.id === "BCB-CDI" || source.id === "CBC-CALL"
      ? "隔夜/本地基准"
      : source.id === "PBOC"
        ? "政策公告"
        : source.id === "EFSF"
          ? "机构资料"
          : "美元参考利率";
const percentile = (values: number[], value: number) =>
  values.length
    ? (values.filter(item => item <= value).length / values.length) * 100
    : null;
const AuditEmpty = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-xs">
    <b className="text-slate-400">{title}</b>
    <p className="mt-1 text-slate-500">{description}</p>
  </div>
);

function ProjectGate() {
  const [rows, setRows] = useState<
    Array<{
      id: number;
      topic: string;
      due: string;
      source: string;
      status: "draft" | "review" | "complete";
    }>
  >([]);
  const [topic, setTopic] = useState("");
  const [due, setDue] = useState("");
  const [source, setSource] = useState("");
  const add = () => {
    if (!topic.trim() || !/^https:\/\//.test(source)) return;
    setRows(items => [
      ...items,
      { id: Date.now(), topic: topic.trim(), due, source, status: "draft" },
    ]);
    setTopic("");
    setDue("");
    setSource("");
  };
  const completed = rows.filter(item => item.status === "complete").length;
  return (
    <Card
      title="项目资料完整性闸门"
      action={
        <span className="text-[10px] text-slate-500">
          {completed}/{rows.length} 完成
        </span>
      }
    >
      <p className="mb-2 text-[11px] text-slate-500">
        与项目列表不同，此闸门要求每个工作项提供 HTTPS
        原始来源并显式记录研究状态；项目名称、状态与截止日优先在终端内查看，原始网页仅在需要时展开核验。
      </p>
      <div className="grid gap-2 md:grid-cols-4">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="input-terminal text-xs"
          placeholder="研究主题"
        />
        <input
          type="date"
          value={due}
          onChange={e => setDue(e.target.value)}
          className="input-terminal text-xs"
        />
        <input
          value={source}
          onChange={e => setSource(e.target.value)}
          className="input-terminal text-xs"
          placeholder="HTTPS 原始来源"
        />
        <button
          type="button"
          onClick={add}
          className="rounded border border-cyan-800 text-xs text-cyan-200"
        >
          建立可审计工作项
        </button>
      </div>
      <div className="mt-3 space-y-1">
        {rows.map(row => (
          <div
            key={row.id}
            className="grid gap-2 rounded border border-slate-800 p-2 text-xs md:grid-cols-[1fr_130px_auto]"
          >
            <span className="truncate text-cyan-100">{row.topic}</span>
            <select
              value={row.status}
              onChange={e =>
                setRows(items =>
                  items.map(item =>
                    item.id === row.id
                      ? { ...item, status: e.target.value as typeof row.status }
                      : item
                  )
                )
              }
              className="input-terminal text-xs"
            >
              <option value="draft">资料待补</option>
              <option value="review">待复核</option>
              <option value="complete">已完成</option>
            </select>
            <span className="text-right text-slate-500">
              {row.due || "无截止日"}
              <details className="mt-1 text-left">
                <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-cyan-300">
                  原始证据（可选）
                </summary>
                <a
                  href={row.source}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block max-w-48 truncate text-[10px] text-cyan-300"
                >
                  打开核验链接
                </a>
              </details>
            </span>
          </div>
        ))}
        {!rows.length && (
          <AuditEmpty
            title="尚无可审计项目"
            description="输入主题和 HTTPS 原始来源以创建浏览器会话内的质量闸门记录。"
          />
        )}
      </div>
    </Card>
  );
}
function Corridor({ snapshot }: { snapshot?: Snapshot }) {
  const rates = ["IORB", "EFFR", "SOFR", "RRPONTSYD"]
    .map(id => snapshot?.rates.find(row => row.id === id))
    .filter(Boolean) as Snapshot["rates"];
  const [maxGap, setMaxGap] = useState("10");
  const rows = rates.map(item => ({
    name: item.label,
    value: item.value,
    date: item.observationDate,
    status: item.status,
  }));
  const policyRates = rates
    .filter(item => item.id !== "RRPONTSYD" && item.value != null)
    .map(item => item.value as number);
  const span =
    policyRates.length > 1
      ? (Math.max(...policyRates) - Math.min(...policyRates)) * 100
      : null;
  return (
    <Card
      title="走廊组成与日度偏离记录"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "policy-implementation-corridor.csv",
              ["指标", "数值", "观察日", "状态"],
              rows.map(row => [row.name, row.value, row.date, row.status])
            )
          }
          className="text-xs text-cyan-300"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-5">
        {rows.map(row => (
          <Metric
            key={row.name}
            label={row.name}
            value={
              row.value == null
                ? "—"
                : `${row.value.toFixed(3)}${row.name === "ON RRP" ? "" : "%"}`
            }
            tone={row.status === "available" ? "info" : "neutral"}
          />
        ))}
        <label className="text-xs text-slate-500">
          容许跨度（bp）
          <input
            type="number"
            min="0"
            value={maxGap}
            onChange={e => setMaxGap(e.target.value)}
            className="input-terminal mt-1 w-full text-xs"
          />
        </label>
      </div>
      <div
        className={`mt-3 rounded border p-3 text-xs ${span != null && span > Number(maxGap) ? "border-amber-800 text-amber-200" : "border-emerald-800 text-emerald-200"}`}
      >
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        {span == null
          ? "可比利率观察不足，无法计算日度走廊跨度。"
          : `IORB、EFFR 与 SOFR 的日度观察范围为 ${span.toFixed(1)} bp，${span > Number(maxGap) ? "超过" : "未超过"}用户阈值。ON RRP 余额单列展示，不作为利率参与计算。`}
      </div>
    </Card>
  );
}
function RvDistribution({ snapshot }: { snapshot?: Snapshot }) {
  const [left, setLeft] = useState("SOFR");
  const [right, setRight] = useState("EFFR");
  const l = snapshot?.rates.find(item => item.id === left);
  const r = snapshot?.rates.find(item => item.id === right);
  const rows = (l?.history ?? []).flatMap(point => {
    const other = r?.history.find(item => item.date === point.date);
    return other
      ? [{ date: point.date, bp: (point.value - other.value) * 100 }]
      : [];
  });
  const values = rows.map(item => item.bp);
  const current = values.at(-1);
  const p = current == null ? null : percentile(values, current);
  return (
    <Card
      title="差值分布与观察位置"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "money-market-relative-value.csv",
              ["日期", `${left}-${right} (bp)`],
              rows.map(row => [row.date, row.bp])
            )
          }
          disabled={!rows.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-3">
        <select
          value={left}
          onChange={e => setLeft(e.target.value)}
          className="input-terminal text-xs"
        >
          {snapshot?.rates.map(item => (
            <option key={item.id}>{item.id}</option>
          ))}
        </select>
        <select
          value={right}
          onChange={e => setRight(e.target.value)}
          className="input-terminal text-xs"
        >
          {snapshot?.rates.map(item => (
            <option key={item.id}>{item.id}</option>
          ))}
        </select>
        <Metric
          label="最新差值历史百分位"
          value={p == null ? "—" : `${p.toFixed(1)}%`}
          tone="info"
        />
      </div>
      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.slice(-90)}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 9 }}
              minTickGap={28}
            />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "#020617",
                border: "1px solid #334155",
              }}
            />
            <Bar dataKey="bp" name="同日差值 (bp)" fill="#a78bfa" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        百分位仅描述当前差值位于所选历史同日观察中的位置，不表示均值回归、套利空间或交易建议。
      </p>
    </Card>
  );
}
function CurveCoverage({ snapshot }: { snapshot?: Snapshot }) {
  const [focus, setFocus] = useState("SOFR");
  const series = snapshot?.rates.find(item => item.id === focus);
  const rows = series?.history ?? [];
  const first = rows.at(0)?.date;
  const gaps = rows
    .slice(1)
    .filter(
      (item, index) =>
        new Date(item.date).getTime() - new Date(rows[index].date).getTime() >
        5 * 86_400_000
    ).length;
  return (
    <Card title="曲线覆盖与可交付性检查">
      <div className="grid gap-2 md:grid-cols-4">
        <select
          value={focus}
          onChange={e => setFocus(e.target.value)}
          className="input-terminal text-xs"
        >
          {snapshot?.rates.map(item => (
            <option key={item.id}>{item.id}</option>
          ))}
        </select>
        <Metric label="可用观察" value={String(rows.length)} tone="info" />
        <Metric label="起始观察日" value={first || "—"} />
        <Metric label="疑似间隔" value={String(gaps)} />
      </div>
      <div className="mt-3 h-44">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 9 }}
                minTickGap={28}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Line dataKey="value" name={focus} stroke="#22d3ee" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <AuditEmpty
            title="无可交付序列"
            description="上游公开序列不可读时不补点。"
          />
        )}
      </div>
      <button
        type="button"
        onClick={() =>
          downloadCsv(
            `money-market-${focus}-coverage.csv`,
            ["日期", "值"],
            rows.map(row => [row.date, row.value])
          )
        }
        disabled={!rows.length}
        className="mt-2 text-xs text-cyan-300 disabled:text-slate-600"
      >
        <Download className="mr-1 inline h-3 w-3" />
        导出当前覆盖窗口
      </button>
    </Card>
  );
}
function SourceDiscovery({
  snapshot,
  comparative,
}: {
  snapshot?: Snapshot;
  comparative: boolean;
}) {
  const [kind, setKind] = useState("全部");
  const [region, setRegion] = useState("全部");
  const kinds = [...new Set((snapshot?.sources ?? []).map(sourceKind))];
  const regions = [
    ...new Set((snapshot?.sources ?? []).map(item => item.region)),
  ];
  const rows = (snapshot?.sources ?? []).filter(
    item =>
      (kind === "全部" || sourceKind(item) === kind) &&
      (region === "全部" || item.region === region)
  );
  return (
    <Card
      title={comparative ? "跨来源计量口径比较" : "货币市场工具资料发现器"}
      action={<Filter className="h-4 w-4 text-cyan-300" />}
    >
      <p className="mb-2 text-[11px] text-slate-500">
        在终端内筛选、比较地区、频率、覆盖和口径边界；原始网页仅保留为次级证据核验。
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={kind}
          onChange={e => setKind(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>全部</option>
          {kinds.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>全部</option>
          {regions.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">终端资料</th>
              <th className="p-2">工具类别</th>
              <th className="p-2">地区/频率</th>
              <th className="p-2">可比性边界</th>
              <th className="p-2">证据</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => (
              <tr key={item.id} className="border-t border-slate-800">
                <td className="p-2 text-cyan-100">{item.label}</td>
                <td className="p-2">{sourceKind(item)}</td>
                <td className="p-2">
                  {item.region} · {item.frequency}
                </td>
                <td className="p-2 text-slate-500">
                  {comparative
                    ? "仅比较来源、频率与覆盖；不合并为同一收益率口径。"
                    : item.scope}
                </td>
                <td className="p-2">
                  <details>
                    <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-cyan-300">
                      原始证据（可选）
                    </summary>
                    <a
                      className="mt-1 block text-[10px] text-cyan-300"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开核验来源
                    </a>
                  </details>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="p-3 text-slate-500">
                  无匹配的已核验公开资料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function FibcSensitivity() {
  const [face, setFace] = useState("1000000");
  const [price, setPrice] = useState("990000");
  const [days, setDays] = useState("90");
  const f = Number(face);
  const p = Number(price);
  const d = Number(days);
  const rows = [-0.01, -0.005, 0, 0.005, 0.01].map(move => {
    const adjusted = p * (1 + move);
    return {
      move: move * 100,
      price: adjusted,
      discount:
        f > 0 && d > 0 ? ((((f - adjusted) / f) * 360) / d) * 100 : null,
      investment:
        adjusted > 0 && d > 0
          ? ((((f - adjusted) / adjusted) * 365) / d) * 100
          : null,
    };
  });
  return (
    <Card title="贴现与收益率价格敏感度">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={face}
          onChange={e => setFace(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="面值"
        />
        <input
          value={price}
          onChange={e => setPrice(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="价格"
        />
        <input
          value={days}
          onChange={e => setDays(e.target.value)}
          type="number"
          min="1"
          className="input-terminal text-xs"
          placeholder="天数"
        />
      </div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">价格冲击</th>
              <th className="p-2">情景价格</th>
              <th className="p-2">贴现率</th>
              <th className="p-2">投资收益率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.move} className="border-t border-slate-800">
                <td className="p-2">{row.move.toFixed(1)}%</td>
                <td className="p-2">
                  {Number.isFinite(row.price)
                    ? row.price.toLocaleString()
                    : "—"}
                </td>
                <td className="p-2">{row.discount?.toFixed(4) ?? "—"}%</td>
                <td className="p-2">{row.investment?.toFixed(4) ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        敏感度为用户输入价格上下 0.5% 与 1.0%
        的透明重算；不等同市场报价、风险估值或证券惯例确认。
      </p>
    </Card>
  );
}
function OfficialRegister({ type }: { type: "efsf" | "pboc" }) {
  const config =
    type === "efsf"
      ? {
          title: "EFSF 官方文件质量核验",
          host: "efsf.europa.eu",
          categories: ["EMTN", "新闻稿", "投资者资料"],
        }
      : {
          title: "人民银行原始公告质量核验",
          host: "pbc.gov.cn",
          categories: ["公开市场操作", "政策利率", "新闻发布", "其他公告"],
        };
  const [name, setName] = useState("");
  const [url, setUrl] = useState(`https://www.${config.host}/`);
  const [date, setDate] = useState("");
  const [category, setCategory] = useState(config.categories[0]);
  const [rows, setRows] = useState<
    Array<{
      id: number;
      name: string;
      url: string;
      date: string;
      category: string;
      state: "待核验" | "已核验" | "需补充";
    }>
  >([]);
  const add = () => {
    try {
      const parsed = new URL(url);
      if (!name.trim() || !parsed.hostname.endsWith(config.host)) return;
      setRows(items => [
        ...items,
        {
          id: Date.now(),
          name: name.trim(),
          url: parsed.toString(),
          date,
          category,
          state: "待核验",
        },
      ]);
      setName("");
    } catch {
      /* 用户需修正 URL */
    }
  };
  return (
    <Card
      title={config.title}
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `${type}-official-register.csv`,
              ["名称", "类别", "日期", "状态", "官方链接"],
              rows.map(row => [
                row.name,
                row.category,
                row.date,
                row.state,
                row.url,
              ])
            )
          }
          disabled={!rows.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <p className="mb-2 text-[11px] text-slate-500">
        在终端内维护名称、类别、日期与核验状态；只接受 {config.host}{" "}
        官方域名，原始链接仅供证据核验，不推断价格、收益率或政策结果。
      </p>
      <div className="grid gap-2 md:grid-cols-4">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="input-terminal text-xs"
          placeholder="文件名称/标识"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="input-terminal text-xs"
        >
          {config.categories.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input
          value={date}
          onChange={e => setDate(e.target.value)}
          type="date"
          className="input-terminal text-xs"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="input-terminal text-xs"
        />
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded border border-cyan-800 px-3 py-2 text-xs text-cyan-200"
      >
        登记官方文件
      </button>
      <div className="mt-3 space-y-1">
        {rows.map(row => (
          <div
            key={row.id}
            className="grid gap-2 rounded border border-slate-800 p-2 text-xs md:grid-cols-[1fr_120px_110px]"
          >
            <span className="truncate text-cyan-100">
              {row.name}
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-[10px] text-slate-500 hover:text-cyan-300"
              >
                核验原始证据
              </a>
            </span>
            <select
              value={row.state}
              onChange={e =>
                setRows(items =>
                  items.map(item =>
                    item.id === row.id
                      ? { ...item, state: e.target.value as typeof row.state }
                      : item
                  )
                )
              }
              className="input-terminal text-xs"
            >
              <option>待核验</option>
              <option>已核验</option>
              <option>需补充</option>
            </select>
            <span className="text-slate-500">
              {row.category} · {row.date || "无日期"}
            </span>
          </div>
        ))}
        {!rows.length && (
          <AuditEmpty
            title="尚无官方文件登记"
            description="仅登记可核验的官方链接；浏览器会话外不会产生虚构资料。"
          />
        )}
      </div>
    </Card>
  );
}
function MmidxMulti({ snapshot }: { snapshot?: Snapshot }) {
  const [windowDays, setWindowDays] = useState(90);
  const series = (snapshot?.rates ?? [])
    .filter(item => ["SOFR", "EFFR", "IORB"].includes(item.id))
    .map(item => ({ ...item, history: item.history.slice(-windowDays) }));
  const dates = [
    ...new Set(series.flatMap(item => item.history.map(point => point.date))),
  ];
  const chart = dates.map(date =>
    Object.fromEntries([
      ["date", date],
      ...series.map(item => {
        const point = item.history.find(row => row.date === date);
        const base = item.history[0]?.value;
        return [
          item.id,
          point && base != null ? 100 + (point.value - base) * 100 : null,
        ];
      }),
    ])
  );
  return (
    <Card
      title="多基准归一化与变化归因"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "money-market-normalized-benchmarks.csv",
              ["日期", ...series.map(item => item.id)],
              chart.map(row => [
                String(row.date),
                ...series.map(item => row[item.id] as number | null),
              ])
            )
          }
          disabled={!chart.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="flex gap-1">
        {[30, 90, 180].map(days => (
          <button
            type="button"
            key={days}
            onClick={() => setWindowDays(days)}
            className={`rounded px-2 py-1 text-[11px] ${windowDays === days ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {days}D
          </button>
        ))}
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 9 }}
              minTickGap={28}
            />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "#020617",
                border: "1px solid #334155",
              }}
            />
            {series.map((item, index) => (
              <Line
                key={item.id}
                dataKey={item.id}
                name={`${item.label} = 100`}
                stroke={["#22d3ee", "#a78bfa", "#34d399"][index]}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        每条公开利率在各自窗口首个可用观察日重设为
        100；该展示仅表达利率变化，非许可指数、净值、总回报或投资表现。
      </p>
    </Card>
  );
}
function FraSettlement() {
  const [near, setNear] = useState("3.50");
  const [far, setFar] = useState("3.80");
  const [startDays, setStartDays] = useState("30");
  const [endDays, setEndDays] = useState("120");
  const [contract, setContract] = useState("3.65");
  const [notional, setNotional] = useState("1000000");
  const n = Number(near);
  const f = Number(far);
  const s = Number(startDays);
  const e = Number(endDays);
  const k = Number(contract);
  const amount = Number(notional);
  const delta = e - s;
  const forward =
    delta > 0 && s >= 0
      ? ((((1 + ((f / 100) * e) / 360) / (1 + ((n / 100) * s) / 360) - 1) *
          360) /
          delta) *
        100
      : null;
  const settlement =
    forward != null && Number.isFinite(amount)
      ? (((amount * (forward - k)) / 100) * delta) /
        360 /
        (1 + ((forward / 100) * delta) / 360)
      : null;
  const sensitivity = [-25, 0, 25].map(shift => {
    const scenario = forward == null ? null : forward + shift / 100;
    const cash =
      scenario == null
        ? null
        : (((amount * (scenario - k)) / 100) * delta) /
          360 /
          (1 + ((scenario / 100) * delta) / 360);
    return { shift, scenario, cash };
  });
  return (
    <Card title="合成 FRA 起止日与结算敏感度">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={near}
          onChange={e => setNear(e.target.value)}
          type="number"
          step="0.01"
          className="input-terminal text-xs"
          placeholder="近端年化%"
        />
        <input
          value={far}
          onChange={e => setFar(e.target.value)}
          type="number"
          step="0.01"
          className="input-terminal text-xs"
          placeholder="远端年化%"
        />
        <input
          value={contract}
          onChange={e => setContract(e.target.value)}
          type="number"
          step="0.01"
          className="input-terminal text-xs"
          placeholder="合同年化%"
        />
        <input
          value={startDays}
          onChange={e => setStartDays(e.target.value)}
          type="number"
          min="0"
          className="input-terminal text-xs"
          placeholder="起始天数"
        />
        <input
          value={endDays}
          onChange={e => setEndDays(e.target.value)}
          type="number"
          min="1"
          className="input-terminal text-xs"
          placeholder="结束天数"
        />
        <input
          value={notional}
          onChange={e => setNotional(e.target.value)}
          type="number"
          min="0"
          className="input-terminal text-xs"
          placeholder="名义金额"
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="输入驱动远期利率"
          value={forward == null ? "—" : `${forward.toFixed(4)}%`}
          tone="info"
        />
        <Metric
          label="净结算金额"
          value={
            settlement == null
              ? "—"
              : settlement.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
          }
        />
        <Metric label="计息区间" value={delta > 0 ? `${delta} 天` : "无效"} />
      </div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">远期冲击</th>
              <th className="p-2">情景远期</th>
              <th className="p-2">情景结算</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.map(row => (
              <tr key={row.shift} className="border-t border-slate-800">
                <td className="p-2">{row.shift} bp</td>
                <td className="p-2">{row.scenario?.toFixed(4) ?? "—"}%</td>
                <td className="p-2">
                  {row.cash?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        计算采用用户输入的简单 360
        日计息与折现结算约定；并非合约条款、交易所价格或 SOFR FRA 报价。
      </p>
    </Card>
  );
}
function EvidenceDelivery() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tag, setTag] = useState("政策");
  const [status, setStatus] = useState("待核验");
  const [filter, setFilter] = useState("全部");
  const [rows, setRows] = useState<
    Array<{
      id: number;
      title: string;
      url: string;
      tag: string;
      status: string;
      date: string;
    }>
  >([]);
  const add = () => {
    if (!title.trim() || !/^https:\/\//.test(url)) return;
    setRows(items => [
      ...items,
      {
        id: Date.now(),
        title: title.trim(),
        url,
        tag,
        status,
        date: new Date().toISOString().slice(0, 10),
      },
    ]);
    setTitle("");
    setUrl("");
  };
  const visible = rows.filter(
    row => filter === "全部" || row.tag === filter || row.status === filter
  );
  const options = [
    "全部",
    "政策",
    "拍卖",
    "参考利率",
    "流动性",
    "待核验",
    "已核验",
    "需补充",
  ];
  return (
    <Card
      title="证据台账筛选与双格式交付"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "money-market-evidence.csv",
              ["标题", "标签", "状态", "登记日", "原始链接"],
              visible.map(row => [
                row.title,
                row.tag,
                row.status,
                row.date,
                row.url,
              ])
            )
          }
          disabled={!visible.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input-terminal text-xs"
          placeholder="原始资料标题"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="input-terminal text-xs"
          placeholder="HTTPS 原始 URL"
        />
        <select
          value={tag}
          onChange={e => setTag(e.target.value)}
          className="input-terminal text-xs"
        >
          {["政策", "拍卖", "参考利率", "流动性"].map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="input-terminal text-xs"
        >
          {["待核验", "已核验", "需补充"].map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          className="rounded border border-cyan-800 text-xs text-cyan-200"
        >
          登记并标记
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {options.map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded px-2 py-1 text-[10px] ${filter === item ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {visible.map(row => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-2 rounded border border-slate-800 p-2 text-xs"
          >
            <span>
              <FileCheck2 className="mr-1 inline h-3 w-3 text-cyan-300" />
              {row.title} · {row.tag} · {row.status}
            </span>
            <a
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="max-w-52 truncate text-cyan-300"
            >
              原始链接
            </a>
          </div>
        ))}
        {!visible.length && (
          <AuditEmpty
            title="没有匹配的证据条目"
            description="登记 HTTPS 原始来源后可按标签和核验状态筛选导出。"
          />
        )}
      </div>
    </Card>
  );
}

function MarketWindowAnalytics({ snapshot }: { snapshot?: Snapshot }) {
  const [windowDays, setWindowDays] = useState(20);
  const ids = ["SOFR", "EFFR", "IORB", "DTB4WK", "DTB3", "DTB6"];
  const rows = ids
    .map(id => snapshot?.rates.find(item => item.id === id))
    .filter(Boolean) as Snapshot["rates"];
  const compare = rows.map(series => {
    const history = series.history;
    const latest = history.at(-1);
    const anchor = history.at(Math.max(0, history.length - windowDays));
    return {
      id: series.id,
      latest: latest?.value ?? null,
      date: latest?.date ?? null,
      change: latest && anchor ? (latest.value - anchor.value) * 100 : null,
      observations: history.length,
    };
  });
  return (
    <Card
      title="短端基准窗口变化监测"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "money-market-window-changes.csv",
              [
                "序列",
                "最近观察日",
                "最近值",
                `${windowDays}日变化(bp)`,
                "可用观察",
              ],
              compare.map(row => [
                row.id,
                row.date,
                row.latest,
                row.change,
                row.observations,
              ])
            )
          }
          className="text-xs text-cyan-300"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="mb-2 flex gap-1">
        {[5, 20, 60].map(value => (
          <button
            type="button"
            key={value}
            onClick={() => setWindowDays(value)}
            className={`rounded px-2 py-1 text-[11px] ${windowDays === value ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {value}D
          </button>
        ))}
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">基准</th>
              <th className="p-2">最近值</th>
              <th className="p-2">观察日</th>
              <th className="p-2">窗口变化</th>
              <th className="p-2">观察数</th>
            </tr>
          </thead>
          <tbody>
            {compare.map(row => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="p-2">{row.id}</td>
                <td className="p-2">
                  {row.latest == null ? "—" : `${row.latest.toFixed(3)}%`}
                </td>
                <td className="p-2">{row.date || "—"}</td>
                <td className="p-2">
                  {row.change == null ? "—" : `${row.change.toFixed(1)} bp`}
                </td>
                <td className="p-2">{row.observations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        仅比较公开历史观察的窗口变化；不同序列的频率、定义和发布时间可能不同，不应视为盘中资金成本或交易指令。
      </p>
    </Card>
  );
}
function BillAuctionStructure({ snapshot }: { snapshot?: Snapshot }) {
  const events =
    (
      snapshot as
        | (Snapshot & {
            treasuryAuctions?: Array<{
              securityTerm: string | null;
              cusip: string | null;
              auctionDate: string | null;
              issueDate: string | null;
              maturityDate: string | null;
              offeringAmount: string | null;
            }>;
          })
        | undefined
    )?.treasuryAuctions ?? [];
  const terms = [
    ...new Set(events.map(item => item.securityTerm || "未披露")),
  ].map(term => ({
    term,
    count: events.filter(item => (item.securityTerm || "未披露") === term)
      .length,
  }));
  const dated = events.flatMap(item =>
    item.maturityDate && item.issueDate
      ? [
          {
            ...item,
            days: Math.round(
              (new Date(item.maturityDate).getTime() -
                new Date(item.issueDate).getTime()) /
                86_400_000
            ),
          },
        ]
      : []
  );
  return (
    <Card
      title="国库券拍卖期限结构与到期梯度"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "treasury-bill-auction-structure.csv",
              [
                "CUSIP",
                "期限",
                "拍卖日",
                "发行日",
                "到期日",
                "原始发行额",
                "发行至到期天数",
              ],
              dated.map(row => [
                row.cusip,
                row.securityTerm,
                row.auctionDate,
                row.issueDate,
                row.maturityDate,
                row.offeringAmount,
                row.days,
              ])
            )
          }
          disabled={!dated.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-2">
        <div className="h-44">
          {terms.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={terms}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="term"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                  }}
                />
                <Bar dataKey="count" name="公开事件数" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <AuditEmpty
              title="无可用官方拍卖事件"
              description="财政部公开接口不可读时不构造发售日历。"
            />
          )}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="p-2">期限</th>
                <th className="p-2">事件数</th>
              </tr>
            </thead>
            <tbody>
              {terms.map(item => (
                <tr key={item.term} className="border-t border-slate-800">
                  <td className="p-2">{item.term}</td>
                  <td className="p-2">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-slate-500">
            结构基于当前可读的已发布财政部记录，不代表未来发行计划、分配资格或二级市场流动性。
          </p>
        </div>
      </div>
    </Card>
  );
}
function CurveStressSurface() {
  const [base, setBase] = useState("3.75");
  const [slope, setSlope] = useState("10");
  const terms = ["1M", "3M", "6M", "1Y"];
  const shocks = [-50, -25, 0, 25, 50];
  const data = shocks.map(shock => ({
    shock: `${shock} bp`,
    ...Object.fromEntries(
      terms.map((term, index) => [
        term,
        Number(base) + shock / 100 + (index * Number(slope)) / 100,
      ])
    ),
  }));
  return (
    <Card title="短端曲线压力面与节点比较">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-slate-500">
          起始年化利率 (%)
          <input
            value={base}
            onChange={e => setBase(e.target.value)}
            type="number"
            step="0.01"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          每节点斜率 (bp)
          <input
            value={slope}
            onChange={e => setSlope(e.target.value)}
            type="number"
            step="1"
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="shock" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "#020617",
                border: "1px solid #334155",
              }}
            />
            {terms.map((term, index) => (
              <Line
                key={term}
                dataKey={term}
                name={term}
                stroke={["#22d3ee", "#a78bfa", "#34d399", "#f59e0b"][index]}
                dot
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        所有节点和冲击都由当前输入即时重算；这是一张透明压力面，不含市场概率、校准参数或预测。
      </p>
    </Card>
  );
}
function CdiRealizedCompounding({ snapshot }: { snapshot?: Snapshot }) {
  const points =
    (
      snapshot as
        | (Snapshot & { cdi?: Array<{ date: string; valuePct: number }> })
        | undefined
    )?.cdi ?? [];
  const [count, setCount] = useState(20);
  const data = points.slice(-count);
  let factor = 1;
  const chart = data.map(item => {
    factor *= 1 + item.valuePct / 100;
    return { ...item, index: factor * 100 };
  });
  const realized = chart.length ? (chart.at(-1)?.index ?? 100) - 100 : null;
  return (
    <Card
      title="CDI 已实现复利路径与观察窗口"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "cdi-realized-compounding.csv",
              ["日期", "CDI日度值(%)", "累计因子(基准=100)"],
              chart.map(item => [item.date, item.valuePct, item.index])
            )
          }
          disabled={!chart.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="flex gap-1">
        {[5, 10, 20].map(value => (
          <button
            type="button"
            key={value}
            onClick={() => setCount(value)}
            className={`rounded px-2 py-1 text-[11px] ${count === value ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {value}D
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="观察数" value={String(chart.length)} />
        <Metric
          label="已实现累计变化"
          value={realized == null ? "—" : `${realized.toFixed(6)}%`}
          tone="info"
        />
        <Metric label="最近观察日" value={chart.at(-1)?.date || "—"} />
      </div>
      <div className="mt-3 h-44">
        {chart.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 9 }}
                minTickGap={28}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Line
                dataKey="index"
                name="累计因子（基准=100）"
                stroke="#34d399"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <AuditEmpty
            title="无可用 CDI 观察"
            description="巴西中央银行公开序列暂不可读时不估计利率或期货。"
          />
        )}
      </div>
    </Card>
  );
}
function TradePreparationScenario() {
  const [notional, setNotional] = useState("1000000");
  const [settlementDays, setSettlementDays] = useState("2");
  const [cutoffHours, setCutoffHours] = useState("3");
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [counterpartyConfirmed, setCounterpartyConfirmed] = useState(false);
  const amount = Number(notional);
  const days = Number(settlementDays);
  const hours = Number(cutoffHours);
  const readiness =
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isInteger(days) &&
    days >= 0 &&
    Number.isFinite(hours) &&
    hours >= 0 &&
    cashConfirmed &&
    counterpartyConfirmed;
  return (
    <Card title="交易准备的结算与控制情景">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={notional}
          onChange={e => setNotional(e.target.value)}
          type="number"
          min="0"
          className="input-terminal text-xs"
          placeholder="名义金额"
        />
        <input
          value={settlementDays}
          onChange={e => setSettlementDays(e.target.value)}
          type="number"
          min="0"
          className="input-terminal text-xs"
          placeholder="结算天数"
        />
        <input
          value={cutoffHours}
          onChange={e => setCutoffHours(e.target.value)}
          type="number"
          min="0"
          className="input-terminal text-xs"
          placeholder="距离内部截止小时"
        />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded border border-slate-800 p-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={cashConfirmed}
            onChange={e => setCashConfirmed(e.target.checked)}
          />
          已由授权渠道确认资金与结算账户
        </label>
        <label className="flex items-center gap-2 rounded border border-slate-800 p-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={counterpartyConfirmed}
            onChange={e => setCounterpartyConfirmed(e.target.checked)}
          />
          已由授权渠道确认交易对手与限额
        </label>
      </div>
      <div
        className={`mt-3 rounded border p-3 text-xs ${readiness ? "border-emerald-800 text-emerald-200" : "border-amber-800 text-amber-200"}`}
      >
        <CheckCircle2 className="mr-1 inline h-3 w-3" />
        {readiness
          ? `用户输入的 ${amount.toLocaleString()} 名义金额、T+${days} 结算和 ${hours} 小时内部截止控制项齐备。`
          : "须完成数值输入及两项授权确认，才可标记为内部流程就绪。"}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        该场景只检验用户输入的内部准备字段；不下单、不校验市场价格、不连接交易场所，也不模拟成交。
      </p>
    </Card>
  );
}
function TaiwanWindowStats({ snapshot }: { snapshot?: Snapshot }) {
  const points =
    (
      snapshot as
        | (Snapshot & {
            taiwanCallRate?: Array<{ date: string; valuePct: number }>;
          })
        | undefined
    )?.taiwanCallRate ?? [];
  const [count, setCount] = useState(20);
  const rows = points.slice(-count);
  const values = rows.map(item => item.valuePct);
  const mean = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
  const stdev =
    mean == null
      ? null
      : Math.sqrt(
          values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
            values.length
        );
  const change = values.length > 1 ? (values.at(-1)! - values[0]) * 100 : null;
  return (
    <Card
      title="台湾隔夜拆款窗口统计与变动分解"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "taiwan-overnight-window-stats.csv",
              ["日期", "隔夜拆款(%)"],
              rows.map(row => [row.date, row.valuePct])
            )
          }
          disabled={!rows.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="flex gap-1">
        {[10, 20, 60].map(value => (
          <button
            type="button"
            key={value}
            onClick={() => setCount(value)}
            className={`rounded px-2 py-1 text-[11px] ${count === value ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {value}D
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric
          label="窗口均值"
          value={mean == null ? "—" : `${mean.toFixed(4)}%`}
          tone="info"
        />
        <Metric
          label="窗口标准差"
          value={stdev == null ? "—" : `${stdev.toFixed(4)}%`}
        />
        <Metric
          label="首末变化"
          value={change == null ? "—" : `${change.toFixed(1)} bp`}
        />
        <Metric label="观察数" value={String(rows.length)} />
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        统计仅使用台湾中央银行可读的隔夜拆款观察；不将其外推为
        TAIBOR、期限拆款或下一期利率预测。
      </p>
    </Card>
  );
}

export default function MoneyMarketDepthEnhancer({
  moduleId,
  snapshot,
}: {
  moduleId: ModuleId;
  snapshot?: Snapshot;
}) {
  const component: Record<ModuleId, React.ReactNode> = {
    pgm: <ProjectGate />,
    mktbeat: <MarketWindowAnalytics snapshot={snapshot} />,
    btmm: <BillAuctionStructure snapshot={snapshot} />,
    tcon: <Corridor snapshot={snapshot} />,
    rv: <RvDistribution snapshot={snapshot} />,
    ycqsim: <CurveStressSurface />,
    gc: <CurveCoverage snapshot={snapshot} />,
    "crvf-mmkt": <SourceDiscovery snapshot={snapshot} comparative={false} />,
    crvf: <SourceDiscovery snapshot={snapshot} comparative />,
    fibc: <FibcSensitivity />,
    cdie: <CdiRealizedCompounding snapshot={snapshot} />,
    efsf: <OfficialRegister type="efsf" />,
    mmidx: <MmidxMulti snapshot={snapshot} />,
    etrade: <TradePreparationScenario />,
    edsf: <FraSettlement />,
    pboc: <OfficialRegister type="pboc" />,
    twdi: <TaiwanWindowStats snapshot={snapshot} />,
    "news-mm": <EvidenceDelivery />,
  };
  return <div className="mt-3">{component[moduleId]}</div>;
}
