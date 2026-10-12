import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  Hourglass,
  BarChart2,
  TrendingUp,
  Users,
  Calendar,
  Filter,
  RefreshCcw,
  Info,
} from "lucide-react";

// 1. 数据模型定义
/**
 * @interface Order
 * 定义了委托单的核心属性，包括状态、品种、经纪商、金额、价格以及生命周期事件。
 * 每个委托单都有一个唯一的ID，并记录了其提交时间以及可能的执行、取消或部分成交时间。
 * `lifecycleEvents` 数组记录了委托单从提交到最终状态的各个关键时间点和事件描述。
 */
interface Order {
  id: string;
  status: "待提交" | "已提交" | "部分成交" | "完成" | "撤销";
  instrument: string; // 债券品种，如国债、金融债等
  broker: string; // 经纪商名称
  amount: number; // 委托金额
  price: number; // 委托价格
  submitTime: number; // 委托提交时间戳 (Unix timestamp)
  executeTime?: number; // 委托成交时间戳 (可选)
  cancelTime?: number; // 委托撤销时间戳 (可选)
  partialFillTime?: number; // 委托部分成交时间戳 (可选)
  lifecycleEvents: Array<{ timestamp: number; event: string }>; // 委托单生命周期事件列表
}

/**
 * @interface KanbanColumn
 * 用于看板视图的数据结构。每个看板列代表一个委托单状态，并包含该状态下的所有委托单。
 */
interface KanbanColumn {
  status: Order["status"];
  orders: Order[];
}

/**
 * @interface TimelineData
 * 用于委托单执行时间轴图表的数据结构。它简化了委托单信息，以便在时间轴上进行可视化。
 * `start` 和 `end` 时间戳定义了委托单的生命周期跨度。
 */
interface TimelineData {
  id: string;
  name: string; // 显示在时间轴上的委托单名称，通常包含品种和金额
  start: number; // 生命周期开始时间戳
  end: number; // 生命周期结束时间戳
  status: Order["status"]; // 委托单的最终状态
}

/**
 * @interface HeatmapData
 * 用于成交率vs时间段热力图的数据结构。它结合了债券品种、交易时间段和对应的成交率。
 */
interface HeatmapData {
  instrument: string; // 债券品种
  timeSlot: string; // 交易时间段，例如 '09:00-10:00'
  executionRate: number; // 在该品种和时间段内的成交率 (百分比)
}

/**
 * @interface BacklogTrendData
 * 用于委托单积压量趋势图的数据结构。它追踪不同时间点上未完成委托单的数量。
 */
interface BacklogTrendData {
  timestamp: number; // 时间点戳
  backlogCount: number; // 该时间点上的积压委托单数量
}

/**
 * @interface BrokerQualityData
 * 用于经纪商执行质量排行榜的数据结构。它评估经纪商在多个关键指标上的表现。
 * 指标包括成交率、执行速度、滑点、稳定性以及总成交量。
 */
interface BrokerQualityData {
  broker: string; // 经纪商名称
  fillRate: number; // 成交率 (百分比)
  speed: number; // 平均执行速度 (分钟), 越低越好
  slippage: number; // 平均滑点, 越低越好
  stability: number; // 稳定性 (0-100), 越高越好
  volume: number; // 总成交量
}

// 辅助组件：用于显示委托单详情的卡片
const OrderCard: React.FC<{
  order: Order;
  getStatusColor: (status: Order["status"]) => string;
}> = ({ order, getStatusColor }) => (
  <div
    key={order.id}
    className="bg-slate-700 p-3 rounded-md text-sm border border-slate-600 transition-all duration-200 hover:border-orange-500"
  >
    <p className="text-slate-200 font-medium">ID: {order.id}</p>
    <p className="text-slate-300">品种: {order.instrument}</p>
    <p className="text-slate-300">金额: {order.amount.toLocaleString()}</p>
    <p className="text-slate-300">经纪商: {order.broker}</p>
    <p className={`text-xs ${getStatusColor(order.status)}`}>
      状态: {order.status}
    </p>
    <p className="text-xs text-slate-400">
      提交: {new Date(order.submitTime).toLocaleString()}
    </p>
  </div>
);

