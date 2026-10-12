import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, Zap, FileText, HelpCircle, Smartphone, Grid3x3, Download, BarChart3 } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface QuickToolsPanelProps {
  title: string;
}

// 同一面板服务于平台工具与帮助入口：按入口打开对应标签页，避免
// “灵活屏 / 数据导出 / 文档 / 关于”都停在快捷键页。
const INITIAL_TAB_BY_TITLE: Record<string, string> = {
  '快捷键参考': 'shortcuts',
  '文档中心': 'docs',
  '关于 Finance Hub': 'about',
  '灵活屏': 'tools',
  '数据导出': 'tools',
  'UQuant 量化工具': 'tools',
  '移动版': 'tools',
};

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // 防止表格软件把以 = + - @ 开头的单元格当作公式执行。
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export default function QuickToolsPanel({ title }: QuickToolsPanelProps) {
  const [activeTab, setActiveTab] = useState(INITIAL_TAB_BY_TITLE[title] ?? 'shortcuts');
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // 数据导出：读取后端当前行情表（与终端其它面板同一数据源），导出为 CSV。
  // 后端没有可验证行时如实提示，不生成示例数据。
  const exportMarketCsv = async () => {
    try {
      const rows = (await utils.market.getAll.fetch()) as Array<Record<string, unknown>>;
      if (!rows || rows.length === 0) {
        toast.error('当前没有可导出的行情数据', { description: '后端行情表为空，未生成文件。' });
        return;
      }
      const columns = ['symbol', 'name', 'market', 'price', 'change', 'changePct', 'updatedAt'];
      const lines = [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))];
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance-hub-market-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${rows.length} 条行情记录`);
    } catch {
      toast.error('行情数据读取失败', { description: '后端接口不可用，未生成文件。' });
    }
  };

  const openTool = (code: string) => {
    if (code === 'FLEX') setLocation('/workspace');
    else if (code === 'EXPORT') void exportMarketCsv();
    else if (code === 'BQUANT') setLocation('/bquant');
    else if (code === 'SETTINGS') setLocation('/settings');
  };

  const shortcuts = [
    { key: 'Ctrl/Cmd + K', description: '打开命令面板' },
    { key: 'Ctrl/Cmd + N', description: '新建窗口' },
    { key: 'Ctrl/Cmd + W', description: '关闭窗口' },
    { key: 'Ctrl/Cmd + L', description: '焦点搜索栏' },
    { key: 'Escape', description: '关闭对话框' },
    { key: 'Enter', description: '执行命令' },
    { key: '↑ ↓ ← →', description: '导航' },
    { key: 'Ctrl/Cmd + +', description: '放大' },
    { key: 'Ctrl/Cmd + -', description: '缩小' },
    { key: 'Ctrl/Cmd + 0', description: '重置缩放' },
  ];

  const tools = [
    {
      name: '灵活屏',
      code: 'FLEX',
      description: '自定义多窗口布局，支持拖拽、最小化、最大化',
      icon: <Grid3x3 className="w-5 h-5" />,
    },
    {
      name: '数据导出',
      code: 'EXPORT',
      description: '导出表格数据为 CSV、Excel、PDF 格式',
      icon: <Download className="w-5 h-5" />,
    },
    {
      name: 'UQuant',
      code: 'BQUANT',
      description: '量化分析工具，支持自定义策略回测',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      name: '设置',
      code: 'SETTINGS',
      description: '系统设置、主题、语言、货币偏好',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const docs = [
    {
      title: '快速开始',
      content: '了解 Finance Hub 的基本操作和导航方式',
    },
    {
      title: '功能模块',
      content: '详细介绍各个功能模块的用途和使用方法',
    },
    {
      title: '数据来源',
      content: '说明所有数据的来源和更新频率',
    },
    {
      title: 'API 文档',
      content: '开发者文档，包含所有 API 接口说明',
    },
    {
      title: '常见问题',
      content: '解答用户常见的问题和故障排除指南',
    },
    {
      title: '更新日志',
      content: '查看最新版本的功能更新和改进',
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
          <p className="text-muted-foreground">
            快速访问平台工具和功能帮助
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shortcuts">快捷键</TabsTrigger>
            <TabsTrigger value="tools">工具</TabsTrigger>
            <TabsTrigger value="docs">文档</TabsTrigger>
            <TabsTrigger value="about">关于</TabsTrigger>
          </TabsList>

          {/* 快捷键标签页 */}
          <TabsContent value="shortcuts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>快捷键参考</CardTitle>
                <CardDescription>
                  使用这些快捷键可以更快地操作 Finance Hub
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shortcuts.map((shortcut, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-muted-foreground text-sm">{shortcut.description}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {shortcut.key}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 工具标签页 */}
          <TabsContent value="tools" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map((tool, idx) => (
                <Card key={idx} className="hover:border-accent/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg text-accent">
                          {tool.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{tool.name}</CardTitle>
                          <Badge variant="secondary" className="mt-1 font-mono text-xs">
                            {tool.code}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{tool.description}</p>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => openTool(tool.code)}>
                      打开工具
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 文档标签页 */}
          <TabsContent value="docs" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docs.map((doc, idx) => (
                <Card key={idx} className="hover:border-accent/50 transition-colors cursor-pointer" onClick={() => setLocation('/help')}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                      <div>
                        <CardTitle className="text-base">{doc.title}</CardTitle>
                        <CardDescription className="mt-2">{doc.content}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 关于标签页 */}
          <TabsContent value="about" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>关于 Finance Hub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">版本信息</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">应用版本</span>
                      <p className="font-mono">v1.0.0</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">发布日期</span>
                      <p className="font-mono">2026-06-17</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">构建号</span>
                      <p className="font-mono">572cad40</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">环境</span>
                      <p className="font-mono">Production</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">功能特性</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ 实时行情数据展示（股票、债券、外汇、商品等）</li>
                    <li>✓ 专业级图表分析工具</li>
                    <li>✓ 投资组合管理和风险分析</li>
                    <li>✓ 财经新闻和经济日历</li>
                    <li>✓ 量化回测和策略优化</li>
                    <li>✓ 多窗口灵活布局</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">系统要求</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• 现代浏览器（Chrome、Firefox、Safari、Edge）</li>
                    <li>• 最小分辨率：1024x768</li>
                    <li>• 网络连接：宽带或 4G/5G</li>
                    <li>• JavaScript 已启用</li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    © 2026 Finance Hub. 保留所有权利。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
