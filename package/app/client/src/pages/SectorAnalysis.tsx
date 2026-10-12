import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ReferenceLine,
} from "recharts";
import { Building2, BarChart2, Activity, AlertTriangle, Target, Layers } from "lucide-react";

const GICS_SECTORS = [
  { id: "XLK",  label: "信息技术",   color: "#3b82f6", weight: 28.4, ytd: 32.1, pe: 28.5, pb: 7.2, roe: 28.3, div: 0.8,  beta: 1.22, momentum: 82, quality: 74, value: 31, growth: 91 },
  { id: "XLF",  label: "金融",       color: "#10b981", weight: 13.2, ytd: 12.8, pe: 14.2, pb: 1.6, roe: 11.5, div: 2.4,  beta: 1.08, momentum: 58, quality: 62, value: 68, growth: 42 },
  { id: "XLV",  label: "医疗保健",   color: "#8b5cf6", weight: 12.8, ytd: 5.4,  pe: 22.1, pb: 4.1, roe: 18.6, div: 1.6,  beta: 0.72, momentum: 44, quality: 81, value: 52, growth: 58 },
  { id: "XLY",  label: "非必需消费", color: "#f59e0b", weight: 10.5, ytd: 18.3, pe: 31.4, pb: 8.5, roe: 27.1, div: 0.6,  beta: 1.35, momentum: 71, quality: 65, value: 28, growth: 78 },
  { id: "XLP",  label: "必需消费",   color: "#06b6d4", weight: 6.8,  ytd: 3.2,  pe: 19.8, pb: 5.2, roe: 26.4, div: 2.8,  beta: 0.55, momentum: 38, quality: 78, value: 55, growth: 32 },
  { id: "XLE",  label: "能源",       color: "#f97316", weight: 4.2,  ytd: -8.4, pe: 11.5, pb: 1.9, roe: 16.8, div: 3.8,  beta: 0.92, momentum: 28, quality: 55, value: 82, growth: 22 },
  { id: "XLI",  label: "工业",       color: "#84cc16", weight: 8.5,  ytd: 14.2, pe: 21.3, pb: 3.8, roe: 17.9, div: 1.4,  beta: 1.05, momentum: 65, quality: 70, value: 48, growth: 62 },
  { id: "XLB",  label: "材料",       color: "#ec4899", weight: 2.8,  ytd: 6.8,  pe: 17.8, pb: 2.9, roe: 16.2, div: 1.9,  beta: 0.98, momentum: 51, quality: 61, value: 58, growth: 45 },
  { id: "XLRE", label: "房地产",     color: "#a78bfa", weight: 2.5,  ytd: -4.2, pe: 38.5, pb: 2.4, roe: 6.2,  div: 4.2,  beta: 0.82, momentum: 32, quality: 48, value: 45, growth: 28 },
  { id: "XLU",  label: "公用事业",   color: "#fb7185", weight: 2.4,  ytd: 1.8,  pe: 16.2, pb: 1.8, roe: 11.2, div: 3.5,  beta: 0.42, momentum: 35, quality: 52, value: 62, growth: 18 },
  { id: "XLC",  label: "通信服务",   color: "#34d399", weight: 7.9,  ytd: 22.5, pe: 19.4, pb: 3.6, roe: 18.5, div: 1.1,  beta: 1.15, momentum: 74, quality: 68, value: 42, growth: 72 },
];

