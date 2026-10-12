import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Archive, CheckCircle2, Megaphone, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function AdminAnnouncements() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const list = trpc.announcement.list.useQuery({ status: "all", page: 1, pageSize: 50 });
  const create = trpc.announcement.create.useMutation({ onSuccess: () => { setTitle(""); setContent(""); toast.success("公告草稿已创建"); list.refetch(); }, onError: error => toast.error(error.message) });
  const accept = trpc.announcement.acceptForPublication.useMutation({ onSuccess: () => { toast.success("当前草稿已验收"); list.refetch(); }, onError: error => toast.error(error.message) });
  const publish = trpc.announcement.publish.useMutation({ onSuccess: () => { toast.success("公告已发布"); list.refetch(); }, onError: error => toast.error(error.message) });
  const archive = trpc.announcement.archive.useMutation({ onSuccess: () => { toast.success("公告已归档"); list.refetch(); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ title, content, type: "info", priority: 0 }); };
  return <AdminLayout><section className="space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Communications</p><h1 className="mt-1 text-2xl font-semibold text-white">公告管理</h1><p className="mt-1 text-sm text-slate-400">公告发布前验收：草稿须确认当前版本后才可发布，发布操作会创建对应用户通知。</p></header><form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4"><Input required value={title} onChange={event => setTitle(event.target.value)} placeholder="公告标题" className="border-slate-700 bg-slate-950 text-slate-100" /><Textarea required value={content} onChange={event => setContent(event.target.value)} placeholder="公告正文" className="min-h-24 border-slate-700 bg-slate-950 text-slate-100" /><Button type="submit" disabled={create.isPending} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Megaphone className="mr-2 h-4 w-4" />创建草稿</Button></form><div className="space-y-3">{list.data?.items.map((item: any) => <article key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="font-medium text-white">{item.title}</h2><span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">{item.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{item.content}</p></div><div className="flex shrink-0 flex-wrap gap-2">{item.status === "draft" && <><Button size="sm" variant="outline" onClick={() => accept.mutate({ id: item.id })} disabled={accept.isPending} className="border-slate-700 text-slate-200"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />确认验收 v{item.draftRevision}</Button><Button size="sm" onClick={() => publish.mutate({ id: item.id })} disabled={publish.isPending} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Send className="mr-1 h-3.5 w-3.5" />发布</Button></>}{item.status === "published" && <Button size="sm" variant="outline" onClick={() => archive.mutate({ id: item.id })} disabled={archive.isPending} className="border-slate-700 text-slate-200"><Archive className="mr-1 h-3.5 w-3.5" />归档</Button>}</div></div></article>)}{!list.isLoading && !list.data?.items.length && <div className="rounded-lg border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">尚无公告记录。</div>}</div>{list.error && <p className="text-sm text-red-300">公告服务暂不可用：{list.error.message}</p>}</section></AdminLayout>;
}
