import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { ADMIN_DATA_MODULES, resolveAdminDataModulesForPath } from '../shared/adminDataModules';
import { adminDataModuleContentItems, adminDataModuleRefreshEvents, adminNewsIngestionArticles, adminNewsIngestionSources, spiderPushRelation } from '../drizzle/schema';
import { getDb } from './db';
import { deliveryDatasetIdentity } from '../shared/deliveryDatasetIdentity';
import { isTopLongformModule, toPlainNewsHeadline } from './newsLongform';
import { agentReachNewsRejectionReason } from './agentReachNewsPublication';

const moduleFeedColumns = {
  id: adminDataModuleContentItems.id,
  contentKey: adminDataModuleContentItems.contentKey,
  moduleId: adminDataModuleContentItems.moduleId,
  title: adminDataModuleContentItems.title,
  body: adminDataModuleContentItems.body,
  topic: adminDataModuleContentItems.topic,
  category: adminDataModuleContentItems.category,
  sourceKind: adminDataModuleContentItems.sourceKind,
  sourceReference: adminDataModuleContentItems.sourceReference,
  payload: adminDataModuleContentItems.targetPayload,
  publishedAt: adminDataModuleContentItems.publishedAt,
  updatedAt: adminDataModuleContentItems.updatedAt,
};

// Apply the same factual-data gate before LIMIT for reads and acknowledgements.
// Otherwise a page of historic simulated deliveries can hide valid older data.
const factualDelivery = () => and(
  ne(adminDataModuleContentItems.sourceKind, 'simulated'),
  sql`COALESCE(JSON_LENGTH(JSON_EXTRACT(${adminDataModuleContentItems.targetPayload}, '$.simulatedFields')), 0) = 0`,
);

const INTERNAL_FEED_TEXT = /后台|爬虫|抓取|crawler|(?:站点\s*)?spider(?:_|\b)|module(?:Id)?|指定模块|推送目标|数据主题|分析视角|fund_flow|financial_news|news_review_pipeline|sourceReference|targetPath|strategyKey|promptKey|viewType|sourceType|transformationVersion|模块专属评分|\d+\s*\/\s*98|配置变化线索|来源标题|来源链接|公开来源|来源元数据|来源未提供|已保存来源|来源定位|既有新闻读取契约|素材保持为空|关键词[:：]|关联标的|证券代码|上市地|保留原始出处|模拟|功能演示/i;

export function cleanPublicFeedText(value: unknown) {
  if (typeof value !== 'string') return '';
  const withoutMarkup = value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ');
  const cleaned = withoutMarkup
    .split(/[。；\n]+/)
    .map((part) => part.trim())
    .filter((part) => part && !INTERNAL_FEED_TEXT.test(part))
    .join('。')
    .replace(/^(?:简单说|换句话说|重点|一句话看懂)[:：]\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[·|,:：；。\s]+|[·|,:：；。\s]+$/g, '')
    .trim();
  for (const marker of ['友情链接', 'Copyright', '版权 ©', 'ICP备案', '互联网新闻信息服务许可证', '违法和不良信息举报']) {
    const index = cleaned.indexOf(marker);
    if (index > 0) return cleaned.slice(0, index).trim();
  }
  return cleaned;
}

