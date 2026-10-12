import { useMemo, useState } from "react";
import {
  Bell,
  Pause,
  Play,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LoadingState } from "@/components/sovereign/PanelKit";
import {
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";

export default function BoomAuctionCollaborationPanel() {
  const utils = trpc.useUtils();
  const [daysBeforeEvent, setDaysBeforeEvent] = useState("3");
  const rulesQuery =
    trpc.sovereignBonds.listFinancingCalendarReminderRules.useQuery();
  const historyQuery =
    trpc.sovereignBonds.listFinancingCalendarReminderNotificationHistory.useQuery(
      { limit: 30, countryCode: "US", status: "all" }
    );
  const saveRule =
    trpc.sovereignBonds.saveFinancingCalendarReminderRule.useMutation({
      onSuccess: () => {
        utils.sovereignBonds.listFinancingCalendarReminderRules.invalidate();
      },
    });
  const toggleRule =
    trpc.sovereignBonds.setFinancingCalendarReminderRuleActive.useMutation({
      onSuccess: () => {
        utils.sovereignBonds.listFinancingCalendarReminderRules.invalidate();
        utils.sovereignBonds.listFinancingCalendarReminderNotificationHistory.invalidate();
      },
    });
  const boomRules = useMemo(
    () =>
      (rulesQuery.data?.data ?? []).filter(
        rule => rule.eventType === "auction" && rule.countryCode === "US"
      ),
    [rulesQuery.data]
  );
  const create = () => {
    const days = Number(daysBeforeEvent);
    if (!Number.isInteger(days) || days < 1 || days > 90) return;
    saveRule.mutate({
      eventType: "auction",
      countryCode: "US",
      daysBeforeEvent: days,
      isActive: true,
    });
  };
  return (
    <Card title="BOOM 官方拍卖提醒">
      <p className="mb-3 text-[11px] text-slate-500">
        提醒仅匹配美国财政部已发布的国库券拍卖日；每位账户成员独立维护规则，公共
        ICS/WebCal
        可供团队在各自日历中订阅。不会创建虚构事件或提前推断拍卖结果。
      </p>
      <div>
        <div className="rounded border border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-300" />
            <b className="text-xs text-slate-200">账户级提醒规则</b>
          </div>
          <div className="mt-3 flex gap-2">
            <label className="flex-1 text-[11px] text-slate-500">
              拍卖日前天数
              <input
                value={daysBeforeEvent}
                onChange={e => setDaysBeforeEvent(e.target.value)}
                type="number"
                min="1"
                max="90"
                className="input-terminal mt-1 w-full"
              />
            </label>
            <button
              type="button"
              onClick={create}
              disabled={saveRule.isPending}
              className="mt-5 rounded border border-cyan-800 px-3 text-xs text-cyan-200 disabled:text-slate-600"
            >
              保存规则
            </button>
          </div>
          {saveRule.error && (
            <p className="mt-2 text-[11px] text-rose-300">
              {saveRule.error.message}
            </p>
          )}
          <div className="mt-3 space-y-1">
            {rulesQuery.isLoading ? (
              <LoadingState label="读取账户规则…" />
            ) : (
              boomRules.map(rule => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded border border-slate-800 px-2 py-2 text-xs"
                >
                  <span>US 国库券拍卖 · 提前 {rule.daysBeforeEvent} 天</span>
                  <button
                    type="button"
                    onClick={() =>
                      toggleRule.mutate({
                        id: rule.id,
                        isActive: !rule.isActive,
                      })
                    }
                    className={
                      rule.isActive ? "text-amber-300" : "text-emerald-300"
                    }
                  >
                    {rule.isActive ? (
                      <>
                        <Pause className="mr-1 inline h-3 w-3" />
                        暂停
                      </>
                    ) : (
                      <>
                        <Play className="mr-1 inline h-3 w-3" />
                        恢复
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
            {!rulesQuery.isLoading && !boomRules.length && (
              <p className="rounded border border-dashed border-slate-700 p-2 text-[11px] text-slate-500">
                尚未配置 BOOM
                拍卖提醒。选择提前天数后保存；通知将通过现有账户通知中心和实时推送发送。
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <b className="text-xs text-slate-300">提醒发送记录</b>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {historyQuery.isLoading ? (
            <LoadingState label="读取提醒记录…" />
          ) : (
            (historyQuery.data?.data ?? [])
              .filter(
                item =>
                  item.eventType === "auction" && item.countryCode === "US"
              )
              .slice(0, 9)
              .map(item => (
                <Metric
                  key={item.id}
                  label={`${item.eventDate} · 提前 ${item.daysBeforeEvent} 天`}
                  value={new Date(item.sentAt).toLocaleString()}
                  tone={item.isActive ? "info" : "neutral"}
                />
              ))
          )}
          {!historyQuery.isLoading &&
            !(historyQuery.data?.data ?? []).filter(
              item => item.eventType === "auction" && item.countryCode === "US"
            ).length && (
              <p className="rounded border border-dashed border-slate-700 p-2 text-[11px] text-slate-500">
                尚无 BOOM
                拍卖提醒发送记录。首次满足已保存规则时将追加记录，平台重试不会重复发送。
              </p>
            )}
        </div>
      </div>
    </Card>
  );
}
