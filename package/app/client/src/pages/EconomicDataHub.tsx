/**
 * EconomicDataHub - 经济数据及分析中心（完整版 v2 - 深度差异化）
 */
import { useState, useEffect } from 'react';
import { useSearch } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  Legend, Cell, ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Activity, Globe, TrendingUp, AlertCircle, Calendar, Target, Zap, Shield, DollarSign, BarChart2, BookOpen, Newspaper, ChevronRight, ArrowUpRight, ArrowDownRight, Plus, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ECTRTab from '@/components/econ/ECTRTab';
import EconCalendar from '@/uc/news/EconCalendar';
import { EcstLive } from '@/components/live/EconLive';
import { EcwbLive, EcobLive, ShokLive, FomsLive, MospLive } from '@/components/live/EconLive2';
import { WcrsLive } from '@/components/live/FxDeskLive';
import WFIITab from '@/components/econ/WFIITab';
import RSANTab from '@/components/econ/RSANTab';
import ECFCTab from '@/components/econ/ECFCTab';
import FCONTab from '@/components/econ/FCONTab';
import ECANTab from '@/components/econ/ECANTab';
import CBRTTab from '@/components/econ/CBRTTab';
import FOECTab from '@/components/econ/FOECTab';
import ECSUTab from '@/components/econ/ECSUTab';
import CENBTab from '@/components/econ/CENBTab';
import PMITab from '@/components/econ/PMITab';
import WIRPTab from '@/components/econ/WIRPTab';
import TAYLTab from '@/components/econ/TAYLTab';
import { trpc } from '@/lib/trpc';
import { projectStatisticHistory, summarizeAnnualizedQuarterlyGrowth, summarizeMonthlyRate, summarizeQuarterlyGrowth, type StatisticMode } from '@shared/economicStatistics';

// ── ECO 经济日历数据 ──────────────────────────────────────────────────────────
const ECO_CALENDAR = [
  { time: '08:30', country: '美国', flag: '🇺🇸', event: '非农就业人数（万人）', importance: 'high', previous: '22.7', forecast: '18.5', actual: '25.6', surprise: 'beat', deviation: 38.4 },
  { time: '08:30', country: '美国', flag: '🇺🇸', event: '失业率', importance: 'high', previous: '4.1%', forecast: '4.2%', actual: '4.0%', surprise: 'beat', deviation: -4.8 },
  { time: '08:30', country: '美国', flag: '🇺🇸', event: '平均时薪（同比）', importance: 'high', previous: '4.0%', forecast: '3.9%', actual: '3.8%', surprise: 'miss', deviation: -2.6 },
  { time: '10:00', country: '美国', flag: '🇺🇸', event: 'ISM制造业PMI', importance: 'high', previous: '48.4', forecast: '48.8', actual: null, surprise: null, deviation: 0 },
  { time: '10:00', country: '美国', flag: '🇺🇸', event: '密歇根消费者信心指数', importance: 'medium', previous: '68.9', forecast: '70.5', actual: null, surprise: null, deviation: 0 },
  { time: '11:00', country: '欧元区', flag: '🇪🇺', event: 'CPI（同比）', importance: 'high', previous: '2.3%', forecast: '2.2%', actual: '2.1%', surprise: 'beat', deviation: -4.5 },
  { time: '02:00', country: '英国', flag: '🇬🇧', event: '英国央行利率决议', importance: 'high', previous: '4.75%', forecast: '4.50%', actual: null, surprise: null, deviation: 0 },
  { time: '21:30', country: '中国', flag: '🇨🇳', event: '财新制造业PMI', importance: 'medium', previous: '50.5', forecast: '50.8', actual: '51.2', surprise: 'beat', deviation: 7.9 },
  { time: '14:30', country: '德国', flag: '🇩🇪', event: 'GDP（季环比）', importance: 'medium', previous: '-0.1%', forecast: '0.2%', actual: '0.3%', surprise: 'beat', deviation: 50.0 },
  { time: '15:00', country: '日本', flag: '🇯🇵', event: '核心CPI（同比）', importance: 'medium', previous: '2.4%', forecast: '2.3%', actual: null, surprise: null, deviation: 0 },
];
const ECO_SURPRISE_HISTORY = [
  { month: '2024-06', us: 12, eu: -8, cn: 5, jp: -15, uk: 3 },
  { month: '2024-07', us: -5, eu: 10, cn: -12, jp: 8, uk: -6 },
  { month: '2024-08', us: 18, eu: 6, cn: 15, jp: -3, uk: 12 },
  { month: '2024-09', us: -8, eu: -15, cn: 8, jp: 20, uk: -10 },
  { month: '2024-10', us: 22, eu: 5, cn: -5, jp: 12, uk: 8 },
  { month: '2024-11', us: 15, eu: -3, cn: 18, jp: -8, uk: 5 },
];

