(() => {
  localStorage.setItem('wokzai-fb', JSON.stringify({ c: { apiKey: 'AIzaTEST', projectId: 'wz-test', appId: '1:1:web:1' }, f: 'testfamilycode1234567890' }));
  const store = window.__fs = {}; const ls = []; window.__fsWrites = 0;
  const wrapSnap = () => ({ docs: Object.entries(store).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)) })), metadata: { fromCache: false, hasPendingWrites: false } });
  const notify = () => setTimeout(() => ls.forEach(f => f(wrapSnap())), 20);
  window.__fsExt = (id, v) => { store[id] = v; notify(); };
  const col = { onSnapshot(opts, next) { ls.push(next); setTimeout(() => next({ docs: [], metadata: { fromCache: true } }), 10); setTimeout(() => next(wrapSnap()), 60); return () => {}; },
    doc: id => ({ set: async v => { if (JSON.stringify(v).includes('undefined')) throw new Error('undef'); window.__fsWrites++; store[id] = v; notify(); }, delete: async () => { delete store[id]; notify(); } }),
    get: async () => wrapSnap() };
  const fs = { enablePersistence: () => Promise.resolve(), collection: n => ({ doc: f => { window.__famPath = n + '/' + f; return { collection: () => col }; } }) };
  window.firebase = { apps: [], initializeApp: c => { window.__fbCfg = c; const app = { firestore: () => fs }; window.firebase.apps.push(app); return app; }, app: () => window.firebase.apps[0], firestore: () => fs };
})();
