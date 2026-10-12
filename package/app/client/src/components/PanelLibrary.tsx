import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Search, Plus } from "lucide-react";

interface PanelOption {
  code: string;
  name: string;
  type: "bond" | "equity" | "derivative" | "commodity" | "index" | "economic";
  icon?: string;
  description?: string;
}

interface PanelLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (panelCode: string, panelName: string, panelType: string, icon?: string) => void;
  existingPanelCodes?: string[];
}

const AVAILABLE_PANELS: PanelOption[] = [
  // 债券面板
  { code: "wb", name: "全球债券市场", type: "bond", icon: "📊", description: "全球债券行情与分析" },
  { code: "secf", name: "证券融资", type: "bond", icon: "💰", description: "证券融资工具与分析" },
  { code: "psch", name: "优先股检索", type: "bond", icon: "🔍", description: "优先股市场数据" },
  { code: "corr", name: "相关系数矩阵", type: "bond", icon: "📈", description: "资产相关性分析" },
  { code: "gct", name: "图表曲线期间", type: "bond", icon: "📉", description: "收益率曲线分析" },
  { code: "gc3d", name: "绘制曲线层面", type: "bond", icon: "🎯", description: "3D 曲线可视化" },
  { code: "nim", name: "新券行情显示", type: "bond", icon: "⭐", description: "新发行债券行情" },
  { code: "nib", name: "新发行债券管理", type: "bond", icon: "📋", description: "新债券管理工具" },
  { code: "leag", name: "顾问公司排行榜", type: "bond", icon: "🏆", description: "顾问公司排名" },
  { code: "fibc", name: "债券计算器", type: "bond", icon: "🧮", description: "债券收益率计算" },
  { code: "imgr", name: "库存与价格", type: "bond", icon: "📦", description: "库存与价格管理" },
  { code: "des", name: "证券简介", type: "bond", icon: "📄", description: "证券信息查询" },

  // 权益面板
  { code: "ftw", name: "关注因子", type: "equity", icon: "⭐", description: "关键因子分析" },
  { code: "evts", name: "大事日历", type: "equity", icon: "📅", description: "重要事件日历" },
  { code: "most", name: "最活跃证券", type: "equity", icon: "🔥", description: "交易最活跃证券" },
  { code: "anr", name: "分析师建议", type: "equity", icon: "👨‍💼", description: "分析师评级与建议" },
  { code: "rv", name: "相对价值", type: "equity", icon: "⚖️", description: "相对价值分析" },
  { code: "ddis", name: "股息分配", type: "equity", icon: "💵", description: "股息分配信息" },
  { code: "omon", name: "期权行情", type: "equity", icon: "📊", description: "期权市场行情" },
  { code: "pe", name: "私募股权概览", type: "equity", icon: "🏢", description: "私募股权投资数据" },
  { code: "emsx", name: "执行管理系统", type: "equity", icon: "⚙️", description: "交易执行管理" },
  { code: "cact", name: "公司大事检索", type: "equity", icon: "🔔", description: "公司事件检索" },
  { code: "ma", name: "兼并与收购", type: "equity", icon: "🤝", description: "M&A 交易信息" },
  { code: "ipo", name: "股票发行", type: "equity", icon: "🚀", description: "IPO 发行信息" },

  // 衍生品面板
  { code: "wbf", name: "全球债券期货", type: "derivative", icon: "📈", description: "债券期货交易" },
  { code: "cdsw", name: "CDS 估值", type: "derivative", icon: "💳", description: "信用违约互换估值" },
  { code: "wcds", name: "全球 CDS 市场", type: "derivative", icon: "🌍", description: "全球 CDS 市场分析" },
  { code: "vca", name: "波动率分析", type: "derivative", icon: "📊", description: "波动率与相关系数" },
  { code: "mars", name: "多资产风险系统", type: "derivative", icon: "⚠️", description: "多资产风险管理" },
  { code: "ovcv", name: "可转债估价", type: "derivative", icon: "📋", description: "可转换债券定价" },
  { code: "dlib", name: "衍生品库", type: "derivative", icon: "📚", description: "衍生品产品库" },
  { code: "moso", name: "活跃期权", type: "derivative", icon: "🎯", description: "交易最活跃期权" },
  { code: "ovml", name: "外汇期权定价", type: "derivative", icon: "💱", description: "外汇与商品期权" },
  { code: "wvol", name: "世界波动率", type: "derivative", icon: "📉", description: "全球波动率监控" },

  // 商品面板
  { code: "ctm", name: "交易所合约", type: "commodity", icon: "📜", description: "期货合约信息" },
  { code: "seag", name: "季节性图", type: "commodity", icon: "📅", description: "商品季节性分析" },
  { code: "ccrv", name: "商品曲线", type: "commodity", icon: "📈", description: "商品期限结构" },
  { code: "cply", name: "供应链分析", type: "commodity", icon: "🔗", description: "商品供应链数据" },
  { code: "cosy", name: "商品系统", type: "commodity", icon: "⚙️", description: "商品交易系统" },
  { code: "gp", name: "全球价格", type: "commodity", icon: "🌍", description: "全球商品价格" },
  { code: "map", name: "市场分析平台", type: "commodity", icon: "🗺️", description: "商品市场分析" },

  // 指数面板
  { code: "weif", name: "全球股指期货", type: "index", icon: "📊", description: "全球股指期货" },
  { code: "wbix", name: "世界指数", type: "index", icon: "🌍", description: "全球指数行情" },
  { code: "inp", name: "指数成分", type: "index", icon: "📋", description: "指数成分查询" },
  { code: "cix", name: "自设指数", type: "index", icon: "⚙️", description: "自定义指数编辑" },
  { code: "rrg", name: "相对旋转图", type: "index", icon: "🔄", description: "相对强度分析" },

  // 经济分析面板
  { code: "ectr", name: "贸易流量", type: "economic", icon: "🚢", description: "国际贸易数据" },
  { code: "wfii", name: "外国投资", type: "economic", icon: "💼", description: "外国直接投资" },
  { code: "rsan", name: "地缘政治风险", type: "economic", icon: "🌐", description: "地缘政治分析" },
  { code: "ecfc", name: "经济预测", type: "economic", icon: "🔮", description: "经济预测模型" },
  { code: "fcon", name: "财务状况", type: "economic", icon: "💰", description: "国家财务状况" },
  { code: "ecan", name: "世界经济分析", type: "economic", icon: "🌍", description: "全球经济分析" },
  { code: "cenb", name: "央行查找", type: "economic", icon: "🏦", description: "央行数据查询" },
  { code: "cbrt", name: "央行利率", type: "economic", icon: "📊", description: "央行利率分析" },
  { code: "fomc", name: "美联储公开市场", type: "economic", icon: "🇺🇸", description: "美联储政策" },
  { code: "pmi", name: "标普 PMI", type: "economic", icon: "📈", description: "采购经理人指数" },
];

