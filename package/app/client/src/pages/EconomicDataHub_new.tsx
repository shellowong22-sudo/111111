/**
 * EconomicDataHub - 经济数据及分析中心
 * 覆盖所有 29 个经济分析模块：ECO/ECST/ECTR/WFII/ECWB/RSAN/ECOB/ECFC/SHOK/WIRP/FCON/ECSU/TAYL/ECAN/MOSP/CENB/CBRT/FOMC/FOMS/FDSP/BE/BECO/BIE/PMI
 */
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  Legend, Cell, ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie,
} from 'recharts';
import {
  Calendar, TrendingUp, TrendingDown, AlertCircle, Globe, Activity, Target,
  Search, Filter, Download, RefreshCw, ChevronRight, ChevronDown, Info,
  AlertTriangle, CheckCircle, ArrowUp, ArrowDown, Minus, Building2, Zap,
  BarChart2, Map, Newspaper, BookOpen, Settings, Bell, Eye, Layers,
  DollarSign, Percent, Clock, Flag, Shield, Cpu, Database, Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// 共享数据
// ─────────────────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'US', name: '美国', flag: '🇺🇸', gdp: 27.36, rate: 5.25, inflation: 3.2, pmi: 52.1 },
  { code: 'CN', name: '中国', flag: '🇨🇳', gdp: 17.79, rate: 3.45, inflation: 0.1, pmi: 50.8 },
  { code: 'EU', name: '欧元区', flag: '🇪🇺', gdp: 15.81, rate: 4.50, inflation: 2.6, pmi: 47.2 },
  { code: 'JP', name: '日本', flag: '🇯🇵', gdp: 4.21, rate: 0.10, inflation: 2.8, pmi: 49.6 },
  { code: 'GB', name: '英国', flag: '🇬🇧', gdp: 3.07, rate: 5.25, inflation: 4.0, pmi: 48.5 },
  { code: 'DE', name: '德国', flag: '🇩🇪', gdp: 4.46, rate: 4.50, inflation: 2.3, pmi: 45.4 },
  { code: 'IN', name: '印度', flag: '🇮🇳', gdp: 3.73, rate: 6.50, inflation: 5.1, pmi: 58.8 },
  { code: 'BR', name: '巴西', flag: '🇧🇷', gdp: 2.13, rate: 10.50, inflation: 4.6, pmi: 54.2 },
];

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const genMonthlyData = (base: number, volatility: number, trend: number = 0) =>
  MONTHS.map((m, i) => ({
    month: m,
    value: +(base + trend * i).toFixed(2),
  }));

// ─────────────────────────────────────────────────────────────────────────────
// ECO - 经济日历
// ─────────────────────────────────────────────────────────────────────────────
const ECO_EVENTS = [
  { date: '2026-06-30', time: '08:30', country: '🇺🇸', event: '核心PCE物价指数(月率)', period: '5月', forecast: '0.2%', actual: '0.3%', prev: '0.2%', impact: 'high', surprise: 0.1 },
  { date: '2026-06-30', time: '10:00', country: '🇺🇸', event: '密歇根大学消费者信心终值', period: '6月', forecast: '65.8', actual: '68.2', prev: '69.1', impact: 'medium', surprise: 2.4 },
  { date: '2026-07-01', time: '09:45', country: '🇺🇸', event: 'Markit制造业PMI终值', period: '6月', forecast: '51.0', actual: '-', prev: '51.3', impact: 'medium', surprise: 0 },
  { date: '2026-07-01', time: '10:00', country: '🇺🇸', event: 'ISM制造业PMI', period: '6月', forecast: '48.8', actual: '-', prev: '48.7', impact: 'high', surprise: 0 },
  { date: '2026-07-02', time: '08:15', country: '🇺🇸', event: 'ADP非农就业人数', period: '6月', forecast: '160K', actual: '-', prev: '152K', impact: 'high', surprise: 0 },
  { date: '2026-07-03', time: '08:30', country: '🇺🇸', event: '非农就业人数', period: '6月', forecast: '185K', actual: '-', prev: '272K', impact: 'high', surprise: 0 },
  { date: '2026-07-03', time: '08:30', country: '🇺🇸', event: '失业率', period: '6月', forecast: '4.0%', actual: '-', prev: '4.0%', impact: 'high', surprise: 0 },
  { date: '2026-07-04', time: '全天', country: '🇺🇸', event: '独立日（美国市场休市）', period: '-', forecast: '-', actual: '-', prev: '-', impact: 'low', surprise: 0 },
  { date: '2026-07-08', time: '10:00', country: '🇺🇸', event: 'JOLTS职位空缺', period: '5月', forecast: '8.1M', actual: '-', prev: '8.06M', impact: 'medium', surprise: 0 },
  { date: '2026-07-10', time: '08:30', country: '🇺🇸', event: 'CPI(月率)', period: '6月', forecast: '0.1%', actual: '-', prev: '0.0%', impact: 'high', surprise: 0 },
  { date: '2026-07-10', time: '08:30', country: '🇺🇸', event: '核心CPI(年率)', period: '6月', forecast: '3.4%', actual: '-', prev: '3.4%', impact: 'high', surprise: 0 },
  { date: '2026-07-11', time: '08:30', country: '🇺🇸', event: 'PPI(月率)', period: '6月', forecast: '0.1%', actual: '-', prev: '-0.2%', impact: 'medium', surprise: 0 },
  { date: '2026-07-15', time: '08:30', country: '🇺🇸', event: '零售销售(月率)', period: '6月', forecast: '0.3%', actual: '-', prev: '0.1%', impact: 'high', surprise: 0 },
  { date: '2026-07-16', time: '14:00', country: '🇨🇳', event: 'GDP(年率)', period: 'Q2', forecast: '5.1%', actual: '-', prev: '5.3%', impact: 'high', surprise: 0 },
  { date: '2026-07-17', time: '08:30', country: '🇺🇸', event: '初请失业金人数', period: '7月12日当周', forecast: '235K', actual: '-', prev: '227K', impact: 'medium', surprise: 0 },
  { date: '2026-07-25', time: '08:30', country: '🇺🇸', event: 'GDP(季率初值)', period: 'Q2', forecast: '2.1%', actual: '-', prev: '1.4%', impact: 'high', surprise: 0 },
  { date: '2026-07-30', time: '14:00', country: '🇪🇺', event: '欧元区CPI(年率)', period: '7月', forecast: '2.4%', actual: '-', prev: '2.6%', impact: 'high', surprise: 0 },
  { date: '2026-07-30', time: '19:00', country: '🇺🇸', event: 'FOMC利率决议', period: '7月', forecast: '5.25-5.50%', actual: '-', prev: '5.25-5.50%', impact: 'high', surprise: 0 },
];

