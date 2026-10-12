import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { useModuleLiveFeed } from "@/hooks/useModuleLiveFeed";
import {
  financialGrowth,
  financialMargin,
  formatFinancialAmount,
  formatFinancialPercent,
  selectCompanyFinancialDelivery,
  type CompanyFinancialRow,
} from "@/lib/openBBCompanyFinancial";

export default function FinancialAnalysis() {
  const [selectedSecurity, setSelectedSecurity] = useState("1");
  const [selectedYear, setSelectedYear] = useState("2023");
  const [isLoading, setIsLoading] = useState(false);
  const financialFeed = useModuleLiveFeed("/financial-analysis", true);
  const financialDelivery = useMemo(() => selectCompanyFinancialDelivery(financialFeed.items), [financialFeed.items]);
  const statementRows = financialDelivery?.rows ?? [];
  const latestRow = statementRows.at(-1) ?? null;
  const previousRow = statementRows.at(-2) ?? null;
  const years = statementRows.map(row => String(row.fiscalYear ?? row.periodEnding)).reverse();

  useEffect(() => {
    if (!financialDelivery) return;
    setSelectedSecurity("openbb");
    if (latestRow?.fiscalYear) setSelectedYear(String(latestRow.fiscalYear));
  }, [financialDelivery?.item.itemKey, latestRow?.fiscalYear]);

  const financialMetrics = [
    { category: "收入", metrics: ["营业收入", "利息收入", "投资收益"] },
    { category: "支出", metrics: ["营业支出", "利息支出", "管理费用"] },
    { category: "资产", metrics: ["流动资产", "固定资产", "总资产"] },
    { category: "负债", metrics: ["流动负债", "长期负债", "总负债"] },
  ];

  const sampleData = statementRows.map(row => ({
    year: row.fiscalYear ?? row.periodEnding,
    revenue: row.revenue === null ? null : row.revenue / 1e9,
    expense: row.raw.costs_and_expenses == null ? null : Number(row.raw.costs_and_expenses) / 1e9,
    profit: row.netIncome === null ? null : row.netIncome / 1e9,
  }));

  const ratioData = [
    { metric: "毛利率", value: financialMargin(latestRow?.grossProfit ?? null, latestRow?.revenue ?? null) },
    { metric: "营业利润率", value: financialMargin(latestRow?.operatingIncome ?? null, latestRow?.revenue ?? null) },
    { metric: "税前利润率", value: financialMargin(latestRow?.pretaxIncome ?? null, latestRow?.revenue ?? null) },
    { metric: "净利率", value: financialMargin(latestRow?.netIncome ?? null, latestRow?.revenue ?? null) },
    { metric: "收入同比", value: financialGrowth(latestRow?.revenue ?? null, previousRow?.revenue ?? null) },
    { metric: "净利润同比", value: financialGrowth(latestRow?.netIncome ?? null, previousRow?.netIncome ?? null) },
  ];

  const selectedStatement = statementRows.find(row => String(row.fiscalYear ?? row.periodEnding) === selectedYear) ?? latestRow;
  const priorStatement = selectedStatement ? statementRows[statementRows.indexOf(selectedStatement) - 1] ?? null : null;
  const metricValue = (row: CompanyFinancialRow | null, metric: string) => {
    if (!row) return null;
    const values: Record<string, number | null> = {
      "营业收入": row.revenue,
      "利息收入": row.raw.total_interest_income == null ? null : Number(row.raw.total_interest_income),
      "投资收益": row.raw.total_other_income == null ? null : Number(row.raw.total_other_income),
      "营业支出": row.operatingIncome === null || row.revenue === null ? null : row.revenue - row.operatingIncome,
      "利息支出": row.raw.total_interest_expense == null ? null : Number(row.raw.total_interest_expense),
      "管理费用": row.sgaExpense,
      "流动资产": null,
      "固定资产": null,
      "总资产": null,
      "流动负债": null,
      "长期负债": null,
      "总负债": null,
    };
    const value = values[metric];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">财务分析</h1>
        <p className="text-gray-500 mt-2">查看详细的财务指标和分析数据</p>
      </div>

      <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
        <span>{financialDelivery ? `${financialDelivery.symbol} · ${financialDelivery.item.dataset?.metadata.provider.toUpperCase()} 原始申报口径 · ${statementRows.length} 期 · ${financialDelivery.item.dataset?.columns.length} 字段` : financialFeed.isLoading ? "正在读取定向财务数据" : "数据源未配置；原页面不再用静态数字填充"}</span>
        <span>{financialDelivery ? `观测截止 ${financialDelivery.item.dataset?.metadata.observedAt ?? latestRow?.periodEnding ?? "—"} · ${financialFeed.connection === "live" ? "实时投递通道" : "轮询补收"} · checksum ${financialDelivery.item.dataset?.metadata.checksum.slice(0, 20)}` : `连接 ${financialFeed.connection}`}</span>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">选择证券</label>
            <Select value={selectedSecurity} onValueChange={setSelectedSecurity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {financialDelivery && <SelectItem value="openbb">{financialDelivery.symbol} · SEC</SelectItem>}
                <SelectItem value="1">649906BB9 Muni</SelectItem>
                <SelectItem value="2">US Treasury 10Y</SelectItem>
                <SelectItem value="3">Corporate Bond AAA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">选择年份</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(years.length ? years : ["2019", "2020", "2021", "2022", "2023"]).map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 主要指标标签页 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="metrics">指标</TabsTrigger>
          <TabsTrigger value="ratios">比率</TabsTrigger>
          <TabsTrigger value="trend">趋势</TabsTrigger>
        </TabsList>

        {/* 概览标签页 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">营业收入</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatFinancialAmount(selectedStatement?.revenue ?? null, selectedStatement?.currency)}</div>
                <p className="text-xs text-gray-500">{formatFinancialPercent(financialGrowth(selectedStatement?.revenue ?? null, priorStatement?.revenue ?? null))} vs {priorStatement?.fiscalYear ?? "前期"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">营业支出</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatFinancialAmount(metricValue(selectedStatement ?? null, "营业支出"), selectedStatement?.currency)}</div>
                <p className="text-xs text-gray-500">收入减营业利润 · 同一申报期</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">净利润</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatFinancialAmount(selectedStatement?.netIncome ?? null, selectedStatement?.currency)}</div>
                <p className="text-xs text-gray-500">{formatFinancialPercent(financialGrowth(selectedStatement?.netIncome ?? null, priorStatement?.netIncome ?? null))} vs {priorStatement?.fiscalYear ?? "前期"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">总资产</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">数据源未配置</div>
                <p className="text-xs text-gray-500">本次投递为利润表；需资产负债表端点</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 指标标签页 */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>财务指标</CardTitle>
              <CardDescription>按类别分类的财务指标</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {financialMetrics.map((category) => (
                  <div key={category.category}>
                    <h3 className="font-semibold mb-3">{category.category}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>指标名称</TableHead>
                          <TableHead className="text-right">2023</TableHead>
                          <TableHead className="text-right">2022</TableHead>
                          <TableHead className="text-right">变化</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {category.metrics.map((metric) => (
                          <TableRow key={metric}>
                            <TableCell>{metric}</TableCell>
                            <TableCell className="text-right">{formatFinancialAmount(metricValue(selectedStatement ?? null, metric), selectedStatement?.currency)}</TableCell>
                            <TableCell className="text-right">{formatFinancialAmount(metricValue(priorStatement, metric), priorStatement?.currency)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatFinancialPercent(financialGrowth(metricValue(selectedStatement ?? null, metric), metricValue(priorStatement, metric)))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 比率标签页 */}
        <TabsContent value="ratios">
          <Card>
            <CardHeader>
              <CardTitle>财务比率</CardTitle>
              <CardDescription>与行业平均水平的对比</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>比率名称</TableHead>
                    <TableHead className="text-right">公司值</TableHead>
                    <TableHead className="text-right">行业平均</TableHead>
                    <TableHead className="text-right">差异</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ratioData.map((ratio) => {
                    return (
                      <TableRow key={ratio.metric}>
                        <TableCell className="font-medium">{ratio.metric}</TableCell>
                        <TableCell className="text-right">{formatFinancialPercent(ratio.value)}</TableCell>
                        <TableCell className="text-right">数据源未配置</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 趋势标签页 */}
        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle>历史趋势</CardTitle>
              <CardDescription>过去 5 年的财务数据趋势</CardDescription>
            </CardHeader>
            <CardContent>
              {sampleData.length ? <ResponsiveContainer width="100%" height={400}>
                <LineChart data={sampleData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="收入" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" name="支出" />
                  <Line type="monotone" dataKey="profit" stroke="#10b981" name="利润" />
                </LineChart>
              </ResponsiveContainer> : <div role="status" className="flex h-[400px] items-center justify-center text-sm text-slate-500">没有已校验的历史财务序列；不会绘制静态趋势。</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
