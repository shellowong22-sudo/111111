import React, { useState } from 'react';
import { Settings, Save, RefreshCw, CheckCircle, AlertCircle, Activity, Sliders, Network, Bell } from 'lucide-react';
import { toast } from 'sonner';

const defaultConfig = {
  general: {
    systemName: 'Ucheer Terminal Pro',
    environment: 'PRODUCTION',
    timezone: 'Asia/Shanghai',
    currency: 'USD',
    language: 'zh-CN',
    sessionTimeout: 480,
    autoLogout: true,
  },
  trading: {
    defaultAlgo: 'VWAP',
    defaultUrgency: 'MED',
    maxOrderSize: 10000000,
    maxDailyTurnover: 100000000,
    requireConfirmation: true,
    confirmThreshold: 1000000,
    allowShortSelling: false,
    marginEnabled: true,
    marginRatio: 50,
  },
  risk: {
    varLimit: 1000000,
    concentrationLimit: 25,
    singleStockLimit: 10,
    sectorLimit: 30,
    countryLimit: 40,
    enableRealTimeRisk: true,
    riskCheckFrequency: 1,
    alertOnBreach: true,
  },
  connectivity: {
    fixVersion: 'FIX4.4',
    heartbeatInterval: 30,
    reconnectAttempts: 5,
    sslEnabled: true,
    venues: ['NASDAQ', 'NYSE', 'LSE', 'HKEX', 'SSE'],
    darkPools: ['IEX', 'BATS', 'LIQUIDNET'],
  },
  notifications: {
    emailAlerts: true,
    smsAlerts: false,
    pushAlerts: true,
    alertEmail: 'trader@fund.com',
    alertPhone: '+86-138-0000-0000',
    alertOnFill: true,
    alertOnPartial: true,
    alertOnCancel: true,
    alertOnRiskBreach: true,
  },
};