const SECTOR_STOCKS: Record<string, Array<{ ticker: string; name: string; mktCap: string; pe: number; pb: number; roe: number; ytd: number; rev_growth: number; eps_growth: number; div: number; analyst: string; target: number; last: number }>> = {
  XLK: [
    { ticker: "AAPL",  name: "苹果",    mktCap: "2.95T", pe: 29.2, pb: 46.8, roe: 160.1, ytd: 18.4, rev_growth: 5.2,   eps_growth: 12.8,  div: 0.5,  analyst: "买入", target: 215, last: 189.5 },
    { ticker: "MSFT",  name: "微软",    mktCap: "3.12T", pe: 35.8, pb: 12.4, roe: 34.6,  ytd: 24.2, rev_growth: 15.8,  eps_growth: 22.4,  div: 0.7,  analyst: "强买", target: 480, last: 415.2 },
    { ticker: "NVDA",  name: "英伟达",  mktCap: "2.85T", pe: 62.4, pb: 28.5, roe: 45.8,  ytd: 145.2,rev_growth: 122.4, eps_growth: 288.5, div: 0.03, analyst: "强买", target: 165, last: 130.0 },
    { ticker: "META",  name: "Meta",    mktCap: "1.28T", pe: 22.8, pb: 7.2,  roe: 31.5,  ytd: 48.5, rev_growth: 22.1,  eps_growth: 68.4,  div: 0.4,  analyst: "买入", target: 580, last: 512.4 },
    { ticker: "AVGO",  name: "博通",    mktCap: "0.82T", pe: 28.4, pb: 8.5,  roe: 29.8,  ytd: 52.4, rev_growth: 42.8,  eps_growth: 18.5,  div: 1.8,  analyst: "买入", target: 185, last: 168.2 },
  ],
  XLF: [
    { ticker: "JPM",   name: "摩根大通",mktCap: "0.68T", pe: 11.8, pb: 1.8, roe: 15.2,  ytd: 28.4, rev_growth: 8.5,   eps_growth: 14.2,  div: 2.2,  analyst: "买入", target: 225, last: 198.5 },
    { ticker: "BAC",   name: "美国银行",mktCap: "0.32T", pe: 12.5, pb: 1.2, roe: 9.8,   ytd: 18.2, rev_growth: 4.2,   eps_growth: 8.5,   div: 2.5,  analyst: "持有", target: 42,  last: 38.2  },
    { ticker: "GS",    name: "高盛",    mktCap: "0.18T", pe: 14.2, pb: 1.5, roe: 10.5,  ytd: 32.5, rev_growth: 18.5,  eps_growth: 42.8,  div: 2.8,  analyst: "买入", target: 520, last: 482.5 },
    { ticker: "V",     name: "维萨",    mktCap: "0.56T", pe: 28.5, pb: 12.8,roe: 44.8,  ytd: 12.5, rev_growth: 10.2,  eps_growth: 14.8,  div: 0.8,  analyst: "强买", target: 295, last: 268.5 },
    { ticker: "BRK.B", name: "伯克希尔",mktCap: "0.88T", pe: 21.5, pb: 1.6, roe: 7.5,   ytd: 24.8, rev_growth: 5.8,   eps_growth: 12.5,  div: 0.0,  analyst: "买入", target: 415, last: 388.5 },
  ],
  XLV: [
    { ticker: "LLY",   name: "礼来",    mktCap: "0.82T", pe: 68.5, pb: 28.5, roe: 41.5, ytd: 52.4, rev_growth: 28.5,  eps_growth: 85.2,  div: 0.6,  analyst: "强买", target: 850, last: 782.5 },
    { ticker: "UNH",   name: "联合健康",mktCap: "0.48T", pe: 18.5, pb: 4.8,  roe: 25.8, ytd: -8.5, rev_growth: 8.2,   eps_growth: 5.8,   div: 1.5,  analyst: "买入", target: 580, last: 512.5 },
    { ticker: "JNJ",   name: "强生",    mktCap: "0.38T", pe: 15.8, pb: 4.2,  roe: 26.5, ytd: 2.5,  rev_growth: 4.8,   eps_growth: 8.2,   div: 3.1,  analyst: "持有", target: 165, last: 155.5 },
    { ticker: "ABBV",  name: "艾伯维",  mktCap: "0.32T", pe: 55.2, pb: 21.5, roe: 38.5, ytd: 18.5, rev_growth: 4.2,   eps_growth: -8.5,  div: 3.8,  analyst: "买入", target: 195, last: 178.5 },
    { ticker: "PFE",   name: "辉瑞",    mktCap: "0.15T", pe: 12.5, pb: 1.8,  roe: 14.2, ytd: -18.5,rev_growth: -42.5, eps_growth: -72.5, div: 5.8,  analyst: "持有", target: 28,  last: 25.5  },
  ],
  XLY: [
    { ticker: "AMZN",  name: "亚马逊",  mktCap: "2.05T", pe: 42.5, pb: 8.5,  roe: 20.5, ytd: 28.5, rev_growth: 12.5,  eps_growth: 82.5,  div: 0.0,  analyst: "强买", target: 225, last: 198.5 },
    { ticker: "TSLA",  name: "特斯拉",  mktCap: "0.68T", pe: 55.8, pb: 8.2,  roe: 14.8, ytd: -8.5, rev_growth: 2.5,   eps_growth: -42.5, div: 0.0,  analyst: "持有", target: 215, last: 245.5 },
    { ticker: "HD",    name: "家得宝",  mktCap: "0.38T", pe: 22.5, pb: -1.0, roe: 0.0,  ytd: 8.5,  rev_growth: -1.5,  eps_growth: 2.5,   div: 2.5,  analyst: "买入", target: 385, last: 358.5 },
    { ticker: "MCD",   name: "麦当劳",  mktCap: "0.22T", pe: 22.8, pb: -1.0, roe: 0.0,  ytd: 5.8,  rev_growth: 5.2,   eps_growth: 8.5,   div: 2.2,  analyst: "买入", target: 315, last: 295.5 },
    { ticker: "BKNG",  name: "缤客",    mktCap: "0.14T", pe: 18.5, pb: -1.0, roe: 0.0,  ytd: 22.5, rev_growth: 12.5,  eps_growth: 28.5,  div: 0.0,  analyst: "买入", target: 4200,last: 3850.5},
  ],
  XLE: [
    { ticker: "XOM",   name: "埃克森美孚",mktCap:"0.52T", pe: 13.5, pb: 1.8, roe: 13.5, ytd: -5.5, rev_growth: -8.5,  eps_growth: -22.5, div: 3.5,  analyst: "持有", target: 118, last: 112.5 },
    { ticker: "CVX",   name: "雪佛龙",  mktCap: "0.28T", pe: 14.2, pb: 1.6, roe: 11.2,  ytd: -8.5, rev_growth: -12.5, eps_growth: -28.5, div: 4.2,  analyst: "持有", target: 158, last: 148.5 },
    { ticker: "COP",   name: "康菲石油",mktCap: "0.15T", pe: 12.5, pb: 2.2, roe: 17.5,  ytd: -2.5, rev_growth: -5.5,  eps_growth: -15.5, div: 3.2,  analyst: "买入", target: 128, last: 118.5 },
    { ticker: "SLB",   name: "斯伦贝谢",mktCap: "0.08T", pe: 14.8, pb: 2.8, roe: 18.8,  ytd: -12.5,rev_growth: 12.5,  eps_growth: 18.5,  div: 2.5,  analyst: "买入", target: 58,  last: 48.5  },
    { ticker: "EOG",   name: "EOG资源", mktCap: "0.07T", pe: 11.2, pb: 2.4, roe: 21.5,  ytd: -4.5, rev_growth: -8.5,  eps_growth: -18.5, div: 3.8,  analyst: "买入", target: 138, last: 122.5 },
  ],
  XLI: [
    { ticker: "GE",    name: "通用电气",mktCap: "0.18T", pe: 38.5, pb: 8.5, roe: 22.5,  ytd: 82.5, rev_growth: 18.5,  eps_growth: 125.5, div: 0.3,  analyst: "强买", target: 185, last: 168.5 },
    { ticker: "CAT",   name: "卡特彼勒",mktCap: "0.18T", pe: 15.8, pb: 8.2, roe: 51.5,  ytd: 18.5, rev_growth: 2.5,   eps_growth: 8.5,   div: 1.5,  analyst: "买入", target: 365, last: 335.5 },
    { ticker: "RTX",   name: "雷神技术",mktCap: "0.15T", pe: 35.5, pb: 2.8, roe: 7.8,   ytd: 12.5, rev_growth: 8.5,   eps_growth: 12.5,  div: 2.2,  analyst: "买入", target: 115, last: 105.5 },
    { ticker: "HON",   name: "霍尼韦尔",mktCap: "0.12T", pe: 18.5, pb: 7.5, roe: 40.5,  ytd: 2.5,  rev_growth: 4.5,   eps_growth: 8.5,   div: 2.1,  analyst: "持有", target: 215, last: 198.5 },
    { ticker: "UPS",   name: "联合包裹",mktCap: "0.09T", pe: 18.2, pb: -1.0,roe: 0.0,   ytd: -15.5,rev_growth: -8.5,  eps_growth: -22.5, div: 4.5,  analyst: "持有", target: 148, last: 138.5 },
  ],
  XLC: [
    { ticker: "GOOGL", name: "谷歌",    mktCap: "2.12T", pe: 22.5, pb: 6.5,  roe: 29.5, ytd: 28.5, rev_growth: 12.5,  eps_growth: 28.5,  div: 0.0,  analyst: "强买", target: 195, last: 175.5 },
    { ticker: "NFLX",  name: "奈飞",    mktCap: "0.32T", pe: 38.5, pb: 18.5, roe: 48.5, ytd: 52.5, rev_growth: 15.5,  eps_growth: 82.5,  div: 0.0,  analyst: "买入", target: 715, last: 648.5 },
    { ticker: "DIS",   name: "迪士尼",  mktCap: "0.22T", pe: 42.5, pb: 1.8,  roe: 4.2,  ytd: -5.5, rev_growth: 5.5,   eps_growth: 125.5, div: 0.0,  analyst: "持有", target: 115, last: 105.5 },
    { ticker: "T",     name: "AT&T",    mktCap: "0.12T", pe: 8.5,  pb: 1.2,  roe: 14.2, ytd: 18.5, rev_growth: 1.5,   eps_growth: 8.5,   div: 6.5,  analyst: "持有", target: 18,  last: 16.5  },
    { ticker: "VZ",    name: "威瑞森",  mktCap: "0.16T", pe: 9.5,  pb: 1.5,  roe: 15.5, ytd: -2.5, rev_growth: 0.5,   eps_growth: 2.5,   div: 6.8,  analyst: "持有", target: 42,  last: 38.5  },
  ],
  XLB: [
    { ticker: "LIN",   name: "林德",    mktCap: "0.22T", pe: 28.5, pb: 4.5,  roe: 16.2, ytd: 12.5, rev_growth: 2.5,   eps_growth: 12.5,  div: 1.2,  analyst: "买入", target: 465, last: 428.5 },
    { ticker: "SHW",   name: "宣伟",    mktCap: "0.09T", pe: 28.8, pb: 18.5, roe: 65.5, ytd: 8.5,  rev_growth: 2.5,   eps_growth: 15.5,  div: 0.9,  analyst: "买入", target: 365, last: 335.5 },
    { ticker: "FCX",   name: "自由港",  mktCap: "0.06T", pe: 22.5, pb: 2.8,  roe: 12.5, ytd: 5.5,  rev_growth: 5.5,   eps_growth: 18.5,  div: 1.5,  analyst: "买入", target: 48,  last: 42.5  },
    { ticker: "NEM",   name: "纽蒙特",  mktCap: "0.05T", pe: 18.5, pb: 1.8,  roe: 9.8,  ytd: 22.5, rev_growth: 15.5,  eps_growth: 28.5,  div: 2.2,  analyst: "买入", target: 48,  last: 42.5  },
    { ticker: "APD",   name: "空气化工",mktCap: "0.06T", pe: 22.5, pb: 3.8,  roe: 17.5, ytd: 2.5,  rev_growth: -2.5,  eps_growth: 5.5,   div: 2.5,  analyst: "持有", target: 275, last: 258.5 },
  ],
  XLP: [
    { ticker: "PG",    name: "宝洁",    mktCap: "0.38T", pe: 24.5, pb: 7.8,  roe: 31.5, ytd: 5.5,  rev_growth: 3.5,   eps_growth: 8.5,   div: 2.4,  analyst: "持有", target: 165, last: 155.5 },
    { ticker: "KO",    name: "可口可乐",mktCap: "0.28T", pe: 22.5, pb: 10.5, roe: 47.5, ytd: 2.5,  rev_growth: 5.5,   eps_growth: 8.5,   div: 3.1,  analyst: "持有", target: 68,  last: 62.5  },
    { ticker: "PEP",   name: "百事可乐",mktCap: "0.22T", pe: 20.5, pb: 12.5, roe: 61.5, ytd: -5.5, rev_growth: 2.5,   eps_growth: 5.5,   div: 3.2,  analyst: "持有", target: 165, last: 155.5 },
    { ticker: "WMT",   name: "沃尔玛",  mktCap: "0.68T", pe: 28.5, pb: 7.5,  roe: 26.5, ytd: 28.5, rev_growth: 5.5,   eps_growth: 12.5,  div: 1.2,  analyst: "买入", target: 85,  last: 78.5  },
    { ticker: "COST",  name: "好市多",  mktCap: "0.38T", pe: 48.5, pb: 12.5, roe: 25.5, ytd: 22.5, rev_growth: 8.5,   eps_growth: 15.5,  div: 0.7,  analyst: "买入", target: 895, last: 828.5 },
  ],
  XLRE: [
    { ticker: "PLD",   name: "普洛斯",  mktCap: "0.10T", pe: 42.5, pb: 2.8,  roe: 6.5,  ytd: -5.5, rev_growth: 8.5,   eps_growth: 12.5,  div: 3.2,  analyst: "买入", target: 125, last: 112.5 },
    { ticker: "AMT",   name: "美国铁塔",mktCap: "0.09T", pe: 48.5, pb: -1.0, roe: 0.0,  ytd: -8.5, rev_growth: 5.5,   eps_growth: 8.5,   div: 3.5,  analyst: "持有", target: 195, last: 178.5 },
    { ticker: "EQIX",  name: "Equinix",mktCap: "0.08T", pe: 88.5, pb: 4.5,  roe: 5.2,  ytd: 2.5,  rev_growth: 12.5,  eps_growth: 18.5,  div: 2.1,  analyst: "买入", target: 865, last: 798.5 },
    { ticker: "SPG",   name: "西蒙地产",mktCap: "0.06T", pe: 22.5, pb: -1.0, roe: 0.0,  ytd: 8.5,  rev_growth: 5.5,   eps_growth: 8.5,   div: 5.5,  analyst: "持有", target: 158, last: 145.5 },
    { ticker: "O",     name: "Realty",  mktCap: "0.05T", pe: 42.5, pb: 1.5,  roe: 3.5,  ytd: -2.5, rev_growth: 8.5,   eps_growth: 5.5,   div: 5.8,  analyst: "持有", target: 58,  last: 52.5  },
  ],
  XLU: [
    { ticker: "NEE",   name: "下一代能源",mktCap:"0.12T", pe: 18.5, pb: 2.5, roe: 13.5, ytd: 5.5,  rev_growth: 8.5,   eps_growth: 8.5,   div: 3.2,  analyst: "买入", target: 68,  last: 62.5  },
    { ticker: "DUK",   name: "杜克能源",mktCap: "0.08T", pe: 18.5, pb: 1.5, roe: 8.2,   ytd: 2.5,  rev_growth: 5.5,   eps_growth: 5.5,   div: 4.2,  analyst: "持有", target: 108, last: 98.5  },
    { ticker: "SO",    name: "南方公司",mktCap: "0.09T", pe: 18.5, pb: 2.2, roe: 11.5,  ytd: 5.5,  rev_growth: 5.5,   eps_growth: 8.5,   div: 3.8,  analyst: "持有", target: 88,  last: 82.5  },
    { ticker: "AEP",   name: "美国电力",mktCap: "0.05T", pe: 16.5, pb: 1.8, roe: 10.5,  ytd: 8.5,  rev_growth: 5.5,   eps_growth: 8.5,   div: 3.5,  analyst: "持有", target: 98,  last: 88.5  },
    { ticker: "EXC",   name: "Exelon",  mktCap: "0.04T", pe: 15.5, pb: 1.5, roe: 9.5,   ytd: 2.5,  rev_growth: 2.5,   eps_growth: 5.5,   div: 3.8,  analyst: "持有", target: 38,  last: 35.5  },
  ],
};

