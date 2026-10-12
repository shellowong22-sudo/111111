/** RUNZ — 分阶段运行、双人复核、异常交接、超时提醒与审计导出。 */
import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSovereignStream } from "@/hooks/useSovereignStream";
import {
  PanelShell,
  Card,
  Metric,
  LoadingState,
  Badge,
} from "./sovereign/PanelKit";
import { CheckCircle2, Download, Trash2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const stages = [
  { id: "prepare", label: "准备", sla: 8 },
  { id: "review", label: "复核", sla: 12 },
  { id: "sign", label: "签名", sla: 6 },
  { id: "execute", label: "执行确认", sla: 10 },
  { id: "handoff", label: "交接", sla: 8 },
  { id: "archive", label: "归档", sla: 5 },
];
type Run = {
  id: string;
  createdAt: string;
  reference: string;
  owner: string;
  reviewer: string;
  exception: string;
  handoff: string;
  stageTimes: Record<string, string>;
  status: string;
};
const key = "finance-hub:runz-stage-log-v2";
const shanghaiTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
const shanghaiDateTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
const restore = (): Run[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const csv = (runs: Run[]) => {
  const rows = [
    [
      "created_at",
      "reference",
      "owner",
      "reviewer",
      "status",
      "exception",
      "handoff",
      ...stages.map(s => s.id),
    ],
    ...runs.map(run => [
      run.createdAt,
      run.reference,
      run.owner,
      run.reviewer,
      run.status,
      run.exception,
      run.handoff,
      ...stages.map(s => run.stageTimes[s.id] ?? ""),
    ]),
  ];
  const blob = new Blob(
    [
      `\uFEFF${rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`,
    ],
    { type: "text/csv;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "runs-audit.csv";
  a.click();
  URL.revokeObjectURL(url);
};
export default function RUNZPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState("runbook");
  const [runs, setRuns] = useState<Run[]>(restore);
  const [reference, setReference] = useState("");
  const [owner, setOwner] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [exception, setException] = useState("");
  const [handoff, setHandoff] = useState("");
  const [stageTimes, setStageTimes] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(Date.now());
  const futures = trpc.sovereignBonds.getTreasuryFutures.useQuery(undefined, {
    refetchInterval: 4_000,
    refetchIntervalInBackground: true,
  });
  const rates = trpc.sovereignBonds.getMultipleRateSeries.useQuery(
    { series: ["DGS10", "DGS2", "SOFR"] },
    { refetchInterval: 60_000 }
  );
  const stream = useSovereignStream(22, 4);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(runs));
  }, [runs]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const done = stages.filter(s => stageTimes[s.id]).length;
  const complete =
    done === stages.length &&
    reference.trim() &&
    owner.trim() &&
    reviewer.trim() &&
    owner.trim() !== reviewer.trim();
  const durationRows = useMemo(
    () =>
      stages.map((stage, index) => {
        const completedAt = stageTimes[stage.id] ? new Date(stageTimes[stage.id]).getTime() : null;
        const previousAt = index ? stageTimes[stages[index - 1].id] : stageTimes.prepare;
        const start = previousAt ? new Date(previousAt).getTime() : null;
        const isCurrent = !completedAt && (index === 0 ? Boolean(reference.trim()) : Boolean(previousAt));
        const minutes = completedAt && start ? Math.max(0, (completedAt - start) / 60000) : isCurrent && start ? Math.max(0, (clock - start) / 60000) : 0;
        return {
          stage: stage.label,
          minutes: Number(minutes.toFixed(1)),
          sla: stage.sla,
          late: minutes > stage.sla,
        };
      }),
    [clock, reference, stageTimes]
  );
  const mark = (id: string) =>
    setStageTimes(current =>
      current[id] ? current : { ...current, [id]: new Date().toISOString() }
    );
  const save = () => {
    if (!complete) return;
    setRuns(current => [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        reference: reference.trim(),
        owner: owner.trim(),
        reviewer: reviewer.trim(),
        exception: exception.trim(),
        handoff: handoff.trim(),
        stageTimes,
        status: exception.trim() ? "已归档 · 含异常" : "已归档 · 正常",
      },
      ...current,
    ]);
    setReference("");
    setOwner("");
    setReviewer("");
    setException("");
    setHandoff("");
    setStageTimes({});
  };
  const tabs = [
    { id: "runbook", label: "运行手册" },
    { id: "reference", label: "市场参考" },
    { id: "log", label: `本地日志 (${runs.length})` },
  ];
  return (
    <PanelShell
      ticker="RUNZ"
      title="Runs 管理"
      subtitle="阶段状态、复核签名、异常交接与审计时间线"
      onClose={onClose ?? (() => undefined)}
      onRefresh={() => {
        futures.refetch();
        rates.refetch();
      }}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {futures.isLoading || rates.isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric
              label="当前完成度"
              value={`${done}/${stages.length}`}
              trend={stages.map((_, index) => Math.min(done, index + 1))}
              tone={done === stages.length ? "pos" : "info"}
            />
            <Metric
              label="双人复核"
              value={
                owner && reviewer && owner !== reviewer ? "已分离" : "待分离"
              }
              tone={owner && reviewer && owner !== reviewer ? "pos" : "warn"}
            />
            <Metric
              label="异常记录"
              value={exception ? "已记录" : "无"}
              tone={exception ? "warn" : "neutral"}
            />
            <Metric
              label="行情链路"
              value={stream.connected ? "已连接" : "重连中"}
              tone={stream.connected ? "info" : "warn"}
            />
          </div>
          {tab === "runbook" && (
            <div className="grid gap-3 xl:grid-cols-[.95fr_1.05fr]">
              <Card title="运行责任与交接">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-[10px] text-slate-500">
                    运行参考号
                    <input
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    执行责任人
                    <input
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    独立复核人
                    <input
                      value={reviewer}
                      onChange={e => setReviewer(e.target.value)}
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    交接记录
                    <input
                      value={handoff}
                      onChange={e => setHandoff(e.target.value)}
                      placeholder="交接对象与事项"
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-[10px] text-slate-500">
                  异常原因
                  <textarea
                    value={exception}
                    onChange={e => setException(e.target.value)}
                    placeholder="没有异常可留空"
                    className="terminal-ledger-input mt-1 min-h-16 w-full"
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {stages.map((stage, index) => (
                    <button
                      key={stage.id}
                      disabled={index > 0 && !stageTimes[stages[index - 1].id]}
                      onClick={() => mark(stage.id)}
                      className={`rounded border p-2 text-left text-[10px] disabled:opacity-35 ${stageTimes[stage.id] ? "border-emerald-800 bg-emerald-950/20" : "border-slate-700"}`}
                    >
                      <span className="font-mono text-cyan-300">
                        0{index + 1}
                      </span>
                      <b className="ml-2 text-slate-200">{stage.label}</b>
                      <div className="mt-1 text-slate-500">
                        SLA {stage.sla} 分钟
                      </div>
                      <div className="mt-1 text-[9px] text-emerald-300">
                        {stageTimes[stage.id]
                          ? shanghaiTime(stageTimes[stage.id])
                          : "点击完成"}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  disabled={!complete}
                  onClick={save}
                  className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950 px-2 py-1 text-[10px] text-cyan-200 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  签名并归档
                </button>
              </Card>
              <Card title="阶段耗时与超时线">
                <ResponsiveContainer width="100%" height={370}>
                  <BarChart data={durationRows}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="stage"
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 9 }} unit="m" />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: 10,
                      }}
                    />
                    <Bar dataKey="minutes" name="耗时">
                      {durationRows.map(row => (
                        <Cell
                          key={row.stage}
                          fill={row.late ? "#fb7185" : "#34d399"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2">
                  {durationRows.map(row => (
                    <div
                      key={row.stage}
                      className="rounded border border-slate-800 p-2 text-center text-[9px]"
                    >
                      <span className="text-slate-500">{row.stage}</span>
                      <div
                        className={
                          row.late ? "text-rose-300" : "text-emerald-300"
                        }
                      >
                        {row.minutes}/{row.sla}m
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {tab === "reference" && (
            <div className="grid gap-3 xl:grid-cols-2">
              <Card title="执行窗口市场脉冲">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={(futures.data?.data ?? []).map(row => ({
                      symbol: row.symbol,
                      move: row.changePct,
                      price: row.price,
                    }))}
                  >
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="symbol"
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: 10,
                      }}
                    />
                    <Bar dataKey="move">
                      {(futures.data?.data ?? []).map(row => (
                        <Cell
                          key={row.symbol}
                          fill={(row.changePct ?? 0) >= 0 ? "#34d399" : "#fb7185"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="核验断点">
                <div className="space-y-2">
                  {[
                    ["证券标识与结算", "执行前"],
                    ["价格有效期与规模", "询价后"],
                    ["风险限额与担保品", "复核前"],
                    ["双人签名与交接", "归档前"],
                  ].map(([name, gate], index) => (
                    <div
                      key={name}
                      className="flex justify-between rounded border border-slate-800 p-3 text-[11px]"
                    >
                      <span className="text-slate-300">{name}</span>
                      <span
                        className={
                          done > index ? "text-emerald-300" : "text-amber-300"
                        }
                      >
                        {done > index ? "已越过" : "等待"} · {gate}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {tab === "log" &&
            (runs.length ? (
              <>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => csv(runs)}
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出审计
                  </button>
                  <button
                    onClick={() => setRuns([])}
                    className="inline-flex items-center gap-1 text-[10px] text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清空
                  </button>
                </div>
                <Card title="归档运行时间线">
                  <div className="space-y-2">
                    {runs.map(run => (
                      <div
                        key={run.id}
                        className="rounded border border-slate-800 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <b className="font-mono text-cyan-300">
                            {run.reference}
                          </b>
                          <Badge tone={run.exception ? "warn" : "pos"}>
                            {run.status}
                          </Badge>
                          <span className="text-slate-500">
                            {shanghaiDateTime(run.createdAt)}
                          </span>
                          <span className="ml-auto text-slate-300">
                            {run.owner} → {run.reviewer}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-6 gap-1">
                          {stages.map(stage => (
                            <div
                              key={stage.id}
                              className="rounded bg-slate-900 p-1 text-center text-[8px] text-slate-400"
                            >
                              {stage.label}
                              <div className="mt-1 font-mono text-emerald-300">
                                {run.stageTimes[stage.id]
                                  ? shanghaiTime(run.stageTimes[stage.id])
                                  : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                        {run.exception && (
                          <p className="mt-2 text-[10px] text-amber-300">
                            异常：{run.exception}
                          </p>
                        )}
                        {run.handoff && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            交接：{run.handoff}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              <Card title="尚无归档运行">
                <p className="text-[11px] text-slate-500">
                  完成六个阶段并由不同责任人复核后，记录会进入可导出的审计时间线。
                </p>
              </Card>
            ))}
        </div>
      )}
    </PanelShell>
  );
}
