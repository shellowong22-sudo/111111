// @ts-nocheck
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { Calendar, TrendingUp, DollarSign, Globe, Target, Clock, Activity, Zap } from 'lucide-react';

// Mock utilities for shadcn/ui and sonner
const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');
const toast = {
  info: (message: string) => console.log(`Toast Info: ${message}`),
};

interface KPIProps {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  color: string;
}

const KPICard: React.FC<KPIProps> = ({ title, value, change, icon: Icon, color }) => (
  <Card className="w-full bg-gray-800 text-white border-none shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer"
        onClick={() => toast.info(`点击了 ${title} KPI`)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-300">{title}</CardTitle>
      <Icon className={cn("h-4 w-4", color)} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-gray-400">{change}</p>
    </CardContent>
  </Card>
);

type RateRow = { bank: string; rate: number | null; lastChange: string | null; direction: string | null };
const emptyMessage = (label: string) => <div className="flex h-52 items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900/40 px-4 text-center text-xs text-slate-400">{label}：暂无可验证的公开观测，不以模拟概率或历史快照填充。</div>;
const displayRate = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value.toFixed(2)}%`;
const buildGlobalExpectations = (rows: RateRow[]) => rows.map(row => ({ country: row.bank.replace(/\s*\(.+\)$/, ''), current: row.rate, q1: null, q2: null, q3: null, q4: null }));

const WIRPTab: React.FC = () => {
  const [activeView, setActiveView] = useState('fomc');
  const ratesQuery = trpc.macro.getCentralBankRates.useQuery(undefined, { staleTime: 5 * 60_000, refetchInterval: 5 * 60_000, retry: 1 });
  const treasuryQuery = trpc.treasuryDailyYield.getLatest.useQuery(undefined, { staleTime: 5 * 60_000, refetchInterval: 5 * 60_000, retry: 1 });
  const rateRows = (ratesQuery.data ?? []) as RateRow[];
  const fedRate = rateRows.find(row => row.bank.includes('美联储'))?.rate ?? null;
  const globalExpectationsData = buildGlobalExpectations(rateRows);
  const fomcData: Array<{ name: string; increase: number | null; decrease: number | null; unchanged: number | null }> = [];
  const oisData: Array<{ name: string; forwardRate: number | null; currentRate: number | null }> = [];
  const accuracyData: Array<{ name: string; oisPrediction: number; actualRate: number; error: number }> = [];
  const marketPathData: Array<Record<string, number | string>> = [];
  const ffFuturesData: Array<{ name: string; price: number; impliedRate: number }> = [];

  const renderView = () => {
    switch (activeView) {
      case 'fomc':
        return fomcData.length === 0 ? emptyMessage('FOMC 会议概率树') : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fomcData.map((data, index) => (
              <Card key={index} className="bg-gray-800 text-white border-none shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer"
                    onClick={() => toast.info(`点击了 FOMC 会议: ${data.name}`)}>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-200">{data.name} 会议概率</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-green-600 hover:bg-green-700">加息</Badge>
                      <Slider defaultValue={[data.increase]} max={100} step={1} className="w-[70%]"
                              onValueChange={(val) => toast.info(`加息概率: ${val}%`)} />
                      <span className="text-sm">{data.increase}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-red-600 hover:bg-red-700">降息</Badge>
                      <Slider defaultValue={[data.decrease]} max={100} step={1} className="w-[70%]"
                              onValueChange={(val) => toast.info(`降息概率: ${val}%`)} />
                      <span className="text-sm">{data.decrease}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-purple-600 hover:bg-purple-700">不变</Badge>
                      <Slider defaultValue={[data.unchanged]} max={100} step={1} className="w-[70%]"
                              onValueChange={(val) => toast.info(`利率不变概率: ${val}%`)} />
                      <span className="text-sm">{data.unchanged}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      case 'ois':
        return oisData.length === 0 ? emptyMessage('OIS 远期利率曲线') : (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={oisData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none', color: '#fff' }} />
              <Legend />
              <Bar dataKey="currentRate" fill="#8b5cf6" name="当前利率" onClick={(data) => toast.info(`OIS当前利率: ${data.name} - ${data.currentRate}%`)} />
              <Line type="monotone" dataKey="forwardRate" stroke="#a78bfa" name="远期利率" activeDot={{ r: 8 }} onClick={(data) => toast.info(`OIS远期利率: ${data.name} - ${data.forwardRate}%`)} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      case 'accuracy':
        return accuracyData.length === 0 ? emptyMessage('历史预测准确率') : (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="actualRate" name="实际利率" unit="%" stroke="#9ca3af" />
              <YAxis dataKey="oisPrediction" name="OIS预测" unit="%" stroke="#9ca3af" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#374151', border: 'none', color: '#fff' }} />
              <Legend />
              <Scatter name="预测准确率" data={accuracyData} fill="#8b5cf6" onClick={(data) => toast.info(`预测准确率: 期限 ${data.name}, 预测 ${data.oisPrediction}%, 实际 ${data.actualRate}%, 误差 ${data.error}%`)} />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'market_path':
        return marketPathData.length === 0 ? emptyMessage('市场隐含路径') : (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart outerRadius={150} width={730} height={250} data={marketPathData}>
              <PolarGrid stroke="#4a4a4a" />
              <PolarAngleAxis dataKey="name" stroke="#9ca3af" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#9ca3af" />
              <Radar name="-50bp" dataKey="-50bp" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} onClick={(data) => toast.info(`市场隐含路径: ${data.name}, -50bp 概率 ${data['-50bp']}%`)} />
              <Radar name="-25bp" dataKey="-25bp" stroke="#f97316" fill="#f97316" fillOpacity={0.6} onClick={(data) => toast.info(`市场隐含路径: ${data.name}, -25bp 概率 ${data['-25bp']}%`)} />
              <Radar name="0bp" dataKey="0bp" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} onClick={(data) => toast.info(`市场隐含路径: ${data.name}, 0bp 概率 ${data['0bp']}%`)} />
              <Radar name="+25bp" dataKey="+25bp" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} onClick={(data) => toast.info(`市场隐含路径: ${data.name}, +25bp 概率 ${data['+25bp']}%`)} />
              <Radar name="+50bp" dataKey="+50bp" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} onClick={(data) => toast.info(`市场隐含路径: ${data.name}, +50bp 概率 ${data['+50bp']}%`)} />
              <Legend />
              <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none', color: '#fff' }} />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'ff_futures':
        return ffFuturesData.length === 0 ? emptyMessage('联邦基金期货') : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={ffFuturesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none', color: '#fff' }} />
              <Area type="monotone" dataKey="price" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="期货价格" onClick={(data) => toast.info(`联邦基金期货: ${data.name}, 价格 ${data.price}, 隐含利率 ${data.impliedRate}%`)} />
              <Line type="monotone" dataKey="impliedRate" stroke="#a78bfa" name="隐含利率" onClick={(data) => toast.info(`联邦基金期货: ${data.name}, 价格 ${data.price}, 隐含利率 ${data.impliedRate}%`)} />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'global_expectations':
        return globalExpectationsData.length === 0 ? emptyMessage('全球利率预期对比') : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={globalExpectationsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="country" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none', color: '#fff' }} />
              <Legend />
              <Bar dataKey="current" fill="#8b5cf6" name="当前利率" onClick={(data) => toast.info(`全球利率预期: ${data.country}, 当前利率 ${data.current}%`)} />
              <Bar dataKey="q1" fill="#a78bfa" name="Q1 预期" onClick={(data) => toast.info(`全球利率预期: ${data.country}, Q1 预期 ${data.q1}%`)} />
              <Bar dataKey="q2" fill="#c4b5fd" name="Q2 预期" onClick={(data) => toast.info(`全球利率预期: ${data.country}, Q2 预期 ${data.q2}%`)} />
              <Bar dataKey="q3" fill="#ddd6fe" name="Q3 预期" onClick={(data) => toast.info(`全球利率预期: ${data.country}, Q3 预期 ${data.q3}%`)} />
              <Bar dataKey="q4" fill="#e0e7ff" name="Q4 预期" onClick={(data) => toast.info(`全球利率预期: ${data.country}, Q4 预期 ${data.q4}%`)} />
            </BarChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-100">利率概率模块 (WIRPTab)</h1>
        <Badge className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm px-3 py-1">{ratesQuery.isFetching || treasuryQuery.isFetching ? '检查中' : '公开观测'}</Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard title="联邦基金利率" value={displayRate(fedRate)} change={fedRate === null ? '未接入公开目标概率序列' : '公开观察'} icon={TrendingUp} color="text-green-400" />
        <KPICard title="下次会议降息概率" value="—" change="未配置可验证的概率市场源" icon={DollarSign} color="text-red-400" />
        <KPICard title="OIS 1Y 远期" value="—" change="未配置 OIS 远期公开源" icon={Clock} color="text-blue-400" />
        <KPICard title="全球平均预期" value="—" change="不对缺失央行预测做平均" icon={Globe} color="text-yellow-400" />
      </div>

      {/* View Switcher Buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Button variant={activeView === 'fomc' ? 'default' : 'outline'} 
                className={cn(activeView === 'fomc' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'border-gray-600 text-gray-300 hover:bg-gray-700', 'text-white')}
                onClick={() => {
                  setActiveView('fomc');
                  toast.info('切换到 FOMC 会议概率树');
                }}>
          <Calendar className="mr-2 h-4 w-4" />FOMC 会议概率树
        </Button>
        <Button variant={activeView === 'ois' ? 'default' : 'outline'} 
                className={cn(activeView === 'ois' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'border-gray-600 text-gray-300 hover:bg-gray-700', 'text-white')}
                onClick={() => {
                  setActiveView('ois');
                  toast.info('切换到 OIS 远期利率曲线');
                }}>
          <Activity className="mr-2 h-4 w-4" />OIS 远期利率曲线
        </Button>
        <Button variant={activeView === 'accuracy' ? 'default' : 'outline'} 
                className={cn(activeView === 'accuracy' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'border-gray-600 text-gray-300 hover:bg-gray-700', 'text-white')}
                onClick={() => {
                  setActiveView('accuracy');
                  toast.info('切换到历史预测准确率');
                }}>
          <Target className="mr-2 h-4 w-4" />历史预测准确率
        </Button>
        <Button variant={activeView === 'market_path' ? 'default' : 'outline'} 
                className={cn(activeView === 'market_path' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'border-gray-600 text-gray-300 hover:bg-gray-700', 'text-white')}
                onClick={() => {
                  setActiveView('market_path');
                  toast.info('切换到市场隐含路径');
                }}>
          <Zap className="mr-2 h-4 w-4" />市场隐含路径
        </Button>
        <Button variant={activeView === 'ff_futures' ? 'default' : 'outline'} 
                className={cn(activeView === 'ff_futures' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'border-gray-600 text-gray-300 hover:bg-gray-700', 'text-white')}
                onClick={() => {
                  setActiveView('ff_futures');
                  toast.info('切换到联邦基金期货');
                }}>
          <DollarSign className="mr-2 h-4 w-4" />联邦基金期货
        </Button>
        <Button variant={activeView === 'global_expectations' ? 'default' : 'outline'} 
                className={cn(activeView === 'global_expectations' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'border-gray-600 text-gray-300 hover:bg-gray-700', 'text-white')}
                onClick={() => {
                  setActiveView('global_expectations');
                  toast.info('切换到全球利率预期对比');
                }}>
          <Globe className="mr-2 h-4 w-4" />全球利率预期对比
        </Button>
      </div>

      {/* Main Content Area */}
      <Card className="bg-gray-800 text-white border-none shadow-lg">
        <CardContent className="p-6">
          {renderView()}
        </CardContent>
      </Card>
    </div>
  );
};

export default WIRPTab;
