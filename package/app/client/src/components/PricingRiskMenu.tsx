import { X } from 'lucide-react';
import { useLocation } from 'wouter';

interface MenuItem {
  number: string;
  code: string;
  name: string;
  tabKey: string;
  category: string;
}

const menuItems: MenuItem[] = [
  { number: '1', code: 'ANN', name: '公告管理情报站', tabKey: 'announce', category: '基础设施' },
  { number: '2', code: 'DASH', name: '全局风险看板', tabKey: 'dashboard', category: '基础设施' },
  { number: '3', code: 'ASST', name: '金融资产分类与品种管理', tabKey: 'asset-class', category: '基础设施' },
  { number: '4', code: 'LIVE', name: '实时行情与动态定价', tabKey: 'realtime', category: '基础设施' },
  { number: '5', code: 'STAT', name: '资产静态数据管理', tabKey: 'static-data', category: '基础设施' },
  { number: '6', code: 'YLD', name: '收益率曲线构建与插值', tabKey: 'yield-curve', category: '定价模型' },
  { number: '7', code: 'VOL', name: '波动率曲面建模', tabKey: 'vol-surface', category: '定价模型' },
  { number: '8', code: 'VAL', name: '估值引擎与模型配置', tabKey: 'valuation', category: '定价模型' },
  { number: '9', code: 'GRK', name: 'Greeks实时敏感度分析', tabKey: 'greeks', category: '定价模型' },
  { number: '10', code: 'VaR', name: 'VaR深度计量', tabKey: 'var', category: '风险计量' },
  { number: '11', code: 'STR', name: '极端情景压力测试', tabKey: 'stress', category: '风险计量' },
  { number: '12', code: 'PnL', name: 'P&L归因分析', tabKey: 'pnl', category: '风险计量' },
  { number: '13', code: 'CVA', name: 'CVA/DVA交易对手信用风险', tabKey: 'cva', category: '信用与对手方' },
  { number: '14', code: 'LIQ', name: '流动性风险与期限错配', tabKey: 'liquidity', category: '信用与对手方' },
  { number: '15', code: 'CAP', name: '资本充足率与监管试算', tabKey: 'capital', category: '信用与对手方' },
  { number: '16', code: 'WIF', name: 'What-if场景模拟', tabKey: 'whatif', category: '高级分析' },
  { number: '17', code: 'COR', name: '资产相关性分析矩阵', tabKey: 'correlation', category: '高级分析' },
  { number: '18', code: 'TAIL', name: '尾部风险与回撤分析', tabKey: 'tail-risk', category: '高级分析' },
  { number: '19', code: 'BKT', name: '策略回测引擎', tabKey: 'backtest', category: '高级分析' },
  { number: '20', code: 'ALT', name: '智能预警管理系统', tabKey: 'alert', category: '运维与监控' },
  { number: '21', code: 'DEC', name: '决策支持深度报告', tabKey: 'decision', category: '运维与监控' },
  { number: '22', code: 'AUD', name: '审计日志与操作留痕', tabKey: 'audit', category: '运维与监控' },
  { number: '23', code: 'INT', name: '外部系统集成与数据监控', tabKey: 'integration', category: '运维与监控' },
];

const categories = ['基础设施', '定价模型', '风险计量', '信用与对手方', '高级分析', '运维与监控'];

interface PricingRiskMenuProps {
  onClose: () => void;
}

export function PricingRiskMenu({ onClose }: PricingRiskMenuProps) {
  const [, setLocation] = useLocation();

  const handleClick = (item: MenuItem) => {
    onClose();
    setLocation(`/pricing-risk?tab=${item.tabKey}`);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-5xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 定价与风险分析中心</span>
            <span className="text-[#999] text-xs ml-2">23个深度功能模块</span>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - 3 columns */}
        <div className="p-6 grid grid-cols-3 gap-6">
          {/* Column 1: 基础设施 + 定价模型 */}
          <div className="space-y-2">
            <div className="text-[#d4af37] text-xs font-semibold mb-3">基础设施</div>
            {menuItems.filter(i => i.category === '基础设施').map((item) => (
              <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1.5 rounded transition-colors"
                onClick={() => handleClick(item)}>
                <span className="text-[#999] w-5">{item.number})</span>
                <span className="text-[#d4af37] font-semibold w-12">{item.code}</span>
                <span className="text-[#ccc] flex-1">{item.name}</span>
              </div>
            ))}
            <div className="text-[#d4af37] text-xs font-semibold mb-3 mt-4">定价模型</div>
            {menuItems.filter(i => i.category === '定价模型').map((item) => (
              <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1.5 rounded transition-colors"
                onClick={() => handleClick(item)}>
                <span className="text-[#999] w-5">{item.number})</span>
                <span className="text-[#d4af37] font-semibold w-12">{item.code}</span>
                <span className="text-[#ccc] flex-1">{item.name}</span>
              </div>
            ))}
          </div>

          {/* Column 2: 风险计量 + 信用与对手方 */}
          <div className="space-y-2">
            <div className="text-[#d4af37] text-xs font-semibold mb-3">风险计量</div>
            {menuItems.filter(i => i.category === '风险计量').map((item) => (
              <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1.5 rounded transition-colors"
                onClick={() => handleClick(item)}>
                <span className="text-[#999] w-5">{item.number})</span>
                <span className="text-[#d4af37] font-semibold w-12">{item.code}</span>
                <span className="text-[#ccc] flex-1">{item.name}</span>
              </div>
            ))}
            <div className="text-[#d4af37] text-xs font-semibold mb-3 mt-4">信用与对手方</div>
            {menuItems.filter(i => i.category === '信用与对手方').map((item) => (
              <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1.5 rounded transition-colors"
                onClick={() => handleClick(item)}>
                <span className="text-[#999] w-5">{item.number})</span>
                <span className="text-[#d4af37] font-semibold w-12">{item.code}</span>
                <span className="text-[#ccc] flex-1">{item.name}</span>
              </div>
            ))}
          </div>

          {/* Column 3: 高级分析 + 运维与监控 */}
          <div className="space-y-2">
            <div className="text-[#d4af37] text-xs font-semibold mb-3">高级分析</div>
            {menuItems.filter(i => i.category === '高级分析').map((item) => (
              <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1.5 rounded transition-colors"
                onClick={() => handleClick(item)}>
                <span className="text-[#999] w-5">{item.number})</span>
                <span className="text-[#d4af37] font-semibold w-12">{item.code}</span>
                <span className="text-[#ccc] flex-1">{item.name}</span>
              </div>
            ))}
            <div className="text-[#d4af37] text-xs font-semibold mb-3 mt-4">运维与监控</div>
            {menuItems.filter(i => i.category === '运维与监控').map((item) => (
              <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1.5 rounded transition-colors"
                onClick={() => handleClick(item)}>
                <span className="text-[#999] w-5">{item.number})</span>
                <span className="text-[#d4af37] font-semibold w-12">{item.code}</span>
                <span className="text-[#ccc] flex-1">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#333] px-6 py-3 bg-[#0f0f0f] flex justify-between items-center">
          <span className="text-[#999] text-xs">定价与风险分析中心 v2.0 | 覆盖收益率曲线·波动率曲面·估值引擎·VaR·压力测试·Greeks·策略回测</span>
          <button onClick={onClose} className="px-4 py-2 text-xs bg-[#d4af37] text-black hover:bg-[#e5c158] transition-colors rounded-sm font-semibold">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
