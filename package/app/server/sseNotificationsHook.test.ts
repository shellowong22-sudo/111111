import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'client/src/hooks/useSSENotifications.ts'), 'utf8');

describe('SSE notification connection lifecycle', () => {
  it('does not early-return solely because an existing EventSource must be closed', () => {
    expect(source).toContain('if (!user || disposedRef.current) return;');
    expect(source).not.toContain('if (!user || disposedRef.current || esRef.current) return;');
    expect(source).toContain('if (esRef.current) {\n      esRef.current.close();');
  });
});
