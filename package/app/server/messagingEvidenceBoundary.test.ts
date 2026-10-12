import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('communications evidence boundary', () => {
  it('does not generate synthetic messages and defaults to a truthful empty communication state', () => {
    const panel = read('client/src/components/MessagingPanel.tsx');
    const desk = read('client/src/components/comms/CommunicationsEvidenceDesk.tsx');
    expect(panel).toContain('<CommunicationsEvidenceDesk title={title} />');
    expect(panel).not.toContain('generateMessage');
    expect(panel).not.toContain('setInterval');
    expect(panel).toContain('data-messaging-historical-boundary="true"');
    expect(panel).toContain('pointer-events-none select-none');
    expect(desk).toContain('当前终端没有接入用户消息、成员目录、频道权限');
    expect(desk).toContain('暂无可验证通讯记录');
  });
});
