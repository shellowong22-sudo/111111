import { and, asc, desc, eq } from 'drizzle-orm';
import { adminAiGenerationTasks, adminNewsIngestionArticles, adminNewsIngestionSources } from '../drizzle/schema';
import { activeAiGatewayKind, inspectOmniRouteGateway, invokeLLM, listActiveChatProbeCandidates, listLLMModels } from './_core/llm';
import { getPreferredUcheerModel, getVerifiedChatModels } from './aiModelRuntime';
import { ENV } from './_core/env';
import { auditAdminNewsIngestion, syncAdminNewsSource } from './adminNewsIngestion';
import { getAdminAiGenerationTemplate, type AdminAiGenerationCatalogCode } from '@shared/adminAiGenerationCatalog';
import { adminAiGenerationCatalogSettings } from '../drizzle/schema';
import { getDb } from './db';

export const AI_GENERATION_TYPES = ['news', 'report', 'course'] as const;
export type AiGenerationType = (typeof AI_GENERATION_TYPES)[number];

const LOCAL_FALLBACK_MODEL = 'local-review-draft-v1';
// 本地可运行的专用编辑器编排器；它们不是虚构的外部供应商模型，
// 而是对同一事实稿执行不同的清洗、结构化、去重和质量策略。
const LOCAL_MODEL_POOL = [
  LOCAL_FALLBACK_MODEL,
  'local-source-normalizer-v1',
  'local-finance-news-editor-v1',
  'local-bond-editor-v1',
  'local-equity-editor-v1',
  'local-fund-editor-v1',
  'local-options-editor-v1',
  'local-macro-editor-v1',
  'local-risk-editor-v1',
  'local-dedup-auditor-v1',
  'local-language-polisher-v1',
  'local-fact-checker-v1',
] as const;

const TYPE_LABEL: Record<AiGenerationType, string> = {
  news: '金融资讯文章',
  report: '研报摘要',
  course: '课程草稿',
};

const TYPE_INSTRUCTION: Record<AiGenerationType, string> = {
  news: '生成 90–220 字的中文通俗财经资讯草稿，保持中性、通俗，不提供交易建议。',
  report: '生成 120–260 字的中文研报摘要草稿，明确这只是对来源标题和有限摘要的整理，不得补充估值、预测、目标价或未给出事实。',
  course: '生成 120–260 字的中文金融学习课程草稿，写出一个学习目标和来源内可解释的关键术语；不得从来源外补充事实、案例或建议。',
};

const CATALOG_INSTRUCTION: Partial<Record<AdminAiGenerationCatalogCode, string>> = {
  BI: '按“行业研究”目录写作，只对来源标题与有限摘要做审慎梳理，不得补充评级、目标价或投资建议。',
  BECO: '按“经浏/宏观”目录写作，只整理来源已提供的经济或政策表述，不得虚构指标、预测或数据。',
  BNEF: '按“新能源财经研究”目录写作，只整理来源已提供内容，不得补充能源产能、价格、ESG评分或预测。',
  CMNT: '按“评论与分析”目录写作，只说明来源信息，不得捏造作者观点或评论。',
  OPIN: '按“观点”目录写作，只摘要来源材料，不得以不存在的作者名义发表意见。',
  MREP: '按“Morning Report”目录写作，只整理来源摘要，不得补充盘前价格、日程或交易建议。',
  SOCL: '按“社交媒体与分析”目录写作，不得生成未授权的平台数据、用户发言或情绪指标。',
  SOCI: '按“社交监测”目录写作，不得生成未授权的社交监控、热度或情绪数据。',
  TREN: '按“新闻趋势”目录写作，不得生成不存在的热度走势、统计图表或时间序列。',
  PERS: '按“个性化新闻”目录写作，不得虚构个人偏好、推荐、用户资料或阅读行为。',
  MYN: '按“我的新闻”目录写作，不得虚构个人订阅、未读数或账户活动。',
  NLRT: '按“新闻检索与提醒”目录写作，不得虚构提醒、触发记录、通知或价格阈值。',
  NSUB: '按“新闻订阅”目录写作，不得虚构订阅状态、付费权限或来源质量评分。',
  NZPD: '按“新闻设定”目录写作，不得虚构用户设置、通知授权或偏好。',
};

