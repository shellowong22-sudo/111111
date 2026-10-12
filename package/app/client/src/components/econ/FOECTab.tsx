import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { FED_FINANCIAL_FIELDS } from "@shared/fedFinancialStatements";
import {
  alignSeries,
  seriesHistory,
  latestValue,
  periodLast,
} from "@shared/economicObservations";
import {
  EconomicTabs,
  EconomicTable,
  EconomicSeriesChart,
  EconomicSourceStatus,
  EconomicProvenance,
  EconomicUnavailable,
  useEconomicObservations,
  formatEconomic,
} from "./EconomicObservationControls";
const tabs = [
  "资产负债表",
  "QT/QE追踪",
  "准备金充裕度",
  "联储工具箱",
  "联储盈亏",
  "政策正常化",
];
export default function FOECTab() {
  const [active, setActive] = useState(0);
  const [detail, setDetail] = useState(false);
  const [financialDetail, setFinancialDetail] = useState(false);
  const [target, setTarget] = useState(6);
  const [completion, setCompletion] = useState(50);
  const query = useEconomicObservations("fdsp");
  const financialQuery = trpc.legacyMarketData.getFedFinancialStatements.useQuery(undefined, { enabled: active === 4, staleTime: 3600_000, refetchInterval: active === 4 ? 3600_000 : false, retry: false });
  const financial = financialQuery.data;
  const [currentFinancial, priorFinancial] = financial?.rows ?? [];
  const financialRows = FED_FINANCIAL_FIELDS.filter(([key]) => financialDetail || key === 'netInterest' || key === 'remittances').map(([key, field]) => ({
    field,
    current: currentFinancial ? currentFinancial[key] / 1000 : null,
    prior: priorFinancial ? priorFinancial[key] / 1000 : null,
    delta: currentFinancial && priorFinancial ? (currentFinancial[key] - priorFinancial[key]) / 1000 : null,
  }));
  const h = (id: string) => seriesHistory(query.data, id);
  const trillions = (id: string) =>
    h(id).map(p => ({ ...p, value: p.value / 1_000_000 }));
  const billions = (id: string) =>
    h(id).map(p => ({ ...p, value: p.value / 1_000 }));
  const balance = alignSeries({
    total: trillions("WALCL"),
    treasury: trillions("TREAST"),
    mbs: trillions("WSHOMCB"),
    reserves: trillions("WRESBAL"),
    tga: trillions("WTREGEN"),
    currency: trillions("WCURCIR"),
  });
  const latestBalance = balance.at(-1);
  const monthly = periodLast(billions("WALCL"));
  const changes = monthly.map((p, i, points) => ({
    date: p.date,
    reduction: i ? p.value - points[i - 1].value : null,
    cumulative: p.value - points[0].value,
  }));
  const reserves = alignSeries({
    reserves: trillions("WRESBAL"),
    iorb: h("IORB"),
  });
  const toolRows = alignSeries({
    onrrp: h("RRPONTSYD"),
    discount: billions("WLCFLPCL"),
  });
  const current = latestValue(query.data, "WALCL");
  const currentT = current === null ? null : current / 1_000_000;
  const lastChange = changes.at(-1);
  const averageReduction =
    changes.length > 3
      ? changes.slice(-3).reduce((s, p) => s + (p.reduction ?? 0), 0) / 3
      : null;
  const completionMonths =
    currentT !== null &&
    target < currentT &&
    averageReduction !== null &&
    averageReduction < 0
      ? ((currentT - target) * 1000) / -averageReduction
      : null;
  const scenario =
    currentT === null
      ? []
      : [
          { stage: "当前实际", assets: currentT },
          {
            stage: "用户完成度情景",
            assets: currentT + ((target - currentT) * completion) / 100,
          },
          { stage: "用户目标", assets: target },
        ];
  return (
    <div className="bg-[#03090e] text-xs text-slate-200">
      <header className="flex justify-between border-b border-slate-700 px-3 py-2">
        <h1>FOEC Tab - 联储分析仪</h1>
        <span className="text-blue-300">FDSP · H.4.1 / 官方观察</span>
      </header>
      <EconomicSourceStatus
        data={query.data}
        fetching={query.isFetching}
        error={Boolean(query.error)}
        refresh={() => void query.refetch()}
      />
      <dl className="flex flex-wrap divide-x divide-slate-800 border-b border-slate-800">
        {[
          ["总资产规模", formatEconomic(currentT) + " 万亿"],
          [
            "每月缩表规模",
            formatEconomic(lastChange?.reduction) + " 十亿（相邻月末净变化）",
          ],
          [
            "准备金余额",
            formatEconomic(
              latestValue(query.data, "WRESBAL") === null
                ? null
                : latestValue(query.data, "WRESBAL")! / 1_000_000
            ) + " 万亿",
          ],
          [
            "联邦基金利率",
            formatEconomic(latestValue(query.data, "DFF")) + " %（有效利率）",
          ],
        ].map(([label, value]) => (
          <div className="flex gap-3 px-3 py-2" key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <EconomicTabs
        tabs={tabs}
        active={active}
        select={index => {
          setActive(index);
          setDetail(false);
        }}
      />
      <main role="tabpanel" aria-label={tabs[active]} className="p-3">
        {active === 0 && (
          <>
            <h2>联储资产负债表可视化 (万亿美元)</h2>
            <p className="py-2 text-slate-500">
              H.4.1
              周度资产及负债组成，百万美元换算为万亿美元。不同观测日不补值；其他资产缺少完整资产分解，保持空。
            </p>
            <EconomicSeriesChart
              rows={balance}
              fields={[
                ["treasury", "国债"],
                ["mbs", "MBS"],
                ["reserves", "准备金"],
                ["tga", "TGA"],
                ["currency", "流通货币"],
              ]}
              label="联储资产负债表可视化"
            />
            <h3>资产负债表构成</h3>
            <EconomicTable
              rows={latestBalance ? [latestBalance] : []}
              columns={[
                ["date", "观察日"],
                ["total", "总资产(T)"],
                ["treasury", "国债(T)"],
                ["mbs", "MBS(T)"],
                ["reserves", "准备金(T)"],
              ]}
              label="资产负债表构成"
            />
            <button
              className="border border-slate-600 px-2 py-1"
              aria-expanded={detail}
              onClick={() => setDetail(!detail)}
            >
              查看详情
            </button>
            {detail && (
              <EconomicTable
                rows={balance}
                columns={[
                  ["date", "观察日"],
                  ["treasury", "国债(T)"],
                  ["mbs", "MBS(T)"],
                  ["reserves", "准备金(T)"],
                  ["tga", "TGA(T)"],
                  ["currency", "流通货币(T)"],
                ]}
                label="资产负债表历史明细"
              />
            )}
          </>
        )}
        {active === 1 && (
          <>
            <h2>QT/QE进程追踪 (每月缩表/扩表规模, 累计规模)</h2>
            <p className="py-2 text-slate-500">
              每月最后一条 H.4.1
              实际总资产相邻差，单位十亿美元；累计规模从本窗口首月开始。净变动含估值等因素，不等同于证券到期缩减计划。
            </p>
            <EconomicSeriesChart
              rows={changes}
              fields={[
                ["reduction", "每月缩表/扩表"],
                ["cumulative", "累计规模"],
              ]}
              label="QT QE净变化"
            />
            <h3>QT/QE最新进展</h3>
            <EconomicTable
              rows={changes}
              columns={[
                ["date", "月份"],
                ["reduction", "本月净变动(Billion)"],
                ["cumulative", "窗口累计净变动(Billion)"],
              ]}
              label="QT QE进展明细"
            />
          </>
        )}
        {active === 2 && (
          <>
            <h2>准备金充裕度分析 (万亿美元)</h2>
            <EconomicSeriesChart
              rows={reserves}
              fields={[["reserves", "准备金余额(T)"]]}
              label="准备金历史"
            />
            <h3>准备金状态</h3>
            <p className="py-2 text-amber-300">
              准备金余额与 IORB
              单位不同，表中独立显示。没有机构阈值模型，不生成“充裕/充足/不足区间”判定。
            </p>
            <EconomicTable
              rows={reserves}
              columns={[
                ["date", "观察日"],
                ["reserves", "准备金余额(T)"],
                ["iorb", "IORB利率%"],
              ]}
              label="准备金状态明细"
            />
          </>
        )}
        {active === 3 && (
          <>
            <h2>联储工具箱 (流动性工具余额, Billion)</h2>
            <EconomicSeriesChart
              rows={toolRows}
              fields={[
                ["onrrp", "ONRRP"],
                ["discount", "贴现窗口一级信贷"],
              ]}
              label="流动性工具余额"
            />
            <h3>流动性工具概览</h3>
            <p className="py-2 text-slate-500">
              ONRRP
              日度十亿美元；一级信贷周度百万美元已换算为十亿美元。BTFP、SRF
              未接入，不能从贷款总额反推。
            </p>
            <EconomicTable
              rows={toolRows}
              columns={[
                ["date", "观察日"],
                ["onrrp", "ONRRP(Billion)"],
                ["discount", "贴现窗口(Billion)"],
              ]}
              label="流动性工具概览"
            />
          </>
        )}
        {active === 4 && (
          <>
            <h2>联储盈亏分析 (净利息收入/亏损, Billion)</h2>
            {financial && <EconomicSeriesChart rows={financial.rows.slice().reverse().map(row => ({ date: String(row.year), netInterest: row.netInterest / 1000 }))} fields={[["netInterest", "净利息收入/亏损(Billion)"]]} label="年度净利息损益" />}
            <h3>联储财务状况</h3>
            {financialQuery.isFetching && <p role="status">正在核验年度报表…</p>}
            {financialQuery.error && <EconomicUnavailable>年度合并审计报表本次更新失败。{financial ? '保留下列上次核验结果，检查时间不变。' : '当前没有可展示的核验数据。'}</EconomicUnavailable>}
            {financial && <>
              <p className="py-2 text-slate-500">年度审计 · 报告期 {financial.reportYear}-12-31 · Billion（十亿美元） · 最近检查 {new Date(financial.retrievedAt).toLocaleString()}。上缴财政部利润为实际汇缴；权责发生制汇缴净额含递延资产变动，不能作为现金收入。</p>
              <EconomicTable
                rows={financialRows}
                columns={[["field", "财务字段"], ["current", `${currentFinancial?.year ?? '本期'} Billion`], ["prior", `${priorFinancial?.year ?? '上期'} Billion`], ["delta", "年度差额 Billion"]]}
                label="联储财务状况"
              />
            </>}
            <button className="text-cyan-400 underline disabled:opacity-40" disabled={!financial} aria-expanded={financialDetail} onClick={() => setFinancialDetail(value => !value)}>查看详细财务报表</button>
            <button className="ml-4 text-cyan-400 disabled:opacity-40" disabled={financialQuery.isFetching} onClick={() => void financialQuery.refetch()}>刷新财务报表</button>
          </>
        )}
        {active === 5 && (
          <>
            <h2>政策正常化路径</h2>
            <h3>缩表完成时间预测</h3>
            <p className="py-2 text-amber-300">
              用户情景，非美联储预测。目标与完成度由用户输入，条件时间用最近三个观察月总资产平均净变化作线性假设；资产扩张时不推算缩表时间。
            </p>
            <div className="flex flex-wrap gap-4 py-3">
              <label>
                目标规模 (万亿美元){" "}
                <input
                  aria-label="目标规模 (万亿美元)"
                  type="number"
                  min="0"
                  step="0.1"
                  value={target}
                  onChange={e => {
                    if (Number.isFinite(e.target.valueAsNumber))
                      setTarget(Math.max(0, e.target.valueAsNumber));
                  }}
                  className="w-20 border border-slate-600 bg-black px-2"
                />
              </label>
              <label>
                预测完成度 {completion}%{" "}
                <input
                  aria-label="预测完成度"
                  type="range"
                  min="0"
                  max="100"
                  value={completion}
                  onChange={e => setCompletion(Number(e.target.value))}
                />
              </label>
            </div>
            <p>
              条件完成时间：
              {completionMonths === null
                ? "条件不满足，未计算"
                : formatEconomic(completionMonths, 1) + " 个月"}
            </p>
            <EconomicTable
              rows={scenario}
              columns={[
                ["stage", "情景"],
                ["assets", "资产规模(T)"],
              ]}
              label="正常化情景结果"
            />
          </>
        )}
      </main>
      <EconomicProvenance data={query.data} group="fdsp" active={active} />
    </div>
  );
}
