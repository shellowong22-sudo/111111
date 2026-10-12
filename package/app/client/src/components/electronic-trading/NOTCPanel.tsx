import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area
} from 'recharts';
import { format } from 'date-fns';

// 定义通知类型
interface Notification {
  id: string;
  type: 'Order' | 'Trade' | 'Alert' | 'System';
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Confirmed' | 'Dismissed';
  timestamp: Date;
  message: string;
  instrument?: string;
  price?: number;
  quantity?: number;
}

// 定义图表数据类型
interface TrendData {
  date: string;
  pending: number;
  confirmed: number;
  dismissed: number;
}

interface ConfirmationRateData {
  type: string;
  rate: number;
}

const NOTCPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('Pending');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

  // 通知必须来自站内授权推送契约；没有推送事件时保持空态，不伪造消息。

  // 过滤和搜索逻辑
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      const matchesType = filterType === 'All' || notif.type === filterType;
      const matchesPriority = filterPriority === 'All' || notif.priority === filterPriority;
      const matchesStatus = filterStatus === 'All' || notif.status === filterStatus;
      const matchesSearch = searchTerm === '' ||
        notif.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notif.instrument?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notif.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesPriority && matchesStatus && matchesSearch;
    });
  }, [notifications, filterType, filterPriority, filterStatus, searchTerm]);

  // 图表数据生成
  const notificationTrendData = useMemo<TrendData[]>(() => {
    const dataMap = new Map<string, { pending: number; confirmed: number; dismissed: number }>();

    notifications.forEach(notif => {
      const date = format(notif.timestamp, 'yyyy-MM-dd');
      if (dataMap.has(date)) {
        const current = dataMap.get(date)!;
        if (notif.status === 'Pending') current.pending++;
        else if (notif.status === 'Confirmed') current.confirmed++;
        else if (notif.status === 'Dismissed') current.dismissed++;
        dataMap.set(date, current);
      }
    });

    return Array.from(dataMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [notifications]);

  const confirmationRateData = useMemo<ConfirmationRateData[]>(() => {
    const typeCounts = new Map<string, { total: number; confirmed: number }>();

    notifications.forEach(notif => {
      if (!typeCounts.has(notif.type)) {
        typeCounts.set(notif.type, { total: 0, confirmed: 0 });
      }
      const current = typeCounts.get(notif.type)!;
      current.total++;
      if (notif.status === 'Confirmed') {
        current.confirmed++;
      }
      typeCounts.set(notif.type, current);
    });

    return Array.from(typeCounts.entries()).map(([type, counts]) => ({
      type,
      rate: counts.total > 0 ? parseFloat(((counts.confirmed / counts.total) * 100).toFixed(2)) : 0,
    }));
  }, [notifications]);

  // 操作处理
  const handleConfirm = (id: string) => {
    setNotifications(prev =>
      prev.map(notif => (notif.id === id ? { ...notif, status: 'Confirmed' } : notif))
    );
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleDismiss = (id: string) => {
    setNotifications(prev =>
      prev.map(notif => (notif.id === id ? { ...notif, status: 'Dismissed' } : notif))
    );
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleBatchConfirm = () => {
    setNotifications(prev =>
      prev.map(notif =>
        selectedNotifications.has(notif.id) ? { ...notif, status: 'Confirmed' } : notif
      )
    );
    setSelectedNotifications(new Set());
  };

  const handleBatchDismiss = () => {
    setNotifications(prev =>
      prev.map(notif =>
        selectedNotifications.has(notif.id) ? { ...notif, status: 'Dismissed' } : notif
      )
    );
    setSelectedNotifications(new Set());
  };

  const handleSelectNotification = (id: string, isSelected: boolean) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedNotifications(new Set(filteredNotifications.map(notif => notif.id)));
    } else {
      setSelectedNotifications(new Set());
    }
  };

  const getStatusColor = (status: Notification['status']) => {
    switch (status) {
      case 'Pending': return 'text-yellow-500';
      case 'Confirmed': return 'text-green-500';
      case 'Dismissed': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'High': return 'text-red-500';
      case 'Medium': return 'text-yellow-500';
      case 'Low': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-4 bg-slate-950 text-gray-100 min-h-screen font-mono">
      <h1 className="text-3xl font-bold text-cyan-400 mb-6">NOTC 电子交易通知确认面板</h1>
      <div className="mb-6 border border-amber-700/70 bg-amber-950/30 p-3 text-sm text-slate-300">
        <p className="font-semibold text-amber-300">站内推送状态：未接入</p>
        <p className="mt-1 text-xs text-slate-500">通知、订单和交易事件只在后端授权推送契约产生后显示；当前没有可核验事件，不生成静态或随机通知。</p>
      </div>

      {/* 筛选和搜索功能 */}
      <div className="bg-slate-900 p-4 rounded-lg shadow-lg mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex flex-col">
          <label htmlFor="search" className="text-sm text-gray-400 mb-1">搜索</label>
          <input
            id="search"
            type="text"
            placeholder="搜索消息、代码、ID..."
            className="bg-slate-800 text-gray-100 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-cyan-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="filterType" className="text-sm text-gray-400 mb-1">类型</label>
          <select
            id="filterType"
            className="bg-slate-800 text-gray-100 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-cyan-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="All">所有类型</option>
            <option value="Order">订单</option>
            <option value="Trade">交易</option>
            <option value="Alert">警报</option>
            <option value="System">系统</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="filterPriority" className="text-sm text-gray-400 mb-1">优先级</label>
          <select
            id="filterPriority"
            className="bg-slate-800 text-gray-100 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-cyan-500"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="All">所有优先级</option>
            <option value="High">高</option>
            <option value="Medium">中</option>
            <option value="Low">低</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="filterStatus" className="text-sm text-gray-400 mb-1">状态</label>
          <select
            id="filterStatus"
            className="bg-slate-800 text-gray-100 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-cyan-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">所有状态</option>
            <option value="Pending">待处理</option>
            <option value="Confirmed">已确认</option>
            <option value="Dismissed">已驳回</option>
          </select>
        </div>

        {selectedNotifications.size > 0 && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleBatchConfirm}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
            >
              批量确认 ({selectedNotifications.size})
            </button>
            <button
              onClick={handleBatchDismiss}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
            >
              批量驳回 ({selectedNotifications.size})
            </button>
          </div>
        )}
      </div>

      {/* 实时数据展示 & 图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-900 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">通知趋势图 (过去7天)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={notificationTrendData} margin={{
              top: 10, right: 30, left: 0, bottom: 0,
            }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: ' 问题：我正在尝试使用 Recharts 库创建一个 AreaChart，但图表没有显示。我检查了数据和组件，但仍然无法找到问题。' }} />
              <Legend />
              <Area type="monotone" dataKey="pending" stackId="1" stroke="#facc15" fill="#facc15" name="待处理" />
              <Area type="monotone" dataKey="confirmed" stackId="1" stroke="#22c55e" fill="#22c55e" name="已确认" />
              <Area type="monotone" dataKey="dismissed" stackId="1" stroke="#ef4444" fill="#ef4444" name="已驳回" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">确认率统计 (按类型)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={confirmationRateData} margin={{
              top: 10, right: 30, left: 0, bottom: 0,
            }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="type" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: ' 问题：我正在尝试使用 Recharts 库创建一个 BarChart，但图表没有显示。我检查了数据和组件，但仍然无法找到问题。' }} />
              <Legend />
              <Bar dataKey="rate" fill="#06b6d4" name="确认率 (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 通知列表 */}
      <div className="bg-slate-900 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4">通知列表</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-cyan-600 bg-slate-700 border-slate-600 rounded"
                    checked={selectedNotifications.size === filteredNotifications.length && filteredNotifications.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">时间</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">类型</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">优先级</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">消息</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                    无匹配通知。
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notif) => (
                  <tr key={notif.id} className="hover:bg-slate-800 transition-colors duration-150">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-cyan-600 bg-slate-700 border-slate-600 rounded"
                        checked={selectedNotifications.has(notif.id)}
                        onChange={(e) => handleSelectNotification(notif.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-cyan-300">{notif.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-300">{format(notif.timestamp, 'yyyy-MM-dd HH:mm:ss')}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-green-400">{notif.type}</td>
                    <td className={`px-4 py-2 whitespace-nowrap ${getPriorityColor(notif.priority)}`}>{notif.priority}</td>
                    <td className={`px-4 py-2 whitespace-nowrap ${getStatusColor(notif.status)}`}>{notif.status}</td>
                    <td className="px-4 py-2 text-gray-300 max-w-xs truncate" title={notif.message}>{notif.message}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {notif.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirm(notif.id)}
                            className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => handleDismiss(notif.id)}
                            className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
                          >
                            驳回
                          </button>
                        </div>
                      )}
                      {notif.status !== 'Pending' && (
                        <span className="text-gray-500 text-xs">已处理</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NOTCPanel;
