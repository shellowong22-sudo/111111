import { describe, expect, it } from 'vitest';
import { summarizeAdminDataModuleDeliveryStats } from './adminDataModuleDelivery';

describe('admin data module delivery statistics', () => {
  it('aggregates six delivery categories from persisted content and operation fields', () => {
    const result = summarizeAdminDataModuleDeliveryStats({
      contentItems: [
        { status: 'delivered', errorDetail: null },
        { status: 'approved', errorDetail: null },
        { status: 'skipped_duplicate', errorDetail: null },
        { status: 'failed', errorDetail: 'SOURCE_TIMEOUT' },
      ],
      operations: [
        { status: 'applied', previousTargetSnapshot: { symbol: 'OLD' }, errorDetail: null },
        { status: 'failed', previousTargetSnapshot: null, errorDetail: 'SOURCE_TIMEOUT' },
      ],
      deliveryEvents: [
        { action: 'pushed', status: 'success', detail: 'published', itemCount: 1 },
        { action: 'cancelled', status: 'skipped', detail: 'MODULE_DISABLED', itemCount: 1 },
        { action: 'push_failed', status: 'failed', detail: 'DELIVERY_TIMEOUT', itemCount: 0 },
      ],
      stepEvents: [
        { action: 'quality_check_rejected', status: 'failed', detail: 'QUALITY_BELOW_THRESHOLD' },
      ],
    });

    expect(result).toEqual({
      newCount: 2,
      updatedCount: 1,
      skippedCount: 2,
      duplicateCount: 1,
      otherSkippedCount: 1,
      failedCount: 3,
      pushedCount: 1,
      failureReasons: ['SOURCE_TIMEOUT', 'DELIVERY_TIMEOUT', 'QUALITY_BELOW_THRESHOLD'],
      skipReasons: ['MODULE_DISABLED'],
    });
  });

  it('returns zeroed categories for an empty scope', () => {
    expect(summarizeAdminDataModuleDeliveryStats({ contentItems: [], operations: [], deliveryEvents: [], stepEvents: [] })).toEqual({
      newCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      duplicateCount: 0,
      otherSkippedCount: 0,
      failedCount: 0,
      pushedCount: 0,
      failureReasons: [],
      skipReasons: [],
    });
  });
});
