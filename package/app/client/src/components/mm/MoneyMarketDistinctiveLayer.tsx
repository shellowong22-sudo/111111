import { useMemo, useState } from "react";
import {
  Download,
  FileCheck2,
  Landmark,
  Layers3,
  TimerReset,
} from "lucide-react";
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
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";
import SourceFreshnessPreferences from "./SourceFreshnessPreferences";
import MmflowDeliveryReviewPanel from "./MmflowDeliveryReviewPanel";
import MoneyMarketResearchPath from "./MoneyMarketResearchPath";
import SourceRuleGovernance, {
  SharedSourceRuleEditors,
} from "./SourceRuleGovernance";
import MmflowVersionGovernance from "./MmflowVersionGovernance";
import {
  MoneyMarketModuleDiagnostics,
  SourceAvailabilityHistory,
} from "./MoneyMarketObservability";

type Rate = {
  id: string;
  label: string;
  value: number | null;
  observationDate: string | null;
  history: Array<{ date: string; value: number }>;
  status: "available" | "unavailable";
  limitation: string;
};
type Auction = {
  securityTerm: string | null;
  cusip: string | null;
  auctionDate: string | null;
  issueDate: string | null;
  maturityDate: string | null;
  offeringAmount: string | null;
};
type Source = {
  id: string;
  label: string;
  region: string;
  frequency: string;
  url: string;
  scope: string;
};
export type DistinctMoneyMarketModuleId =
  | "des-mm"
  | "pgm"
  | "mktbeat"
  | "btmm"
  | "boom"
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
  | "wbf"
  | "pboc"
  | "twdi"
  | "cenb"
  | "news-mm"
  | "source-mm"
  | "mmflow";
type Snapshot = {
  rates: Rate[];
  sources: Source[];
  treasuryAuctions?: Auction[];
};

