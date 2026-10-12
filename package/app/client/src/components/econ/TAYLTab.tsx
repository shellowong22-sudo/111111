import { trpc } from "@/lib/trpc";
import React, { useState } from "react";
import { latestValue, seriesHistory } from "@shared/economicObservations";
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
import { taylorObservations, taylorRate } from "@shared/taylorModel";
const tabs = [
  "实时计算器",
  "多版本对比",
  "敏感性分析",
  "历史偏差",
  "国际比较",
  "前瞻规则",
];
export default function TAYLTab() {
  const [active, setActive] = useState(0);
  const [target, setTarget] = useState(2);
  const [neutral, setNeutral] = useState(0.5);
  const [outWeight, setOutWeight] = useState(0.5);
  const [inflWeight, setInflWeight] = useState(0.5);
  const international =
    trpc.legacyMarketData.getTaylorInternationalRates.useQuery(undefined, {
      enabled: active === 4,
      staleTime: 300_000,
      refetchInterval: 300_000,
      retry: false,
    });
  const [variant, setVariant] = useState("标准");
  const [internationalCountry, setInternationalCountry] = useState("美国");
  const query = useEconomicObservations("tayl");
  const h = (id: string) => seriesHistory(query.data, id);
  const cpi = h("CPIAUCSL");
  const gdp = h("GDPC1");
  const potential = h("GDPPOT");
  const dff = h("DFF");
  const parameters = {
    target,
    neutral,
    inflationWeight: inflWeight,
    outputWeight: outWeight,
  };
  const observations = taylorObservations(gdp, potential, cpi, dff);
  const latest = observations.at(-1);
  const latestInfl = latest?.inflation ?? null;
  const latestGap = latest?.gap ?? null;
  const currentDff = latestValue(query.data, "DFF");
  const suggested = latest
    ? taylorRate(latest.inflation, latest.gap, parameters)
    : null;
  const history = observations.map(p => ({
    ...p,
    taylor: taylorRate(p.inflation, p.gap, parameters),
    deviation:
      taylorRate(p.inflation, p.gap, parameters) === null
        ? null
        : p.actual - taylorRate(p.inflation, p.gap, parameters)!,
  }));
  const variants = [
    { variant: "标准", inflationWeight: 0.5, outputWeight: 0.5 },
    { variant: "平衡", inflationWeight: 0.5, outputWeight: 1 },
    { variant: "鸽派", inflationWeight: 0.25, outputWeight: 1 },
    { variant: "鹰派", inflationWeight: 1, outputWeight: 0.5 },
    { variant: "惯性", inflationWeight: 0.5, outputWeight: 0.5 },
  ].map(p => {
    const raw = latest
      ? taylorRate(latest.inflation, latest.gap, { ...parameters, ...p })
      : null;
    return {
      ...p,
      rate:
        raw === null
          ? null
          : p.variant === "惯性"
            ? 0.8 * latest!.actual + 0.2 * raw
            : raw,
      status:
        p.variant === "惯性"
          ? "用户情景：80%本季度实际利率+20%规则值"
          : "用户情景；非机构预测",
    };
  });
  const sensitivity = [
    ["通胀目标", "target", 1],
    ["通胀目标", "target", 2],
    ["通胀目标", "target", 3],
    ["中性利率", "neutral", 0],
    ["中性利率", "neutral", 1],
    ["产出缺口权重", "outputWeight", 0.25],
    ["产出缺口权重", "outputWeight", 0.5],
    ["产出缺口权重", "outputWeight", 1],
  ].map(([parameter, key, value]) => ({
    parameter,
    value,
    rate: latest
      ? taylorRate(latest.inflation, latest.gap, {
          ...parameters,
          [key as string]: Number(value),
        })
      : null,
  }));
  const setFinite = (setter: (value: number) => void, value: number) => {
    if (Number.isFinite(value)) setter(value);
  };
  const variantHistory = observations.map(p => {
    const v = variants.find(v => v.variant === variant)!;
    const raw = taylorRate(p.inflation, p.gap, {
      ...parameters,
      inflationWeight: v.inflationWeight,
      outputWeight: v.outputWeight,
    });
    return {
      ...p,
      rate:
        raw === null
          ? null
          : variant === "惯性"
            ? 0.8 * p.actual + 0.2 * raw
            : raw,
    };
  });
  const internationalRows = ["美国", "欧元区", "英国", "日本", "加拿大"].map(
    country => {
      const source = international.data?.rows.find(r => r.country === country);
      return {
        country,
        label:
          country === "美国"
            ? "有效联邦基金利率"
            : (source?.label ?? "政策利率"),
        rate: country === "美国" ? currentDff : (source?.value ?? null),
        date: country === "美国" ? dff.at(-1)?.date : source?.date,
        model: country === "美国" ? suggested : null,
        status:
          country === "美国"
            ? "已完成季度配对"
            : source?.status === "available"
              ? "利率可用；缺少模型配对输入"
              : international.isFetching
                ? "正在读取利率"
                : !source && !international.error
                  ? "利率尚未接入；模型输入未齐"
                  : "利率读取失败；模型输入未齐",
      };
    }
  );
  const internationalHistory =
    internationalCountry === "美国"
      ? dff
      : (international.data?.rows.find(r => r.country === internationalCountry)
          ?.history ?? []);
  const sensitivityGrid = Array.from({ length: 7 }, (_, i) => i - 3).flatMap(
    gap =>
      Array.from({ length: 7 }, (_, i) => i).map(inflation => ({
        gap,
        inflation,
        rate: taylorRate(inflation, gap, parameters),
      }))
  );
  return (
    <div className="bg-[#03090e] text-xs text-slate-200">
      <header className="flex justify-between border-b border-slate-700 px-3 py-2">
        <h1>泰勒规则模型</h1>
        <span className="text-yellow-300">TAYL · 数据模型</span>
      </header>
      <EconomicSourceStatus
        data={query.data}
        fetching={query.isFetching || (active === 4 && international.isFetching)}
        error={Boolean(query.error || (active === 4 && international.error))}
        refresh={() => {
          void query.refetch();
          if (active === 4) void international.refetch();
        }}
      />
      <EconomicTabs tabs={tabs} active={active} select={setActive} />
      <main role="tabpanel" aria-label={tabs[active]} className="p-3">
        {active === 0 && (
          <>
            <h2>实时泰勒规则计算器</h2>
            <p className="py-2 text-slate-400">
              R = r* + π + a(π−π*) +
              b·gap。gap=(实际GDP/潜在GDP−1)×100；CPI同比使用完整季度三个月均值，DFF使用同季度日均值。当前配对季度{" "}
              {latest?.date ?? "—"}
              ；最新政策利率单独显示，不混作同季度输入。参数是用户情景，潜在GDP为模型估计，历史为修订后序列而非实时回测。
            </p>
            <div className="flex flex-wrap gap-3 border-y border-slate-800 py-2">
              <label>
                通胀目标{" "}
                <input
                  type="number"
                  aria-label="通胀目标"
                  value={target}
                  onChange={e => setFinite(setTarget, e.target.valueAsNumber)}
                  className="w-16 border border-slate-600 bg-black px-1"
                />
              </label>
              <label>
                中性利率{" "}
                <input
                  type="number"
                  aria-label="中性利率"
                  value={neutral}
                  onChange={e => setFinite(setNeutral, e.target.valueAsNumber)}
                  className="w-16 border border-slate-600 bg-black px-1"
                />
              </label>
              <label>
                通胀权重{" "}
                <input
                  type="number"
                  aria-label="通胀权重"
                  value={inflWeight}
                  onChange={e =>
                    setFinite(setInflWeight, e.target.valueAsNumber)
                  }
                  className="w-16 border border-slate-600 bg-black px-1"
                />
              </label>
              <label>
                产出权重{" "}
                <input
                  type="number"
                  aria-label="产出权重"
                  value={outWeight}
                  onChange={e =>
                    setFinite(setOutWeight, e.target.valueAsNumber)
                  }
                  className="w-16 border border-slate-600 bg-black px-1"
                />
              </label>
            </div>
            <EconomicTable
              rows={[
                { field: "当前通胀同比%", value: latestInfl },
                { field: "实际产出缺口百分点", value: latestGap },
                { field: "有效联邦基金利率%", value: currentDff },
                { field: "模型建议利率%", value: suggested },
              ]}
              columns={[
                ["field", "字段"],
                ["value", "值"],
              ]}
              label="实时泰勒模型输入输出"
            />
          </>
        )}
        {active === 1 && (
          <>
            <h2>多版本规则对比</h2>
            <EconomicTable
              rows={variants}
              columns={[
                ["variant", "版本"],
                ["inflationWeight", "通胀偏差系数"],
                ["outputWeight", "产出缺口系数"],
                ["rate", "建议利率%"],
                ["status", "状态"],
              ]}
              label="泰勒规则版本对比"
            />
            <label className="block py-2">
              版本下钻{" "}
              <select
                aria-label="版本下钻"
                value={variant}
                onChange={e => setVariant(e.target.value)}
                className="bg-black border border-slate-600"
              >
                {variants.map(v => (
                  <option key={v.variant}>{v.variant}</option>
                ))}
              </select>
            </label>
            <EconomicSeriesChart
              rows={variantHistory}
              fields={[
                ["rate", variant + "规则%"],
                ["actual", "实际利率%"],
              ]}
              label="版本历史比较"
            />
            <details className="border-t border-slate-700 p-2">
              <summary>展开该版本计算明细</summary>
              <EconomicTable
                rows={variantHistory}
                columns={[
                  ["date", "季度"],
                  ["inflation", "通胀%"],
                  ["gap", "产出缺口%"],
                  ["rate", "规则利率%"],
                  ["actual", "实际利率%"],
                ]}
                label="版本计算明细"
              />
            </details>
          </>
        )}
        {active === 2 && (
          <>
            <h2>参数敏感性分析</h2>
            <EconomicTable
              rows={sensitivity}
              columns={[
                ["parameter", "参数"],
                ["value", "取值"],
                ["rate", "建议利率%"],
              ]}
              label="泰勒规则敏感性"
            />
            <h3 className="py-2">通胀 × 产出缺口敏感性矩阵（用户情景）</h3>
            <div className="overflow-auto">
              <table aria-label="敏感性矩阵" className="w-full text-right">
                <thead>
                  <tr>
                    <th>缺口 / 通胀</th>
                    {Array.from({ length: 7 }, (_, i) => (
                      <th key={i}>{i}%</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }, (_, i) => i - 3).map(gap => (
                    <tr key={gap}>
                      <th>{gap}%</th>
                      {sensitivityGrid
                        .filter(p => p.gap === gap)
                        .map(p => (
                          <td
                            key={p.inflation}
                            className="border border-slate-800 p-2"
                            style={{
                              background:
                                p.rate !== null && p.rate > 4
                                  ? "#382324"
                                  : "#102e35",
                            }}
                          >
                            {formatEconomic(p.rate)}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {active === 3 && (
          <>
            <h2>历史规则偏差</h2>
            <EconomicSeriesChart
              rows={history}
              fields={[["deviation", "实际减规则（百分点）"]]}
              label="历史偏差曲线"
            />
            <EconomicTable
              rows={history}
              columns={[
                ["date", "观察期"],
                ["actual", "实际DFF%"],
                ["taylor", "规则建议%"],
                ["deviation", "实际减规则百分点"],
              ]}
              label="历史偏差明细"
            />
          </>
        )}
        {active === 4 && (
          <>
            <h2>国际比较</h2>
            <EconomicTable
              rows={internationalRows}
              columns={[
                ["country", "经济体"],
                ["label", "利率口径"],
                ["rate", "实际政策利率%"],
                ["date", "观测期"],
                ["model", "规则利率%"],
                ["status", "状态"],
              ]}
              label="国际泰勒规则比较"
            />
            <label className="block py-2">
              国家下钻{" "}
              <select
                aria-label="国际利率国家"
                value={internationalCountry}
                onChange={e => setInternationalCountry(e.target.value)}
                className="border border-slate-600 bg-black"
              >
                {internationalRows.map(r => (
                  <option key={r.country}>{r.country}</option>
                ))}
              </select>
            </label>
            <EconomicSeriesChart
              rows={internationalHistory}
              fields={[["value", "利率%"]]}
              label="所选国家利率历史"
            />
            <details className="border-t border-slate-700 p-2">
              <summary>展开利率观察明细</summary>
              <EconomicTable
                rows={internationalHistory}
                columns={[
                  ["date", "观测期"],
                  ["value", "利率%"],
                ]}
                label="国际利率明细"
              />
            </details>
            <p className="p-2 text-slate-500">
              实际利率与规则模型分别校验；非美国经济体缺少同口径GDP及潜在GDP配对时，规则值为空。利率口径不同，不把同业利率替代政策利率。
            </p>
          </>
        )}
        {active === 5 && (
          <>
            <h2>前瞻规则</h2>
            <EconomicUnavailable>
              前瞻规则需要授权预测的
              CPI、产出缺口和政策路径。当前只显示历史真实输入，不外推未来数值。
            </EconomicUnavailable>
            <EconomicTable
              rows={[
                { period: "未来12个月", rate: null, status: "未接入预测源" },
              ]}
              columns={[
                ["period", "期间"],
                ["rate", "建议利率%"],
                ["status", "状态"],
              ]}
              label="前瞻规则状态"
            />
          </>
        )}
        {active === 0 && (
          <>
            <details className="border-t border-slate-700 p-2">
              <summary>查看详情</summary>
              <EconomicTable
                rows={history}
                columns={[
                  ["date", "季度"],
                  ["inflation", "CPI同比%"],
                  ["gap", "产出缺口%"],
                  ["actual", "实际利率%"],
                  ["taylor", "规则利率%"],
                  ["deviation", "实际减规则百分点"],
                ]}
                label="规则输入历史明细"
              />
            </details>
            <h3 className="p-2">泰勒规则公式</h3>
            <details className="border-t border-slate-700 p-2">
              <summary>了解更多</summary>
              <p>
                R = r* + π + a(π−π*) +
                b·gap。CPI同比精确匹配去年同月，再按完整季度取均值。实际GDP与潜在GDP按同季度和同单位对齐，缺失期不填充。模型是用户情景，不构成利率预测。
              </p>
            </details>
          </>
        )}
      </main>
      <EconomicProvenance data={query.data} group="tayl" active={active} />
    </div>
  );
}
