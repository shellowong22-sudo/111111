import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { financeWorldDataset, spiderAiProcessed, spiderDataBlood, spiderRawData } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

const requireDb = async () => {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
};

const knowledgeTitle = sql<string>`COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${financeWorldDataset.financeArrayJson}, '$.title')), '')`;
const knowledgeFilter = (query: string, source: "all" | "internal" | "public", approval: "all" | "approved" | "private") => {
  const escaped = query.trim().replace(/[\\%_]/g, "\\$&");
  return and(
    eq(financeWorldDataset.dataTopType, "agent_reach"),
    ...(source === "all" ? [] : [source === "internal"
      ? like(financeWorldDataset.sourceUrl, "https://company.internal/%")
      : sql`${financeWorldDataset.sourceUrl} NOT LIKE 'https://company.internal/%'`]),
    ...(approval === "all" ? [] : [eq(financeWorldDataset.isPush, approval === "approved")]),
    ...(escaped ? [or(
      like(knowledgeTitle, `%${escaped}%`),
      like(financeWorldDataset.sourceName, `%${escaped}%`),
      like(financeWorldDataset.aiProcessContent, `%${escaped}%`),
    )] : []),
  );
};

export async function browseAgentReachKnowledge(input: {
  page: number; pageSize: number; query: string;
  source: "all" | "internal" | "public";
  approval: "all" | "approved" | "private";
}) {
  const db = await requireDb();
  const filter = knowledgeFilter(input.query, input.source, input.approval);
  const [counts, rows] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(financeWorldDataset).where(filter),
    db.select({
      id: financeWorldDataset.uuid, title: knowledgeTitle,
      sourceName: financeWorldDataset.sourceName, sourceUrl: financeWorldDataset.sourceUrl,
      qualityLevel: financeWorldDataset.dataQualityLevel, capturedAt: financeWorldDataset.crawlTime,
      approved: financeWorldDataset.isPush, content: financeWorldDataset.aiProcessContent,
      metadata: financeWorldDataset.financeArrayJson,
    }).from(financeWorldDataset).where(filter)
      .orderBy(desc(financeWorldDataset.crawlTime), desc(financeWorldDataset.id))
      .limit(input.pageSize).offset((input.page - 1) * input.pageSize),
  ]);
  return {
    page: input.page, pageSize: input.pageSize, total: Number(counts[0]?.total ?? 0),
    items: rows.map(row => ({
      id: row.id, title: row.title || "未命名资料", sourceName: row.sourceName,
      internal: row.sourceUrl.startsWith("https://company.internal/"),
      qualityLevel: row.qualityLevel, capturedAt: row.capturedAt, approved: row.approved,
      excerpt: (row.content ?? "").slice(0, 200),
      rssFeedUrl: typeof row.metadata?.rssFeedUrl === "string" ? row.metadata.rssFeedUrl : null,
    })),
  };
}

export async function getAgentReachKnowledgeDetail(id: string) {
  const db = await requireDb();
  const [record] = await db.select().from(financeWorldDataset)
    .where(and(eq(financeWorldDataset.uuid, id), eq(financeWorldDataset.dataTopType, "agent_reach"))).limit(1);
  if (!record) return null;
  const [lineage] = record.dataBloodId ? await db.select().from(spiderDataBlood)
    .where(and(eq(spiderDataBlood.dataBloodId, record.dataBloodId),
      eq(spiderDataBlood.structuredDataUuid, record.uuid))).limit(1) : [];
  const rawId = lineage?.rawUuids?.[0];
  const processId = lineage?.processUuids?.[0];
  const [raw] = rawId ? await db.select({
    rawUuid: spiderRawData.rawUuid, rawContent: spiderRawData.rawContent,
    contentHash: spiderRawData.contentHash, crawlTime: spiderRawData.crawlTime,
    parseStatus: spiderRawData.parseStatus,
  }).from(spiderRawData).where(eq(spiderRawData.rawUuid, rawId)).limit(1) : [];
  const [processed] = processId ? await db.select({
    processStatus: spiderAiProcessed.processStatus, qualityLevel: spiderAiProcessed.qualityLevel,
    qualityChecks: spiderAiProcessed.qualityChecks, normalizedContent: spiderAiProcessed.normalizedContent,
    updatedAt: spiderAiProcessed.updatedAt,
  }).from(spiderAiProcessed).where(eq(spiderAiProcessed.processUuid, processId)).limit(1) : [];
  return {
    id: record.uuid, title: String(record.financeArrayJson?.title || "未命名资料"),
    sourceName: record.sourceName, sourceUrl: record.sourceUrl,
    internal: record.sourceUrl.startsWith("https://company.internal/"),
    sourceReference: record.financeArrayJson?.sourceReference ?? null,
    capturedAt: record.crawlTime, updatedAt: record.updateTime,
    qualityLevel: record.dataQualityLevel, approved: record.isPush,
    cleanedContent: record.aiProcessContent ?? "",
    originalContent: raw?.rawContent ?? null, rawCapturedAt: raw?.crawlTime ?? null,
    rawParseStatus: raw?.parseStatus ?? null, contentHash: raw?.contentHash ?? null,
    normalizedContent: processed?.normalizedContent ?? null,
    processStatus: processed?.processStatus ?? null,
    qualityChecks: processed?.qualityChecks ?? null,
    processingUpdatedAt: processed?.updatedAt ?? null,
    transformationSteps: lineage?.transformationSteps ?? [],
    rssFeedUrl: typeof record.financeArrayJson?.rssFeedUrl === "string" ? record.financeArrayJson.rssFeedUrl : null,
  };
}

