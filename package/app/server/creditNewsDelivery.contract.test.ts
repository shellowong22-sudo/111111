import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const delivery = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditModuleLiveDelivery.tsx'), 'utf8');
const news = readFileSync(resolve(import.meta.dirname, '../client/src/components/NEWSRPTPanel.tsx'), 'utf8');

describe('信用债新闻实时交付与研读排版', () => {
  it('保留长正文分节换行，同时清理内部交付话术', () => {
    expect(delivery).toContain(".replace(/[ \\t]{2,}/g, ' ')");
    expect(delivery).toContain(".replace(/\\n{3,}/g, '\\n\\n')");
    expect(delivery).toMatch(/后台\|管理端\|人工定向推送\|爬虫/);
    expect(delivery).not.toContain(".replace(/\\s{2,}/g, ' ')");
  });

  it('在原全文研读页内按节渲染，不创建额外入口或面板', () => {
    expect(news).toContain("selected?.body.split(/\\n{2,}/)");
    expect(news).toContain('reportSections.length} 节');
    expect(news).toContain('section.heading && <h4');
    expect(news).toContain('{section.body}</p>');
    expect(news).toContain("{ id: 'reports', label: '全文研读' }");
  });
});
