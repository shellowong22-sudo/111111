import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('private news account boundary', () => {
  it('does not present fixed preferences, subscriptions, alerts or quality scores as current account facts', () => {
    const desk = read('client/src/components/news/PrivateNewsEvidenceDesk.tsx');
    const hub = read('client/src/pages/NewsResearchHub.tsx');
    expect(desk).toContain('不以固定样例、临时开关或浏览器本地状态伪造用户数据');
    expect(desk).toContain('当前没有已导入或已授权读取');
    expect(desk).toContain('data-private-news-historical-boundary={mode}');
    expect(hub).toContain('<PrivateNewsEvidenceDesk mode="personal" />');
    expect(hub).toContain('<PrivateNewsEvidenceDesk mode="myn" />');
    expect(hub).toContain('<PrivateNewsEvidenceDesk mode="nlrt" />');
    expect(hub).toContain('<PrivateNewsEvidenceDesk mode="nsub" />');
    expect(hub).toContain('[&>div]:pointer-events-none [&>div]:select-none');
  });
});
