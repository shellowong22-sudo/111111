import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('信用债 SEC 证据与 OAS 阈值提醒契约', () => {
  it('持久化高亮摘录、共享授权、审计事件和幂等阈值通知，不存储整份 SEC 文件', () => {
    const schema = read('drizzle/schema.ts');
    expect(schema).toContain('creditEvidenceLogs');
    expect(schema).toContain('quotedText');
    expect(schema).toContain('creditEvidenceShares');
    expect(schema).toContain('creditEvidenceAuditEvents');
    expect(schema).toContain('creditOasThresholdRules');
    expect(schema).toContain('creditOasThresholdNotificationEvents');
    expect(schema).not.toContain('documentBytes');
  });

  it('仅接受 SEC Archives 原始文件作为高亮证据来源，并以当前账户规则评估阈值', () => {
    const router = read('server/routers/creditResearch.ts');
    expect(router).toContain("url.hostname === 'www.sec.gov'");
    expect(router).toContain("url.pathname.startsWith('/Archives/edgar/')");
    expect(router).toContain('evaluateMyOasThresholds');
    expect(router).toContain('processCreditOasThresholdNotifications(snapshot.series, ctx.user.id)');
    expect(router).toContain('pushNotificationToUser');
  });

  it('使用规则和观察日去重，并尊重市场提醒偏好', () => {
    const db = read('server/db.ts');
    expect(db).toContain('credit-oas:${rule.id}:${observation.id}:${observationDate}');
    expect(db).toContain('preference && !preference.marketAlerts');
    expect(db).toContain('targetUserId ? and(');
  });

  it('前端提供阈值管理、即时检查、证据高亮、团队共享和审计日志入口', () => {
    const thresholdPanel = read('client/src/components/credit/CreditOasThresholdRules.tsx');
    const evidencePanel = read('client/src/components/credit/CreditEvidencePanel.tsx');
    expect(thresholdPanel).toContain('OAS 阈值提醒');
    expect(thresholdPanel).toContain('立即检查');
    expect(thresholdPanel).toContain('evaluateMyOasThresholds');
    expect(evidencePanel).toContain('保存高亮证据');
    expect(evidencePanel).toContain('团队共享');
    expect(evidencePanel).toContain('审计日志');
  });

  it('后台提醒回调评估所有启用 OAS 规则，并通过 SSE 推送在线账户', () => {
    const index = read('server/_core/index.ts');
    expect(index).toContain('registerUploadAndSse(app)');
    expect(index).toContain('getCreditOasSnapshot()');
    expect(index).toContain('processCreditOasThresholdNotifications(creditOasSnapshot.series)');
    expect(index).toContain('pushNotificationToUser(notification.userId, notification)');
  });
});
