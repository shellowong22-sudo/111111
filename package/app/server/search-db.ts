import { drizzle } from "drizzle-orm/mysql2";
import { like, or } from "drizzle-orm";
import { curves, fundData, marketData } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export interface SearchResult {
  type: 'curve' | 'fund' | 'market';
  id: number;
  code: string;
  name: string;
  nameEn?: string;
  category?: string;
  region?: string;
  currency?: string;
  description?: string;
}

export async function unifiedSearch(query: string): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search: database not available");
    return [];
  }

  // Return empty array for empty query
  if (!query || query.trim() === '') {
    return [];
  }

  try {
    const pattern = `%${query.trim()}%`;
    const [curveRows, fundRows, marketRows] = await Promise.all([
      db.select().from(curves).where(or(
        like(curves.curveId, pattern),
        like(curves.name, pattern),
        like(curves.nameEn, pattern),
        like(curves.country, pattern),
        like(curves.category, pattern)
      )).limit(20),
      db.select().from(fundData).where(or(
        like(fundData.symbol, pattern),
        like(fundData.name, pattern),
        like(fundData.nameEn, pattern),
        like(fundData.fundType, pattern),
        like(fundData.assetClass, pattern)
      )).limit(20),
      db.select().from(marketData).where(or(
        like(marketData.symbol, pattern),
        like(marketData.name, pattern),
        like(marketData.market, pattern)
      )).limit(20),
    ]);

    const results: SearchResult[] = [
      ...curveRows.map(row => ({
        type: 'curve' as const,
        id: row.id,
        code: row.curveId,
        name: row.name,
        nameEn: row.nameEn ?? undefined,
        category: row.category ?? undefined,
        region: row.region ?? undefined,
        currency: row.currency ?? undefined,
        description: row.description ?? undefined,
      })),
      ...fundRows.map(row => ({
        type: 'fund' as const,
        id: row.id,
        code: row.symbol,
        name: row.name,
        nameEn: row.nameEn ?? undefined,
        category: row.assetClass ?? undefined,
        description: row.fundType ? `基金类型：${row.fundType}` : undefined,
      })),
      ...marketRows.map(row => ({
        type: 'market' as const,
        id: row.id,
        code: row.symbol,
        name: row.name,
        category: row.market,
        description: `最新记录：${row.price}；观察涨跌幅：${row.changePct}`,
      })),
    ];

    return results
      .sort((left, right) => left.code.localeCompare(right.code))
      .slice(0, 20);
  } catch (error) {
    console.error("[Database] Failed to search:", error);
    return [];
  }
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get suggestions: database not available");
    return [];
  }

  // Return empty array for empty query
  if (!query || query.trim() === '') {
    return [];
  }

  try {
    const pattern = `%${query.trim()}%`;
    const [curveRows, fundRows, marketRows] = await Promise.all([
      db.select({ code: curves.curveId, name: curves.name, nameEn: curves.nameEn })
        .from(curves)
        .where(or(like(curves.curveId, pattern), like(curves.name, pattern), like(curves.nameEn, pattern)))
        .limit(10),
      db.select({ code: fundData.symbol, name: fundData.name, nameEn: fundData.nameEn })
        .from(fundData)
        .where(or(like(fundData.symbol, pattern), like(fundData.name, pattern), like(fundData.nameEn, pattern)))
        .limit(10),
      db.select({ code: marketData.symbol, name: marketData.name })
        .from(marketData)
        .where(or(like(marketData.symbol, pattern), like(marketData.name, pattern)))
        .limit(10),
    ]);
    const suggestions = new Set<string>();
    for (const row of [...curveRows, ...fundRows, ...marketRows]) {
      if (row.code) suggestions.add(row.code);
      if (row.name) suggestions.add(row.name);
      if ('nameEn' in row && typeof row.nameEn === 'string' && row.nameEn) suggestions.add(row.nameEn);
      if (suggestions.size >= 10) break;
    }
    return [...suggestions].slice(0, 10);
  } catch (error) {
    console.error("[Database] Failed to get suggestions:", error);
    // Return empty array on error for empty query
    if (!query || query.trim() === '') {
      return [];
    }
    return [];
  }
}
