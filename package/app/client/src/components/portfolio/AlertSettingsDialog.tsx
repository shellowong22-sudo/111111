import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Trash2, Play } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface AlertRule {
  id: string;
  symbol: string;
  ruleType: string;
  threshold: string;
  isActive: boolean;
}

export default function AlertSettingsDialog({ symbol, portfolioId }: { symbol?: string; portfolioId?: string }) {
  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState<'price_above' | 'price_below' | 'var_above' | 'var_below'>('price_above');
  const [threshold, setThreshold] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [rules, setRules] = useState<AlertRule[]>([]);

  // 获取预警规则列表
  const { data: rulesData } = trpc.alert.listRules.useQuery(
    { portfolioId, symbol },
    { enabled: open }
  );

  // 创建预警规则
  const createRuleMutation = trpc.alert.createRule.useMutation({
    onSuccess: () => {
      toast.success('预警规则已创建');
      setThreshold('');
      // 刷新列表
      if (rulesData) {
        setRules([...rulesData]);
      }
    },
    onError: (err) => {
      toast.error(`创建失败: ${err.message}`);
    },
  });

  // 删除预警规则
  const deleteRuleMutation = trpc.alert.deleteRule.useMutation({
    onSuccess: () => {
      toast.success('预警规则已删除');
      setRules(rules.filter(r => r.id !== deleteRuleMutation.variables?.ruleId));
    },
  });

  // 手动触发预警
  const triggerAlertMutation = trpc.alert.triggerAlert.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
  });

  const handleCreateRule = async () => {
    if (!threshold) {
      toast.error('请输入阈值');
      return;
    }
    await createRuleMutation.mutateAsync({
      portfolioId,
      symbol: symbol || 'N/A',
      ruleType: ruleType as any,
      threshold,
    });
  };

  const handleTriggerAlert = async (ruleId: string) => {
    if (!currentValue) {
      toast.error('请输入当前价格/风险值');
      return;
    }
    await triggerAlertMutation.mutateAsync({
      ruleId,
      currentValue,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs border-green-700 text-green-400 hover:bg-green-900/20"
        >
          <Bell className="w-3 h-3" />
          设置预警
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-[#0a0a0f] border-green-900/50 text-green-400">
        <DialogHeader>
          <DialogTitle className="text-green-400">市场预警设置</DialogTitle>
          <DialogDescription className="text-green-700">
            为 {symbol || '组合'} 设置价格或风险预警规则
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-black/50">
            <TabsTrigger value="create" className="text-xs">创建预警</TabsTrigger>
            <TabsTrigger value="list" className="text-xs">预警列表</TabsTrigger>
          </TabsList>

          {/* 创建预警标签页 */}
          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs text-green-500">预警类型</Label>
              <Select value={ruleType} onValueChange={(v) => setRuleType(v as any)}>
                <SelectTrigger className="bg-black/50 border-green-900/30 text-green-400 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-green-900/30">
                  <SelectItem value="price_above" className="text-green-400 text-xs">价格上升至</SelectItem>
                  <SelectItem value="price_below" className="text-green-400 text-xs">价格下降至</SelectItem>
                  <SelectItem value="var_above" className="text-green-400 text-xs">VaR 超过</SelectItem>
                  <SelectItem value="var_below" className="text-green-400 text-xs">VaR 低于</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-green-500">阈值</Label>
              <Input
                type="number"
                placeholder="输入阈值"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="bg-black/50 border-green-900/30 text-green-400 text-xs placeholder:text-green-800"
              />
            </div>

            <Button
              onClick={handleCreateRule}
              disabled={createRuleMutation.isPending}
              className="w-full bg-green-900/30 text-green-400 hover:bg-green-900/50 text-xs"
            >
              {createRuleMutation.isPending ? '创建中...' : '创建预警'}
            </Button>
          </TabsContent>

          {/* 预警列表标签页 */}
          <TabsContent value="list" className="space-y-3 mt-4 max-h-64 overflow-y-auto">
            {rulesData && rulesData.length > 0 ? (
              rulesData.map((rule) => (
                <div
                  key={rule.id}
                  className="p-2 bg-black/50 border border-green-900/30 rounded text-xs space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-green-400 font-mono">
                        {rule.symbol} · {rule.ruleType}
                      </div>
                      <div className="text-green-700 text-[10px]">
                        阈值: {rule.threshold}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRuleMutation.mutate({ ruleId: rule.id })}
                      className="text-red-500 hover:text-red-400 h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* 手动触发测试 */}
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      placeholder="当前值"
                      value={currentValue}
                      onChange={(e) => setCurrentValue(e.target.value)}
                      className="bg-black/30 border-green-900/20 text-green-400 text-[10px] h-6 placeholder:text-green-900"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleTriggerAlert(rule.id)}
                      disabled={triggerAlertMutation.isPending}
                      className="bg-green-900/30 text-green-400 hover:bg-green-900/50 h-6 px-2 text-[10px]"
                    >
                      <Play className="w-2 h-2" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-green-700 text-xs py-4">
                暂无预警规则
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