// ── ECOB 关键经济指标 ──────────────────────────────────────────────────────────
const KEY_INDICATORS = [
  { name: 'ISM制造业PMI', value: 48.4, change: -0.4, unit: '', signal: 'red' as const, desc: '低于荣枯线，制造业收缩' },
  { name: 'ISM服务业PMI', value: 52.1, change: +1.2, unit: '', signal: 'green' as const, desc: '高于荣枯线，服务业扩张' },
  { name: '美国10Y国债收益率', value: 4.42, change: -0.08, unit: '%', signal: 'yellow' as const, desc: '接近关键阻力位4.5%' },
  { name: '美元指数（DXY）', value: 106.2, change: +1.1, unit: '', signal: 'yellow' as const, desc: '突破105，美元走强' },
  { name: 'WTI原油', value: 69.8, change: -2.3, unit: '$/桶', signal: 'yellow' as const, desc: '接近70美元支撑位' },
  { name: '黄金', value: 2650, change: +35, unit: '$/盎司', signal: 'green' as const, desc: '突破2600历史高位' },
  { name: '标普500', value: 5970, change: +45, unit: '', signal: 'green' as const, desc: '接近6000整数关口' },
  { name: 'VIX恐慌指数', value: 14.2, change: -1.8, unit: '', signal: 'green' as const, desc: '低于20，市场情绪平稳' },
  { name: '铜价（期货）', value: 4.12, change: +0.08, unit: '$/磅', signal: 'green' as const, desc: '铜价走强，经济预期改善' },
  { name: '美国2Y-10Y利差', value: 0.28, change: +0.12, unit: '%', signal: 'green' as const, desc: '利差转正，衰退风险降低' },
  { name: '信用利差（IG）', value: 85, change: -5, unit: 'bp', signal: 'green' as const, desc: '利差收窄，信用环境宽松' },
  { name: '信用利差（HY）', value: 285, change: -15, unit: 'bp', signal: 'green' as const, desc: '高收益利差处于低位' },
];

// ── ECWB 经济工作台 ──────────────────────────────────────────────────────────
const ECWB_WATCHLIST = [
  { indicator: 'CPI同比', country: '🇺🇸 美国', value: 2.7, nextRelease: '2025-01-15', importance: 'high', trend: 'up', history: [2.4, 2.5, 2.6, 2.7] },
  { indicator: 'GDP增速', country: '🇺🇸 美国', value: 2.8, nextRelease: '2025-01-30', importance: 'high', trend: 'stable', history: [2.2, 3.0, 2.8, 2.8] },
  { indicator: '非农就业', country: '🇺🇸 美国', value: 22.7, nextRelease: '2025-01-10', importance: 'high', trend: 'down', history: [36.0, 28.5, 22.7, 22.7] },
  { indicator: 'CPI同比', country: '🇨🇳 中国', value: 0.2, nextRelease: '2025-01-11', importance: 'high', trend: 'down', history: [0.6, 0.4, 0.2, 0.2] },
  { indicator: 'PMI制造业', country: '🇨🇳 中国', value: 50.3, nextRelease: '2025-01-31', importance: 'medium', trend: 'up', history: [49.8, 50.1, 50.3, 50.3] },
  { indicator: 'HICP同比', country: '🇪🇺 欧元区', value: 2.3, nextRelease: '2025-01-17', importance: 'high', trend: 'up', history: [2.0, 2.0, 2.3, 2.3] },
  { indicator: 'GDP增速', country: '🇩🇪 德国', value: -0.2, nextRelease: '2025-01-30', importance: 'medium', trend: 'down', history: [0.2, 0.0, -0.2, -0.2] },
  { indicator: 'CPI同比', country: '🇯🇵 日本', value: 2.4, nextRelease: '2025-01-24', importance: 'medium', trend: 'stable', history: [2.5, 2.4, 2.4, 2.4] },
];
const CORRELATION_MATRIX = [
  [1.00, 0.72, -0.45, 0.38],
  [0.72, 1.00, -0.62, 0.55],
  [-0.45, -0.62, 1.00, -0.48],
  [0.38, 0.55, -0.48, 1.00],
];
const CORR_LABELS = ['CPI', 'GDP', '失业率', 'PMI'];

// ── SHOK 预测模型 ──────────────────────────────────────────────────────────────
const SHOK_SCENARIOS = [
  {
    name: '基准情景（软着陆）', probability: 55, color: '#3b82f6',
    assumptions: ['美联储2025年降息3次（75bp）', '美国GDP增速维持1.8-2.2%', 'CPI回落至2.2%', '失业率温和上升至4.3%'],
    impacts: { sp500: '+8%', bonds: '+5%', usd: '-3%', gold: '+5%', oil: '-5%' },
    paths: [{ quarter: 'Q1', gdp: 2.2, cpi: 2.5, rate: 4.00 }, { quarter: 'Q2', gdp: 2.0, cpi: 2.3, rate: 3.75 }, { quarter: 'Q3', gdp: 1.9, cpi: 2.2, rate: 3.50 }, { quarter: 'Q4', gdp: 2.0, cpi: 2.2, rate: 3.50 }],
  },
  {
    name: '衰退情景（硬着陆）', probability: 20, color: '#ef4444',
    assumptions: ['美联储2025年降息5次（125bp）', '美国GDP增速降至-0.5%', '失业率上升至5.5%', '信用利差走阔200bp'],
    impacts: { sp500: '-20%', bonds: '+15%', usd: '+5%', gold: '+15%', oil: '-25%' },
    paths: [{ quarter: 'Q1', gdp: 1.0, cpi: 2.8, rate: 4.00 }, { quarter: 'Q2', gdp: -0.5, cpi: 2.5, rate: 3.25 }, { quarter: 'Q3', gdp: -0.8, cpi: 2.0, rate: 2.75 }, { quarter: 'Q4', gdp: 0.5, cpi: 1.8, rate: 2.75 }],
  },
  {
    name: '再通胀情景（不降息）', probability: 15, color: '#f59e0b',
    assumptions: ['美联储2025年维持利率不变', 'CPI反弹至3.5%', '美国GDP增速维持2.5%', '10Y国债收益率升至5%'],
    impacts: { sp500: '-10%', bonds: '-8%', usd: '+5%', gold: '+8%', oil: '+10%' },
    paths: [{ quarter: 'Q1', gdp: 2.5, cpi: 2.8, rate: 4.25 }, { quarter: 'Q2', gdp: 2.5, cpi: 3.2, rate: 4.25 }, { quarter: 'Q3', gdp: 2.3, cpi: 3.5, rate: 4.25 }, { quarter: 'Q4', gdp: 2.0, cpi: 3.5, rate: 4.25 }],
  },
  {
    name: '地缘冲击情景（黑天鹅）', probability: 10, color: '#8b5cf6',
    assumptions: ['中东冲突升级，原油供应中断', '油价飙升至120美元/桶', 'CPI反弹至4%', '全球经济增速降至2%'],
    impacts: { sp500: '-15%', bonds: '+3%', usd: '+8%', gold: '+20%', oil: '+40%' },
    paths: [{ quarter: 'Q1', gdp: 2.0, cpi: 3.0, rate: 4.25 }, { quarter: 'Q2', gdp: 0.5, cpi: 4.0, rate: 4.50 }, { quarter: 'Q3', gdp: 0.0, cpi: 4.2, rate: 4.25 }, { quarter: 'Q4', gdp: 1.0, cpi: 3.5, rate: 3.75 }],
  },
];

