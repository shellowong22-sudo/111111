import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('communications hub evidence boundary', () => {
  it('defaults to verified empty communications and isolates fixed messages, members, posts and files', () => {
    const source = read('client/src/pages/CommunicationsHub.tsx');
    expect(source).toContain("import CommunicationsEvidenceDesk from '@/components/comms/CommunicationsEvidenceDesk'");
    expect(source).toContain('<CommunicationsEvidenceDesk title="通讯与社区中心" />');
    expect(source).toContain('function HistoricalCommunicationsHub()');
    expect(source).toContain('data-communications-historical-boundary="true"');
    expect(source).toContain('showHistorical && <div className="pointer-events-none select-none');
  });
});