const ROTATION_DATA = [
  { month: "1月",  XLK: 5.2,  XLF: 3.8,  XLV: 1.2,  XLY: 4.5,  XLE: -2.5, XLI: 2.8,  XLC: 4.2  },
  { month: "2月",  XLK: 3.8,  XLF: 2.5,  XLV: 0.8,  XLY: 2.2,  XLE: -1.8, XLI: 1.5,  XLC: 3.5  },
  { month: "3月",  XLK: -1.5, XLF: 1.2,  XLV: 2.5,  XLY: -0.8, XLE: 3.5,  XLI: 0.8,  XLC: -1.2 },
  { month: "4月",  XLK: 4.5,  XLF: -0.5, XLV: 1.8,  XLY: 3.2,  XLE: -3.2, XLI: 2.2,  XLC: 3.8  },
  { month: "5月",  XLK: 2.8,  XLF: 3.5,  XLV: 0.5,  XLY: 1.5,  XLE: 2.5,  XLI: 1.8,  XLC: 2.5  },
  { month: "6月",  XLK: 6.5,  XLF: 1.8,  XLV: -0.5, XLY: 4.8,  XLE: -4.5, XLI: 3.5,  XLC: 5.8  },
  { month: "7月",  XLK: 3.2,  XLF: 4.5,  XLV: 2.2,  XLY: 2.8,  XLE: 1.5,  XLI: 2.5,  XLC: 2.8  },
  { month: "8月",  XLK: -2.5, XLF: -1.5, XLV: 1.5,  XLY: -1.8, XLE: -2.8, XLI: -1.2, XLC: -2.2 },
  { month: "9月",  XLK: 4.8,  XLF: 2.8,  XLV: 0.8,  XLY: 3.5,  XLE: -1.5, XLI: 2.8,  XLC: 4.2  },
  { month: "10月", XLK: 1.5,  XLF: 3.2,  XLV: 1.2,  XLY: 0.8,  XLE: 2.8,  XLI: 1.5,  XLC: 1.8  },
  { month: "11月", XLK: 5.8,  XLF: 4.8,  XLV: 1.5,  XLY: 4.2,  XLE: -1.2, XLI: 3.8,  XLC: 5.2  },
  { month: "12月", XLK: 2.5,  XLF: 2.2,  XLV: 0.5,  XLY: 1.8,  XLE: 0.8,  XLI: 1.5,  XLC: 2.2  },
];

