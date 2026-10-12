import { describe, expect, it } from 'vitest';
import { formatObservationDate } from '../client/src/components/pricing/valuationDateFormatters';

describe('valuation observation date formatter', () => {
  it('renders Date and ISO string observations as calendar text while preserving an explicit empty state', () => {
    expect(formatObservationDate(new Date('2026-08-24T00:00:00.000Z'))).toBe('2026-08-24');
    expect(formatObservationDate('2026-08-25')).toBe('2026-08-25');
    expect(formatObservationDate(null)).toBe('—');
  });
});
