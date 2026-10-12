import React, { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Bot,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import {
  Badge,
  Card,
  LoadingState,
  Metric,
  PanelShell,
  chartTooltipStyle,
} from "./sovereign/PanelKit";

const SHOCKS = [
  { id: "RATE_UP_100BP", label: "曲线平行上移" },
  { id: "EQUITY_CRASH", label: "风险资产回撤" },
  { id: "CREDIT_WIDEN", label: "信用利差扩张" },
  { id: "INFLATION_SPIKE", label: "通胀预期上行" },
] as const;

const SECURITIES = [
  {
    code: "US10Y",
    symbol: "^TNX",
    name: "美国 10 年期国债基准",
    issuer: "United States Treasury",
    currency: "USD",
    identifier: "US91282CJZ23",
    maturity: "2034-11-15",
    convention: "ACT/ACT · 半年付息",
  },
  {
    code: "TLT",
    symbol: "TLT",
    name: "20 年以上美国国债 ETF",
    issuer: "iShares / BlackRock",
    currency: "USD",
    identifier: "US4642874329",
    maturity: "组合加权期限",
    convention: "基金净值 · 月度分配",
  },
  {
    code: "IEF",
    symbol: "IEF",
    name: "7–10 年美国国债 ETF",
    issuer: "iShares / BlackRock",
    currency: "USD",
    identifier: "US4642874402",
    maturity: "组合加权期限",
    convention: "基金净值 · 月度分配",
  },
  {
    code: "SHY",
    symbol: "SHY",
    name: "1–3 年美国国债 ETF",
    issuer: "iShares / BlackRock",
    currency: "USD",
    identifier: "US4642874576",
    maturity: "组合加权期限",
    convention: "基金净值 · 月度分配",
  },
] as const;

function EmptyEvidence({
  text,
  onRetry,
}: {
  text: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-950/40 px-6 text-center">
      <ShieldAlert className="mb-2 h-5 w-5 text-amber-400" />
      <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400">
        {text}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-600"
      >
        <RefreshCw className="h-3 w-3" />
        重新核验
      </button>
    </div>
  );
}

type InfoTab = "assistant" | "twin" | "emotion" | "counterfactual" | "swarm";

export default function SecInfoPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<InfoTab>("assistant");
  const [securityCode, setSecurityCode] = useState("US10Y");
  const [shock, setShock] =
    useState<(typeof SHOCKS)[number]["id"]>("RATE_UP_100BP");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "assistant" | "user"; text: string }>
  >([
    {
      role: "assistant",
      text: "请选择研究对象并提出问题。我会区分市场事实、可复算结果和情景假设；缺少数据时直接列出缺口。",
    },
  ]);
  const messageRef = useRef<HTMLDivElement>(null);
  const security =
    SECURITIES.find(item => item.code === securityCode) ?? SECURITIES[0];

  const tickerDetail = trpc.sovereignBonds.getTickerDetail.useQuery(
    { symbol: security.symbol, range: "1mo" },
    { refetchOnWindowFocus: false, refetchInterval: 60_000 }
  );
  const digitalTwin = trpc.secinfo.getDigitalTwin.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 300_000,
  });
  const emotion = trpc.secinfo.getEmotionResonance.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 300_000,
  });
  const counterfactual = trpc.secinfo.counterfactual.useQuery(
    { shock },
    { refetchOnWindowFocus: false }
  );
  const swarm = trpc.secinfo.getStrategySwarm.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 300_000,
  });
  const assistant = trpc.secinfo.askAssistant.useMutation();

  useEffect(() => {
    messageRef.current?.scrollTo({
      top: messageRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, assistant.isPending]);

  const curveComparison = useMemo(
    () =>
      !counterfactual.data?.baseline || !counterfactual.data?.shocked
        ? []
        : [
            {
              tenor: "2Y",
              baseline: counterfactual.data.baseline.twoYear,
              shocked: counterfactual.data.shocked.twoYear,
            },
            {
              tenor: "10Y",
              baseline: counterfactual.data.baseline.tenYear,
              shocked: counterfactual.data.shocked.tenYear,
            },
          ],
    [counterfactual.data]
  );

  const refreshActiveTab = () => {
    if (activeTab === "assistant") tickerDetail.refetch();
    if (activeTab === "twin") digitalTwin.refetch();
    if (activeTab === "emotion") emotion.refetch();
    if (activeTab === "counterfactual") counterfactual.refetch();
    if (activeTab === "swarm") swarm.refetch();
  };

  const submitQuestion = () => {
    const value = question.trim();
    if (!value || assistant.isPending) return;

    setMessages(current => [...current, { role: "user", text: value }]);
    setQuestion("");
    assistant.mutate(
      {
        question: `${value}\n研究对象：${security.name}；识别码：${security.identifier}；发行人：${security.issuer}；币种：${security.currency}；期限：${security.maturity}；当前价格：${tickerDetail.data?.data?.price ?? "未取得"}；行情观测：${tickerDetail.data?.timestamp ?? "未取得"}。`,
      },
      {
        onSuccess: result =>
          setMessages(current => [
            ...current,
            { role: "assistant", text: result.answer },
          ]),
        onError: () =>
          setMessages(current => [
            ...current,
            {
              role: "assistant",
              text: "当前分析服务不可用，请稍后重新提交。",
            },
          ]),
      }
    );
  };

  return (
    <PanelShell
      ticker="INFO"
      title="证券、设定与功能说明"
      subtitle="字段口径、研究对象、数据授权与可复算分析"
      onClose={onClose}
      onRefresh={refreshActiveTab}
      tabs={[
        { id: "assistant", label: "对象问答" },
        { id: "twin", label: "授权画像" },
        { id: "emotion", label: "风险温度" },
        { id: "counterfactual", label: "冲击重估" },
        { id: "swarm", label: "策略校验" },
      ]}
      activeTab={activeTab}
      onTabChange={tab => setActiveTab(tab as InfoTab)}
    >
      {activeTab === "assistant" && (
        <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <Card title="研究对象设定">
              <select
                value={securityCode}
                onChange={event => setSecurityCode(event.target.value)}
                className="mb-3 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[11px] text-slate-200"
              >
                {SECURITIES.map(item => (
                  <option key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
              <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-2 text-[10px]">
                <dt className="text-slate-500">发行主体</dt>
                <dd className="text-slate-200">{security.issuer}</dd>
                <dt className="text-slate-500">识别码</dt>
                <dd className="font-mono text-cyan-200">
                  {security.identifier}
                </dd>
                <dt className="text-slate-500">计价币种</dt>
                <dd>{security.currency}</dd>
                <dt className="text-slate-500">到期口径</dt>
                <dd>{security.maturity}</dd>
                <dt className="text-slate-500">现金流惯例</dt>
                <dd>{security.convention}</dd>
              </dl>
            </Card>

            <Card title="市场历史">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <Metric
                  label="最新价格"
                  value={
                    tickerDetail.data?.data?.price != null
                      ? tickerDetail.data.data.price.toFixed(3)
                      : "—"
                  }
                  tone="info"
                />
                <Metric
                  label="日内变幅"
                  value={
                    tickerDetail.data?.data?.changePct != null
                      ? `${tickerDetail.data.data.changePct.toFixed(2)}%`
                      : "—"
                  }
                  tone={
                    (tickerDetail.data?.data?.changePct ?? 0) >= 0
                      ? "pos"
                      : "neg"
                  }
                />
              </div>
              <div className="h-36">
                {tickerDetail.data?.data?.history?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tickerDetail.data.data.history.slice(-60)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        width={42}
                      />
                      <Tooltip {...chartTooltipStyle()} />
                      <Line
                        dataKey="value"
                        name="价格"
                        stroke="#22d3ee"
                        dot={false}
                        strokeWidth={1.5}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
                    {tickerDetail.isLoading
                      ? "正在读取行情历史…"
                      : "当前数据源未返回可核验历史"}
                  </div>
                )}
              </div>
              <p className="mt-2 text-[9px] text-slate-500">
                {tickerDetail.data?.source ?? "行情来源等待返回"} ·{" "}
                {tickerDetail.data?.timestamp
                  ? new Date(tickerDetail.data.timestamp).toLocaleString(
                      "zh-CN"
                    )
                  : "尚无观测时间"}
              </p>
            </Card>
          </div>

          <Card title="研究问答">
            <div className="flex h-[470px] flex-col">
              <div
                ref={messageRef}
                className="flex-1 space-y-3 overflow-y-auto pr-1"
              >
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded border px-3 py-2 text-[11px] leading-relaxed ${
                        message.role === "user"
                          ? "border-cyan-800 bg-cyan-950/30 text-cyan-100"
                          : "border-slate-800 bg-slate-950/70 text-slate-300"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <Bot className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
                      )}
                      {message.text}
                    </div>
                  </div>
                ))}
                {assistant.isPending && (
                  <div className="text-[10px] text-slate-400">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    正在核对上下文
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
                <input
                  value={question}
                  onChange={event => setQuestion(event.target.value)}
                  onKeyDown={event => event.key === "Enter" && submitQuestion()}
                  placeholder="输入关于当前证券、条款或利率风险的问题"
                  className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-cyan-600"
                />
                <button
                  type="button"
                  onClick={submitQuestion}
                  disabled={!question.trim() || assistant.isPending}
                  className="inline-flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950/30 px-3 text-[11px] text-cyan-200 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  提交
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "twin" &&
        (digitalTwin.isLoading ? (
          <LoadingState />
        ) : digitalTwin.isError || !digitalTwin.data ? (
          <EmptyEvidence
            text="授权状态读取失败；没有取得数据时不会生成替代画像。"
            onRetry={() => digitalTwin.refetch()}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
            <Card title="画像输入覆盖矩阵">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-500">
                      <th className="py-2">必要字段</th>
                      <th>接入状态</th>
                      <th>计算用途</th>
                    </tr>
                  </thead>
                  <tbody>
                    {digitalTwin.data.requiredSignals.map(item => (
                      <tr
                        key={item.field}
                        className="border-b border-slate-800/60"
                      >
                        <td className="py-3 text-slate-200">{item.field}</td>
                        <td>
                          <Badge tone="warn">{item.status}</Badge>
                        </td>
                        <td className="text-slate-400">{item.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="space-y-3">
              <Card title="市场基线">
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label="美国 2Y"
                    value={digitalTwin.data.marketContext.twoYear ?? "—"}
                    unit="%"
                    tone="info"
                  />
                  <Metric
                    label="美国 10Y"
                    value={digitalTwin.data.marketContext.tenYear ?? "—"}
                    unit="%"
                    tone="neutral"
                  />
                </div>
                <div className="mt-3 text-[10px] leading-relaxed text-slate-500">
                  2Y {digitalTwin.data.marketContext.twoYearDate ?? "无日期"} ·
                  10Y {digitalTwin.data.marketContext.tenYearDate ?? "无日期"} 
                </div>
                <div className="mt-3 h-36 border-t border-slate-800 pt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={digitalTwin.data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        width={38}
                      />
                      <Tooltip {...chartTooltipStyle()} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      <Line
                        dataKey="twoYear"
                        name="美国 2Y"
                        stroke="#22d3ee"
                        dot={false}
                        connectNulls
                      />
                      <Line
                        dataKey="tenYear"
                        name="美国 10Y"
                        stroke="#a78bfa"
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[9px] text-slate-500">
                  接收时间{" "}
                  {new Date(digitalTwin.data.timestamp).toLocaleString("zh-CN")}
                </p>
              </Card>
              <EmptyEvidence
                text={digitalTwin.data.limitation}
                onRetry={() => digitalTwin.refetch()}
              />
            </div>
          </div>
        ))}

      {activeTab === "emotion" &&
        (emotion.isLoading ? (
          <LoadingState />
        ) : emotion.isError || !emotion.data ? (
          <EmptyEvidence
            text="市场压力序列读取失败；不会使用随机数填充风险温度。"
            onRetry={() => emotion.refetch()}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Metric
                label="综合风险温度"
                value={emotion.data.riskTemperature ?? "—"}
                unit="/100"
                tone={
                  (emotion.data.riskTemperature ?? 0) >= 75 ? "neg" : "warn"
                }
              />
              <Metric
                label="状态区间"
                value={emotion.data.regime}
                tone="info"
              />
              {emotion.data.components.slice(0, 2).map(item => (
                <Metric
                  key={item.id}
                  label={item.label}
                  value={item.percentile ?? "—"}
                  unit="分位"
                  tone="neutral"
                />
              ))}
            </div>
            <div className="grid gap-3 xl:grid-cols-[1fr_1.5fr]">
              <Card title="压力因子分解">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={emotion.data.components}
                      layout="vertical"
                      margin={{ left: 36 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fill: "#64748b", fontSize: 9 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{ fill: "#94a3b8", fontSize: 9 }}
                      />
                      <Tooltip {...chartTooltipStyle()} />
                      <Bar dataKey="percentile" name="历史分位">
                        <Cell fill="#fb7185" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#a78bfa" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="公开市场压力原始序列">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={emotion.data.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        minTickGap={28}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        width={38}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        width={38}
                      />
                      <Tooltip {...chartTooltipStyle()} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        yAxisId="left"
                        dataKey="highYieldSpread"
                        name="高收益债利差"
                        stroke="#fb7185"
                        dot={false}
                        connectNulls
                      />
                      <Line
                        yAxisId="right"
                        dataKey="volatility"
                        name="VIX"
                        stroke="#f59e0b"
                        dot={false}
                        connectNulls
                      />
                      <Line
                        yAxisId="left"
                        dataKey="curveSlope"
                        name="2s10s"
                        stroke="#22d3ee"
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <Card>
              <p className="text-[10px] leading-relaxed text-slate-400">
                {emotion.data.methodology}
              </p>
              <p className="mt-2 text-[9px] text-slate-500">
                接收时间{" "}
                {new Date(emotion.data.timestamp).toLocaleString("zh-CN")}
              </p>
            </Card>
          </div>
        ))}

      {activeTab === "counterfactual" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SHOCKS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setShock(item.id)}
                className={`rounded border px-3 py-1.5 text-[10px] ${
                  shock === item.id
                    ? "border-violet-500 bg-violet-950/40 text-violet-200"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {counterfactual.isLoading ? (
            <LoadingState />
          ) : counterfactual.isError || !counterfactual.data ? (
            <EmptyEvidence
              text="冲击重估读取失败。"
              onRetry={() => counterfactual.refetch()}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Metric
                  label="2Y 冲击"
                  value={counterfactual.data.assumptions.twoYearBps}
                  unit="bp"
                  tone="warn"
                />
                <Metric
                  label="10Y 冲击"
                  value={counterfactual.data.assumptions.tenYearBps}
                  unit="bp"
                  tone="warn"
                />
                <Metric
                  label="曲线斜率变化"
                  value={
                    counterfactual.data.baseline.slopeBps != null &&
                    counterfactual.data.shocked.slopeBps != null
                      ? Number(
                          (
                            counterfactual.data.shocked.slopeBps -
                            counterfactual.data.baseline.slopeBps
                          ).toFixed(1)
                        )
                      : "—"
                  }
                  unit="bp"
                  tone="info"
                />
                <Metric
                  label="估算价格影响"
                  value={
                    counterfactual.data.shocked.estimatedPriceImpactPct ?? "—"
                  }
                  unit="%"
                  tone="neg"
                />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <Card title="基线与冲击曲线">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={curveComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="tenor"
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tick={{ fill: "#64748b", fontSize: 9 }}
                        />
                        <Tooltip {...chartTooltipStyle()} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line
                          dataKey="baseline"
                          name="当前基线"
                          stroke="#22d3ee"
                          strokeWidth={2}
                        />
                        <Line
                          dataKey="shocked"
                          name="冲击结果"
                          stroke="#a78bfa"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="价格影响归因">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={counterfactual.data.attribution.filter(
                          item => item.impactPct != null
                        )}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="factor"
                          tick={{ fill: "#94a3b8", fontSize: 9 }}
                        />
                        <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                        <ReferenceLine y={0} stroke="#64748b" />
                        <Tooltip {...chartTooltipStyle()} />
                        <Bar
                          dataKey="impactPct"
                          name="价格影响 %"
                          fill="#8b5cf6"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
              <Card>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  {counterfactual.data.methodology}
                </p>
                <p className="mt-2 text-[9px] text-slate-500">
                  接收时间{" "}
                  {new Date(counterfactual.data.timestamp).toLocaleString(
                    "zh-CN"
                  )}
                </p>
              </Card>
            </>
          )}
        </div>
      )}

      {activeTab === "swarm" &&
        (swarm.isLoading ? (
          <LoadingState />
        ) : swarm.isError || !swarm.data ? (
          <EmptyEvidence
            text="策略校验状态读取失败。"
            onRetry={() => swarm.refetch()}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
            <Card title="可审计策略准入门槛">
              <div className="space-y-2">
                {swarm.data.readiness.map(item => (
                  <div
                    key={item.gate}
                    className="grid grid-cols-[1fr_82px_1.2fr] items-center gap-3 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-[10px]"
                  >
                    <span className="text-slate-200">{item.gate}</span>
                    <Badge tone={item.state === "部分可用" ? "info" : "warn"}>
                      {item.state}
                    </Badge>
                    <span className="text-slate-500">{item.evidence}</span>
                  </div>
                ))}
              </div>
            </Card>
            <div className="space-y-3">
              <Card title="市场证据">
                <div className="flex items-center gap-3">
                  <Activity className="h-6 w-6 text-cyan-400" />
                  <div>
                    <div className="font-mono text-2xl text-cyan-200">
                      {swarm.data.marketContext.tenYear ?? "—"}%
                    </div>
                    <div className="text-[10px] text-slate-500">
                      DGS10 · {swarm.data.marketContext.date ?? "尚无观测日"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-32 border-t border-slate-800 pt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={swarm.data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        width={38}
                      />
                      <Tooltip {...chartTooltipStyle()} />
                      <Line
                        dataKey="value"
                        name="DGS10"
                        stroke="#22d3ee"
                        dot={false}
                        strokeWidth={1.5}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[9px] text-slate-500">
                  接收时间{" "}
                  {new Date(swarm.data.timestamp).toLocaleString("zh-CN")}
                </p>
              </Card>
              <div className="rounded border border-amber-900/60 bg-amber-950/15 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-300">
                  <CheckCircle2 className="h-4 w-4" />
                  审计约束已生效
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                  {swarm.data.limitation}
                </p>
              </div>
            </div>
          </div>
        ))}
    </PanelShell>
  );
}
