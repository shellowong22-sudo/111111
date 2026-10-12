import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Target, RefreshCw, ChevronRight, Activity, ArrowLeft } from "lucide-react";
import DerivativesAIPanel from "@/components/DerivativesAIPanel";
import { Button } from "@/components/ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CommodityData {
  symbol: string; name: string; price: number; change: number; changePct: number;
  category: string; unit: string; high52w: number; low52w: number;
  supplyScore: number; demandScore: number; sentiment: number;
}
interface SupplyDemandPoint { month: string; supply: number; demand: number; inventory: number; }
interface SeasonalPoint { month: string; current: number; avg5y: number; avg10y: number; }
interface CausalEvent { date: string; event: string; commodity: string; impact: number; chain: string[]; }
interface AISignal { commodity: string; signal: "BUY" | "SELL" | "HOLD"; confidence: number; reason: string; targetPrice: number; stopLoss: number; }

// ─── Static Data ─────────────────────────────────────────────────────────────
const COMMODITIES: CommodityData[] = [
  { symbol: "CL", name: "WTI原油", price: 78.42, change: 1.23, changePct: 1.59, category: "能源", unit: "USD/桶", high52w: 95.03, low52w: 63.57, supplyScore: 42, demandScore: 68, sentiment: 72 },
  { symbol: "NG", name: "天然气", price: 2.84, change: -0.12, changePct: -4.05, category: "能源", unit: "USD/MMBtu", high52w: 3.92, low52w: 1.53, supplyScore: 78, demandScore: 45, sentiment: 38 },
  { symbol: "GC", name: "黄金", price: 2345.80, change: 18.50, changePct: 0.79, category: "贵金属", unit: "USD/盎司", high52w: 2449.89, low52w: 1984.30, supplyScore: 55, demandScore: 82, sentiment: 85 },
  { symbol: "SI", name: "白银", price: 29.45, change: 0.67, changePct: 2.33, category: "贵金属", unit: "USD/盎司", high52w: 32.51, low52w: 22.28, supplyScore: 60, demandScore: 74, sentiment: 78 },
  { symbol: "HG", name: "铜", price: 4.52, change: -0.08, changePct: -1.74, category: "工业金属", unit: "USD/磅", high52w: 5.20, low52w: 3.55, supplyScore: 65, demandScore: 58, sentiment: 55 },
  { symbol: "AL", name: "铝", price: 2380, change: 45, changePct: 1.93, category: "工业金属", unit: "USD/吨", high52w: 2680, low52w: 2050, supplyScore: 52, demandScore: 63, sentiment: 60 },
  { symbol: "W", name: "小麦", price: 548.25, change: -8.50, changePct: -1.53, category: "农产品", unit: "美分/蒲式耳", high52w: 625.00, low52w: 498.75, supplyScore: 72, demandScore: 55, sentiment: 42 },
  { symbol: "C", name: "玉米", price: 445.50, change: 5.25, changePct: 1.19, category: "农产品", unit: "美分/蒲式耳", high52w: 510.00, low52w: 395.00, supplyScore: 68, demandScore: 62, sentiment: 58 },
  { symbol: "S", name: "大豆", price: 1168.00, change: 12.75, changePct: 1.10, category: "农产品", unit: "美分/蒲式耳", high52w: 1285.00, low52w: 1045.00, supplyScore: 58, demandScore: 70, sentiment: 65 },
  { symbol: "CC", name: "可可", price: 8450, change: 320, changePct: 3.94, category: "软商品", unit: "USD/吨", high52w: 11722, low52w: 4200, supplyScore: 28, demandScore: 85, sentiment: 92 },
  { symbol: "KC", name: "咖啡", price: 218.50, change: 4.30, changePct: 2.01, category: "软商品", unit: "美分/磅", high52w: 245.00, low52w: 158.00, supplyScore: 45, demandScore: 78, sentiment: 80 },
  { symbol: "CT", name: "棉花", price: 78.35, change: -1.20, changePct: -1.51, category: "软商品", unit: "美分/磅", high52w: 92.50, low52w: 68.20, supplyScore: 70, demandScore: 52, sentiment: 45 },
];

const SUPPLY_DEMAND_DATA: Record<string, SupplyDemandPoint[]> = {
  "CL": [
    { month: "1月", supply: 102.5, demand: 100.8, inventory: 450 },
    { month: "2月", supply: 101.8, demand: 99.5, inventory: 465 },
    { month: "3月", supply: 103.2, demand: 101.5, inventory: 472 },
    { month: "4月", supply: 102.8, demand: 103.2, inventory: 458 },
    { month: "5月", supply: 101.5, demand: 104.8, inventory: 435 },
    { month: "6月", supply: 100.2, demand: 105.5, inventory: 412 },
  ],
  "GC": [
    { month: "1月", supply: 3850, demand: 4120, inventory: 38500 },
    { month: "2月", supply: 3920, demand: 4280, inventory: 37800 },
    { month: "3月", supply: 3780, demand: 4350, inventory: 36900 },
    { month: "4月", supply: 3900, demand: 4180, inventory: 36500 },
    { month: "5月", supply: 4050, demand: 4220, inventory: 36200 },
    { month: "6月", supply: 3980, demand: 4380, inventory: 35600 },
  ],
};

const SEASONAL_DATA: Record<string, SeasonalPoint[]> = {
  "CL": [
    { month: "1月", current: -2.1, avg5y: -1.8, avg10y: -1.5 },
    { month: "2月", current: 1.2, avg5y: 0.8, avg10y: 0.5 },
    { month: "3月", current: 3.5, avg5y: 2.9, avg10y: 2.1 },
    { month: "4月", current: 2.8, avg5y: 3.2, avg10y: 2.8 },
    { month: "5月", current: 4.1, avg5y: 3.8, avg10y: 3.2 },
    { month: "6月", current: 1.9, avg5y: 2.1, avg10y: 1.8 },
    { month: "7月", current: -0.5, avg5y: 0.2, avg10y: 0.5 },
    { month: "8月", current: -1.8, avg5y: -1.2, avg10y: -0.8 },
    { month: "9月", current: -2.5, avg5y: -2.0, avg10y: -1.5 },
    { month: "10月", current: -1.2, avg5y: -0.8, avg10y: -0.5 },
    { month: "11月", current: 0.8, avg5y: 0.5, avg10y: 0.2 },
    { month: "12月", current: -1.5, avg5y: -1.0, avg10y: -0.8 },
  ],
  "GC": [
    { month: "1月", current: 2.8, avg5y: 2.2, avg10y: 1.8 },
    { month: "2月", current: 1.5, avg5y: 1.8, avg10y: 1.5 },
    { month: "3月", current: -0.8, avg5y: -0.5, avg10y: -0.2 },
    { month: "4月", current: 1.2, avg5y: 0.8, avg10y: 0.5 },
    { month: "5月", current: -1.5, avg5y: -1.0, avg10y: -0.8 },
    { month: "6月", current: -2.2, avg5y: -1.8, avg10y: -1.5 },
    { month: "7月", current: 0.5, avg5y: 0.2, avg10y: 0.0 },
    { month: "8月", current: 1.8, avg5y: 1.5, avg10y: 1.2 },
    { month: "9月", current: 2.5, avg5y: 2.0, avg10y: 1.8 },
    { month: "10月", current: 1.0, avg5y: 0.8, avg10y: 0.5 },
    { month: "11月", current: -0.5, avg5y: -0.2, avg10y: 0.0 },
    { month: "12月", current: 1.2, avg5y: 0.8, avg10y: 0.5 },
  ],
};

