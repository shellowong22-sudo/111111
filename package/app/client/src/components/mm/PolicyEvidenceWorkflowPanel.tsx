import { useEffect, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  GitPullRequest,
  MessageSquareReply,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LoadingState } from "@/components/sovereign/PanelKit";
import { MoneyMarketSection as Card } from "./MoneyMarketWorkbench";

const statuses = [
  { id: "pending", label: "待审" },
  { id: "follow_up", label: "需复核" },
  { id: "confirmed", label: "已确认" },
] as const;
export default function PolicyEvidenceWorkflowPanel({
  initialSourceId = "FED",
}: {
  initialSourceId?: "FED" | "ECB" | "BOE" | "PBOC" | "CBC" | "BCB";
}) {
  const utils = trpc.useUtils();
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [annotationId, setAnnotationId] = useState<number | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [responseNote, setResponseNote] = useState("");
  const [olderId, setOlderId] = useState<number | null>(null);
  const [newerId, setNewerId] = useState<number | null>(null);
  const [status, setStatus] =
    useState<(typeof statuses)[number]["id"]>("pending");
  const [reviewNote, setReviewNote] = useState("");
  const docsQuery = trpc.moneyMarketPolicyCollaboration.listDocuments.useQuery({
    sourceId,
    limit: 100,
  });
  const docs = docsQuery.data ?? [];
  const annotationsQuery =
    trpc.moneyMarketPolicyCollaboration.listAnnotations.useQuery(
      { documentId: documentId ?? 0 },
      { enabled: !!documentId }
    );
  const mentionsQuery =
    trpc.moneyMarketPolicyCollaboration.listMentions.useQuery(
      { documentId: documentId ?? 0 },
      { enabled: !!documentId }
    );
  const membersQuery =
    trpc.moneyMarketPolicyCollaboration.searchMembers.useQuery(
      { query: memberQuery, limit: 20 },
      { enabled: Boolean(memberQuery.trim()) }
    );
  const reviewQuery =
    trpc.moneyMarketPolicyCollaboration.getVersionReview.useQuery(
      { olderDocumentId: olderId ?? 0, newerDocumentId: newerId ?? 0 },
      { enabled: !!olderId && !!newerId && olderId !== newerId }
    );
  const createMention =
    trpc.moneyMarketPolicyCollaboration.createMention.useMutation({
      onSuccess: () => {
        setMemberId(null);
        setMemberQuery("");
        utils.moneyMarketPolicyCollaboration.listMentions.invalidate();
        utils.moneyMarketPolicyCollaboration.listAudit.invalidate();
      },
    });
  const resolveMention =
    trpc.moneyMarketPolicyCollaboration.resolveMention.useMutation({
      onSuccess: () => {
        setResponseNote("");
        utils.moneyMarketPolicyCollaboration.listMentions.invalidate();
        utils.moneyMarketPolicyCollaboration.listAudit.invalidate();
      },
    });
  const saveReview =
    trpc.moneyMarketPolicyCollaboration.saveVersionReview.useMutation({
      onSuccess: () => {
        utils.moneyMarketPolicyCollaboration.getVersionReview.invalidate();
        utils.moneyMarketPolicyCollaboration.listAudit.invalidate();
      },
    });
  const selectedDoc = docs.find(item => item.id === documentId);
  useEffect(() => {
    const receiveContext = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          sourceId?: typeof sourceId;
          documentId?: number | null;
          olderId?: number | null;
          newerId?: number | null;
        }>
      ).detail;
      if (detail.sourceId) setSourceId(detail.sourceId);
      if ("documentId" in detail) setDocumentId(detail.documentId ?? null);
      if ("olderId" in detail) setOlderId(detail.olderId ?? null);
      if ("newerId" in detail) setNewerId(detail.newerId ?? null);
    };
    window.addEventListener(
      "money-market-policy-evidence-context",
      receiveContext
    );
    return () =>
      window.removeEventListener(
        "money-market-policy-evidence-context",
        receiveContext
      );
  }, []);
  return (
    <Card
      title="政策提及、待回复与版本审批"
      action={
        <span className="text-[10px] text-slate-500">成员协作 · 审计追溯</span>
      }
    >
      <p className="mb-3 text-[11px] text-slate-500">
        成员必须已拥有对应文件访问权才能被提及。提及会即时进入通知中心；超过 24
        小时仍待回复时，系统按日发出幂等提醒。版本确认仅由较新文件所有者完成。
      </p>
      <div className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
        当前证据上下文：{sourceId} ·{" "}
        {selectedDoc?.title ?? "请先在上方选择已捕获文件"}
        。提及与审批直接沿用上方唯一选择，不再重复创建央行和文件筛选器。
      </div>
      {docsQuery.isLoading && <LoadingState label="读取可访问的文件索引…" />}
      {!docsQuery.isLoading && !selectedDoc && (
        <p className="mt-3 rounded border border-dashed border-slate-700 p-3 text-[11px] text-slate-500">
          选择上方文件后，这里才显示成员提及和版本审批操作。
        </p>
      )}
      {selectedDoc && (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="rounded border border-slate-800 p-3">
            <b className="text-xs text-slate-200">
              <AtSign className="mr-1 inline h-3 w-3" />
              提及成员并请求回复
            </b>
            <div className="mt-2 grid gap-2">
              <select
                value={annotationId ?? ""}
                onChange={e => setAnnotationId(Number(e.target.value) || null)}
                className="input-terminal text-xs"
              >
                <option value="">选择已保存的批注</option>
                {(annotationsQuery.data ?? []).map(item => (
                  <option key={item.id} value={item.id}>
                    {item.category} · {item.quotedText.slice(0, 60)}
                  </option>
                ))}
              </select>
              <input
                value={memberQuery}
                onChange={e => setMemberQuery(e.target.value)}
                className="input-terminal text-xs"
                placeholder="搜索已授权成员姓名或邮箱"
              />
              {membersQuery.data && (
                <div className="flex flex-wrap gap-1">
                  {membersQuery.data.map(member => (
                    <button
                      type="button"
                      key={member.id}
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
              <button
                type="button"
                onClick={() =>
                  annotationId &&
                  memberId &&
                  createMention.mutate({
                    annotationId,
                    mentionedUserId: memberId,
                  })
                }
                disabled={
                  !annotationId ||
                  !memberId ||
                  createMention.isPending ||
                  selectedDoc.permission === "viewer"
                }
                className="rounded border border-cyan-800 px-3 py-2 text-xs text-cyan-200 disabled:text-slate-600"
              >
                <BellRing className="mr-1 inline h-3 w-3" />
                发送 @ 提及
              </button>
            </div>
            {createMention.error && (
              <p className="mt-2 text-[11px] text-rose-300">
                {createMention.error.message}
              </p>
            )}
            <div className="mt-3 space-y-1">
              {(mentionsQuery.data ?? []).map(item => (
                <div
                  key={item.id}
                  className={`rounded border p-2 text-[11px] ${item.status === "pending" ? "border-amber-900 bg-amber-950/20" : "border-emerald-900 bg-emerald-950/20"}`}
                >
                  <div className="flex items-center justify-between">
                    <b>
                      {item.memberName ??
                        item.memberEmail ??
                        `成员 #${item.mentionedUserId}`}
                    </b>
                    <span>
                      {item.status === "pending" ? "待回复" : "已回复"}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-400">
                    “{item.quotedText.slice(0, 150)}”
                  </p>
                  {item.status === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={responseNote}
                        onChange={e => setResponseNote(e.target.value)}
                        className="input-terminal flex-1 text-xs"
                        placeholder="回复或处理说明（可选）"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          resolveMention.mutate({
                            mentionId: item.id,
                            responseNote: responseNote || undefined,
                          })
                        }
                        className="rounded border border-emerald-800 px-2 text-emerald-200"
                      >
                        <MessageSquareReply className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-500">
                      {item.responseNote || "已完成回复"}
                    </p>
                  )}
                </div>
              ))}
              {!(mentionsQuery.data ?? []).length && (
                <p className="rounded border border-dashed border-slate-700 p-2 text-[11px] text-slate-500">
                  尚无成员提及记录。
                </p>
              )}
            </div>
          </div>
          <div className="rounded border border-slate-800 p-3">
            <b className="text-xs text-slate-200">
              <GitPullRequest className="mr-1 inline h-3 w-3" />
              版本差异人工确认
            </b>
            <div className="mt-2 grid gap-2">
              <p className="rounded border border-slate-800 p-2 text-[11px] text-slate-400">
                审批对象沿用上方“同源文件前瞻性指引差异”的较早/较新版本选择；此处只记录审批状态与依据。
              </p>
              {reviewQuery.data && (
                <div className="rounded border border-slate-700 p-2 text-[11px]">
                  <BadgeCheck className="mr-1 inline h-3 w-3 text-cyan-300" />
                  当前：{reviewQuery.data.status} ·{" "}
                  {reviewQuery.data.reviewerName ??
                    `成员 #${reviewQuery.data.reviewedByUserId}`}
                  <p className="mt-1 text-slate-500">
                    {reviewQuery.data.reviewNote || "未添加说明"}
                  </p>
                </div>
              )}
              <select
                value={status}
                onChange={e => setStatus(e.target.value as typeof status)}
                className="input-terminal text-xs"
              >
                {statuses.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                className="input-terminal min-h-16 text-xs"
                placeholder="确认依据、待跟进事项或审批意见"
              />
              <button
                type="button"
                onClick={() =>
                  olderId &&
                  newerId &&
                  saveReview.mutate({
                    olderDocumentId: olderId,
                    newerDocumentId: newerId,
                    status,
                    reviewNote: reviewNote || undefined,
                  })
                }
                disabled={
                  !olderId ||
                  !newerId ||
                  olderId === newerId ||
                  saveReview.isPending ||
                  selectedDoc.permission === "viewer"
                }
                className="rounded border border-violet-800 px-3 py-2 text-xs text-violet-200 disabled:text-slate-600"
              >
                <CheckCircle2 className="mr-1 inline h-3 w-3" />
                记录审批状态
              </button>
            </div>
            {saveReview.error && (
              <p className="mt-2 text-[11px] text-rose-300">
                {saveReview.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
