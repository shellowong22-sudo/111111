import { useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Download, FileCheck2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type RegistryRecord = {
  id: number;
  researchId?: string | null;
  verificationCode?: string | null;
  moduleId?: string | null;
  exportFormat?: "csv" | "pdf" | null;
  userName?: string | null;
  userId?: number | null;
  createdAt?: Date | string | null;
  verificationExpiresAt?: Date | string | null;
};

function csvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadRegistryCsv(records: RegistryRecord[]) {
  const headers = ["登记编号", "研究编号", "签名校验码", "模块", "导出格式", "用户", "创建时间", "验证到期时间"];
  const rows = records.map(record => [record.id, record.researchId, record.verificationCode, record.moduleId, record.exportFormat, record.userName ?? record.userId, record.createdAt ? new Date(record.createdAt).toISOString() : "", record.verificationExpiresAt ? new Date(record.verificationExpiresAt).toISOString() : ""]);
  const blob = new Blob([[headers, ...rows].map(row => row.map(csvValue).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `checklist-export-registry-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

export default function AdminExportRegistry() {
  const [moduleId, setModuleId] = useState("");
  const [exportFormat, setExportFormat] = useState<"" | "csv" | "pdf">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [researchId, setResearchId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const filters = useMemo(() => ({ page: 1, pageSize: 100, moduleId: moduleId.trim() || undefined, exportFormat: exportFormat || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }), [moduleId, exportFormat, dateFrom, dateTo]);
  const records = trpc.admin.listChecklistExportRecords.useQuery(filters);
  const exportRecords = trpc.admin.exportChecklistExportRecords.useMutation({
    onSuccess: payload => { downloadRegistryCsv(payload.data as RegistryRecord[]); toast.success(`已导出 ${payload.total} 条下载登记`); },
    onError: error => toast.error(error.message),
  });
  const verify = trpc.checklistCollaboration.verifyExportSignature.useMutation({
    onSuccess: result => toast.success(result.status === "valid" ? "签名校验有效" : `签名状态：${result.status}`),
    onError: error => toast.error(error.message),
  });
  const exportCurrent = () => exportRecords.mutate({ moduleId: filters.moduleId, exportFormat: filters.exportFormat, dateFrom: filters.dateFrom, dateTo: filters.dateTo });
  const verifyCurrent = () => {
    if (!researchId.trim() || !verificationCode.trim()) return toast.error("请输入研究编号和签名校验码");
    verify.mutate({ researchId: researchId.trim(), verificationCode: verificationCode.trim() });
  };

  return <AdminLayout><section className="space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Governance</p><h1 className="mt-1 text-2xl font-semibold text-white">下载登记检索</h1><p className="mt-1 text-sm text-slate-400">按模块、格式和日期审查受控研究导出；筛选结果可导出 CSV，签名可在线验证。</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => records.refetch()} disabled={records.isFetching} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"><RefreshCw className={`mr-2 h-4 w-4 ${records.isFetching ? "animate-spin" : ""}`} />刷新</Button><Button onClick={exportCurrent} disabled={exportRecords.isPending} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Download className="mr-2 h-4 w-4" />导出 CSV</Button></div></header>
    <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-4"><div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input value={moduleId} onChange={event => setModuleId(event.target.value.toUpperCase())} placeholder="模块代码，例如 SMUN" className="border-slate-700 bg-slate-950 pl-9 text-slate-100" /></div><select value={exportFormat} onChange={event => setExportFormat(event.target.value as typeof exportFormat)} className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"><option value="">全部导出格式</option><option value="csv">CSV</option><option value="pdf">PDF</option></select><div className="text-xs leading-5 text-slate-500">筛选只读取真实下载登记，不生成演示记录。</div><Input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label="起始日期" className="border-slate-700 bg-slate-950 text-slate-100" /><Input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} aria-label="结束日期" className="border-slate-700 bg-slate-950 text-slate-100" /></div>
    <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4 lg:grid-cols-[1fr_1fr_auto]"><div><p className="flex items-center gap-2 text-sm font-medium text-slate-200"><ShieldCheck className="h-4 w-4 text-cyan-400" />研究导出签名验证</p><Input value={researchId} onChange={event => setResearchId(event.target.value)} placeholder="研究编号，例如 SR-SMUN-T1-S2-S3" className="mt-2 border-slate-700 bg-slate-950 text-slate-100" /></div><div className="pt-6"><Input value={verificationCode} onChange={event => setVerificationCode(event.target.value.toUpperCase())} placeholder="签名校验码，例如 CHK-…" className="border-slate-700 bg-slate-950 text-slate-100" /></div><Button onClick={verifyCurrent} disabled={verify.isPending} className="self-end bg-slate-100 text-slate-950 hover:bg-white"><FileCheck2 className="mr-2 h-4 w-4" />验证签名</Button></div>
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">研究编号</th><th className="px-4 py-3">模块</th><th className="px-4 py-3">格式</th><th className="px-4 py-3">用户</th><th className="px-4 py-3">导出时间</th><th className="px-4 py-3">到期时间</th></tr></thead><tbody className="divide-y divide-slate-800">{(records.data?.data as RegistryRecord[] | undefined)?.map(record => <tr key={record.id} className="text-slate-300"><td className="px-4 py-3 font-mono text-cyan-300">{record.researchId || "—"}<span className="mt-1 block text-[10px] text-slate-600">{record.verificationCode || ""}</span></td><td className="px-4 py-3">{record.moduleId || "—"}</td><td className="px-4 py-3 uppercase text-slate-400">{record.exportFormat || "—"}</td><td className="px-4 py-3 text-slate-400">{record.userName || record.userId || "—"}</td><td className="px-4 py-3 text-slate-500">{record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}</td><td className="px-4 py-3 text-slate-500">{record.verificationExpiresAt ? new Date(record.verificationExpiresAt).toLocaleString() : "—"}</td></tr>)}{!records.isLoading && !records.data?.data.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500"><FileCheck2 className="mx-auto mb-2 h-5 w-5" />没有符合筛选条件的下载登记。</td></tr>}</tbody></table></div></div>{records.error && <p className="text-sm text-red-300">读取下载登记失败：{records.error.message}</p>}</section></AdminLayout>;
}