const CAUSAL_EVENTS: CausalEvent[] = [
  { date: "2024-06-15", event: "OPEC+减产协议延期", commodity: "WTI原油", impact: 3.2, chain: ["OPEC+减产", "供应收紧", "库存下降", "油价上涨", "通胀预期升温"] },
  { date: "2024-06-10", event: "西非可可产区干旱", commodity: "可可", impact: 8.5, chain: ["气候异常", "产量骤降", "供应短缺", "可可价格暴涨", "巧克力成本上升"] },
  { date: "2024-06-05", event: "美联储暗示降息", commodity: "黄金", impact: 1.8, chain: ["降息预期", "美元走弱", "实际利率下降", "黄金吸引力增强", "金价上涨"] },
  { date: "2024-05-28", event: "中国基建刺激政策", commodity: "铜", impact: -1.2, chain: ["政策刺激", "需求预期改善", "铜价短暂上涨", "获利回吐", "价格回落"] },
  { date: "2024-05-20", event: "乌克兰小麦出口受阻", commodity: "小麦", impact: 2.5, chain: ["地缘冲突", "出口受阻", "全球供应减少", "价格上涨", "粮食安全担忧"] },
];

const AI_SIGNALS: AISignal[] = [
  { commodity: "可可", signal: "BUY", confidence: 88, reason: "西非供应持续短缺，需求弹性低，价格支撑强劲", targetPrice: 9200, stopLoss: 7800 },
  { commodity: "黄金", signal: "BUY", confidence: 82, reason: "降息预期+地缘风险双重支撑，央行购金持续", targetPrice: 2500, stopLoss: 2280 },
  { commodity: "天然气", signal: "SELL", confidence: 75, reason: "库存超季节性水平，需求端疲软，技术面破位", targetPrice: 2.40, stopLoss: 3.10 },
  { commodity: "WTI原油", signal: "HOLD", confidence: 68, reason: "OPEC+减产与需求担忧相互抵消，区间震荡", targetPrice: 82.00, stopLoss: 74.00 },
  { commodity: "铜", signal: "SELL", confidence: 71, reason: "中国需求复苏低于预期，LME库存攀升", targetPrice: 4.20, stopLoss: 4.75 },
  { commodity: "大豆", signal: "BUY", confidence: 65, reason: "南美减产+中国进口需求强劲，基本面改善", targetPrice: 1220, stopLoss: 1120 },
];

const CORR_PAIRS = ["原油", "天然气", "黄金", "铜", "小麦", "大豆"];
const CORR_MATRIX = [
  [1.00, 0.42, -0.18, 0.65, 0.12, 0.08],
  [0.42, 1.00, 0.05, 0.28, 0.15, 0.10],
  [-0.18, 0.05, 1.00, 0.22, -0.08, -0.05],
  [0.65, 0.28, 0.22, 1.00, 0.18, 0.15],
  [0.12, 0.15, -0.08, 0.18, 1.00, 0.72],
  [0.08, 0.10, -0.05, 0.15, 0.72, 1.00],
];

// ─── Helper Components ────────────────────────────────────────────────────────
function CorrCell({ value }: { value: number }) {
  const abs = Math.abs(value);
  const bg = value === 1 ? "#1a1a1a"
    : value > 0.5 ? `rgba(34,197,94,${abs * 0.8})`
    : value > 0 ? `rgba(34,197,94,${abs * 0.5})`
    : value < -0.5 ? `rgba(239,68,68,${abs * 0.8})`
    : `rgba(239,68,68,${abs * 0.5})`;
  return (
    <td className="text-center p-2 text-xs font-mono border border-gray-800 cursor-default"
      style={{ backgroundColor: bg, color: abs > 0.3 ? "#fff" : "#aaa" }}>
      {value === 1 ? "—" : value.toFixed(2)}
    </td>
  );
}