export function PanelLibrary({
  open,
  onClose,
  onSelect,
  existingPanelCodes = [],
}: PanelLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredPanels = AVAILABLE_PANELS.filter((panel) => {
    const matchesSearch =
      panel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      panel.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      panel.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = activeTab === "all" || panel.type === activeTab;
    const notExists = !existingPanelCodes.includes(panel.code);

    return matchesSearch && matchesTab && notExists;
  });

  const typeLabels: Record<string, string> = {
    bond: "债券",
    equity: "权益",
    derivative: "衍生品",
    commodity: "商品",
    index: "指数",
    economic: "经济分析",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加面板到工作台</DialogTitle>
        </DialogHeader>

        {/* 搜索框 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索面板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 分类 Tab */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="bond">债券</TabsTrigger>
            <TabsTrigger value="equity">权益</TabsTrigger>
            <TabsTrigger value="derivative">衍生品</TabsTrigger>
            <TabsTrigger value="commodity">商品</TabsTrigger>
            <TabsTrigger value="index">指数</TabsTrigger>
            <TabsTrigger value="economic">经济</TabsTrigger>
          </TabsList>

          {/* 面板列表 */}
          <TabsContent value={activeTab} className="space-y-3 mt-4">
            {filteredPanels.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                没有找到匹配的面板
              </div>
            ) : (
              filteredPanels.map((panel) => (
                <div
                  key={panel.code}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {panel.icon && <span className="text-2xl">{panel.icon}</span>}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{panel.name}</p>
                      <p className="text-xs text-gray-500">{panel.description}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                      {typeLabels[panel.type]}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelect(panel.code, panel.name, panel.type, panel.icon);
                      onClose();
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    添加
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
