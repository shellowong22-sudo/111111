import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  ChevronRight,
  ClipboardPlus,
  GitCompareArrows,
  Highlighter,
  History,
  Share2,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LoadingState } from "@/components/sovereign/PanelKit";
import {
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";

const colors = ["amber", "cyan", "rose", "emerald", "violet"] as const;
const categories = [
  { id: "key_rate", label: "关键利率" },
  { id: "policy_action", label: "政策动作" },
  { id: "forward_guidance", label: "前瞻性指引" },
  { id: "manual_note", label: "人工注记" },
] as const;
const toneClass = {
  added: "border-emerald-900 bg-emerald-950/25 text-emerald-100",
  removed: "border-rose-900 bg-rose-950/25 text-rose-100",
  unchanged: "border-slate-800 bg-slate-950 text-slate-300",
} as const;

function publishEvidenceContext(detail: {
  sourceId?: string;
  documentId?: number | null;
  olderId?: number | null;
  newerId?: number | null;
}) {
  window.dispatchEvent(
    new CustomEvent("money-market-policy-evidence-context", { detail })
  );
}

export default function PolicyEvidenceCollaborationPanel({
  initialSourceId = "FED",
}: {
  initialSourceId?: "FED" | "ECB" | "BOE" | "PBOC" | "CBC" | "BCB";
}) {
  const utils = trpc.useUtils();
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quotedText, setQuotedText] = useState("");
  const [annotation, setAnnotation] = useState("");
  const [category, setCategory] =
    useState<(typeof categories)[number]["id"]>("forward_guidance");
  const [color, setColor] = useState<(typeof colors)[number]>("amber");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [olderId, setOlderId] = useState<number | null>(null);
  const [newerId, setNewerId] = useState<number | null>(null);
  const documentsQuery =
    trpc.moneyMarketPolicyCollaboration.listDocuments.useQuery({
      sourceId,
      limit: 100,
    });
  const documents = documentsQuery.data ?? [];
  const selected = documents.find(item => item.id === selectedId) ?? null;
  const annotationsQuery =
    trpc.moneyMarketPolicyCollaboration.listAnnotations.useQuery(
      { documentId: selectedId ?? 0 },
      { enabled: !!selectedId }
    );
  const sharesQuery = trpc.moneyMarketPolicyCollaboration.listShares.useQuery(
    { documentId: selectedId ?? 0 },
    { enabled: !!selectedId && selected?.permission === "owner" }
  );
  const auditQuery = trpc.moneyMarketPolicyCollaboration.listAudit.useQuery(
    { documentId: selectedId ?? 0 },
    { enabled: !!selectedId }
  );
  const membersQuery =
    trpc.moneyMarketPolicyCollaboration.searchMembers.useQuery(
      { query: memberQuery, limit: 20 },
      { enabled: Boolean(memberQuery.trim()) }
    );
  const capture =
    trpc.moneyMarketPolicyCollaboration.captureDocument.useMutation({
      onSuccess: data => {
        setSelectedId(data.id);
        publishEvidenceContext({ sourceId, documentId: data.id });
        utils.moneyMarketPolicyCollaboration.listDocuments.invalidate();
      },
    });
  const saveAnnotation =
    trpc.moneyMarketPolicyCollaboration.saveAnnotation.useMutation({
      onSuccess: () => {
        setQuotedText("");
        setAnnotation("");
        utils.moneyMarketPolicyCollaboration.listAnnotations.invalidate();
        utils.moneyMarketPolicyCollaboration.listAudit.invalidate();
      },
    });
  const share = trpc.moneyMarketPolicyCollaboration.saveShare.useMutation({
    onSuccess: () => {
      setMemberId(null);
      setMemberQuery("");
      utils.moneyMarketPolicyCollaboration.listShares.invalidate();
      utils.moneyMarketPolicyCollaboration.listAudit.invalidate();
    },
  });
  const revoke = trpc.moneyMarketPolicyCollaboration.revokeShare.useMutation({
    onSuccess: () => {
      utils.moneyMarketPolicyCollaboration.listShares.invalidate();
      utils.moneyMarketPolicyCollaboration.listAudit.invalidate();
    },
  });
  const compare =
    trpc.moneyMarketPolicyCollaboration.compareGuidance.useMutation({
      onSuccess: () =>
        utils.moneyMarketPolicyCollaboration.listAudit.invalidate(),
    });
  const sameSourceDocs = useMemo(
    () => documents.filter(item => item.sourceId === sourceId),
    [documents, sourceId]
  );
  const captureDocument = () => {
    if (url.trim())
      capture.mutate({
        sourceId,
        url: url.trim(),
        title: title.trim() || undefined,
      });
  };
  const addAnnotation = () => {
    if (selectedId && quotedText.trim() && annotation.trim())
      saveAnnotation.mutate({
        documentId: selectedId,
        category,
        quotedText,
        annotation,
        highlightColor: color,
      });
  };
  return (
    <Card
      title="央行政策文件团队批注与版本差异"
      action={
        <span className="text-[10px] text-slate-500">
          账户协作 · 原文链接优先
        </span>
      }
    >
      <p className="mb-3 text-[11px] leading-5 text-slate-500">
        仅保存已登记央行官方原文的链接、内容指纹、关键词片段和团队批注；不会保存完整外部文件或自动生成政策结论。编辑权限可新增批注，所有者可授予或撤销成员访问。
      </p>
      <div className="grid gap-2 lg:grid-cols-[140px_1fr_180px_auto]">
        <select
          value={sourceId}
          onChange={e => {
            const value = e.target.value as typeof sourceId;
            setSourceId(value);
            setSelectedId(null);
            publishEvidenceContext({
              sourceId: value,
              documentId: null,
              olderId: null,
              newerId: null,
            });
          }}
          className="input-terminal text-xs"
        >
          {["FED", "ECB", "BOE", "PBOC", "CBC", "BCB"].map(id => (
            <option key={id}>{id}</option>
          ))}
        </select>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="input-terminal text-xs"
          placeholder="同一央行官方域名下的具体 HTML/文本原文 URL"
        />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input-terminal text-xs"
          placeholder="可选文件标题"
        />
        <button
          type="button"
          onClick={captureDocument}
          disabled={capture.isPending || !url.trim()}
          className="rounded border border-cyan-800 px-3 text-xs text-cyan-200 disabled:text-slate-600"
        >
          <BookOpenCheck className="mr-1 inline h-3 w-3" />
          捕获证据
        </button>
      </div>
      {capture.error && (
        <p className="mt-2 text-[11px] text-rose-300">
          {capture.error.message}
        </p>
      )}
      <div className="mt-4 grid gap-3 xl:grid-cols-[260px_1fr]">
        <div className="rounded border border-slate-800 p-2">
          <b className="text-xs text-slate-300">已捕获官方文件</b>
          <div className="mt-2 max-h-72 space-y-1 overflow-auto">
            {documentsQuery.isLoading ? (
              <LoadingState label="读取文件索引…" />
            ) : (
              sameSourceDocs.map(document => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(document.id);
                    publishEvidenceContext({
                      sourceId,
                      documentId: document.id,
                    });
                  }}
                  className={`w-full rounded border p-2 text-left text-[11px] ${selectedId === document.id ? "border-cyan-700 bg-cyan-950/30" : "border-slate-800 hover:border-slate-600"}`}
                >
                  <div className="truncate text-slate-200">
                    {document.title}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>
                      {new Date(document.retrievedAt).toLocaleDateString()}
                    </span>
                    <span>{document.permission}</span>
                  </div>
                </button>
              ))
            )}
            {!documentsQuery.isLoading && !sameSourceDocs.length && (
              <p className="rounded border border-dashed border-slate-700 p-2 text-[11px] text-slate-500">
                尚无该来源的文件证据。粘贴官方原始页面链接后捕获。
              </p>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {selected ? (
            <>
              <div className="rounded border border-slate-800 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b className="text-xs text-slate-200">{selected.title}</b>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {selected.sourceUrl}
                    </p>
                  </div>
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-300"
                  >
                    原文
                  </a>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <textarea
                    value={quotedText}
                    onChange={e => setQuotedText(e.target.value)}
                    className="input-terminal min-h-18 text-xs"
                    placeholder="粘贴需核验的原文片段；可对照上方原始文件"
                  />
                  <textarea
                    value={annotation}
                    onChange={e => setAnnotation(e.target.value)}
                    className="input-terminal min-h-18 text-xs"
                    placeholder="团队评论：说明核验问题、出处或待确认事项"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={category}
                    onChange={e =>
                      setCategory(e.target.value as typeof category)
                    }
                    className="input-terminal text-xs"
                  >
                    {categories.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={color}
                    onChange={e => setColor(e.target.value as typeof color)}
                    className="input-terminal text-xs"
                  >
                    {colors.map(item => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addAnnotation}
                    disabled={
                      saveAnnotation.isPending ||
                      selected.permission === "viewer"
                    }
                    className="rounded border border-amber-800 px-3 text-xs text-amber-200 disabled:text-slate-600"
                  >
                    <Highlighter className="mr-1 inline h-3 w-3" />
                    添加高亮批注
                  </button>
                </div>
                <div className="mt-3 space-y-1">
                  {annotationsQuery.isLoading ? (
                    <LoadingState label="读取团队批注…" />
                  ) : (
                    (annotationsQuery.data ?? []).map(item => (
                      <div
                        key={item.id}
                        className={`rounded border p-2 text-xs ${item.highlightColor === "rose" ? "border-rose-900 bg-rose-950/20" : item.highlightColor === "emerald" ? "border-emerald-900 bg-emerald-950/20" : item.highlightColor === "violet" ? "border-violet-900 bg-violet-950/20" : item.highlightColor === "cyan" ? "border-cyan-900 bg-cyan-950/20" : "border-amber-900 bg-amber-950/20"}`}
                      >
                        <div className="flex justify-between gap-2">
                          <b>{item.category}</b>
                          <span className="text-[10px] text-slate-500">
                            {item.userName ?? `成员 #${item.userId}`}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-300">
                          “{item.quotedText}”
                        </p>
                        <p className="mt-1 text-slate-400">{item.annotation}</p>
                      </div>
                    ))
                  )}
                  {!annotationsQuery.isLoading &&
                    !(annotationsQuery.data ?? []).length && (
                      <p className="rounded border border-dashed border-slate-700 p-2 text-[11px] text-slate-500">
                        尚无团队批注。请先核对原文后提交可追溯评论。
                      </p>
                    )}
                </div>
              </div>
              {selected.permission === "owner" && (
                <div className="rounded border border-slate-800 p-3">
                  <b className="text-xs text-slate-300">
                    <Share2 className="mr-1 inline h-3 w-3" />
                    成员共享
                  </b>
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input
                      value={memberQuery}
                      onChange={e => setMemberQuery(e.target.value)}
                      className="input-terminal text-xs"
                      placeholder="按姓名或邮箱搜索成员"
                    />
                    <select
                      value={canEdit ? "edit" : "view"}
                      onChange={e => setCanEdit(e.target.value === "edit")}
                      className="input-terminal text-xs"
                    >
                      <option value="view">只读</option>
                      <option value="edit">可编辑</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        memberId &&
                        share.mutate({
                          documentId: selected.id,
                          sharedWithUserId: memberId,
                          canEdit,
                        })
                      }
                      disabled={!memberId || share.isPending}
                      className="rounded border border-cyan-800 px-3 text-xs text-cyan-200 disabled:text-slate-600"
                    >
                      授权
                    </button>
                  </div>
                  {membersQuery.data && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {membersQuery.data.map(member => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setMemberId(member.id);
                            setMemberQuery(
                              member.name ?? member.email ?? String(member.id)
                            );
                          }}
                          className={`rounded border px-2 py-1 text-[10px] ${member.id === memberId ? "border-cyan-600 text-cyan-200" : "border-slate-700 text-slate-400"}`}
                        >
                          {member.name ?? member.email ?? `成员 #${member.id}`}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 space-y-1">
                    {(sharesQuery.data ?? []).map(item => (
                      <div
                        key={item.id}
                        className="flex justify-between rounded border border-slate-800 p-2 text-[11px]"
                      >
                        <span>
                          {item.userName ??
                            item.userEmail ??
                            `成员 #${item.sharedWithUserId}`}{" "}
                          · {item.canEdit ? "可编辑" : "只读"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            revoke.mutate({
                              documentId: selected.id,
                              sharedWithUserId: item.sharedWithUserId,
                            })
                          }
                          className="text-rose-300"
                        >
                          撤销
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded border border-slate-800 p-3">
                <b className="text-xs text-slate-300">
                  <GitCompareArrows className="mr-1 inline h-3 w-3" />
                  同源文件前瞻性指引差异
                </b>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={olderId ?? ""}
                    onChange={e => {
                      const value = Number(e.target.value) || null;
                      setOlderId(value);
                      publishEvidenceContext({ olderId: value });
                    }}
                    className="input-terminal text-xs"
                  >
                    <option value="">较早版本</option>
                    {sameSourceDocs.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newerId ?? ""}
                    onChange={e => {
                      const value = Number(e.target.value) || null;
                      setNewerId(value);
                      publishEvidenceContext({ newerId: value });
                    }}
                    className="input-terminal text-xs"
                  >
                    <option value="">较新版本</option>
                    {sameSourceDocs.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      olderId &&
                      newerId &&
                      compare.mutate({
                        olderDocumentId: olderId,
                        newerDocumentId: newerId,
                      })
                    }
                    disabled={
                      !olderId ||
                      !newerId ||
                      olderId === newerId ||
                      compare.isPending
                    }
                    className="rounded border border-violet-800 px-3 text-xs text-violet-200 disabled:text-slate-600"
                  >
                    比较版本
                  </button>
                </div>
                {compare.error && (
                  <p className="mt-2 text-[11px] text-rose-300">
                    {compare.error.message}
                  </p>
                )}
                {compare.data && (
                  <div className="mt-3 grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Metric
                        label="旧版"
                        value={new Date(
                          compare.data.older.retrievedAt
                        ).toLocaleDateString()}
                      />
                      <Metric
                        label="新版"
                        value={new Date(
                          compare.data.newer.retrievedAt
                        ).toLocaleDateString()}
                        tone="info"
                      />
                      <Metric
                        label="差异分组"
                        value={`${compare.data.changes.length}`}
                      />
                    </div>
                    {compare.data.changes.map(change => (
                      <div
                        key={change.tone}
                        className={`rounded border p-2 ${toneClass[change.tone]}`}
                      >
                        <b className="text-xs">
                          {change.label} · {change.items.length}
                        </b>
                        {change.items.slice(0, 8).map((item, index) => (
                          <p
                            key={`${item.phrase}-${index}`}
                            className="mt-1 text-[11px] leading-5"
                          >
                            {item.context}
                          </p>
                        ))}
                        {!change.items.length && (
                          <p className="mt-1 text-[11px] opacity-70">
                            没有关键词证据片段。
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded border border-slate-800 p-3">
                <b className="text-xs text-slate-300">
                  <History className="mr-1 inline h-3 w-3" />
                  审计追溯
                </b>
                <div className="mt-2 space-y-1">
                  {(auditQuery.data ?? []).slice(0, 8).map(item => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-2 border-b border-slate-800 py-1 text-[10px]"
                    >
                      <span>
                        {item.actorName ?? `成员 #${item.actorUserId}`} ·{" "}
                        {item.action} · {item.note}
                      </span>
                      <span className="shrink-0 text-slate-600">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
              <ClipboardPlus className="mx-auto mb-2 h-5 w-5" />
              捕获或选择一份官方文件后，可添加团队批注、共享和版本比较。
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
