import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { ResearchSplit } from "./stock/StockObservationDesk";
import { formatObservation as fmt } from "./stock/stockObservationModel";
import {
  annualQualityEvidence,
  computeIcEvidence,
  factorAttribution,
  parseFactorReturns,
  parseIcEvidence,
  type FactorReturnInput,
  type IcInput,
} from "./stock/ftwFactorEvidence";

const input = "input-terminal h-7 px-2 text-[11px]";
const button =
  "border border-slate-700 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40";
const tip = {
  contentStyle: {
    background: "#070d18",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 10,
  },
};
const FACTOR_DEFINITIONS = [
  {
    id: "net_margin",
    code: "NPM",
    name: "年度净利率",
    definition: "同起止日、同申报版本净利润 / 收入",
    source: "SEC XBRL 已接入",
  },
  {
    id: "equity_ratio",
    code: "EQ/A",
    name: "权益资产比",
    definition: "同期末、同申报版本股东权益 / 总资产",
    source: "SEC XBRL 已接入",
  },
  {
    id: "bp",
    code: "B/P",
    name: "账面市值比",
    definition: "普通股账面权益 / 同时点普通股市值",
    source: "需要证券级市值与普通股口径授权",
  },
  {
    id: "mom_12_1",
    code: "MOM",
    name: "12−1月价格动量",
    definition: "跳过最近1个月的历史价格收益",
    source: "需要完整企业行动调整价格与日历",
  },
  {
    id: "low_vol",
    code: "LVOL",
    name: "历史低波动",
    definition: "明确频率及窗口的历史收益标准差",
    source: "需要统一频率、完整价格与调整口径",
  },
  {
    id: "fcf_yield",
    code: "FCFY",
    name: "自由现金流收益率",
    definition: "经营现金流减资本支出 / 同时点市值",
    source: "需要现金流、资本支出及市值",
  },
  {
    id: "piotroski_f",
    code: "FSCR",
    name: "F-Score",
    definition: "九项财务条件逐项核验，不能只以净利润替代",
    source: "需要九项原始输入与同比可比期间",
  },
  {
    id: "composite_quality",
    code: "CQUAL",
    name: "综合质量",
    definition: "指定样本、字段、标准化与权重后计算",
    source: "需要横截面样本及明确模型版本",
  },
  {
    id: "bab",
    code: "BAB",
    name: "低Beta相对组合",
    definition: "低/高Beta组合、杠杆与再平衡规则明确",
    source: "需要授权横截面、收益与组合规则",
  },
  {
    id: "china_reversal",
    code: "CREV",
    name: "A股反转",
    definition: "指定观察窗口的滞后收益与后续收益检验",
    source: "需要授权A股调整历史与交易日历",
  },
];
const tabs = [
  ["signals", "信号核验"],
  ["watchlist", "自选因子"],
  ["ic", "IC监控"],
  ["rotation", "因子轮动"],
  ["attribution", "收益归因"],
] as const;
type Tab = (typeof tabs)[number][0];
const icHeader =
  "date\tinstrumentId\tfactorId\tfactorValue\tforwardReturn\treturnEnd\tsource\tfactorUnit\tcurrency\tmodelVersion\tavailableDate";
const returnsHeader = "date\tfactorId\treturnPct\tweightPct\tsource\tperiodStart\tcurrency\tmodelVersion";