export default function TWCPanel() {
  const [config, setConfig] = useState(defaultConfig);
  const [activeSection, setActiveSection] = useState<'general' | 'trading' | 'risk' | 'connectivity' | 'notifications'>('general');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    toast.success('配置已保存', { description: '所有设置已成功更新并生效', duration: 3000 });
    setTimeout(() => setSaved(false), 2000);
  };

  const updateConfig = (section: string, key: string, value: any) => {
    setConfig(prev => ({ ...prev, [section]: { ...(prev as any)[section], [key]: value } }));
  };

  const sections = [
    { id: 'general', label: '通用设置', icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'trading', label: '交易参数', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'risk', label: '风险控制', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    { id: 'connectivity', label: '连接配置', icon: <Network className="w-3.5 h-3.5" /> },
    { id: 'notifications', label: '通知设置', icon: <Bell className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">TWC</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">TW 配置 — 交易工作台系统参数配置</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfig(defaultConfig)} className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a2e] rounded text-[#888] hover:text-[#ccc] text-[11px]">
            <RefreshCw className="w-3 h-3" />重置
          </button>
          <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-[#d4af37] rounded text-black font-bold text-[11px] hover:bg-[#e5c158]">
            {saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {saved ? '已保存' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-44 bg-[#0d0d14] border-r border-[#1a1a2e] flex-shrink-0">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left text-xs transition-colors ${activeSection === s.id ? 'bg-[#d4af37]/10 text-[#d4af37] border-r-2 border-[#d4af37]' : 'text-[#666] hover:text-[#ccc] hover:bg-[#1a1a2e]'}`}>
              {s.icon}{s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeSection === 'general' && (
            <div className="max-w-lg space-y-4">
              <div className="text-[#d4af37] font-bold mb-4">通用系统设置</div>
              {[
                { label: '系统名称', key: 'systemName', type: 'text' },
                { label: '运行环境', key: 'environment', type: 'select', options: ['PRODUCTION', 'UAT', 'DEVELOPMENT'] },
                { label: '时区', key: 'timezone', type: 'select', options: ['Asia/Shanghai', 'America/New_York', 'Europe/London', 'Asia/Tokyo'] },
                { label: '基准货币', key: 'currency', type: 'select', options: ['USD', 'CNY', 'EUR', 'GBP', 'JPY'] },
                { label: '界面语言', key: 'language', type: 'select', options: ['zh-CN', 'en-US', 'ja-JP'] },
                { label: '会话超时(分钟)', key: 'sessionTimeout', type: 'number' },
              ].map(field => (
                <div key={field.key} className="flex items-center justify-between">
                  <label className="text-[#888] w-36">{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={(config.general as any)[field.key]} onChange={e => updateConfig('general', field.key, e.target.value)}
                      className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]">
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'number' ? (
                    <input type="number" value={(config.general as any)[field.key]} onChange={e => updateConfig('general', field.key, Number(e.target.value))}
                      className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
                  ) : (
                    <input type="text" value={(config.general as any)[field.key]} onChange={e => updateConfig('general', field.key, e.target.value)}
                      className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <label className="text-[#888]">自动登出</label>
                <button onClick={() => updateConfig('general', 'autoLogout', !config.general.autoLogout)}
                  className={`w-10 h-5 rounded-full transition-colors ${config.general.autoLogout ? 'bg-[#d4af37]' : 'bg-[#333]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${config.general.autoLogout ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {activeSection === 'trading' && (
            <div className="max-w-lg space-y-4">
              <div className="text-[#d4af37] font-bold mb-4">交易参数配置</div>
              {[
                { label: '默认算法', key: 'defaultAlgo', type: 'select', options: ['VWAP', 'TWAP', 'IS', 'POV', 'DMA', 'SNIPER'] },
                { label: '默认紧急度', key: 'defaultUrgency', type: 'select', options: ['LOW', 'MED', 'HIGH'] },
                { label: '单笔最大委托($)', key: 'maxOrderSize', type: 'number' },
                { label: '日内最大换手($)', key: 'maxDailyTurnover', type: 'number' },
                { label: '确认阈值($)', key: 'confirmThreshold', type: 'number' },
                { label: '保证金比例(%)', key: 'marginRatio', type: 'number' },
              ].map(field => (
                <div key={field.key} className="flex items-center justify-between">
                  <label className="text-[#888] w-40">{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={(config.trading as any)[field.key]} onChange={e => updateConfig('trading', field.key, e.target.value)}
                      className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]">
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="number" value={(config.trading as any)[field.key]} onChange={e => updateConfig('trading', field.key, Number(e.target.value))}
                      className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
                  )}
                </div>
              ))}
              {[
                { label: '需要确认', key: 'requireConfirmation' },
                { label: '允许卖空', key: 'allowShortSelling' },
                { label: '启用保证金', key: 'marginEnabled' },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <label className="text-[#888]">{f.label}</label>
                  <button onClick={() => updateConfig('trading', f.key, !(config.trading as any)[f.key])}
                    className={`w-10 h-5 rounded-full transition-colors ${(config.trading as any)[f.key] ? 'bg-[#d4af37]' : 'bg-[#333]'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${(config.trading as any)[f.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'risk' && (
            <div className="max-w-lg space-y-4">
              <div className="text-[#d4af37] font-bold mb-4">风险控制参数</div>
              {[
                { label: 'VaR 限额($)', key: 'varLimit', type: 'number' },
                { label: '集中度限制(%)', key: 'concentrationLimit', type: 'number' },
                { label: '单股限制(%)', key: 'singleStockLimit', type: 'number' },
                { label: '行业限制(%)', key: 'sectorLimit', type: 'number' },
                { label: '国家限制(%)', key: 'countryLimit', type: 'number' },
                { label: '风险检查频率(秒)', key: 'riskCheckFrequency', type: 'number' },
              ].map(field => (
                <div key={field.key} className="flex items-center justify-between">
                  <label className="text-[#888] w-40">{field.label}</label>
                  <input type="number" value={(config.risk as any)[field.key]} onChange={e => updateConfig('risk', field.key, Number(e.target.value))}
                    className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
                </div>
              ))}
              {[
                { label: '实时风险监控', key: 'enableRealTimeRisk' },
                { label: '突破时发送警报', key: 'alertOnBreach' },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <label className="text-[#888]">{f.label}</label>
                  <button onClick={() => updateConfig('risk', f.key, !(config.risk as any)[f.key])}
                    className={`w-10 h-5 rounded-full transition-colors ${(config.risk as any)[f.key] ? 'bg-[#d4af37]' : 'bg-[#333]'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${(config.risk as any)[f.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'connectivity' && (
            <div className="max-w-lg space-y-4">
              <div className="text-[#d4af37] font-bold mb-4">连接配置</div>
              <div className="flex items-center justify-between">
                <label className="text-[#888] w-40">FIX 协议版本</label>
                <select value={config.connectivity.fixVersion} onChange={e => updateConfig('connectivity', 'fixVersion', e.target.value)}
                  className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]">
                  {['FIX4.2', 'FIX4.4', 'FIX5.0', 'FIXT1.1'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[#888] w-40">心跳间隔(秒)</label>
                <input type="number" value={config.connectivity.heartbeatInterval} onChange={e => updateConfig('connectivity', 'heartbeatInterval', Number(e.target.value))}
                  className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
              </div>
              <div>
                <div className="text-[#888] mb-2">已连接交易所</div>
                <div className="flex flex-wrap gap-2">
                  {['NASDAQ', 'NYSE', 'LSE', 'HKEX', 'SSE', 'TSE', 'Euronext', 'SGX'].map(v => (
                    <button key={v} onClick={() => {
                      const venues = config.connectivity.venues.includes(v) ? config.connectivity.venues.filter(x => x !== v) : [...config.connectivity.venues, v];
                      updateConfig('connectivity', 'venues', venues);
                    }} className={`px-2 py-1 rounded text-[10px] transition-colors ${config.connectivity.venues.includes(v) ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[#888] mb-2">暗池连接</div>
                <div className="flex flex-wrap gap-2">
                  {['IEX', 'BATS', 'LIQUIDNET', 'ITG', 'POSIT', 'SIGMA_X'].map(v => (
                    <button key={v} onClick={() => {
                      const pools = config.connectivity.darkPools.includes(v) ? config.connectivity.darkPools.filter(x => x !== v) : [...config.connectivity.darkPools, v];
                      updateConfig('connectivity', 'darkPools', pools);
                    }} className={`px-2 py-1 rounded text-[10px] transition-colors ${config.connectivity.darkPools.includes(v) ? 'bg-[#60a5fa] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[#888]">启用 SSL/TLS</label>
                <button onClick={() => updateConfig('connectivity', 'sslEnabled', !config.connectivity.sslEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors ${config.connectivity.sslEnabled ? 'bg-[#d4af37]' : 'bg-[#333]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${config.connectivity.sslEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="max-w-lg space-y-4">
              <div className="text-[#d4af37] font-bold mb-4">通知设置</div>
              <div className="flex items-center justify-between">
                <label className="text-[#888] w-40">告警邮箱</label>
                <input type="email" value={config.notifications.alertEmail} onChange={e => updateConfig('notifications', 'alertEmail', e.target.value)}
                  className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[#888] w-40">告警手机</label>
                <input type="text" value={config.notifications.alertPhone} onChange={e => updateConfig('notifications', 'alertPhone', e.target.value)}
                  className="flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
              </div>
              {[
                { label: '邮件告警', key: 'emailAlerts' },
                { label: '短信告警', key: 'smsAlerts' },
                { label: 'Push 推送', key: 'pushAlerts' },
                { label: '成交通知', key: 'alertOnFill' },
                { label: '部分成交通知', key: 'alertOnPartial' },
                { label: '撤单通知', key: 'alertOnCancel' },
                { label: '风险突破通知', key: 'alertOnRiskBreach' },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <label className="text-[#888]">{f.label}</label>
                  <button onClick={() => updateConfig('notifications', f.key, !(config.notifications as any)[f.key])}
                    className={`w-10 h-5 rounded-full transition-colors ${(config.notifications as any)[f.key] ? 'bg-[#d4af37]' : 'bg-[#333]'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${(config.notifications as any)[f.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
