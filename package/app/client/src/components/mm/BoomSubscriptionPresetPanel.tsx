import { useState } from "react";
import { Share2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LoadingState } from "@/components/sovereign/PanelKit";

export type BoomSubscriptionFiltersValue = {
  terms: string[];
  cusip: string;
  minAmount: string;
  maxAmount: string;
};

type Props = {
  filters: BoomSubscriptionFiltersValue;
  onApply: (filters: BoomSubscriptionFiltersValue) => void;
};

export default function BoomSubscriptionPresetPanel({
  filters,
  onApply,
}: Props) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const presetsQuery =
    trpc.moneyMarketPolicyCollaboration.listBoomPresets.useQuery();
  const presets = presetsQuery.data ?? [];
  const selected = presets.find(item => item.id === selectedId);
  const sharesQuery =
    trpc.moneyMarketPolicyCollaboration.listBoomPresetShares.useQuery(
      { presetId: selectedId ?? 0 },
      { enabled: !!selectedId && selected?.permission === "owner" }
    );
  const membersQuery =
    trpc.moneyMarketPolicyCollaboration.searchMembers.useQuery(
      { query: memberQuery, limit: 20 },
      { enabled: Boolean(memberQuery.trim()) }
    );
  const save = trpc.moneyMarketPolicyCollaboration.saveBoomPreset.useMutation({
    onSuccess: id => {
      setSelectedId(id);
      utils.moneyMarketPolicyCollaboration.listBoomPresets.invalidate();
    },
  });
  const share =
    trpc.moneyMarketPolicyCollaboration.saveBoomPresetShare.useMutation({
      onSuccess: () => {
        setMemberId(null);
        setMemberQuery("");
        utils.moneyMarketPolicyCollaboration.listBoomPresetShares.invalidate();
      },
    });
  const revoke =
    trpc.moneyMarketPolicyCollaboration.revokeBoomPresetShare.useMutation({
      onSuccess: () =>
        utils.moneyMarketPolicyCollaboration.listBoomPresetShares.invalidate(),
    });

  const load = (id: number) => {
    const item = presets.find(entry => entry.id === id);
    if (!item) return;
    setSelectedId(id);
    setName(item.name);
    onApply(item.filters);
  };

  return (
    <section
      className="mt-3 border-t border-slate-800 pt-3"
      aria-label="保存与共享当前订阅筛选"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-300">
            保存与共享当前筛选
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            预设只保存上方这一份期限、CUSIP
            与发行规模条件；加载后直接回填原筛选器，不复制第二套输入。
          </p>
        </div>
        <div className="grid min-w-[520px] gap-2 lg:grid-cols-[1fr_180px_auto]">
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            className="input-terminal text-xs"
            placeholder="预设名称，例如：4W 高规模拍卖"
          />
          <select
            value={selectedId ?? ""}
            onChange={event => load(Number(event.target.value))}
            className="input-terminal text-xs"
          >
            <option value="">加载个人或团队预设</option>
            {presets.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.permission}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              name.trim() &&
              save.mutate({
                presetId:
                  selected?.permission === "viewer"
                    ? undefined
                    : (selectedId ?? undefined),
                name,
                filters,
              })
            }
            disabled={
              !name.trim() ||
              save.isPending ||
              selected?.permission === "viewer"
            }
            className="rounded border border-cyan-800 px-3 text-xs text-cyan-200 disabled:text-slate-600"
          >
            保存预设
          </button>
        </div>
      </div>
      {presetsQuery.isLoading && <LoadingState label="读取预设…" />}
      {selected?.permission === "owner" && (
        <div className="mt-3 rounded border border-slate-800 p-3">
          <b className="text-xs text-slate-300">
            <Share2 className="mr-1 inline h-3 w-3" />
            共享预设
          </b>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <input
              value={memberQuery}
              onChange={event => setMemberQuery(event.target.value)}
              className="input-terminal text-xs"
              placeholder="搜索成员"
            />
            <select
              value={canEdit ? "edit" : "view"}
              onChange={event => setCanEdit(event.target.value === "edit")}
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
                  presetId: selected.id,
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
                  className={`rounded border px-2 py-1 text-[10px] ${memberId === member.id ? "border-cyan-600 text-cyan-200" : "border-slate-700 text-slate-400"}`}
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
                  <Users className="mr-1 inline h-3 w-3" />
                  {item.userName ??
                    item.userEmail ??
                    `成员 #${item.sharedWithUserId}`}{" "}
                  · {item.canEdit ? "可编辑" : "只读"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    revoke.mutate({
                      presetId: selected.id,
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
    </section>
  );
}