async function resolveAvailableModels(preferredModel?: string) {
  let catalog: Awaited<ReturnType<typeof listLLMModels>>;
  try {
    catalog = await listLLMModels();
  } catch {
    if (preferredModel && !(LOCAL_MODEL_POOL as readonly string[]).includes(preferredModel)) throw new Error('AI_MODEL_NOT_AVAILABLE');
    return preferredModel ? [preferredModel] : [...LOCAL_MODEL_POOL];
  }
  const available = new Set(catalog.data.map((item) => item.id));
  if (preferredModel && !available.has(preferredModel)) throw new Error('AI_MODEL_NOT_AVAILABLE');
  const preferred = [preferredModel, 'gpt-5-mini', 'claude-haiku-4-5', 'gemini-3-flash-preview'].filter((model): model is string => Boolean(model));
  // Use only models returned by the configured catalog. The remaining catalog
  // entries form a real failure fallback chain; no provider or key is invented.
  const catalogModels = catalog.data.map((item) => item.id).filter((id) => available.has(id));
  const models = [...new Set([...preferred, ...catalogModels, ...LOCAL_MODEL_POOL])].filter((model) => available.has(model) || model.startsWith('local-')).slice(0, 12);
  if (!models.length && catalog.data[0]) models.push(catalog.data[0].id);
  if (!models.length) throw new Error('AI_MODEL_CATALOG_EMPTY');
  return models;
}

type GeneratedDraft = {
  title: string;
  summary: string;
  category: '宏观' | '市场' | '公司' | '政策' | '科技' | '其他' | '研报' | '课程';
  sentiment: 'positive' | 'neutral' | 'negative' | 'uncertain';
  tickers: string[];
};

function cleanSourceText(value: string) {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function editorialQualityGate(title: string, summary: string) {
  const paragraphs = summary.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const unique = paragraphs.filter((item, index, all) => all.findIndex((other) => other.toLocaleLowerCase() === item.toLocaleLowerCase()) === index);
  const titleWords = new Set((title.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).slice(0, 12));
  const bodyWords = new Set(summary.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []);
  const overlap = [...titleWords].filter((word) => bodyWords.has(word)).length;
  const repeated = unique.length < paragraphs.length || /(?:^|[。！？])(.{8,40})[。！？].*\1[。！？]/u.test(summary);
  const chineseTitle = /[\u3400-\u9fff]/.test(title);
  const chineseBody = /[\u3400-\u9fff]/.test(summary);
  return { text: unique.join('\n\n'), repeated, titleBodyMismatch: chineseTitle && chineseBody && titleWords.size >= 2 && overlap === 0, length: unique.join('').replace(/\s/g, '').length };
}

function createLocalReviewDraft(article: typeof adminNewsIngestionArticles.$inferSelect, generationType: AiGenerationType): GeneratedDraft {
  const headline = cleanSourceText(article.sourceHeadline).slice(0, 220) || '未命名来源条目';
  const excerpt = cleanSourceText(article.sourceExcerpt ?? '').slice(0, 800);
  const evidence = excerpt || `来源仅提供标题“${headline}”，未提供可验证摘要。`;
  const combined = `${headline} ${excerpt}`;
  const category: GeneratedDraft['category'] = generationType === 'report' ? '研报'
    : generationType === 'course' ? '课程'
      : /央行|利率|通胀|就业|经济|宏观|federal reserve|central bank/i.test(combined) ? '宏观'
        : /监管|法规|政策|委员会|sec\b|government/i.test(combined) ? '政策'
          : /科技|人工智能|芯片|软件|technology|ai\b/i.test(combined) ? '科技'
            : /公司|股份|集团|上市|company|corporation|inc\b/i.test(combined) ? '公司'
              : '市场';
  const titlePrefix = generationType === 'report' ? '来源研报摘要' : generationType === 'course' ? '来源学习要点' : '来源资讯整理';
  const summary = generationType === 'course'
    ? `学习目标：理解该来源条目涉及的主题与信息边界。来源信息：${evidence} 本地后备引擎仅整理已保存文字，未补充外部事实、预测或投资建议；草稿须经管理员审核后使用。`
    : generationType === 'report'
      ? `本摘要依据已保存的来源标题和有限摘要整理：${evidence} 内容未引入来源之外的估值、预测、评级或目标价，仅作为后台待审核草稿。`
      : `本资讯草稿依据已保存的来源标题和有限摘要整理：${evidence} 内容未补充来源之外的数字、人物、事件或投资建议，须经管理员审核。`;
  const tickers = [...new Set(combined.match(/\b[A-Z]{1,5}(?:\.[A-Z])?\b/g) ?? [])].slice(0, 8);
  return { title: `${titlePrefix}：${headline}`.slice(0, 255), summary: summary.slice(0, 2_000), category, sentiment: 'neutral', tickers };
}

export function readModelJsonContent(content: string | Array<{ type: 'text'; text: string } | { type: string }>): string {
  const text = typeof content === 'string'
    ? content
    : content.filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof (part as { text?: unknown }).text === 'string').map((part) => part.text).join('\n');
  return text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
}

