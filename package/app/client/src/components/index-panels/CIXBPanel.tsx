import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { Search, ChevronDown, TrendingUp, DollarSign, Percent, BarChart, PieChart as PieChartIcon, GitGraph, ShieldHalf, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface Stock {
  ticker: string;
  name: string;
  price: number;
  marketCap: number;
  industry: string;
  liquidityScore: number;
  shares: number;
  weight: number;
  dailyChange: number;
  contribution: number;
  beta: number;
  volatility: number;
}

interface HedgingTool {
  ticker: string;
  name: string;
  beta: number;
}

const CIXBPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedHedgingTool, setSelectedHedgingTool] = useState<string>('SPY');
  const [targetBeta, setTargetBeta] = useState<number>(1);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<{before: number; after: number; savings: number} | null>(null);

  // Mock Data Generation
  const allStocks = useMemo<Stock[]>(() => [
    { ticker: 'AAPL', name: 'Apple Inc.', price: 170.24, marketCap: 2800, industry: 'Technology', liquidityScore: 95, shares: 100, weight: 0.15, dailyChange: 0.015, contribution: 0.02, beta: 1.2, volatility: 0.25 },
    { ticker: 'MSFT', name: 'Microsoft Corp.', price: 420.10, marketCap: 3100, industry: 'Technology', liquidityScore: 98, shares: 50, weight: 0.18, dailyChange: -0.005, contribution: -0.01, beta: 1.1, volatility: 0.22 },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 175.50, marketCap: 2200, industry: 'Communication Services', liquidityScore: 92, shares: 70, weight: 0.12, dailyChange: 0.021, contribution: 0.015, beta: 1.0, volatility: 0.20 },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 185.30, marketCap: 1900, industry: 'Consumer Discretionary', liquidityScore: 90, shares: 60, weight: 0.10, dailyChange: 0.008, contribution: 0.005, beta: 1.3, volatility: 0.28 },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 1200.00, marketCap: 3000, industry: 'Technology', liquidityScore: 97, shares: 20, weight: 0.16, dailyChange: 0.030, contribution: 0.03, beta: 1.5, volatility: 0.35 },
    { ticker: 'TSLA', name: 'Tesla Inc.', price: 180.00, marketCap: 570, industry: 'Consumer Discretionary', liquidityScore: 85, shares: 40, weight: 0.05, dailyChange: -0.010, contribution: -0.005, beta: 1.8, volatility: 0.40 },
    { ticker: 'JPM', name: 'JPMorgan Chase & Co.', price: 200.00, marketCap: 580, industry: 'Financials', liquidityScore: 88, shares: 30, weight: 0.04, dailyChange: 0.002, contribution: 0.001, beta: 0.9, volatility: 0.18 },
    { ticker: 'XOM', name: 'Exxon Mobil Corp.', price: 115.00, marketCap: 450, industry: 'Energy', liquidityScore: 80, shares: 25, weight: 0.03, dailyChange: 0.007, contribution: 0.002, beta: 0.8, volatility: 0.15 },
    { ticker: 'UNH', name: 'UnitedHealth Group Inc.', price: 500.00, marketCap: 470, industry: 'Healthcare', liquidityScore: 87, shares: 15, weight: 0.03, dailyChange: -0.003, contribution: -0.001, beta: 0.7, volatility: 0.16 },
    { ticker: 'V', name: 'Visa Inc.', price: 270.00, marketCap: 550, industry: 'Financials', liquidityScore: 93, shares: 20, weight: 0.04, dailyChange: 0.010, contribution: 0.004, beta: 1.0, volatility: 0.19 },
    { ticker: 'PG', name: 'Procter & Gamble Co.', price: 160.00, marketCap: 380, industry: 'Consumer Staples', liquidityScore: 89, shares: 35, weight: 0.03, dailyChange: 0.001, contribution: 0.000, beta: 0.6, volatility: 0.14 },
  ], []);

  const [portfolioStocks, setPortfolioStocks] = useState<Stock[]>(allStocks.slice(0, 5)); // Initial portfolio

  const hedgingTools = useMemo<HedgingTool[]>(() => [
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', beta: 1.0 },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust', beta: 1.2 },
    { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF Trust', beta: 0.9 },
  ], []);

  // Portfolio Calculations
  const portfolioSummary = useMemo(() => {
    const totalMarketCap = portfolioStocks.reduce((sum, stock) => sum + stock.price * stock.shares, 0);
    const dailyPnL = portfolioStocks.reduce((sum, stock) => sum + stock.price * stock.shares * stock.dailyChange, 0);
    const weightedPE = portfolioStocks.reduce((sum, stock) => sum + (stock.marketCap / (stock.price * stock.shares)) * stock.weight, 0);
    const weightedMarketCap = portfolioStocks.reduce((sum, stock) => sum + stock.marketCap * stock.weight, 0);
    const portfolioBeta = portfolioStocks.reduce((sum, stock) => sum + stock.beta * stock.weight, 0);
    const portfolioVolatility = Math.sqrt(portfolioStocks.reduce((sum, stock) => sum + Math.pow(stock.volatility, 2) * Math.pow(stock.weight, 2), 0)); // Simplified

    return {
      totalMarketCap: parseFloat(totalMarketCap.toFixed(2)),
      dailyPnL: parseFloat(dailyPnL.toFixed(2)),
      weightedPE: parseFloat(weightedPE.toFixed(2)),
      weightedMarketCap: parseFloat(weightedMarketCap.toFixed(2)),
      portfolioBeta: parseFloat(portfolioBeta.toFixed(2)),
      portfolioVolatility: parseFloat(portfolioVolatility.toFixed(4)),
    };
  }, [portfolioStocks]);

  // Industry Distribution
  const industryDistribution = useMemo(() => {
    const industryMap = new Map<string, number>();
    portfolioStocks.forEach(stock => {
      industryMap.set(stock.industry, (industryMap.get(stock.industry) || 0) + stock.weight);
    });
    return Array.from(industryMap.entries()).map(([name, value]) => ({ name, value: parseFloat((value * 100).toFixed(2)) }));
  }, [portfolioStocks]);

  const PIE_COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#AF19FF', '#FF19AF'];

  // Historical Backtesting Data (Mock)
  const historicalData = useMemo(() => {
    const data = [];
    const startDate = new Date('2023-01-01');
    let portfolioValue = 1000;
    let benchmarkValue = 1000;
    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      portfolioValue *= (1 + (Math.random() - 0.5) * 0.02 + 0.001);
      benchmarkValue *= (1 + (Math.random() - 0.5) * 0.015 + 0.0005);
      data.push({
        date: date.toISOString().slice(0, 10),
        portfolio: parseFloat(portfolioValue.toFixed(2)),
        benchmark: parseFloat(benchmarkValue.toFixed(2)),
        excessReturn: parseFloat((portfolioValue - benchmarkValue).toFixed(2)),
      });
    }
    return data;
  }, []);

  // Risk Contribution Analysis (Mock)
  const riskContributionData = useMemo(() => {
    const totalVolatility = portfolioSummary.portfolioVolatility;
    return portfolioStocks.map(stock => ({
      name: stock.ticker,
      contribution: parseFloat(((stock.volatility * stock.weight) / totalVolatility * 100).toFixed(2)),
    })).sort((a, b) => b.contribution - a.contribution);
  }, [portfolioStocks, portfolioSummary.portfolioVolatility]);

  // Hedging Ratio Calculation
  const hedgingCalculation = useMemo(() => {
    const portfolioBeta = portfolioSummary.portfolioBeta;
    const selectedTool = hedgingTools.find(tool => tool.ticker === selectedHedgingTool);
    if (!selectedTool) return { hedgeRatio: 0, deltaNeutralPosition: 0 };

    const hedgeRatio = -portfolioBeta / selectedTool.beta;
    const deltaNeutralPosition = portfolioSummary.totalMarketCap * hedgeRatio;

    return {
      hedgeRatio: parseFloat(hedgeRatio.toFixed(4)),
      deltaNeutralPosition: parseFloat(deltaNeutralPosition.toFixed(2)),
    };
  }, [portfolioSummary.portfolioBeta, portfolioSummary.totalMarketCap, selectedHedgingTool, hedgingTools]);

  const handleAddStock = useCallback((ticker: string) => {
    const stockToAdd = allStocks.find(s => s.ticker === ticker);
    if (stockToAdd && !portfolioStocks.some(s => s.ticker === ticker)) {
      setPortfolioStocks(prev => {
        const newPortfolio = [...prev, { ...stockToAdd, weight: 0 }]; // Add with 0 weight initially
        // Rebalance weights to sum to 1, or handle manually later
        const totalWeight = newPortfolio.reduce((sum, s) => sum + s.weight, 0);
        return newPortfolio.map(s => ({ ...s, weight: parseFloat((s.weight / totalWeight).toFixed(4)) }));
      });
    }
  }, [allStocks, portfolioStocks]);

  const handleRemoveStock = useCallback((ticker: string) => {
    setPortfolioStocks(prev => {
      const newPortfolio = prev.filter(s => s.ticker !== ticker);
      if (newPortfolio.length === 0) return [];
      const totalWeight = newPortfolio.reduce((sum, s) => sum + s.weight, 0);
      return newPortfolio.map(s => ({ ...s, weight: parseFloat((s.weight / totalWeight).toFixed(4)) }));
    });
  }, [portfolioStocks]);

  const handleWeightChange = useCallback((ticker: string, newWeight: number) => {
    setPortfolioStocks(prev => {
      const updatedPortfolio = prev.map(stock =>
        stock.ticker === ticker ? { ...stock, weight: newWeight } : stock
      );
      const currentTotalWeight = updatedPortfolio.reduce((sum, s) => sum + s.weight, 0);
      // Normalize weights to sum to 1
      return updatedPortfolio.map(stock => ({
        ...stock,
        weight: parseFloat((stock.weight / currentTotalWeight).toFixed(4)),
        shares: parseFloat(((portfolioSummary.totalMarketCap * (stock.weight / currentTotalWeight)) / stock.price).toFixed(0)), // Re-calculate shares based on new weight
      }));
    });
  }, [portfolioSummary.totalMarketCap]);

  // Minimum Variance Weight Optimization (inverse-volatility weighting)
  const handleOptimizeWeights = useCallback(() => {
    if (portfolioStocks.length === 0) return;
    
    setIsOptimizing(true);
    // Simulate optimization delay
    setTimeout(() => {
      const beforeVol = portfolioSummary.portfolioVolatility;
      
      // Calculate inverse-volatility weights
      const invVols = portfolioStocks.map(s => 1 / s.volatility);
      const sumInvVols = invVols.reduce((a, b) => a + b, 0);
      const newWeights = invVols.map(v => v / sumInvVols);
      
      // Apply new weights
      const optimizedPortfolio = portfolioStocks.map((stock, idx) => ({
        ...stock,
        weight: parseFloat(newWeights[idx].toFixed(4)),
        shares: parseFloat(((portfolioSummary.totalMarketCap * newWeights[idx]) / stock.price).toFixed(0)),
      }));
      
      // Calculate new portfolio volatility
      const newPortfolioVol = Math.sqrt(
        optimizedPortfolio.reduce((sum, stock) => sum + Math.pow(stock.volatility, 2) * Math.pow(stock.weight, 2), 0)
      );
      
      // Store result and apply
      setOptimizationResult({
        before: parseFloat((beforeVol * 100).toFixed(2)),
        after: parseFloat((newPortfolioVol * 100).toFixed(2)),
        savings: parseFloat(((beforeVol - newPortfolioVol) / beforeVol * 100).toFixed(2)),
      });
      
      setPortfolioStocks(optimizedPortfolio);
      setIsOptimizing(false);
    }, 600);
  }, [portfolioStocks, portfolioSummary.totalMarketCap, portfolioSummary.portfolioVolatility]);

  const filteredAvailableStocks = useMemo(() => {
    return allStocks.filter(stock =>
      !portfolioStocks.some(ps => ps.ticker === stock.ticker) &&
      stock.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allStocks, portfolioStocks, searchTerm]);

  return (
    <div className="p-4 bg-gray-950 text-gray-100 min-h-screen font-mono">
      <Card className="bg-gray-900 border-gray-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-2xl font-bold text-teal-400">股票篹子构建与管理工具</CardTitle>
          <Badge variant="outline" className="bg-teal-600 text-white border-teal-500">CIXBPanel</Badge>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="portfolio" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800">
              <TabsTrigger value="portfolio" className="text-teal-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white">篹子成分</TabsTrigger>
              <TabsTrigger value="valuation" className="text-teal-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white">实时估值</TabsTrigger>
              <TabsTrigger value="hedging" className="text-teal-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white">对冲计算器</TabsTrigger>
              <TabsTrigger value="analysis" className="text-teal-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white">分析图表</TabsTrigger>
            </TabsList>

            <TabsContent value="portfolio" className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-teal-300">篹子成分搜索区</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2 mb-4">
                    <Input
                      type="text"
                      placeholder="输入 Ticker 添加成分股..."
                      className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                      <Search className="h-4 w-4 mr-2" /> 搜索
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
                    {filteredAvailableStocks.map(stock => (
                      <div key={stock.ticker} className="flex items-center justify-between bg-gray-700 p-3 rounded-md border border-gray-600">
                        <div>
                          <p className="font-bold text-teal-300">{stock.ticker} - {stock.name}</p>
                          <p className="text-sm text-gray-300">价格: ${stock.price.toFixed(2)} | 市值: ${stock.marketCap}B | 行业: {stock.industry} | 流动性: {stock.liquidityScore}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700 text-white border-teal-500"
                          onClick={() => handleAddStock(stock.ticker)}
                        >
                          添加
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Optimization result notification */}
                  {optimizationResult && (
                    <div className="bg-teal-900/40 border border-teal-700 rounded-lg p-3 mb-4 flex items-start space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm">
                        <p className="font-bold text-teal-300">✓ 权重优化完成</p>
                        <p className="text-teal-200 text-xs mt-1">
                          波动率从 <span className="font-mono font-bold">{optimizationResult.before}%</span> 降至 <span className="font-mono font-bold text-green-400">{optimizationResult.after}%</span> 
                          <span className="text-green-400 ml-1">↓ {optimizationResult.savings}%</span>
                        </p>
                      </div>
                      <button onClick={() => setOptimizationResult(null)} className="text-teal-500 hover:text-teal-300 text-lg leading-none">×</button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-teal-300">成分权重分配表格</h3>
                    <button
                      onClick={handleOptimizeWeights}
                      disabled={isOptimizing || portfolioStocks.length === 0}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-bold transition-all ${
                        isOptimizing
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95'
                      }`}
                      title="使用最小方差算法（反向波动率加权）优化投资组合权重"
                    >
                      <Zap className="h-4 w-4" />
                      <span>{isOptimizing ? '优化中...' : '一键优化权重'}</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto">
                      <thead>
                        <tr className="bg-gray-700 text-teal-300">
                          <th className="p-2">Ticker</th>
                          <th className="p-2">名称</th>
                          <th className="p-2">数量</th>
                          <th className="p-2">权重 (%)</th>
                          <th className="p-2">波动率</th>
                          <th className="p-2">市值 ($)</th>
                          <th className="p-2">日涨跌 (%)</th>
                          <th className="p-2">贡献度 (%)</th>
                          <th className="p-2">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioStocks.map(stock => (
                          <tr key={stock.ticker} className="border-b border-gray-700 hover:bg-gray-700">
                            <td className="p-2 font-bold text-teal-300">{stock.ticker}</td>
                            <td className="p-2 text-gray-200">{stock.name}</td>
                            <td className="p-2 text-gray-200">{stock.shares}</td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={parseFloat((stock.weight * 100).toFixed(2))}
                                onChange={(e) => handleWeightChange(stock.ticker, parseFloat(e.target.value) / 100)}
                                className="w-24 bg-gray-700 border-gray-600 text-white"
                                step="0.01"
                              />
                            </td>
                            <td className="p-2 font-mono text-gray-300 text-sm">{(stock.volatility * 100).toFixed(1)}%</td>
                            <td className="p-2 text-gray-200">{(stock.price * stock.shares).toFixed(2)}</td>
                            <td className={`p-2 ${stock.dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(stock.dailyChange * 100).toFixed(2)}%
                            </td>
                            <td className={`p-2 ${stock.contribution >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(stock.contribution * 100).toFixed(2)}%
                            </td>
                            <td className="p-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleRemoveStock(stock.ticker)}
                              >
                                移除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="valuation" className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-teal-300">篹子实时估值</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                    <p className="text-gray-300">总市值</p>
                    <p className="text-2xl font-bold text-teal-400"><DollarSign className="inline-block h-5 w-5 mr-1" />{portfolioSummary.totalMarketCap.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                    <p className="text-gray-300">日内P&L</p>
                    <p className={`text-2xl font-bold ${portfolioSummary.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}><TrendingUp className="inline-block h-5 w-5 mr-1" />{portfolioSummary.dailyPnL.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                    <p className="text-gray-300">加权平均PE</p>
                    <p className="text-2xl font-bold text-teal-400">{portfolioSummary.weightedPE.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                    <p className="text-gray-300">加权平均市值</p>
                    <p className="text-2xl font-bold text-teal-400"><DollarSign className="inline-block h-5 w-5 mr-1" />{portfolioSummary.weightedMarketCap.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                    <p className="text-gray-300">Beta</p>
                    <p className="text-2xl font-bold text-teal-400">{portfolioSummary.portfolioBeta.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                    <p className="text-gray-300">波动率</p>
                    <p className="text-2xl font-bold text-teal-400">
                      <Percent className="inline-block h-5 w-5 mr-1" />{(portfolioSummary.portfolioVolatility * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">可通过一键优化降低</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="hedging" className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-teal-300">对冲比率计算器</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="hedging-tool" className="block text-gray-300 text-sm font-bold mb-2">选择对冲工具</label>
                      <Select value={selectedHedgingTool} onValueChange={setSelectedHedgingTool}>
                        <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="选择对冲工具" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 text-white border-gray-700">
                          {hedgingTools.map(tool => (
                            <SelectItem key={tool.ticker} value={tool.ticker}>{tool.name} (Beta: {tool.beta})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="target-beta" className="block text-gray-300 text-sm font-bold mb-2">目标 Beta</label>
                      <Input
                        id="target-beta"
                        type="number"
                        value={targetBeta}
                        onChange={(e) => setTargetBeta(parseFloat(e.target.value))}
                        className="bg-gray-700 border-gray-600 text-white"
                        step="0.1"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
                    <p className="text-gray-300">当前篹子 Beta: <span className="font-bold text-teal-400">{portfolioSummary.portfolioBeta.toFixed(2)}</span></p>
                    <p className="text-gray-300">对冲工具 Beta: <span className="font-bold text-teal-400">{hedgingTools.find(tool => tool.ticker === selectedHedgingTool)?.beta.toFixed(2) || 'N/A'}</span></p>
                    <p className="text-gray-300">最优对冲比率: <span className="text-2xl font-bold text-teal-400">{hedgingCalculation.hedgeRatio.toFixed(4)}</span></p>
                    <p className="text-gray-300">Delta 中性头寸: <span className="text-2xl font-bold text-teal-400"><DollarSign className="inline-block h-5 w-5 mr-1" />{hedgingCalculation.deltaNeutralPosition.toLocaleString()}</span></p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl text-teal-300">行业分布饼图</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={industryDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {industryDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl text-teal-300">历史回测净值曲线</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                        <XAxis dataKey="date" stroke="#9CA3AF" tickFormatter={(tick) => new Date(tick).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} />
                        <YAxis stroke="#9CA3AF" />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [`${value.toFixed(2)}`, name === 'portfolio' ? '篹子净值' : '基准净值']}
                          labelFormatter={(label) => `日期: ${label}`}
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#E5E7EB' }}
                        />
                        <Line type="monotone" dataKey="portfolio" stroke="#00C49F" dot={false} name="Portfolio" />
                        <Line type="monotone" dataKey="benchmark" stroke="#FFBB28" dot={false} name="Benchmark" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-xl text-teal-300">风险贡献分析</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsBarChart data={riskContributionData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                        <XAxis type="number" stroke="#9CA3AF" tickFormatter={(tick) => `${tick}%`} />
                        <YAxis type="category" dataKey="name" stroke="#9CA3AF" width={80} />
                        <RechartsTooltip
                          formatter={(value: number) => [`${value.toFixed(2)}%`, '贡献度']}
                          labelFormatter={(label) => `股票: ${label}`}
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#E5E7EB' }}
                        />
                        <Bar dataKey="contribution" fill="#00C49F" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CIXBPanel;
