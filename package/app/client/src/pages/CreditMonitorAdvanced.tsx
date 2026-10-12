/**
 * Credit Monitor Advanced - 信用产品综合监控
 * 模块：Credit Monitor + FICM + GCDS + TFLO + CDX
 * AI：多模态Transformer违约预警 + GAT知识图谱 + DML因果推断 + GCN指数聚合 + LSTM订单流
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Brain, Zap, Shield, Activity, Network, BarChart2, TrendingUp, TrendingDown, Download, FileText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
} from 'recharts';
import { trpc } from '@/lib/trpc';

const clr = (v: number) => v >= 0 ? '#22c55e' : '#ef4444';
const fmt = (v: number | null | undefined, d = 2) => v?.toFixed(d) ?? '—';
const fmtK = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);

const ratingColor = (r: string) => {
  if (r.startsWith('Aaa') || r.startsWith('AAA')) return '#22c55e';
  if (r.startsWith('Aa') || r.startsWith('AA')) return '#84cc16';
  if (r.startsWith('A')) return '#a3e635';
  if (r.startsWith('Baa') || r.startsWith('BBB')) return '#f59e0b';
  if (r.startsWith('Ba') || r.startsWith('BB')) return '#f97316';
  if (r.startsWith('B')) return '#ef4444';
  return '#dc2626';
};

const signalBadge = (s: string) => {
  if (s === 'BUY' || s === 'OVERWEIGHT' || s === 'TIGHTEN') return 'bg-green-900/60 text-green-300 border-green-700';
  if (s === 'SELL' || s === 'UNDERWEIGHT' || s === 'WIDEN') return 'bg-red-900/60 text-red-300 border-red-700';
  return 'bg-zinc-800 text-zinc-300 border-zinc-600';
};

const regionColors: Record<string, string> = {
  Americas: '#3b82f6', Europe: '#8b5cf6', Asia: '#f59e0b', Africa: '#ef4444', 'Middle East': '#22c55e',
};

export default function CreditMonitorAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('credit');
  const [selectedSector, setSelectedSector] = useState<string | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const { data: creditData } = trpc.creditAdvanced.getCreditBonds.useQuery({ sector: selectedSector });
  const { data: ficmData } = trpc.creditAdvanced.getFICMData.useQuery({ sector: selectedSector });
  const { data: gcdsData } = trpc.creditAdvanced.getGlobalCDS.useQuery({ region: selectedRegion });
  const { data: tfloData } = trpc.creditAdvanced.getTFLOData.useQuery({});
  const { data: cdxData } = trpc.creditAdvanced.getCDXData.useQuery({});

  // 导出 CSV 函数
  const exportCSV = () => {
    setExporting(true);
    try {
      const now = new Date().toISOString().slice(0, 10);
      const rows: string[][] = [];

      // 头部信息
      rows.push(['CREDIT MONITOR - 信用产品综合监控导出报告']);
      rows.push([`导出时间: ${new Date().toLocaleString('zh-CN')}`]);
      rows.push([`AI模型: 多模态Transformer | AUC: ${((creditData?.modelInfo?.auc || 0.924) * 100).toFixed(1)}%`]);
      rows.push([]);

      // Credit Monitor 数据
      rows.push(['=== 信用券券券数据 ===']);
      rows.push(['发行人', '债券', '行业', '价格', '收益率', '利差(bps)', 'Z-Spread', '评级', 'PD 6M', 'PD 12M', 'AI评级', 'AI信号', '置信度']);
      (creditData?.bonds || []).forEach(b => {
        rows.push([
          b.issuer, b.ticker, b.sector,
          String(b.price), `${b.yieldPct.toFixed(2)}%`, `${b.spread}bps`, `${b.zSpread}bps`,
          b.rating, `${b.pd6m.toFixed(2)}%`, `${b.pd12m.toFixed(2)}%`,
          b.aiRating, b.aiSignal, `${(b.aiConfidence * 100).toFixed(0)}%`,
        ]);
      });
      rows.push([]);

      // GCDS 数据
      rows.push(['=== 全球CDS数据 ===']);
      rows.push(['国家', 'ISO', '5Y CDS(bps)', '1Y CDS(bps)', '10Y CDS(bps)', '地区', '评级', 'AI信号']);
      (gcdsData?.sovereignCDS || []).forEach(c => {
        rows.push([c.country, c.iso, String(c.cds5y), String(c.cds1y), String(c.cds10y), c.region, c.rating, c.spreadSignal]);
      });
      rows.push([]);

      // CDX 数据
      rows.push(['=== CDX指数数据 ===']);
      rows.push(['指数', '地区', '类型', '利差(bps)', '涨跌', '价格', 'DV01', '成分数', '系统性风险', 'AI信号']);
      (cdxData?.indices || []).forEach(idx => {
        rows.push([idx.name, idx.region, idx.type, String(idx.spread), `${idx.chg >= 0 ? '+' : ''}${idx.chg?.toFixed(1)}`, String(idx.price?.toFixed(2)), String(idx.dv01?.toFixed(2)), String(idx.components), `${(idx.systemicRisk * 100).toFixed(0)}%`, idx.spreadSignal]);
      });

      // 转换为 CSV
      const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credit-monitor-${now}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('✅ CSV 导出成功', { description: `已下载: credit-monitor-${now}.csv` });
    } catch (e) {
      toast.error('导出失败', { description: String(e) });
    } finally {
      setExporting(false);
    }
  };

  // 导出 PDF 函数（基于 HTML 打印）
  const exportPDF = () => {
    setExporting(true);
    try {
      const now = new Date().toLocaleString('zh-CN');
      const bonds = creditData?.bonds || [];
      const cdsCountries = gcdsData?.sovereignCDS?.slice(0, 10) || [];
      const cdxIndices = cdxData?.indices || [];

      const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Credit Monitor 导出报告</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; font-size: 11px; color: #1a1a1a; margin: 20px; }
    h1 { font-size: 16px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 6px; }
    h2 { font-size: 13px; color: #1e3a5f; margin-top: 16px; margin-bottom: 6px; }
    .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #1e3a5f; color: white; padding: 4px 6px; text-align: left; font-size: 10px; }
    td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge-buy { background: #dcfce7; color: #166534; padding: 1px 4px; border-radius: 3px; }
    .badge-sell { background: #fee2e2; color: #991b1b; padding: 1px 4px; border-radius: 3px; }
    .badge-hold { background: #f1f5f9; color: #475569; padding: 1px 4px; border-radius: 3px; }
    .ai-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <h1>🛡️ CREDIT MONITOR — 信用产品综合监控报告</h1>
  <div class="meta">导出时间: ${now} &nbsp;|&nbsp; AI模型: 多模态Transformer &nbsp;|&nbsp; AUC: ${((creditData?.modelInfo?.auc || 0.924) * 100).toFixed(1)}% &nbsp;|&nbsp; 预测窗口: 6M / 12M</div>
  <div class="ai-box">
    <strong>AI模型架构:</strong> Multi-modal Transformer &nbsp;|
    <strong>模态:</strong> ${creditData?.modelInfo?.modalities?.join(' | ') || 'Financial Data | News | CDS Spreads'} &nbsp;|
    <strong>AUC:</strong> ${((creditData?.modelInfo?.auc || 0.924) * 100).toFixed(1)}%
  </div>

  <h2>📊 信用券券券数据（共 ${bonds.length} 条）</h2>
  <table>
    <tr><th>发行人</th><th>债券</th><th>行业</th><th>价格</th><th>收益率</th><th>利差(bps)</th><th>评级</th><th>PD 6M</th><th>PD 12M</th><th>AI评级</th><th>AI信号</th></tr>
    ${bonds.map(b => `<tr>
      <td><strong>${b.issuer}</strong></td><td>${b.ticker}</td><td>${b.sector}</td>
      <td>${b.price}</td><td>${b.yieldPct.toFixed(2)}%</td><td>${b.spread}bps</td>
      <td>${b.rating}</td><td>${b.pd6m.toFixed(2)}%</td><td>${b.pd12m.toFixed(2)}%</td>
      <td>${b.aiRating}</td>
      <td><span class="badge-${b.aiSignal.toLowerCase().includes('buy') ? 'buy' : b.aiSignal.toLowerCase().includes('sell') ? 'sell' : 'hold'}">${b.aiSignal}</span></td>
    </tr>`).join('')}
  </table>

  <h2>🌍 全球CDS数据（前10条）</h2>
  <table>
    <tr><th>国家</th><th>1Y CDS</th><th>5Y CDS</th><th>10Y CDS</th><th>地区</th><th>评级</th><th>AI信号</th></tr>
    ${cdsCountries.map(c => `<tr>
      <td><strong>${c.country}</strong></td><td>${c.cds1y}bps</td><td>${c.cds5y}bps</td><td>${c.cds10y}bps</td>
      <td>${c.region}</td><td>${c.rating}</td>
      <td><span class="badge-${c.spreadSignal === 'TIGHTEN' ? 'buy' : c.spreadSignal === 'WIDEN' ? 'sell' : 'hold'}">${c.spreadSignal}</span></td>
    </tr>`).join('')}
  </table>

  <h2>📈 CDX指数数据</h2>
  <table>
    <tr><th>指数</th><th>地区</th><th>类型</th><th>利差(bps)</th><th>涨跌</th><th>价格</th><th>DV01</th><th>系统性风险</th><th>AI信号</th></tr>
    ${cdxIndices.map(idx => `<tr>
      <td><strong>${idx.name}</strong></td><td>${idx.region}</td><td>${idx.type}</td>
      <td>${idx.spread}bps</td>
      <td style="color:${idx.chg >= 0 ? '#166534' : '#991b1b'}">${idx.chg >= 0 ? '+' : ''}${idx.chg?.toFixed(1)}</td>
      <td>${idx.price?.toFixed(2)}</td><td>${idx.dv01?.toFixed(2)}</td>
      <td>${(idx.systemicRisk * 100).toFixed(0)}%</td>
      <td><span class="badge-${idx.spreadSignal === 'TIGHTEN' ? 'buy' : idx.spreadSignal === 'WIDEN' ? 'sell' : 'hold'}">${idx.spreadSignal}</span></td>
    </tr>`).join('')}
  </table>

  <div class="meta" style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px;">
    本报告由 Finance Hub 自动生成 | AI增强分析仅供参考，不构成投资建议
  </div>
</body>
</html>`;

      const printWin = window.open('', '_blank', 'width=900,height=700');
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
          printWin.close();
        }, 500);
        toast.success('✅ PDF 导出就绪', { description: '请在打印对话框中选择“另存为PDF”' });
      } else {
        toast.error('无法打开打印窗口', { description: '请允许弹出窗口后重试' });
      }
    } catch (e) {
      toast.error('导出失败', { description: String(e) });
    } finally {
      setExporting(false);
    }
  };

  const SECTORS = ['Technology', 'Financials', 'Energy', 'Automotive', 'Healthcare'];
  const REGIONS = ['Americas', 'Europe', 'Asia', 'Africa'];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-zinc-400 hover:text-zinc-100 p-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          <span className="text-red-400 font-bold text-lg">CREDIT</span>
          <span className="text-zinc-400 text-sm">信用产品综合监控</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-red-900/60 text-red-400 border-red-700 text-xs">TRANSFORMER PD</Badge>
          <Badge className="bg-purple-900/60 text-purple-400 border-purple-700 text-xs">GAT KNOWLEDGE GRAPH</Badge>
          <Badge className="bg-blue-900/60 text-blue-400 border-blue-700 text-xs">DML CAUSAL</Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto gap-1">
            <TabsTrigger value="credit" className="text-xs data-[state=active]:bg-red-600 data-[state=active]:text-white">Credit Monitor</TabsTrigger>
            <TabsTrigger value="ficm" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white">FICM 固收信用</TabsTrigger>
            <TabsTrigger value="gcds" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">GCDS 全球CDS</TabsTrigger>
            <TabsTrigger value="tflo" className="text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white">TFLO 市场流量</TabsTrigger>
            <TabsTrigger value="cdx" className="text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white">CDX 指数</TabsTrigger>
          </TabsList>

          {/* -- Credit Monitor ------------------------------------------- */}
          <TabsContent value="credit" className="space-y-4">
            {/* AI Model Info */}
            <Card className="bg-red-950/20 border-red-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-bold text-sm">多模态Transformer信用违约预警系统</span>
                <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs ml-auto">
                  AUC: {((creditData?.modelInfo?.auc || 0.924) * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="text-xs text-zinc-400 grid grid-cols-2 md:grid-cols-3 gap-1">
                <div><span className="text-zinc-500">模态: </span>{creditData?.modelInfo?.modalities?.join(' | ')}</div>
                <div><span className="text-zinc-500">机制: </span>{creditData?.modelInfo?.attentionMechanism}</div>
                <div><span className="text-zinc-500">预测窗口: </span>{creditData?.modelInfo?.horizons?.join(', ')}</div>
              </div>
            </Card>

            {/* Sector Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedSector(undefined)}
                className={`px-3 py-1 rounded text-xs border transition-all ${!selectedSector ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-red-500'}`}
              >全部</button>
              {SECTORS.map(s => (
                <button key={s} onClick={() => setSelectedSector(s === selectedSector ? undefined : s)}
                  className={`px-3 py-1 rounded text-xs border transition-all ${selectedSector === s ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-red-500'}`}
                >{s}</button>
              ))}
            </div>

            {/* Credit Bonds Table */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">发行人</th>
                      <th className="px-2 py-1 text-left">债券</th>
                      <th className="px-2 py-1 text-left">行业</th>
                      <th className="px-2 py-1 text-right">价格</th>
                      <th className="px-2 py-1 text-right">收益率</th>
                      <th className="px-2 py-1 text-right">利差(bps)</th>
                      <th className="px-2 py-1 text-right">Z-Spread</th>
                      <th className="px-2 py-1 text-right">评级</th>
                      <th className="px-2 py-1 text-right text-red-400">PD 6M</th>
                      <th className="px-2 py-1 text-right text-red-400">PD 12M</th>
                      <th className="px-2 py-1 text-right text-purple-400">AI评级</th>
                      <th className="px-2 py-1 text-right text-green-400">AI信号</th>
                      <th className="px-2 py-1 text-right">置信度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditData?.bonds?.map((b, i) => (
                      <tr key={i} className={`border-b border-zinc-900 hover:bg-zinc-800/40 ${b.riskScore > 50 ? 'bg-red-950/10' : ''}`}>
                        <td className="px-2 py-1.5 font-bold text-zinc-200">{b.issuer}</td>
                        <td className="px-2 py-1.5 text-zinc-400 max-w-[140px] truncate">{b.ticker}</td>
                        <td className="px-2 py-1.5 text-zinc-500">{b.sector}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-100">{fmt(b.price)}</td>
                        <td className="px-2 py-1.5 text-right text-yellow-400">{fmt(b.yieldPct)}%</td>
                        <td className="px-2 py-1.5 text-right text-orange-400">{b.spread}bps</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{b.zSpread}bps</td>
                        <td className="px-2 py-1.5 text-right font-bold" style={{ color: ratingColor(b.rating) }}>{b.rating}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${b.pd6m > 2 ? 'text-red-400' : b.pd6m > 0.5 ? 'text-orange-400' : 'text-green-400'}`}>{fmt(b.pd6m)}%</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${b.pd12m > 4 ? 'text-red-400' : b.pd12m > 1 ? 'text-orange-400' : 'text-green-400'}`}>{fmt(b.pd12m)}%</td>
                        <td className="px-2 py-1.5 text-right font-bold" style={{ color: ratingColor(b.aiRating) }}>{b.aiRating}</td>
                        <td className="px-2 py-1.5 text-right">
                          <Badge className={`${signalBadge(b.aiSignal)} text-xs`}>{b.aiSignal}</Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{(b.aiConfidence * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Risk Score Chart */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">AI综合风险评分 (0=最安全, 100=最高风险)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={creditData?.bonds?.map(b => ({ name: b.issuer.split(' ')[0], score: b.riskScore, pd: b.pd12m }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Bar dataKey="score" name="风险评分">
                    {creditData?.bonds?.map((b, i) => (
                      <Cell key={i} fill={b.riskScore > 50 ? '#ef4444' : b.riskScore > 30 ? '#f59e0b' : '#22c55e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* -- FICM 固收信用 -------------------------------------------- */}
          <TabsContent value="ficm" className="space-y-4">
            <Card className="bg-purple-950/20 border-purple-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Network className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-bold text-sm">GAT图注意力网络 信用风险知识图谱</span>
              </div>
              <div className="text-xs text-zinc-400">
                <span className="text-zinc-500">图结构: </span>{ficmData?.modelInfo?.nodes} → {ficmData?.modelInfo?.edges}
              </div>
            </Card>

            {/* Sector Risk Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-zinc-900 border-zinc-800 p-4">
                <h3 className="text-sm font-bold text-zinc-300 mb-3">行业利差与GAT风险评分</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="avgSpread" name="平均利差(bps)" tick={{ fill: '#71717a', fontSize: 10 }}
                      label={{ value: '平均利差(bps)', fill: '#71717a', fontSize: 10, position: 'insideBottom', offset: -5 }} />
                    <YAxis dataKey="gatRiskScore" name="GAT风险分" tick={{ fill: '#71717a', fontSize: 10 }}
                      label={{ value: 'GAT风险分', fill: '#71717a', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }}
                      formatter={(v: number, name: string) => [fmt(v, 3), name]}
                    />
                    <Scatter
                      name="行业"
                      data={ficmData?.sectorData}
                      fill="#8b5cf6"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800 p-4">
                <h3 className="text-sm font-bold text-zinc-300 mb-3">行业传染风险 (GAT传播)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ficmData?.sectorData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} domain={[0, 1]} />
                    <YAxis type="category" dataKey="sector" tick={{ fill: '#71717a', fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                    <Bar dataKey="contagionRisk" name="传染风险">
                      {ficmData?.sectorData?.map((s, i) => (
                        <Cell key={i} fill={s.contagionRisk > 0.4 ? '#ef4444' : s.contagionRisk > 0.25 ? '#f59e0b' : '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Sector Spread Curves */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">行业利差期限结构</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="maturity" type="number" domain={[1, 10]} tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: '期限(年)', fill: '#71717a', fontSize: 10, position: 'insideBottom', offset: -5 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: '利差(bps)', fill: '#71717a', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ficmData?.sectorData?.map((s, i) => (
                    <Line
                      key={s.sector}
                      data={s.spreadCurve}
                      dataKey="spread"
                      name={s.sector}
                      stroke={['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'][i % 5]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Sector Table */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">行业</th>
                      <th className="px-2 py-1 text-right">债券数</th>
                      <th className="px-2 py-1 text-right">平均利差</th>
                      <th className="px-2 py-1 text-right">平均收益率</th>
                      <th className="px-2 py-1 text-right">平均PD 12M</th>
                      <th className="px-2 py-1 text-right text-purple-400">GAT风险分</th>
                      <th className="px-2 py-1 text-right text-red-400">传染风险</th>
                      <th className="px-2 py-1 text-center">信号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficmData?.sectorData?.map((s, i) => (
                      <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-800/40">
                        <td className="px-2 py-1.5 font-bold text-zinc-200">{s.sector}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{s.bondCount}</td>
                        <td className="px-2 py-1.5 text-right text-orange-400">{s.avgSpread?.toFixed(1)}bps</td>
                        <td className="px-2 py-1.5 text-right text-yellow-400">{s.avgYield?.toFixed(2)}%</td>
                        <td className={`px-2 py-1.5 text-right ${s.avgPD12m > 3 ? 'text-red-400' : s.avgPD12m > 1 ? 'text-orange-400' : 'text-green-400'}`}>{s.avgPD12m?.toFixed(2)}%</td>
                        <td className="px-2 py-1.5 text-right text-purple-400 font-bold">{s.gatRiskScore?.toFixed(3)}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${s.contagionRisk > 0.4 ? 'text-red-400' : s.contagionRisk > 0.25 ? 'text-orange-400' : 'text-green-400'}`}>{s.contagionRisk?.toFixed(3)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge className={`${signalBadge(s.signal)} text-xs`}>{s.signal}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* -- GCDS 全球CDS -------------------------------------------- */}
          <TabsContent value="gcds" className="space-y-4">
            <Card className="bg-blue-950/20 border-blue-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-blue-400" />
                <span className="text-blue-300 font-bold text-sm">DML双重机器学习 + 结构因果模型 (SCM)</span>
              </div>
              <div className="text-xs text-zinc-400">
                <span className="text-zinc-500">DML公式: </span>{gcdsData?.modelInfo?.dmlFormula} |
                <span className="text-zinc-500 ml-2">SCM: </span>{gcdsData?.modelInfo?.scmFormula}
              </div>
            </Card>

            {/* Region Filter */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedRegion(undefined)}
                className={`px-3 py-1 rounded text-xs border transition-all ${!selectedRegion ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-blue-500'}`}>全部</button>
              {REGIONS.map(r => (
                <button key={r} onClick={() => setSelectedRegion(r === selectedRegion ? undefined : r)}
                  className={`px-3 py-1 rounded text-xs border transition-all ${selectedRegion === r ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-blue-500'}`}>{r}</button>
              ))}
            </div>

            {/* CDS Bubble Chart */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">主权CDS 5Y利差 vs 违约概率</h3>
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="cds5y" name="CDS 5Y(bps)" tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: 'CDS 5Y (bps)', fill: '#71717a', fontSize: 10, position: 'insideBottom', offset: -5 }} />
                  <YAxis dataKey="pd5y" name="PD 5Y(%)" tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: 'PD 5Y(%)', fill: '#71717a', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }}
                    formatter={(v: number, name: string) => [fmt(v, 2), name]}
                    labelFormatter={(label) => `CDS: ${label}bps`}
                  />
                  {REGIONS.map(region => (
                    <Scatter
                      key={region}
                      name={region}
                      data={gcdsData?.sovereignCDS?.filter(c => c.region === region)}
                      fill={regionColors[region] || '#a1a1aa'}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>

            {/* CDS Historical Chart */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">主要国家 CDS 5Y 60日走势</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 9 }} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {gcdsData?.history?.map((h, i) => (
                    <Line
                      key={h.country}
                      data={h.data}
                      dataKey="spread"
                      name={h.country}
                      stroke={['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'][i % 5]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Sovereign CDS Table */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">国家</th>
                      <th className="px-2 py-1 text-right">CDS 1Y</th>
                      <th className="px-2 py-1 text-right">CDS 3Y</th>
                      <th className="px-2 py-1 text-right">CDS 5Y</th>
                      <th className="px-2 py-1 text-right">CDS 10Y</th>
                      <th className="px-2 py-1 text-right">涨跌</th>
                      <th className="px-2 py-1 text-right">PD 5Y</th>
                      <th className="px-2 py-1 text-right">评级</th>
                      <th className="px-2 py-1 text-right text-blue-400">预测利差</th>
                      <th className="px-2 py-1 text-center">DML信号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gcdsData?.sovereignCDS?.map((c, i) => (
                      <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-800/40">
                        <td className="px-2 py-1.5 font-bold text-zinc-200">{c.country}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{c.cds1y}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{c.cds3y}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-zinc-100">{c.cds5y}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{c.cds10y}</td>
                        <td className={`px-2 py-1.5 text-right ${clr(c.chg5y)}`}>{c.chg5y >= 0 ? '+' : ''}{c.chg5y?.toFixed(1)}</td>
                        <td className={`px-2 py-1.5 text-right ${c.pd5y > 5 ? 'text-red-400' : c.pd5y > 2 ? 'text-orange-400' : 'text-green-400'}`}>{c.pd5y?.toFixed(2)}%</td>
                        <td className="px-2 py-1.5 text-right font-bold" style={{ color: ratingColor(c.rating) }}>{c.rating}</td>
                        <td className="px-2 py-1.5 text-right text-blue-400">{c.predictedSpread}</td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge className={`${signalBadge(c.spreadSignal)} text-xs`}>{c.spreadSignal}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* -- TFLO 市场流量 -------------------------------------------- */}
          <TabsContent value="tflo" className="space-y-4">
            <Card className="bg-green-950/20 border-green-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-green-300 font-bold text-sm">MLP + LSTM 订单流分析引擎</span>
              </div>
              <div className="text-xs text-zinc-400">
                <span className="text-zinc-500">MLP层: </span>{tfloData?.modelInfo?.mlpLayers?.join('→')} |
                <span className="text-zinc-500 ml-2">LSTM: </span>{tfloData?.modelInfo?.lstmUnits}单元 |
                <span className="text-zinc-500 ml-2">预测窗口: </span>{tfloData?.modelInfo?.predictionHorizon}
              </div>
            </Card>

            {/* Stats Cards */}
            {tfloData?.stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: '买入成交量', value: fmtK(tfloData.stats.totalBuyVol), color: '#22c55e' },
                  { label: '卖出成交量', value: fmtK(tfloData.stats.totalSellVol), color: '#ef4444' },
                  { label: '买卖比', value: fmt(tfloData.stats.buyRatio, 3), color: tfloData.stats.buyRatio > 0.5 ? '#22c55e' : '#ef4444' },
                  { label: '机构交易', value: `${tfloData.stats.institutionalCount}笔`, color: '#8b5cf6' },
                  { label: '冰山订单', value: `${tfloData.stats.icebergCount}笔`, color: '#f59e0b' },
                  { label: '平均价格冲击', value: fmt(tfloData.stats.avgPriceImpact, 4), color: '#a1a1aa' },
                  { label: 'LSTM预测冲击', value: fmt(tfloData.lstmPrediction?.predictedPriceImpact, 4), color: '#06b6d4' },
                  { label: '流动性趋势', value: tfloData.lstmPrediction?.liquidityTrend || '—', color: tfloData.lstmPrediction?.liquidityTrend === 'IMPROVING' ? '#22c55e' : '#ef4444' },
                ].map(item => (
                  <Card key={item.label} className="bg-zinc-900 border-zinc-800 p-2 text-center">
                    <div className="text-zinc-500 text-xs">{item.label}</div>
                    <div className="font-bold text-sm" style={{ color: item.color }}>{item.value}</div>
                  </Card>
                ))}
              </div>
            )}

            {/* TRACE Flow Table */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">TRACE 实时成交流量 (近30笔)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">时间</th>
                      <th className="px-2 py-1 text-left">发行人</th>
                      <th className="px-2 py-1 text-center">方向</th>
                      <th className="px-2 py-1 text-right">价格</th>
                      <th className="px-2 py-1 text-right">收益率</th>
                      <th className="px-2 py-1 text-right">规模</th>
                      <th className="px-2 py-1 text-right">价格冲击</th>
                      <th className="px-2 py-1 text-right">流动性分</th>
                      <th className="px-2 py-1 text-center">机构</th>
                      <th className="px-2 py-1 text-center">冰山</th>
                      <th className="px-2 py-1 text-center">信号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tfloData?.flows?.map((f, i) => (
                      <tr key={i} className={`border-b border-zinc-900 hover:bg-zinc-800/40 ${f.institutionalFlag ? 'bg-purple-950/10' : ''}`}>
                        <td className="px-2 py-1.5 text-zinc-500">{new Date(f.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                        <td className="px-2 py-1.5 font-bold text-zinc-200">{f.issuer}</td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge className={f.side === 'BUY' ? 'bg-green-900/60 text-green-300 border-green-700 text-xs' : f.side === 'SELL' ? 'bg-red-900/60 text-red-300 border-red-700 text-xs' : 'bg-zinc-800 text-zinc-300 border-zinc-600 text-xs'}>
                            {f.side}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right text-zinc-100">{fmt(f.price)}</td>
                        <td className="px-2 py-1.5 text-right text-yellow-400">{fmt(f.yield)}%</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{fmtK(f.size)}</td>
                        <td className={`px-2 py-1.5 text-right ${f.priceImpact > 0.1 ? 'text-red-400' : 'text-zinc-400'}`}>{fmt(f.priceImpact, 4)}</td>
                        <td className={`px-2 py-1.5 text-right ${f.liquidityScore > 0.8 ? 'text-green-400' : f.liquidityScore > 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>{fmt(f.liquidityScore, 3)}</td>
                        <td className="px-2 py-1.5 text-center">{f.institutionalFlag ? '🏦' : '—'}</td>
                        <td className="px-2 py-1.5 text-center">{f.icebergFlag ? '🧊' : '—'}</td>
                        <td className="px-2 py-1.5 text-center">
                          {f.orderFlowSignal !== 'NEUTRAL'
                            ? <Badge className={`${signalBadge(f.orderFlowSignal)} text-xs`}>{f.orderFlowSignal.split('_')[0]}</Badge>
                            : <span className="text-zinc-700">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* -- CDX 指数 ------------------------------------------------- */}
          <TabsContent value="cdx" className="space-y-4">
            <Card className="bg-orange-950/20 border-orange-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 className="w-4 h-4 text-orange-400" />
                <span className="text-orange-300 font-bold text-sm">GCN图卷积网络 指数成分风险聚合</span>
              </div>
              <div className="text-xs text-zinc-400">
                <span className="text-zinc-500">图结构: </span>{cdxData?.modelInfo?.graphStructure} |
                <span className="text-zinc-500 ml-2">卷积层: </span>{cdxData?.modelInfo?.convolutionLayers}层 |
                <span className="text-zinc-500 ml-2">输出维度: </span>{cdxData?.modelInfo?.outputDim}
              </div>
            </Card>

            {/* CDX Indices Table */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">指数</th>
                      <th className="px-2 py-1 text-left">地区</th>
                      <th className="px-2 py-1 text-left">类型</th>
                      <th className="px-2 py-1 text-right">利差(bps)</th>
                      <th className="px-2 py-1 text-right">涨跌</th>
                      <th className="px-2 py-1 text-right">价格</th>
                      <th className="px-2 py-1 text-right">DV01</th>
                      <th className="px-2 py-1 text-right">成分数</th>
                      <th className="px-2 py-1 text-right text-red-400">系统风险</th>
                      <th className="px-2 py-1 text-right text-orange-400">个体风险</th>
                      <th className="px-2 py-1 text-right text-blue-400">预测利差</th>
                      <th className="px-2 py-1 text-center">GCN信号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cdxData?.indices?.map((idx, i) => (
                      <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-800/40">
                        <td className="px-2 py-1.5 font-bold text-orange-400">{idx.name}</td>
                        <td className="px-2 py-1.5 text-zinc-400">{idx.region}</td>
                        <td className="px-2 py-1.5 text-zinc-500">{idx.type}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-zinc-100">{idx.spread?.toFixed(1)}</td>
                        <td className={`px-2 py-1.5 text-right ${clr(idx.chg)}`}>{idx.chg >= 0 ? '+' : ''}{idx.chg?.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-300">{idx.price?.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-purple-400">{idx.dv01?.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{idx.components}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${idx.systemicRisk > 0.5 ? 'text-red-400' : 'text-orange-400'}`}>{(idx.systemicRisk * 100).toFixed(0)}%</td>
                        <td className="px-2 py-1.5 text-right text-orange-400">{(idx.idiosyncraticRisk * 100).toFixed(0)}%</td>
                        <td className="px-2 py-1.5 text-right text-blue-400">{idx.predictedSpread?.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge className={`${signalBadge(idx.spreadSignal)} text-xs`}>{idx.spreadSignal}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* CDX Historical Spread */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">CDX 30日利差走势</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 9 }} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {cdxData?.history?.map((h, i) => (
                    <Line
                      key={h.id}
                      data={h.data}
                      dataKey="spread"
                      name={h.name}
                      stroke={['#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#22c55e'][i % 5]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Risk Decomposition */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">GCN 系统性 vs 个体风险分解</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cdxData?.riskDecomposition?.map(r => ({
                  name: r.name.split('.')[0],
                  systemic: (r.systemicRisk * 100).toFixed(1),
                  idiosyncratic: (r.idiosyncraticRisk * 100).toFixed(1),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="systemic" name="系统性风险%" stackId="a" fill="#ef4444" />
                  <Bar dataKey="idiosyncratic" name="个体风险%" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