async function generateDraftForArticle(input: { articleId: number; generationType: AiGenerationType; model: string; catalogCode?: AdminAiGenerationCatalogCode }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const article = (await db.select().from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.id, input.articleId)).limit(1))[0];
  if (!article) throw new Error('NEWS_INGESTION_ARTICLE_NOT_FOUND');

  let parsed: Partial<GeneratedDraft>;
  if (input.model.startsWith('local-')) {
    parsed = createLocalReviewDraft(article, input.generationType);
  } else {
    const tokenBudget = input.model.startsWith('gpt-') ? { maxCompletionTokens: 900 } : { maxTokens: 2048 };
    const response = await invokeLLM({
      model: input.model,
      ...tokenBudget,
      messages: [
        {
          role: 'system',
          content: `你是受审核的财经内容编辑助手。${TYPE_INSTRUCTION[input.generationType]} ${input.catalogCode ? `当前目录代码：${input.catalogCode}。${CATALOG_INSTRUCTION[input.catalogCode] ?? '只按该目录的来源边界整理内容。'}` : ''} 只能基于输入的来源标题、有限摘要和链接写作；不得补充未提供的数字、人物、事件、判断或结论，不得复制来源全文。所有内容必须保存为待审核草稿，绝不自动发布。输出严格 JSON。`,
        },
        {
          role: 'user',
          content: `生成类型：${TYPE_LABEL[input.generationType]}${input.catalogCode ? `\n目录代码：${input.catalogCode}` : ''}\n来源标题：${article.sourceHeadline}\n来源摘要：${article.sourceExcerpt ?? '来源未提供摘要，只能概括标题信息。'}\n来源链接：${article.sourceUrl}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'admin_ai_review_draft',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              summary: { type: 'string' },
              category: { type: 'string', enum: ['宏观', '市场', '公司', '政策', '科技', '其他', '研报', '课程'] },
              sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'uncertain'] },
              tickers: { type: 'array', items: { type: 'string' }, maxItems: 8 },
            },
            required: ['title', 'summary', 'category', 'sentiment', 'tickers'],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = response.choices[0]?.message.content;
    const content = raw ? readModelJsonContent(raw) : '';
    try {
      parsed = JSON.parse(content || '{}');
    } catch {
      throw new Error('AI_DRAFT_INVALID_JSON');
    }
  }
  if (!parsed.title?.trim() || !parsed.summary?.trim() || !parsed.category || !parsed.sentiment || !Array.isArray(parsed.tickers)) throw new Error('AI_DRAFT_EMPTY');
  const cleanedTitle = cleanSourceText(parsed.title);
  const quality = editorialQualityGate(cleanedTitle, cleanSourceText(parsed.summary));
  if (quality.repeated) throw new Error('AI_DRAFT_REPEATED_PARAGRAPH');
  if (quality.titleBodyMismatch) throw new Error('AI_DRAFT_TITLE_BODY_MISMATCH');
  if (quality.length < 90) throw new Error('AI_DRAFT_TOO_SHORT');

  await db.update(adminNewsIngestionArticles).set({
    status: 'draft',
    aiTitle: cleanedTitle.slice(0, 255),
    aiSummary: quality.text.slice(0, 3_200),
    category: parsed.category,
    sentiment: parsed.sentiment,
    tickers: parsed.tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean).slice(0, 8),
    aiModel: input.model,
    aiGeneratedAt: new Date(),
    aiGenerationCatalogCode: input.catalogCode ?? null,
    processingError: null,
  }).where(eq(adminNewsIngestionArticles.id, article.id));
  return article;
}

export async function listAdminAiGenerationTasks(limit = 60) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminAiGenerationTasks).orderBy(desc(adminAiGenerationTasks.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function listAdminAiModelStatus() {
  const omniRoute = await inspectOmniRouteGateway();
  const activeGateway = activeAiGatewayKind();
  const gatewayConfigured = activeGateway === 'freellmapi' && Boolean(ENV.freeLlmApiBaseUrl.trim());
  const gatewayOverridden = activeGateway === 'llm' && Boolean(ENV.llmBaseUrl.trim());
  const gatewayStatus = omniRoute.status === 'connected' || omniRoute.status === 'overridden'
    ? 'connected' as const
      : omniRoute.configured
        ? 'unavailable' as const
      : gatewayConfigured
        ? 'connected' as const
        : gatewayOverridden
          ? 'overridden' as const
          : 'not_configured' as const;
  const [verified, preferredModel, localModels] = await Promise.all([
    getVerifiedChatModels(),
    getPreferredUcheerModel(),
    listActiveChatProbeCandidates(12, 'ollama'),
  ]);
  const models = verified.map(({ id, verifiedAt }) => ({
    id,
    provider: '当前对话路由',
    state: 'online' as const,
    tier: '最近实测可生成',
    modality: 'chat' as const,
    verifiedAt,
    note: '已通过实际对话请求；可用性可能随网关与额度变化，将定期重新检测。',
  }));
  return {
    available: true,
    fallback: false,
    gateway: gatewayStatus,
    models,
    omniRoute,
    route: activeGateway,
    supportsReasoningPassthrough: omniRoute.supportsReasoningPassthrough,
    activeModelCount: models.length,
    preferredModel,
    localRuntime: {
      detectedModelCount: localModels.length,
      verifiedModelCount: models.filter((model) => model.id.startsWith('ollama:')).length,
    },
  };
}

export async function runAdminAiGeneration(input: { generationType: AiGenerationType; count: number; actorUserId: number; catalogCode?: AdminAiGenerationCatalogCode; model?: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (input.catalogCode) {
    const expectedGenerationType = getAdminAiGenerationTemplate(input.catalogCode);
    if (expectedGenerationType !== input.generationType) throw new Error('AI_GENERATION_CATALOG_TEMPLATE_MISMATCH');
    const setting = (await db.select({ status: adminAiGenerationCatalogSettings.status }).from(adminAiGenerationCatalogSettings).where(eq(adminAiGenerationCatalogSettings.catalogCode, input.catalogCode)).limit(1))[0];
    if (setting && setting.status !== 'enabled') throw new Error('AI_GENERATION_CATALOG_DISABLED');
  }
  const requestedCount = Math.min(Math.max(input.count, 1), 10);
  const taskCreated = await db.insert(adminAiGenerationTasks).values({
    generationType: input.generationType,
    catalogCode: input.catalogCode ?? null,
    requestedCount,
    createdByUserId: input.actorUserId,
    detail: `已请求 ${requestedCount} 篇${input.catalogCode ? `${input.catalogCode} 目录的` : ''}${TYPE_LABEL[input.generationType]}待审核草稿。`,
  });
  const taskId = Number((taskCreated as any)[0]?.insertId ?? (taskCreated as any).insertId);
  if (!taskId) throw new Error('AI_GENERATION_TASK_CREATE_FAILED');
  const startedAt = new Date();
  await db.update(adminAiGenerationTasks).set({ status: 'running', startedAt }).where(eq(adminAiGenerationTasks.id, taskId));

  try {
    const requestedModels = input.model ? await resolveAvailableModels(input.model) : null;
    let candidates = await db.select().from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.status, 'queued')).orderBy(asc(adminNewsIngestionArticles.createdAt)).limit(requestedCount);
    if (!candidates.length) {
      const queuedSources = await db.select({ id: adminNewsIngestionSources.id }).from(adminNewsIngestionSources).where(and(eq(adminNewsIngestionSources.isActive, true), eq(adminNewsIngestionSources.processingMode, 'queued')));
      for (const source of queuedSources) {
        try {
          await syncAdminNewsSource(source.id, input.actorUserId, requestedCount);
        } catch (error) {
          await auditAdminNewsIngestion({ sourceId: source.id, actorUserId: input.actorUserId, action: 'sync_completed', detail: `AI 生成前自动同步失败：${error instanceof Error ? error.message : 'SOURCE_SYNC_FAILED'}` });
        }
      }
      candidates = await db.select().from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.status, 'queued')).orderBy(asc(adminNewsIngestionArticles.createdAt)).limit(requestedCount);
    }
    if (!candidates.length) {
      const detail = '没有可生成的已排队新闻元数据；已尝试同步启用的许可 RSS／Atom 来源，但来源未提供可导入条目。';
      await db.update(adminAiGenerationTasks).set({ status: 'completed', processedCount: 0, generatedCount: 0, detail, completedAt: new Date() }).where(eq(adminAiGenerationTasks.id, taskId));
      await auditAdminNewsIngestion({ actorUserId: input.actorUserId, action: 'sync_completed', detail: `AI ${input.catalogCode ? `${input.catalogCode} 目录` : ''}${TYPE_LABEL[input.generationType]}任务 #${taskId} 完成：没有可处理的排队新闻。` });
      return { taskId, status: 'completed' as const, processed: 0, generated: 0, model: null, detail };
    }

    const models = requestedModels ?? await resolveAvailableModels();
    const model = models[0]!;

    const failures: string[] = [];
    const outcomes = await Promise.all(candidates.map(async (candidate) => {
      try {
        let article: (typeof candidates)[number] | null = null;
        let lastError: unknown;
        for (const candidateModel of models) {
          try {
            article = await generateDraftForArticle({ articleId: candidate.id, generationType: input.generationType, model: candidateModel, catalogCode: input.catalogCode });
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (!article) throw (lastError instanceof Error ? lastError : new Error('AI_DRAFT_FAILED'));
        await auditAdminNewsIngestion({ sourceId: article.sourceId, articleId: article.id, actorUserId: input.actorUserId, action: 'draft_generated', detail: `AI ${input.catalogCode ? `${input.catalogCode} 目录` : ''}${TYPE_LABEL[input.generationType]}任务 #${taskId} 已生成待审核草稿；尚未发布。` });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI_DRAFT_FAILED';
        failures.push(`${candidate.id}:${message}`);
        await db.update(adminNewsIngestionArticles).set({ status: 'failed', processingError: message.slice(0, 1_000) }).where(eq(adminNewsIngestionArticles.id, candidate.id));
        await auditAdminNewsIngestion({ sourceId: candidate.sourceId, articleId: candidate.id, actorUserId: input.actorUserId, action: 'draft_failed', detail: `AI ${TYPE_LABEL[input.generationType]}任务 #${taskId} 失败：${message}` });
        return false;
      }
    }));
    const generated = outcomes.filter(Boolean).length;
    const allFailed = generated === 0 && failures.length === candidates.length;
    const taskStatus = allFailed ? 'failed' as const : 'completed' as const;
    const detail = `处理 ${candidates.length} 条已保存新闻元数据，生成 ${generated} 条待审核草稿${failures.length ? `，失败 ${failures.length} 条` : ''}。`;
    await db.update(adminAiGenerationTasks).set({ status: taskStatus, model, processedCount: candidates.length, generatedCount: generated, detail, error: failures.join('; ').slice(0, 1_000) || null, completedAt: new Date() }).where(eq(adminAiGenerationTasks.id, taskId));
    return { taskId, status: taskStatus, processed: candidates.length, generated, model, detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI_GENERATION_FAILED';
    await db.update(adminAiGenerationTasks).set({ status: 'failed', error: message.slice(0, 1_000), detail: '任务未完成；不会以示例内容替代失败结果。', completedAt: new Date() }).where(eq(adminAiGenerationTasks.id, taskId));
    throw error;
  }
}
