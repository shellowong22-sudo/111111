import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw } from 'lucide-react';

interface MBWDPanelProps {}
type BwiState = { timeLeft: number | null; receivedQuotes: number | null; progress: number | null; isActive: boolean };
const EMPTY_BWI: BwiState = { timeLeft: null, receivedQuotes: null, progress: null, isActive: false };

/** 地方债买价问询：保留原五个观察区；未授权时不生成模拟报价或倒计时。 */
const MBWDPanel: React.FC<MBWDPanelProps> = () => {
  const [bwiState, setBwiState] = useState<BwiState>(EMPTY_BWI);
  const [notice, setNotice] = useState('等待授权的地方债 BWI 请求、报价和成交回报。');
  const handleResetBWI = () => { setBwiState(EMPTY_BWI); setNotice('已请求重新开始 BWI；当前没有授权问询通道，未启动模拟倒计时或生成报价。'); };
  return (
    <div className="p-4 bg-slate-950 text-gray-100 min-h-screen font-mono">
      <h1 className="text-2xl font-bold mb-6 text-orange-500">MBWDPanel - 地方债买价问询面板</h1>
      <div role="status" className="mb-6 rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">{notice}</div>
      <Card className="mb-6 bg-slate-900 border-orange-500"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-lg font-medium text-orange-400">BWI 请求实时流</CardTitle><Clock className="h-5 w-5 text-orange-400" /></CardHeader><CardContent><div className="text-sm text-gray-300 mb-2">剩余时间: <span className="text-green-400 font-bold">{bwiState.timeLeft === null ? '—' : `${bwiState.timeLeft}s`}</span></div><Progress value={bwiState.progress ?? 0} className="w-full h-2 bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-green-500" /><div className="text-sm text-gray-300 mt-2">已收到报价数: <span className="text-green-400 font-bold">{bwiState.receivedQuotes ?? '—'}</span></div><Button onClick={handleResetBWI} className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"><RefreshCw className="h-4 w-4 mr-2" />重新开始 BWI</Button></CardContent></Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-green-500"><CardHeader><CardTitle className="text-lg font-medium text-green-400">竞价结果分布图</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={[]}><CartesianGrid strokeDasharray="3 3" stroke="#4A5568" /><XAxis dataKey="range" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#38A169" /></BarChart></ResponsiveContainer><p className="text-sm text-amber-300">— 未接入授权报价回报，暂不生成分布。</p></CardContent></Card>
        <Card className="bg-slate-900 border-green-500"><CardHeader><CardTitle className="text-lg font-medium text-green-400">交易商报价历史</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><LineChart data={[]}><CartesianGrid strokeDasharray="3 3" stroke="#4A5568" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Line dataKey="Dealer A" stroke="#FFD700" /><Line dataKey="Dealer B" stroke="#1E90FF" /><Line dataKey="Dealer C" stroke="#FF6347" /><Line dataKey="Dealer D" stroke="#32CD32" /></LineChart></ResponsiveContainer><p className="text-sm text-amber-300">— 未接入交易商报价时间序列。</p></CardContent></Card>
        <Card className="bg-slate-900 border-green-500"><CardHeader><CardTitle className="text-lg font-medium text-green-400">最优报价接受率趋势</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><AreaChart data={[]}><CartesianGrid strokeDasharray="3 3" stroke="#4A5568" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Area dataKey="rate" stroke="#38A169" fill="#38A169" fillOpacity={0.3} /></AreaChart></ResponsiveContainer><p className="text-sm text-amber-300">— 未接入可核验的问询接受回报。</p></CardContent></Card>
        <Card className="bg-slate-900 border-green-500"><CardHeader><CardTitle className="text-lg font-medium text-green-400">BWI成功率 vs 市场流动性</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><ScatterChart><CartesianGrid strokeDasharray="3 3" stroke="#4A5568" /><XAxis type="number" dataKey="liquidity" /><YAxis type="number" dataKey="successRate" /><Tooltip /><Legend /><Scatter name="BWI表现" data={[]} fill="#F6AD55" /></ScatterChart></ResponsiveContainer><p className="text-sm text-amber-300">— 缺少同一问询批次的流动性和成功回报。</p></CardContent></Card>
      </div>
    </div>
  );
};
export default MBWDPanel;
