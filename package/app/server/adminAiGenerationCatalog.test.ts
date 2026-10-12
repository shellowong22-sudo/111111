import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_AI_GENERATION_CATALOG_CODES, getAdminAiGenerationTemplate } from '@shared/adminAiGenerationCatalog';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), listLLMModels: vi.fn(), db: null as any }));

vi.mock('./db', () => ({ getDb: async () => mocks.db }));
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(),
  listLLMModels: mocks.listLLMModels,
  listActiveChatProbeCandidates: async () => [],
  activeAiGatewayKind: () => 'direct',
  inspectOmniRouteGateway: async () => ({
    status: 'not_configured', configured: false, reachable: false, modelCount: 0,
    supportsReasoningPassthrough: false, quotaStatus: 'unavailable',
  }),
}));
vi.mock('./aiModelRuntime', () => ({ getVerifiedChatModels: async () => [], getPreferredUcheerModel: async () => null }));
vi.mock('./adminNewsIngestion', () => ({ auditAdminNewsIngestion: vi.fn() }));

describe('AI 目录可审核模板约束', () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.listLLMModels.mockReset();
    mocks.db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ status: 'disabled' }] }) }) }),
      insert: mocks.insert,
    };
  });

  it('为完整的 28 项固定目录提供新闻或研报审核模板映射', () => {
    expect(ADMIN_AI_GENERATION_CATALOG_CODES).toHaveLength(28);
    expect(ADMIN_AI_GENERATION_CATALOG_CODES.every((code) => ['news', 'report'].includes(getAdminAiGenerationTemplate(code)))).toBe(true);
    expect(getAdminAiGenerationTemplate('TOP')).toBe('news');
    expect(getAdminAiGenerationTemplate('BNEF')).toBe('report');
  });

  it('在目录模板与生成类型不匹配时，在创建任务之前拒绝请求', async () => {
    const { runAdminAiGeneration } = await import('./adminAiManagement');
    await expect(runAdminAiGeneration({ generationType: 'news', count: 1, actorUserId: 1, catalogCode: 'BNEF' })).rejects.toThrow('AI_GENERATION_CATALOG_TEMPLATE_MISMATCH');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('已禁用或隐藏的目录在任务创建前被拒绝，不会生成替代文章', async () => {
    const { runAdminAiGeneration } = await import('./adminAiManagement');
    await expect(runAdminAiGeneration({ generationType: 'news', count: 1, actorUserId: 1, catalogCode: 'TOP' })).rejects.toThrow('AI_GENERATION_CATALOG_DISABLED');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('外部模型不可用时不把本地编辑流程冒充为可对话模型', async () => {
    mocks.listLLMModels.mockRejectedValue(new Error('LLM_API_KEY is not configured'));
    const { listAdminAiModelStatus } = await import('./adminAiManagement');
    const status = await listAdminAiModelStatus();
    expect(status).toMatchObject({
      available: true,
      fallback: false,
      gateway: 'not_configured',
      activeModelCount: 0,
    });
    expect(status.models).toEqual([]);
  });
});