// ── FOMC 数据 ──────────────────────────────────────────────────────────────────
const FOMC_DOT_PLOT = [
  { year: '2025', median: 3.75, dots: [3.25, 3.50, 3.50, 3.75, 3.75, 3.75, 4.00, 4.00, 4.25, 4.50, 4.50, 4.50] },
  { year: '2026', median: 3.00, dots: [2.50, 2.75, 3.00, 3.00, 3.00, 3.25, 3.50] },
  { year: '长期', median: 2.50, dots: [2.25, 2.50, 2.50, 2.50, 2.75, 3.00] },
];
const FOMC_MEETINGS_2025 = [
  { date: '2025-01-29', decision: '维持4.25-4.50%', vote: '12-0', highlight: '关注通胀进展，不急于降息', hawkish: 65 },
  { date: '2025-03-19', decision: '降息25bp至4.00-4.25%', vote: '10-2', highlight: '就业市场降温，通胀接近目标', hawkish: 40 },
  { date: '2025-05-07', decision: '维持4.00-4.25%', vote: '11-1', highlight: '观察降息效果，数据依赖', hawkish: 52 },
  { date: '2025-06-18', decision: '降息25bp至3.75-4.00%', vote: '10-2', highlight: '通胀持续回落，就业平衡', hawkish: 38 },
  { date: '2025-07-30', decision: '维持3.75-4.00%', vote: '12-0', highlight: '暂停降息，评估经济状况', hawkish: 50 },
  { date: '2025-09-17', decision: '降息25bp至3.50-3.75%', vote: '11-1', highlight: '经济软着陆，通胀目标达成', hawkish: 35 },
];

// ── FOMS 声明 ──────────────────────────────────────────────────────────────────
const FOMS_STATEMENTS = [
  {
    date: '2024-12-18', title: '12月FOMC声明', decision: '降息25bp', rate: '4.25-4.50%',
    keyPoints: ['通胀朝着2%目标取得进展，但仍略高于目标', '劳动力市场总体保持稳健，但已有所降温', '委员会认为实现就业和通胀目标的风险大致平衡', '未来政策调整将取决于经济数据、前景及风险平衡'],
    hawkishDovish: 35,
    hawkishWords: ['通胀', '高于目标', '风险', '数据依赖'],
    dovishWords: ['降温', '平衡', '进展', '稳健'],
  },
  {
    date: '2024-11-07', title: '11月FOMC声明', decision: '降息25bp', rate: '4.50-4.75%',
    keyPoints: ['经济活动继续以稳健的速度扩张', '就业增长总体放缓，失业率有所上升但仍处于低位', '通胀朝着2%目标取得进一步进展', '委员会判断政策利率的下行风险已减少'],
    hawkishDovish: 40,
    hawkishWords: ['稳健', '低位', '下行风险减少'],
    dovishWords: ['放缓', '上升', '进展', '进一步'],
  },
];
const HAWK_DOVE_WORDS = [
  { word: '通胀', hawkFreq: 12, doveFreq: 3 },
  { word: '就业', hawkFreq: 4, doveFreq: 8 },
  { word: '数据依赖', hawkFreq: 6, doveFreq: 2 },
  { word: '进展', hawkFreq: 2, doveFreq: 9 },
  { word: '稳健', hawkFreq: 5, doveFreq: 4 },
  { word: '降温', hawkFreq: 1, doveFreq: 7 },
  { word: '风险', hawkFreq: 8, doveFreq: 3 },
  { word: '平衡', hawkFreq: 2, doveFreq: 6 },
];

// ── BECO 彭博经济综合 ──────────────────────────────────────────────────────────
const BECO_GROWTH_TRACKER = [
  { month: '2024-01', US: 2.1, CN: 5.2, EU: 0.8, JP: 0.5, EM: 4.1 },
  { month: '2024-03', US: 2.5, CN: 5.3, EU: 0.9, JP: -0.2, EM: 4.2 },
  { month: '2024-05', US: 2.6, CN: 4.9, EU: 1.1, JP: 0.1, EM: 4.3 },
  { month: '2024-07', US: 2.9, CN: 4.8, EU: 0.9, JP: 0.8, EM: 4.3 },
  { month: '2024-09', US: 2.8, CN: 4.6, EU: 0.9, JP: -0.3, EM: 4.1 },
  { month: '2024-11', US: 2.8, CN: 4.8, EU: 1.1, JP: 0.5, EM: 4.3 },
];
const CYCLE_RADAR = [
  { subject: 'GDP增速', US: 70, CN: 85, EU: 45 },
  { subject: '通胀压力', US: 55, CN: 20, EU: 50 },
  { subject: '就业强度', US: 75, CN: 50, EU: 60 },
  { subject: '货币宽松', US: 65, CN: 80, EU: 70 },
  { subject: '财政扩张', US: 60, CN: 75, EU: 40 },
  { subject: '外需动能', US: 55, CN: 70, EU: 50 },
];