export default function FTWPanel({ onClose }: { onClose?: () => void }) {
  const instance = useId();
  const [active, setActive] = useState<Tab>("signals");
  const [draft, setDraft] = useState("AAPL");
  const [issuer, setIssuer] = useState<{
    cik: string;
    ticker: string;
    name: string;
  } | null>(null);
  const directCik = /^\d{1,10}$/.test(draft.trim()) && Number(draft.trim()) > 0 ? draft.trim().padStart(10, '0') : null;
  const readExplicitCik = () => {
    if (directCik) setIssuer({ cik: directCik, ticker: `CIK ${directCik}`, name: '名称待 SEC 事实核验' });
  };
  const [watch, setWatch] = useState(["net_margin", "equity_ratio"]);
  const [filter, setFilter] = useState("");
  const search = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: draft || "A", limit: 8 },
    {
      enabled: active === "signals" && !issuer && draft.trim().length >= 2 && draft.trim().length <= 80,
      staleTime: 3600000,
    }
  );
  const facts = trpc.stockMarketResearch.getCompanyFacts.useQuery(
    { cik: issuer?.cik ?? "0" },
    {
      enabled: active === "signals" && !!issuer,
      staleTime: 60_000,
      refetchInterval: active === "signals" && issuer ? 60_000 : false,
      refetchOnReconnect: true,
    }
  );
  const quality = useMemo(
    () => facts.isError ? [] : annualQualityEvidence(facts.data?.metrics ?? []),
    [facts.data?.metrics, facts.isError]
  );
  const [icDraft, setIcDraft] = useState(icHeader);
  const [icRows, setIcRows] = useState<IcInput[]>([]);
  const [icMessage, setIcMessage] = useState("");
  const [factorId, setFactorId] = useState("");
  const ics = useMemo(() => computeIcEvidence(icRows), [icRows]);
  const icSeriesKey = (row: (typeof ics)[number]) => JSON.stringify([row.factorId, (Date.parse(row.returnEnd) - Date.parse(row.date)) / 86400000]);
  const factors = [...new Map(ics.map(row => [icSeriesKey(row), `${row.factorId} · ${(Date.parse(row.returnEnd) - Date.parse(row.date)) / 86400000}日 · ${row.factorUnit}/${row.currency} · ${row.modelVersion}`])).entries()];
  const effectiveFactor = factors.some(([key]) => key === factorId)
    ? factorId
    : (factors[0]?.[0] ?? "");
  const icVisible = ics.filter(row => icSeriesKey(row) === effectiveFactor);
  const [returnsDraft, setReturnsDraft] = useState(returnsHeader);
  const [returns, setReturns] = useState<FactorReturnInput[]>([]);
  const [returnsMessage, setReturnsMessage] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const dates = [...new Set(returns.map(row => row.date))];
  const effectiveDate = dates.includes(returnDate)
    ? returnDate
    : (dates.at(-1) ?? "");
  const dayRows = returns.filter(row => row.date === effectiveDate);
  const attribution = factorAttribution(dayRows);
  const weightSum = dayRows.reduce((sum, row) => sum + row.weightPct, 0);
  const contributionSum = attribution.reduce(
    (sum, row) => sum + row.contributionPct,
    0
  );
  const [network, setNetwork] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  useEffect(() => {
    const change = () => setNetwork(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  const chart = (data: unknown[], key: string, name: string) => (
    <div className="h-[260px] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis
            dataKey={key}
            tick={{ fill: "#94a3b8", fontSize: 9 }}
            minTickGap={18}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 9 }}
            domain={["auto", "auto"]}
          />
          <Tooltip {...tip} />
          <Line
            dataKey={name}
            stroke="#22d3ee"
            dot={data.length < 3}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Brush dataKey={key} height={17} stroke="#334155" fill="#020617" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
  const returnsEditor = (
    <details className="border-b border-slate-800 p-2" open={!returns.length}>
      <summary className="cursor-pointer text-[11px] text-cyan-200">
        授权因子收益与期初权重输入（轮动 / 归因共用）
      </summary>
      <p className="py-2 text-[10px] leading-5 text-slate-500">
        date 为期间末、periodStart 为期初权重日；同一末日须有相同起始日、currency（如USD）与modelVersion。按UTC日期，期间末必须早于今日，不推断今日市场已收盘。returnPct及weightPct均用百分数（5表示5%），期初长仓权重0–100%，合计不得超过100%。仅适用于互不重叠、同币种的长仓因子子组合，不把多空因子回报当资产权重。source须填写来源；输入仅留在本窗口。
      </p>
      <textarea
        aria-label="FTW 因子收益 TSV"
        value={returnsDraft}
        onChange={event => setReturnsDraft(event.target.value)}
        className="input-terminal min-h-24 w-full font-mono text-[10px]"
      />
      <button
        type="button"
        className={`${button} mt-2`}
        onClick={() => {
          const result = parseFactorReturns(returnsDraft);
          if (result.error) {
            setReturnsMessage(result.error);
            return;
          }
          setReturns(result.rows);
          setReturnsMessage(
            `已应用 ${result.rows.length} 行，拦截 ${result.duplicates} 条精确重复。`
          );
        }}
      >
        校验并应用因子收益
      </button>
      <p role="status" className="py-1 text-[10px] text-amber-200">
        {returnsMessage}
      </p>
    </details>
  );
  return (
    <div className="min-w-0 bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-slate-800 px-2 py-2 text-xs">
        <span>
          <b className="font-mono text-cyan-200">FTW</b> · 因子证据与授权研究
        </span>
        <span className="text-[10px] text-slate-500">
          {!network ? "已断线 · 保留旧观察" : "SEC 定期核验 / 用户显式输入"}
          {onClose && (
            <button
              type="button"
              aria-label="关闭FTW工具"
              onClick={onClose}
              className="ml-3"
            >
              ×
            </button>
          )}
        </span>
      </header>
      <div
        role="tablist"
        aria-label="FTW 因子分析能力"
        className="flex overflow-x-auto border-b border-slate-800"
      >
        {tabs.map(([key, label], index) => (
          <button
            key={key}
            id={`${instance}-${key}`}
            aria-controls={`${instance}-body`}
            type="button"
            role="tab"
            aria-selected={active === key}
            tabIndex={active === key ? 0 : -1}
            onClick={() => setActive(key)}
            onKeyDown={event => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const next =
                  tabs[
                    (index +
                      (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                      tabs.length
                  ][0];
                setActive(next);
                document.getElementById(`${instance}-${next}`)?.focus();
              }
            }}
            className={`shrink-0 border-r border-slate-800 px-3 py-2 text-[11px] ${active === key ? "bg-cyan-950/30 text-cyan-100" : "text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id={`${instance}-body`}
        role="tabpanel"
        aria-labelledby={`${instance}-${active}`}
      >
        {active === "signals" && (
          <>
            <div className="flex flex-wrap gap-2 border-b border-slate-800 p-2">
              <label className="text-[10px] text-slate-500">
                SEC 主体
                <input
                  aria-label="FTW SEC 主体"
                  value={draft}
                  maxLength={80}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && network) {
                      event.preventDefault();
                      if (directCik) readExplicitCik();
                      else if (draft.trim().length >= 2) void search.refetch();
                    }
                  }}
                  className={`${input} ml-1 w-40`}
                />
              </label>
              <button type="button" disabled={search.isFetching || !network || draft.trim().length < 2} onClick={() => { setIssuer(null); void search.refetch(); }} className={button}>
                重试主体目录
              </button>
              <button type="button" disabled={!directCik || !network} onClick={readExplicitCik} className={button}>
                按CIK读取事实
              </button>
              <button
                type="button"
                disabled={!issuer || facts.isFetching || !network}
                onClick={() => void facts.refetch()}
                className={button}
              >
                刷新年度事实
              </button>
            </div>
            {!issuer ? (
              <div className="max-h-48 overflow-auto">
                {search.isFetching ? (
                  <p className="p-3 text-xs text-slate-400">
                    读取 SEC 主体目录…
                  </p>
                ) : (
                  (search.isError || search.data?.status === 'unavailable' ? [] : search.data?.results ?? []).map(row => (
                    <button
                      key={row.cik}
                      type="button"
                      onClick={() => setIssuer(row)}
                      className="block w-full border-b border-slate-800 p-2 text-left text-[11px] text-cyan-200"
                    >
                      {row.ticker} · {row.name} · CIK {row.cik}
                    </button>
                  ))
                )}
                {!search.isFetching && (search.isError || search.data?.status === 'unavailable' || !search.data?.results?.length) && (
                  <p role="status" className="p-3 text-xs text-amber-200">
                    {!network ? '当前离线，无法读取 SEC 主体目录；联网后可重试。' : search.error?.message ??
                      (search.data?.status === 'unavailable' ? search.data.sourceBoundary : draft.trim().length < 2 ? '请输入至少2个字符检索名称或代码；已知CIK可直接读取。' : 'SEC主体目录已读取，但没有匹配结果。')}
                    {' '}可重试目录；如已知真实CIK，输入1–10位有效数字后点“按CIK读取事实”，不依赖目录成功，不推断证券代码对应的CIK。
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-between border-b border-slate-800 p-2 text-[11px]">
                  <span>
                    {issuer.ticker} · {facts.data?.issuer?.name ?? issuer.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIssuer(null)}
                    className="text-cyan-200"
                  >
                    更换主体
                  </button>
                </div>
                {facts.isFetching && !facts.data ? (
                  <p className="p-6 text-xs text-slate-400">
                    读取同申报版本年度数据…
                  </p>
                ) : !quality.length ? (
                  <p role="status" className="p-6 text-xs text-amber-200">
                    {facts.error?.message ?? (facts.data?.sourceStatus === 'unavailable' ? facts.data.sourceBoundary :
                      "未找到同起止日、同申报版本的年度收入与净利润，不能生成质量比率。")}
                    不把缺失字段变成评分或买卖信号。
                  </p>
                ) : (
                  <ResearchSplit
                    label="FTW 年度质量与数据证据"
                    left={
                      <table className="w-full text-right text-[10px]">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="p-2 text-left">年度期末</th>
                            <th>净利率%</th>
                            <th className="pr-2">权益/资产%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quality.map(row => (
                            <tr
                              key={`${row.start}-${row.end}`}
                              className="border-t border-slate-800"
                            >
                              <td className="p-2 text-left text-cyan-200">
                                {row.end}
                              </td>
                              <td>{fmt(row.netMargin)}</td>
                              <td className="pr-2">{fmt(row.equityRatio)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    }
                    right={
                      <>
                        {chart(quality, "end", "netMargin")}
                        <details className="border-t border-slate-800 p-2">
                          <summary className="cursor-pointer text-[11px] text-cyan-200">
                            展开收入、净利润与申报版本证据
                          </summary>
                          <div className="max-h-48 overflow-auto">
                            <table className="w-full min-w-[670px] text-right text-[10px]">
                              <thead className="text-slate-500">
                                <tr>
                                  <th className="p-2 text-left">期间</th>
                                  <th>收入</th>
                                  <th>净利润</th>
                                  <th>货币</th>
                                  <th className="p-2 text-left">
                                    申报 / 最新修订
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {quality.map(row => (
                                  <tr
                                    key={row.accession + row.end}
                                    className="border-t border-slate-800"
                                  >
                                    <td className="p-2 text-left">
                                      {row.start} → {row.end}
                                    </td>
                                    <td>{fmt(row.revenue, 0)}</td>
                                    <td>{fmt(row.netIncome, 0)}</td>
                                    <td>{row.unit}</td>
                                    <td className="p-2 text-left">
                                      {row.accession}
                                      <span className="block text-slate-500">
                                        {row.filed} · {row.revisionCount}版本 ·{" "}
                                        {row.revenueId}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </>
                    }
                  />
                )}
              </>
            )}
            <p className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">
              质量比率不是投资建议。只用年度期间、已知币种及同申报版本；重复事实不增加版本数，冲突版本不计算，未来申报不使用。图表每个期间保留最新可核验修订（不是历史时点回测）；来源
              SEC XBRL，读取 UTC{" "}
              {facts.dataUpdatedAt
                ? new Date(facts.dataUpdatedAt).toISOString()
                : "—"}
              。未取得其他输入时不生成F-Score、综合评分、买入卖出或市场周期。
            </p>
          </>
        )}
        {active === "watchlist" && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2">
              <input
                aria-label="筛选因子定义"
                value={filter}
                onChange={event => setFilter(event.target.value)}
                className={`${input} flex-1`}
                placeholder="名称 / 代码 / 来源"
              />
              <span className="text-[10px] text-slate-500">
                已关注 {watch.length} · 当前窗口
              </span>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[600px] text-left text-[11px]">
                <thead className="text-slate-500">
                  <tr>
                    <th className="p-2">关注</th>
                    <th>因子</th>
                    <th>唯一定义</th>
                    <th className="p-2">真实输入条件</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTOR_DEFINITIONS.filter(row =>
                    `${row.code} ${row.name} ${row.source}`
                      .toLowerCase()
                      .includes(filter.toLowerCase())
                  ).map(row => (
                    <tr key={row.id} className="border-t border-slate-800">
                      <td className="p-2">
                        <button
                          type="button"
                          aria-label={`${watch.includes(row.id) ? "取消关注" : "关注"} ${row.name}`}
                          aria-pressed={watch.includes(row.id)}
                          onClick={() =>
                            setWatch(current =>
                              current.includes(row.id)
                                ? current.filter(id => id !== row.id)
                                : [...current, row.id]
                            )
                          }
                          className="text-cyan-200"
                        >
                          {watch.includes(row.id) ? "★" : "☆"}
                        </button>
                      </td>
                      <td className="text-cyan-200">
                        {row.code}
                        <span className="block text-slate-400">{row.name}</span>
                      </td>
                      <td className="pr-2 text-slate-400">{row.definition}</td>
                      <td className="p-2 text-slate-500">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-800 p-2 text-[10px] text-slate-500">
              目录仅是指标定义与输入条件，不含静态收益率、IC、Sharpe或市场评分；现有自选业务保持可操作。
            </p>
          </>
        )}
        {active === "ic" && (
          <>
            <details
              open={!icRows.length}
              className="border-b border-slate-800 p-2"
            >
              <summary className="cursor-pointer text-[11px] text-cyan-200">
                授权横截面样本输入
              </summary>
              <p className="py-2 text-[10px] leading-5 text-slate-500">
                date为观察日，availableDate为数据可获得日且不得晚于date；returnEnd须晚于date且早于今日UTC。forwardReturn为同币种的简单收益百分数（5表示5%，不能低于−100%）；factorUnit、currency、modelVersion与source必填，同因子不能混口径。每个证券/因子/区间唯一，输入不上传、不自动发布。
              </p>
              <textarea
                aria-label="FTW IC样本 TSV"
                value={icDraft}
                onChange={event => setIcDraft(event.target.value)}
                className="input-terminal min-h-24 w-full font-mono text-[10px]"
              />
              <button
                type="button"
                className={`${button} mt-2`}
                onClick={() => {
                  const result = parseIcEvidence(icDraft);
                  if (result.error) {
                    setIcMessage(result.error);
                    return;
                  }
                  setIcRows(result.rows);
                  setIcMessage(
                    `已应用 ${result.rows.length} 行，拦截 ${result.duplicates} 条精确重复。`
                  );
                }}
              >
                校验并计算IC
              </button>
              <p role="status" className="py-1 text-[10px] text-amber-200">
                {icMessage}
              </p>
            </details>
            {!ics.length ? (
              <p role="status" className="p-6 text-xs text-slate-500">
                尚无授权因子横截面与已完成收益样本，不显示固定IC或“有效”标签。
              </p>
            ) : (
              <>
                <div className="border-b border-slate-800 p-2">
                  <select
                    aria-label="FTW IC因子"
                    value={effectiveFactor}
                    onChange={event => setFactorId(event.target.value)}
                    className={input}
                  >
                    {factors.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
                <ResearchSplit
                  label="FTW IC记录与轨迹"
                  left={
                    <table className="w-full text-right text-[10px]">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="p-2 text-left">观察/收益末</th>
                          <th>证券数</th>
                          <th className="p-2">Spearman IC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {icVisible.map(row => (
                          <tr
                            key={`${row.date}-${row.returnEnd}`}
                            className="border-t border-slate-800"
                          >
                            <td className="p-2 text-left">
                              {row.date}
                              <span className="block text-slate-500">
                                → {row.returnEnd}
                              </span>
                            </td>
                            <td>{row.count}</td>
                            <td className="p-2">
                              {fmt(row.ic, 4)}
                              <span className="block text-[9px] text-slate-500">
                                {row.ic == null
                                  ? "样本不足或值恒定"
                                  : row.source}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                  right={chart(icVisible, "date", "ic")}
                />
              </>
            )}
            <p className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">
              按同因子/观察日/收益末/单位/币种/模型分组做Spearman秩相关；并列值取平均秩，至少3证券，恒定样本不计算。不同收益跨度分别成图，不连接成同一轨迹。不是FACTOR
              LAB时序OLS；不设任意“有效”阈值，不生成ICIR或盈利预测。
            </p>
          </>
        )}
        {(active === "rotation" || active === "attribution") && (
          <>
            {returnsEditor}
            {!returns.length ? (
              <p role="status" className="p-6 text-xs text-slate-500">
                尚无带来源的因子收益和期初权重。请在上方输入授权资料后研究，不提供随机轮动时钟或假归因。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2">
                  <label className="text-[10px] text-slate-500">
                    已结束期间
                    <select
                      aria-label="FTW 因子收益日期"
                      value={effectiveDate}
                      onChange={event => setReturnDate(event.target.value)}
                      className={`${input} ml-1`}
                    >
                      {dates.map(date => (
                        <option key={date} value={date}>{returns.find(row => row.date === date)?.periodStart} → {date} · {returns.find(row => row.date === date)?.currency} · {returns.find(row => row.date === date)?.modelVersion}</option>
                      ))}
                    </select>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {active === "rotation"
                      ? "同一期间因子表现"
                      : "贡献=期初权重×期间收益"}{" "}
                    · {dayRows.length}个因子
                  </span>
                </div>
                {active === "rotation" ? (
                  <ResearchSplit
                    label="FTW 因子轮动与来源"
                    left={
                      <div className="overflow-auto">
                        <table className="w-full text-right text-[11px]">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="p-2 text-left">因子</th>
                              <th>期间收益%</th>
                              
                            </tr>
                          </thead>
                          <tbody>
                            {[...dayRows]
                              .sort((a, b) => b.returnPct - a.returnPct)
                              .map(row => (
                                <tr
                                  key={row.factorId}
                                  className="border-t border-slate-800"
                                >
                                  <td className="p-2 text-left text-cyan-200">
                                    {row.factorId}
                                  </td>
                                  <td
                                    style={{
                                      background:
                                        row.returnPct >= 0
                                          ? "rgba(16,185,129,.18)"
                                          : "rgba(244,63,94,.18)",
                                    }}
                                  >
                                    {fmt(row.returnPct)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    }
                    right={
                      <div className="h-[270px] p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dayRows}>
                            <CartesianGrid stroke="#1e293b" />
                            <XAxis
                              dataKey="factorId"
                              tick={{ fill: "#94a3b8", fontSize: 9 }}
                            />
                            <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} />
                            <Tooltip {...tip} />
                            <Bar
                              dataKey="returnPct"
                              name="用户授权因子期间收益 %"
                              fill="#22d3ee"
                              isAnimationActive={false}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    }
                  />
                ) : (
                  <>
                    <div className="border-b border-slate-800 px-2 py-1 font-mono text-[10px] text-slate-400">
                      输入权重 {fmt(weightSum)}% · 已覆盖贡献{" "}
                      {fmt(contributionSum)}个百分点 · 未覆盖权重{" "}
                      {fmt(Math.max(0, 100 - weightSum))}% 不估算收益
                    </div>
                    <ResearchSplit
                      label="FTW 收益归因与贡献"
                      left={
                        <table className="w-full text-right text-[11px]">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="p-2 text-left">因子</th>
                              <th>期初权重%</th>
                              <th>期间收益%</th>
                              <th className="p-2">贡献(百分点)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attribution.map(row => (
                              <tr
                                key={row.factorId}
                                className="border-t border-slate-800"
                              >
                                <td className="p-2 text-left text-cyan-200">
                                  {row.factorId}
                                </td>
                                <td>{fmt(row.weightPct)}</td>
                                <td>{fmt(row.returnPct)}</td>
                                <td className="p-2">
                                  {fmt(row.contributionPct)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      }
                      right={
                        <div className="h-[270px] p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attribution}>
                              <CartesianGrid stroke="#1e293b" />
                              <XAxis
                                dataKey="factorId"
                                tick={{ fill: "#94a3b8", fontSize: 9 }}
                              />
                              <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} />
                              <Tooltip {...tip} />
                              <Bar
                                dataKey="contributionPct"
                                name="已输入长仓贡献 百分点"
                                fill="#a78bfa"
                                isAnimationActive={false}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      }
                    />
                  </>
                )}
              </>
            )}
            <p className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">
              轮动只比较同起止日、币种及模型版本的输入收益，不推断经济周期或提出配置建议。归因是互不重叠长仓子组合的单期加权分解，不是通用风险因子回归或账户实盘收益；未覆盖权重、费用、残差和交互效应不补值，也不把多期贡献简单相加。两项使用同一份输入数据，不复制维护。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
