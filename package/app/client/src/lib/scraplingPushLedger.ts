export type ScraplingPushContentItem = {
  contentId: string;
  title: string;
  body: string;
  sourceName?: string;
  contentHash?: string;
};

export type ScraplingPushReceipt = {
  sourceDataUuid?: string | null;
  currentStatus?: string | null;
  duplicateBlocked?: boolean | null;
  failureReason?: string | null;
};

export function partitionScraplingPushContent(row: {
  status?: string | null;
  contentItems?: ScraplingPushContentItem[] | null;
  receipts?: ScraplingPushReceipt[] | null;
}) {
  const contentItems = Array.isArray(row.contentItems) ? row.contentItems : [];
  const receipts = Array.isArray(row.receipts) ? row.receipts : [];
  const receiptByContentId = new Map<string, ScraplingPushReceipt[]>();

  for (const receipt of receipts) {
    if (!receipt.sourceDataUuid) continue;
    const existing = receiptByContentId.get(receipt.sourceDataUuid) ?? [];
    existing.push(receipt);
    receiptByContentId.set(receipt.sourceDataUuid, existing);
  }

  if (!receiptByContentId.size) {
    if (row.status === "failed") {
      return { deliveredItems: [], blockedItems: [], attemptedItems: contentItems };
    }
    if (row.status === "duplicate_blocked") {
      return { deliveredItems: [], blockedItems: contentItems, attemptedItems: [] };
    }
    return { deliveredItems: contentItems, blockedItems: [], attemptedItems: [] };
  }

  const deliveredItems: ScraplingPushContentItem[] = [];
  const blockedItems: ScraplingPushContentItem[] = [];
  const attemptedItems: ScraplingPushContentItem[] = [];

  for (const item of contentItems) {
    const itemReceipts = receiptByContentId.get(item.contentId) ?? [];
    const hasActiveDelivery = itemReceipts.some(
      (receipt) => receipt.currentStatus !== "duplicate_blocked" && !receipt.duplicateBlocked,
    );
    const hasBlockedDelivery = itemReceipts.some(
      (receipt) => receipt.currentStatus === "duplicate_blocked" || receipt.duplicateBlocked,
    );

    if (hasActiveDelivery) deliveredItems.push(item);
    else if (hasBlockedDelivery) blockedItems.push(item);
    else attemptedItems.push(item);
  }

  return { deliveredItems, blockedItems, attemptedItems };
}

export function blockedReasonForContent(
  receipts: ScraplingPushReceipt[],
  contentId: string,
) {
  return receipts.find(
    (receipt) =>
      receipt.sourceDataUuid === contentId
      && (receipt.currentStatus === "duplicate_blocked" || receipt.duplicateBlocked),
  )?.failureReason ?? "发送前已拦截，未进入前端。";
}