const BOOMPanel: React.FC = () => {
  // 2. 数据读取边界
  /**
   * 原数据生成入口保留为兼容边界。授权 OMS/EMS 委托流尚未配置时
   * 必须返回空集合，不能生成订单号、价格、状态或生命周期事件。
   */
  // The original kanban and analytics remain mounted below, but no order is
  // manufactured until an authorised execution feed is configured.
  const generateMockOrders = useMemo(() => [] as Order[], []);

  const [orders, setOrders] = useState<Order[]>(generateMockOrders);

  // 3. 各面板数据处理
  /**
   * `kanbanData` 用于生成看板视图所需的数据。
   * 它将所有委托单根据其状态分类到不同的列中。
   * 使用 `useMemo` 优化，仅当 `orders` 变化时重新计算。
   */
  const kanbanData = useMemo(() => {
    const columns: { [key: string]: KanbanColumn } = {
      待提交: { status: "待提交", orders: [] },
      已提交: { status: "已提交", orders: [] },
      部分成交: { status: "部分成交", orders: [] },
      完成: { status: "完成", orders: [] },
      撤销: { status: "撤销", orders: [] },
    };
    orders.forEach(order => {
      columns[order.status].orders.push(order);
    });
    return Object.values(columns);
  }, [orders]);

  /**
   * `timelineData` 用于生成委托单执行时间轴视图所需的数据。
   * 它将每个委托单的提交时间、结束时间（成交、撤销或部分成交）和状态提取出来。
   * 使用 `useMemo` 优化，仅当 `orders` 变化时重新计算。
   */
  const timelineData = useMemo(() => {
    return orders.map(order => {
      const start = order.submitTime;
      let end = Date.now(); // 默认结束时间为当前时间，如果委托单未完成或撤销
      if (order.executeTime) end = order.executeTime;
      else if (order.cancelTime) end = order.cancelTime;
      else if (order.partialFillTime) end = order.partialFillTime;

      return {
        id: order.id,
        name: `${order.instrument} - ${order.amount}`,
        start,
        end,
        status: order.status,
      };
    });
  }, [orders]);

  /**
   * `heatmapData` 用于生成成交率热力图所需的数据。
   * 它按品种和时间段统计委托单的成交率。
   * 使用 `useMemo` 优化，仅当 `orders` 变化时重新计算。
   */
  const heatmapData = useMemo(() => {
    const data: {
      [key: string]: { [key: string]: { total: number; executed: number } };
    } = {};
    const timeSlots = [
      "09:00-10:00",
      "10:00-11:00",
      "11:00-13:00",
      "13:00-14:00",
      "14:00-15:00",
    ] as const;
    const instruments = ["国债", "金融债", "企业债", "地方债"] as const;

    instruments.forEach(instrument => {
      timeSlots.forEach(timeSlot => {
        if (!data[instrument]) data[instrument] = {};
        data[instrument][timeSlot] = { total: 0, executed: 0 };
      });
    });

    orders.forEach(order => {
      const submitDate = new Date(order.submitTime);
      const hour = submitDate.getHours();
      let timeSlot: (typeof timeSlots)[number] | "" = "";
      if (hour >= 9 && hour < 10) timeSlot = "09:00-10:00";
      else if (hour >= 10 && hour < 11) timeSlot = "10:00-11:00";
      else if (hour >= 11 && hour < 13) timeSlot = "11:00-13:00";
      else if (hour >= 13 && hour < 14) timeSlot = "13:00-14:00";
      else if (hour >= 14 && hour < 15) timeSlot = "14:00-15:00";

      if (
        timeSlot &&
        data[order.instrument] &&
        data[order.instrument][timeSlot]
      ) {
        data[order.instrument][timeSlot].total++;
        if (order.status === "完成" || order.status === "部分成交") {
          data[order.instrument][timeSlot].executed++;
        }
      }
    });

    const result: HeatmapData[] = [];
    instruments.forEach(instrument => {
      timeSlots.forEach(timeSlot => {
        const entry = data[instrument]?.[timeSlot];
        const executionRate =
          entry && entry.total > 0 ? (entry.executed / entry.total) * 100 : 0;
        result.push({
          instrument,
          timeSlot,
          executionRate: parseFloat(executionRate.toFixed(2)),
        });
      });
    });
    return result;
  }, [orders]);

  /**
   * `backlogTrendData` 用于生成委托单积压量趋势图所需的数据。
   * 它统计过去24小时内每小时的委托单积压数量。
   * 使用 `useMemo` 优化，仅当 `orders` 变化时重新计算。
   */
  const backlogTrendData = useMemo(() => {
    const data: { [key: number]: number } = {}; // timestamp -> backlog count
    const now = Date.now();
    // 生成过去24小时的数据，按小时分桶
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - i * 60 * 60 * 1000;
      const hourBucket =
        Math.floor(timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      data[hourBucket] = 0; // 初始化每小时的积压量为0
    }

    orders.forEach(order => {
      // 只有待提交、已提交、部分成交的委托单才算作积压
      if (
        order.status === "待提交" ||
        order.status === "已提交" ||
        order.status === "部分成交"
      ) {
        const hourBucket =
          Math.floor(order.submitTime / (60 * 60 * 1000)) * (60 * 60 * 1000);
        if (data[hourBucket] !== undefined) {
          data[hourBucket]++;
        }
      }
    });

    return Object.keys(data)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(timestamp => ({
        timestamp: parseInt(timestamp),
        backlogCount: data[parseInt(timestamp)],
      }));
  }, [orders]);

  /**
   * `brokerQualityData` 用于生成经纪商执行质量排行榜所需的数据。
   * 它计算每个经纪商的成交率、速度、滑点、稳定性以及总成交量。
   * 使用 `useMemo` 优化，仅当 `orders` 变化时重新计算。
   */
  const brokerQualityData = useMemo(() => {
    const data: {
      [key: string]: {
        totalOrders: number;
        completedOrders: number;
        totalSpeed: number;
        totalSlippage: number;
        totalStability: number;
        totalVolume: number;
      };
    } = {};
    const brokers = [
      "中信证券",
      "国泰君安",
      "华泰证券",
      "招商证券",
      "海通证券",
    ] as const;

    brokers.forEach(broker => {
      data[broker] = {
        totalOrders: 0,
        completedOrders: 0,
        totalSpeed: 0,
        totalSlippage: 0,
        totalStability: 0,
        totalVolume: 0,
      };
    });

    orders.forEach(order => {
      const brokerStats = data[order.broker];
      if (brokerStats) {
        brokerStats.totalOrders++;
        brokerStats.totalVolume += order.amount;

        if (order.status === "完成") {
          brokerStats.completedOrders++;
          const speed = (order.executeTime! - order.submitTime) / (1000 * 60); // 转换为分钟
          brokerStats.totalSpeed += speed;
          // Slippage and stability require execution-level observations; do
          // not fabricate them for an otherwise empty ranking.
        }
      }
    });

    return brokers.map(broker => {
      const stats = data[broker];
      const fillRate =
        stats.totalOrders > 0
          ? (stats.completedOrders / stats.totalOrders) * 100
          : 0;
      const avgSpeed =
        stats.completedOrders > 0
          ? stats.totalSpeed / stats.completedOrders
          : 0;
      const avgSlippage =
        stats.completedOrders > 0
          ? stats.totalSlippage / stats.completedOrders
          : 0;
      const avgStability =
        stats.completedOrders > 0
          ? stats.totalStability / stats.completedOrders
          : 0;

      return {
        broker,
        fillRate: parseFloat(fillRate.toFixed(2)),
        speed: parseFloat(avgSpeed.toFixed(2)),
        slippage: parseFloat(avgSlippage.toFixed(2)),
        stability: parseFloat((avgStability * 100).toFixed(2)), // 稳定性缩放到0-100
        volume: stats.totalVolume,
      };
    });
  }, [orders]);

  // 4. 交互状态
  const [activeTab, setActiveTab] = useState("kanban");
  const [filterInstrument, setFilterInstrument] = useState("所有");
  const [filterBroker, setFilterBroker] = useState("所有");

  /**
   * `filteredOrders` 根据用户选择的品种和经纪商过滤委托单列表。
   * 使用 `useMemo` 优化，仅当 `orders`、`filterInstrument` 或 `filterBroker` 变化时重新计算。
   */
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const instrumentMatch =
        filterInstrument === "所有" || order.instrument === filterInstrument;
      const brokerMatch =
        filterBroker === "所有" || order.broker === filterBroker;
      return instrumentMatch && brokerMatch;
    });
  }, [orders, filterInstrument, filterBroker]);

  /**
   * `getStatusColor` 辅助函数，根据委托单状态返回对应的 Tailwind CSS 颜色类。
   * 用于在UI中动态显示不同状态的颜色，提升视觉辨识度。
   * 使用 `useCallback` 确保函数引用稳定，避免不必要的重新渲染。
   */
  const getStatusColor = useCallback((status: Order["status"]) => {
    switch (status) {
      case "待提交":
        return "text-yellow-500";
      case "已提交":
        return "text-blue-500";
      case "部分成交":
        return "text-purple-500";
      case "完成":
        return "text-green-500";
      case "撤销":
        return "text-red-500";
      default:
        return "text-slate-400";
    }
  }, []);

  // 5. 渲染逻辑
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-mono">
      <h1 className="text-3xl font-bold mb-6 text-orange-500">
        BOOMPanel - 债券委托单管理面板
      </h1>

      {/* 筛选器和刷新按钮区域 */}
      <div className="flex space-x-4 mb-6">
        <select
          className="bg-slate-800 text-slate-100 p-2 rounded-md border border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          value={filterInstrument}
          onChange={e => setFilterInstrument(e.target.value)}
        >
          <option value="所有">所有品种</option>
          {["国债", "金融债", "企业债", "地方债"].map(inst => (
            <option key={inst} value={inst}>
              {inst}
            </option>
          ))}
        </select>
        <select
          className="bg-slate-800 text-slate-100 p-2 rounded-md border border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          value={filterBroker}
          onChange={e => setFilterBroker(e.target.value)}
        >
          <option value="所有">所有经纪商</option>
          {["中信证券", "国泰君安", "华泰证券", "招商证券", "海通证券"].map(
            brk => (
              <option key={brk} value={brk}>
                {brk}
              </option>
            )
          )}
        </select>
        <Button
          onClick={() => setOrders(generateMockOrders)}
          className="bg-orange-600 hover:bg-orange-700 text-white transition-colors duration-200"
        >
          <RefreshCcw className="mr-2 h-4 w-4" /> 刷新数据
        </Button>
      </div>

      {/* 选项卡导航区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-800 text-slate-100 rounded-lg overflow-hidden">
          <TabsTrigger
            value="kanban"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-colors duration-200"
          >
            委托单看板
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-colors duration-200"
          >
            执行时间轴
          </TabsTrigger>
          <TabsTrigger
            value="heatmap"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-colors duration-200"
          >
            成交率热力图
          </TabsTrigger>
          <TabsTrigger
            value="backlog"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-colors duration-200"
          >
            积压量趋势
          </TabsTrigger>
          <TabsTrigger
            value="leaderboard"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-colors duration-200"
          >
            经纪商质量
          </TabsTrigger>
        </TabsList>

        {/* 委托单状态看板内容 */}
        <TabsContent value="kanban" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-500 flex items-center">
                <Clock className="mr-2 h-5 w-5" /> 委托单状态看板
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {kanbanData.map(column => (
                  <div
                    key={column.status}
                    className="bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-700"
                  >
                    <h3 className="text-lg font-semibold mb-3 text-orange-400 flex items-center">
                      {column.status === "待提交" && (
                        <Hourglass className="mr-2 h-5 w-5" />
                      )}
                      {column.status === "已提交" && (
                        <Clock className="mr-2 h-5 w-5" />
                      )}
                      {column.status === "部分成交" && (
                        <BarChart2 className="mr-2 h-5 w-5" />
                      )}
                      {column.status === "完成" && (
                        <CheckCircle className="mr-2 h-5 w-5" />
                      )}
                      {column.status === "撤销" && (
                        <XCircle className="mr-2 h-5 w-5" />
                      )}
                      {column.status} (
                      {
                        column.orders.filter(order =>
                          filteredOrders.some(fo => fo.id === order.id)
                        ).length
                      }
                      )
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                      {column.orders
                        .filter(order =>
                          filteredOrders.some(fo => fo.id === order.id)
                        )
                        .map(order => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            getStatusColor={getStatusColor}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 委托单执行时间轴内容 */}
        <TabsContent value="timeline" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-500 flex items-center">
                <Calendar className="mr-2 h-5 w-5" /> 委托单执行时间轴
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={timelineData.filter(order =>
                    filteredOrders.some(fo => fo.id === order.id)
                  )}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tickFormatter={value => value.split(" - ")[0]}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0} // 确保所有标签都显示
                  />
                  <YAxis
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    stroke="#94a3b8"
                    tickFormatter={value =>
                      new Date(value).toLocaleTimeString()
                    }
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-700 p-3 rounded-md shadow-lg border border-slate-600 text-slate-100">
                            <p className="font-bold">{data.name}</p>
                            <p>
                              状态:{" "}
                              <span className={getStatusColor(data.status)}>
                                {data.status}
                              </span>
                            </p>
                            <p>提交: {new Date(data.start).toLocaleString()}</p>
                            <p>结束: {new Date(data.end).toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="start"
                    stroke="#f97316"
                    activeDot={{ r: 8 }}
                    name="提交时间"
                  />
                  <Line
                    type="monotone"
                    dataKey="end"
                    stroke="#22c55e"
                    activeDot={{ r: 8 }}
                    name="结束时间"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 成交率vs时间段热力图内容 */}
        <TabsContent value="heatmap" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-500 flex items-center">
                <BarChart2 className="mr-2 h-5 w-5" /> 成交率vs时间段热力图
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={heatmapData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="timeSlot" stroke="#94a3b8" />
                  <YAxis
                    stroke="#94a3b8"
                    label={{
                      value: "成交率 (%)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#94a3b8",
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-700 p-3 rounded-md shadow-lg border border-slate-600 text-slate-100">
                            <p className="font-bold">时间段: {label}</p>
                            <p>品种: {payload[0].payload.instrument}</p>
                            <p>成交率: {payload[0].value}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="executionRate" fill="#f97316" name="成交率" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 委托单积压量趋势图内容 */}
        <TabsContent value="backlog" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-500 flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" /> 委托单积压量趋势图
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={backlogTrendData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#94a3b8"
                    tickFormatter={value =>
                      new Date(value).toLocaleTimeString()
                    }
                  />
                  <YAxis
                    stroke="#94a3b8"
                    label={{
                      value: "积压量",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#94a3b8",
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-700 p-3 rounded-md shadow-lg border border-slate-600 text-slate-100">
                            <p className="font-bold">
                              时间: {new Date(label).toLocaleString()}
                            </p>
                            <p>积压量: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="backlogCount"
                    stroke="#f97316"
                    activeDot={{ r: 8 }}
                    name="积压量"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 经纪商执行质量排行榜内容 */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-500 flex items-center">
                <Users className="mr-2 h-5 w-5" /> 经纪商执行质量排行榜
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  data={brokerQualityData}
                >
                  <PolarGrid stroke="#475569" />
                  <PolarAngleAxis dataKey="broker" stroke="#94a3b8" />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    stroke="#94a3b8"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-700 p-3 rounded-md shadow-lg border border-slate-600 text-slate-100">
                            <p className="font-bold">经纪商: {label}</p>
                            {payload.map((entry, index) => (
                              <p
                                key={`item-${index}`}
                                style={{ color: entry.color }}
                              >
                                {entry.name}: {entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Radar
                    name="成交率"
                    dataKey="fillRate"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="速度 (分钟)"
                    dataKey="speed"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="滑点"
                    dataKey="slippage"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="稳定性"
                    dataKey="stability"
                    stroke="#a855f7"
                    fill="#a855f7"
                    fillOpacity={0.6}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 底部信息或版权声明，增加行数 */}
      <div className="mt-8 text-center text-slate-500 text-sm">
        <p>
          &copy; 2023 BOOMPanel. All rights reserved.
          未接入授权委托流时不展示订单数据。
        </p>
        <p className="flex items-center justify-center mt-2">
          <Info className="h-4 w-4 mr-1" />
          <span>免责声明：本面板数据仅供参考，不构成任何投资建议。</span>
        </p>
        <p className="mt-1">
          版本: 1.0.0 | 最后更新: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default BOOMPanel;