// ── BIE 国家报告 ──────────────────────────────────────────────────────────────
const BIE_COUNTRIES = [
  { country: '🇺🇸 美国', gdp: 2.8, inflation: 2.7, unemployment: 4.1, policy: '4.50%', outlook: '软着陆', risk: 'medium', color: '#3b82f6', score: 72, x: 2.8, y: 2.7 },
  { country: '🇨🇳 中国', gdp: 4.8, inflation: 0.2, unemployment: 5.0, policy: '3.10%', outlook: '结构调整', risk: 'high', color: '#ef4444', score: 58, x: 4.8, y: 0.2 },
  { country: '🇪🇺 欧元区', gdp: 1.1, inflation: 2.3, unemployment: 6.3, policy: '3.15%', outlook: '缓慢复苏', risk: 'medium', color: '#f59e0b', score: 55, x: 1.1, y: 2.3 },
  { country: '🇯🇵 日本', gdp: 0.5, inflation: 2.4, unemployment: 2.5, policy: '0.25%', outlook: '政策正常化', risk: 'low', color: '#22c55e', score: 65, x: 0.5, y: 2.4 },
  { country: '🇬🇧 英国', gdp: 0.1, inflation: 2.6, unemployment: 4.3, policy: '4.75%', outlook: '增长乏力', risk: 'medium', color: '#8b5cf6', score: 48, x: 0.1, y: 2.6 },
  { country: '🇮🇳 印度', gdp: 6.8, inflation: 5.5, unemployment: 7.8, policy: '6.50%', outlook: '高速增长', risk: 'low', color: '#06b6d4', score: 78, x: 6.8, y: 5.5 },
  { country: '🇧🇷 巴西', gdp: 2.9, inflation: 4.8, unemployment: 6.2, policy: '12.25%', outlook: '通胀压力', risk: 'high', color: '#f97316', score: 42, x: 2.9, y: 4.8 },
  { country: '🇲🇽 墨西哥', gdp: 1.5, inflation: 4.2, unemployment: 2.8, policy: '10.25%', outlook: '降息周期', risk: 'medium', color: '#14b8a6', score: 52, x: 1.5, y: 4.2 },
];

// ── MOSP 预测市场 ──────────────────────────────────────────────────────────────
const MOSP_MARKETS = [
  { question: '美联储2025年是否降息超过75bp？', yes: 42, no: 58, volume: '2.3亿美元', trend: 'down', category: '货币政策', history: [48, 45, 42] },
  { question: '2025年美国是否进入衰退？', yes: 22, no: 78, volume: '1.8亿美元', trend: 'stable', category: '经济增长', history: [20, 22, 22] },
  { question: '2025年美国CPI是否超过3%？', yes: 28, no: 72, volume: '1.2亿美元', trend: 'up', category: '通胀', history: [22, 25, 28] },
  { question: '2025年标普500是否突破7000点？', yes: 55, no: 45, volume: '3.1亿美元', trend: 'up', category: '股市', history: [48, 52, 55] },
  { question: '2025年日本央行是否加息超过50bp？', yes: 65, no: 35, volume: '0.9亿美元', trend: 'up', category: '货币政策', history: [58, 62, 65] },
  { question: '2025年中国GDP增速是否超过5%？', yes: 38, no: 62, volume: '1.5亿美元', trend: 'down', category: '经济增长', history: [42, 40, 38] },
  { question: '2025年WTI原油是否超过90美元？', yes: 25, no: 75, volume: '2.0亿美元', trend: 'down', category: '大宗商品', history: [30, 28, 25] },
  { question: '2025年黄金是否突破3000美元？', yes: 60, no: 40, volume: '1.7亿美元', trend: 'up', category: '大宗商品', history: [52, 56, 60] },
];

// ── BE 经济新闻 ──────────────────────────────────────────────────────────────
const BE_NEWS = [
  { time: '2小时前', title: '美联储鲍威尔：不急于降息，将密切关注通胀数据', category: '央行政策', importance: 'high', impact: '美元走强，国债收益率上行', sentiment: 'hawkish' },
  { time: '3小时前', title: '美国11月非农就业新增22.7万，强于预期', category: '就业数据', importance: 'high', impact: '风险资产上涨，降息预期降温', sentiment: 'positive' },
  { time: '5小时前', title: '欧元区11月CPI同比2.3%，高于预期2.2%', category: '通胀数据', importance: 'high', impact: '欧元走强，欧债收益率上行', sentiment: 'hawkish' },
  { time: '8小时前', title: '中国11月财新PMI 51.5，创8个月新高', category: 'PMI数据', importance: 'medium', impact: '人民币走强，铜价上涨', sentiment: 'positive' },
  { time: '1天前', title: '日本央行会议纪要：部分委员讨论加息时机', category: '央行政策', importance: 'medium', impact: '日元走强，日债收益率上行', sentiment: 'hawkish' },
  { time: '1天前', title: '德国工业产出连续3个月下滑，衰退风险上升', category: '工业数据', importance: 'medium', impact: '欧元承压，德债收益率下行', sentiment: 'negative' },
  { time: '2天前', title: 'IMF上调2025年全球增速预测至3.3%', category: '机构预测', importance: 'medium', impact: '全球风险资产情绪改善', sentiment: 'positive' },
  { time: '2天前', title: '美国10月PCE通胀2.8%，连续两月持平', category: '通胀数据', importance: 'high', impact: '降息预期小幅回升', sentiment: 'neutral' },
];

