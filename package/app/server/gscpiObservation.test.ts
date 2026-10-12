import { describe, expect, it } from 'vitest';
import { parseGscpiCsv } from './economicObservationService';

describe('GSCPI vintage matrix cleaning', () => {
  it('selects the latest released vintage and excludes future/#N/A observations', () => {
    const csv = [
      'Date,Jan-26,Mar-26,Oct-26',
      '31-Dec-2025,0.10,0.20,0.30',
      '31-Jan-2026,0.15,0.25,0.35',
      '28-Feb-2026,#N/A,0.30,0.40',
      '31-Mar-2026,0.40,0.50,0.60',
      '30-Sep-2026,0.80,0.90,1.00',
    ].join('\n');
    const parsed = parseGscpiCsv(csv, new Date('2026-03-20T00:00:00Z'));
    expect(parsed.vintage).toBe('Mar-26');
    expect(parsed.points).toEqual([
      { date: '2025-12-31', value: 0.2 },
      { date: '2026-01-31', value: 0.25 },
      { date: '2026-02-28', value: 0.3 },
    ]);
  });

  it('rejects malformed schema and conflicting duplicate observation months', () => {
    expect(() => parseGscpiCsv('DATE,Jan-26\n31-Jan-2026,1', new Date('2026-02-01T00:00:00Z'))).toThrow('GSCPI_SCHEMA_MISMATCH');
    expect(() => parseGscpiCsv(['Date,Jan-26,Feb-26', '31-Jan-2026,1,2', '30-Jan-2026,3,4'].join('\n'), new Date('2026-02-10T00:00:00Z'))).toThrow('GSCPI_CONFLICTING_OBSERVATION');
  });
  it('deduplicates equal months, keeps zero/negative readings, rejects rolled dates and nonnumeric values', () => {
    const csv = ['Date,Mar-26','31-Jan-2026,0','31-Jan-2026,0','28-Feb-2026,-1.5','31-Feb-2026,9','30-Dec-2025,#N/A','30-Nov-2025,Infinity','31-Oct-2025,'].join('\n');
    expect(parseGscpiCsv(csv,new Date('2026-03-20T00:00:00Z')).points).toEqual([{date:'2026-01-31',value:0},{date:'2026-02-28',value:-1.5}]);
  });
  it('rejects absent or ambiguous vintages', () => {
    expect(()=>parseGscpiCsv('Date,Oct-26\n31-Aug-2026,1',new Date('2026-09-19T00:00:00Z'))).toThrow('GSCPI_NO_CURRENT_VINTAGE');
    expect(()=>parseGscpiCsv('Date,Sep-26,Sep-26\n31-Aug-2026,1,2',new Date('2026-09-19T00:00:00Z'))).toThrow('GSCPI_DUPLICATE_VINTAGE');
  });
});
