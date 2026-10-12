import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Database, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MARKET_TYPES = [
  { value: 'stock', label: '股票' },
  { value: 'option', label: '期权' },
  { value: 'fund', label: '基金' },
  { value: 'bond', label: '债券' },
  { value: 'forex', label: '外汇' },
  { value: 'commodity', label: '商品' },
  { value: 'index', label: '指数' },
  { value: 'derivative', label: '衍生品' },
] as const;

const MARKET_LABELS: Record<string, string> = {
  stock: '股票', option: '期权', fund: '基金', bond: '债券',
  forex: '外汇', commodity: '商品', index: '指数', derivative: '衍生品',
};

type MarketType = 'stock' | 'option' | 'fund' | 'bond' | 'forex' | 'commodity' | 'index' | 'derivative';

interface FormData {
  symbol: string;
  name: string;
  market: MarketType;
  price: string;
  changeVal: string;
  changePct: string;
  volume: string;
}

const defaultForm: FormData = {
  symbol: '',
  name: '',
  market: 'stock',
  price: '0',
  changeVal: '0',
  changePct: '0',
  volume: '0',
};

export default function MarketManagePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<(FormData & { id: number }) | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [editForm, setEditForm] = useState<FormData>(defaultForm);

  const utils = trpc.useUtils();

  const { data: allData = [], isLoading, refetch } = trpc.market.getAll.useQuery();

  const createMutation = trpc.market.create.useMutation({
    onSuccess: () => {
      toast.success('品种创建成功');
      utils.market.getAll.invalidate();
      setIsCreateOpen(false);
      setForm(defaultForm);
    },
    onError: (err) => {
      toast.error('创建失败：' + err.message);
    },
  });

  const updateMutation = trpc.market.update.useMutation({
    onSuccess: () => {
      toast.success('品种更新成功');
      utils.market.getAll.invalidate();
      setEditItem(null);
    },
    onError: (err) => {
      toast.error('更新失败：' + err.message);
    },
  });

  const deleteMutation = trpc.market.delete.useMutation({
    onSuccess: () => {
      toast.success('品种已删除');
      utils.market.getAll.invalidate();
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error('删除失败：' + err.message);
    },
  });

  const displayData = allData.filter(item => {
    const matchType = filterType === 'all' || item.market === filterType;
    const matchSearch = !searchQuery ||
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const handleCreate = () => {
    if (!form.symbol.trim() || !form.name.trim()) {
      toast.error('代码和名称不能为空');
      return;
    }
    createMutation.mutate(form);
  };

  const handleEdit = (item: typeof allData[0]) => {
    const f: FormData = {
      symbol: item.symbol,
      name: item.name,
      market: item.market as MarketType,
      price: item.price,
      changeVal: item.changeVal,
      changePct: item.changePct,
      volume: item.volume,
    };
    setEditForm(f);
    setEditItem({ ...f, id: item.id });
  };

  const handleUpdate = () => {
    if (!editItem) return;
    if (!editForm.symbol.trim() || !editForm.name.trim()) {
      toast.error('代码和名称不能为空');
      return;
    }
    updateMutation.mutate({ id: editItem.id, ...editForm });
  };

  const fmt = (num: string | number, d = 2) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0.00';
    return n.toFixed(d);
  };

  const isPos = (val: string | number) => (typeof val === 'string' ? parseFloat(val) : val) > 0;

  const FormFields = ({ data, onChange }: { data: FormData; onChange: (f: FormData) => void }) => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-xs">品种代码 *</Label>
        <Input
          value={data.symbol}
          onChange={e => onChange({ ...data, symbol: e.target.value })}
          placeholder="如 AAPL / 000001"
          className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-xs">品种名称 *</Label>
        <Input
          value={data.name}
          onChange={e => onChange({ ...data, name: e.target.value })}
          placeholder="如 Apple Inc."
          className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-xs">市场类型 *</Label>
        <Select value={data.market} onValueChange={v => onChange({ ...data, market: v as MarketType })}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {MARKET_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value} className="text-slate-200 focus:bg-slate-700">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-xs">最新价</Label>
        <Input
          type="number"
          value={data.price}
          onChange={e => onChange({ ...data, price: e.target.value })}
          placeholder="0.00"
          className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-xs">涨跌额</Label>
        <Input
          type="number"
          value={data.changeVal}
          onChange={e => onChange({ ...data, changeVal: e.target.value })}
          placeholder="0.00"
          className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-xs">涨跌幅 (%)</Label>
        <Input
          type="number"
          value={data.changePct}
          onChange={e => onChange({ ...data, changePct: e.target.value })}
          placeholder="0.00"
          className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
        />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label className="text-slate-300 text-xs">成交量</Label>
        <Input
          type="number"
          value={data.volume}
          onChange={e => onChange({ ...data, volume: e.target.value })}
          placeholder="0"
          className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* 顶部栏 */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="text-base font-bold text-slate-50">行情数据管理</h1>
              <p className="text-xs text-slate-500">录入、编辑、删除品种行情数据</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
              onClick={() => { setForm(defaultForm); setIsCreateOpen(true); }}
            >
              <Plus className="w-4 h-4" />
              新增品种
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-4">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['all', ...MARKET_TYPES.map(t => t.value)].slice(0, 5).map(type => {
            const count = type === 'all' ? allData.length : allData.filter(d => d.market === type).length;
            return (
              <Card
                key={type}
                className={cn(
                  "bg-slate-900 border-slate-700 cursor-pointer transition-all hover:border-blue-500/50",
                  filterType === type && "border-blue-500 bg-slate-800"
                )}
                onClick={() => setFilterType(type)}
              >
                <CardContent className="p-3">
                  <p className="text-xs text-slate-500">{type === 'all' ? '全部' : MARKET_LABELS[type]}</p>
                  <p className="text-xl font-bold text-slate-100 mt-1">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="搜索代码或名称..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', ...MARKET_TYPES.map(t => t.value)].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all border",
                  filterType === type
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                )}
              >
                {type === 'all' ? '全部' : MARKET_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* 数据表格 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="px-4 py-3 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-300">
                品种列表
              </CardTitle>
              <span className="text-xs text-slate-500">{displayData.length} / {allData.length} 条</span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">代码</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">名称</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase">类型</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">最新价</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">涨跌幅</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">成交量</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayData.length > 0 ? (
                  displayData.map(item => {
                    const pct = parseFloat(item.changePct);
                    const pos = pct > 0;
                    const neg = pct < 0;
                    const fmtVol = (v: string) => {
                      const n = parseInt(v);
                      if (isNaN(n) || n === 0) return '-';
                      if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
                      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
                      if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
                      return n.toString();
                    };
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-blue-400 font-medium">{item.symbol}</td>
                        <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate">{item.name}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {MARKET_LABELS[item.market] || item.market}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-100">{fmt(item.price, 4)}</td>
                        <td className={cn("px-4 py-3 text-right font-mono text-xs", pos ? 'text-green-400' : neg ? 'text-red-400' : 'text-slate-400')}>
                          {pos ? '+' : ''}{fmt(item.changePct, 2)}%
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">{fmtVol(item.volume)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10"
                              onClick={() => handleEdit(item)}
                              title="编辑"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                              onClick={() => setDeleteId(item.id)}
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>暂无数据</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 新增 Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              新增品种
            </DialogTitle>
          </DialogHeader>
          <FormFields data={form} onChange={setForm} />
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => setIsCreateOpen(false)}
            >
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? '创建中...' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 Dialog */}
      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-400" />
              编辑品种 — {editItem?.symbol}
            </DialogTitle>
          </DialogHeader>
          <FormFields data={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => setEditItem(null)}
            >
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white"
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? '保存中...' : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteId !== null} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              此操作不可撤销，确定要删除该品种数据吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => setDeleteId(null)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