type TableStat = { tableName: string; estimatedRows: number; allocatedBytes: number; group: string };

function groupOf(name: string) {
  if (/^spider_|^finance_world_dataset$|^agent_reach_/.test(name)) return "研究资料与采集";
  if (/^ucheer_ai_|^model_/.test(name)) return "AI 对话与记忆";
  if (/^market_|^equity_|^fund_|^etf_|^curve_|^treasury_/.test(name)) return "行情、股票与基金";
  if (/^admin_news_|^admin_data_module_|^admin_market_/.test(name)) return "新闻与模块交付";
  if (/^users$|^user_|^notification_|^announcement_/.test(name)) return "账号与系统";
  return "其他业务表";
}

/** Optional read-only disk view. MySQL may be remote or its datadir inaccessible. */
async function inspectLocalMySqlDirectory(directory: string, schemaName: string) {
  if (!path.isAbsolute(directory)) return null;
  try {
    const root = path.resolve(directory);
    const pending = [root];
    let totalBytes = 0;
    let binaryLogBytes = 0;
    let schemaDirectoryBytes = 0;
    let fileCount = 0;
    let entriesSeen = 0;
    while (pending.length) {
      const folder = pending.pop()!;
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        if (++entriesSeen > 50_000) return null;
        if (entry.isSymbolicLink()) continue;
        const location = path.join(folder, entry.name);
        if (entry.isDirectory()) {
          pending.push(location);
        } else if (entry.isFile()) {
          const bytes = (await stat(location)).size;
          totalBytes += bytes;
          fileCount += 1;
          if (folder === root && /^binlog\.\d+$/.test(entry.name)) binaryLogBytes += bytes;
          if (path.relative(root, location).split(path.sep)[0] === schemaName) schemaDirectoryBytes += bytes;
        }
      }
    }
    return { directory: root, totalBytes, binaryLogBytes, schemaDirectoryBytes, fileCount };
  } catch {
    return null;
  }
}

/** Server-side inventory of the whole connected schema, not a sum of distinct documents. */
export async function getTerminalStorageInventory() {
  const db = await requireDb();
  const [tableRows] = await db.execute(sql`
    SELECT TABLE_NAME AS tableName, COALESCE(TABLE_ROWS, 0) AS estimatedRows,
           COALESCE(DATA_LENGTH, 0) + COALESCE(INDEX_LENGTH, 0) AS allocatedBytes
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `) as unknown as [Array<Record<string, unknown>>, unknown];
  const [schemaRows] = await db.execute(sql`SELECT DATABASE() AS schemaName`) as unknown as [Array<{ schemaName: string }>, unknown];
  const schemaName = schemaRows[0]?.schemaName ?? "";
  const [directoryRows] = await db.execute(sql`SELECT @@datadir AS dataDirectory`) as unknown as [Array<{ dataDirectory: string }>, unknown];
  const localDatabase = (() => {
    try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(ENV.databaseUrl).hostname); }
    catch { return false; }
  })();
  const physicalStorage = localDatabase && directoryRows[0]?.dataDirectory && schemaName
    ? await inspectLocalMySqlDirectory(directoryRows[0].dataDirectory, schemaName)
    : null;
  const tables: TableStat[] = tableRows.map(row => ({
    tableName: String(row.tableName), estimatedRows: Number(row.estimatedRows ?? 0),
    allocatedBytes: Number(row.allocatedBytes ?? 0), group: groupOf(String(row.tableName)),
  }));
  const [ownRows, allStructuredRows] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(financeWorldDataset)
      .where(eq(financeWorldDataset.dataTopType, "agent_reach")),
    db.select({ total: sql<number>`COUNT(*)` }).from(financeWorldDataset),
  ]);
  const groups = [...new Set(tables.map(table => table.group))].map(name => ({
    name, tables: tables.filter(table => table.group === name).length,
    estimatedRows: tables.filter(table => table.group === name).reduce((n, table) => n + table.estimatedRows, 0),
    allocatedBytes: tables.filter(table => table.group === name).reduce((n, table) => n + table.allocatedBytes, 0),
  }));
  return {
    schemaName: schemaName || "当前连接的数据库",
    observedAt: new Date().toISOString(),
    tableCount: tables.length,
    allocatedBytes: tables.reduce((n, table) => n + table.allocatedBytes, 0),
    estimatedTableRows: tables.reduce((n, table) => n + table.estimatedRows, 0),
    exactAgentReachDocuments: Number(ownRows[0]?.total ?? 0),
    exactStructuredDocuments: Number(allStructuredRows[0]?.total ?? 0),
    physicalStorage,
    groups, tables,
  };
}
