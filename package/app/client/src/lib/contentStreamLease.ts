/** Reserve HTTP/1 connection capacity across tabs. No lock support means polling.
 * Locks contain no user data and are released automatically when a tab exits.
 */
export async function acquireContentStreamLease(signal: AbortSignal, locks = globalThis.navigator?.locks): Promise<(() => void) | null> {
  if (!locks || signal.aborted) return null;
  for (let slot = 0; slot < 2; slot += 1) {
    const lease = await new Promise<(() => void) | null>(resolve => {
      void locks.request(`terminal-content-stream-${slot}`, { ifAvailable: true }, async lock => {
        if (!lock || signal.aborted) { resolve(null); return; }
        await new Promise<void>(done => {
          const release = () => { signal.removeEventListener('abort', release); done(); };
          signal.addEventListener('abort', release, { once: true });
          resolve(release);
        });
      }).catch(() => resolve(null));
    });
    if (lease) {
      if (signal.aborted) { lease(); return null; }
      return lease;
    }
    if (signal.aborted) return null;
  }
  return null;
}
