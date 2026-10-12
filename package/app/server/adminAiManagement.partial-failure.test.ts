import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectCount: 0,
  updates: [] as any[],
  inserts: [] as any[],
  audits: [] as any[],
  invokeLLM: vi.fn(),
}));

vi.mock('./_core/llm', () => ({
  listLLMModels: async () => ({ data: [{ id: 'gpt-5-mini', owned_by: 'openai' }] }),
  invokeLLM: (...args: unknown[]) => mocks.invokeLLM(...args as any),
}));
vi.mock('./adminNewsIngestion', () => ({
  auditAdminNewsIngestion: async (input: unknown) => { mocks.audits.push(input); },
}));
vi.mock('./db', () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: () => {
          const limit = async () => {
            mocks.selectCount += 1;
            if (mocks.selectCount === 1) return [];
            if (mocks.selectCount === 2) return [
              { id: 101, sourceId: 1, sourceHeadline: '成功来源标题', sourceExcerpt: '成功摘要', sourceUrl: 'https://example.test/1', sourcePublishedAt: null, status: 'queued' },
              { id: 102, sourceId: 1, sourceHeadline: '失败来源标题', sourceExcerpt: '失败摘要', sourceUrl: 'https://example.test/2', sourcePublishedAt: null, status: 'queued' },
            ];
            return [
              mocks.selectCount === 3
                ? { id: 101, sourceId: 1, sourceHeadline: '成功来源标题', sourceExcerpt: '成功摘要', sourceUrl: 'https://example.test/1', sourcePublishedAt: null, status: 'queued' }
                : { id: 102, sourceId: 1, sourceHeadline: '失败来源标题', sourceExcerpt: '失败摘要', sourceUrl: 'https://example.test/2', sourcePublishedAt: null, status: 'queued' },
            ];
          };
          return { limit, orderBy: () => ({ limit }) };
        },
      }),
    }),
    insert: (table: unknown) => ({ values: async (values: unknown) => { mocks.inserts.push({ table, values }); return [{ insertId: 880001 }]; } }),
    update: () => ({ set: (values: unknown) => ({ where: async () => { mocks.updates.push(values); } }) }),
  }),
}));

describe('runAdminAiGeneration partial failure lifecycle', () => {
  beforeEach(() => {
    mocks.selectCount = 0;
    mocks.updates = [];
    mocks.inserts = [];
    mocks.audits = [];
    mocks.invokeLLM.mockReset();
    mocks.invokeLLM.mockImplementation(async (input: any) => {
      const text = JSON.stringify(input.messages);
      if (text.includes('失败来源标题')) throw new Error('LLM_REQUEST_TIMEOUT');
      return {
        model: 'gpt-5-mini',
        choices: [{ message: { content: JSON.stringify({ title: '成功草稿', summary: '这是一个足够长的成功摘要，用于验证部分失败任务不会覆盖成功结果。', category: '市场', sentiment: 'neutral', tickers: ['TEST'] }) } }],
      };
    });
  });

  it('保留 completed、失败计数和逐篇失败回写，同时保留成功草稿', async () => {
    const { runAdminAiGeneration } = await import('./adminAiManagement');
    const result = await runAdminAiGeneration({ generationType: 'news', count: 2, actorUserId: 120001, catalogCode: 'TOP' });
    expect(result).toMatchObject({ taskId: 880001, status: 'completed', processed: 2, generated: 1, model: 'gpt-5-mini' });
    expect(result.detail).toContain('失败 1 条');
    expect(mocks.updates).toContainEqual(expect.objectContaining({ status: 'failed', processingError: 'LLM_REQUEST_TIMEOUT' }));
    expect(mocks.updates).toContainEqual(expect.objectContaining({ status: 'completed', processedCount: 2, generatedCount: 1, error: '102:LLM_REQUEST_TIMEOUT' }));
    expect(mocks.audits).toEqual(expect.arrayContaining([
      expect.objectContaining({ articleId: 101, action: 'draft_generated' }),
      expect.objectContaining({ articleId: 102, action: 'draft_failed' }),
    ]));
  });
});
