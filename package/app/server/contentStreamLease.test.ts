import { describe, expect, it } from 'vitest';
import { acquireContentStreamLease } from '../client/src/lib/contentStreamLease';

function originLocks() {
  const held = new Set<string>();
  const locks = { async request(name: string, _options: unknown, callback: (lock: object | null) => Promise<void>) {
    if (held.has(name)) return callback(null);
    held.add(name);
    try { await callback({name}); } finally { held.delete(name); }
  } } as unknown as LockManager;
  return { held, locks };
}
describe('content streams across browser tabs', () => {
  it('allows only two of eight tabs to hold persistent sockets and returns polling fallback to the others', async () => {
    const { locks, held } = originLocks();
    const controllers = Array.from({length: 8}, () => new AbortController());
    const leases = await Promise.all(controllers.map(c => acquireContentStreamLease(c.signal, locks)));
    expect(leases.filter(Boolean)).toHaveLength(2);
    expect(held.size).toBe(2);
    controllers.forEach(c => c.abort());
    await Promise.resolve(); await Promise.resolve();
    expect(held.size).toBe(0);
  });
  it('releases on close and lets a waiting tab reacquire without sharing content', async () => {
    const { locks } = originLocks();
    const a = new AbortController(); const b = new AbortController();
    const first = await acquireContentStreamLease(a.signal, locks);
    const second = await acquireContentStreamLease(b.signal, locks);
    expect(await acquireContentStreamLease(new AbortController().signal, locks)).toBeNull();
    first!(); await Promise.resolve(); await Promise.resolve();
    const next = await acquireContentStreamLease(new AbortController().signal, locks);
    expect(next).not.toBeNull(); next!(); second!();
  });
  it('never opens a socket after unmount or when locks are unsupported', async () => {
    const { locks, held } = originLocks();
    const controller = new AbortController();
    const pending = acquireContentStreamLease(controller.signal, locks); controller.abort();
    expect(await pending).toBeNull();
    expect(await acquireContentStreamLease(controller.signal, locks)).toBeNull();
    expect(await acquireContentStreamLease(new AbortController().signal, null as never)).toBeNull();
    expect(held.size).toBe(0);
  });
});
