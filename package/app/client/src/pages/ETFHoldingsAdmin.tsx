import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import OpenBBModuleDataBand from "@/components/OpenBBModuleDataBand";

const HOLDING_TYPES = ["股票", "债券", "商品", "货币", "衍生品", "基金", "其他"];

type HoldingRow = {
  id: number;
  etfId: number;
  holdingName: string;
  holdingType: string | null;
  weight: number;
  etfSymbol?: string | null;
  etfName?: string | null;
};

type FormState = {
  etfId: string;
  holdingName: string;
  holdingType: string;
  weight: string;
};

const emptyForm: FormState = { etfId: "", holdingName: "", holdingType: "股票", weight: "" };

export default function ETFHoldingsAdmin() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<HoldingRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filterEtfId, setFilterEtfId] = useState<string>("all");

  const { data: holdings, isLoading, error, refetch } = trpc.etf.getAllHoldings.useQuery();
  const { data: etfList } = trpc.etf.list.useQuery();

  const createMutation = trpc.etf.createHolding.useMutation({
    onSuccess: () => {
      toast.success("持仓记录已添加");
      setDialogOpen(false);
      setForm(emptyForm);
      void refetch();
    },
    onError: (e) => toast.error(`添加失败: ${e.message}`),
  });

  const updateMutation = trpc.etf.updateHolding.useMutation({
    onSuccess: () => {
      toast.success("持仓记录已更新");
      setDialogOpen(false);
      setEditingRow(null);
      setForm(emptyForm);
      void refetch();
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.etf.deleteHolding.useMutation({
    onSuccess: () => {
      toast.success("持仓记录已删除");
      setDeleteId(null);
      void refetch();
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const handleOpenCreate = () => {
    setEditingRow(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (row: HoldingRow) => {
    setEditingRow(row);
    setForm({
      etfId: String(row.etfId),
      holdingName: row.holdingName,
      holdingType: row.holdingType || "其他",
      weight: String(row.weight),
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const etfIdNum = parseInt(form.etfId);
    const weightNum = parseFloat(form.weight);
    if (isNaN(etfIdNum) || etfIdNum <= 0) return toast.error("请选择有效的 ETF");
    if (!form.holdingName.trim()) return toast.error("持仓名称不能为空");
    if (isNaN(weightNum) || weightNum < 0 || weightNum > 100) return toast.error("权重须在 0-100 之间");

    if (editingRow) {
      updateMutation.mutate({
        id: editingRow.id,
        holdingName: form.holdingName.trim(),
        holdingType: form.holdingType,
        weight: weightNum,
      });
    } else {
      createMutation.mutate({
        etfId: etfIdNum,
        holdingName: form.holdingName.trim(),
        holdingType: form.holdingType,
        weight: weightNum,
      });
    }
  };

  const filteredHoldings = holdings
    ? filterEtfId === "all"
      ? holdings
      : holdings.filter(h => String(h.etfId) === filterEtfId)
    : [];

  const totalWeight = filteredHoldings.reduce((s, h) => s + h.weight, 0);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="bg-gray-900 border-gray-700 max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Database className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-gray-300 text-lg font-medium">需要登录</p>
            <p className="text-gray-500 text-sm">ETF 持仓管理需要管理员权限，请先登录。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <OpenBBModuleDataBand path="/etf-holdings-admin" title="ETF 持仓与披露数据" />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">ETF 持仓数据管理</h1>
            <p className="text-gray-400 text-sm mt-1">管理各 ETF 产品的持仓权重数据，数据将实时反映在 ETF 详情页的图表中</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => void refetch()} className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
            <Button size="sm" onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              添加持仓
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="pt-4 pb-4">
              <p className="text-gray-400 text-xs">总持仓记录</p>
              <p className="text-2xl font-bold text-white mt-1">{holdings?.length ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="pt-4 pb-4">
              <p className="text-gray-400 text-xs">ETF 产品数</p>
              <p className="text-2xl font-bold text-white mt-1">{etfList?.length ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="pt-4 pb-4">
              <p className="text-gray-400 text-xs">当前筛选权重合计</p>
              <p className={`text-2xl font-bold mt-1 ${Math.abs(totalWeight - 100) < 1 ? "text-green-400" : "text-yellow-400"}`}>
                {totalWeight.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Label className="text-gray-400 text-sm">筛选 ETF：</Label>
          <Select value={filterEtfId} onValueChange={setFilterEtfId}>
            <SelectTrigger className="w-56 bg-gray-900 border-gray-700 text-gray-200">
              <SelectValue placeholder="全部 ETF" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">全部 ETF</SelectItem>
              {etfList?.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.symbol} — {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterEtfId !== "all" && (
            <Badge variant="secondary" className="bg-blue-900 text-blue-300">
              {filteredHoldings.length} 条
            </Badge>
          )}
        </div>

        {/* Table */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">持仓明细</CardTitle>
            <CardDescription className="text-gray-400 text-xs">
              修改权重后数据将立即反映在 ETF 详情页的环形图和热力图中
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-800" />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 text-red-400 py-8 justify-center">
                <AlertCircle className="w-5 h-5" />
                <span>加载失败：{error.message}</span>
                <Button variant="outline" size="sm" onClick={() => void refetch()} className="border-red-700 text-red-400">
                  重试
                </Button>
              </div>
            ) : filteredHoldings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>暂无持仓数据</p>
                <Button size="sm" onClick={handleOpenCreate} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  添加第一条持仓
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                    <TableHead className="text-gray-400">ID</TableHead>
                    <TableHead className="text-gray-400">ETF</TableHead>
                    <TableHead className="text-gray-400">持仓名称</TableHead>
                    <TableHead className="text-gray-400">类型</TableHead>
                    <TableHead className="text-gray-400 text-right">权重 (%)</TableHead>
                    <TableHead className="text-gray-400 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHoldings.map(row => (
                    <TableRow key={row.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="text-gray-500 text-xs">{row.id}</TableCell>
                      <TableCell>
                        <span className="text-blue-400 font-mono text-xs">{row.etfSymbol ?? `#${row.etfId}`}</span>
                        {row.etfName && <span className="text-gray-500 text-xs ml-1">({row.etfName})</span>}
                      </TableCell>
                      <TableCell className="text-gray-200 font-medium">{row.holdingName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                          {row.holdingType || "其他"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono text-sm ${row.weight >= 10 ? "text-yellow-400" : "text-gray-300"}`}>
                          {row.weight.toFixed(4)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(row)}
                            className="text-gray-400 hover:text-white hover:bg-gray-700 h-7 w-7 p-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(row.id)}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{editingRow ? "编辑持仓记录" : "添加持仓记录"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingRow ? `正在编辑 ID ${editingRow.id} 的持仓记录` : "为指定 ETF 添加一条新的持仓权重记录"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">ETF 产品</Label>
              <Select
                value={form.etfId}
                onValueChange={v => setForm(f => ({ ...f, etfId: v }))}
                disabled={!!editingRow}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-200">
                  <SelectValue placeholder="选择 ETF" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {etfList?.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.symbol} — {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">持仓名称</Label>
              <Input
                value={form.holdingName}
                onChange={e => setForm(f => ({ ...f, holdingName: e.target.value }))}
                placeholder="如：苹果公司 (AAPL)"
                className="bg-gray-800 border-gray-600 text-gray-200 placeholder:text-gray-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">资产类型</Label>
                <Select value={form.holdingType} onValueChange={v => setForm(f => ({ ...f, holdingType: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {HOLDING_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">权重 (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.0001}
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="如：5.25"
                  className="bg-gray-800 border-gray-600 text-gray-200 placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-gray-400 hover:text-white">
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : editingRow ? "保存修改" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              此操作不可撤销，将永久删除 ID {deleteId} 的持仓记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