/** 将浏览器可见内容归一化为稳定指纹，消除 nbsp、零宽字符和标点差异。 */
export function publicContentFingerprint(value: string) {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&#(?:x0*27|39);/gi, "'")
    .replace(/&#(?:x0*22|34);/gi, '"')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function publicContentGrams(value: string) {
  const normalized = publicContentFingerprint(value);
  if (normalized.length < 12) return new Set(normalized ? [normalized] : []);
  const result = new Set<string>();
  for (let index = 0; index <= normalized.length - 4; index += 1) result.add(normalized.slice(index, index + 4));
  return result;
}

export function publicContentSimilarity(left: string, right: string) {
  const a = publicContentGrams(left);
  const b = publicContentGrams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((item) => { if (b.has(item)) overlap += 1; });
  return overlap / Math.max(a.size, b.size);
}

export function isNearDuplicatePublicContent(left: string, right: string, threshold = 0.86) {
  const leftKey = publicContentFingerprint(left);
  const rightKey = publicContentFingerprint(right);
  return Boolean(leftKey && rightKey && (leftKey === rightKey || publicContentSimilarity(left, right) >= threshold));
}

export function publicContentRejectionReason(input: { title?: unknown; body?: unknown; sourceReference?: unknown }) {
  const title = String(input.title ?? '');
  const body = String(input.body ?? '');
  const sourceReference = String(input.sourceReference ?? '');
  if (/^通知\s*[-—]\s*中国金融新闻网/i.test(title)
    && /(?:电子报系统|订阅未到期|微信扫描|二维码|小程序注册|如需帮助，请联系我们)/i.test(body)) {
    return '站点订阅或访问方式通知不属于金融研究内容。';
  }
  try {
    const source = new URL(sourceReference);
    const isPortalPath = /^\/(?:index|default)?\.(?:html?|shtml?)$|^\/?$/i.test(source.pathname);
    const hasPortalIdentity = /(?:金融时报\s*APP|金融时报\s*电子报|金融时报\s*微信)/i.test(body)
      || (/^(?:中国金融新闻网|首页)(?:\s*[-—].*)?$/i.test(title.trim()) && publicContentFingerprint(body).length >= 400);
    if (isPortalPath && hasPortalIdentity) {
      return '门户聚合页与栏目页内容重复，已保留分类来源的唯一版本。';
    }
  } catch {
    // Invalid source references are handled by the source-validation layer.
  }
  return null;
}

function canonicalPublicSource(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.replace(/\/(?:index|default)\.(?:html?|shtml?)$/i, '/').replace(/\/{2,}/g, '/');
    return `${parsed.hostname.toLowerCase()}${path || '/'}`.replace(/\/$/, '') || parsed.hostname.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function publicSourcePreference(value: unknown) {
  if (typeof value !== 'string') return 0;
  try {
    const parsed = new URL(value);
    return /\/(?:index|default)\.(?:html?|shtml?)$/i.test(parsed.pathname) ? 0 : 1;
  } catch {
    return 0;
  }
}

const PUBLIC_PAGE_CHROME_LABELS = new Set([
  '首页', '金融管理', '要闻', '评论', '深度', '银行', '证券', '保险', '国际', '地方', '公司', '理论',
  '金融科技', '农村金融', '可视化', '文化', '信批平台', '中国金融家', '专题', '品牌', '详情', '分享',
  '金融时报', 'APP', '电子报', '微信', '官方微博', '官方抖音', '金融时报APP', '金融时报电子报', '金融时报数字报',
]);

function plainPublicLine(value: string) {
  return value
    .replace(/^\s{0,3}(?:#{1,6}\s*|(?:[-+*•>|]\s*)+|\d+[.)]\s*)/, '')
    .replace(/^[\s:#*_=|>]+/, '')
    .replace(/[\s*_=|>]+$/, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*[=*_-]{3,}\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Old crawler deliveries can contain a complete Markdown rendering of the
 * source page.  Clean it again at read time so historic rows cannot leak
 * navigation, QR-code instructions, URLs or legal footers into the terminal.
 */
function cleanPublicFeedLongform(value: unknown, sourceReference = '', sourceTitle = '') {
  if (typeof value !== 'string') return '';
  const baseTitle = sourceTitle.replace(/\s*[-—]\s*中国金融新闻网\s*$/i, '').trim();
  let lines = value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[[^\]]*\]\(javascript:[^)]*\)/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\\([*_[\]`])/g, '$1')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    // Historic Markdown snapshots were sometimes persisted as one physical
    // line. Restore their structural boundaries before applying line rules.
    .replace(/\s+\*\s+/g, '\n')
    .replace(/(?:^|\s)#{1,6}\s*/g, '\n')
    .replace(/\s+(当前位置(?:[:：]|$))/g, '\n$1')
    .replace(/\s+(专题|可视化)(?=\s|[:：]|$)/g, '\n$1')
    .replace(/\s+(友情链接|金融时报社媒体简介|关于我们|广告刊例|记者专栏|联系我们)(?=\s|[:：]|$)/g, '\n$1')
    .split(/[\n\r]+/)
    .map(plainPublicLine)
    .filter(Boolean)
    .filter((line) => !/^\*+$/.test(line));

  const locationIndex = lines.findIndex((line) => /^当前位置(?:[:：]|$)/.test(line));
  const isDetailPage = /\/content_[^/]+\.s?html?$/i.test(sourceReference);
  const isListingPage = /\/node_\d+(?:_\d+)?\.s?html?$/i.test(sourceReference);
  if (locationIndex >= 0 && (isDetailPage || isListingPage)) {
    const titleIndexes: number[] = [];
    for (let index = locationIndex + 1; index < Math.min(lines.length, locationIndex + 14); index += 1) {
      if (baseTitle && lines[index] === baseTitle) titleIndexes.push(index);
    }
    lines = lines.slice(titleIndexes.length ? titleIndexes.at(-1)! + 1 : locationIndex + 1);
  }

  const stopIndex = lines.findIndex((line, index) => {
    if (/^(?:友情链接|金融时报社媒体简介|关于我们|广告刊例|记者专栏|联系我们)(?:[:：]|$)/.test(line)) return true;
    if (/^(?:版权声明|责任编辑)[:：]/.test(line)) return true;
    return (isDetailPage || isListingPage) && index > 0 && /^(?:专题|可视化)(?:[:：\s]|$)/.test(line);
  });
  if (stopIndex >= 0) lines = lines.slice(0, stopIndex);

  return lines
    .filter((line) => !PUBLIC_PAGE_CHROME_LABELS.has(line))
    .filter((line) => !/^(?:官方网站|证券市场信息披露(?:媒体|平台)|当前位置|上一页|下一页|分享[:：]?|\d{1,2}\)?$)/.test(line))
    .filter((line) => !/(?:ICP备案|互联网新闻信息服务许可证|违法和不良信息举报|Copyright\s*©|金融新闻网由金融时报社主办)/i.test(line))
    .map((paragraph) => cleanPublicFeedText(paragraph))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function withInternalDeliveryKey<T extends object>(item: T, deliveryKey: string) {
  Object.defineProperty(item, 'deliveryKey', {
    value: deliveryKey,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return item as T & { deliveryKey: string };
}

type PublicDatasetScalar = string | number | boolean | null;
type PublicDataset = {
  label: string;
  columns: string[];
  rows: Array<Record<string, PublicDatasetScalar>>;
  metadata: {
    provider: string;
    queriedAt: string | null;
    observedAt: string | null;
    timezone: string;
    rowCount: number;
    displayedRowCount: number;
    truncated: boolean;
    quality: string;
    realtimeStatus: string;
    schemaVersion: string;
    checksum: string;
    observationIdentity?: string;
  };
};

const MAX_PUBLIC_DATASET_COLUMNS = 40;
const MAX_PUBLIC_DATASET_ROWS = 200;

function publicDatasetScalar(value: unknown): PublicDatasetScalar {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return /https?:\/\//i.test(value) ? null : value.slice(0, 2_000);
  return null;
}

/**
 * Exposes only declarative, scalar OpenBB data. Administrative targeting,
 * executable chart code and arbitrary nested provider objects never cross the
 * public feed boundary.
 */
export function toPublicFeedDataset(value: unknown): PublicDataset | null {
  const dataset = payloadRecord(value);
  if (!Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) return null;
  const columns = [...new Set(dataset.columns
    .filter((column): column is string => typeof column === 'string' && Boolean(column.trim())
      && !/^(?:source(?:url|reference)?|provider|url|endpoint|api[_-]?key|token|secret|password|savedAt|fetchedAt|queriedAt|collection|来源|采集)$/i.test(column.replace(/[ _-]/g, '')))
    .map((column) => column.trim().slice(0, 120)))]
    .slice(0, MAX_PUBLIC_DATASET_COLUMNS);
  if (!columns.length) return null;
  const sourceRows = dataset.rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const rows = sourceRows.slice(0, MAX_PUBLIC_DATASET_ROWS).map((row) => Object.fromEntries(
    columns.map((column) => [column, publicDatasetScalar((row as Record<string, unknown>)[column])]),
  ));
  if (!rows.length) return null;
  const metadata = payloadRecord(dataset.metadata);
  const rowCount = Number.isFinite(Number(metadata.rowCount))
    ? Math.max(0, Math.floor(Number(metadata.rowCount)))
    : sourceRows.length;
  const checksum = typeof metadata.checksum === 'string' && /^[a-f0-9]{32,128}$/i.test(metadata.checksum)
    ? metadata.checksum.toLowerCase()
    : '';
  return {
    label: typeof dataset.label === 'string' ? dataset.label.slice(0, 200) : '结构化市场数据',
    columns,
    rows,
    metadata: {
      provider: typeof metadata.provider === 'string' ? metadata.provider.slice(0, 120) : '',
      queriedAt: typeof metadata.queriedAt === 'string' ? metadata.queriedAt.slice(0, 80) : null,
      observedAt: typeof metadata.observedAt === 'string' ? metadata.observedAt.slice(0, 80) : null,
      timezone: typeof metadata.timezone === 'string' ? metadata.timezone.slice(0, 120) : 'provider-defined',
      rowCount,
      displayedRowCount: rows.length,
      truncated: Boolean(metadata.truncated) || rowCount > rows.length,
      quality: typeof metadata.quality === 'string' ? metadata.quality.slice(0, 80) : 'provider_response',
      realtimeStatus: typeof metadata.realtimeStatus === 'string' ? metadata.realtimeStatus.slice(0, 80) : 'provider_defined',
      schemaVersion: typeof metadata.schemaVersion === 'string' ? metadata.schemaVersion.slice(0, 80) : 'openbb-query-v1',
      checksum,
      observationIdentity: typeof metadata.observationIdentity === 'string' && /^[a-f0-9]{64}$/.test(metadata.observationIdentity) ? metadata.observationIdentity : undefined,
    },
  };
}

export function toPublicFeedItem(row: any) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {};
  // Simulation/rewrite output belongs in the administrative history, never
  // in a factual live feed. Cleaning its disclaimer must not launder it into
  // a seemingly sourced market update.
  if (row.sourceKind === 'simulated'
    || (Array.isArray(payload.simulatedFields) && payload.simulatedFields.length > 0)) return null;
  if (isMisroutedCompanyNews(row)) return null;
  // Legacy Agent Reach web snapshots could be published as "articles" before
  // the publication gate existed. Hide them on every public read without
  // deleting their archived raw data or touching unrelated news sources.
  if (payload.source === 'agent-reach' && String(row.moduleId ?? '').startsWith('news-')) {
    if (row.category === '新闻全文' && payload.verifiedOfficialFullText !== true) return null;
    const rejection = agentReachNewsRejectionReason({
      subType: row.category === '新闻摘要' || row.category === '新闻全文' ? 'rss' : 'web',
      title: String(row.title ?? ''), body: String(row.body ?? ''),
      summary: row.category === '新闻摘要' || row.category === '新闻全文' ? String(row.body ?? '') : null,
      sourceUrl: String(row.sourceReference ?? ''),
      rssFeedUrl: typeof payload.rssFeedUrl === 'string' ? payload.rssFeedUrl : null,
      verifiedOfficialFullText: row.category === '新闻全文' && payload.verifiedOfficialFullText === true,
    });
    if (rejection) return null;
  }
  const dataset = toPublicFeedDataset(payload.dataset);
  // A crypto-themed generic market event can still contain an unrelated
  // index snapshot. Only structured observations enter this terminal feed.
  if (row.moduleId === 'crypto-market' && !dataset) return null;
  const rawTitle = String(payload.contentLabel ?? row.title ?? '');
  const rawBody = String(payload.rewrittenSummary ?? row.body ?? '');
  if (/OpenBB\s*运行验证|Archive SHA-256|Archive manifest|OpenAPI contract/i.test(`${rawTitle} ${rawBody}`)) return null;
  // Legacy bulk imports copied securities master records into news targets.
  // Keep the securities in their original table; they are not news articles.
  if (String(row.moduleId ?? '').startsWith('news-') && /全球股票清单|证券清单归一化导入|用户提供的全球股票清单/.test(`${rawTitle} ${rawBody}`)) return null;
  // A central-bank bulletin with no issuer link is not a company-news record.
  if (row.moduleId === 'news-cn' && /央行与宏观/.test(String(row.category ?? row.topic ?? ''))) return null;
  if (isTopLongformModule(row.moduleId) && (
    /全球股票清单|TOP\s*·\s*要闻精选.+风险传导/i.test(rawTitle)
    || /模块专属评分|独立转换规则|仅用于功能演示/i.test(rawBody)
  )) return null;
  const body = cleanPublicFeedLongform(payload.rewrittenSummary, row.sourceReference, rawTitle)
    || cleanPublicFeedLongform(row.body, row.sourceReference, rawTitle);
  let title = cleanPublicFeedText(payload.contentLabel) || cleanPublicFeedText(row.title) || '市场信息更新';
  // Structured datasets are already cleaned into the terminal. Keep provider
  // provenance in the payload/validation metadata, but do not expose the
  // upstream brand in the terminal's visible title or body.
  if (dataset) {
    const provider = String(payloadRecord(payloadRecord(payload.dataset).metadata).provider ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (provider) title = title.replace(new RegExp(`\\s*[·•|]\\s*${provider}\\s*$`, 'i'), '').trim();
    title = title.replace(/\s*[·•|]\s*(?:FRED|World\s*Bank|New\s*York\s*Fed|provider-defined)\s*$/i, '').trim();
  }
  const cleanedDatasetBody = dataset
    ? body.replace(/(^|\n)(?:数据提供商|来源)\s*[:：]\s*[^；。\n]+[；。]?[ \t]*/g, '$1').trim()
    : body;
  const visibleBody = cleanedDatasetBody;
  if (publicContentRejectionReason({ title: rawTitle, body, sourceReference: row.sourceReference })) return null;
  const titleParts = title.split('·').map((part) => part.trim()).filter(Boolean);
  const repeatedTitle = titleParts.length > 1 && new Set(titleParts.map((part) => part.toLowerCase())).size === 1;
  if (repeatedTitle && body) {
    const bodyLead = body.replace(/^(?:简单说|换句话说|重点)[:：]\s*/i, '').split(/[。！？!?]/)[0]?.trim();
    if (bodyLead && bodyLead.length >= 8 && bodyLead.length <= 600) title = toPlainNewsHeadline(bodyLead);
  }
  if (isTopLongformModule(row.moduleId)) title = toPlainNewsHeadline(title);
  // Never manufacture article length during a read.  The feed must expose
  // only facts persisted by the source pipeline; short source material stays
  // short and the UI can label it as a brief/insufficient record.
  if (!visibleBody || visibleBody.length < 12 || title === '市场信息更新') return null;
  // `updatedAt` changes when an ACK is persisted.  Including it in the
  // public key would make the same article appear as a new push after every
  // confirmation/reconnect.  A published timestamp (when supplied) plus the
  // normalized title/body is stable across delivery state changes.
  const identity = `${title}|${visibleBody}|${row.publishedAt ?? ''}|${dataset?.metadata.checksum ?? ''}`;
  return withInternalDeliveryKey({
    itemKey: createHash('sha256').update(identity).digest('hex').slice(0, 24),
    title,
    body: visibleBody,
    topic: cleanPublicFeedText(row.topic) || '市场观察',
    category: cleanPublicFeedText(row.category) || '市场资讯',
    sourceKind: row.sourceKind === 'real' ? 'public' as const : 'observation' as const,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    ...(dataset ? { dataset } : {}),
  }, typeof row.contentKey === 'string' ? row.contentKey : '');
}

function rekeyPublicFeedBody(item: NonNullable<ReturnType<typeof toPublicFeedItem>>, body: string) {
  const identity = `${item.title}|${body}|${item.publishedAt ?? ''}|${item.dataset?.metadata.checksum ?? ''}`;
  return withInternalDeliveryKey(
    { ...item, body, itemKey: createHash('sha256').update(identity).digest('hex').slice(0, 24) },
    item.deliveryKey,
  );
}

function removeClaimedArticleSegments(body: string, claimed: string[]) {
  const paragraphs = body.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  const kept: string[] = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const isMetadata = /^\d{4}-\d{2}-\d{2}(?:\s|$)/.test(paragraph);
    if (isMetadata) {
      if (kept.length) kept[kept.length - 1] = `${kept[kept.length - 1]}\n\n${paragraph}`;
      continue;
    }
    const duplicate = paragraph.length >= 40
      && claimed.some((previous) => isNearDuplicatePublicContent(paragraph, previous, 0.92));
    const nextIsMetadata = /^\d{4}-\d{2}-\d{2}(?:\s|$)/.test(paragraphs[index + 1] ?? '');
    if (!duplicate) {
      kept.push(nextIsMetadata ? `${paragraph}\n\n${paragraphs[index + 1]}` : paragraph);
      if (paragraph.length >= 40) claimed.push(paragraph);
    }
    if (nextIsMetadata) index += 1;
  }
  return kept.join('\n\n').trim();
}

export function distinctPublicRows(rows: any[]) {
  const kept: Array<{ sourceRow: any; publicRow: NonNullable<ReturnType<typeof toPublicFeedItem>>; sourceEntity: string; canonicalSource: string }> = [];
  for (const sourceRow of rows) {
    const publicRow = toPublicFeedItem(sourceRow);
    if (!publicRow) continue;
    const payload = sourceRow.payload && typeof sourceRow.payload === 'object' ? sourceRow.payload as Record<string, unknown> : {};
    const sourceEntity = typeof payload.sourceDataUuid === 'string' ? payload.sourceDataUuid : '';
    const canonicalSource = canonicalPublicSource(sourceRow.sourceReference);
    const datasetIdentity = deliveryDatasetIdentity(publicRow.dataset);
    const duplicateIndex = kept.findIndex((entry) => (
      datasetIdentity || entry.publicRow.dataset
        ? datasetIdentity !== null && datasetIdentity === deliveryDatasetIdentity(entry.publicRow.dataset)
        : Boolean(sourceEntity && entry.sourceEntity === sourceEntity)
      || Boolean(canonicalSource && entry.canonicalSource === canonicalSource)
      || isNearDuplicatePublicContent(publicRow.body, entry.publicRow.body)
    ));
    if (duplicateIndex < 0) {
      kept.push({ sourceRow, publicRow, sourceEntity, canonicalSource });
      continue;
    }
    const previous = kept[duplicateIndex];
    if (publicSourcePreference(sourceRow.sourceReference) > publicSourcePreference(previous.sourceRow.sourceReference)) {
      kept[duplicateIndex] = { sourceRow, publicRow, sourceEntity, canonicalSource };
    }
  }
  const claimedSegments: string[] = [];
  return kept.flatMap(({ publicRow }) => {
    if (publicRow.dataset) return [publicRow];
    const body = removeClaimedArticleSegments(publicRow.body, claimedSegments);
    return body.length >= 12 ? [rekeyPublicFeedBody(publicRow, body)] : [];
  });
}

/** 路径可能同时命中多个既有模块；跨模块只保留一份完全相同的正文。 */
export function distinctPublicItems(items: any[]) {
  const kept: any[] = [];
  for (const item of items) {
    const body = String(item?.body ?? '');
    if (!publicContentFingerprint(body)) continue;
    const identity = deliveryDatasetIdentity(item.dataset);
    if (kept.some((previous) => identity || previous.dataset
      ? identity !== null && identity === deliveryDatasetIdentity(previous.dataset)
      : isNearDuplicatePublicContent(body, String(previous?.body ?? '')))) continue;
    kept.push(item);
  }
  return kept;
}

type FeedViewer = { id: number; role: string };

function canViewerReceive(row: { payload?: unknown }, viewer?: FeedViewer) {
  if (!viewer) return true;
  const payload = payloadRecord(row.payload);
  const audience = payloadRecord(payload.targetAudience);
  if (!Object.keys(audience).length) return true;
  const userIds = Array.isArray(audience.userIds)
    ? audience.userIds.filter((value): value is number => Number.isInteger(value))
    : [];
  if (userIds.length && !userIds.includes(viewer.id)) return false;
  if (audience.type === 'role' && typeof audience.role === 'string') return audience.role === viewer.role;
  return audience.type === 'all_authenticated' || audience.type === 'users' || !audience.type;
}

/** Identical news has one owner, even when legacy writers copied it to tabs. */
export function uniqueNewsDeliveries<T extends { moduleId: string; id?: number; payload?: unknown }>(rows: T[], candidates: T[]) {
  const priority = (moduleId: string) => moduleId === 'news-top' ? 0 : moduleId === 'news-ni' ? 1 : 2;
  const owners: Array<{ moduleId: string; body: string }> = [];
  for (const row of [...candidates].sort((a, b) => priority(a.moduleId) - priority(b.moduleId) || (a.id ?? 0) - (b.id ?? 0))) {
    const item = toPublicFeedItem(row);
    if (!item || item.dataset) continue;
    if (!owners.some(owner => isNearDuplicatePublicContent(owner.body, item.body))) owners.push({ moduleId: row.moduleId, body: item.body });
  }
  return rows.filter(row => {
    if (!row.moduleId.startsWith('news-')) return true;
    const item = toPublicFeedItem(row);
    if (!item) return false;
    if (item.dataset) return true;
    const owner = owners.find(candidate => isNearDuplicatePublicContent(candidate.body, item.body));
    return !owner || owner.moduleId === row.moduleId;
  });
}

let newsOwnershipCache: { at: number; rows: any[] } | null = null;
let economicOwnershipCache: { at: number; rows: any[] } | null = null;

/** A renamed copy of the same observations is owned by one economic function. */
export function uniqueEconomicDeliveries<T extends { moduleId: string; id?: number; payload?: unknown }>(rows: T[], candidates: T[]) {
  const owners = new Map<string, string>();
  for (const row of [...candidates].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
    if (!row.moduleId.startsWith('economic-')) continue;
    const item = toPublicFeedItem(row);
    if (!item) continue;
    const identity = deliveryDatasetIdentity(item.dataset) ?? publicContentFingerprint(item.body);
    if (identity && !owners.has(identity)) owners.set(identity, row.moduleId);
  }
  return rows.filter(row => {
    if (!row.moduleId.startsWith('economic-')) return true;
    const item = toPublicFeedItem(row);
    if (!item) return false;
    const identity = deliveryDatasetIdentity(item.dataset) ?? publicContentFingerprint(item.body);
    return !owners.has(identity) || owners.get(identity) === row.moduleId;
  });
}

async function scopeNewsDeliveries<T extends { moduleId: string; payload?: unknown }>(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, rows: T[], viewer?: FeedViewer) {
  let visible = rows.filter(row => canViewerReceive(row, viewer));
  if (visible.some(row => row.moduleId.startsWith('economic-'))) {
    if (!economicOwnershipCache || Date.now() - economicOwnershipCache.at > 5_000) {
      const candidates = await db.select(moduleFeedColumns).from(adminDataModuleContentItems).where(and(
        inArray(adminDataModuleContentItems.moduleId, ADMIN_DATA_MODULES.filter(module => module.id.startsWith('economic-')).map(module => module.id)),
        eq(adminDataModuleContentItems.status, 'delivered'), factualDelivery(),
      )).orderBy(desc(adminDataModuleContentItems.id)).limit(3000);
      economicOwnershipCache = { at: Date.now(), rows: candidates };
    }
    visible = uniqueEconomicDeliveries(visible, economicOwnershipCache.rows.filter(row => canViewerReceive(row, viewer)));
  }
  if (!visible.some(row => row.moduleId.startsWith('news-'))) return visible;
  if (!newsOwnershipCache || Date.now() - newsOwnershipCache.at > 5_000) {
    const candidates = await db.select(moduleFeedColumns).from(adminDataModuleContentItems).where(and(
      inArray(adminDataModuleContentItems.moduleId, ADMIN_DATA_MODULES.filter(module => module.id.startsWith('news-')).map(module => module.id)),
      eq(adminDataModuleContentItems.status, 'delivered'), factualDelivery(),
    )).orderBy(desc(adminDataModuleContentItems.publishedAt), desc(adminDataModuleContentItems.id)).limit(3000);
    newsOwnershipCache = { at: Date.now(), rows: candidates };
  }
  // Ownership cannot be claimed by a message this user is not allowed to see.
  return uniqueNewsDeliveries(visible, newsOwnershipCache.rows.filter(row => canViewerReceive(row, viewer)));
}

export async function getPublicModuleFeed(moduleId: string, viewer?: FeedViewer) {
  const db = await getDb();
  if (!db) return { item: null, items: [] };
  const rows = await db.select(moduleFeedColumns).from(adminDataModuleContentItems).where(and(eq(adminDataModuleContentItems.moduleId, moduleId), eq(adminDataModuleContentItems.status, 'delivered'), factualDelivery())).orderBy(desc(adminDataModuleContentItems.publishedAt), desc(adminDataModuleContentItems.updatedAt), desc(adminDataModuleContentItems.id)).limit(50);
  const items = distinctPublicRows(await scopeNewsDeliveries(db, rows, viewer));
  return { item: items[0] ?? null, items };
}

export async function getPublicFeedsForPath(path: string, viewer?: FeedViewer) {
  const matched = resolveAdminDataModulesForPath(path);
  const moduleIds = matched.map((module) => module.id);
  const db = await getDb();
  if (!db || !moduleIds.length) return [];
  const rows = await db.select(moduleFeedColumns).from(adminDataModuleContentItems).where(and(inArray(adminDataModuleContentItems.moduleId, moduleIds), eq(adminDataModuleContentItems.status, 'delivered'), factualDelivery())).orderBy(desc(adminDataModuleContentItems.publishedAt), desc(adminDataModuleContentItems.updatedAt), desc(adminDataModuleContentItems.id)).limit(Math.max(60, moduleIds.length * 50));
  // A reviewed article is persisted first in the publication ledger. Include
  // that same record in the existing terminal feed so “published” is a real
  // delivery state, not an admin-only flag. The public projection below strips
  // internal workflow fields and never exposes the publication URL/provider.
  // Reviewed general news has one owner. Never inject the same publication
  // into every news function or unrelated company-news page.
  const newsModuleId = moduleIds.includes('news-top') ? 'news-top' : undefined;
  if (newsModuleId) {
    const published = await db.select({
      article: adminNewsIngestionArticles,
      sourceName: adminNewsIngestionSources.name,
      sourceProvider: adminNewsIngestionSources.provider,
    }).from(adminNewsIngestionArticles)
      .innerJoin(adminNewsIngestionSources, eq(adminNewsIngestionArticles.sourceId, adminNewsIngestionSources.id))
      .where(and(
        // Real RSS records may remain queued until an operator reviews the
        // generated wording. They are still factual public observations and
        // must not disappear from the existing TOP panel while waiting.
        sql`${adminNewsIngestionArticles.status} IN ('queued', 'draft', 'approved', 'published')`,
        sql`CONCAT(COALESCE(${adminNewsIngestionSources.name}, ''), ' ', COALESCE(${adminNewsIngestionSources.provider}, '')) NOT REGEXP '模拟|simulat(ed|ion)'`,
      ))
      .orderBy(desc(adminNewsIngestionArticles.sourcePublishedAt), desc(adminNewsIngestionArticles.publishedAt), desc(adminNewsIngestionArticles.id))
      .limit(240);
    const publicationRows = published
      .filter(({ sourceName, sourceProvider, article }) => !/模拟|simulat(?:ed|ion)/i.test(`${sourceName} ${sourceProvider} ${article.sourceHeadline} ${article.aiTitle ?? ''}`))
      .map(({ article }) => ({
        id: -article.id,
        contentKey: `published-news:${article.id}`,
        moduleId: newsModuleId,
        title: article.aiTitle ?? article.sourceHeadline,
        // Keep the publication visible when an RSS entry has no excerpt, but
        // use an explicit honest status instead of an internal placeholder or
        // generated filler.  The text is still passed through the normal
        // public-feed cleaner below.
        body: (() => {
          const summary = [article.aiSummary, article.sourceExcerpt].map(value => String(value ?? '').trim())
            .find(value => value && !/(?:来源未提供|已保存来源|只能概括标题|暂无摘要|待审核|尚未发布|严禁自动发布)/i.test(value)) ?? '';
          return summary && !/(?:来源未提供|已保存来源|只能概括标题|暂无摘要|待审核|尚未发布|严禁自动发布)/i.test(summary)
            ? summary
            : `${article.aiTitle ?? article.sourceHeadline}。正文摘要暂未返回。`;
        })(),
        topic: article.category ?? '公开要闻',
        category: article.category ?? (/日銀|日本銀行|央行|政策金利|金融政策/i.test(article.sourceHeadline) ? '政策公告' : '公开要闻'),
        sourceKind: 'real' as const,
        sourceReference: article.sourceUrl,
        payload: { publishedArticleId: article.id },
        publishedAt: article.sourcePublishedAt ?? article.publishedAt,
        updatedAt: article.updatedAt,
      }));
    rows.push(...publicationRows as typeof rows);
  }
  const grouped = new Map<string, typeof rows>();
  (await scopeNewsDeliveries(db, rows, viewer)).forEach((row) => grouped.set(row.moduleId, [...(grouped.get(row.moduleId) ?? []), row]));
  // A path can resolve to several backend modules. Claim the visible body,
  // not the module-specific title, so a renamed copy of the same article is
  // still shown once in the terminal.
  const claimedBodies: string[] = [];
  const claimedDatasets = new Set<string>();
  return matched.map((module) => {
    const items = distinctPublicRows(grouped.get(module.id) ?? []).filter((item) => {
      const identity = deliveryDatasetIdentity(item.dataset);
      if (identity) {
        if (claimedDatasets.has(identity)) return false;
        claimedDatasets.add(identity);
        return true;
      }
      const body = String(item.body ?? '');
      if (claimedBodies.some((claimed) => isNearDuplicatePublicContent(body, claimed))) return false;
      claimedBodies.push(body);
      return true;
    });
    return { moduleName: '市场更新', item: items[0] ?? null, items };
  });
}

/**
 * Returns only the latest server-side source refresh signals for modules mapped
 * to a public path. These are invalidation hints, never data payloads. The
 * frontend must refetch its own typed query before applying any update.
 */
export async function getPublicRefreshSignalsForPath(path: string) {
  const moduleIds = resolveAdminDataModulesForPath(path).map((module) => module.id);
  const db = await getDb();
  if (!db || !moduleIds.length) return [];
  const rows = await db.select({ moduleId: adminDataModuleRefreshEvents.moduleId, status: adminDataModuleRefreshEvents.status, createdAt: adminDataModuleRefreshEvents.createdAt })
    .from(adminDataModuleRefreshEvents)
    .where(inArray(adminDataModuleRefreshEvents.moduleId, moduleIds))
    .orderBy(desc(adminDataModuleRefreshEvents.createdAt))
    .limit(60);
  const latest = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!latest.has(row.moduleId)) latest.set(row.moduleId, row);
  // Deliberately omit module IDs and administrative detail from the public
  // stream. The path has already been scoped server-side; the browser only
  // needs a monotonic invalidation token.
  return [...latest.values()].map((row) => ({ status: row.status, refreshedAt: row.createdAt.toISOString() }));
}

export function publicFeedSignature(items: Array<{ itemKey: string; updatedAt?: Date | string | null }>) {
  return createHash('sha256').update(items.map((item) => `${item.itemKey}|${item.updatedAt ?? ''}`).join('\n')).digest('hex').slice(0, 20);
}

type PublicFeedReceipt = {
  receiptId: string;
  sentAt: string;
  targetScope: string;
  sentCount: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
  currentStatus: 'waiting_front_ack' | 'front_acknowledged' | 'failed' | 'cancelled';
  frontAckAt: string | null;
  latestFrontAckAt: string | null;
  failureReason: string | null;
  retryStatus: 'not_required' | 'retry_available' | 'retrying' | 'cancelled';
  acknowledgedClientCount: number;
  acknowledgedClients: string[];
  acknowledgedUserIds: number[];
  acknowledgedTerminals: Array<{ terminalId: string; userId: number; acknowledgedAt: string }>;
};

function payloadRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * CN is the existing company-news slot, not a general policy/news inbox.
 * Older publication writers occasionally placed central-bank and regulator
 * bulletins there because they only had a generic "news" category.  Keep the
 * historical rows in the durable ledger, but prevent them from crossing the
 * public module boundary.  They remain available to the existing TOP/policy
 * publication path, where the same article has a single canonical owner.
 */
function isMisroutedCompanyNews(row: { moduleId?: unknown; title?: unknown; body?: unknown; category?: unknown; topic?: unknown; sourceReference?: unknown; payload?: unknown }) {
  if (row.moduleId !== 'news-cn') return false;
  const payload = payloadRecord(row.payload);
  // A real company record must carry a business identity.  Do not infer one
  // from the word "bank" alone: central-bank names also contain it.
  const hasCompanyIdentity = [
    payload.symbol,
    payload.securityName,
    payload.companyName,
    payload.issuer,
    payload.company,
    payload.ticker,
    payloadRecord(payload.dataset).params && payloadRecord(payloadRecord(payload.dataset).params).symbol,
  ].some(value => typeof value === 'string' && value.trim().length > 0);
  if (hasCompanyIdentity) return false;
  const text = [row.title, row.body, row.category, row.topic, row.sourceReference, payload.title, payload.summary]
    .map(value => String(value ?? ''))
    .join(' ');
  return /(?:central\s*bank|bank\s+of\s+england|federal\s+reserve|european\s+central\s+bank|ecb\b|日本銀行|日銀|央行|货币政策|利率决议|政策公告|monetary\s+policy|policy\s+(?:statement|decision|minutes)|regulator|监管机构|监管公告|金融政策|国债余额|当座预金)/i.test(text);
}

function receiptFromPayload(row: { id: number; moduleId: string; publishedAt?: Date | null; payload?: unknown }) {
  const payload = payloadRecord(row.payload);
  const stored = payloadRecord(payload.deliveryReceipt);
  const acknowledgedClients = Array.isArray(stored.acknowledgedClients)
    ? stored.acknowledgedClients.filter((value): value is string => typeof value === 'string').slice(-20)
    : [];
  const acknowledgedUserIds = Array.isArray(stored.acknowledgedUserIds)
    ? stored.acknowledgedUserIds.filter((value): value is number => Number.isInteger(value)).slice(-200)
    : [];
  const acknowledgedTerminals = Array.isArray(stored.acknowledgedTerminals)
    ? stored.acknowledgedTerminals.filter((value): value is { terminalId: string; userId: number; acknowledgedAt: string } => Boolean(value && typeof value === 'object' && typeof (value as any).terminalId === 'string' && Number.isInteger((value as any).userId) && typeof (value as any).acknowledgedAt === 'string')).slice(-200)
    : [];
  const relationId = typeof payload.latestPushRelationUuid === 'string'
    ? payload.latestPushRelationUuid
    : typeof payload.pushRelationUuid === 'string'
      ? payload.pushRelationUuid
      : `delivery_${row.id}`;
  return {
    receiptId: typeof stored.receiptId === 'string' ? stored.receiptId : relationId,
    sentAt: typeof stored.sentAt === 'string' ? stored.sentAt : (row.publishedAt ?? new Date()).toISOString(),
    targetScope: typeof stored.targetScope === 'string' ? stored.targetScope : row.moduleId,
    sentCount: Number.isFinite(Number(stored.sentCount)) ? Math.max(0, Number(stored.sentCount)) : 1,
    successCount: Number(stored.successCount ?? 0),
    failureCount: Number(stored.failureCount ?? 0),
    pendingCount: Number(stored.pendingCount ?? Math.max(0, Number(stored.sentCount ?? 1) - Number(stored.successCount ?? 0))),
    currentStatus: stored.currentStatus === 'front_acknowledged' ? 'front_acknowledged' as const : 'waiting_front_ack' as const,
    frontAckAt: typeof stored.frontAckAt === 'string' ? stored.frontAckAt : null,
    latestFrontAckAt: typeof stored.latestFrontAckAt === 'string' ? stored.latestFrontAckAt : null,
    failureReason: typeof stored.failureReason === 'string' ? stored.failureReason : null,
    retryStatus: stored.retryStatus === 'retrying' || stored.retryStatus === 'retry_available' || stored.retryStatus === 'cancelled'
      ? stored.retryStatus
      : 'not_required' as const,
    acknowledgedClientCount: acknowledgedClients.length,
    acknowledgedClients,
    acknowledgedUserIds,
    acknowledgedTerminals,
  } satisfies PublicFeedReceipt;
}

/**
 * A terminal acknowledges only items it actually received and rendered. The
 * browser identifier is irreversibly hashed before persistence; no terminal
 * route receives administrative metadata in return.
 */
export async function acknowledgePublicFeeds(input: { path: string; itemKeys: string[]; clientKey: string; actorUserId: number; actorRole: string }) {
  if (!Number.isInteger(input.actorUserId) || input.actorUserId < 1) throw new Error('FRONT_ACK_AUTHENTICATION_REQUIRED');
  const matched = resolveAdminDataModulesForPath(input.path);
  const moduleIds = matched.map((module) => module.id);
  const requestedItemKeys = new Set(input.itemKeys);
  const db = await getDb();
  if (!db || !moduleIds.length || !requestedItemKeys.size) {
    return { acknowledged: 0, receivedAt: new Date().toISOString() };
  }
  const rows = await db
    .select(moduleFeedColumns)
    .from(adminDataModuleContentItems)
    .where(and(
      inArray(adminDataModuleContentItems.moduleId, moduleIds),
      eq(adminDataModuleContentItems.status, 'delivered'),
      factualDelivery(),
    ))
    .orderBy(desc(adminDataModuleContentItems.publishedAt), desc(adminDataModuleContentItems.updatedAt))
    .limit(Math.max(60, moduleIds.length * 50));
  const now = new Date();
  const clientFingerprint = createHash('sha256').update(`${input.actorUserId}:${input.clientKey}`).digest('hex').slice(0, 24);
  const renderedDeliveryKeys = new Set<string>();
  const scopedRows = await scopeNewsDeliveries(db, rows, { id: input.actorUserId, role: input.actorRole });
  for (const moduleId of moduleIds) {
    const visibleItems = distinctPublicRows(scopedRows.filter((row) => row.moduleId === moduleId));
    visibleItems.forEach((item) => {
      if (requestedItemKeys.has(item.itemKey) && item.deliveryKey) renderedDeliveryKeys.add(item.deliveryKey);
    });
  }
  let acknowledged = 0;
  for (const row of rows) {
    if (!renderedDeliveryKeys.has(row.contentKey)) continue;
    const payload = payloadRecord(row.payload);
    const receipt = receiptFromPayload(row);
    const acknowledgedClients = receipt.acknowledgedClients.includes(clientFingerprint)
      ? receipt.acknowledgedClients
      : [...receipt.acknowledgedClients, clientFingerprint].slice(-20);
    const acknowledgedUserIds = receipt.acknowledgedUserIds.includes(input.actorUserId)
      ? receipt.acknowledgedUserIds
      : [...receipt.acknowledgedUserIds, input.actorUserId].slice(-200);
    const acknowledgedAt = now.toISOString();
    const acknowledgedTerminals = receipt.acknowledgedTerminals.some((terminal) => terminal.terminalId === clientFingerprint)
      ? receipt.acknowledgedTerminals.map((terminal) => terminal.terminalId === clientFingerprint ? { ...terminal, acknowledgedAt } : terminal)
      : [...receipt.acknowledgedTerminals, { terminalId: clientFingerprint, userId: input.actorUserId, acknowledgedAt }].slice(-200);
    const targetAudience = payloadRecord(payload.targetAudience);
    const expectedUserIds = Array.isArray(targetAudience.userIds)
      ? targetAudience.userIds.filter((value): value is number => Number.isInteger(value))
      : [];
    const expectedCount = expectedUserIds.length || Number(targetAudience.recipientCount ?? receipt.sentCount ?? 1);
    const successCount = expectedUserIds.length
      ? expectedUserIds.filter((userId) => acknowledgedUserIds.includes(userId)).length
      : acknowledgedUserIds.length;
    const fullyAcknowledged = expectedCount > 0 && successCount >= expectedCount;
    const frontAcknowledged = { currentStatus: 'front_acknowledged' as const };
    const nextReceipt: PublicFeedReceipt = {
      ...receipt,
      sentCount: expectedCount,
      successCount,
      failureCount: 0,
      pendingCount: Math.max(0, expectedCount - successCount),
      currentStatus: fullyAcknowledged ? frontAcknowledged.currentStatus : 'waiting_front_ack',
      frontAckAt: fullyAcknowledged ? receipt.frontAckAt ?? acknowledgedAt : null,
      latestFrontAckAt: acknowledgedAt,
      failureReason: null,
      retryStatus: 'not_required',
      acknowledgedClientCount: acknowledgedClients.length,
      acknowledgedClients,
      acknowledgedUserIds,
      acknowledgedTerminals,
    };
    await db
      .update(adminDataModuleContentItems)
      .set({ targetPayload: { ...payload, deliveryReceipt: nextReceipt }, updatedAt: row.updatedAt })
      .where(eq(adminDataModuleContentItems.id, row.id));
    // Keep the administrative relation in the same lifecycle state as the
    // content receipt.  A database insert alone is not a successful push;
    // only a rendered front-end ACK advances the relation.
    const relationUuid = typeof payload.latestPushRelationUuid === 'string'
      ? payload.latestPushRelationUuid
      : typeof payload.pushRelationUuid === 'string'
        ? payload.pushRelationUuid
        : null;
    if (relationUuid) {
      const relations = await db.select().from(spiderPushRelation).where(eq(spiderPushRelation.uuid, relationUuid)).limit(1);
      const targets = relations[0]?.targetFrontModuleIds ?? [];
      const targetRows = targets.length ? await db.select(moduleFeedColumns).from(adminDataModuleContentItems)
        .where(and(inArray(adminDataModuleContentItems.moduleId, targets), eq(adminDataModuleContentItems.status, 'delivered'))) : [];
      const confirmedModules = new Set(targetRows.filter((target) => {
        const targetPayload = payloadRecord(target.payload);
        return (targetPayload.pushRelationUuid === relationUuid || targetPayload.latestPushRelationUuid === relationUuid) && typeof payloadRecord(targetPayload.deliveryReceipt).frontAckAt === 'string';
      }).map((target) => target.moduleId));
      const allTargetsAcknowledged = targets.length > 0 && targets.every((moduleId) => confirmedModules.has(moduleId));
      await db
        .update(spiderPushRelation)
        .set({ pushStatus: allTargetsAcknowledged ? 'front_acknowledged' : 'waiting_front_ack', pushDetail: `已确认目标 ${confirmedModules.size}/${targets.length}；最近确认时间 ${now.toISOString()}。未确认目标不计为成功。` })
        .where(eq(spiderPushRelation.uuid, relationUuid));
    }
    acknowledged += 1;
  }
  return { acknowledged, receivedAt: now.toISOString() };
}