const SURPRISE_HISTORY = [
  { month: '1月', us: 0.8, eu: -0.3, cn: 0.5, jp: -0.2 },
  { month: '2月', us: 1.2, eu: 0.1, cn: -0.4, jp: 0.3 },
  { month: '3月', us: -0.5, eu: 0.6, cn: 0.8, jp: -0.6 },
  { month: '4月', us: 0.3, eu: -0.8, cn: 1.1, jp: 0.4 },
  { month: '5月', us: 1.5, eu: 0.4, cn: -0.2, jp: -0.3 },
  { month: '6月', us: 0.9, eu: 0.2, cn: 0.6, jp: 0.7 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ECST - 世界经济统计数据
// ─────────────────────────────────────────────────────────────────────────────
const ECST_INDICATORS = [
  { code: 'GDP', name: 'GDP增速(年率)', unit: '%', us: 2.9, cn: 5.3, eu: 0.4, jp: -0.2, gb: 0.3, de: -0.3, category: '增长' },
  { code: 'CPI', name: '通货膨胀率(CPI)', unit: '%', us: 3.2, cn: 0.1, eu: 2.6, jp: 2.8, gb: 4.0, de: 2.3, category: '通胀' },
  { code: 'UNEMP', name: '失业率', unit: '%', us: 4.0, cn: 5.1, eu: 6.2, jp: 2.6, gb: 4.4, de: 5.9, category: '就业' },
  { code: 'RATE', name: '基准利率', unit: '%', us: 5.25, cn: 3.45, eu: 4.50, jp: 0.10, gb: 5.25, de: 4.50, category: '货币政策' },
  { code: 'CA', name: '经常账户(占GDP%)', unit: '%', us: -3.1, cn: 1.5, eu: 2.8, jp: 3.5, gb: -3.8, de: 6.2, category: '外部' },
  { code: 'DEBT', name: '政府债务(占GDP%)', unit: '%', us: 123.4, cn: 77.1, eu: 88.6, jp: 255.2, gb: 100.1, de: 63.6, category: '财政' },
  { code: 'PMI_MFG', name: '制造业PMI', unit: '', us: 51.3, cn: 50.8, eu: 47.2, jp: 49.6, gb: 48.5, de: 45.4, category: '景气' },
  { code: 'PMI_SVC', name: '服务业PMI', unit: '', us: 55.1, cn: 54.2, eu: 53.3, jp: 53.8, gb: 52.9, de: 54.2, category: '景气' },
  { code: 'RETAIL', name: '零售销售(月率)', unit: '%', us: 0.1, cn: 3.7, eu: 0.3, jp: -1.2, gb: -0.8, de: 0.2, category: '消费' },
  { code: 'IP', name: '工业生产(年率)', unit: '%', us: 0.4, cn: 6.7, eu: -3.2, jp: -1.8, gb: -0.6, de: -4.1, category: '生产' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ECTR - 贸易流量
// ─────────────────────────────────────────────────────────────────────────────
const TRADE_PARTNERS = [
  { country: '中国', exports: 148.2, imports: 427.2, balance: -279.0, share: 14.8, trend: 'up' },
  { country: '欧盟', exports: 352.1, imports: 553.4, balance: -201.3, share: 18.2, trend: 'stable' },
  { country: '加拿大', exports: 355.2, imports: 421.1, balance: -65.9, share: 14.1, trend: 'stable' },
  { country: '墨西哥', exports: 323.4, imports: 475.6, balance: -152.2, share: 15.8, trend: 'up' },
  { country: '日本', exports: 75.3, imports: 148.1, balance: -72.8, share: 5.2, trend: 'down' },
  { country: '韩国', exports: 65.2, imports: 112.3, balance: -47.1, share: 3.8, trend: 'stable' },
  { country: '德国', exports: 68.4, imports: 162.3, balance: -93.9, share: 4.8, trend: 'down' },
  { country: '英国', exports: 71.2, imports: 58.3, balance: 12.9, share: 3.2, trend: 'stable' },
];

const SHIPPING_DATA = [
  { month: '1月', bdi: 1842, scfi: 1523, ccfi: 987 },
  { month: '2月', bdi: 1956, scfi: 1687, ccfi: 1045 },
  { month: '3月', bdi: 2134, scfi: 1834, ccfi: 1123 },
  { month: '4月', bdi: 1987, scfi: 1756, ccfi: 1089 },
  { month: '5月', bdi: 2256, scfi: 1923, ccfi: 1234 },
  { month: '6月', bdi: 2089, scfi: 1845, ccfi: 1178 },
];

// ─────────────────────────────────────────────────────────────────────────────
// WIRP - 利率概率
// ─────────────────────────────────────────────────────────────────────────────
const WIRP_MEETINGS = [
  { date: '2026-07-30', label: '7月FOMC', hold: 92.3, cut25: 7.7, cut50: 0.0, hike25: 0.0 },
  { date: '2026-09-17', label: '9月FOMC', hold: 58.4, cut25: 38.2, cut50: 3.4, hike25: 0.0 },
  { date: '2026-11-05', label: '11月FOMC', hold: 31.2, cut25: 49.8, cut50: 18.1, hike25: 0.9 },
  { date: '2026-12-16', label: '12月FOMC', hold: 18.7, cut25: 42.3, cut50: 32.6, hike25: 6.4 },
  { date: '2027-01-28', label: '1月FOMC', hold: 12.1, cut25: 38.4, cut50: 38.2, hike25: 11.3 },
  { date: '2027-03-18', label: '3月FOMC', hold: 8.4, cut25: 32.1, cut50: 41.3, hike25: 18.2 },
];

const RATE_PATH = [
  { date: '当前', market: 5.375, fed_median: 5.375, ois: 5.38 },
  { date: 'Q3 2026', market: 5.25, fed_median: 5.375, ois: 5.21 },
  { date: 'Q4 2026', market: 4.875, fed_median: 5.125, ois: 4.82 },
  { date: 'Q1 2027', market: 4.50, fed_median: 4.875, ois: 4.45 },
  { date: 'Q2 2027', market: 4.125, fed_median: 4.625, ois: 4.08 },
  { date: 'Q3 2027', market: 3.875, fed_median: 4.375, ois: 3.82 },
  { date: 'Q4 2027', market: 3.625, fed_median: 4.125, ois: 3.58 },
  { date: 'Q1 2028', market: 3.375, fed_median: 3.875, ois: 3.32 },
];

// ─────────────────────────────────────────────────────────────────────────────
// TAYL - 泰勒规则
// ─────────────────────────────────────────────────────────────────────────────
const TAYL_HISTORY = [
  { year: '2020', actual: 0.25, taylor: -1.8, balanced: -0.9 },
  { year: '2021', actual: 0.25, taylor: 2.1, balanced: 1.2 },
  { year: '2022', actual: 2.50, taylor: 7.8, balanced: 6.2 },
  { year: '2023', actual: 5.00, taylor: 6.9, balanced: 5.8 },
  { year: '2024', actual: 5.25, taylor: 5.4, balanced: 4.9 },
  { year: '2025', actual: 5.25, taylor: 4.8, balanced: 4.3 },
  { year: '2026', actual: 5.25, taylor: 4.2, balanced: 3.9 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ECFC - 经济预测
// ─────────────────────────────────────────────────────────────────────────────
const FORECAST_DATA = [
  { institution: 'IMF', gdp26: 2.7, gdp27: 2.2, cpi26: 2.9, cpi27: 2.3, rate26: 4.75, rate27: 3.75, updated: '2026-04' },
  { institution: 'World Bank', gdp26: 2.5, gdp27: 2.1, cpi26: 3.0, cpi27: 2.4, rate26: 4.50, rate27: 3.50, updated: '2026-06' },
  { institution: 'OECD', gdp26: 2.6, gdp27: 2.3, cpi26: 2.8, cpi27: 2.2, rate26: 4.75, rate27: 3.75, updated: '2026-05' },
  { institution: 'Goldman Sachs', gdp26: 2.8, gdp27: 2.4, cpi26: 2.7, cpi27: 2.1, rate26: 4.50, rate27: 3.25, updated: '2026-06' },
  { institution: 'JP Morgan', gdp26: 2.4, gdp27: 2.0, cpi26: 3.1, cpi27: 2.5, rate26: 5.00, rate27: 4.00, updated: '2026-06' },
  { institution: 'Morgan Stanley', gdp26: 2.6, gdp27: 2.2, cpi26: 2.9, cpi27: 2.3, rate26: 4.75, rate27: 3.50, updated: '2026-06' },
  { institution: 'Citi', gdp26: 2.3, gdp27: 1.9, cpi26: 3.2, cpi27: 2.6, rate26: 5.00, rate27: 4.25, updated: '2026-06' },
  { institution: 'BofA', gdp26: 2.5, gdp27: 2.1, cpi26: 2.8, cpi27: 2.2, rate26: 4.75, rate27: 3.75, updated: '2026-06' },
  { institution: 'UBS', gdp26: 2.7, gdp27: 2.3, cpi26: 2.7, cpi27: 2.0, rate26: 4.50, rate27: 3.25, updated: '2026-05' },
  { institution: 'Barclays', gdp26: 2.4, gdp27: 2.0, cpi26: 3.0, cpi27: 2.4, rate26: 4.75, rate27: 3.75, updated: '2026-06' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FCON - 金融条件指数
// ─────────────────────────────────────────────────────────────────────────────
const FCON_DATA = [
  { month: '1月', us_fci: -0.42, eu_fci: -0.18, cn_fci: 0.12, global_fci: -0.28 },
  { month: '2月', us_fci: -0.31, eu_fci: -0.08, cn_fci: 0.08, global_fci: -0.19 },
  { month: '3月', us_fci: -0.18, eu_fci: 0.04, cn_fci: -0.02, global_fci: -0.08 },
  { month: '4月', us_fci: 0.12, eu_fci: 0.21, cn_fci: -0.15, global_fci: 0.08 },
  { month: '5月', us_fci: 0.28, eu_fci: 0.35, cn_fci: -0.22, global_fci: 0.18 },
  { month: '6月', us_fci: 0.15, eu_fci: 0.28, cn_fci: -0.18, global_fci: 0.12 },
];

const FCON_COMPONENTS = [
  { name: '短期利率', contribution: 0.45, direction: 'tightening' },
  { name: '长期利率', contribution: 0.28, direction: 'tightening' },
  { name: '信用利差', contribution: 0.12, direction: 'tightening' },
  { name: '股票估值', contribution: -0.18, direction: 'easing' },
  { name: '汇率', contribution: -0.08, direction: 'easing' },
  { name: '银行贷款标准', contribution: 0.22, direction: 'tightening' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CBRT - 央行利率
// ─────────────────────────────────────────────────────────────────────────────
const CBRT_DATA = [
  { bank: '美联储', country: '🇺🇸', rate: 5.25, lastChange: '-25bp', lastDate: '2024-09', nextMeeting: '2026-07-30', bias: 'dovish', cycle: 'pause' },
  { bank: '欧央行', country: '🇪🇺', rate: 4.50, lastChange: '-25bp', lastDate: '2024-06', nextMeeting: '2026-07-18', bias: 'dovish', cycle: 'cutting' },
  { bank: '英格兰银行', country: '🇬🇧', rate: 5.25, lastChange: '-25bp', lastDate: '2024-08', nextMeeting: '2026-08-07', bias: 'neutral', cycle: 'pause' },
  { bank: '日本央行', country: '🇯🇵', rate: 0.10, lastChange: '+10bp', lastDate: '2024-03', nextMeeting: '2026-07-31', bias: 'hawkish', cycle: 'hiking' },
  { bank: '中国人民银行', country: '🇨🇳', rate: 3.45, lastChange: '-10bp', lastDate: '2024-07', nextMeeting: '2026-08-15', bias: 'dovish', cycle: 'cutting' },
  { bank: '澳大利亚央行', country: '🇦🇺', rate: 4.35, lastChange: '+25bp', lastDate: '2023-11', nextMeeting: '2026-08-05', bias: 'neutral', cycle: 'pause' },
  { bank: '加拿大央行', country: '🇨🇦', rate: 4.75, lastChange: '-25bp', lastDate: '2024-06', nextMeeting: '2026-07-24', bias: 'dovish', cycle: 'cutting' },
  { bank: '瑞士央行', country: '🇨🇭', rate: 1.50, lastChange: '-25bp', lastDate: '2024-03', nextMeeting: '2026-09-25', bias: 'dovish', cycle: 'cutting' },
  { bank: '瑞典央行', country: '🇸🇪', rate: 3.75, lastChange: '-25bp', lastDate: '2024-05', nextMeeting: '2026-08-20', bias: 'dovish', cycle: 'cutting' },
  { bank: '挪威央行', country: '🇳🇴', rate: 4.50, lastChange: '0bp', lastDate: '2024-03', nextMeeting: '2026-08-14', bias: 'neutral', cycle: 'pause' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FOMC - 点阵图数据
// ─────────────────────────────────────────────────────────────────────────────
const DOT_PLOT = [
  { year: '2026', dots: [5.375, 5.375, 5.375, 5.375, 5.125, 5.125, 5.125, 5.125, 4.875, 4.875, 4.875, 4.625, 4.625, 4.375, 4.375, 4.125, 4.125, 4.125, 3.875] },
  { year: '2027', dots: [4.875, 4.625, 4.625, 4.375, 4.375, 4.375, 4.125, 4.125, 3.875, 3.875, 3.875, 3.625, 3.625, 3.375, 3.375, 3.125, 3.125, 2.875, 2.875] },
  { year: '2028', dots: [3.875, 3.625, 3.375, 3.375, 3.125, 3.125, 2.875, 2.875, 2.875, 2.625, 2.625, 2.625, 2.375, 2.375, 2.375, 2.125, 2.125, 2.125, 2.125] },
  { year: '长期', dots: [2.875, 2.875, 2.875, 2.875, 2.875, 2.625, 2.625, 2.625, 2.625, 2.625, 2.625, 2.625, 2.625, 2.375, 2.375, 2.375, 2.375, 2.375, 2.375] },
];

// ─────────────────────────────────────────────────────────────────────────────
// PMI - 全球PMI
// ─────────────────────────────────────────────────────────────────────────────
const PMI_GLOBAL = [
  { country: '美国', flag: '🇺🇸', mfg: 51.3, svc: 55.1, comp: 54.6, prev_mfg: 51.0, trend: 'up' },
  { country: '中国', flag: '🇨🇳', mfg: 50.8, svc: 54.2, comp: 53.1, prev_mfg: 50.4, trend: 'up' },
  { country: '欧元区', flag: '🇪🇺', mfg: 47.2, svc: 53.3, comp: 51.0, prev_mfg: 47.8, trend: 'down' },
  { country: '英国', flag: '🇬🇧', mfg: 48.5, svc: 52.9, comp: 52.3, prev_mfg: 49.1, trend: 'down' },
  { country: '日本', flag: '🇯🇵', mfg: 49.6, svc: 53.8, comp: 52.6, prev_mfg: 50.3, trend: 'down' },
  { country: '德国', flag: '🇩🇪', mfg: 45.4, svc: 54.2, comp: 51.2, prev_mfg: 45.8, trend: 'up' },
  { country: '印度', flag: '🇮🇳', mfg: 58.8, svc: 60.2, comp: 60.5, prev_mfg: 58.5, trend: 'up' },
  { country: '巴西', flag: '🇧🇷', mfg: 54.2, svc: 55.8, comp: 55.3, prev_mfg: 53.6, trend: 'up' },
  { country: '韩国', flag: '🇰🇷', mfg: 51.2, svc: 52.4, comp: 52.1, prev_mfg: 50.8, trend: 'up' },
  { country: '澳大利亚', flag: '🇦🇺', mfg: 47.8, svc: 52.1, comp: 51.3, prev_mfg: 48.2, trend: 'up' },
];

const PMI_HISTORY = MONTHS.map((m, i) => ({
  month: m,
  us: 50 + Math.sin(i * 0.5) * 2.5 + 1.3,
  cn: 50 + Math.cos(i * 0.4) * 2.0 + 0.8,
  eu: 48 + Math.sin(i * 0.6) * 1.8 - 0.5,
  global: 51 + Math.sin(i * 0.3) * 1.5 + 0.5,
}));

// ─────────────────────────────────────────────────────────────────────────────
// RSAN - 地缘政治风险
// ─────────────────────────────────────────────────────────────────────────────
const GEOPOLITICAL_RISKS = [
  { region: '俄乌冲突', risk: 82, impact: '能源、粮食、军工', status: '持续', trend: 'stable', sanctions: 14 },
  { region: '中东局势', risk: 74, impact: '原油、LNG、航运', status: '升级', trend: 'up', sanctions: 3 },
  { region: '台海紧张', risk: 58, impact: '半导体、电子、航运', status: '高度关注', trend: 'up', sanctions: 0 },
  { region: '美中贸易战', risk: 65, impact: '科技、制造、农业', status: '持续', trend: 'stable', sanctions: 8 },
  { region: '北非动荡', risk: 42, impact: '石油、移民、粮食', status: '局部', trend: 'down', sanctions: 2 },
  { region: '朝鲜半岛', risk: 38, impact: '防务、半导体', status: '监控', trend: 'stable', sanctions: 6 },
];

const COMMODITY_IMPACT = [
  { commodity: '天然气(欧洲)', current: 38.2, pre_war: 22.1, change: 72.9, unit: 'EUR/MWh' },
  { commodity: '小麦', current: 5.82, pre_war: 7.74, change: -24.8, unit: 'USD/蒲式耳' },
  { commodity: '玉米', current: 4.35, pre_war: 7.52, change: -42.2, unit: 'USD/蒲式耳' },
  { commodity: '铝', current: 2456, pre_war: 3380, change: -27.3, unit: 'USD/吨' },
  { commodity: '钯金', current: 1023, pre_war: 2278, change: -55.1, unit: 'USD/盎司' },
  { commodity: '乌拉尔原油', current: 62.4, pre_war: 78.2, change: -20.2, unit: 'USD/桶' },
];

// ─────────────────────────────────────────────────────────────────────────────
// WFII - 外国投资组合投资
// ─────────────────────────────────────────────────────────────────────────────
const FPI_FLOWS = [
  { month: '1月', equity_in: 45.2, equity_out: -32.1, bond_in: 28.4, bond_out: -18.6, net: 22.9 },
  { month: '2月', equity_in: 38.7, equity_out: -41.2, bond_in: 31.2, bond_out: -22.4, net: 6.3 },
  { month: '3月', equity_in: 52.3, equity_out: -28.9, bond_in: 24.8, bond_out: -19.1, net: 29.1 },
  { month: '4月', equity_in: 41.8, equity_out: -35.6, bond_in: 18.3, bond_out: -25.7, net: -1.2 },
  { month: '5月', equity_in: 63.4, equity_out: -22.3, bond_in: 35.6, bond_out: -14.2, net: 62.5 },
  { month: '6月', equity_in: 48.9, equity_out: -31.4, bond_in: 29.7, bond_out: -20.8, net: 26.4 },
];

const FPI_BY_COUNTRY = [
  { country: '美国', equity: 2845.2, bond: 1234.6, total: 4079.8, change: 8.4 },
  { country: '欧元区', equity: 1234.5, bond: 987.3, total: 2221.8, change: -2.1 },
  { country: '日本', equity: 456.8, bond: 1567.2, total: 2024.0, change: 3.8 },
  { country: '英国', equity: 678.9, bond: 432.1, total: 1111.0, change: -1.4 },
  { country: '中国', equity: 345.6, bond: 234.5, total: 580.1, change: -5.2 },
  { country: '新兴市场', equity: 892.3, bond: 567.8, total: 1460.1, change: 4.7 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ECSU - 经济意外指数
// ─────────────────────────────────────────────────────────────────────────────
const SURPRISE_INDEX = [
  { month: '1月', us: 42.3, eu: -18.4, cn: 28.6, em: 15.2 },
  { month: '2月', us: 58.7, eu: -8.2, cn: -12.4, em: 22.8 },
  { month: '3月', us: -22.1, eu: 34.6, cn: 45.2, em: -8.4 },
  { month: '4月', us: 15.4, eu: -42.8, cn: 62.1, em: 18.6 },
  { month: '5月', us: 72.3, eu: 18.4, cn: -8.7, em: -12.3 },
  { month: '6月', us: 38.9, eu: 8.2, cn: 28.4, em: 32.1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 市场因果链数据（共用于多个模块）
// ─────────────────────────────────────────────────────────────────────────────
const CAUSAL_CHAINS = [
  {
    trigger: '美联储加息25bp',
    chain: ['短端利率上升', '美元走强', '新兴市场资本外流', '新兴市场货币贬值', '新兴市场通胀压力上升'],
    assets: { us10y: +0.08, dxy: +0.6, em_equities: -1.2, em_fx: -0.8, gold: -0.4 },
    probability: 78,
    timeframe: '1-2周',
  },
  {
    trigger: '中国GDP低于预期',
    chain: ['大宗商品需求下降', '铁矿石/铜价下跌', '澳元/加元走弱', '资源国股市下跌', '全球贸易预期下修'],
    assets: { copper: -2.1, iron_ore: -3.4, aud: -0.9, cad: -0.6, em_equities: -0.8 },
    probability: 65,
    timeframe: '1-3天',
  },
  {
    trigger: '欧元区通胀超预期',
    chain: ['ECB加息预期上升', '欧元走强', '欧债收益率上升', '欧股承压', '全球债市联动'],
    assets: { eurusd: +0.8, bund10y: +0.12, eurostoxx: -0.9, us10y: +0.05, gbpusd: +0.3 },
    probability: 72,
    timeframe: '即时-1天',
  },
  {
    trigger: '原油价格上涨10%',
    chain: ['能源通胀上升', '交通/制造成本上升', '央行鹰派预期增强', '实际利率下降', '黄金上涨'],
    assets: { cpi: +0.3, gold: +1.8, tips: +0.4, energy_stocks: +2.1, airlines: -1.8 },
    probability: 85,
    timeframe: '2-4周',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 替代数据（共用）
// ─────────────────────────────────────────────────────────────────────────────
const ALT_DATA = {
  satellite: [
    { indicator: '全球港口吞吐量指数', value: 108.4, change: +2.3, unit: '指数', source: '卫星遥感', signal: 'bullish' },
    { indicator: '中国工厂开工率', value: 78.2, change: -1.4, unit: '%', source: '卫星遥感', signal: 'bearish' },
    { indicator: '全球航运密度', value: 124.6, change: +5.8, unit: '指数', source: 'AIS数据', signal: 'bullish' },
    { indicator: '美国零售停车场客流', value: 92.3, change: +3.1, unit: '指数', source: '卫星遥感', signal: 'bullish' },
    { indicator: '欧洲工业电力消耗', value: 87.6, change: -2.8, unit: '指数', source: '电网数据', signal: 'bearish' },
    { indicator: '中东原油装载量', value: 115.2, change: +4.2, unit: '指数', source: '卫星遥感', signal: 'bullish' },
  ],
  sentiment: [
    { source: '新闻情绪指数', score: 0.42, trend: 'improving', coverage: '全球财经媒体' },
    { source: '社交媒体热度', score: 0.28, trend: 'stable', coverage: 'Twitter/Reddit' },
    { source: '企业财报语调', score: 0.61, trend: 'improving', coverage: 'S&P500成分股' },
    { source: '分析师预期修正', score: 0.35, trend: 'declining', coverage: '卖方机构' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 辅助组件
// ─────────────────────────────────────────────────────────────────────────────
const ImpactBadge = ({ impact }: { impact: string }) => {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  const labels: Record<string, string> = { high: '高', medium: '中', low: '低' };
  return (
    <span className={cn('text-xs px-1.5 py-0.5 rounded border', colors[impact] || colors.low)}>
      {labels[impact] || impact}
    </span>
  );
};

const SurpriseCell = ({ value }: { value: number }) => {
  if (value === 0) return <span className="text-gray-500">待公布</span>;
  const color = value > 0 ? 'text-green-400' : 'text-red-400';
  const icon = value > 0 ? '▲' : '▼';
  return <span className={color}>{icon} {Math.abs(value).toFixed(1)}</span>;
};

const BiasChip = ({ bias }: { bias: string }) => {
  const map: Record<string, { color: string; label: string }> = {
    hawkish: { color: 'bg-red-500/20 text-red-400', label: '鹰派' },
    dovish: { color: 'bg-green-500/20 text-green-400', label: '鸽派' },
    neutral: { color: 'bg-gray-500/20 text-gray-400', label: '中性' },
  };
  const { color, label } = map[bias] || map.neutral;
  return <span className={cn('text-xs px-2 py-0.5 rounded', color)}>{label}</span>;
};

const CycleChip = ({ cycle }: { cycle: string }) => {
  const map: Record<string, { color: string; label: string }> = {
    hiking: { color: 'bg-red-500/20 text-red-400', label: '加息周期' },
    cutting: { color: 'bg-green-500/20 text-green-400', label: '降息周期' },
    pause: { color: 'bg-yellow-500/20 text-yellow-400', label: '暂停' },
  };
  const { color, label } = map[cycle] || map.pause;
  return <span className={cn('text-xs px-2 py-0.5 rounded', color)}>{label}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// 市场因果链组件
// ─────────────────────────────────────────────────────────────────────────────
const CausalChainPanel = () => {
  const [selectedChain, setSelectedChain] = useState(0);
  const [scenario, setScenario] = useState('');
  const [scenarioResult, setScenarioResult] = useState<string | null>(null);

  const runScenario = () => {
    if (!scenario.trim()) { toast.error('请输入情景假设'); return; }
    setScenarioResult('当前未配置可验证的后端情景计算服务；系统不会使用固定结论、随机结果或历史样例替代计算。请在管理后台为该原功能绑定模型与观测序列后重试。');
    toast.info('等待真实计算服务');
  };

  const chain = CAUSAL_CHAINS[selectedChain];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 因果链选择 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-400">市场因果链分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CAUSAL_CHAINS.map((c, i) => (
              <div
                key={i}
                onClick={() => setSelectedChain(i)}
                className={cn(
                  'p-2 rounded cursor-pointer transition-colors text-sm',
                  selectedChain === i ? 'bg-amber-900/30 border border-amber-500/30' : 'hover:bg-gray-700/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{c.trigger}</span>
                  <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                    {c.probability}%
                  </Badge>
                </div>
                <div className="text-xs text-gray-400 mt-1">{c.timeframe}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 因果链详情 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-400">传导路径：{chain.trigger}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {chain.chain.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{step}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700 pt-3">
              <div className="text-xs text-gray-400 mb-2">资产价格影响（预估）</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(chain.assets).map(([asset, chg]) => (
                  <div key={asset} className="flex justify-between text-xs">
                    <span className="text-gray-400">{asset.toUpperCase()}</span>
                    <span className={chg > 0 ? 'text-green-400' : 'text-red-400'}>
                      {chg > 0 ? '+' : ''}{chg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 反事实情景模拟 */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-400">反事实情景模拟</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="输入情景假设，例如：原油价格上涨10%对信用债的影响是什么？"
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              className="bg-gray-900 border-gray-600 text-sm flex-1"
              onKeyDown={e => e.key === 'Enter' && runScenario()}
            />
            <Button size="sm" onClick={runScenario} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Zap className="w-4 h-4 mr-1" />分析
            </Button>
          </div>
          {scenarioResult && (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded p-3 text-sm text-gray-300">
              <div className="text-amber-400 text-xs mb-1">分析结果</div>
              {scenarioResult}
            </div>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {['美联储加息25bp对新兴市场的影响', '中国GDP下降1%对大宗商品的影响', '原油上涨10%对通胀的影响'].map(preset => (
              <button
                key={preset}
                onClick={() => setScenario(preset)}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 替代数据监控组件
// ─────────────────────────────────────────────────────────────────────────────
const AltDataPanel = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
          <Satellite className="w-4 h-4" />卫星遥感与IoT数据
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ALT_DATA.satellite.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-700/50 last:border-0">
            <div>
              <div className="text-gray-300">{d.indicator}</div>
              <div className="text-xs text-gray-500">{d.source}</div>
            </div>
            <div className="text-right">
              <div className="text-white">{d.value} {d.unit}</div>
              <div className={d.change > 0 ? 'text-green-400 text-xs' : 'text-red-400 text-xs'}>
                {d.change > 0 ? '▲' : '▼'} {Math.abs(d.change)}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
          <Activity className="w-4 h-4" />市场情绪与新闻情绪指数
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ALT_DATA.sentiment.map((d, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">{d.source}</span>
              <span className={d.score > 0.5 ? 'text-green-400' : d.score > 0.3 ? 'text-yellow-400' : 'text-red-400'}>
                {(d.score * 100).toFixed(0)}分
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className={cn('h-1.5 rounded-full', d.score > 0.5 ? 'bg-green-500' : d.score > 0.3 ? 'bg-yellow-500' : 'bg-red-500')}
                style={{ width: `${d.score * 100}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">{d.coverage} · 趋势：{d.trend === 'improving' ? '改善↑' : d.trend === 'declining' ? '恶化↓' : '稳定→'}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

// Satellite icon (lucide doesn't have it, use a custom one)
const Satellite = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13 7L7 13M15 3l-3 3M21 9l-3 3M3 15l3-3M9 21l3-3M5 5l14 14M9 9l6 6"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 风险对冲建议组件
// ─────────────────────────────────────────────────────────────────────────────
const HedgePanel = ({ context }: { context: string }) => {
  const [threshold, setThreshold] = useState(75);
  const [confirmed, setConfirmed] = useState(false);

  const hedges = [
    { risk: '通胀超预期', exposure: 82, hedge: '做多TIPS，做空名义债券', instrument: 'TIP ETF / ZN期货', cost: '0.12%/年', effectiveness: 78 },
    { risk: '美元走强', exposure: 68, hedge: '新兴市场外汇对冲', instrument: 'USD/EM货币远期', cost: '0.08%/年', effectiveness: 85 },
    { risk: '利率上升', exposure: 74, hedge: '缩短久期，利率互换', instrument: 'IRS支付固定端', cost: '0.15%/年', effectiveness: 82 },
    { risk: '信用风险', exposure: 55, hedge: 'CDS保护', instrument: 'CDX IG指数', cost: '0.45%/年', effectiveness: 90 },
  ];

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
          <Shield className="w-4 h-4" />风险对冲方案评估 — {context}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-gray-400">风险敞口阈值</span>
          <div className="flex-1">
            <Slider value={[threshold]} onValueChange={v => setThreshold(v[0])} min={50} max={95} step={5} className="w-full" />
          </div>
          <span className="text-xs text-amber-400 w-8">{threshold}%</span>
        </div>
        {hedges.filter(h => h.exposure >= threshold).map((h, i) => (
          <div key={i} className="bg-red-900/20 border border-red-500/30 rounded p-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-sm text-white font-medium">{h.risk}</div>
                <div className="text-xs text-gray-400">敞口：{h.exposure}% · 建议：{h.hedge}</div>
              </div>
              <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">需对冲</Badge>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>工具：{h.instrument}</span>
              <span>成本：{h.cost}</span>
              <span>有效性：{h.effectiveness}%</span>
            </div>
          </div>
        ))}
        {hedges.filter(h => h.exposure < threshold).length === hedges.length && (
          <div className="text-center text-sm text-green-400 py-4">当前风险敞口均低于阈值，无需立即对冲</div>
        )}
        {!confirmed && hedges.filter(h => h.exposure >= threshold).length > 0 && (
          <Button
            size="sm"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => { setConfirmed(true); toast.success('对冲方案已确认，请通过交易系统执行'); }}
          >
            确认对冲方案（需用户授权）
          </Button>
        )}
        {confirmed && (
          <div className="bg-green-900/20 border border-green-500/30 rounded p-2 text-xs text-green-400 text-center">
            ✓ 方案已确认，等待交易系统执行
          </div>
        )}
      </CardContent>
    </Card>
  );
};
