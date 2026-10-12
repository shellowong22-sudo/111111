import { asc, count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { equityListings } from '../drizzle/schema';
import { getDb } from './db';

describe('冻结 SQL 与用户工作簿全球股票清单恢复', () => {
  it('保留 48,756 条去重目录、40 个国家/地区与原始来源字段', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const [{ total }] = await db.select({ total: count(equityListings.id) }).from(equityListings);
    const countries = await db.select({ countryCode: equityListings.countryCode, listingCount: count(equityListings.id) })
      .from(equityListings)
      .groupBy(equityListings.countryCode)
      .orderBy(asc(equityListings.countryCode));
    const [first] = await db.select({ countryCode: equityListings.countryCode, symbol: equityListings.symbol, name: equityListings.name, sourceFile: equityListings.sourceFile, sourceSheet: equityListings.sourceSheet })
      .from(equityListings)
      .orderBy(asc(equityListings.countryCode), asc(equityListings.symbol))
      .limit(1);

    const countryCounts = Object.fromEntries(countries.map((row) => [row.countryCode, Number(row.listingCount)]));
    expect(Number(total)).toBe(48756);
    expect(countries).toHaveLength(40);
    expect(countryCounts).toMatchObject({ AE: 175, CN: 5544, IN: 8170, US: 6257 });
    expect(first).toEqual({ countryCode: 'AE', symbol: '2POINTZERO.AD', name: 'Two Point Zero', sourceFile: '阿联酋全部股票.xlsx', sourceSheet: '阿联酋全部股票' });
  });

  it('可按冻结原始国家代码筛选，且不把其他国家混入结果', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const cnRows = await db.select({ countryCode: equityListings.countryCode, symbol: equityListings.symbol, sourceFile: equityListings.sourceFile })
      .from(equityListings)
      .where(eq(equityListings.countryCode, 'CN'))
      .orderBy(asc(equityListings.symbol))
      .limit(50);

    expect(cnRows).toHaveLength(50);
    expect(cnRows.every((row) => row.countryCode === 'CN' && row.sourceFile === '全部A股.xlsx')).toBe(true);
  });
});
