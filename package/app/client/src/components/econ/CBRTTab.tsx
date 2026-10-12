import React, { useState } from "react";
import {
  seriesHistory,
  periodLast,
  alignSeries,
  latestValue,
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
  "全球利率热力矩阵",
  "利率周期分析",
  "实际利率排名",
  "利率差异与汇率",
  "历史加息周期对比",
  "利率预测路径",
];
const countries = [
  "美国",
  "欧元区",
  "日本",
  "英国",
  "加拿大",
  "澳大利亚",
  "瑞士",
  "瑞典",
  "挪威",
  "新西兰",
  "中国",
  "印度",
  "巴西",
  "俄罗斯",
  "南非",
  "韩国",
  "墨西哥",
  "土耳其",
  "印尼",
  "沙特",
];
const sourceByCountry: Record<string, string> = {
  美国: "DFEDTARU",
  欧元区: "ECBDFR",
};
export default function CBRTTab() {
  const [active, setActive] = useState(0);
  const [country, setCountry] = useState("美国");
  const query = useEconomicObservations("cbrt");
  const h = (id: string) => seriesHistory(query.data, id);
  const available = countries.flatMap(country => {
    const id = sourceByCountry[country];
    const value = id ? latestValue(query.data, id) : null;
    return value === null ? [] : [{ country, value }];
  });
  const months = [
    ...new Set(
      [...periodLast(h("DFEDTARU")), ...periodLast(h("ECBDFR"))].map(
        p => p.date
      )
    ),
  ]
    .sort()
    .slice(-12);
  const matrix = countries.map(country => {
    const history = new Map(
      periodLast(h(sourceByCountry[country] ?? "")).map(p => [p.date, p.value])
    );
    return {
      country,
      ...Object.fromEntries(
        months.map(month => [month, history.get(month) ?? null])
      ),
    };
  });
  const events = countries.flatMap(country => {
    const points = h(sourceByCountry[country] ?? "");
    return points.flatMap((p, i) =>
      i && p.value !== points[i - 1].value
        ? [
            {
              date: p.date,
              country,
              before: points[i - 1].value,
              after: p.value,
              change: p.value - points[i - 1].value,
            },
          ]
        : []
    );
  });
  const latestEvents = available.map(({ country, value }) => {
    const event = events.filter(e => e.country === country).at(-1);
    return {
      country,
      value,
      lastChange: event?.date ?? null,
      direction: event
        ? event.change > 0
          ? "最近一次上调"
          : "最近一次下调"
        : "窗口内无变动",
      step: event?.change ?? null,
    };
  });
  const cpi = h("CPIAUCSL");
  const inflation = cpi.flatMap(p => {
    const target = Number(p.date.slice(0, 4)) - 1 + p.date.slice(4);
    const prior = cpi.find(q => q.date === target);
    return prior?.value
      ? [{ date: p.date.slice(0, 7), value: (p.value / prior.value - 1) * 100 }]
      : [];
  });
  const realRows = alignSeries(
    { nominal: periodLast(h("DFEDTARU")), inflation },
    true
  ).map(row => ({
    ...row,
    real: (row.nominal as number) - (row.inflation as number),
  }));
  const diff = alignSeries(
    { fed: h("DFEDTARU"), eur: h("ECBDFR"), fx: h("DEXUSEU") },
    true
  ).map(row => ({ ...row, spread: (row.fed as number) - (row.eur as number) }));
  const selected = h(sourceByCountry[country] ?? "").map(p => ({
    date: p.date,
    rate: p.value,
  }));
  const latestRate = available.map(row => row.value);
  const hikes = latestEvents.filter(e => e.step !== null && e.step > 0).length;
  return (
    <div className="bg-[#03090e] text-xs text-slate-200">
      <header className="flex justify-between border-b border-slate-700 px-3 py-2">
        <h1>央行利率/全球利率矩阵</h1>
        <span className="text-red-300">CBRT · 政策利率观察</span>
      </header>
      <EconomicSourceStatus
        data={query.data}
        fetching={query.isFetching}
        error={Boolean(query.error)}
        refresh={() => void query.refetch()}
      />
      <dl className="flex flex-wrap divide-x divide-slate-800 border-b border-slate-800">
        {[
          ["全球平均利率", "— 覆盖不足，不估算全球均值"],
          ["加息央行数量", hikes + "（仅已接入央行最近变动）"],
          [
            "最高政策利率",
            formatEconomic(latestRate.length ? Math.max(...latestRate) : null) +
              " %（已接入范围）",
          ],
          [
            "最低政策利率",
            formatEconomic(latestRate.length ? Math.min(...latestRate) : null) +
              " %（已接入范围）",
          ],
        ].map(([l, v]) => (
          <div key={l} className="flex gap-3 px-3 py-2">
            <dt className="text-slate-500">{l}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <EconomicTabs tabs={tabs} active={active} select={setActive} />
      <main role="tabpanel" aria-label={tabs[active]} className="p-3">
        {active === 0 && (
          <>
            <h2>全球利率热力矩阵 (20个国家 × 12个月)</h2>
            <p className="py-2 text-slate-500">
              美国为目标区间上限，欧元区为存款便利利率；每月最后实际观察。其余国家未接入政策利率，不以同业利率或随机数填充。
            </p>
            <div className="overflow-auto">
              <table className="w-full whitespace-nowrap text-[11px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left">国家</th>
                    {months.map(m => (
                      <th key={m}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(row => (
                    <tr key={row.country} className="border-t border-slate-800">
                      <th className="p-2 text-left font-normal">
                        {row.country}
                      </th>
                      {months.map(m => {
                        const value = (row as Record<string, unknown>)[m];
                        return (
                          <td
                            key={m}
                            className="p-2 text-center"
                            style={{
                              background:
                                typeof value === "number"
                                  ? "rgba(239,68,68," +
                                    Math.min(
                                      0.65,
                                      0.08 + Math.abs(value) / 20
                                    ) +
                                    ")"
                                  : undefined,
                            }}
                          >
                            {formatEconomic(value, 2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {active === 1 && (
          <>
            <h2>利率周期分析</h2>
            <label className="block py-2">
              国家{" "}
              <select
                aria-label="利率周期国家"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="border border-slate-600 bg-black px-2 py-1"
              >
                {countries.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <EconomicSeriesChart
              rows={selected}
              fields={[["rate", country + "政策利率%"]]}
              label="国家政策利率历史"
            />
            <EconomicTable
              rows={latestEvents.filter(row => row.country === country)}
              columns={[
                ["country", "国家"],
                ["value", "当前利率%"],
                ["lastChange", "最近变更日"],
                ["direction", "变动方向"],
                ["step", "幅度(百分点)"],
              ]}
              label="政策周期状态"
            />
          </>
        )}
        {active === 2 && (
          <>
            <h2>实际利率排名</h2>
            <p className="py-2 text-slate-500">
              美国政策上限减同月 CPI
              同比，为事后实际利率观察。其它国家缺少同口径通胀，不能给出全球排名；不使用美国通胀代替他国通胀。
            </p>
            <EconomicSeriesChart
              rows={realRows}
              fields={[["real", "美国事后实际利率%"]]}
              label="实际利率历史"
            />
            <EconomicTable
              rows={realRows}
              columns={[
                ["date", "月份"],
                ["nominal", "月末政策上限%"],
                ["inflation", "CPI同比%"],
                ["real", "事后实际利率%"],
              ]}
              label="实际利率配对"
            />
          </>
        )}
        {active === 3 && (
          <>
            <h2>利率差异与汇率</h2>
            <p className="py-2 text-slate-500">
              仅同日美国目标上限、ECB存款便利及美元/欧元参考汇率配对。图表显示政策利差；汇率独立列示，不混用同一纵轴。
            </p>
            <EconomicSeriesChart
              rows={diff}
              fields={[["spread", "美欧政策利差(百分点)"]]}
              label="政策利差历史"
            />
            <EconomicTable
              rows={diff}
              columns={[
                ["date", "日期"],
                ["fed", "美国上限%"],
                ["eur", "ECB存款便利%"],
                ["spread", "利差(百分点)"],
                ["fx", "美元/欧元"],
              ]}
              label="利率汇率配对"
            />
          </>
        )}
        {active === 4 && (
          <>
            <h2>历史加息周期对比</h2>
            <p className="py-2 text-slate-500">
              十年窗口内政策利率真实变更事件，列出前值、后值和步长。尚未获得完整历史周期边界，不编造周期持续月份或GDP权重。
            </p>
            <EconomicTable
              rows={events}
              columns={[
                ["date", "变更观察日"],
                ["country", "国家"],
                ["before", "前值%"],
                ["after", "后值%"],
                ["change", "变动百分点"],
              ]}
              label="政策变更事件"
            />
          </>
        )}
        {active === 5 && (
          <>
            <h2>利率预测路径</h2>
            <EconomicUnavailable>
              Fed、ECB、BoJ、BoE、PBoC
              预测路径需要已授权的远期/OIS或机构预测数据。当前仅有公布利率，不能据此生成未来12个月降息路径。
            </EconomicUnavailable>
            <EconomicTable
              rows={["Fed", "ECB", "BoJ", "BoE", "PBoC"].map(bank => ({
                bank,
                forecast: null,
                status: "未接入预测数据",
              }))}
              columns={[
                ["bank", "央行"],
                ["forecast", "路径"],
                ["status", "状态"],
              ]}
              label="预测字段状态"
            />
          </>
        )}
      </main>
      <EconomicProvenance data={query.data} group="cbrt" active={active} />
    </div>
  );
}