function exportCsv(
  name: string,
  headings: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  const quote = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const href = URL.createObjectURL(
    new Blob(
      [
        `\uFEFF${[headings, ...rows].map(row => row.map(quote).join(",")).join("\r\n")}`,
      ],
      { type: "text/csv;charset=utf-8" }
    )
  );
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(href);
}
function Empty({ children }: { children: string }) {
  return (
    <p className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-500">
      {children}
    </p>
  );
}
function bps(value: number | null) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${value.toFixed(1)} bp`;
}
function sourceForRate(snapshot: Snapshot | undefined, id: string) {
  const rate = snapshot?.rates.find(item => item.id === id);
  return rate
    ? {
        id,
        label: rate.label,
        date: rate.observationDate,
        observations: rate.history.length,
        state: rate.status,
      }
    : null;
}

function DesContract({ snapshot }: { snapshot?: Snapshot }) {
  const [left, setLeft] = useState("SOFR");
  const [right, setRight] = useState("EFFR");
  const leftRow = sourceForRate(snapshot, left);
  const rightRow = sourceForRate(snapshot, right);
  return (
    <Card
      title="DES · 字段口径对照卡"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "des-money-market-data-contract.csv",
              ["序列", "最近观察日", "可用观察数", "状态"],
              [leftRow, rightRow]
                .filter(Boolean)
                .map(item => [
                  item!.label,
                  item!.date,
                  item!.observations,
                  item!.state,
                ])
            )
          }
          className="text-xs text-cyan-300"
        >
          <Download className="mr-1 inline h-3 w-3" />
          导出口径卡
        </button>
      }
    >
      <p className="mb-2 text-[11px] text-slate-500">
        用于核对两条公开序列的观察覆盖与可比边界；该卡不混合利率口径，也不产生市场结论。
      </p>
      <div className="grid gap-2 md:grid-cols-2">
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
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {[leftRow, rightRow].map(row =>
          row ? (
            <div key={row.id} className="rounded border border-slate-800 p-3">
              <b className="text-xs text-cyan-100">{row.label}</b>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                <span>
                  观察日
                  <br />
                  <strong className="text-slate-300">{row.date || "—"}</strong>
                </span>
                <span>
                  覆盖
                  <br />
                  <strong className="text-slate-300">{row.observations}</strong>
                </span>
                <span>
                  状态
                  <br />
                  <strong className="text-slate-300">
                    {row.state === "available" ? "可读" : "不可读"}
                  </strong>
                </span>
              </div>
            </div>
          ) : null
        )}
      </div>
    </Card>
  );
}

function PgmMandate({ snapshot }: { snapshot?: Snapshot }) {
  const [topic, setTopic] = useState("");
  const [purpose, setPurpose] = useState("资料核验");
  const [sourceId, setSourceId] = useState("FRED-SOFR");
  const selected = snapshot?.sources.find(item => item.id === sourceId);
  const ready = Boolean(topic.trim() && selected);
  return (
    <Card
      title="PGM · 研究委托范围卡"
      action={<FileCheck2 className="h-4 w-4 text-cyan-300" />}
    >
      <p className="mb-2 text-[11px] text-slate-500">
        把研究主题、目的和已核验公开来源组成当前会话范围卡；它不是任务台账，也不会替用户创建截止日期或研究结论。
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="input-terminal text-xs"
          placeholder="研究主题"
        />
        <select
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>资料核验</option>
          <option>市场观察</option>
          <option>发行日程准备</option>
          <option>交付来源清单</option>
        </select>
        <select
          value={sourceId}
          onChange={e => setSourceId(e.target.value)}
          className="input-terminal text-xs"
        >
          {snapshot?.sources.map(item => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {ready ? (
        <div className="mt-3 rounded border border-cyan-900 bg-cyan-950/20 p-3 text-xs">
          <b className="text-cyan-100">当前范围：</b>
          {topic.trim()} · {purpose}
          <br />
          <span className="text-slate-400">
            来源：{selected!.label} · {selected!.region} · {selected!.frequency}
          </span>
          <button
            type="button"
            onClick={() =>
              exportCsv(
                "pgm-research-mandate.csv",
                ["主题", "目的", "来源", "地区", "频率", "原始链接"],
                [
                  [
                    topic.trim(),
                    purpose,
                    selected!.label,
                    selected!.region,
                    selected!.frequency,
                    selected!.url,
                  ],
                ]
              )
            }
            className="ml-3 text-cyan-300"
          >
            导出范围卡
          </button>
        </div>
      ) : (
        <Empty>
          输入主题并选择一个已核验公开来源后，才能生成可导出的研究范围卡。
        </Empty>
      )}
    </Card>
  );
}

function MktbeatAlignment({ snapshot }: { snapshot?: Snapshot }) {
  const rows = ["SOFR", "EFFR", "IORB", "DTB4WK", "DTB3", "DTB6"]
    .map(id => snapshot?.rates.find(item => item.id === id))
    .filter(Boolean) as Rate[];
  const data = rows.map(item => {
    const history = item.history;
    const last = history.at(-1);
    const anchor = history.at(Math.max(0, history.length - 21));
    return {
      id: item.id,
      label: item.label,
      date: last?.date || "—",
      observations: history.length,
      change20: last && anchor ? (last.value - anchor.value) * 100 : null,
    };
  });
  return (
    <Card
      title="MKTBEAT · 观察发布对齐监测"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "mktbeat-release-alignment.csv",
              ["序列", "最近观察日", "可用观察", "20日变化(bp)"],
              data.map(item => [
                item.id,
                item.date,
                item.observations,
                item.change20,
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
      <div className="overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">公开基准</th>
              <th className="p-2">最近观察日</th>
              <th className="p-2">覆盖</th>
              <th className="p-2 text-right">20日变化</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id} className="border-t border-slate-800">
                <td className="p-2 text-cyan-100">{item.label}</td>
                <td className="p-2 text-slate-400">{item.date}</td>
                <td className="p-2 text-slate-400">{item.observations}</td>
                <td className="p-2 text-right text-slate-300">
                  {bps(item.change20)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        该视图专注于公开观察发布的对齐与缺口，不将不同发布时间解释为盘中资金紧张或市场信号。
      </p>
    </Card>
  );
}

function BtmmCadence({ snapshot }: { snapshot?: Snapshot }) {
  const events = snapshot?.treasuryAuctions ?? [];
  const rows = useMemo(
    () =>
      Object.entries(
        events.reduce<Record<string, number>>((map, item) => {
          const day = item.auctionDate
            ? new Date(`${item.auctionDate}T00:00:00Z`).toLocaleDateString(
                "en-US",
                { weekday: "short", timeZone: "UTC" }
              )
            : "未披露";
          map[day] = (map[day] || 0) + 1;
          return map;
        }, {})
      ).map(([weekday, events]) => ({ weekday, events })),
    [events]
  );
  return (
    <Card
      title="BTMM · 官方拍卖节奏画像"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "btmm-auction-cadence.csv",
              ["拍卖星期", "公开事件数"],
              rows.map(item => [item.weekday, item.events])
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
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="已发布事件" value={String(events.length)} tone="info" />
        <Metric
          label="有 CUSIP 记录"
          value={String(events.filter(item => item.cusip).length)}
        />
        <Metric
          label="期限类型"
          value={String(
            new Set(events.map(item => item.securityTerm || "未披露")).size
          )}
        />
      </div>
      <div className="mt-3 h-40">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="weekday"
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
              <Bar dataKey="events" name="公开事件数" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty>财政部公开拍卖事件暂不可读；不构造发售节奏。</Empty>
        )}
      </div>
    </Card>
  );
}

function BoomHorizon({ snapshot }: { snapshot?: Snapshot }) {
  const today = new Date();
  const rows = (snapshot?.treasuryAuctions ?? [])
    .flatMap(item => {
      if (!item.auctionDate) return [];
      const days = Math.ceil(
        (new Date(`${item.auctionDate}T00:00:00Z`).getTime() -
          Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate()
          )) /
          86_400_000
      );
      return days >= 0 && days <= 45 ? [{ ...item, days }] : [];
    })
    .sort((a, b) => a.days - b.days);
  return (
    <Card
      title="BOOM · 未来 45 日官方事件地平线"
      action={<TimerReset className="h-4 w-4 text-amber-300" />}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="未来事件" value={String(rows.length)} tone="info" />
        <Metric label="最近事件" value={rows[0]?.auctionDate || "—"} />
        <Metric label="最近期限" value={rows[0]?.securityTerm || "—"} />
      </div>
      <div className="mt-3 max-h-40 overflow-auto">
        {rows.length ? (
          rows.slice(0, 8).map((item, index) => (
            <div
              key={`${item.cusip}-${index}`}
              className="flex justify-between border-t border-slate-800 px-2 py-1.5 text-xs"
            >
              <span>
                {item.securityTerm || "未披露"} · {item.cusip || "CUSIP 待披露"}
              </span>
              <span className="text-amber-200">
                {item.days === 0 ? "今日" : `${item.days} 日后`} ·{" "}
                {item.auctionDate}
              </span>
            </div>
          ))
        ) : (
          <Empty>未来 45 日没有当前快照内可用的已发布拍卖记录。</Empty>
        )}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        仅定位已发布的官方事件，不能代表申购资格、分配结果或未来未公布发行。
      </p>
    </Card>
  );
}

function TconDecomposition({ snapshot }: { snapshot?: Snapshot }) {
  const sofr = snapshot?.rates.find(item => item.id === "SOFR")?.value ?? null;
  const effr = snapshot?.rates.find(item => item.id === "EFFR")?.value ?? null;
  const iorb = snapshot?.rates.find(item => item.id === "IORB")?.value ?? null;
  const [limit, setLimit] = useState("10");
  const inner = effr != null && iorb != null ? (effr - iorb) * 100 : null;
  const secured = sofr != null && effr != null ? (sofr - effr) * 100 : null;
  return (
    <Card title="TCON · 走廊分解与容许带">
      <div className="grid gap-2 md:grid-cols-3">
        <Metric label="EFFR 相对 IORB" value={bps(inner)} tone="info" />
        <Metric label="SOFR 相对 EFFR" value={bps(secured)} tone="info" />
        <label className="text-xs text-slate-500">
          容许带（bp）
          <input
            type="number"
            min="0"
            value={limit}
            onChange={e => setLimit(e.target.value)}
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 rounded border border-slate-800 p-3 text-xs text-slate-400">
        {inner == null || secured == null ? (
          "可读的公开利率不足，无法分解走廊。"
        ) : (
          <>
            内部准备金腿 {Math.abs(inner) <= Number(limit) ? "位于" : "超出"}
            用户容许带；有担保隔夜腿为 {bps(secured)}
            。该结果仅为公开日度观察分解。
          </>
        )}
      </div>
    </Card>
  );
}

function RvMatrix({ snapshot }: { snapshot?: Snapshot }) {
  const pairs = [
    ["SOFR", "EFFR"],
    ["EFFR", "IORB"],
    ["SOFR", "IORB"],
  ] as const;
  const rows = pairs.map(([left, right]) => {
    const a = snapshot?.rates.find(item => item.id === left);
    const b = snapshot?.rates.find(item => item.id === right);
    const values = (a?.history ?? []).flatMap(point => {
      const match = b?.history.find(item => item.date === point.date);
      return match ? [(point.value - match.value) * 100] : [];
    });
    const current = values.at(-1) ?? null;
    const mean = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
    const percentile =
      current != null && values.length
        ? (values.filter(value => value <= current).length / values.length) *
          100
        : null;
    return {
      pair: `${left} − ${right}`,
      current,
      mean,
      percentile,
      observations: values.length,
    };
  });
  return (
    <Card
      title="RV · 三对基准差值位置矩阵"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "rv-pair-matrix.csv",
              ["配对", "当前差值(bp)", "历史均值(bp)", "百分位", "同日观察数"],
              rows.map(item => [
                item.pair,
                item.current,
                item.mean,
                item.percentile,
                item.observations,
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
      <div className="overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">同日配对</th>
              <th className="p-2">当前</th>
              <th className="p-2">均值</th>
              <th className="p-2">位置</th>
              <th className="p-2">观察</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => (
              <tr key={item.pair} className="border-t border-slate-800">
                <td className="p-2 text-violet-200">{item.pair}</td>
                <td className="p-2">{bps(item.current)}</td>
                <td className="p-2">{bps(item.mean)}</td>
                <td className="p-2">
                  {item.percentile == null
                    ? "—"
                    : `${item.percentile.toFixed(1)}%`}
                </td>
                <td className="p-2">{item.observations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function YcqsimGrid() {
  const [base, setBase] = useState("3.50");
  const [slope, setSlope] = useState("8");
  const [shock, setShock] = useState("25");
  const terms = ["1M", "3M", "6M", "1Y"];
  const rows = terms.map((term, index) => ({
    term,
    base: Number(base) + (index * Number(slope)) / 100,
    stressed:
      Number(base) + Number(shock) / 100 + (index * Number(slope)) / 100,
  }));
  return (
    <Card
      title="YCQSIM · 节点冲击交付网格"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "ycqsim-node-stress-grid.csv",
              ["节点", "基础年化(%)", "冲击后年化(%)"],
              rows.map(row => [row.term, row.base, row.stressed])
            )
          }
          className="text-xs text-cyan-300"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs text-slate-500">
          基准年化 %
          <input
            value={base}
            onChange={e => setBase(e.target.value)}
            type="number"
            step="0.01"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          节点斜率 bp
          <input
            value={slope}
            onChange={e => setSlope(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          平行冲击 bp
          <input
            value={shock}
            onChange={e => setShock(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {rows.map(row => (
          <div
            key={row.term}
            className="rounded border border-slate-800 p-2 text-xs"
          >
            <b className="text-amber-200">{row.term}</b>
            <p className="mt-1 text-slate-400">基础 {row.base.toFixed(3)}%</p>
            <p className="text-cyan-200">冲击后 {row.stressed.toFixed(3)}%</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        网格完全由当前输入生成，用于透明的短端情景交付，不代表市场隐含概率或预测。
      </p>
    </Card>
  );
}

function GcEvidenceManifest({ snapshot }: { snapshot?: Snapshot }) {
  const [selected, setSelected] = useState<string[]>(["SOFR", "EFFR", "DTB3"]);
  const rows = (snapshot?.rates ?? [])
    .filter(item => selected.includes(item.id))
    .map(item => ({
      id: item.id,
      label: item.label,
      first: item.history.at(0)?.date || null,
      last: item.history.at(-1)?.date || item.observationDate,
      observations: item.history.length,
      state: item.status,
    }));
  const toggle = (id: string) =>
    setSelected(items =>
      items.includes(id) ? items.filter(item => item !== id) : [...items, id]
    );
  return (
    <Card
      title="GC · 图表证据清单"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "gc-chart-evidence-manifest.csv",
              ["序列", "起始观察", "最近观察", "可用观察", "状态"],
              rows.map(item => [
                item.label,
                item.first,
                item.last,
                item.observations,
                item.state,
              ])
            )
          }
          disabled={!rows.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          导出证据清单
        </button>
      }
    >
      <p className="mb-2 text-[11px] text-slate-500">
        与图表绘制不同，这里锁定本次报告选择的序列覆盖、起止观察与可读状态，便于在导出前核对来源证据。
      </p>
      <div className="flex flex-wrap gap-2">
        {snapshot?.rates.map(item => (
          <label key={item.id} className="text-xs text-slate-400">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
            />{" "}
            {item.id}
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {rows.map(item => (
          <div
            key={item.id}
            className="rounded border border-slate-800 p-2 text-xs"
          >
            <b className="text-cyan-100">{item.label}</b>
            <p className="mt-1 text-slate-500">
              {item.first || "—"} 至 {item.last || "—"} · {item.observations} 条
            </p>
            <p className="text-slate-400">
              {item.state === "available" ? "公开序列可读" : "当前不可读"}
            </p>
          </div>
        ))}
      </div>
      {!rows.length && (
        <Empty>请选择至少一条当前公开序列；不以示例曲线替代。</Empty>
      )}
    </Card>
  );
}

function CrvfMoneyRoute({ snapshot }: { snapshot?: Snapshot }) {
  const [purpose, setPurpose] = useState("参考利率");
  const types = (snapshot?.sources ?? []).map(source => ({
    ...source,
    kind:
      source.id === "TREASURY-AUCTIONS"
        ? "拍卖日程"
        : source.id === "BCB-CDI" || source.id === "CBC-CALL"
          ? "本地拆款"
          : source.id.includes("FRED")
            ? "参考利率"
            : "机构/政策资料",
  }));
  const rows = types.filter(
    item => purpose === "全部" || item.kind === purpose
  );
  return (
    <Card title="CRVF MMKT · 货币市场资料路由器">
      <p className="mb-2 text-[11px] text-slate-500">
        先在终端内按资料类别与地区路由；原始页面仅在需要核验字段时展开，不会替代本页来源信息。
      </p>
      <div className="flex flex-wrap gap-1">
        {["全部", "参考利率", "拍卖日程", "本地拆款", "机构/政策资料"].map(
          item => (
            <button
              type="button"
              key={item}
              onClick={() => setPurpose(item)}
              className={`rounded px-2 py-1 text-[11px] ${purpose === item ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
            >
              {item}
            </button>
          )
        )}
      </div>
      <div className="mt-3 space-y-1">
        {rows.map(item => (
          <div
            key={item.id}
            className="flex items-start justify-between rounded border border-slate-800 p-2 text-xs"
          >
            <span className="text-slate-200">
              {item.label}
              <span className="ml-2 text-slate-500">
                {item.kind} · {item.region} · {item.frequency}
              </span>
            </span>
            <details className="text-right">
              <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-cyan-300">
                原始证据（可选）
              </summary>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-[10px] text-cyan-300"
              >
                打开核验来源
              </a>
            </details>
          </div>
        ))}
        {!rows.length && (
          <Empty>没有匹配的已核验公开资料；不推荐未经授权的报价来源。</Empty>
        )}
      </div>
    </Card>
  );
}

