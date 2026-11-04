(() => {
  const store = window.__store = {}; const listeners = []; window.__writes = 0;
  const snap = () => ({ docs: Object.entries(store).map(([id, v]) => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(v)), metadata: {} })), metadata: { fromCache: false, hasPendingWrites: false }, empty: !Object.keys(store).length, size: Object.keys(store).length });
  const notify = () => setTimeout(() => listeners.forEach(f => f(snap())), 30);
  window.__extSet = (id, v) => { store[id] = v; notify(); };
  const col = path => ({
    onSnapshot(next) { if (path === 'family') { listeners.push(next); setTimeout(() => next(snap()), 50); } return () => {}; },
    async get() { return { docs: [], empty: true, size: 0 }; },
    doc(id) { return { async set(v) { window.__writes++; store[id] = v; notify(); }, async delete() { delete store[id]; notify(); } }; },
  });
  const db = { collection: col };
  const user = { id: async () => 'u_test1', can: async () => true, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: i === 'u_mum' ? '陳太' : '' }])), isOwner: async () => true };
  const sample = Object.assign(async () => ({ text: '{}' }), { limits: async () => ({ images: true }) });
  window.claude = { use: async n => n === 'db' ? db : n === 'user' ? user : n === 'sample' ? sample : null };
})();
