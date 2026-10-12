/** IR/SN — 名义、实际、平衡通胀期限面与结构收益曲线。 */
import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSovereignStream } from "@/hooks/useSovereignStream";
import { PanelShell, Card, Metric, LoadingState } from "./sovereign/PanelKit";
import { Download } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const fmt = (v?: number | null, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(d);
const download = (rows: (string | number)[][]) => {
  const b = new Blob(
    [
      `\uFEFF${rows.map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n")}`,
    ],
    { type: "text/csv;charset=utf-8" }
  );
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = "inflation-term-structure.csv";
  a.click();
  URL.revokeObjectURL(u);
};
export default function InflationPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState("breakeven");
  const [participation, setParticipation] = useState(1);
  const [cap, setCap] = useState(20);
  const [floor, setFloor] = useState(-25);
  const [principal, setPrincipal] = useState(1_000_000);
  const query = trpc.sovereignBonds.getMultipleRateSeries.useQuery(
    {
      series: [
        "DGS5",
        "DGS10",
        "DGS30",
        "DFII5",
        "DFII10",
        "DFII30",
        "T5YIE",
        "T10YIE",
        "T5YIFR",
        "SOFR",
      ],
    },
    { refetchInterval: 60_000 }
  );
  const stream = useSovereignStream(24, 4);
  const data = query.data?.data ?? {};
  const latest = (id: string) =>
    Number(stream.latest?.rates?.[id] ?? data[id]?.latest ?? 0);
  const term = [
    {
      tenor: "5Y",
      nominal: latest("DGS5"),
      real: latest("DFII5"),
      bei: latest("T5YIE") || latest("DGS5") - latest("DFII5"),
    },
    {
      tenor: "10Y",
      nominal: latest("DGS10"),
      real: latest("DFII10"),
      bei: latest("T10YIE") || latest("DGS10") - latest("DFII10"),
    },
    {
      tenor: "30Y",
      nominal: latest("DGS30"),
      real: latest("DFII30"),
      bei: latest("DGS30") - latest("DFII30"),
    },
  ];
  const selectedHistory = (data.T10YIE?.data ?? [])
    .map((row: any, index: number) => ({
      date: row.date,
      bei: Number(row.value),
      nominal: Number(data.DGS10?.data?.[index]?.value ?? 0),
      real: Number(data.DFII10?.data?.[index]?.value ?? 0),
    }))
    .filter((row: any) => row.bei);
  const beiValues = selectedHistory
    .map((row: any) => row.bei)
    .filter(Number.isFinite);
  const beiPercentile = beiValues.length
    ? (beiValues.filter((value: number) => value <= term[1].bei).length /
        beiValues.length) *
      100
    : null;
  const beiSlope = (term[2].bei - term[0].bei) * 100;
  const payoff = useMemo(
    () =>
      Array.from({ length: 41 }, (_, i) => i * 5 - 100).map(underlying => {
        const note = Math.min(cap, Math.max(floor, underlying * participation));
        return { underlying, note, value: principal * (1 + note / 100) };
      }),
    [cap, floor, participation, principal]
  );
  const currentPayoff =
    principal *
    (1 + Math.min(cap, Math.max(floor, term[1].bei * participation)) / 100);
  const tabs = [
    { id: "breakeven", label: "通胀参考" },
    { id: "structure", label: "收益结构情景" },
    { id: "method", label: "方法与边界" },
  ];
  return (
    <PanelShell
      ticker="IR/SN"
      title="IR 与通胀研究"
      subtitle="平衡通胀期限面、历史分位与收益结构曲线"
      onClose={onClose ?? (() => undefined)}
      onRefresh={() => query.refetch()}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {query.isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          {tab === "breakeven" && (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Metric
                  label="10Y 名义"
                  value={`${fmt(term[1].nominal)}%`}
                  trend={data.DGS10?.data?.map((r: any) => Number(r.value))}
                  tone="info"
                />
                <Metric
                  label="10Y 实际"
                  value={`${fmt(term[1].real)}%`}
                  trend={data.DFII10?.data?.map((r: any) => Number(r.value))}
                  tone="pos"
                />
                <Metric
                  label="10Y 平衡通胀"
                  value={`${fmt(term[1].bei)}%`}
                  trend={selectedHistory.map((r: any) => r.bei)}
                  tone="warn"
                />
                <Metric
                  label="5Y5Y 远期通胀"
                  value={`${fmt(latest("T5YIFR"))}%`}
                  trend={data.T5YIFR?.data?.map((r: any) => Number(r.value))}
                  tone="warn"
                />
                <Metric
                  label="隔夜资金"
                  value={`${fmt(latest("SOFR"))}%`}
                  trend={stream.chart.map((r: any) => Number(r.SOFR ?? 0))}
                  tone="neutral"
                />
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <Card title="名义—实际—平衡通胀期限面">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={term}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="tenor"
                        tick={{ fill: "#64748b", fontSize: 9 }}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#64748b", fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          fontSize: 10,
                        }}
                      />
                      <Line
                        dataKey="nominal"
                        name="名义"
                        stroke="#38bdf8"
                        strokeWidth={2}
                      />
                      <Line
                        dataKey="real"
                        name="实际"
                        stroke="#34d399"
                        strokeWidth={2}
                      />
                      <Line
                        dataKey="bei"
                        name="平衡通胀"
                        stroke="#f59e0b"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="10Y 通胀补偿历史轨迹">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={selectedHistory}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 9 }}
                        minTickGap={30}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#64748b", fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          fontSize: 10,
                        }}
                      />
                      <Area
                        dataKey="bei"
                        name="平衡通胀"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.16}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              <button
                onClick={() =>
                  download([
                    ["tenor", "nominal", "real", "breakeven"],
                    ...term.map(r => [r.tenor, r.nominal, r.real, r.bei]),
                  ])
                }
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400"
              >
                <Download className="h-3.5 w-3.5" />
                导出期限面
              </button>
            </>
          )}
          {tab === "structure" && (
            <>
              <Card title="收益结构参数">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-[10px] text-slate-500">
                    名义本金
                    <input
                      type="number"
                      value={principal}
                      onChange={e =>
                        setPrincipal(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    参与率 {participation.toFixed(2)}x
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step=".05"
                      value={participation}
                      onChange={e => setParticipation(Number(e.target.value))}
                      className="mt-2 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    上限 {cap}%
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cap}
                      onChange={e => setCap(Number(e.target.value))}
                      className="mt-2 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    下限 {floor}%
                    <input
                      type="range"
                      min="-100"
                      max="0"
                      value={floor}
                      onChange={e => setFloor(Number(e.target.value))}
                      className="mt-2 w-full"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[9px] text-slate-500">
                  当前 10Y 平衡通胀 {fmt(term[1].bei)}%
                  仅作为情景轴定位；结构金额由输入参数计算，不代表产品报价。
                </p>
              </Card>
              <div className="grid grid-cols-3 gap-2">
                <Metric
                  label="上行情景金额"
                  value={payoff
                    .at(-1)
                    ?.value.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  tone="pos"
                />
                <Metric
                  label="当前通胀定位金额"
                  value={currentPayoff.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  tone="info"
                />
                <Metric
                  label="下行情景金额"
                  value={payoff[0]?.value.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  tone="neg"
                />
              </div>
              <Card title="标的回报与结构收益曲线">
                <ResponsiveContainer width="100%" height={330}>
                  <ComposedChart data={payoff}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="underlying"
                      unit="%"
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <YAxis unit="%" tick={{ fill: "#64748b", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      x={term[1].bei}
                      stroke="#f59e0b"
                      label={{ value: "10Y BEI", fill: "#f59e0b", fontSize: 9 }}
                    />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Line
                      dataKey="underlying"
                      name="标的回报"
                      stroke="#64748b"
                      dot={false}
                    />
                    <Line
                      dataKey="note"
                      name="结构收益"
                      stroke="#a78bfa"
                      dot={false}
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
          {tab === "method" && (
            <div className="grid gap-3 md:grid-cols-3">
              <Card title="期限斜率诊断">
                <p className="font-mono text-xl text-cyan-200">
                  {beiSlope >= 0 ? "+" : ""}
                  {fmt(beiSlope, 1)} bp
                </p>
                <p className="mt-2 text-[10px] leading-5 text-slate-400">
                  30Y 减 5Y 平衡通胀；正值表示远端补偿高于近端。
                </p>
              </Card>
              <Card title="10Y 历史位置">
                <p className="font-mono text-xl text-amber-200">
                  {beiPercentile == null
                    ? "—"
                    : `${fmt(beiPercentile, 0)}% 分位`}
                </p>
                <p className="mt-2 text-[10px] leading-5 text-slate-400">
                  由当前可读 T10YIE 历史样本计算，随官方序列更新。
                </p>
              </Card>
              <Card title="结构输入边界">
                <p className="font-mono text-xl text-violet-200">
                  {fmt(participation)}x / {cap}% / {floor}%
                </p>
                <p className="mt-2 text-[10px] leading-5 text-slate-400">
                  当前参数下通胀定位金额{" "}
                  {currentPayoff.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  ；本页不包含信用、税务和退出流动性估值。
                </p>
              </Card>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}
