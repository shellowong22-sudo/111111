import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { registerAIMWebSocket } from './aimWebSocket';

describe('AIM WebSocket production boundary', () => {
  it('returns an empty snapshot and does not accept order commands by default', async () => {
    const server = createServer();
    registerAIMWebSocket(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server address unavailable');
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws/aim`);
    const snapshot = await new Promise<unknown>((resolve, reject) => {
      ws.once('message', (raw) => resolve(JSON.parse(raw.toString())));
      ws.once('error', reject);
    });
    expect(snapshot).toMatchObject({ type: 'ORDER_SNAPSHOT', payload: [] });
    ws.send(JSON.stringify({ type: 'NEW_ORDER', payload: { symbol: 'FAKE' } }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }, 5000);
});
