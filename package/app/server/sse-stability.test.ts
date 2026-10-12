import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const serverSse = readFileSync(resolve(root, 'server/uploadAndSse.ts'), 'utf8');
const clientSse = readFileSync(resolve(root, 'client/src/hooks/useSSENotifications.ts'), 'utf8');

describe('SSE 通知资源治理', () => {
  it('限制同一账户连接数，并在异常写入、关闭或中止时清理计时器与连接', () => {
    ['MAX_SSE_CLIENTS_PER_USER = 3', 'removeSseClient', 'sseKeepAlives', 'res.on("close", cleanup)', 'req.on("aborted", cleanup)', 'res.on("error", cleanup)'].forEach((marker) => expect(serverSse).toContain(marker));
  });

  it('避免客户端在卸载或已存在连接时重复建立 SSE 重连循环', () => {
    ['disposedRef', 'disposedRef.current || esRef.current', 'esRef.current !== es', 'reconnectTimerRef.current = null'].forEach((marker) => expect(clientSse).toContain(marker));
  });
});
