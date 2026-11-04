(() => {
  const P = '__mdb:'; const ch = new BroadcastChannel('mdb'); const ls = [];
  const snap = () => { const docs = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P)) { const v = JSON.parse(localStorage.getItem(k)); docs.push({ id: k.slice(P.length), exists: true, data: () => JSON.parse(JSON.stringify(v)) }); } } return { docs, metadata: { fromCache: false, hasPendingWrites: false } }; };
  const fire = () => setTimeout(() => ls.forEach(f => f(snap())), 10);
  ch.onmessage = fire;
  const col = { onSnapshot(next) { ls.push(next); setTimeout(() => next(snap()), 30); return () => {}; }, get: async () => ({ docs: [] }),
    doc: id => ({ set: async v => { await new Promise(r => setTimeout(r, 5 + Math.random() * 40)); localStorage.setItem(P + id, JSON.stringify(v)); fire(); ch.postMessage(1); },
                  delete: async () => { await new Promise(r => setTimeout(r, 5)); localStorage.removeItem(P + id); fire(); ch.postMessage(1); } }) };
  const uid = 'u_' + (new URLSearchParams(location.search).get('u') || 'x');
  window.claude = { use: async n => n === 'db' ? { collection: () => col } : n === 'user' ? { id: async () => uid, can: async () => true, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: '' }])) } : null };
})();