// ── 所有标签定义 ──────────────────────────────────────────────────────────────
const ALL_TABS = [
  { value: 'eco', label: 'ECO', fullLabel: '经济日历', icon: Calendar },
  { value: 'ecst', label: 'ECST', fullLabel: '统计数据', icon: BarChart2 },
  { value: 'ectr', label: 'ECTR', fullLabel: '贸易流量', icon: Globe },
  { value: 'wfii', label: 'WFII', fullLabel: '外国投资', icon: DollarSign },
  { value: 'ecwb', label: 'ECWB', fullLabel: '经济工作台', icon: Target },
  { value: 'rsan', label: 'RSAN', fullLabel: '地缘政治', icon: Shield },
  { value: 'ecob', label: 'ECOB', fullLabel: '关键指标', icon: Activity },
  { value: 'ecfc', label: 'ECFC', fullLabel: '经济预测', icon: TrendingUp },
  { value: 'shok', label: 'SHOK', fullLabel: '预测模型', icon: Zap },
  { value: 'wirp', label: 'WIRP', fullLabel: '利率概率', icon: Target },
  { value: 'fcon', label: 'FCON', fullLabel: '财务状况', icon: Activity },
  { value: 'ecsu', label: 'ECSU', fullLabel: '经济意外', icon: AlertCircle },
  { value: 'tayl', label: 'TAYL', fullLabel: '泰勒规则', icon: Target },
  { value: 'ecan', label: 'ECAN', fullLabel: '经济分析', icon: TrendingUp },
  { value: 'mosp', label: 'MOSP', fullLabel: '预测市场', icon: BarChart2 },
  { value: 'cenb', label: 'CENB', fullLabel: '央行查找', icon: Globe },
  { value: 'cbrt', label: 'CBRT', fullLabel: '央行利率', icon: DollarSign },
  { value: 'foms', label: 'FOMS', fullLabel: 'FOMC声明', icon: Newspaper },
  { value: 'fdsp', label: 'FDSP', fullLabel: '联储分析仪', icon: Activity },
  { value: 'pmi', label: 'PMI', fullLabel: '标普PMI', icon: BarChart2 },
];

