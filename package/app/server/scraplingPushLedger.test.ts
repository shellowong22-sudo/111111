import { describe, expect, it } from "vitest";
import {
  blockedReasonForContent,
  partitionScraplingPushContent,
} from "../client/src/lib/scraplingPushLedger";

const item = (contentId: string) => ({
  contentId,
  title: `title-${contentId}`,
  body: `body-${contentId}`,
  sourceName: "source",
  contentHash: `hash-${contentId}`,
});

describe("Scrapling 推送账簿内容分区", () => {
  it("把实际投递正文与发送前拦截项分开", () => {
    const row = {
      status: "front_acknowledged",
      contentItems: [item("sent-a"), item("sent-b"), item("blocked")],
      receipts: [
        { sourceDataUuid: "sent-a", currentStatus: "front_acknowledged" },
        { sourceDataUuid: "sent-b", currentStatus: "waiting_front_ack" },
        { sourceDataUuid: "blocked", currentStatus: "duplicate_blocked", failureReason: "相似正文已保留唯一版本" },
      ],
    };

    const partition = partitionScraplingPushContent(row);
    expect(partition.deliveredItems.map((entry) => entry.contentId)).toEqual(["sent-a", "sent-b"]);
    expect(partition.blockedItems.map((entry) => entry.contentId)).toEqual(["blocked"]);
    expect(partition.attemptedItems).toEqual([]);
    expect(blockedReasonForContent(row.receipts, "blocked")).toBe("相似正文已保留唯一版本");
  });

  it("同一内容只要至少一个目标真实投递，就不误归入全量拦截", () => {
    const partition = partitionScraplingPushContent({
      status: "front_acknowledged",
      contentItems: [item("mixed")],
      receipts: [
        { sourceDataUuid: "mixed", currentStatus: "duplicate_blocked", duplicateBlocked: true },
        { sourceDataUuid: "mixed", currentStatus: "front_acknowledged" },
      ],
    });
    expect(partition.deliveredItems).toHaveLength(1);
    expect(partition.blockedItems).toHaveLength(0);
  });

  it("旧失败记录只显示尝试内容，不冒充实际投递", () => {
    const partition = partitionScraplingPushContent({
      status: "failed",
      contentItems: [item("attempt")],
      receipts: [],
    });
    expect(partition.deliveredItems).toEqual([]);
    expect(partition.attemptedItems.map((entry) => entry.contentId)).toEqual(["attempt"]);
  });
});
