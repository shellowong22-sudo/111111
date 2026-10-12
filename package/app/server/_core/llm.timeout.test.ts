import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeLLM, listLLMModels } from './llm';

describe('LLM request timeout boundaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('converts an upstream timeout into a finite LLM_REQUEST_TIMEOUT error without retrying', async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException('upstream timed out', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(invokeLLM({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: '生成一条待审核财经草稿' }],
    })).rejects.toThrow('LLM_REQUEST_TIMEOUT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('applies the same finite timeout boundary to model discovery', async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException('model catalog timed out', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listLLMModels()).rejects.toThrow('LLM_REQUEST_TIMEOUT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