function CrvfCompatibility({ snapshot }: { snapshot?: Snapshot }) {
  const [region, setRegion] = useState("全部");
  const rows = (snapshot?.sources ?? [])
    .filter(item => region === "全部" || item.region === region)
    .map(item => ({
      label: item.label,
      region: item.region,
      frequency: item.frequency,
      compatible: /日|daily/i.test(item.frequency)
        ? "可与日度观察并列核对"
        : "仅作来源口径比较",
    }));
  const regions = [
    ...new Set((snapshot?.sources ?? []).map(item => item.region)),
  ];
  return (
    <Card title="CRVF · 跨来源计量兼容性判定">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setRegion("全部")}
          className={`rounded px-2 py-1 text-[11px] ${region === "全部" ? "bg-violet-900 text-violet-100" : "text-slate-500"}`}
        >
          全部
        </button>
        {regions.map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setRegion(item)}
            className={`rounded px-2 py-1 text-[11px] ${region === item ? "bg-violet-900 text-violet-100" : "text-slate-500"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">来源</th>
              <th className="p-2">地区</th>
              <th className="p-2">频率</th>
              <th className="p-2">并列边界</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => (
              <tr key={item.label} className="border-t border-slate-800">
                <td className="p-2 text-violet-100">{item.label}</td>
                <td className="p-2">{item.region}</td>
                <td className="p-2">{item.frequency}</td>
                <td className="p-2 text-slate-400">{item.compatible}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        判定只说明观察频率是否可并列核对，不将不同币种、市场或定义转换成统一收益率。
      </p>
    </Card>
  );
}

function FibcDayCountBridge() {
  const [face, setFace] = useState("1000000");
  const [price, setPrice] = useState("990000");
  const [days, setDays] = useState("90");
  const f = Number(face);
  const p = Number(price);
  const d = Number(days);
  const rows = [360, 365].map(basis => ({
    basis,
    discount:
      f > 0 && p > 0 && d > 0 ? ((((f - p) / f) * basis) / d) * 100 : null,
    investment: p > 0 && d > 0 ? ((((f - p) / p) * basis) / d) * 100 : null,
  }));
  return (
    <Card title="FIBC · 日计数口径桥接">
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
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {rows.map(row => (
          <div
            key={row.basis}
            className="rounded border border-slate-800 p-3 text-xs"
          >
            <b className="text-cyan-100">{row.basis} 日基准</b>
            <p className="mt-1 text-slate-400">
              贴现率：
              {row.discount == null ? "—" : `${row.discount.toFixed(4)}%`}
            </p>
            <p className="text-slate-400">
              投资收益率：
              {row.investment == null ? "—" : `${row.investment.toFixed(4)}%`}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        展示同一组用户输入在 360/365
        日计数下的透明差异；实际证券惯例和条款须以原始文件为准。
      </p>
    </Card>
  );
}

function CdieAccrualLadder({ snapshot }: { snapshot?: Snapshot }) {
  const points =
    (
      snapshot as
        | (Snapshot & { cdi?: Array<{ date: string; valuePct: number }> })
        | undefined
    )?.cdi ?? [];
  const horizons = [5, 10, 20].map(days => {
    let factor = 1;
    points.slice(-days).forEach(item => {
      factor *= 1 + item.valuePct / 100;
    });
    return {
      days,
      observations: points.slice(-days).length,
      realized: points.length ? (factor - 1) * 100 : null,
      last: points.at(-1)?.date || null,
    };
  });
  return (
    <Card
      title="CDIE · CDI 已实现计息梯度"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "cdie-accrual-ladder.csv",
              ["窗口", "观察数", "已实现变化(%)", "最近观察日"],
              horizons.map(item => [
                item.days,
                item.observations,
                item.realized,
                item.last,
              ])
            )
          }
          disabled={!points.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-3">
        {horizons.map(item => (
          <div
            key={item.days}
            className="rounded border border-slate-800 p-3 text-xs"
          >
            <b className="text-emerald-200">{item.days} 日窗口</b>
            <p className="mt-1 text-slate-400">观察数：{item.observations}</p>
            <p className="text-slate-300">
              已实现变化：
              {item.realized == null ? "—" : `${item.realized.toFixed(6)}%`}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        仅使用 BCB 可读 CDI 历史观察计算已实现路径，不将其外推为 DI
        期货价格或未来收益。
      </p>
    </Card>
  );
}

function EfsfProvenance() {
  const [url, setUrl] = useState("https://www.efsf.europa.eu/");
  const [documentType, setDocumentType] = useState("EMTN");
  let valid = false;
  let host = "—";
  try {
    host = new URL(url).hostname;
    valid = host.endsWith("efsf.europa.eu");
  } catch {
    /* controlled invalid state */
  }
  return (
    <Card
      title="EFSF · 原始文件来源资格卡"
      action={<Landmark className="h-4 w-4 text-amber-300" />}
    >
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="input-terminal text-xs"
          placeholder="EFSF 官方文件 URL"
        />
        <select
          value={documentType}
          onChange={e => setDocumentType(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>EMTN</option>
          <option>投资者资料</option>
          <option>新闻稿</option>
          <option>融资计划</option>
        </select>
      </div>
      <div
        className={`mt-3 rounded border p-3 text-xs ${valid ? "border-emerald-800 text-emerald-200" : "border-amber-800 text-amber-200"}`}
      >
        {valid ? (
          <>
            域名 {host} 符合 EFSF 官方来源资格；文件类型：{documentType}
            。请继续在原件中核对条款与发布日期。
          </>
        ) : (
          <>
            当前链接不属于 efsf.europa.eu 官方域名，不能作为 EFSF 文件证据登记。
          </>
        )}
      </div>
    </Card>
  );
}

function MmidxDispersion({ snapshot }: { snapshot?: Snapshot }) {
  const series = (snapshot?.rates ?? []).filter(item =>
    ["SOFR", "EFFR", "IORB"].includes(item.id)
  );
  const dates = [
    ...new Set(series.flatMap(item => item.history.map(point => point.date))),
  ].slice(-90);
  const rows = dates.flatMap(date => {
    const values = series.flatMap(item =>
      item.history
        .filter(point => point.date === date)
        .map(point => point.value)
    );
    return values.length > 1
      ? [{ date, range: (Math.max(...values) - Math.min(...values)) * 100 }]
      : [];
  });
  const latest = rows.at(-1)?.range ?? null;
  return (
    <Card
      title="MMIDX · 基准离散带宽监测"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "mmidx-dispersion-band.csv",
              ["日期", "SOFR/EFFR/IORB 离散带宽(bp)"],
              rows.map(item => [item.date, item.range])
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
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="最近离散带宽" value={bps(latest)} tone="info" />
        <Metric
          label="90日最大"
          value={bps(
            rows.length ? Math.max(...rows.map(item => item.range)) : null
          )}
        />
        <Metric label="同日观察" value={String(rows.length)} />
      </div>
      <div className="mt-3 h-40">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
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
              <Bar dataKey="range" name="离散带宽(bp)" fill="#a78bfa" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty>同日公开观察不足，无法计算离散带宽。</Empty>
        )}
      </div>
    </Card>
  );
}

function EtradeReleaseControl() {
  const [cutoff, setCutoff] = useState("16:00");
  const [settlement, setSettlement] = useState("T+1");
  const [evidence, setEvidence] = useState(false);
  const [approval, setApproval] = useState(false);
  const ready = /^\d{2}:\d{2}$/.test(cutoff) && evidence && approval;
  return (
    <Card title="ETRADE · 结算释放控制卡">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-slate-500">
          内部截止时间
          <input
            value={cutoff}
            onChange={e => setCutoff(e.target.value)}
            type="time"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          用户确认结算约定
          <select
            value={settlement}
            onChange={e => setSettlement(e.target.value)}
            className="input-terminal mt-1 w-full"
          >
            <option>T+0</option>
            <option>T+1</option>
            <option>T+2</option>
            <option>待核验</option>
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="rounded border border-slate-800 p-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={evidence}
            onChange={e => setEvidence(e.target.checked)}
          />{" "}
          已留存授权价格/条款来源
        </label>
        <label className="rounded border border-slate-800 p-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={approval}
            onChange={e => setApproval(e.target.checked)}
          />{" "}
          已完成内部审批确认
        </label>
      </div>
      <div
        className={`mt-3 rounded border p-3 text-xs ${ready ? "border-emerald-800 text-emerald-200" : "border-amber-800 text-amber-200"}`}
      >
        {ready
          ? `释放前控制项齐备：${settlement} · 截止 ${cutoff}。`
          : "尚未完成来源留存与审批确认；此卡不下单、不连接交易场所。"}
      </div>
    </Card>
  );
}

function EdsfLifecycle() {
  const [startDays, setStartDays] = useState("30");
  const [endDays, setEndDays] = useState("120");
  const [basis, setBasis] = useState("360");
  const start = Number(startDays);
  const end = Number(endDays);
  const fraction =
    end > start && Number(basis) > 0 ? (end - start) / Number(basis) : null;
  return (
    <Card title="EDSF · FRA 生命周期与结算区间卡">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs text-slate-500">
          起始天数
          <input
            value={startDays}
            onChange={e => setStartDays(e.target.value)}
            type="number"
            min="0"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          结束天数
          <input
            value={endDays}
            onChange={e => setEndDays(e.target.value)}
            type="number"
            min="1"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          日计数
          <select
            value={basis}
            onChange={e => setBasis(e.target.value)}
            className="input-terminal mt-1 w-full"
          >
            <option value="360">ACT/360 输入</option>
            <option value="365">ACT/365 输入</option>
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="远期区间"
          value={end > start ? `${start}–${end} 日` : "无效"}
          tone="info"
        />
        <Metric
          label="计息天数"
          value={end > start ? String(end - start) : "—"}
        />
        <Metric
          label="输入年化分数"
          value={fraction == null ? "—" : fraction.toFixed(6)}
        />
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        本卡仅校验用户输入的 FRA
        起止区间和日计数，实际合约日期、付款日和结算条款必须以已授权确认书为准。
      </p>
    </Card>
  );
}

function WbfConversionBridge() {
  const [future, setFuture] = useState("110");
  const [cash, setCash] = useState("108");
  const [factor, setFactor] = useState("0.9");
  const f = Number(future);
  const c = Number(cash);
  const cf = Number(factor);
  const rows = [-0.01, 0, 0.01].map(shift => ({
    shift: shift * 100,
    converted: f * (cf + shift),
    basis: c - f * (cf + shift),
  }));
  return (
    <Card title="WBF · 转换因子基差桥接">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={future}
          onChange={e => setFuture(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="用户期货价格"
        />
        <input
          value={cash}
          onChange={e => setCash(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="用户现金价格"
        />
        <input
          value={factor}
          onChange={e => setFactor(e.target.value)}
          type="number"
          step="0.0001"
          className="input-terminal text-xs"
          placeholder="转换因子"
        />
      </div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">因子冲击</th>
              <th className="p-2">转换后期货</th>
              <th className="p-2">现金减转换期货</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.shift} className="border-t border-slate-800">
                <td className="p-2">{row.shift.toFixed(1)}%</td>
                <td className="p-2">
                  {Number.isFinite(row.converted)
                    ? row.converted.toFixed(5)
                    : "—"}
                </td>
                <td className="p-2 text-cyan-100">
                  {Number.isFinite(row.basis) ? row.basis.toFixed(5) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        所有价格和转换因子均为用户核验输入；此桥接不识别
        CTD、不提供实时期货报价，也不构成交易指令。
      </p>
    </Card>
  );
}

function PbocDomainGate({ snapshot }: { snapshot?: Snapshot }) {
  const source = snapshot?.sources.find(item => item.id === "PBOC");
  const [url, setUrl] = useState(source?.url || "https://www.pbc.gov.cn/");
  let host = "—";
  let valid = false;
  try {
    host = new URL(url).hostname;
    valid = host.endsWith("pbc.gov.cn");
  } catch {
    /* invalid URL remains a controlled state */
  }
  return (
    <Card title="PBOC · 官方公告域名资格闸门">
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="input-terminal w-full text-xs"
        placeholder="人民银行官方公告 URL"
      />
      <div
        className={`mt-3 rounded border p-3 text-xs ${valid ? "border-emerald-800 text-emerald-200" : "border-amber-800 text-amber-200"}`}
      >
        {valid ? (
          <>
            域名 {host} 属于 pbc.gov.cn 官方范围，可进入证据高亮与协作工作流。
          </>
        ) : (
          <>
            当前链接不属于 pbc.gov.cn 官方范围，不能作为人民银行原始公告证据。
          </>
        )}
      </div>
    </Card>
  );
}

function TwdiQuality({ snapshot }: { snapshot?: Snapshot }) {
  const points =
    (
      snapshot as
        | (Snapshot & {
            taiwanCallRate?: Array<{ date: string; valuePct: number }>;
          })
        | undefined
    )?.taiwanCallRate ?? [];
  const rows = points.slice(-60);
  const gaps = rows
    .slice(1)
    .filter(
      (item, index) =>
        new Date(`${item.date}T00:00:00Z`).getTime() -
          new Date(`${rows[index].date}T00:00:00Z`).getTime() >
        5 * 86_400_000
    ).length;
  const moves = rows
    .slice(1)
    .map((item, index) => (item.valuePct - rows[index].valuePct) * 100);
  return (
    <Card
      title="TWDI · 公开观察完整性与日变动审计"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "twdi-observation-quality.csv",
              ["日期", "隔夜拆款(%)"],
              rows.map(item => [item.date, item.valuePct])
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
      <div className="grid gap-2 sm:grid-cols-4">
        <Metric label="60日观察" value={String(rows.length)} tone="info" />
        <Metric label="疑似间隔" value={String(gaps)} />
        <Metric
          label="最大单日变化"
          value={bps(moves.length ? Math.max(...moves.map(Math.abs)) : null)}
        />
        <Metric label="最近观察" value={rows.at(-1)?.date || "—"} />
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        审计只描述公开观察是否连续及已发生的日变动，不推断下一期拆款或期限利率。
      </p>
    </Card>
  );
}

function CenbTopology({ snapshot }: { snapshot?: Snapshot }) {
  const rows = Object.entries(
    (snapshot?.sources ?? []).reduce<Record<string, number>>((map, item) => {
      map[item.region] = (map[item.region] || 0) + 1;
      return map;
    }, {})
  ).map(([region, count]) => ({ region, count }));
  return (
    <Card
      title="CENB · 央行与公开来源覆盖拓扑"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "cenb-source-topology.csv",
              ["地区", "已核验来源数"],
              rows.map(item => [item.region, item.count])
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
        {rows.map(item => (
          <div
            key={item.region}
            className="rounded border border-slate-800 p-3 text-xs"
          >
            <b className="text-violet-100">{item.region}</b>
            <p className="mt-1 text-slate-400">已核验来源：{item.count}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        覆盖拓扑仅统计当前接入的公开原件来源，不代表央行政策覆盖、利率比较或数据授权范围。
      </p>
    </Card>
  );
}

function NewsSourcePack({ snapshot }: { snapshot?: Snapshot }) {
  const [selected, setSelected] = useState<string[]>([]);
  const sources = snapshot?.sources ?? [];
  const active = sources.filter(item => selected.includes(item.id));
  const toggle = (id: string) =>
    setSelected(rows =>
      rows.includes(id) ? rows.filter(item => item !== id) : [...rows, id]
    );
  return (
    <Card title="NEWS · 原始资料引用包">
      <p className="mb-2 text-[11px] text-slate-500">
        选择已核验公开来源生成引用包；该功能不生成新闻摘要、市场观点或预测。
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {sources.map(item => (
          <label
            key={item.id}
            className="flex items-center gap-2 rounded border border-slate-800 p-2 text-xs text-slate-300"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
            />
            {item.label}
            <span className="ml-auto text-slate-500">{item.frequency}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          exportCsv(
            "news-original-source-pack.csv",
            ["来源", "地区", "频率", "范围", "原始链接"],
            active.map(item => [
              item.label,
              item.region,
              item.frequency,
              item.scope,
              item.url,
            ])
          )
        }
        disabled={!active.length}
        className="mt-3 text-xs text-cyan-300 disabled:text-slate-600"
      >
        <Download className="mr-1 inline h-3 w-3" />
        导出引用包
      </button>
    </Card>
  );
}

function SourceFreshness({ snapshot }: { snapshot?: Snapshot }) {
  const rows =
    snapshot?.rates.map(item => {
      const observation =
        item.observationDate || item.history.at(-1)?.date || null;
      const age = observation
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(`${observation}T00:00:00Z`).getTime()) /
                86_400_000
            )
          )
        : null;
      return {
        id: item.id,
        label: item.label,
        observation,
        age,
        state: item.status,
      };
    }) ?? [];
  const filterRows = rows.filter(
    item => item.state !== "available" || (item.age != null && item.age > 7)
  );
  const eligible = (snapshot?.rates ?? [])
    .filter(item =>
      ["SOFR", "EFFR", "IORB", "RRPONTSYD", "DTB4WK", "DTB3", "DTB6"].includes(
        item.id
      )
    )
    .map(item => ({
      id: item.id as
        | "SOFR"
        | "EFFR"
        | "IORB"
        | "RRPONTSYD"
        | "DTB4WK"
        | "DTB3"
        | "DTB6",
      label: item.label,
    }));
  return (
    <>
      <Card
        title="SOURCE · 公开资料时效与可用性运营台"
        action={
          <button
            type="button"
            onClick={() =>
              exportCsv(
                "money-market-source-freshness.csv",
                ["序列", "最近观察日", "距今天数", "状态"],
                rows.map(item => [
                  item.label,
                  item.observation,
                  item.age,
                  item.state,
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
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="监测序列" value={String(rows.length)} tone="info" />
          <Metric label="需复核" value={String(filterRows.length)} />
          <Metric label="最近处理" value={snapshot ? "当前公开快照" : "—"} />
        </div>
        <div className="mt-3 max-h-48 overflow-auto">
          {rows.map(item => (
            <div
              key={item.id}
              className="flex justify-between border-t border-slate-800 px-2 py-1.5 text-xs"
            >
              <span className="text-cyan-100">{item.label}</span>
              <span className="text-slate-400">
                {item.observation || "无观察"} ·{" "}
                {item.age == null ? "—" : `${item.age} 日`} ·{" "}
                {item.state === "available" ? "可读" : "不可读"}
              </span>
            </div>
          ))}
          {!rows.length && (
            <Empty>公开快照暂不可读；不会以模拟时效状态填充。</Empty>
          )}
        </div>
        <SourceFreshnessPreferences series={eligible} />
        <SourceRuleGovernance />
      </Card>
      <SourceAvailabilityHistory />
      <MoneyMarketModuleDiagnostics />
      <SharedSourceRuleEditors />
    </>
  );
}
function MmflowManifest({ snapshot }: { snapshot?: Snapshot }) {
  const [selected, setSelected] = useState<string[]>([]);
  const sources = snapshot?.sources ?? [];
  const active = sources.filter(item => selected.includes(item.id));
  const toggle = (id: string) =>
    setSelected(rows =>
      rows.includes(id) ? rows.filter(item => item !== id) : [...rows, id]
    );
  return (
    <>
      <Card title="MMFLOW · 研究交付来源清单组装">
        <p className="mb-2 text-[11px] text-slate-500">
          按本次研究需要选择公开来源并导出交付清单；交付包只保存来源标识，实际字段和链接在导出时重新读取公开目录，也不生成未经核验的分析内容。
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {sources.map(item => (
            <label
              key={item.id}
              className="flex items-center gap-2 rounded border border-slate-800 p-2 text-xs"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span className="text-slate-200">{item.label}</span>
              <span className="ml-auto text-slate-500">{item.region}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "money-market-research-delivery-manifest.csv",
              ["来源", "地区", "频率", "覆盖范围", "原始链接"],
              active.map(item => [
                item.label,
                item.region,
                item.frequency,
                item.scope,
                item.url,
              ])
            )
          }
          disabled={!active.length}
          className="mt-3 text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          导出交付清单
        </button>
      </Card>
      <MmflowDeliveryReviewPanel
        sources={sources}
        selectedSourceIds={selected}
        onLoad={setSelected}
      />
      <MmflowVersionGovernance />
    </>
  );
}

export default function MoneyMarketDistinctiveLayer({
  moduleId,
  snapshot,
}: {
  moduleId: DistinctMoneyMarketModuleId;
  snapshot?: Snapshot;
}) {
  const content: Record<DistinctMoneyMarketModuleId, React.ReactNode> = {
    "des-mm": <DesContract snapshot={snapshot} />,
    pgm: <PgmMandate snapshot={snapshot} />,
    mktbeat: <MktbeatAlignment snapshot={snapshot} />,
    btmm: <BtmmCadence snapshot={snapshot} />,
    boom: <BoomHorizon snapshot={snapshot} />,
    tcon: <TconDecomposition snapshot={snapshot} />,
    rv: <RvMatrix snapshot={snapshot} />,
    ycqsim: <YcqsimGrid />,
    gc: <GcEvidenceManifest snapshot={snapshot} />,
    "crvf-mmkt": <CrvfMoneyRoute snapshot={snapshot} />,
    crvf: <CrvfCompatibility snapshot={snapshot} />,
    fibc: <FibcDayCountBridge />,
    cdie: <CdieAccrualLadder snapshot={snapshot} />,
    efsf: <EfsfProvenance />,
    mmidx: <MmidxDispersion snapshot={snapshot} />,
    etrade: <EtradeReleaseControl />,
    edsf: <EdsfLifecycle />,
    wbf: <WbfConversionBridge />,
    pboc: <PbocDomainGate snapshot={snapshot} />,
    twdi: <TwdiQuality snapshot={snapshot} />,
    cenb: <CenbTopology snapshot={snapshot} />,
    "news-mm": <NewsSourcePack snapshot={snapshot} />,
    "source-mm": <SourceFreshness snapshot={snapshot} />,
    mmflow: <MmflowManifest snapshot={snapshot} />,
  };
  // MoneyMarketResearchPath remains available for explicit workflow navigation,
  // but is not rendered here because it duplicated the same path card in every original entry.
  return <div className="mt-3 space-y-3">{content[moduleId]}</div>;
}
