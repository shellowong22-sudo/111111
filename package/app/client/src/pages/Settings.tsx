import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Settings() {
  const [, navigate] = useLocation();
  const { theme, toggleTheme, switchable } = useTheme();
  const [language, setLanguage] = useState('zh');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');

  const handleExportData = () => {
    const settings = {
      language: localStorage.getItem('finance-hub-language') || 'zh',
      currency: localStorage.getItem('finance-hub-currency') || 'USD',
      autoRefresh: localStorage.getItem('finance-hub-autoRefresh') || 'true',
      notifications: localStorage.getItem('finance-hub-notifications') || 'true',
      theme: localStorage.getItem('finance-hub-theme') || 'dark',
      exportTime: new Date().toISOString(),
    };
    const rows = Object.entries(settings).map(([k, v]) => `${k},${v}`);
    const csv = ['\uFEFF配置项,当前值', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-hub-settings-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('设置数据已导出为 CSV 文件');
  };

  const handleSave = () => {
    localStorage.setItem('finance-hub-language', language);
    localStorage.setItem('finance-hub-currency', defaultCurrency);
    localStorage.setItem('finance-hub-autoRefresh', String(autoRefresh));
    localStorage.setItem('finance-hub-notifications', String(notifications));
    toast.success('设置已保存');
  };

  const handleThemeSelect = (value: string) => {
    if (!switchable || !toggleTheme) return;
    if (value === 'dark' && theme !== 'dark') toggleTheme();
    if (value === 'light' && theme !== 'light') toggleTheme();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">设置</h1>
          <p className="text-muted-foreground">
            自定义您的 Finance Hub 体验
          </p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">常规</TabsTrigger>
            <TabsTrigger value="display">显示</TabsTrigger>
            <TabsTrigger value="data">数据</TabsTrigger>
            <TabsTrigger value="about">关于</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>常规设置</CardTitle>
                <CardDescription>基本应用设置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">语言</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="ko">한국어</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">默认货币</label>
                  <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">美元 (USD)</SelectItem>
                      <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                      <SelectItem value="JPY">日元 (JPY)</SelectItem>
                      <SelectItem value="GBP">英镑 (GBP)</SelectItem>
                      <SelectItem value="CAD">加拿大元 (CAD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">自动刷新数据</p>
                    <p className="text-sm text-muted-foreground">每秒自动更新市场数据</p>
                  </div>
                  <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">启用通知</p>
                    <p className="text-sm text-muted-foreground">接收重要市场提醒</p>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="display" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>显示设置</CardTitle>
                <CardDescription>自定义界面外观与主题</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme picker cards */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">界面主题</label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Dark mode card */}
                    <button
                      onClick={() => handleThemeSelect('dark')}
                      className={cn(
                        'relative p-4 rounded-lg border-2 text-left transition-all duration-200 group',
                        theme === 'dark'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Moon className={cn(
                          'w-4 h-4 transition-colors',
                          theme === 'dark' ? 'text-blue-400' : 'text-muted-foreground'
                        )} />
                        <span className="text-sm font-medium">夜间模式</span>
                        {theme === 'dark' && (
                          <Badge className="ml-auto text-[10px] py-0 px-1.5 h-4">当前</Badge>
                        )}
                      </div>
                      {/* Preview */}
                      <div className="bg-slate-900 rounded p-2 space-y-1.5">
                        <div className="flex gap-1">
                          <div className="h-1.5 w-8 rounded-full bg-blue-400/70" />
                          <div className="h-1.5 w-12 rounded-full bg-slate-600" />
                        </div>
                        <div className="flex gap-1">
                          <div className="h-1.5 w-6 rounded-full bg-green-400/70" />
                          <div className="h-1.5 w-10 rounded-full bg-slate-700" />
                        </div>
                        <div className="flex gap-1">
                          <div className="h-1.5 w-10 rounded-full bg-amber-400/70" />
                          <div className="h-1.5 w-8 rounded-full bg-slate-600" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">适合夜间和低光环境，减少眼睛疲劳</p>
                    </button>

                    {/* Light mode card */}
                    <button
                      onClick={() => handleThemeSelect('light')}
                      className={cn(
                        'relative p-4 rounded-lg border-2 text-left transition-all duration-200 group',
                        theme === 'light'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Sun className={cn(
                          'w-4 h-4 transition-colors',
                          theme === 'light' ? 'text-amber-500' : 'text-muted-foreground'
                        )} />
                        <span className="text-sm font-medium">日间模式</span>
                        {theme === 'light' && (
                          <Badge className="ml-auto text-[10px] py-0 px-1.5 h-4">当前</Badge>
                        )}
                      </div>
                      {/* Preview */}
                      <div className="bg-white border border-slate-200 rounded p-2 space-y-1.5">
                        <div className="flex gap-1">
                          <div className="h-1.5 w-8 rounded-full bg-blue-600/70" />
                          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                        </div>
                        <div className="flex gap-1">
                          <div className="h-1.5 w-6 rounded-full bg-green-600/70" />
                          <div className="h-1.5 w-10 rounded-full bg-slate-100" />
                        </div>
                        <div className="flex gap-1">
                          <div className="h-1.5 w-10 rounded-full bg-amber-500/70" />
                          <div className="h-1.5 w-8 rounded-full bg-slate-200" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">适合白天和明亮环境，清晰易读</p>
                    </button>
                  </div>
                </div>

                {/* Quick toggle */}
                {switchable && toggleTheme && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Moon className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Sun className="w-5 h-5 text-amber-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          当前：{theme === 'dark' ? '夜间模式' : '日间模式'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          顶部导航栏也有快捷切换按钮，或按 <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted border border-border rounded">Ctrl+Shift+L</kbd>
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={theme === 'dark'}
                      onCheckedChange={() => toggleTheme()}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>数据设置</CardTitle>
                <CardDescription>数据管理和隐私选项</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium mb-3">数据导出</p>
                  <Button variant="outline" className="w-full" onClick={handleExportData}>
                    导出所有数据
                  </Button>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">缓存管理</p>
                  <Button variant="outline" className="w-full" onClick={() => { localStorage.clear(); toast.success('缓存已清除'); }}>
                    清除缓存
                  </Button>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">重置设置</p>
                  <Button variant="destructive" className="w-full" onClick={() => { localStorage.clear(); toast.success('设置已重置'); }}>
                    恢复默认设置
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>关于 Finance Hub</CardTitle>
                <CardDescription>应用信息和版本</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">应用名称</p>
                  <p className="font-semibold">Finance Hub - 专业金融终端</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">版本</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">1.0.0</p>
                    <Badge>最新</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">构建信息</p>
                  <p className="text-sm">
                    构建日期: 2026-06-30
                    <br />
                    构建号: 87a9bc59
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">技术栈</p>
                  <div className="space-y-1 text-sm">
                    <p>前端: React 19 + Tailwind CSS 4 + shadcn/ui</p>
                    <p>后端: Node.js + Express + tRPC</p>
                    <p>数据库: MySQL 8.0 + Drizzle ORM</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">许可证</p>
                  <p className="text-sm">MIT License</p>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    © 2026 Finance Hub. All rights reserved.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex gap-4">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
            取消
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}