export default function EconomicDataHub({ initialTab = 'eco' }: { initialTab?: string } = {}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [shokSelected, setShokSelected] = useState(0);
  const [ecoFilter, setEcoFilter] = useState<'all' | 'high' | 'pending'>('all');
  const [ecobView, setEcobView] = useState<'signal' | 'grid'>('signal');
  const [beFilter, setBeFilter] = useState('全部');
  const [showAddIndicator, setShowAddIndicator] = useState(false);
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [watchlist, setWatchlist] = useState(ECWB_WATCHLIST);
  const search = useSearch();
  const officialQuery = trpc.legacyMarketData.getEconomicCalendarOfficialObservations.useQuery(undefined, {
    enabled: activeTab === 'eco',
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: false,
  });
  const officialObservations = officialQuery.data?.observations ?? [];
  // ECST reads only its own persisted contracts.  The terminal never falls
  // back to the historical mock constants when an archive is empty.
  const ecstArchiveOptions = { enabled: activeTab === 'ecst', staleTime: 60_000, refetchInterval: 60_000, retry: 2, retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000) } as const;
  const ecstCpiQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.us.cpi.level.v1', limit: 240 }, ecstArchiveOptions);
  const ecstGdpQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.us.real-gdp.qoq-annualized.v1', limit: 240 }, ecstArchiveOptions);
  const ecstPceQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.us.core-pce.level.v1', limit: 240 }, ecstArchiveOptions);
  const ecstUnemploymentQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'labor.us.unemployment.sa.v1', limit: 240 }, ecstArchiveOptions);
  const ecstPayrollQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'labor.us.nonfarm-payroll.level.sa.v1', limit: 240 }, ecstArchiveOptions);
  const ecstEaUnemploymentQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'labor.ea21.unemployment.sa.v1', limit: 240 }, ecstArchiveOptions);
  const ecstHicpQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.ea21.hicp.yoy.v1', limit: 240 }, ecstArchiveOptions);
  const ecstEaGdpQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.ea21.real-gdp.qoq.sca.v1', limit: 240 }, ecstArchiveOptions);
  const ecstJpGdpQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.jp.real-gdp.qoq-annualized.v1', limit: 240 }, ecstArchiveOptions);
  const ecstJpUnemploymentQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'labor.jp.unemployment.15-64.sa.v1', limit: 240 }, ecstArchiveOptions);
  const akshareChinaGdpQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.cn.gdp.akshare.v1', limit: 240 }, ecstArchiveOptions);
  const akshareChinaCpiQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.cn.cpi.akshare.v1', limit: 240 }, ecstArchiveOptions);
  const akshareChinaPmiQuery = trpc.freeMarketData.archivedPublicDataset.useQuery({ dataContractId: 'macro.cn.pmi.akshare.v1', limit: 240 }, ecstArchiveOptions);
  const [ecstSelected, setEcstSelected] = useState<string | null>(null);

  const findOfficial = (event: string) => {
    const candidates = event.includes('失业') ? ['BLS_LNS14000000', 'ONS_UNEMPLOYMENT_RATE_16_PLUS']
      : event.includes('非农') ? ['BLS_CES0000000001']
      : event.includes('时薪') ? ['BLS_CES0500000003']
      : event.includes('CPI') ? ['BLS_CUUR0000SA0', 'EUROSTAT_HICP_EA20', 'ONS_CPIH_ALL_ITEMS']
      : event.includes('GDP') ? ['EUROSTAT_GDP_EA20', 'ONS_GDP_MONTHLY_INDEX']
      : [];
    return candidates.map(id => officialObservations.find(observation => observation.id === id)).find(Boolean);
  };
  // 原有日历行和入口全部保留；只把数值字段交给服务端官方观察覆盖。
  // 未有一一对应的官方序列时显示空态，而不是沿用旧静态值或生成预测。
  const calendarRows = ECO_CALENDAR.map(item => {
    const observation = findOfficial(item.event);
    return observation?.status === 'available' ? {
      ...item,
      previous: observation.previousValue == null ? '—' : String(observation.previousValue),
      forecast: '—',
      actual: observation.value == null ? null : String(observation.value),
      surprise: null,
      deviation: null,
    } : { ...item, previous: '—', forecast: '—', actual: null, surprise: null, deviation: null };
  });

  const ecstLatest = (query: typeof ecstCpiQuery, mode: StatisticMode = 'rate') => {
    const history = projectStatisticHistory(query.data?.observations ?? [], mode);
    const latest = history.at(-1);
    const previous = history.at(-2);
    const numericValue = latest?.value ?? null;
    const numericPrevious = previous?.value ?? null;
    const unit = mode === 'payroll-change' ? '' : '%';
    return { value: numericValue == null ? '—' : `${numericValue.toFixed(2)}${unit}`, prev: numericPrevious == null ? '—' : `${numericPrevious.toFixed(2)}${unit}`, period: latest ? String(latest.date) : '—', trend: numericValue != null && numericPrevious != null ? (numericValue > numericPrevious ? 'up' : numericValue < numericPrevious ? 'down' : 'flat') : 'flat', history };
  };
  const akshareMacroLatest = (query: typeof akshareChinaGdpQuery, unit: 'level' | 'percent') => {
    const points = (query.data?.observations ?? []).flatMap(observation => {
      const raw = observation.payload && typeof observation.payload === 'object'
        ? (observation.payload as { value?: unknown }).value
        : null;
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
      return value === null ? [] : [{ date: String(observation.date), value, level: value, base: null as number | null }];
    }).sort((left, right) => left.date.localeCompare(right.date));
    const latest = points.at(-1);
    const previous = points.at(-2);
    const suffix = unit === 'percent' ? '%' : '';
    const format = (value: number | undefined) => value === undefined ? '—' : `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${suffix}`;
    return {
      value: format(latest?.value),
      prev: format(previous?.value),
      period: latest?.date ?? '—',
      trend: latest && previous ? (latest.value > previous.value ? 'up' : latest.value < previous.value ? 'down' : 'flat') : 'flat',
      history: points,
    };
  };
  const ecstLive = [
    { category: 'GDP与产出', indicators: [{ name: '美国GDP增速（季环比年化）', contract: ecstGdpQuery, ...ecstLatest(ecstGdpQuery, 'quarterly-rate') }, { name: '中国GDP总量（公开观察）', contract: akshareChinaGdpQuery, ...akshareMacroLatest(akshareChinaGdpQuery, 'level') }, { name: '欧元区GDP增速（季环比）', contract: ecstEaGdpQuery, ...ecstLatest(ecstEaGdpQuery, 'quarterly-rate') }, { name: '日本GDP增速（季环比年化）', contract: ecstJpGdpQuery, ...ecstLatest(ecstJpGdpQuery, 'quarterly-rate') }] },
    { category: '通胀数据', indicators: [{ name: '美国CPI（同比）', contract: ecstCpiQuery, ...ecstLatest(ecstCpiQuery, 'yoy') }, { name: '美国核心PCE（同比）', contract: ecstPceQuery, ...ecstLatest(ecstPceQuery, 'yoy') }, { name: '欧元区HICP（同比）', contract: ecstHicpQuery, ...ecstLatest(ecstHicpQuery) }, { name: '中国CPI（同比）', contract: akshareChinaCpiQuery, ...akshareMacroLatest(akshareChinaCpiQuery, 'percent') }] },
    { category: '就业数据', indicators: [{ name: '美国失业率', contract: ecstUnemploymentQuery, ...ecstLatest(ecstUnemploymentQuery) }, { name: '美国非农就业（万人）', contract: ecstPayrollQuery, ...ecstLatest(ecstPayrollQuery, 'payroll-change') }, { name: '欧元区失业率', contract: ecstEaUnemploymentQuery, ...ecstLatest(ecstEaUnemploymentQuery) }, { name: '日本失业率', contract: ecstJpUnemploymentQuery, ...ecstLatest(ecstJpUnemploymentQuery) }] },
    { category: '景气数据', indicators: [{ name: '中国制造业 PMI', contract: akshareChinaPmiQuery, ...akshareMacroLatest(akshareChinaPmiQuery, 'percent') }] },
  ];
  const ecstGdpHistory = (() => {
    const periods = new Map<string, { quarter: string; US: number | null; JP: number | null }>();
    for (const point of projectStatisticHistory(ecstGdpQuery.data?.observations ?? [], 'quarterly-rate')) periods.set(point.date, { quarter: point.date, US: point.value, JP: null });
    for (const point of projectStatisticHistory(ecstJpGdpQuery.data?.observations ?? [], 'quarterly-rate')) {
      const row = periods.get(point.date) ?? { quarter: point.date, US: null, JP: null };
      row.JP = point.value;
      periods.set(point.date, row);
    }
    return [...periods.values()].sort((a, b) => a.quarter.localeCompare(b.quarter)).slice(-40);
  })();
  const ecstDetail = ecstLive.flatMap(group => group.indicators).find(item => item.name === ecstSelected);
  const ecstEaGdpAnalysis = ecstDetail?.name === '欧元区GDP增速（季环比）' && 'history' in ecstDetail
    ? summarizeQuarterlyGrowth(ecstDetail.history)
    : null;
  const ecstJpGdpAnalysis = ecstDetail?.name === '日本GDP增速（季环比年化）' && 'history' in ecstDetail
    ? summarizeAnnualizedQuarterlyGrowth(ecstDetail.history)
    : null;
  const ecstJpUnemploymentAnalysis = ecstDetail?.name === '日本失业率' && 'history' in ecstDetail
    ? summarizeMonthlyRate(ecstDetail.history)
    : null;
  const ecstQueries = [ecstCpiQuery, ecstGdpQuery, ecstPceQuery, ecstUnemploymentQuery, ecstPayrollQuery, ecstEaUnemploymentQuery, ecstHicpQuery, ecstEaGdpQuery, ecstJpGdpQuery, ecstJpUnemploymentQuery, akshareChinaGdpQuery, akshareChinaCpiQuery, akshareChinaPmiQuery];

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, [search]);

  const filteredEco = calendarRows.filter(item => {
    if (ecoFilter === 'high') return item.importance === 'high';
    if (ecoFilter === 'pending') return !item.actual;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>

        {/* ══ ECO - 经济日历：时间轴 + 历史偏差热力图 ══ */}
        <TabsContent value="eco"><EconCalendar /></TabsContent>

        {/* ══ ECST - 统计数据：多国GDP柱状图 + 分类指标列表 ══ */}
        <TabsContent value="ecst" className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>已发布统计数据 · 非实时行情{ecstQueries.some(query => query.isError) ? ' · 存档读取失败，等待重试' : ecstQueries.some(query => query.isFetching) ? ' · 正在读取存档' : ''}</span>
            <Button size="sm" variant="outline" title="刷新" aria-label="刷新" disabled={ecstQueries.some(query => query.isFetching)} onClick={() => { for (const query of ecstQueries) void query.refetch(); }}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-400 mb-3">多国GDP增速对比（季环比年化，%）</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ecstGdpHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="quarter" tick={{ fill: '#6b7280', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="US" name="美国" fill="#3b82f6" />
                  <Bar dataKey="CN" name="中国" fill="#ef4444" />
                  <Bar dataKey="EU" name="欧元区" fill="#f59e0b" />
                  <Bar dataKey="JP" name="日本" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
              <div className="text-xs text-gray-500">美国 / 日本：季环比年化；中国未接入，欧元区为非年化季环比，因此不混入本图</div>
            </div>
            <div className="space-y-3">
              {ecstLive.map((cat, ci) => (
                <div key={ci} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-800/60 text-xs font-medium text-gray-400">{cat.category}</div>
                  {cat.indicators.map((ind, ii) => (
                    <div key={ii} className="flex items-center justify-between px-4 py-2 border-t border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                      role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setEcstSelected(ind.name); } }}
                      onClick={() => setEcstSelected(ind.name)}>
                      <span className="text-xs text-gray-400 flex-1">{ind.name}</span>
                      <span className="text-xs text-gray-500 mr-3">{ind.period}</span>
                      <span className={cn('text-xs font-bold', ind.trend === 'up' ? 'text-green-400' : ind.trend === 'down' ? 'text-red-400' : 'text-gray-300')}>
                        {ind.value} {ind.trend === 'up' ? '▲' : ind.trend === 'down' ? '▼' : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <Dialog open={ecstSelected !== null} onOpenChange={open => { if (!open) setEcstSelected(null); }}>
            <DialogContent className="ecst-statistic-dialog sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-950 border-gray-800 text-gray-100">
              <DialogHeader><DialogTitle>{ecstDetail?.name}</DialogTitle><DialogDescription>统计历史 · 观察期与存档记录</DialogDescription></DialogHeader>
              {ecstDetail && 'history' in ecstDetail && ecstDetail.history?.length ? <>
                <div className="text-xs text-gray-400">本期 {ecstDetail.value} · 前值 {ecstDetail.prev} · 观察期 {ecstDetail.period}</div>
                <div className="text-xs text-gray-500">{ecstDetail.history.length} 期历史 · 数据状态 {ecstDetail.contract?.data?.available ? '可用' : '暂未更新'} · 时效以观察期为准</div>
                {ecstDetail.name.startsWith('欧元区') && <div className="text-xs text-gray-500">欧元区 21 国当前构成 · 以观察期为准</div>}
                {ecstDetail.name === '日本GDP增速（季环比年化）' && <div className="text-xs text-gray-500">日本实际 GDP 季环比复利年化 · 以观察期为准</div>}
                {ecstDetail.name === '日本失业率' && <div className="text-xs text-gray-500">日本 15—64 岁全体季调协调失业率 · 以观察期为准</div>}
                {ecstEaGdpAnalysis && <div className="space-y-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">本期动能</div><div className="text-sm font-semibold">{ecstEaGdpAnalysis.momentumPp == null ? '—' : `${ecstEaGdpAnalysis.momentumPp >= 0 ? '+' : ''}${ecstEaGdpAnalysis.momentumPp.toFixed(2)} pp`}</div><div className="text-[10px] text-gray-600">较前季</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">近4季复合增速</div><div className="text-sm font-semibold">{ecstEaGdpAnalysis.trailing4Compound == null ? '—' : `${ecstEaGdpAnalysis.trailing4Compound.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">季度链式计算</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">近4季扩张</div><div className="text-sm font-semibold">{ecstEaGdpAnalysis.positiveQuarters == null ? '—' : `${ecstEaGdpAnalysis.positiveQuarters}/4`}</div><div className="text-[10px] text-gray-600">正增长季度</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">近4季区间</div><div className="text-sm font-semibold">{ecstEaGdpAnalysis.rangeLow == null || ecstEaGdpAnalysis.rangeHigh == null ? '—' : `${ecstEaGdpAnalysis.rangeLow.toFixed(2)}% — ${ecstEaGdpAnalysis.rangeHigh.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">实际发布值</div></div>
                  </div>
                  <div className="text-[10px] text-gray-600">基于已保存季度观察的终端计算 · 不是预测或交易建议</div>
                </div>}
                {ecstJpGdpAnalysis && <div className="space-y-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">本期年化</div><div className="text-sm font-semibold">{ecstJpGdpAnalysis.latest == null ? '—' : `${ecstJpGdpAnalysis.latest.value.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">季环比复利四次</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">本期季环比</div><div className="text-sm font-semibold">{ecstJpGdpAnalysis.latestQuarterlyEquivalent == null ? '—' : `${ecstJpGdpAnalysis.latestQuarterlyEquivalent.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">由年化率还原</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">近4季实际增速</div><div className="text-sm font-semibold">{ecstJpGdpAnalysis.trailing4ActualGrowth == null ? '—' : `${ecstJpGdpAnalysis.trailing4ActualGrowth.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">连续季度链式计算</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">近4季扩张</div><div className="text-sm font-semibold">{ecstJpGdpAnalysis.positiveQuarters == null ? '—' : `${ecstJpGdpAnalysis.positiveQuarters}/4`}</div><div className="text-[10px] text-gray-600">正增长季度</div></div>
                  </div>
                  <div className="text-[10px] text-gray-600">基于连续真实季度观察的终端计算 · 不跨口径补值</div>
                </div>}
                {ecstJpUnemploymentAnalysis && <div className="space-y-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">当前失业率</div><div className="text-sm font-semibold">{ecstJpUnemploymentAnalysis.latest == null ? '—' : `${ecstJpUnemploymentAnalysis.latest.value.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">最新观察期</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">3月均值</div><div className="text-sm font-semibold">{ecstJpUnemploymentAnalysis.average3m == null ? '—' : `${ecstJpUnemploymentAnalysis.average3m.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">连续月度平均</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">12月变化</div><div className="text-sm font-semibold">{ecstJpUnemploymentAnalysis.change12mPp == null ? '—' : `${ecstJpUnemploymentAnalysis.change12mPp >= 0 ? '+' : ''}${ecstJpUnemploymentAnalysis.change12mPp.toFixed(2)} pp`}</div><div className="text-[10px] text-gray-600">同月差值</div></div>
                    <div className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[10px] text-gray-500">12月区间</div><div className="text-sm font-semibold">{ecstJpUnemploymentAnalysis.range12mLow == null || ecstJpUnemploymentAnalysis.range12mHigh == null ? '—' : `${ecstJpUnemploymentAnalysis.range12mLow.toFixed(2)}% — ${ecstJpUnemploymentAnalysis.range12mHigh.toFixed(2)}%`}</div><div className="text-[10px] text-gray-600">实际月度观察</div></div>
                  </div>
                  <div className="text-[10px] text-gray-600">基于连续月度观察的终端计算 · 不跨口径补值</div>
                </div>}
                <div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={ecstDetail.history}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} domain={['auto','auto']} /><Tooltip /><Line dataKey="value" name={ecstDetail.name} stroke="#10b981" dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div>
                <div className="max-h-64 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-gray-400"><th className="text-left">观察期</th><th className="text-right">指标值</th><th className="text-right">原始观察</th><th className="text-right">计算基期</th></tr></thead><tbody>{[...ecstDetail.history].reverse().map(row => <tr key={row.date} className="border-t border-gray-800"><td className="py-2">{row.date}</td><td className="text-right">{row.value == null ? '—' : row.value.toFixed(2)}</td><td className="text-right">{row.level}</td><td className="text-right">{row.base ?? '—'}</td></tr>)}</tbody></table></div>
              </> : <div className="py-12 text-center text-gray-500">{ecstDetail?.contract?.isFetching ? '正在读取存档' : ecstDetail?.contract?.isError ? '存档读取失败，等待重试' : '未接入 / 暂无可用历史'}</div>}
            </DialogContent>
          </Dialog>
          <div className="mt-4 border-t border-slate-800 pt-3"><EcstLive /></div>
        </TabsContent>

        <TabsContent value="ectr"><ECTRTab /></TabsContent>
        <TabsContent value="wfii"><WFIITab /></TabsContent>

        {/* ══ ECWB - 经济工作台：迷你走势图 + 相关性矩阵 ══ */}
        <TabsContent value="ecwb"><EcwbLive /></TabsContent>

        <TabsContent value="rsan"><RSANTab /></TabsContent>

        {/* ══ ECOB - 关键指标：信号灯系统（独特：交通灯 + 进度条）══ */}
        <TabsContent value="ecob"><EcobLive /></TabsContent>

        <TabsContent value="ecfc"><ECFCTab /></TabsContent>

        {/* ══ SHOK - 预测模型：情景选择器 + 路径图（独特：左情景树 + 右路径）══ */}
        <TabsContent value="shok"><ShokLive /></TabsContent>

        <TabsContent value="wirp"><WIRPTab /></TabsContent>
        <TabsContent value="fcon"><FCONTab /></TabsContent>
        <TabsContent value="ecsu"><ECSUTab /></TabsContent>
        <TabsContent value="tayl"><TAYLTab /></TabsContent>
        <TabsContent value="ecan"><ECANTab /></TabsContent>

        {/* ══ MOSP - 预测市场：双向概率条（独特：市场深度布局）══ */}
        <TabsContent value="mosp"><MospLive /></TabsContent>

        <TabsContent value="cenb"><CENBTab /></TabsContent>
        <TabsContent value="cbrt"><WcrsLive /></TabsContent>

        {/* ══ FOMC - 联储会议：点阵图可视化 + 鹰鸽评分时间轴（独特）══ */}
        

        {/* ══ FOMS - FOMC声明：文本分析 + 鹰鸽词频双向条（独特）══ */}
        <TabsContent value="foms"><FomsLive /></TabsContent>

        <TabsContent value="fdsp"><FOECTab /></TabsContent>

        {/* ══ BE - 经济新闻：情感标签 + 市场影响分类（独特：情感分析布局）══ */}
        

        {/* ══ BECO - 彭博经济：全球增长折线 + 周期雷达（独特：双图布局）══ */}
        

        {/* ══ BIE - 国家报告：GDP vs 通胀散点图 + 评分卡（独特：散点矩阵）══ */}
        

        <TabsContent value="pmi"><PMITab /></TabsContent>
      </Tabs>
    </div>
  );
}
