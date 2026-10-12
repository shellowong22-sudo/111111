import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function Help() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">帮助中心</h1>
          <p className="text-muted-foreground">
            了解如何使用 Finance Hub 专业金融终端
          </p>
        </div>

        <Tabs defaultValue="shortcuts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shortcuts">快捷键</TabsTrigger>
            <TabsTrigger value="modules">功能模块</TabsTrigger>
            <TabsTrigger value="guide">使用指南</TabsTrigger>
            <TabsTrigger value="faq">常见问题</TabsTrigger>
          </TabsList>

          <TabsContent value="shortcuts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>快捷键速查表</CardTitle>
                <CardDescription>快速操作的键盘快捷方式</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <Badge variant="secondary" className="mb-2">Ctrl + K</Badge>
                        <p className="text-sm">打开命令搜索</p>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-2">Ctrl + /</Badge>
                        <p className="text-sm">显示快捷键帮助</p>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-2">Ctrl + N</Badge>
                        <p className="text-sm">新建窗口</p>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-2">Ctrl + W</Badge>
                        <p className="text-sm">关闭窗口</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Badge variant="secondary" className="mb-2">Alt + 1-9</Badge>
                        <p className="text-sm">快速切换窗口</p>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-2">Ctrl + S</Badge>
                        <p className="text-sm">保存布局</p>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-2">Ctrl + R</Badge>
                        <p className="text-sm">刷新数据</p>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-2">Ctrl + E</Badge>
                        <p className="text-sm">导出数据</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>主要功能模块</CardTitle>
                <CardDescription>Finance Hub 的核心功能介绍</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">市场数据</h3>
                  <p className="text-sm text-muted-foreground">
                    实时查看全球债券、股票、外汇、商品等市场数据。支持多维度筛选和对比分析。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">收益率曲线</h3>
                  <p className="text-sm text-muted-foreground">
                    分析全球主要国家的收益率曲线，支持历史数据查询和多曲线对比。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">财务分析</h3>
                  <p className="text-sm text-muted-foreground">
                    深入分析企业财务指标、信用评级和模型预测，支持多年度对比。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">交易工具</h3>
                  <p className="text-sm text-muted-foreground">
                    完整的交易委托管理、电子交易和 STP 直通处理功能。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guide" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>快速开始指南</CardTitle>
                <CardDescription>新用户入门步骤</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">1. 选择市场</h3>
                  <p className="text-sm text-muted-foreground">
                    从左侧导航菜单选择您感兴趣的市场（债券、股票、外汇等）。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. 应用筛选</h3>
                  <p className="text-sm text-muted-foreground">
                    使用顶部的筛选工具按地区、货币、评级等条件过滤数据。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. 查看详情</h3>
                  <p className="text-sm text-muted-foreground">
                    点击任何产品查看详细信息、历史数据和分析图表。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">4. 对比分析</h3>
                  <p className="text-sm text-muted-foreground">
                    选择多个产品进行对比分析，查看相对表现和风险指标。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>常见问题</CardTitle>
                <CardDescription>用户常见问题解答</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Q: 如何导出数据？</h3>
                  <p className="text-sm text-muted-foreground">
                    A: 在任何表格或图表上，使用右键菜单或 Ctrl+E 快捷键导出数据到 Excel 或 CSV 格式。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Q: 数据更新频率是多少？</h3>
                  <p className="text-sm text-muted-foreground">
                    A: 市场数据实时更新，每秒刷新一次。历史数据每小时更新一次。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Q: 如何自定义布局？</h3>
                  <p className="text-sm text-muted-foreground">
                    A: 拖拽窗口边界调整大小，使用 Ctrl+S 保存当前布局为默认设置。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Q: 支持哪些货币？</h3>
                  <p className="text-sm text-muted-foreground">
                    A: 支持 10+ 种主要货币，包括 USD、EUR、JPY、GBP、CAD 等。
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
