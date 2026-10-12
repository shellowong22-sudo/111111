import { FileWarning, FolderLock, ShieldCheck } from 'lucide-react';

export default function DocumentLibraryEvidenceDesk() {
  return <section className="rounded border border-sky-900/60 bg-slate-950 p-3 text-slate-100" data-document-library-evidence="true"><div className="flex items-start gap-2"><FileWarning className="mt-0.5 h-4 w-4 text-sky-300" /><div><p className="text-sm font-bold text-sky-200">DOCS · 文件与资料证据状态</p><p className="mt-1 text-[10px] leading-4 text-slate-400">当前终端没有导入可验证文件、授权来源目录、文档访问权限、文件哈希、上传者、发布日期或下载审计记录；因此不显示研报、文件数量、下载量、分类、预览、下载或收藏结果。</p></div></div><div className="mt-3 grid gap-2 md:grid-cols-3"><Status icon={<FolderLock className="h-4 w-4 text-amber-300" />} label="文件与目录" value="未导入" description="没有可验证的文件字节、元数据或目录来源。" /><Status icon={<ShieldCheck className="h-4 w-4 text-amber-300" />} label="权限与来源" value="未连接" description="没有授权范围、来源归属或访问控制证据。" /><Status icon={<FileWarning className="h-4 w-4 text-amber-300" />} label="预览与下载" value="不可用" description="无法提供查看、下载、收藏或下载统计。" /></div><p className="mt-3 rounded border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">暂无可验证文件记录。导入经授权的文件及元数据后，才可在终端内按来源和权限显示。</p></section>;
}

function Status({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
  return <div className="rounded border border-slate-800 bg-slate-900/35 p-2"><div className="flex items-center gap-1.5">{icon}<p className="text-[10px] text-slate-300">{label}</p></div><p className="mt-2 text-xs font-medium text-amber-200">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{description}</p></div>;
}
