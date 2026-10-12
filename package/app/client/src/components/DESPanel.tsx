/** DES — 主权债条款、现金流、可选性与证据版本联动。 */
import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSovereignStream } from "@/hooks/useSovereignStream";
import { PanelShell, Card, Metric, LoadingState } from "./sovereign/PanelKit";
import { Download, FileCheck2, Trash2 } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Evidence = {
  id: string;
  createdAt: string;
  identifier: string;
  source: string;
  documentDate: string;
  fields: string;
  verified: boolean;
};
const key = "finance-hub:des-security-records";
const restore = (): Evidence[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const fmt = (value?: number | null) =>
  value == null || !Number.isFinite(value) ? "—" : value.toFixed(2);
const exportCsv = (records: Evidence[]) => {
  const rows = [
    ["recorded_at", "identifier", "source", "document_date", "fields"],
    ...records.map(item => [
      item.createdAt,
      item.identifier,
      item.source,
      item.documentDate,
      item.fields,
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
  a.download = "security-evidence.csv";
  a.click();
  URL.revokeObjectURL(url);
};

export default function DESPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState("profile");
  const [records, setRecords] = useState<Evidence[]>(restore);
  const [identifier, setIdentifier] = useState("");
  const [source, setSource] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [fields, setFields] = useState("");
  const [verified, setVerified] = useState(false);
  const [coupon, setCoupon] = useState(4.125);
  const [maturity, setMaturity] = useState(10);
  const [face, setFace] = useState(1_000_000);
  const [optionalYear, setOptionalYear] = useState(7);
  const rates = trpc.sovereignBonds.getMultipleRateSeries.useQuery(
    { series: ["DGS10", "DGS2", "SOFR"] },
    { refetchOnWindowFocus: false, refetchInterval: 60_000 }
  );
  const stream = useSovereignStream(16, 4);
  const referenceYield = Number(
    stream.latest?.rates?.DGS10 ?? rates.data?.data?.DGS10?.latest ?? 4.2
  );
  const cashflows = useMemo(
    () =>
      Array.from({ length: maturity }, (_, index) => {
        const year = index + 1;
        const couponCash = (face * coupon) / 100;
        const principal = year === maturity ? face : 0;
        return {
          year: `${year}Y`,
          coupon: couponCash,
          principal,
          pv: (couponCash + principal) / (1 + referenceYield / 100) ** year,
          optional: year === optionalYear ? couponCash + face : 0,
        };
      }),
    [coupon, face, maturity, optionalYear, referenceYield]
  );
  const presentValue = cashflows.reduce((sum, row) => sum + row.pv, 0);
  const termStructure = ["SOFR", "DGS2", "DGS10"].map(id => ({
    tenor: id === "SOFR" ? "隔夜" : id === "DGS2" ? "2Y" : "10Y",
    yield: Number(
      stream.latest?.rates?.[id] ?? rates.data?.data?.[id]?.latest ?? 0
    ),
  }));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(records));
  }, [records]);
  const save = () => {
    if (
      !identifier.trim() ||
      !source.trim() ||
      !documentDate ||
      !fields.trim() ||
      !verified
    )
      return;
    setRecords(current => [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        identifier: identifier.trim(),
        source: source.trim(),
        documentDate,
        fields: fields.trim(),
        verified: true,
      },
      ...current,
    ]);
    setIdentifier("");
    setSource("");
    setDocumentDate("");
    setFields("");
    setVerified(false);
  };
  const tabs = [
    { id: "profile", label: "条款研究" },
    { id: "sources", label: "来源核验" },
    { id: "register", label: `登记簿 (${records.length})` },
  ];
  return (
    <PanelShell
      ticker="DES"
      title="证券简介"
      subtitle="合同条款、支付路径、可选性和证据版本"
      onClose={onClose ?? (() => undefined)}
      onRefresh={() => rates.refetch()}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {rates.isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric
              label="到期收益率锚"
              value={`${fmt(referenceYield)}%`}
              trend={stream.chart.map((row: any) =>
                Number(row.DGS10 ?? referenceYield)
              )}
              tone="info"
            />
            <Metric
              label="合同现金流现值"
              value={presentValue.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
              trend={cashflows.map(row => row.pv)}
              tone="warn"
            />
            <Metric
              label="支付节点"
              value={`${maturity} 期`}
              trend={cashflows.map((_, index) => index + 1)}
              tone="neutral"
            />
            <Metric
              label="已核证版本"
              value={`${records.length} 项`}
              trend={records.map((_, index) => index + 1)}
              tone="pos"
            />
          </div>
          {tab === "profile" && (
            <>
              <Card title="条款输入与现金流时间轴">
                <div className="grid gap-2 md:grid-cols-4">
                  <label className="text-[10px] text-slate-500">
                    票息 %
                    <input
                      type="number"
                      value={coupon}
                      onChange={e =>
                        setCoupon(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    剩余年限
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={maturity}
                      onChange={e =>
                        setMaturity(
                          Math.max(1, Math.min(30, Number(e.target.value) || 1))
                        )
                      }
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    面值
                    <input
                      type="number"
                      min="1"
                      value={face}
                      onChange={e =>
                        setFace(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    赎回观察年
                    <input
                      type="number"
                      min="1"
                      max={maturity}
                      value={optionalYear}
                      onChange={e =>
                        setOptionalYear(
                          Math.max(
                            1,
                            Math.min(maturity, Number(e.target.value) || 1)
                          )
                        )
                      }
                      className="terminal-ledger-input mt-1 w-full"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[9px] text-slate-500">
                  本页不包含尚未经证券条款文件确认的赎回、回售、递延或结算假设。
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={cashflows}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      tickFormatter={value =>
                        `${(Number(value) / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: 10,
                      }}
                    />
                    <Bar dataKey="coupon" name="票息" fill="#22d3ee" />
                    <Bar dataKey="principal" name="本金" fill="#f59e0b" />
                    <Line
                      dataKey="pv"
                      name="折现现金流"
                      stroke="#a78bfa"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
              <div className="grid gap-3 xl:grid-cols-2">
                <Card title="当前期限锚">
                  <ResponsiveContainer width="100%" height={190}>
                    <ComposedChart data={termStructure}>
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
                      <Area
                        dataKey="yield"
                        stroke="#34d399"
                        fill="#34d399"
                        fillOpacity={0.12}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="条款证据缺口">
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {[
                      "计息日规则",
                      "赎回价格",
                      "回售窗口",
                      "递延条件",
                      "税务口径",
                      "担保顺位",
                      "结算日历",
                      "指数化公式",
                    ].map((item, index) => (
                      <div
                        key={item}
                        className={`rounded border p-2 ${index < records.length ? "border-emerald-900 text-emerald-300" : "border-amber-900/60 text-amber-300"}`}
                      >
                        <div>{item}</div>
                        <div className="mt-1 text-[9px] text-slate-500">
                          {index < records.length
                            ? "已有证据记录"
                            : "等待文件核对"}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
          {tab === "sources" && (
            <Card title="证券条款来源登记">
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-[10px] text-slate-500">
                  证券标识
                  <input
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="ISIN、CUSIP 或证券代码"
                    className="terminal-ledger-input mt-1 w-full"
                  />
                </label>
                <label className="text-[10px] text-slate-500">
                  文件位置
                  <input
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    placeholder="债务管理机构、央行或发行条款"
                    className="terminal-ledger-input mt-1 w-full"
                  />
                </label>
                <label className="text-[10px] text-slate-500">
                  文件日期
                  <input
                    type="date"
                    value={documentDate}
                    onChange={e => setDocumentDate(e.target.value)}
                    className="terminal-ledger-input mt-1 w-full"
                  />
                </label>
                <label className="text-[10px] text-slate-500">
                  核对字段
                  <input
                    value={fields}
                    onChange={e => setFields(e.target.value)}
                    placeholder="票息、现金流、赎回、结算"
                    className="terminal-ledger-input mt-1 w-full"
                  />
                </label>
              </div>
              <label className="mt-3 flex gap-2 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={e => setVerified(e.target.checked)}
                />
                已核对证券标识、文件版本和有效期
              </label>
              <button
                disabled={
                  !identifier.trim() ||
                  !source.trim() ||
                  !documentDate ||
                  !fields.trim() ||
                  !verified
                }
                onClick={save}
                className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950 px-2 py-1 text-[10px] text-cyan-200 disabled:opacity-40"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                保存证据版本
              </button>
            </Card>
          )}
          {tab === "register" &&
            (records.length ? (
              <>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => exportCsv(records)}
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出
                  </button>
                  <button
                    onClick={() => setRecords([])}
                    className="inline-flex items-center gap-1 text-[10px] text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清空
                  </button>
                </div>
                <Card title="文件版本与字段变更轨迹">
                  <div className="space-y-2">
                    {records.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid gap-2 rounded border border-slate-800 p-2 text-[10px] md:grid-cols-[90px_1fr_1.4fr_1.4fr]"
                      >
                        <span className="font-mono text-cyan-300">
                          V{records.length - index}
                        </span>
                        <span>
                          {item.identifier}
                          <br />
                          <i className="text-slate-500">{item.documentDate}</i>
                        </span>
                        <span className="text-slate-300">{item.fields}</span>
                        <span className="truncate text-slate-500">
                          {item.source}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              <Card title="尚无证券证据版本">
                <p className="text-[11px] text-slate-500">
                  在来源核验中保存文件后，这里按版本展示条款变化与字段覆盖。
                </p>
              </Card>
            ))}
        </div>
      )}
    </PanelShell>
  );
}
