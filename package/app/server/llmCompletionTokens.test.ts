import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeLLM } from './_core/llm';

describe('内置模型可见输出令牌参数', () => {
  afterEach(() => vi.restoreAllMocks());

  it('将 GPT-5 的 maxCompletionTokens 传为 max_completion_tokens', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'test', created: 0, model: 'gpt-5-mini', choices: [{ index: 0, message: { role: 'assistant', content: '{"ok":true}' }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await invokeLLM({ model: 'gpt-5-mini', maxCompletionTokens: 900, messages: [{ role: 'user', content: '只输出 JSON。' }] });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.max_completion_tokens).toBe(900);
    expect(request.max_tokens).toBeUndefined();
  });
});