function SignalBadge({ signal }: { signal: "BUY" | "SELL" | "HOLD" }) {
  const cls = signal === "BUY" ? "bg-green-500/20 text-green-400 border-green-500/40"
    : signal === "SELL" ? "bg-red-500/20 text-red-400 border-red-500/40"
    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold border ${cls}`}>{signal}</span>;
}

// ─── Causal Node Graph Component ────────────────────────────────────────────
interface CausalNodeGraphProps {
  events: CausalEvent[];
  selectedCommodity: CommodityData;
  priceHistory: { time: string; price: number }[];
  onSelectCommodity: (c: CommodityData) => void;
}

type NodeStatus = 'trigger' | 'first' | 'second' | 'third';

interface GraphNode {
  id: string;
  label: string;
  status: NodeStatus;
  direction: 'up' | 'down' | 'neutral';
  probability: number;
  detail: string;
  impact: number;
}

const CAUSAL_GRAPHS: Record<string, GraphNode[][]> = {
  default: [
    [{ id: 'n0', label: '触发事件', status: 'trigger', direction: 'neutral', probability: 1, detail: '宏观或地缘政治事件触发供需失衡', impact: 0 }],
    [
      { id: 'n1', label: '供应中断', status: 'first', direction: 'up', probability: 0.82, detail: '生产或运输受阻，短期供给减少', impact: 3.2 },
      { id: 'n2', label: '需求激增', status: 'first', direction: 'up', probability: 0.71, detail: '恐慌性囤积或替代需求上升', impact: 2.1 },
    ],
    [
      { id: 'n3', label: '库存骤降', status: 'second', direction: 'up', probability: 0.68, detail: 'EIA/OPEC库存数据低于预期', impact: 4.5 },
      { id: 'n4', label: '期货升水', status: 'second', direction: 'up', probability: 0.75, detail: '近月合约溢价扩大，期货曲线陡峭化', impact: 2.8 },
      { id: 'n5', label: '美元走弱', status: 'second', direction: 'up', probability: 0.55, detail: '大宗商品以美元计价，美元贬值推高价格', impact: 1.5 },
    ],
    [
      { id: 'n6', label: '现货价格飙升', status: 'third', direction: 'up', probability: 0.88, detail: '综合多重因素，现货价格大幅上涨', impact: 7.2 },
      { id: 'n7', label: '替代品需求', status: 'third', direction: 'down', probability: 0.45, detail: '价格过高触发替代品切换，部分抵消涨幅', impact: -1.8 },
    ],
  ],
  CL: [
    [{ id: 'n0', label: 'OPEC+减产', status: 'trigger', direction: 'neutral', probability: 1, detail: 'OPEC+宣布额外减产100万桶/日', impact: 0 }],
    [
      { id: 'n1', label: '全球供应缺口', status: 'first', direction: 'up', probability: 0.91, detail: '日均供应缺口扩大至150万桶', impact: 4.1 },
      { id: 'n2', label: '沙特OSP上调', status: 'first', direction: 'up', probability: 0.78, detail: '沙特官方售价上调$1.5/桶', impact: 1.8 },
    ],
    [
      { id: 'n3', label: 'Cushing库存下降', status: 'second', direction: 'up', probability: 0.83, detail: 'WTI交割地库存降至3年低位', impact: 3.5 },
      { id: 'n4', label: '炼厂利润扩张', status: 'second', direction: 'up', probability: 0.69, detail: '裂解价差走阔，炼厂增加采购', impact: 2.2 },
      { id: 'n5', label: '航运成本上升', status: 'second', direction: 'up', probability: 0.61, detail: '红海绕行推高运费', impact: 1.1 },
    ],
    [
      { id: 'n6', label: 'WTI突破$90', status: 'third', direction: 'up', probability: 0.72, detail: '多重利多共振，WTI原油突破$90关键阻力', impact: 8.5 },
      { id: 'n7', label: '需求侧压制', status: 'third', direction: 'down', probability: 0.38, detail: '高油价抑制需求，部分对冲涨幅', impact: -2.1 },
    ],
  ],
  GC: [
    [{ id: 'n0', label: '美联储鸽派转向', status: 'trigger', direction: 'neutral', probability: 1, detail: '美联储暗示降息时间表提前', impact: 0 }],
    [
      { id: 'n1', label: '实际利率下行', status: 'first', direction: 'up', probability: 0.89, detail: '10年期TIPS收益率跌破1.5%', impact: 3.8 },
      { id: 'n2', label: '美元指数走弱', status: 'first', direction: 'up', probability: 0.82, detail: 'DXY跌破100关键支撑', impact: 2.5 },
    ],
    [
      { id: 'n3', label: '央行购金加速', status: 'second', direction: 'up', probability: 0.74, detail: '新兴市场央行加速增持黄金储备', impact: 4.2 },
      { id: 'n4', label: 'ETF资金流入', status: 'second', direction: 'up', probability: 0.67, detail: 'SPDR黄金ETF持仓增加50吨', impact: 2.9 },
      { id: 'n5', label: '地缘避险需求', status: 'second', direction: 'up', probability: 0.58, detail: '中东局势推高避险情绪', impact: 1.7 },
    ],
    [
      { id: 'n6', label: '黄金突破$2500', status: 'third', direction: 'up', probability: 0.81, detail: '多重利多叠加，黄金创历史新高', impact: 9.2 },
      { id: 'n7', label: '获利了结压力', status: 'third', direction: 'down', probability: 0.42, detail: '高位技术性回调风险', impact: -3.1 },
    ],
  ],
};

const STATUS_LABELS: Record<NodeStatus, string> = {
  trigger: '触发事件', first: '一阶影响', second: '二阶影响', third: '三阶效应',
};

const STATUS_COLORS: Record<NodeStatus, string> = {
  trigger: 'border-yellow-500/60 bg-yellow-500/10',
  first: 'border-orange-500/60 bg-orange-500/10',
  second: 'border-blue-500/60 bg-blue-500/10',
  third: 'border-purple-500/60 bg-purple-500/10',
};

// ─── Dynamic Probability Adjustment ────────────────────────────────────────
function calcDynamicProb(node: GraphNode, changePct: number): { prob: number; delta: number; reason: string } {
  const base = node.probability;
  if (node.status === 'trigger') return { prob: base, delta: 0, reason: '' };
  const absChange = Math.abs(changePct);
  let delta = 0;
  let reason = '';
  const THRESHOLD_STRONG = 2.0;
  const THRESHOLD_MILD = 0.8;
  if (absChange >= THRESHOLD_STRONG) {
    const boost = 0.08 + (absChange - THRESHOLD_STRONG) * 0.03;
    if (changePct > 0 && node.direction === 'up') {
      delta = Math.min(boost, 0.18);
      reason = `价格涨幅+${changePct.toFixed(2)}%，上涨节点概率上调`;
    } else if (changePct > 0 && node.direction === 'down') {
      delta = -Math.min(boost * 0.6, 0.12);
      reason = `价格涨幅+${changePct.toFixed(2)}%，下跌节点概率下调`;
    } else if (changePct < 0 && node.direction === 'down') {
      delta = Math.min(boost, 0.18);
      reason = `价格跌幅${changePct.toFixed(2)}%，下跌节点概率上调`;
    } else if (changePct < 0 && node.direction === 'up') {
      delta = -Math.min(boost * 0.6, 0.12);
      reason = `价格跌幅${changePct.toFixed(2)}%，上涨节点概率下调`;
    }
  } else if (absChange >= THRESHOLD_MILD) {
    const boost = 0.03 + (absChange - THRESHOLD_MILD) * 0.04;
    if (changePct > 0 && node.direction === 'up') {
      delta = Math.min(boost, 0.08);
      reason = `价格小幅上涨+${changePct.toFixed(2)}%，轻微上调`;
    } else if (changePct < 0 && node.direction === 'down') {
      delta = Math.min(boost, 0.08);
      reason = `价格小幅下跌${changePct.toFixed(2)}%，轻微上调`;
    }
  }
  const adjusted = Math.min(0.99, Math.max(0.01, base + delta));
  return { prob: adjusted, delta, reason };
}

function CausalNodeGraph({ events, selectedCommodity, priceHistory, onSelectCommodity }: CausalNodeGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEventIdx, setSelectedEventIdx] = useState<number>(0);
  const [animating, setAnimating] = useState(false);
  const [pulsingNodes, setPulsingNodes] = useState<Set<string>>(new Set());
  const prevChangePct = useRef<number>(selectedCommodity.changePct);
  const graphKey = selectedCommodity.symbol;
  const levels = CAUSAL_GRAPHS[graphKey] ?? CAUSAL_GRAPHS['default'];
  const allNodes = levels.flat();
  const selectedNode = allNodes.find(n => n.id === selectedNodeId) ?? null;

  // Compute dynamic probabilities for all nodes
  const dynamicNodes = useMemo(() => {
    const map: Record<string, { prob: number; delta: number; reason: string }> = {};
    allNodes.forEach(n => {
      map[n.id] = calcDynamicProb(n, selectedCommodity.changePct);
    });
    return map;
  }, [allNodes, selectedCommodity.changePct, selectedCommodity.symbol]);

  // Trigger pulse animation when changePct changes significantly
  useEffect(() => {
    const prev = prevChangePct.current;
    const curr = selectedCommodity.changePct;
    if (Math.abs(curr - prev) > 0.1) {
      const affected = allNodes
        .filter(n => Math.abs(dynamicNodes[n.id]?.delta ?? 0) > 0.01)
        .map(n => n.id);
      if (affected.length > 0) {
        setPulsingNodes(new Set(affected));
        const timer = setTimeout(() => setPulsingNodes(new Set()), 1800);
        prevChangePct.current = curr;
        return () => clearTimeout(timer);
      }
    }
    prevChangePct.current = curr;
  }, [selectedCommodity.changePct, selectedCommodity.symbol]);

  const handleSelectEvent = (idx: number) => {
    setSelectedEventIdx(idx);
    setSelectedNodeId(null);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
  };

  const evt = events[selectedEventIdx];

  return (
    <div className="space-y-4">
      {/* Header: commodity selector + event selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">当前品种：</span>
        {COMMODITIES.slice(0, 6).map(c => (
          <button key={c.symbol}
            onClick={() => { onSelectCommodity(c); setSelectedNodeId(null); }}
            className={`px-2 py-1 rounded text-xs font-bold border transition-all ${
              selectedCommodity.symbol === c.symbol
                ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}>
            {c.symbol}
          </button>
        ))}
      </div>

      {/* Event selector */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 self-center">事件：</span>
        {events.map((e, i) => (
          <button key={i} onClick={() => handleSelectEvent(i)}
            className={`px-2 py-1 rounded text-xs border transition-all ${
              selectedEventIdx === i
                ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
            }`}>
            {e.event.slice(0, 12)}{e.event.length > 12 ? '…' : ''}
          </button>
        ))}
      </div>

      {/* Price linkage indicator */}
      {(() => {
        const cp = selectedCommodity.changePct;
        const absCP = Math.abs(cp);
        const level = absCP >= 2.0 ? 'strong' : absCP >= 0.8 ? 'mild' : 'neutral';
        const affectedCount = allNodes.filter(n => Math.abs((dynamicNodes[n.id]?.delta ?? 0)) > 0.005).length;
        return (
          <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs border ${
            level === 'strong'
              ? cp > 0 ? 'bg-green-500/8 border-green-500/25 text-green-300' : 'bg-red-500/8 border-red-500/25 text-red-300'
              : level === 'mild'
              ? cp > 0 ? 'bg-green-500/5 border-green-500/15 text-green-400' : 'bg-red-500/5 border-red-500/15 text-red-400'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-500'
          }`}>
            <Activity size={12} />
            <span className="font-bold">{selectedCommodity.name}</span>
            <span>今日涨跌</span>
            <span className={`font-mono font-bold ${
              cp >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>{cp >= 0 ? '+' : ''}{cp.toFixed(2)}%</span>
            <span className="text-gray-600">·</span>
            {level === 'neutral' ? (
              <span className="text-gray-500">涨跌幅低于阈值（0.8%），节点概率维持基准值</span>
            ) : (
              <span>
                <span className={level === 'strong' ? 'font-bold' : ''}>{level === 'strong' ? '强' : '轻度'}</span>
                联动触发 — <span className="font-bold">{affectedCount}</span> 个节点概率已动态调整
                {level === 'strong' && <span className="ml-1 font-bold">（强信号 ≥2%）</span>}
              </span>
            )}
          </div>
        );
      })()}

      {/* Node graph */}
      <div className={`transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-xs font-bold text-yellow-300">因果传导节点图 — {selectedCommodity.name}</span>
            <span className="text-xs text-gray-500 ml-auto">点击节点查看详情</span>
          </div>
          <div className="space-y-4">
            {levels.map((levelNodes, levelIdx) => (
              <div key={levelIdx}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{STATUS_LABELS[levelNodes[0].status]}</span>
                  <div className="flex-1 border-t border-gray-800" />
                </div>
                <div className="flex flex-wrap gap-2 ml-4">
                  {levelNodes.map((node) => {
                    const dyn = dynamicNodes[node.id] ?? { prob: node.probability, delta: 0, reason: '' };
                    const isPulsing = pulsingNodes.has(node.id);
                    const hasDelta = Math.abs(dyn.delta) > 0.005;
                    return (
                    <button key={node.id}
                      onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                      className={`relative rounded-lg border p-3 text-left transition-all hover:scale-105 ${
                        selectedNodeId === node.id ? 'ring-2 ring-yellow-400/60 scale-105' : ''
                      } ${STATUS_COLORS[node.status]} ${
                        isPulsing ? (dyn.delta > 0 ? 'ring-2 ring-green-400/70 shadow-lg shadow-green-500/20' : 'ring-2 ring-red-400/70 shadow-lg shadow-red-500/20') : ''
                      }`}
                      style={{ minWidth: 120, transition: 'box-shadow 0.3s, ring 0.3s' }}>
                      <div className="flex items-center gap-1 mb-1">
                        {node.direction === 'up' && <TrendingUp size={11} className="text-green-400" />}
                        {node.direction === 'down' && <TrendingDown size={11} className="text-red-400" />}
                        {node.direction === 'neutral' && <Target size={11} className="text-gray-400" />}
                        <span className={`text-xs font-bold ${
                          node.direction === 'up' ? 'text-green-300' : node.direction === 'down' ? 'text-red-300' : 'text-gray-300'
                        }`}>{node.label}</span>
                        {isPulsing && hasDelta && (
                          <span className={`ml-auto text-xs font-bold animate-pulse ${
                            dyn.delta > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>{dyn.delta > 0 ? '▲' : '▼'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-14 h-1 bg-gray-700 rounded-full">
                          <div className={`h-1 rounded-full transition-all duration-700 ${
                            hasDelta ? (dyn.delta > 0 ? 'bg-green-400' : 'bg-red-400') : 'bg-yellow-400'
                          }`} style={{ width: `${dyn.prob * 100}%` }} />
                        </div>
                        <span className={`text-xs font-mono font-bold ${
                          hasDelta ? (dyn.delta > 0 ? 'text-green-300' : 'text-red-300') : 'text-gray-400'
                        }`}>{(dyn.prob * 100).toFixed(0)}%</span>
                        {hasDelta && (
                          <span className={`text-xs font-mono ${
                            dyn.delta > 0 ? 'text-green-500' : 'text-red-500'
                          }`}>({dyn.delta > 0 ? '+' : ''}{(dyn.delta * 100).toFixed(0)})</span>
                        )}
                      </div>
                      {node.impact !== 0 && (
                        <div className={`text-xs font-mono mt-1 ${node.impact > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {node.impact > 0 ? '+' : ''}{node.impact.toFixed(1)}%
                        </div>
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Node detail panel */}
      {selectedNode && (() => {
        const dynSelected = dynamicNodes[selectedNode.id] ?? { prob: selectedNode.probability, delta: 0, reason: '' };
        const hasDynChange = Math.abs(dynSelected.delta) > 0.005;
        return (
        <div className="bg-gray-900/80 border border-yellow-500/30 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {selectedNode.direction === 'up' && <TrendingUp size={14} className="text-green-400" />}
              {selectedNode.direction === 'down' && <TrendingDown size={14} className="text-red-400" />}
              {selectedNode.direction === 'neutral' && <Target size={14} className="text-gray-400" />}
              <span className="text-sm font-bold text-white">{selectedNode.label}</span>
              <span className="text-xs text-gray-500">· {STATUS_LABELS[selectedNode.status]}</span>
              {hasDynChange && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${
                  dynSelected.delta > 0
                    ? 'bg-green-500/10 border-green-500/40 text-green-400'
                    : 'bg-red-500/10 border-red-500/40 text-red-400'
                }`}>动态调整 {dynSelected.delta > 0 ? '▲' : '▼'}{Math.abs(dynSelected.delta * 100).toFixed(0)}pp</span>
              )}
            </div>
            <button onClick={() => setSelectedNodeId(null)} className="text-gray-600 hover:text-gray-400 text-xs">✕ 关闭</button>
          </div>
          <p className="text-xs text-gray-300 mb-3">{selectedNode.detail}</p>
          {hasDynChange && (
            <div className={`text-xs rounded p-2 mb-3 border ${
              dynSelected.delta > 0
                ? 'bg-green-500/5 border-green-500/20 text-green-300'
                : 'bg-red-500/5 border-red-500/20 text-red-300'
            }`}>
              <span className="font-bold">⚡ 动态推断：</span>{dynSelected.reason}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500">动态概率</div>
              <div className={`font-bold font-mono ${
                hasDynChange ? (dynSelected.delta > 0 ? 'text-green-400' : 'text-red-400') : 'text-yellow-400'
              }`}>{(dynSelected.prob * 100).toFixed(0)}%
                {hasDynChange && (
                  <span className="text-gray-500 font-normal ml-1">(基准 {(selectedNode.probability * 100).toFixed(0)}%)</span>
                )}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500">价格影响</div>
              <div className={`font-bold font-mono ${selectedNode.impact > 0 ? 'text-green-400' : selectedNode.impact < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {selectedNode.impact === 0 ? '触发源' : `${selectedNode.impact > 0 ? '+' : ''}${selectedNode.impact.toFixed(1)}%`}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500">传导层级</div>
              <div className="font-bold text-blue-400">{STATUS_LABELS[selectedNode.status]}</div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Price linkage chart */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={13} className="text-blue-400" />
          <span className="text-xs font-bold text-blue-300">{selectedCommodity.name} 近30日价格联动</span>
          <span className={`ml-auto text-xs font-mono font-bold ${selectedCommodity.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {selectedCommodity.changePct >= 0 ? '+' : ''}{selectedCommodity.changePct.toFixed(2)}%
          </span>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={priceHistory}>
            <defs>
              <linearGradient id="causalPriceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 9 }} interval={4} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#d1d5db', fontSize: 11 }} />
            <Area type="monotone" dataKey="price" stroke="#3b82f6" fill="url(#causalPriceGrad)" strokeWidth={1.5} dot={false} name="价格" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Event detail */}
      {evt && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} className="text-orange-400" />
            <span className="text-xs font-bold text-orange-300">当前事件详情：{evt.event}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap mb-3">
            {evt.chain.map((step, j) => (
              <div key={j} className="flex items-center gap-1">
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-200 border border-gray-700">{step}</span>
                {j < evt.chain.length - 1 && <ChevronRight size={11} className="text-gray-600" />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500">价格影响</div>
              <div className={`font-bold font-mono ${evt.impact > 0 ? 'text-green-400' : 'text-red-400'}`}>{evt.impact > 0 ? '+' : ''}{evt.impact.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500">影响品种</div>
              <div className="font-bold text-yellow-400">{evt.commodity}</div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500">事件日期</div>
              <div className="font-bold text-blue-400">{evt.date}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GlobalCommodityPricesAdvanced() {
  const [, setLocation] = useLocation();
  // Read code param from BSRCH deep-link (e.g. ?code=GC or ?code=CL1)
  const urlCode = new URLSearchParams(window.location.search).get('code');
  const initCommodity = urlCode
    ? COMMODITIES.find(c => c.symbol === urlCode || urlCode.startsWith(c.symbol)) ?? COMMODITIES[0]
    : COMMODITIES[0];
  const [activeTab, setActiveTab] = useState<"monitor" | "supplydemand" | "seasonal" | "correlation" | "causal" | "ai" | "quantum" | "twin" | "neuro">("monitor");
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityData>(initCommodity);
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [sortBy, setSortBy] = useState<"changePct" | "sentiment" | "price">("changePct");
  const [causalExpanded, setCausalExpanded] = useState<number | null>(null);
  const [aiConfirmIdx, setAiConfirmIdx] = useState<number | null>(null);
  const [confirmedSignals, setConfirmedSignals] = useState<Set<number>>(new Set());
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);

  useEffect(() => {
    const base = selectedCommodity.price;
    const history = Array.from({ length: 30 }, (_, i) => ({
      time: `${i + 1}日`,
      price: +(base * (1 + (Math.sin(i * 0.5) * 0.02 + ((Math.sin(Date.now() * 0.001 + Math.random()) - Math.floor(Math.sin(Date.now() * 0.001 + Math.random()))) - 0.5) * 0.015))).toFixed(2),
    }));
    setPriceHistory(history);
  }, [selectedCommodity.symbol]);

  const categories = useMemo(() => ["全部", ...Array.from(new Set(COMMODITIES.map(c => c.category)))], []);
  const filtered = useMemo(() => {
    const list = selectedCategory === "全部" ? COMMODITIES : COMMODITIES.filter(c => c.category === selectedCategory);
    return [...list].sort((a, b) => {
      if (sortBy === "changePct") return Math.abs(b.changePct) - Math.abs(a.changePct);
      if (sortBy === "sentiment") return b.sentiment - a.sentiment;
      return b.price - a.price;
    });
  }, [selectedCategory, sortBy]);

  const supplyDemandData = SUPPLY_DEMAND_DATA[selectedCommodity.symbol] ?? SUPPLY_DEMAND_DATA["CL"];
  const seasonalData = SEASONAL_DATA[selectedCommodity.symbol] ?? SEASONAL_DATA["CL"];

  const handleConfirmSignal = useCallback((idx: number) => {
    setConfirmedSignals(prev => { const s = new Set(prev); s.add(idx); return s; });
    setAiConfirmIdx(null);
  }, []);

  const liveMetrics = useMemo(() => ({
    "WTI 原油": "$78.42",
    "Brent 原油": "$82.30",
    "黄金": "$2,345",
    "白银": "$29.45",
    "铜": "$4.52/lb",
    "天然气": "$2.84/MMBtu",
    "小麦": "$5.48/蒲式耳",
    "大豆": "$11.68/蒲式耳",
    "可可": "$8,450/吨",
    "咖啡": "$218.50/磅",
  }), []);

  const TABS = [
    { id: "monitor" as const, label: "实时监控" },
    { id: "supplydemand" as const, label: "供需因果" },
    { id: "seasonal" as const, label: "季节性分析" },
    { id: "correlation" as const, label: "相关性矩阵" },
    { id: "causal" as const, label: "事件链追踪" },
    { id: "ai" as const, label: "🧠 AI策略信号" },
    { id: "quantum" as const, label: "⚛️ 量子计算引擎" },
    { id: "twin" as const, label: "🌐 数字孪生模拟" },
    { id: "neuro" as const, label: "🧠 Neuro-Adaptive UI" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-4">
      <Button variant="ghost" onClick={() => setLocation("/")} className="mb-4 text-gray-400 hover:text-white">
        <ArrowLeft className="w-4 h-4 mr-2" />返回
      </Button>

      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-amber-400 font-mono sm:text-xl">GLCO — 全球商品价格深度分析</h1>
          <p className="text-xs text-gray-500 mt-0.5">实时监控 · 供需因果 · 季节性规律 · 相关性矩阵 · 事件链 · AI策略</p>
        </div>
        <div className="flex items-center gap-2 self-start text-xs text-green-400 sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />实时更新
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-gray-800 px-4 sm:mx-0 sm:px-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`whitespace-nowrap px-3 py-2 text-xs font-mono rounded-t transition-colors ${activeTab === t.id ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-400" : "text-gray-500 hover:text-gray-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: 实时监控 ── */}
      {activeTab === "monitor" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${selectedCategory === cat ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                  {cat}
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-gray-900 border border-gray-700 text-xs text-gray-300 px-2 py-1 rounded">
              <option value="changePct">按涨跌幅排序</option>
              <option value="sentiment">按情绪指数排序</option>
              <option value="price">按价格排序</option>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map(c => (
              <div key={c.symbol} onClick={() => setSelectedCommodity(c)}
                className={`p-3 rounded border cursor-pointer transition-all ${selectedCommodity.symbol === c.symbol ? "border-amber-500 bg-amber-500/5" : "border-gray-800 hover:border-gray-600 bg-gray-900/50"}`}>
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="text-xs font-bold text-white">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.symbol} · {c.category}</div>
                  </div>
                  {c.changePct > 0 ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                </div>
                <div className="text-sm font-mono font-bold text-white">{c.price.toLocaleString()}</div>
                <div className={`text-xs font-mono ${c.changePct > 0 ? "text-green-400" : "text-red-400"}`}>
                  {c.changePct > 0 ? "+" : ""}{c.changePct.toFixed(2)}%
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                    <span>情绪</span><span>{c.sentiment}</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded">
                    <div className="h-1 rounded transition-all" style={{ width: `${c.sentiment}%`, backgroundColor: c.sentiment > 70 ? "#22c55e" : c.sentiment > 40 ? "#f59e0b" : "#ef4444" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-3">{selectedCommodity.name} — 近30日价格走势</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={priceHistory}>
                  <defs>
                    <linearGradient id="priceGradGLCO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                  <Area type="monotone" dataKey="price" stroke="#f59e0b" fill="url(#priceGradGLCO)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-3">{selectedCommodity.name} — 多维度雷达评估</h3>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={[
                  { subject: "供应压力", value: selectedCommodity.supplyScore },
                  { subject: "需求强度", value: selectedCommodity.demandScore },
                  { subject: "市场情绪", value: selectedCommodity.sentiment },
                  { subject: "价格动能", value: Math.min(100, Math.abs(selectedCommodity.changePct) * 20 + 40) },
                  { subject: "52W位置", value: Math.round(((selectedCommodity.price - selectedCommodity.low52w) / (selectedCommodity.high52w - selectedCommodity.low52w)) * 100) },
                ]}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 9 }} />
                  <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Early Warning Panel */}
          <div className="bg-gray-900/50 border border-yellow-800/40 rounded p-4">
            <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2"><AlertTriangle size={14} />早期预警信号面板</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: "供应中断风险", level: "高", desc: "西非可可产区降雨量偏低30%，供应缺口预计扩大", color: "red" },
                { title: "需求冲击信号", level: "中", desc: "中国铜进口环比下降8%，工业需求复苏放缓", color: "yellow" },
                { title: "库存异常预警", level: "低", desc: "EIA原油库存连续3周超预期增加，价格承压", color: "green" },
              ].map((w, i) => (
                <div key={i} className={`p-3 rounded border ${w.color === "red" ? "border-red-800/50 bg-red-900/10" : w.color === "yellow" ? "border-yellow-800/50 bg-yellow-900/10" : "border-green-800/50 bg-green-900/10"}`}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-white">{w.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${w.color === "red" ? "bg-red-500/20 text-red-400" : w.color === "yellow" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}>{w.level}</span>
                  </div>
                  <p className="text-xs text-gray-400">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: 供需因果 ── */}
      {activeTab === "supplydemand" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-sm text-gray-400">选择商品：</span>
            {COMMODITIES.slice(0, 6).map(c => (
              <button key={c.symbol} onClick={() => setSelectedCommodity(c)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${selectedCommodity.symbol === c.symbol ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-3">{selectedCommodity.name} — 供需平衡模型</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={supplyDemandData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="supply" name="供应量" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="demand" name="需求量" fill="#22c55e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-3">{selectedCommodity.name} — 库存变化趋势</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={supplyDemandData}>
                  <defs>
                    <linearGradient id="invGradGLCO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                  <Area type="monotone" dataKey="inventory" name="库存" stroke="#f59e0b" fill="url(#invGradGLCO)" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-3">宏观驱动因素权重分析</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { factor: "OPEC政策", weight: 35, direction: "收紧供应", color: "#ef4444" },
                { factor: "美元指数", weight: 22, direction: "走强压制", color: "#f59e0b" },
                { factor: "中国需求", weight: 28, direction: "复苏中", color: "#22c55e" },
                { factor: "地缘风险", weight: 15, direction: "升温", color: "#ef4444" },
              ].map(f => (
                <div key={f.factor} className="text-center">
                  <div className="text-xs text-gray-400 mb-1">{f.factor}</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: f.color }}>{f.weight}%</div>
                  <div className="text-xs mt-0.5" style={{ color: f.color }}>{f.direction}</div>
                  <div className="mt-2 h-1.5 bg-gray-800 rounded">
                    <div className="h-1.5 rounded" style={{ width: `${f.weight * 2.5}%`, backgroundColor: f.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: 季节性分析 ── */}
      {activeTab === "seasonal" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-sm text-gray-400">选择商品：</span>
            {COMMODITIES.slice(0, 4).map(c => (
              <button key={c.symbol} onClick={() => setSelectedCommodity(c)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${selectedCommodity.symbol === c.symbol ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                {c.name}
              </button>
            ))}
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-3">{selectedCommodity.name} — 月度季节性规律（% 月均涨跌）</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={seasonalData} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }}
                  formatter={(v: number) => [`${(v as number).toFixed(2)}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="avg5y" name="5年均值" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="avg10y" name="10年均值" fill="#6b7280" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="current" name="当前年度" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-3">季节性偏差明细表 — 当前年度 vs 历史均值</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left p-2">月份</th>
                    <th className="text-right p-2">当前年度</th>
                    <th className="text-right p-2">5年均值</th>
                    <th className="text-right p-2">10年均值</th>
                    <th className="text-right p-2">偏差(vs 5Y)</th>
                    <th className="p-2">偏差可视化</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonalData.map((row, i) => {
                    const dev = row.current - row.avg5y;
                    return (
                      <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30">
                        <td className="p-2 text-gray-300">{row.month}</td>
                        <td className={`p-2 text-right font-mono ${row.current >= 0 ? "text-green-400" : "text-red-400"}`}>{row.current.toFixed(2)}%</td>
                        <td className="p-2 text-right font-mono text-gray-400">{row.avg5y.toFixed(2)}%</td>
                        <td className="p-2 text-right font-mono text-gray-500">{row.avg10y.toFixed(2)}%</td>
                        <td className={`p-2 text-right font-mono font-bold ${dev >= 0 ? "text-green-400" : "text-red-400"}`}>{dev >= 0 ? "+" : ""}{dev.toFixed(2)}%</td>
                        <td className="p-2">
                          <div className="w-20 h-2 bg-gray-800 rounded relative">
                            <div className="absolute top-0 h-2 rounded" style={{
                              left: dev < 0 ? `${Math.max(0, 50 + dev * 5)}%` : "50%",
                              width: `${Math.min(50, Math.abs(dev) * 5)}%`,
                              backgroundColor: dev >= 0 ? "#22c55e" : "#ef4444"
                            }} />
                            <div className="absolute top-0 left-1/2 w-px h-2 bg-gray-600" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: 相关性矩阵 ── */}
      {activeTab === "correlation" && (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-1">商品跨品种相关性矩阵（滚动90天）</h3>
            <p className="text-xs text-gray-500 mb-4">绿色=正相关，红色=负相关，颜色深度代表相关强度</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-gray-500 text-left w-20">品种</th>
                    {CORR_PAIRS.map(p => <th key={p} className="p-2 text-gray-400 text-center w-16">{p}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CORR_PAIRS.map((row, i) => (
                    <tr key={row}>
                      <td className="p-2 text-gray-300 font-medium">{row}</td>
                      {CORR_MATRIX[i].map((val, j) => <CorrCell key={j} value={val} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-3">原油 vs 铜 — 滚动相关性散点图</h3>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" dataKey="x" name="原油涨跌%" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis type="number" dataKey="y" name="铜涨跌%" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                  <Scatter data={Array.from({ length: 30 }, (_, i) => ({ x: +(Math.sin(i) * 3).toFixed(2), y: +(Math.sin(i) * 2 + ((Math.sin(Date.now() * 0.001 + Math.random()) - Math.floor(Math.sin(Date.now() * 0.001 + Math.random()))) - 0.5)).toFixed(2) }))} fill="#f59e0b" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-3">小麦 vs 大豆 — 高相关品种联动</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={Array.from({ length: 20 }, (_, i) => ({ day: `${i + 1}日`, wheat: +(548 + Math.sin(i * 0.8) * 12).toFixed(2), soy: +(1168 + Math.sin(i * 0.8) * 28).toFixed(2) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="wheat" name="小麦" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="soy" name="大豆" stroke="#22c55e" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: 事件链追踪（交互节点图）── */}
      {activeTab === "causal" && (
        <CausalNodeGraph
          events={CAUSAL_EVENTS}
          selectedCommodity={selectedCommodity}
          priceHistory={priceHistory}
          onSelectCommodity={setSelectedCommodity}
        />
      )}

      {/* ── Tab 6: AI策略信号 ── */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <DerivativesAIPanel moduleCode="GLCO" moduleName="全球商品价格" accentColor="amber" liveMetrics={liveMetrics} />
          <div className="mt-4">
            <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2"><Zap size={14} />量化AI信号面板</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AI_SIGNALS.map((sig, i) => (
                <div key={i} className={`bg-gray-900/50 border rounded p-4 transition-all ${confirmedSignals.has(i) ? "border-green-500/50 bg-green-500/5" : "border-gray-800"}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-bold text-white">{sig.commodity}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <SignalBadge signal={sig.signal} />
                        <span className="text-xs text-gray-500">置信度: <span className="text-white font-mono">{sig.confidence}%</span></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">目标价</div>
                      <div className="text-sm font-mono font-bold text-green-400">{sig.targetPrice.toLocaleString()}</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{sig.reason}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">止损: <span className="text-red-400 font-mono">{sig.stopLoss.toLocaleString()}</span></div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-800 rounded">
                        <div className="h-1.5 rounded bg-blue-400" style={{ width: `${sig.confidence}%` }} />
                      </div>
                      {confirmedSignals.has(i) ? (
                        <span className="text-xs text-green-400 flex items-center gap-1"><Activity size={10} />已确认</span>
                      ) : (
                        <button onClick={() => setAiConfirmIdx(i)}
                          className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded hover:bg-amber-500/30 transition-colors">
                          确认执行
                        </button>
                      )}
                    </div>
                  </div>
                  {aiConfirmIdx === i && (
                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                      <div className="text-xs text-yellow-400 mb-2">⚠️ 确认执行 {sig.signal} {sig.commodity} 策略？</div>
                      <div className="flex gap-2">
                        <button onClick={() => handleConfirmSignal(i)}
                          className="flex-1 text-xs py-1 bg-green-500/20 text-green-400 border border-green-500/40 rounded hover:bg-green-500/30">确认</button>
                        <button onClick={() => setAiConfirmIdx(null)}
                          className="flex-1 text-xs py-1 bg-gray-800 text-gray-400 border border-gray-700 rounded hover:bg-gray-700">取消</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2"><Target size={14} />历史信号胜率追踪</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={[
                  { period: "近7天", winRate: 72, count: 8 },
                  { period: "近30天", winRate: 68, count: 32 },
                  { period: "近90天", winRate: 65, count: 89 },
                  { period: "近180天", winRate: 63, count: 178 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="period" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                  <Bar dataKey="winRate" name="胜率" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 7: 量子混合计算引擎 ─── */}
      {activeTab === "quantum" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 量子退火优化 */}
            <div className="bg-gray-900/50 border border-purple-500/30 rounded p-4">
              <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">⚛️ 量子退火优化引擎</h3>
              <p className="text-xs text-gray-400 mb-3">基于 QAOA 算法对商品投资组合进行量子优化，解决传统算法无法处理的高维 QUBO 问题</p>
              <div className="space-y-2">
                {[
                  { label: "组合优化维度", value: "2,048 变量", color: "text-purple-400" },
                  { label: "量子比特数", value: "127 qubits", color: "text-blue-400" },
                  { label: "优化迭代次数", value: "10,000 次", color: "text-cyan-400" },
                  { label: "相比经典算法加速", value: "128×", color: "text-green-400" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-gray-500">{item.label}</span>
                    <span className={`font-mono font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 bg-purple-500/10 rounded border border-purple-500/20">
                <div className="text-xs text-purple-300 mb-1 font-mono">最优组合权重</div>
                <div className="flex gap-1 flex-wrap">
                  {["WTI 28%", "黄金 22%", "铜 18%", "大豆 15%", "可可 12%", "白银 5%"].map(w => (
                    <span key={w} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">{w}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 量子机器学习 */}
            <div className="bg-gray-900/50 border border-blue-500/30 rounded p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">🔬 量子机器学习预测</h3>
              <p className="text-xs text-gray-400 mb-3">QNN 量子神经网络识别商品价格微结构中的非线性模式，挖掘套利机会</p>
              <div className="space-y-2">
                {[
                  { model: "QSVM 分类器", acc: 94, type: "价格趋势预测" },
                  { model: "QNN 神经网络", acc: 91, type: "异常信号检测" },
                  { model: "量子核方法", acc: 88, type: "套利机会识别" },
                  { model: "混合 QML", acc: 92, type: "综合预测" },
                ].map(m => (
                  <div key={m.model} className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-blue-300 font-mono">{m.model}</span>
                      <span className="text-blue-400 font-bold">{m.acc}%</span>
                    </div>
                    <div className="flex-1 h-1 bg-gray-700 rounded"><div className="h-1 bg-blue-400 rounded" style={{ width: `${m.acc}%` }} /></div>
                    <div className="text-[10px] text-gray-500 mt-1">{m.type}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 抗量子密码学 */}
            <div className="bg-gray-900/50 border border-cyan-500/30 rounded p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">🔐 抗量子密码学</h3>
              <p className="text-xs text-gray-400 mb-3">NIST 标准化 PQC 算法保护交易数据，应对未来量子计算机威胁</p>
              <div className="space-y-2">
                {[
                  { algo: "CRYSTALS-Kyber", type: "密钥封装", status: "active", level: 95 },
                  { algo: "CRYSTALS-Dilithium", type: "数字签名", status: "active", level: 92 },
                  { algo: "SPHINCS+", type: "哈希签名", status: "active", level: 88 },
                  { algo: "FALCON", type: "格签名", status: "standby", level: 85 },
                ].map(a => (
                  <div key={a.algo} className="p-2 bg-cyan-500/10 rounded border border-cyan-500/20">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-cyan-300 font-mono text-[10px]">{a.algo}</span>
                      <span className={`text-[10px] px-1.5 rounded ${a.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{a.status === 'active' ? '运行中' : '备用'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">{a.type}</span>
                      <div className="flex-1 h-1 bg-gray-700 rounded"><div className="h-1 bg-cyan-400 rounded" style={{ width: `${a.level}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 量子-经典混合性能对比 */}
          <div className="bg-gray-900/50 border border-amber-500/30 rounded p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-3">⚡ 量子-经典混合计算性能对比</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { task: "投资组合优化", quantum: 1280, classical: 10240, speedup: "8×" },
                { task: "衍生品定价", quantum: 640, classical: 5120, speedup: "8×" },
                { task: "风险因子分析", quantum: 960, classical: 7680, speedup: "8×" },
                { task: "套利路径搜索", quantum: 512, classical: 4096, speedup: "8×" },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="task" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="quantum" name="量子混合 (ms)" fill="#a78bfa" radius={[2, 2, 0, 0]} />
                <Bar dataKey="classical" name="经典算法 (ms)" fill="#6b7280" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Tab 8: 全球经济数字孪生模拟器 ─── */}
      {activeTab === "twin" && (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-emerald-500/30 rounded p-4">
            <h3 className="text-sm font-bold text-emerald-400 mb-1">🌐 全球经济数字孪生模拟器</h3>
            <p className="text-xs text-gray-400 mb-4">基于多智能体系统（MAS）+ 系统动力学建模，实时模拟全球商品市场的供需连锁反应。输入情景假设，系统推演多层级经济实体间的反馈循环。</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 情景构建器 */}
              <div className="bg-gray-800/50 border border-emerald-500/20 rounded p-3">
                <h4 className="text-xs font-bold text-emerald-300 mb-2">📊 情景构建器</h4>
                <div className="space-y-2">
                  {[
                    { scenario: "中东供应中断 -30%", impact: "WTI +$18/桶", chain: "3 跳", confidence: 94 },
                    { scenario: "中国需求复苏 +25%", impact: "铜 +12%", chain: "4 跳", confidence: 87 },
                    { scenario: "美元升值 +5%", impact: "商品 -8%", chain: "2 跳", confidence: 91 },
                    { scenario: "气候异常减产 -20%", impact: "农产品 +15%", chain: "5 跳", confidence: 79 },
                  ].map(s => (
                    <div key={s.scenario} className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-mono text-emerald-300">{s.scenario}</span>
                        <span className="text-[10px] text-emerald-400 font-bold">{s.confidence}%</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>{s.impact}</span>
                        <span>{s.chain} 因果链</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 模拟结果 */}
              <div className="bg-gray-800/50 border border-emerald-500/20 rounded p-3">
                <h4 className="text-xs font-bold text-emerald-300 mb-2">🎯 模拟结果</h4>
                <div className="space-y-2">
                  {[
                    { level: "微观层", entity: "供应链企业", impact: "成本 +18%, 利润 -12%", status: "风险" },
                    { level: "中观层", entity: "行业平均", impact: "价格 +8%, 需求 -3%", status: "中性" },
                    { level: "宏观层", entity: "全球经济", impact: "通胀 +0.8%, GDP -0.2%", status: "压力" },
                    { level: "金融层", entity: "资产价格", impact: "债券 -2%, 股票 -1.5%", status: "下行" },
                  ].map(r => (
                    <div key={r.level} className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-mono text-emerald-300">{r.level}</span>
                        <span className={`text-[10px] px-1.5 rounded ${
                          r.status === '风险' ? 'bg-red-500/20 text-red-400' :
                          r.status === '压力' ? 'bg-orange-500/20 text-orange-400' :
                          r.status === '中性' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{r.status}</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{r.entity}: {r.impact}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 因果链推演可视化 */}
            <div className="bg-gray-800/50 border border-emerald-500/20 rounded p-3">
              <h4 className="text-xs font-bold text-emerald-300 mb-2">🔗 因果链推演 (中东供应中断场景)</h4>
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-2 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" />触发: 中东地缘冲突 → 原油供应减少 30%</div>
                <div className="flex items-center gap-2 ml-4 text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-400" />一阶: Brent 库存骤降 → 期货升水扩大 → 炼厂利润扩张</div>
                <div className="flex items-center gap-2 ml-8 text-orange-400"><span className="w-2 h-2 rounded-full bg-orange-400" />二阶: 运费上升 → 成品油成本增加 → 汽油零售价上升 2.5%</div>
                <div className="flex items-center gap-2 ml-12 text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />三阶: 消费者支出压缩 → 需求侧衰退 → 通胀预期升温 → 央行加息预期</div>
                <div className="flex items-center gap-2 ml-16 text-purple-400"><span className="w-2 h-2 rounded-full bg-purple-400" />四阶: 美元升值 → 新兴市场资本外流 → 全球风险资产承压 → 商品整体下跌</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 9: Neuro-Adaptive UI ─── */}
      {activeTab === "neuro" && (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-pink-500/30 rounded p-4">
            <h3 className="text-sm font-bold text-pink-400 mb-3">🧠 生物反馈与情绪干预界面</h3>
            <p className="text-xs text-gray-400 mb-4">通过可穿戴设备采集心率变异性（HRV）、皮肤电反应（GSR）、脑电波（EEG）等生物信号，实时识别交易员的情绪和认知状态，自适应调整界面和信息呈现方式，优化决策质量。</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 生物传感器数据 */}
              <div className="bg-gray-800/50 border border-pink-500/20 rounded p-3">
                <h4 className="text-xs font-bold text-pink-300 mb-2">📊 实时生物传感器数据</h4>
                <div className="space-y-2">
                  {[
                    { sensor: "心率变异性 (HRV)", value: "45 ms", status: "正常", trend: "↓ 轻微下降" },
                    { sensor: "皮肤电反应 (GSR)", value: "2.8 μS", status: "激活", trend: "↑ 升高" },
                    { sensor: "脑电波 (EEG)", value: "Alpha: 8.2 Hz", status: "专注", trend: "→ 稳定" },
                    { sensor: "瞳孔扩张", value: "3.5 mm", status: "扩张", trend: "↑ 增大" },
                  ].map(s => (
                    <div key={s.sensor} className="p-2 bg-pink-500/10 rounded border border-pink-500/20">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-pink-300">{s.sensor}</span>
                        <span className={`text-[10px] px-1.5 rounded ${
                          s.status === '正常' ? 'bg-green-500/20 text-green-400' :
                          s.status === '激活' ? 'bg-orange-500/20 text-orange-400' :
                          s.status === '专注' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>{s.status}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span className="font-mono">{s.value}</span>
                        <span>{s.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 情绪识别与干预 */}
              <div className="bg-gray-800/50 border border-pink-500/20 rounded p-3">
                <h4 className="text-xs font-bold text-pink-300 mb-2">🎯 情绪识别与干预建议</h4>
                <div className="space-y-2">
                  {[
                    { emotion: "压力水平", level: 68, severity: "中等", intervention: "建议深呼吸 3 分钟" },
                    { emotion: "焦虑指数", level: 52, severity: "轻微", intervention: "播放舒缓背景音乐" },
                    { emotion: "疲劳程度", level: 35, severity: "低", intervention: "继续保持专注" },
                    { emotion: "决策理性度", level: 78, severity: "高", intervention: "当前状态适合重大决策" },
                  ].map(e => (
                    <div key={e.emotion} className="p-2 bg-pink-500/10 rounded border border-pink-500/20">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-pink-300">{e.emotion}</span>
                        <span className={`text-[10px] px-1.5 rounded ${
                          e.severity === '高' ? 'bg-green-500/20 text-green-400' :
                          e.severity === '中等' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>{e.severity}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-gray-700 rounded"><div className="h-1.5 bg-pink-400 rounded" style={{ width: `${e.level}%` }} /></div>
                        <span className="text-[10px] text-pink-400 font-bold">{e.level}%</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{e.intervention}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 界面自适应调整 */}
            <div className="bg-gray-800/50 border border-pink-500/20 rounded p-3 mt-4">
              <h4 className="text-xs font-bold text-pink-300 mb-2">🎨 界面自适应调整</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { aspect: "信息密度", current: "100%", adapted: "60%", change: "↓ 降低 40%" },
                  { aspect: "关键数据放大", current: "1×", adapted: "1.5×", change: "↑ 放大 50%" },
                  { aspect: "色彩饱和度", current: "100%", adapted: "70%", change: "↓ 降低 30%" },
                  { aspect: "非必要功能", current: "全显示", adapted: "隐藏", change: "↓ 隐藏 80%" },
                ].map(a => (
                  <div key={a.aspect} className="p-2 bg-pink-500/10 rounded border border-pink-500/20">
                    <div className="text-[10px] font-bold text-pink-300 mb-1">{a.aspect}</div>
                    <div className="text-[10px] text-gray-400 mb-1">
                      <div>{a.current} → {a.adapted}</div>
                    </div>
                    <div className="text-[10px] text-pink-400">{a.change}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 决策辅助系统 */}
            <div className="bg-gray-800/50 border border-pink-500/20 rounded p-3 mt-4">
              <h4 className="text-xs font-bold text-pink-300 mb-2">💡 AI 决策辅助系统</h4>
              <div className="space-y-2">
                <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                  <div className="text-xs text-yellow-400 mb-1">⚠️ 情绪风险警告</div>
                  <div className="text-[10px] text-gray-300">您当前压力水平较高（68%），历史数据显示高压状态下的交易胜率下降 12%。建议：1) 暂停 5 分钟休息；2) 重新评估风险偏好；3) 咨询 AI 分析师获取客观建议。</div>
                </div>
                <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <div className="text-xs text-blue-400 mb-1">🤖 AI 分析师建议</div>
                  <div className="text-[10px] text-gray-300">基于当前市场状态和您的生物信号，建议采取保守策略：减少杠杆比例 30%，增加止损点 5%，优先选择低波动性商品（黄金、白银）而非高风险品种（原油、可可）。</div>
                </div>
                <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                  <div className="text-xs text-green-400 mb-1">✅ 历史表现对标</div>
                  <div className="text-[10px] text-gray-300">您在当前情绪状态下的历史交易胜率：72%（高于平均 65%）。您的决策模式与历史高收益交易相似，可以自信执行当前策略。</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