const FACTOR_SCORES = [
  { factor: "动量",  XLK: 82, XLF: 58, XLV: 44, XLY: 71, XLE: 28, XLI: 65, XLC: 74 },
  { factor: "质量",  XLK: 74, XLF: 62, XLV: 81, XLY: 65, XLE: 55, XLI: 70, XLC: 68 },
  { factor: "价值",  XLK: 31, XLF: 68, XLV: 52, XLY: 28, XLE: 82, XLI: 48, XLC: 42 },
  { factor: "成长",  XLK: 91, XLF: 42, XLV: 58, XLY: 78, XLE: 22, XLI: 62, XLC: 72 },
  { factor: "低波",  XLK: 35, XLF: 52, XLV: 78, XLY: 38, XLE: 48, XLI: 55, XLC: 42 },
];

function fmt(n: number, d = 1) { return n.toFixed(d); }
function pctColor(v: number) { return v >= 0 ? "text-green-400" : "text-red-400"; }
const ANALYST_COLORS: Record<string, string> = {
  "强买": "bg-green-500/20 text-green-300 border-green-500/30",
  "买入": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "持有": "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "卖出": "bg-red-500/20 text-red-300 border-red-500/30",
};

export default function SectorAnalysis() {
  const [selectedSector, setSelectedSector] = useState("XLK");
  const [activeTab, setActiveTab] = useState("overview");
  const [rotationPeriod, setRotationPeriod] = useState<"3M" | "6M" | "12M">("12M");

  const sectorInfo = GICS_SECTORS.find(s => s.id === selectedSector)!;
  const stocks = SECTOR_STOCKS[selectedSector] ?? [];

  const radarData = useMemo(() => [
    { factor: "动量",  value: sectorInfo.momentum },
    { factor: "质量",  value: sectorInfo.quality  },
    { factor: "价值",  value: sectorInfo.value    },
    { factor: "成长",  value: sectorInfo.growth   },
    { factor: "低波动", value: 100 - Math.round(sectorInfo.beta * 50) },
  ], [sectorInfo]);

  const rotationMonths = rotationPeriod === "3M" ? 3 : rotationPeriod === "6M" ? 6 : 12;
  const rotationSlice = ROTATION_DATA.slice(-rotationMonths);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* 页头 */}
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-emerald-400">行业分组分析</h1>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">GICS 11大行业</Badge>
          </div>
          <p className="text-slate-400 text-xs">行业轮动 · 估值对标 · 因子暴露 · 龙头企业 · 分析师评级</p>
        </div>
        <Select value={selectedSector} onValueChange={setSelectedSector}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100 w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {GICS_SECTORS.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                <span className="font-mono text-slate-400 mr-2">{s.id}</span>{s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 行业概览卡片 */}
      <div className="px-4 py-3 grid grid-cols-4 md:grid-cols-8 gap-2">
        {[
          { label: "标普500权重", value: `${sectorInfo.weight}%`,                                      color: "text-slate-100" },
          { label: "YTD收益",    value: `${sectorInfo.ytd >= 0 ? "+" : ""}${sectorInfo.ytd}%`,         color: pctColor(sectorInfo.ytd) },
          { label: "市盈率(P/E)", value: `${sectorInfo.pe}x`,                                           color: "text-amber-400" },
          { label: "市净率(P/B)", value: `${sectorInfo.pb}x`,                                           color: "text-amber-400" },
          { label: "ROE",        value: `${sectorInfo.roe}%`,                                           color: "text-blue-400" },
          { label: "股息率",     value: `${sectorInfo.div}%`,                                           color: "text-emerald-400" },
          { label: "Beta系数",   value: `${sectorInfo.beta}`,                                           color: sectorInfo.beta > 1 ? "text-orange-400" : "text-slate-300" },
          { label: "动量评分",   value: `${sectorInfo.momentum}/100`,                                   color: sectorInfo.momentum > 60 ? "text-green-400" : "text-slate-400" },
        ].map(m => (
          <div key={m.label} className="bg-slate-900 border border-slate-800 rounded p-2">
            <div className="text-slate-500 text-[10px] mb-0.5">{m.label}</div>
            <div className={`font-bold text-sm ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* 主 Tab */}
      <div className="px-4 pb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/60 border border-slate-700 mb-4 h-8">
            {[
              { key: "overview", label: "行业总览" },
              { key: "rotation", label: "轮动分析" },
              { key: "valuation", label: "估值对标" },
              { key: "factor",   label: "因子暴露" },
              { key: "stocks",   label: "龙头企业" },
            ].map(t => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs h-7 px-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── 行业总览 ── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />11大行业 YTD 收益率排名
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={[...GICS_SECTORS].sort((a, b) => b.ytd - a.ytd)} layout="vertical" margin={{ left: 60, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} width={56} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, "YTD收益"]} />
                    <ReferenceLine x={0} stroke="#475569" strokeDasharray="3 3" />
                    <Bar dataKey="ytd" radius={[0, 3, 3, 0]}>
                      {[...GICS_SECTORS].sort((a, b) => b.ytd - a.ytd).map(s => <Cell key={s.id} fill={s.ytd >= 0 ? "#10b981" : "#ef4444"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />{sectorInfo.label} — 多因子评分雷达
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="factor" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 9 }} />
                    <Radar dataKey="value" stroke={sectorInfo.color} fill={sectorInfo.color} fillOpacity={0.3} strokeWidth={2} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-5 gap-1 mt-2">
                  {radarData.map(d => (
                    <div key={d.factor} className="text-center">
                      <div className="text-[10px] text-slate-400">{d.factor}</div>
                      <div className={`text-xs font-bold ${d.value >= 70 ? "text-green-400" : d.value >= 40 ? "text-amber-400" : "text-red-400"}`}>{d.value}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />行业权重 vs YTD收益 分布
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="weight" name="权重" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "标普500权重(%)", fill: "#64748b", fontSize: 10, position: "insideBottom", offset: -5 }} />
                    <YAxis dataKey="ytd" name="YTD" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "YTD(%)", fill: "#64748b", fontSize: 10, angle: -90, position: "insideLeft" }} />
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} formatter={(v: number, name: string) => [name === "ytd" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : `${v}%`, name === "ytd" ? "YTD收益" : "指数权重"]} />
                    <Scatter data={GICS_SECTORS} fill="#10b981">
                      {GICS_SECTORS.map(s => <Cell key={s.id} fill={s.color} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />估值热力概览
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-1.5 px-2 text-slate-400">行业</th>
                        <th className="text-right py-1.5 px-2 text-slate-400">P/E</th>
                        <th className="text-right py-1.5 px-2 text-slate-400">P/B</th>
                        <th className="text-right py-1.5 px-2 text-slate-400">ROE</th>
                        <th className="text-right py-1.5 px-2 text-slate-400">股息率</th>
                        <th className="text-right py-1.5 px-2 text-slate-400">Beta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GICS_SECTORS.map(s => (
                        <tr key={s.id} className={`border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors ${s.id === selectedSector ? "bg-slate-800/60" : ""}`} onClick={() => setSelectedSector(s.id)}>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                              <span className="text-slate-200 font-medium">{s.label}</span>
                              <span className="text-slate-500 font-mono text-[10px]">{s.id}</span>
                            </div>
                          </td>
                          <td className={`py-1.5 px-2 text-right font-mono font-semibold ${s.pe > 30 ? "text-red-400" : "text-amber-400"}`}>{s.pe}x</td>
                          <td className={`py-1.5 px-2 text-right font-mono font-semibold ${s.pb > 6 ? "text-red-400" : "text-slate-300"}`}>{s.pb}x</td>
                          <td className="py-1.5 px-2 text-right font-mono text-blue-400">{s.roe}%</td>
                          <td className="py-1.5 px-2 text-right font-mono text-emerald-400">{s.div}%</td>
                          <td className={`py-1.5 px-2 text-right font-mono ${s.beta > 1.2 ? "text-orange-400" : s.beta < 0.7 ? "text-blue-400" : "text-slate-300"}`}>{s.beta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ── 轮动分析 ── */}
          <TabsContent value="rotation">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-400">周期：</span>
              {(["3M", "6M", "12M"] as const).map(p => (
                <button key={p} onClick={() => setRotationPeriod(p)}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${rotationPeriod === p ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500"}`}>
                  {p}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">主要行业月度收益率（%）</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={rotationSlice}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v.toFixed(1)}%`]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                    {(["XLK", "XLF", "XLV", "XLY", "XLE", "XLI", "XLC"] as const).map(id => {
                      const s = GICS_SECTORS.find(s => s.id === id)!;
                      return <Line key={id} type="monotone" dataKey={id} name={s.label} stroke={s.color} dot={false} strokeWidth={id === selectedSector ? 2.5 : 1.5} strokeOpacity={id === selectedSector ? 1 : 0.5} />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">行业动量评分排名</h3>
                <div className="space-y-2">
                  {[...GICS_SECTORS].sort((a, b) => b.momentum - a.momentum).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/40 rounded px-2 py-1 transition-colors" onClick={() => setSelectedSector(s.id)}>
                      <span className="text-slate-500 text-xs w-4">{i + 1}</span>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-slate-200 text-xs w-20">{s.label}</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${s.momentum}%`, backgroundColor: s.color }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: s.color }}>{s.momentum}</span>
                      <span className={`text-xs font-semibold w-14 text-right ${pctColor(s.ytd)}`}>{s.ytd >= 0 ? "+" : ""}{s.ytd}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ── 估值对标 ── */}
          <TabsContent value="valuation">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">各行业市盈率(P/E)对比</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={GICS_SECTORS.map(s => ({ name: s.label.slice(0, 4), fullName: s.label, pe: s.pe, color: s.color }))} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={v => `${v}x`} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} formatter={(v: number) => [`${v}x`, "P/E"]} />
                    <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "均值 20x", fill: "#f59e0b", fontSize: 9, position: "right" }} />
                    <Bar dataKey="pe" name="P/E" radius={[3, 3, 0, 0]}>
                      {GICS_SECTORS.map(s => <Cell key={s.id} fill={s.pe > 30 ? "#ef4444" : s.pe > 20 ? "#f59e0b" : "#10b981"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">ROE vs 股息率 — 价值象限</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="roe" name="ROE" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "ROE(%)", fill: "#64748b", fontSize: 10, position: "insideBottom", offset: -5 }} />
                    <YAxis dataKey="div" name="股息率" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "股息率(%)", fill: "#64748b", fontSize: 10, angle: -90, position: "insideLeft" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === "roe" ? "ROE" : "股息率"]} />
                    <Scatter data={GICS_SECTORS.map(s => ({ roe: s.roe, div: s.div, label: s.label }))} fill="#10b981">
                      {GICS_SECTORS.map(s => <Cell key={s.id} fill={s.color} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">估值综合对标表</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {["行业", "P/E", "P/B", "ROE", "股息率", "Beta", "YTD", "估值信号"].map(h => (
                          <th key={h} className={`py-2 px-2 text-slate-400 ${h === "行业" ? "text-left" : "text-right"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GICS_SECTORS.map(s => {
                        const signal = s.pe < 15 && s.roe > 12 ? "低估" : s.pe > 35 ? "高估" : "合理";
                        const sc = signal === "低估" ? "bg-green-500/20 text-green-300 border-green-500/30" : signal === "高估" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-slate-500/20 text-slate-300 border-slate-500/30";
                        return (
                          <tr key={s.id} className={`border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer ${s.id === selectedSector ? "bg-slate-800/60" : ""}`} onClick={() => setSelectedSector(s.id)}>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                <span className="text-slate-200 font-medium">{s.label}</span>
                              </div>
                            </td>
                            <td className={`py-1.5 px-2 text-right font-mono font-semibold ${s.pe > 30 ? "text-red-400" : "text-amber-400"}`}>{s.pe}x</td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-300">{s.pb > 0 ? `${s.pb}x` : "N/A"}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-blue-400">{s.roe > 0 ? `${s.roe}%` : "N/A"}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-emerald-400">{s.div}%</td>
                            <td className={`py-1.5 px-2 text-right font-mono ${s.beta > 1.2 ? "text-orange-400" : s.beta < 0.7 ? "text-blue-400" : "text-slate-300"}`}>{s.beta}</td>
                            <td className={`py-1.5 px-2 text-right font-mono font-semibold ${pctColor(s.ytd)}`}>{s.ytd >= 0 ? "+" : ""}{s.ytd}%</td>
                            <td className="py-1.5 px-2 text-right"><Badge className={`text-[10px] ${sc}`}>{signal}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ── 因子暴露 ── */}
          <TabsContent value="factor">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">各行业因子暴露热力图（0-100分）</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-400 w-16">因子</th>
                        {GICS_SECTORS.slice(0, 7).map(s => (
                          <th key={s.id} className="text-center py-2 px-1 w-14" style={{ color: s.color }}>{s.id}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FACTOR_SCORES.map(row => (
                        <tr key={row.factor} className="border-b border-slate-800">
                          <td className="py-2 px-2 text-slate-300 font-medium">{row.factor}</td>
                          {(["XLK", "XLF", "XLV", "XLY", "XLE", "XLI", "XLC"] as const).map(id => {
                            const v = row[id];
                            const bg = v >= 70 ? "rgba(16,185,129,0.4)" : v >= 40 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)";
                            return (
                              <td key={id} className="py-2 px-1 text-center font-bold text-xs" style={{ backgroundColor: bg, color: v >= 70 ? "#34d399" : v >= 40 ? "#fbbf24" : "#f87171" }}>
                                {v}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-slate-500 text-[10px] mt-2">绿色 ≥70 · 黄色 40-70 · 红色 &lt;40</p>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">{sectorInfo.label} — 因子评分详解</h3>
                <div className="space-y-4">
                  {[
                    { factor: "动量",  score: sectorInfo.momentum, desc: "近12个月相对强弱、价格趋势持续性" },
                    { factor: "质量",  score: sectorInfo.quality,  desc: "ROE稳定性、盈利质量、资产负债表健康度" },
                    { factor: "价值",  score: sectorInfo.value,    desc: "P/E、P/B、EV/EBITDA相对历史均值折价" },
                    { factor: "成长",  score: sectorInfo.growth,   desc: "营收增速、EPS增速、分析师预期上调" },
                    { factor: "低波动",score: 100 - Math.round(sectorInfo.beta * 50), desc: "历史波动率、Beta系数、回撤控制" },
                  ].map(f => (
                    <div key={f.factor}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-slate-200 text-xs font-semibold">{f.factor}</span>
                          <span className="text-slate-500 text-[10px] ml-2">{f.desc}</span>
                        </div>
                        <span className={`text-xs font-bold ${f.score >= 70 ? "text-green-400" : f.score >= 40 ? "text-amber-400" : "text-red-400"}`}>{f.score}/100</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${f.score}%`, backgroundColor: f.score >= 70 ? "#10b981" : f.score >= 40 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-slate-800/60 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-400 mb-1">综合评级</div>
                  {(() => {
                    const avg = Math.round((sectorInfo.momentum + sectorInfo.quality + sectorInfo.value + sectorInfo.growth) / 4);
                    const color = avg >= 65 ? "text-green-400" : avg >= 45 ? "text-amber-400" : "text-red-400";
                    const label = avg >= 65 ? "超配" : avg >= 45 ? "标配" : "低配";
                    const bc = avg >= 65 ? "bg-green-500/20 text-green-300 border-green-500/30" : avg >= 45 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-red-500/20 text-red-300 border-red-500/30";
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-bold ${color}`}>{avg}</span>
                        <Badge className={bc}>{label}</Badge>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ── 龙头企业 ── */}
          <TabsContent value="stocks">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />{sectorInfo.label} — 龙头企业深度对标
                </h3>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">{stocks.length}家</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {["代码","公司","市值","P/E","P/B","ROE","YTD","营收增速","EPS增速","股息率","目标价","现价","上行空间","评级"].map(h => (
                        <th key={h} className={`py-2 px-2 text-slate-400 ${["代码","公司"].includes(h) ? "text-left" : "text-right"} last:text-center`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map(s => {
                      const upside = ((s.target - s.last) / s.last * 100);
                      return (
                        <tr key={s.ticker} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-2 text-blue-400 font-bold font-mono">{s.ticker}</td>
                          <td className="py-2 px-2 text-slate-200 font-medium">{s.name}</td>
                          <td className="py-2 px-2 text-right text-slate-300 font-mono">{s.mktCap}</td>
                          <td className={`py-2 px-2 text-right font-mono font-semibold ${s.pe > 40 ? "text-red-400" : s.pe > 25 ? "text-amber-400" : "text-green-400"}`}>{s.pe}x</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-300">{s.pb > 0 ? `${s.pb}x` : "N/A"}</td>
                          <td className={`py-2 px-2 text-right font-mono ${s.roe > 20 ? "text-blue-400" : "text-slate-300"}`}>{s.roe > 0 ? `${fmt(s.roe)}%` : "N/A"}</td>
                          <td className={`py-2 px-2 text-right font-mono font-semibold ${pctColor(s.ytd)}`}>{s.ytd >= 0 ? "+" : ""}{fmt(s.ytd)}%</td>
                          <td className={`py-2 px-2 text-right font-mono ${pctColor(s.rev_growth)}`}>{s.rev_growth >= 0 ? "+" : ""}{fmt(s.rev_growth)}%</td>
                          <td className={`py-2 px-2 text-right font-mono font-semibold ${pctColor(s.eps_growth)}`}>{s.eps_growth >= 0 ? "+" : ""}{fmt(s.eps_growth)}%</td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-400">{s.div > 0 ? `${s.div}%` : "—"}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-300">${s.target}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-100 font-semibold">${s.last}</td>
                          <td className={`py-2 px-2 text-right font-mono font-bold ${pctColor(upside)}`}>{upside >= 0 ? "+" : ""}{fmt(upside)}%</td>
                          <td className="py-2 px-2 text-center"><Badge className={`text-[10px] ${ANALYST_COLORS[s.analyst] ?? ""}`}>{s.analyst}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-slate-500 text-[10px] mt-3">* 目标价为分析师共识目标价，数据仅供参考，不构成投资建议。</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
