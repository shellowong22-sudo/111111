import { describe, expect, it } from 'vitest';
import { readModelJsonContent } from './adminAiManagement';

describe('AI 审核草稿结构化响应解析', () => {
  it('保留普通 JSON 字符串响应', () => {
    expect(readModelJsonContent('{"title":"测试"}')).toBe('{"title":"测试"}');
  });

  it('从内置模型返回的文本分段数组中提取 JSON，而不误判为空草稿', () => {
    expect(readModelJsonContent([{ type: 'text', text: '{"title":"测试"}' }])).toBe('{"title":"测试"}');
  });

  it('清除可选 JSON 代码围栏后再交给结构化草稿校验', () => {
    expect(readModelJsonContent('```json\n{"title":"测试"}\n```')).toBe('{"title":"测试"}');
  });
});
