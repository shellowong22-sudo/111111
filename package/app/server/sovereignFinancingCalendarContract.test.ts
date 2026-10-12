import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'client/src/components/sovereign/SovereignFinancingCalendar.tsx'), 'utf8');

describe('sovereign financing calendar reminder contract', () => {
  it('restricts reminder countries to the router-supported union', () => {
    expect(source).toContain('type FinancingCountryCode = "ALL" | "US" | "DE" | "GB" | "JP" | "FR" | "IT"');
    expect(source).toContain('countryCode: event.target.value as FinancingCountryCode');
  });

  it('renders reminder history dates and serializes Date values in CSV without passing Date into JSX', () => {
    expect(source).toContain('eventDate: Date | string');
    expect(source).toContain('new Date(item.eventDate).toLocaleDateString()');
    expect(source).toContain('string | number | boolean | Date | null | undefined');
  });
});
