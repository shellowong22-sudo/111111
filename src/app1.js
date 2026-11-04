/* ===== 基本工具 ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function dkey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseD(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
const TODAY = () => dkey(new Date());
const WD = ['日', '一', '二', '三', '四', '五', '六'];
function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
function daysLeft(exp) { return daysBetween(TODAY(), exp); }
function fmtDay(k) { const d = parseD(k); return `${d.getMonth() + 1}月${d.getDate()}日（星期${WD[d.getDay()]}）`; }
function weekStart(k) { const d = parseD(k); return addDays(d, -((d.getDay() + 6) % 7)); }
function weekKeys(k) { const s = weekStart(k); return [0, 1, 2, 3, 4, 5, 6].map(i => dkey(addDays(s, i))); }
function hashRand(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
function fmtQ(q) {
  if (!q) return '';
  if (q >= 10) return String(Math.round(q));
  const r = Math.round(q * 4) / 4, i = Math.floor(r), f = r - i;
  const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[f];
  if (r === 0) return String(Math.round(q * 100) / 100);
  return fr ? (i ? i : '') + fr : String(i);
}
function qtyText(ing, factor = 1) {
  if (!ing.q) return ing.u && ing.u !== '適量' ? `適量（${ing.u}）` : '適量';
  return `${fmtQ(ing.q * factor)} ${ing.u || ''}`.trim();
}
const LV = { 1: '易', 2: '中', 3: '難' };
const MEALS = { b: '早餐', l: '午餐', d: '晚餐' };
const MEAL_ICON = { b: 'tea', l: 'noodles', d: 'rice' };

/* 線條小圖示 */
const LI = {
  home: '<path d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4Z"/>',
  book: '<path d="M4 5 Q8 3 12 6 Q16 3 20 5 V19 Q16 17 12 20 Q8 17 4 19Z"/><path d="M12 6 V20"/>',
  ai: '<path d="M12 3 L14 9 L20 11 L14 13 L12 19 L10 13 L4 11 L10 9Z"/><path d="M19 3 v4 M17 5 h4"/>',
  plan: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7"/>',
  cart: '<path d="M3 4 H6 L8 15 H18 L20 7 H7"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
  chart: '<path d="M4 20 V10 M10 20 V5 M16 20 V13 M3 20 H21"/>',
  tools: '<circle cx="12" cy="13" r="7"/><path d="M12 13 V9 M12 13 L15 15 M10 3 H14"/>',
  plus: '<path d="M12 5 V19 M5 12 H19"/>', x: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
  edit: '<path d="M4 20 L8 19 L19 8 L16 5 L5 16Z M14 7 L17 10"/>',
  trash: '<path d="M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7"/>',
  heart: '<path d="M12 20 Q3 13 4 8 Q5 4 9 4 Q11 4 12 6.5 Q13 4 15 4 Q19 4 20 8 Q21 13 12 20Z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M5 15 H4 V4 H15 V5"/>',
  play: '<path d="M8 5 L19 12 L8 19Z"/>', pause: '<path d="M8 5 V19 M16 5 V19"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16 L20 20"/>',
  cam: '<path d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  left: '<path d="M15 5 L8 12 L15 19"/>', right: '<path d="M9 5 L16 12 L9 19"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8 V12 L15 14"/>',
  fire: '<path d="M12 3 Q17 9 16 13 Q18 12 18 10 Q21 16 17 19 Q12 22 7 19 Q3 15 7 10 Q8 13 10 13 Q8 8 12 3Z"/>',
  people: '<circle cx="9" cy="9" r="3.5"/><path d="M3 20 Q3 14 9 14 Q15 14 15 20"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14 Q21 14 21 19"/>',
  pot: '<path d="M4 10 H20 V17 Q20 20 17 20 H7 Q4 20 4 17Z M2 10 H22 M9 6 Q10 4 9 2 M14 6 Q15 4 14 2"/>',
  shuffle: '<path d="M4 7 H8 L16 17 H20 M4 17 H8 L10 14.5 M14 9.5 L16 7 H20 M18 5 L20 7 L18 9 M18 15 L20 17 L18 19"/>',
  check: '<path d="M5 12 L10 17 L19 7"/>',
};
function li(k, cls = '') { return `<svg class="${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LI[k]}</svg>`; }

/* ===== 狀態 ===== */
let S = demoState();
const RT = { hideHave: (() => { try { return localStorage.getItem('wokzai-hidehave') === '1'; } catch (e) { return false; } })(), me: '', pnames: {}, view: 'home', planDay: TODAY(), recFilter: 'all', recType: '', recQ: '', recSort: 'new', wheelSrc: 'all', statsTable: {}, timers: [], ready: false, pending: false, detail: null };
const LS_KEY = 'wokzai-recipes-v1';

function getRecipe(id) { return S.recipes.find(r => r.id === id) || LIB_MAP[id] || null; }
function allRecipes() { return [...S.recipes, ...LIB]; }
function isFav(id) { return S.favs.includes(id); }
function dayPlan(k) { const p = S.plan[k] || {}; return { b: p.b || [], l: p.l || [], d: p.d || [] }; }
function dayIds(k) { const p = dayPlan(k); return [...p.b, ...p.l, ...p.d].filter(getRecipe); }
function nameMatch(a, b) { return a === b || (b.length >= 2 && a.includes(b)) || (a.length >= 2 && b.includes(a)); }
function inPantry(n) { return S.pantry.some(p => nameMatch(n, p.n)); }
function mainIngs(r) { return r.ings.filter(i => !['sauce', 'water'].includes(i.cat || ingInfo(i.n).cat)); }
function ingIcons(r, n = 5) { const out = []; for (const i of r.ings) { const ic = ingInfo(i.n).icon; if (!['water', 'sauce', 'basket'].includes(ic) && !out.includes(ic)) out.push(ic); if (out.length >= n) break; } return out; }
function srcPill(r) {
  if (r.demo) return '<span class="pill sun">示範</span>';
  if (r.src === 'ai') return '<span class="pill ink">AI 整</span>';
  if (r.src === 'me') return '<span class="pill mint">我嘅</span>';
  return '';
}
function illHTML(r, cls = '') {
  return `<div class="ill ${cls}" style="background:${iconBg(r.icon)}">${r.photo ? `<img src="${esc(r.photo)}" alt="${esc(r.name)}">` : iconSVG(r.icon)}<span class="src">${srcPill(r)}</span></div>`;
}
function dishIc(r) { return `<span class="ic" style="background:${iconBg(r.icon)}">${r.photo ? `<img src="${esc(r.photo)}" alt="">` : iconSVG(r.icon)}</span>`; }

/* ===== 資料清洗：分享碼、備份、雲端資料都當係外來資料處理 ===== */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function cStr(v, n) { return typeof v === 'string' ? v.slice(0, n) : (v == null ? '' : String(v).slice(0, n)); }
function cNum(v, a, b, d) { v = Number(v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; }
function memberKey(mid) { if (SAFE_ID.test(mid)) return mid; let h = 2166136261; for (const ch of String(mid)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return 'h' + (h >>> 0).toString(36); }
function cleanRecipe(r) {
  if (!r || typeof r !== 'object' || !SAFE_ID.test(r.id)) return null;
  const name = cStr(r.name, 40).trim(); if (!name) return null;
  const ings = (Array.isArray(r.ings) ? r.ings : []).slice(0, 40).map(i => { const n = cStr(i && i.n, 30).trim(); const c = i && i.cat; return { n, q: cNum(i && i.q, 0, 100000, 0), u: cStr(i && i.u, 10), cat: (CATS[c] || c === 'water') ? c : ingInfo(n).cat }; }).filter(i => i.n);
  if (!ings.length) return null;
  const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, 30).map(s => typeof s === 'string' ? { t: s.slice(0, 400), min: 0 } : { t: cStr(s && s.t, 400), min: cNum(s && s.min, 0, 1440, 0) }).filter(s => s.t);
  const o = { id: r.id, name, icon: ICONS[r.icon] && r.icon !== 'wok' ? r.icon : 'plate', type: TYPES[r.type] ? r.type : 'veg', cuisine: CUISINES.includes(r.cuisine) ? r.cuisine : '家常',
    time: Math.round(cNum(r.time, 1, 1440, 20)), level: Math.round(cNum(r.level, 1, 3, 1)), servings: Math.round(cNum(r.servings, 1, 100, 2)),
    kcal: Math.round(cNum(r.kcal, 0, 5000, 0)), p: Math.round(cNum(r.p, 0, 500, 0)), c: Math.round(cNum(r.c, 0, 800, 0)), f: Math.round(cNum(r.f, 0, 500, 0)),
    tags: (Array.isArray(r.tags) ? r.tags : []).slice(0, 6).map(t => cStr(t, 10)).filter(Boolean), desc: cStr(r.desc, 200), tips: cStr(r.tips, 300),
    src: r.src === 'ai' ? 'ai' : 'me', created: cNum(r.created, 0, 1e15, 0), by: cStr(r.by, 80), demo: !!r.demo, ings, steps: steps.length ? steps : [{ t: '照自己習慣煮', min: 0 }] };
  if (typeof r.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.photo) && r.photo.length < 400000) o.photo = r.photo;
  return o;
}
function cleanItem(i, kind) {
  if (!i || typeof i !== 'object') return null;
  const n = cStr(i.n, 30).trim(); if (!n) return null;
  const o = { id: SAFE_ID.test(i.id) ? i.id : uid(kind === 'shop' ? 's' : 'p'), n, q: cNum(i.q, 0, 100000, 0), u: cStr(i.u, 10), by: cStr(i.by, 80) };
  if (i.demo) o.demo = true;
  if (kind === 'shop') { o.cat = CATS[i.cat] ? i.cat : (CATS[ingInfo(n).cat] ? ingInfo(n).cat : 'other'); o.done = !!i.done; o.doneBy = cStr(i.doneBy, 80); o.from = (Array.isArray(i.from) ? i.from : []).slice(0, 10).map(x => cStr(x, 40)).filter(Boolean); o.t = cNum(i.t, 0, 1e15, 0); if (Array.isArray(i.keys)) o.keys = i.keys.filter(x => typeof x === 'string').slice(0, 60).map(x => x.slice(0, 120)); }
  else o.exp = DATE_RE.test(i.exp) ? i.exp : '';
  return o;
}
function cleanDay(v) { const o = {}; for (const m of ['b', 'l', 'd']) o[m] = (Array.isArray(v && v[m]) ? v[m] : []).filter(x => typeof x === 'string' && SAFE_ID.test(x)).slice(0, 20); return o; }
function cleanMember(v) { return v && typeof v === 'object' ? { name: cStr(v.name, 12), icon: ICONS[v.icon] && v.icon !== 'wok' ? v.icon : 'bun', t: cNum(v.t, 0, 1e15, 0) } : null; }
function cleanLog(a) { return (Array.isArray(a) ? a : []).slice(0, 1000).filter(e => e && DATE_RE.test(e.d) && SAFE_ID.test(e.id)).map(e => ({ d: e.d, id: e.id, by: cStr(e.by, 80) })); }
function cleanSettings(v) { v = v && typeof v === 'object' ? v : {}; return { ...DEF_SETTINGS, people: Math.round(cNum(v.people, 1, 20, 2)), kcalRef: cNum(v.kcalRef, 500, 5000, 2000), avoid: cStr(v.avoid, 80), note: cStr(v.note, 80), demoCleared: !!v.demoCleared, ...(v.demoPlan && typeof v.demoPlan === 'object' ? { demoPlan: Object.fromEntries(Object.entries(v.demoPlan).filter(([k]) => DATE_RE.test(k)).map(([k, d]) => [k, cleanDay(d)])) } : {}), ...(Array.isArray(v.demoFavs) ? { demoFavs: v.demoFavs.filter(x => typeof x === 'string' && SAFE_ID.test(x)) } : {}) }; }
function cleanState(d) {
  d = d && typeof d === 'object' ? d : {};
  const s = { recipes: [], favs: [], plan: {}, shop: [], pantry: [], members: {}, log: {}, settings: cleanSettings(d.settings), demo: false };
  s.recipes = (Array.isArray(d.recipes) ? d.recipes : []).map(cleanRecipe).filter(Boolean).sort((a, b) => (b.created || 0) - (a.created || 0));
  s.shop = (Array.isArray(d.shop) ? d.shop : []).map(i => cleanItem(i, 'shop')).filter(Boolean).map((i, k) => ({ ...i, t: i.t || k + 1 })).sort((a, b) => a.t - b.t);
  s.pantry = (Array.isArray(d.pantry) ? d.pantry : []).map(i => cleanItem(i, 'pantry')).filter(Boolean);
  s.favs = (Array.isArray(d.favs) ? d.favs : []).filter(x => typeof x === 'string' && SAFE_ID.test(x));
  for (const [k, v] of Object.entries(d.plan && typeof d.plan === 'object' ? d.plan : {})) if (DATE_RE.test(k)) s.plan[k] = cleanDay(v);
  for (const [k, v] of Object.entries(d.members && typeof d.members === 'object' ? d.members : {})) { const m = cleanMember(v); if (m) s.members[k] = m; }
  for (const [k, v] of Object.entries(d.log && typeof d.log === 'object' ? d.log : {})) if (/^\d{4}-\d{2}$/.test(k)) s.log[k] = cleanLog(v);
  return s;
}

/* ===== 儲存：雲端家庭共用（即時同步）／本機 ===== */
const FAM = 'family';
const DEF_SETTINGS = { people: 2, kcalRef: 2000, avoid: '', note: '' };
function sortKeys(v) { if (Array.isArray(v)) return v.map(sortKeys); if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { if (v[k] !== undefined) o[k] = sortKeys(v[k]); }); return o; } return v; }
const stable = v => JSON.stringify(sortKeys(v));
const clone = v => JSON.parse(JSON.stringify(v));
function localMid() { try { let m = localStorage.getItem('wokzai-mid'); if (!m) { m = 'd_' + uid(); localStorage.setItem('wokzai-mid', m); } return m; } catch (e) { return 'd_' + uid(); } }
function stateDocs() {
  const o = { meta: { v: 2, favs: S.favs, settings: S.settings } };
  S.recipes.forEach(r => o['r-' + r.id] = r);
  S.shop.forEach(i => o['shop-' + i.id] = i);
  S.pantry.forEach(p => o['pantry-' + p.id] = p);
  for (const [k, v] of Object.entries(prunePlan(S.plan))) for (const m of ['b', 'l', 'd']) { const seen = {}; (v[m] || []).forEach((rid, i) => { const n = seen[rid] || 0; seen[rid] = n + 1; o[`pe-${k}-${m}-${rid}-${n}`] = { d: k, m, id: rid, o: i }; }); }
  for (const [m, v] of Object.entries(S.members || {})) o['member-' + memberKey(m)] = { ...v, mid: m };
  for (const [m, items] of Object.entries(S.log || {})) if (items.length) o['log-' + m] = { items };
  return o;
}
function stateFromDocs(docs) {
  const raw = { recipes: [], favs: [], plan: {}, shop: [], pantry: [], members: {}, log: {}, settings: {} }; const pe = {};
  for (const [id, v] of Object.entries(docs)) {
    if (!v || typeof v !== 'object') continue;
    if (id === 'meta') { raw.favs = v.favs; raw.settings = v.settings; }
    else if (id.startsWith('r-')) raw.recipes.push(v);
    else if (id.startsWith('shop-')) raw.shop.push(v);
    else if (id.startsWith('pantry-')) raw.pantry.push(v);
    else if (id.startsWith('pe-')) { if (DATE_RE.test(v.d) && ['b', 'l', 'd'].includes(v.m) && typeof v.id === 'string') (pe[v.d + '|' + v.m] = pe[v.d + '|' + v.m] || []).push(v); }
    else if (id.startsWith('plan-')) raw.plan[id.slice(5)] = v;
    else if (id.startsWith('member-')) raw.members[typeof v.mid === 'string' && v.mid ? v.mid : id.slice(7)] = v;
    else if (id.startsWith('log-')) raw.log[id.slice(4)] = v.items;
  }
  for (const [key, list] of Object.entries(pe)) { const [d, m] = key.split('|'); const day = raw.plan[d] = raw.plan[d] || { b: [], l: [], d: [] }; day[m] = [...(Array.isArray(day[m]) ? day[m] : []), ...list.sort((a, b) => (a.o || 0) - (b.o || 0) || String(a.id).localeCompare(String(b.id))).map(e => e.id)]; }
  return cleanState(raw);
}
const LIM = { n: 0, max: 4, wait: [] };
function limited(fn) { return new Promise((res, rej) => { const run = () => { LIM.n++; Promise.resolve().then(fn).then(res, rej).finally(() => { LIM.n--; const w = LIM.wait.shift(); if (w) w(); }); }; if (LIM.n < LIM.max) run(); else LIM.wait.push(run); }); }
const Store = {
  mode: 'memory', kind: 'local', db: null, user: null, uid: null, canWrite: null, chain: {}, known: {}, docs: {}, loaded: false, live: false, lt: null,
  async init() {
    let cl = window.claude; const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
    for (let i = 0; i < 15 && framed && !(cl && cl.use); i++) { await sleep(100); cl = window.claude; }
    if (cl && cl.use) {
      this.kind = 'claude';
      try {
        const [db, user] = await Promise.all([cl.use('db'), cl.use('user')]);
        this.db = db; this.user = user;
        if (user) { this.uid = await user.id(); try { this.canWrite = await user.can('data.write'); } catch (e) { this.canWrite = null; } }
        if (db) this.mode = 'db';
      } catch (e) { /* 冇雲端就用本機 */ }
    } else {
      const fb = fbCfgLoad();
      if (fb) {
        try { await loadFirebase(); this.db = fbAdapter(fb); this.fam = fb; this.kind = 'firebase'; this.mode = 'db'; }
        catch (e) { RT.fbErr = true; }
      }
    }
    if (this.mode !== 'db') {
      this.kind = 'local';
      try { localStorage.setItem('wz-t', '1'); localStorage.removeItem('wz-t'); this.mode = 'local'; } catch (e) { this.mode = 'memory'; }
    }
    RT.me = this.uid || localMid();
  },
  col() { return this.db.collection(FAM); },
  subscribe(cb) {
    const timer = setTimeout(() => { if (!this.live) cb(null, { timeout: true }); }, 10000);
    this.unsub = this.col().onSnapshot(snap => {
      const docs = {}; snap.docs.forEach(d => { if (d.exists) docs[d.id] = d.data(); });
      this.docs = docs; this.known = {}; for (const k in docs) this.known[k] = stable(docs[k]);
      if (!snap.metadata.fromCache) { this.live = true; clearTimeout(timer); }
      this.loaded = true; cb(docs, snap.metadata);
    }, err => { clearTimeout(timer); this.live = false; cb(null, { error: err }); });
  },
  async loadLocal() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  q(key, fn) {
    if (this.kind === 'firebase') { Promise.resolve().then(fn).then(() => setSync()).catch(e => { delete this.known[key]; handleSaveErr(e, key); }); return; }
    const prev = this.chain[key] || Promise.resolve(); const next = prev.then(() => limited(fn)).then(() => setSync()).catch(e => { delete this.known[key]; handleSaveErr(e, key); }); this.chain[key] = next; return next; },
  sync() {
    if (this.mode === 'local') { this.saveLocal(); return; }
    if (this.mode !== 'db') return;
    if (!this.loaded) { RT.pending = true; return; }
    if (this.canWrite === false) { toast('你而家只可以睇：要擁有人俾你編輯權限先改到'); if (Object.keys(this.docs).length) { S = stateFromDocs(this.docs); scheduleRefresh(); } return; }
    S = cleanState(S);
    const want = stateDocs();
    for (const id in want) { const js = stable(want[id]); if (this.known[id] !== js) { this.known[id] = js; const body = JSON.parse(js); this.q(id, () => this.col().doc(id).set(body)); } }
    for (const id of Object.keys(this.known)) { if (!(id in want)) { delete this.known[id]; this.q(id, () => this.col().doc(id).delete()); } }
  },
  saveLocal() {
    if (this.mode !== 'local') return;
    clearTimeout(this.lt); this.ltPending = true;
    this.lt = setTimeout(() => this.flushLocal(), 250);
  },
  flushLocal() {
    if (this.mode !== 'local' || !this.ltPending) return;
    clearTimeout(this.lt); this.ltPending = false;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ v: 2, init: true, favs: S.favs, plan: prunePlan(S.plan), shop: S.shop, pantry: S.pantry, settings: S.settings, members: S.members, log: S.log, recipes: S.recipes })); setSync(); }
    catch (e) { toast('呢部機儲存空間唔夠，試下刪走啲相片'); }
  },
};
function prunePlan(plan) { const lim = dkey(addDays(new Date(), -60)); const o = {}; for (const k in plan) if (k >= lim) o[k] = plan[k]; return o; }
function handleSaveErr(e, key = '') {
  const c = e && e.code;
  if (c === 'quota_exceeded') toast('儲存空間滿咗，刪走啲食譜或者相片先');
  else if (c === 'invalid_argument' && key.startsWith('r-')) toast('食譜存唔到：可能相片太大，試下換張細啲嘅');
  else if (c === 'invalid_argument') { Store.canWrite = false; toast(Store.kind === 'firebase' ? '同步服務唔俾寫入：檢查 Firestore 規則有冇貼啱' : '你冇權限改呢個家庭嘅資料（只可以睇）'); if (Object.keys(Store.docs).length) { S = stateFromDocs(Store.docs); scheduleRefresh(); } }
  else if (c === 'revoked') toast('儲存權限已經停咗');
  else toast('儲存出錯，等陣再試');
  setSync('err');
}
function normalize(d) { return cleanState(d); }
function save() { if (S.demo) S.demo = false; Store.sync(); refresh(); }
let rfH = null;
function scheduleRefresh() { if (rfH) return; rfH = requestAnimationFrame(() => { rfH = null; refresh(); rerenderDetail(); if (typeof updateFamSheet === 'function') updateFamSheet(); }); }
async function maybeMigrate() {
  if (Store.mode !== 'db' || !Store.uid || Store.canWrite === false) return false;
  try {
    const snap = await Store.db.collection('data/users/' + Store.uid).get();
    let meta = null; const recipes = [];
    snap.docs.forEach(d => { if (!d.exists) return; const v = clone(d.data()); if (d.id === 'meta') meta = v; else if (d.id.startsWith('r-')) recipes.push(v); });
    if (!meta && !recipes.length) return false;
    S = normalize({ ...(meta || {}), recipes }); Store.sync(); refresh();
    toast('已經將你之前嘅資料搬入家庭共用'); return true;
  } catch (e) { return false; }
}
function setSync(st) {
  const el = $('#sync'); if (!el) return;
  let t, c = '';
  if (st === 'err') { t = '儲存出錯'; c = 'warn'; }
  else if (!RT.ready) t = '載入緊…';
  else if (Store.mode === 'db') {
    if (Store.canWrite === false) { t = '家庭・只可以睇'; c = 'warn'; }
    else if (S.demo) { t = '示範資料'; c = 'warn'; }
    else if (Store.live) { t = '家庭即時同步'; c = 'ok live'; }
    else if (Store.kind === 'firebase' && Store.loaded) { t = '家庭・離線，會自動補上'; c = 'warn'; }
    else { t = '家庭・連線中'; c = 'warn'; }
  } else if (Store.mode === 'local') { t = '存喺呢部機'; c = 'warn'; }
  else { t = '暫時唔會儲存'; c = 'warn'; }
  el.textContent = t; el.className = 'sync ' + c; el.setAttribute('aria-label', t + '，撳開家庭共用設定');
}

/* 家庭成員 / 口味 */
function memberName(mid) { if (!mid) return ''; const m = (S.members || {})[mid]; if (m && m.name) return m.name; return RT.pnames[mid] || (mid === RT.me ? '你' : '屋企人'); }
function memberIcon(mid) { return (S.members || {})[mid]?.icon || 'bun'; }
function memberChip(mid, verb = '') { if (!mid) return ''; return `<span class="mchip"><span class="mav" style="background:${iconBg(memberIcon(mid))}">${iconSVG(memberIcon(mid))}</span>${esc(memberName(mid))}${esc(verb)}</span>`; }
function familyIds() {
  const ids = new Set(Object.keys(S.members || {}));
  [...S.shop, ...S.pantry, ...S.recipes].forEach(x => { if (x.by) ids.add(x.by); if (x.doneBy) ids.add(x.doneBy); });
  Object.values(S.log || {}).flat().forEach(e => e.by && ids.add(e.by));
  if (RT.me && Store.mode === 'db') ids.add(RT.me);
  return [...ids];
}
async function resolveNames() {
  if (!Store.user) return;
  const need = familyIds().filter(i => !i.startsWith('d_') && !(S.members || {})[i]?.name);
  if (!need.length) return;
  try { const ps = await Store.user.profiles(need); let ch = false; for (const i of need) { const n = ps[i]?.name || ''; if (n && RT.pnames[i] !== n) { RT.pnames[i] = n; ch = true; } } if (ch) scheduleRefresh(); } catch (e) { }
}
function avoidList() { return String(S.settings.avoid || '').split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean); }
function avoidHit(r) { const av = avoidList(); for (const a of av) if (r.name.includes(a) || r.ings.some(i => i.n.includes(a))) return a; return null; }
function familyLine() { const a = avoidList(), n = String(S.settings.note || '').trim(); return [a.length ? `屋企人唔食：${a.join('、')}（一定唔可以用）` : '', n ? `屋企口味：${n}` : ''].filter(Boolean).join('\n'); }
function logCooked(id) { const m = TODAY().slice(0, 7); S.log = S.log || {}; (S.log[m] = S.log[m] || []).push({ d: TODAY(), id, by: RT.me || '' }); save(); toast(`記低咗！今個月煮咗 ${S.log[m].length} 餐`); }

/* ===== 推薦 / 搭配 ===== */
function recommend(n = 8) {
  const wk = new Set(weekKeys(TODAY()).flatMap(dayIds));
  const expiring = S.pantry.filter(p => p.exp && daysLeft(p.exp) <= 2 && daysLeft(p.exp) >= 0);
  const day = TODAY();
  return allRecipes().filter(r => r.type !== 'dessert' && !avoidHit(r)).map(r => {
    const main = mainIngs(r); const have = main.filter(i => inPantry(i.n));
    const ratio = main.length ? have.length / main.length : 0;
    const usesExp = expiring.find(p => r.ings.some(i => nameMatch(i.n, p.n)));
    const score = ratio * 60 + (usesExp ? 25 : 0) + (r.time <= 20 ? 8 : 0) + (isFav(r.id) ? 6 : 0) - (wk.has(r.id) ? 30 : 0) + hashRand(r.id + day) * 12;
    const why = [];
    if (usesExp) why.push(`用埋就快過期嘅${usesExp.n}`);
    if (have.length) why.push(`雪櫃有 ${have.length}/${main.length} 樣`);
    if (r.time <= 20) why.push(`${r.time} 分鐘搞掂`);
    if (!why.length) why.push('今日試下佢');
    return { r, score, why: why[0] };
  }).sort((a, b) => b.score - a.score).slice(0, n);
}
const PAIR_NEED = { meat: ['veg', 'soup', 'staple'], sea: ['veg', 'soup', 'meat'], veg: ['meat', 'sea', 'soup'], soup: ['meat', 'veg', 'sea'], staple: ['veg', 'soup'], dessert: ['dessert'] };
function pairings(base, ctxIds = [], n = 4) {
  const ctx = ctxIds.map(getRecipe).filter(Boolean);
  const haveTypes = new Set([base.type, ...ctx.map(r => r.type)]);
  const need = PAIR_NEED[base.type] || ['veg', 'soup'];
  const heavy = base.kcal >= 350 || (base.tags || []).includes('辣');
  return allRecipes().filter(r => r.id !== base.id && !ctxIds.includes(r.id) && !avoidHit(r)).map(r => {
    let s = 0; const why = [];
    const ni = need.indexOf(r.type);
    if (ni >= 0) s += 40 - ni * 8;
    if (haveTypes.has(r.type)) s -= 25;
    if (r.icon === base.icon) s -= 15;
    if (r.cuisine === base.cuisine) s += 6;
    if (r.type === 'soup' && !haveTypes.has('soup')) why.push('加碗湯潤一潤');
    else if (r.type === 'veg' && ['meat', 'sea'].includes(base.type)) why.push('有菜有肉');
    else if (['meat', 'sea'].includes(r.type) && ['veg', 'soup'].includes(base.type)) why.push('加個肉餸');
    else if (r.type === 'staple') why.push('配埋主食');
    if (heavy && r.kcal < 200) { s += 10; why.push('清清地平衡返'); }
    if (r.time <= 15) { s += 3; if (why.length < 2) why.push('快手'); }
    s += hashRand(r.id + base.id) * 4;
    return { r, s, why: why.slice(0, 2) };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n);
}
function autoPair(k, meal, opt = {}) {
  const ex = opt.exclude || new Set();
  const p = dayPlan(k); const ids = [...p[meal]]; const added = [];
  const want = meal === 'd' ? [['meat', 'sea'], ['veg'], ['soup']] : meal === 'l' ? [['staple', 'meat'], ['veg']] : [['staple'], ['dessert']];
  const types = () => ids.map(getRecipe).filter(Boolean).map(r => r.type);
  const ok = r => !ids.includes(r.id) && !ex.has(r.id) && !avoidHit(r);
  for (const grp of want) {
    if (types().some(t => grp.includes(t))) continue;
    let pick;
    if (ids.length) {
      const base = getRecipe(ids[0]); const pr = pairings(base, ids, 40);
      pick = allRecipes().filter(r => grp.includes(r.type) && ok(r))
        .map(r => ({ r, s: (pr.find(x => x.r.id === r.id)?.s || 0) + hashRand(r.id + k + meal) * 14 }))
        .sort((a, b) => b.s - a.s)[0]?.r;
    } else {
      const c = recommend(40).map(x => x.r).filter(r => grp.includes(r.type) && ok(r)).slice(0, 4);
      pick = c.sort((a, b) => hashRand(a.id + k) - hashRand(b.id + k))[0] || allRecipes().find(r => grp.includes(r.type) && ok(r));
    }
    if (!pick && ex.size) pick = allRecipes().filter(r => grp.includes(r.type) && !ids.includes(r.id) && !avoidHit(r)).sort((a, b) => hashRand(a.id + k) - hashRand(b.id + k))[0];
    if (pick) { ids.push(pick.id); added.push(pick.name); }
  }
  if (added.length) S.plan[k] = { ...dayPlan(k), [meal]: ids };
  if (opt.silent) return added;
  if (!added.length) { toast('呢餐已經好齊喇'); return added; }
  save(); toast('幫你配咗：' + added.join('、'));
  return added;
}
function autoWeek() {
  const wk = weekKeys(RT.planDay); const ex = new Set(wk.flatMap(dayIds)); let n = 0;
  for (const k of wk) { if (k < TODAY()) continue; const added = autoPair(k, 'd', { silent: true, exclude: ex }); dayPlan(k).d.forEach(id => ex.add(id)); n += added.length; }
  if (!n) { toast('呢個禮拜嘅晚餐已經排好晒'); return; }
  save(); toast(`幫你排咗 ${n} 個晚餐餸，一湯兩餸`);
}

/* ===== 購物清單 ===== */
function addIngsToShop(r, factor = 1, key = '') {
  let n = 0;
  for (const ing of r.ings) {
    const cat = ing.cat || ingInfo(ing.n).cat;
    if (cat === 'water') continue;
    const u = ing.u || ''; let q = ing.q ? Math.round(ing.q * factor * 100) / 100 : 0;
    if (q && /^(隻|個|條|粒|片|塊|棵|盒|罐|樽|包|扎|紮|束|碗|杯)$/.test(u)) q = Math.max(1, Math.ceil(q - 0.05));
    const it = S.shop.find(x => x.n === ing.n && (x.u || '') === u && !x.done);
    if (it) { it.q = Math.round(((it.q || 0) + q) * 100) / 100; if (!it.from.includes(r.name)) it.from.push(r.name); if (key) it.keys = [...(it.keys || []), key]; }
    else S.shop.push({ id: uid('s'), n: ing.n, q, u, cat: CATS[cat] ? cat : 'other', done: false, from: [r.name], by: RT.me || '', t: Date.now() + n, ...(key ? { keys: [key] } : {}) });
    n++;
  }
  return n;
}
function addDaysToShop(keys, silent) {
  const ppl = S.settings.people || 2; let dishes = 0, skipped = 0;
  const added = new Set(S.shop.flatMap(i => i.keys || []));
  for (const k of keys) { const seen = {}; for (const id of dayIds(k)) { const n = seen[id] || 0; seen[id] = n + 1; const key = `${k}|${id}|${n}`; if (added.has(key)) { skipped++; continue; } const r = getRecipe(id); addIngsToShop(r, ppl / (r.servings || ppl), key); added.add(key); dishes++; } }
  if (silent) return dishes;
  if (!dishes) { toast(skipped ? `呢 ${skipped} 個餸嘅材料已經喺清單，唔會重複加` : '呢段時間未有餸，去餐單加菜先'); return 0; }
  save(); toast(`已經將 ${dishes} 個餸嘅材料加入清單${skipped ? `（${skipped} 個加過咗，跳過）` : ''}`);
  return dishes;
}
function shopText() {
  const lines = ['鑊仔買餸清單'];
  for (const c of CAT_ORDER) {
    const items = S.shop.filter(i => i.cat === c && !i.done); if (!items.length) continue;
    lines.push(`【${CATS[c].label}】`);
    items.forEach(i => lines.push(`□ ${i.n} ${i.q ? fmtQ(i.q) + ' ' + i.u : (i.u || '')}`.trim()));
  }
  return lines.join('\n');
}

/* ===== 共用 UI ===== */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  const box = $('#toast'); box.appendChild(t); while (box.children.length > 2) box.firstElementChild.remove(); setTimeout(() => t.remove(), 2600);
}
function openSheet(title, html, { cls = '' } = {}) {
  const bd = document.createElement('div'); bd.className = 'backdrop';
  bd.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><h3>${esc(title)}</h3><button class="btn icon sm" data-act="closeSheet" aria-label="閂">${li('x')}</button></div><div class="body">${html}</div></div>`;
  bd.addEventListener('click', e => { if (e.target === bd) closeSheet(bd); });
  $('#sheets').appendChild(bd);
  setTimeout(() => bd.querySelector('.body button, .body input')?.focus({ preventScroll: true }), 50);
  return bd;
}
function closeSheet(bd) { bd = bd || $$('#sheets .backdrop').pop(); if (bd) { if (bd._onClose) bd._onClose(); bd.remove(); } }
function sheetOf(el) { return el.closest('.backdrop'); }
function stepper(act, val, label) { return `<span class="stepper" role="group" aria-label="${esc(label)}"><button data-act="${act}" data-d="-1" aria-label="減">−</button><span class="num">${val}</span><button data-act="${act}" data-d="1" aria-label="加">＋</button></span>`; }
function ringSVG(p, label) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - p);
  return `<svg class="ring" viewBox="0 0 84 84" role="img" aria-label="${esc(label)}"><circle cx="42" cy="42" r="${r}" fill="#fff" stroke="#e1f3f0" stroke-width="10"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--teal)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 42 42)"/><circle cx="42" cy="42" r="${r + 6}" fill="none" stroke="var(--ink)" stroke-width="2.5"/><text x="42" y="47" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="17" fill="#10393b">${Math.round(p * 100)}%</text></svg>`;
}
function recipeCard(r, extra = '') {
  const icons = ingIcons(r).map(k => `<span style="background:${iconBg(k)}">${iconSVG(k)}</span>`).join('');
  return `<div class="rcard" role="button" tabindex="0" data-act="open" data-id="${esc(r.id)}" style="position:relative">
    ${illHTML(r)}
    <button class="fav ${isFav(r.id) ? 'on' : ''}" data-act="fav" data-id="${esc(r.id)}" aria-pressed="${isFav(r.id)}" aria-label="收藏">${li('heart')}</button>
    <h4>${esc(r.name)}</h4>
    <div class="meta"><span class="row" style="gap:3px">${li('clock', 'mi')}${r.time} 分鐘</span><span class="row" style="gap:3px">${li('fire', 'mi')}${r.kcal || '–'} 大卡</span><span>${LV[r.level] || '易'}</span></div>
    ${extra}
    <div class="mini-ings">${icons}</div>
  </div>`;
}
function dishRow(r, k, meal, i) {
  return `<div class="dish">${dishIc(r)}<button class="plain" data-act="open" data-id="${esc(r.id)}"><div class="nm">${esc(r.name)}</div><div class="sub">${TYPES[r.type]?.label || ''} · ${r.time} 分鐘 · ${r.kcal || '–'} 大卡</div></button>
  <button class="btn icon sm x" data-act="planRm" data-k="${k}" data-m="${meal}" data-i="${i}" aria-label="由餐單移走 ${esc(r.name)}">${li('x')}</button></div>`;
}
function mealBlock(k, meal) {
  const ids = dayPlan(k)[meal];
  const rows = ids.map((id, i) => { const r = getRecipe(id); return r ? dishRow(r, k, meal, i) : ''; }).join('');
  return `<div class="meal"><div class="meal-h"><span style="width:30px;height:30px">${iconSVG(MEAL_ICON[meal])}</span>${MEALS[meal]}<span class="spacer"></span>
    <button class="btn sm" data-act="autoPair" data-k="${k}" data-m="${meal}">${li('shuffle')}搭配</button>
    <button class="btn sm sun" data-act="picker" data-k="${k}" data-m="${meal}">${li('plus')}加菜</button></div>
    ${rows || `<div class="small muted">未有餸，撳「加菜」或者「搭配」</div>`}</div>`;
}
function dayKcal(k) { return dayIds(k).reduce((s, id) => s + (getRecipe(id)?.kcal || 0), 0); }

/* ===== 分頁 ===== */
const VIEWS = [['home', '主頁', 'home'], ['recipes', '食譜', 'book'], ['ai', 'AI', 'ai'], ['plan', '餐單', 'plan'], ['shop', '清單', 'cart'], ['stats', '圖表', 'chart'], ['tools', '工具', 'tools']];
function renderTabs() {
  $('#tabs').innerHTML = `<div class="nav-brand">${iconSVG('wok')}鑊仔食譜</div>` +
    VIEWS.map(([v, l, ic]) => `<button class="tab" data-act="go" data-v="${v}" aria-label="${l}">${li(ic)}<span>${l}</span>${v === 'shop' ? '<span class="badge hide" id="shopBadge"></span>' : ''}</button>`).join('');
  $('#brandM').innerHTML = `${iconSVG('wok')}鑊仔食譜`;
}
function updateBadges() {
  $$('.tab').forEach(t => { const on = t.dataset.v === RT.view; t.classList.toggle('on', on); on ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current'); });
  const left = S.shop.filter(i => !i.done).length; const b = $('#shopBadge');
  if (b) { b.textContent = left; b.classList.toggle('hide', !left); }
}
function show(v, push = true) {
  if (!VIEWS.some(x => x[0] === v)) v = 'home';
  RT.view = v;
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  if (push && location.hash.slice(1) !== v) { try { history.replaceState(null, '', '#' + v); } catch (e) { location.hash = v; } }
  if (v === 'ai') renderAI(); else if (v === 'tools') renderTools(); else refresh();
  updateBadges();
  window.scrollTo({ top: 0 });
}
function refresh() {
  const v = RT.view; const view = $('#v-' + v); const act = document.activeElement;
  const keep = view ? $$('input[id],textarea[id],select[id]', view).filter(e => e.type !== 'file').map(e => [e.id, e.value]) : [];
  const fid = act && view && view.contains(act) && act.id ? act.id : null;
  let sel = null; try { sel = fid && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null; } catch (e) { }
  if (v === 'home') renderHome(); else if (v === 'recipes') renderRecipes(); else if (v === 'plan') renderPlan();
  else if (v === 'shop') renderShop(); else if (v === 'stats') renderStats(); else if (v === 'tools') { renderPantry(); renderScaler(); }
  for (const [id, val] of keep) { const e = document.getElementById(id); if (e && e.value !== val && e.tagName !== 'SELECT') e.value = val; }
  if (fid) { const e = document.getElementById(fid); if (e && document.activeElement !== e) { e.focus({ preventScroll: true }); if (sel) try { e.setSelectionRange(sel[0], sel[1]); } catch (er) { } } }
  updateBadges(); setSync();
}

/* ===== 主頁 ===== */
function greet() { const h = new Date().getHours(); return h < 5 ? '夜啦，食宵夜？' : h < 11 ? '早晨！' : h < 14 ? '午安！' : h < 18 ? '下晝好！' : '夜晚好！'; }
function showDemoBanner() { return !S.settings.demoCleared && (S.demo || S.recipes.some(r => r.demo)); }
const WHO = ['阿爸', '阿媽', '爺爺', '嫲嫲', '公公', '婆婆', '哥哥', '家姐', '細佬', '妹妹'];
const WHO_ICONS = ['bun', 'eggtart', 'tea', 'dumpling', 'pineapplebun', 'egg', 'tomato', 'corn', 'broccoli', 'shrimp'];
function famStrip() {
  if (!RT.ready) return '';
  if (Store.mode !== 'db') return RT.syncHint === false ? '' : `<button class="card row wrap" style="text-align:left;padding:10px 14px" data-act="famOpen"><span style="width:44px;height:44px;flex:none">${iconSVG('wok')}</span><div style="flex:1;min-width:150px"><b style="font-family:var(--f-display)">想同屋企人同步？</b><div class="small muted">用免費 Firebase 即時同步，或者用分享碼經 WhatsApp 傳</div></div><span class="btn sm sun">${li('people')}設定</span></button>`;
  if (Store.canWrite === false) return `<div class="card sun row wrap"><span style="width:44px;height:44px;flex:none">${iconSVG('wok')}</span><div style="flex:1;min-width:180px"><h4>你而家只可以睇</h4><div class="small muted">叫擁有人分享俾你時揀可以編輯，你就可以一齊剔清單、加菜。</div></div><button class="btn sm" data-act="famOpen">點樣設定</button></div>`;
  const ids = familyIds(); const me = (S.members || {})[RT.me];
  if (!me && !RT.whoLater) return `<div class="card tint"><div class="sec-h"><span class="ic" style="background:#fff">${iconSVG('bun')}</span><div><h3>你係屋企邊位？</h3><div class="small muted">揀咗之後，屋企人會見到邊個加咗、買咗乜</div></div></div>
    <div class="chips" style="margin-top:10px">${WHO.map((w, i) => `<button class="chip" data-act="whoPick" data-n="${w}" data-i="${WHO_ICONS[i]}">${iconSVG(WHO_ICONS[i])}${w}</button>`).join('')}<button class="chip" data-act="famOpen">${li('edit')}自己打</button></div>
    <button class="btn sm" style="margin-top:10px" data-act="whoLater">遲啲先</button></div>`;
  return `<button class="card row wrap" style="text-align:left;padding:10px 14px" data-act="famOpen"><span class="row" style="gap:0">${ids.slice(0, 6).map((id, i) => `<span class="mav lg" style="background:${iconBg(memberIcon(id))};margin-left:${i ? -8 : 0}px">${iconSVG(memberIcon(id))}</span>`).join('')}</span>
    <div style="flex:1;min-width:150px"><b style="font-family:var(--f-display)">屋企 ${ids.length} 位成員</b><div class="small muted">${Store.live ? '即時同步緊：一個人剔清單，全家都見到' : Store.kind === 'firebase' ? '離線中，改動會喺有網時自動同步' : '連線中…'}</div></div><span class="btn sm sun">${li('people')}邀請屋企人</span></button>`;
}
function renderHome() {
  const k = TODAY(); const ids = dayIds(k); const ppl = S.settings.people || 2;
  const left = S.shop.filter(i => !i.done).length, total = S.shop.length;
  const exp = S.pantry.filter(p => p.exp && daysLeft(p.exp) <= 2).length;
  const recs = recommend(8);
  $('#v-home').innerHTML = `
  <div class="card hero">
    <div style="position:relative;z-index:1">
      <h1>${greet()}<br>今日想煮乜？</h1>
      <p>${fmtDay(k)}・今日餐單有 <b class="num">${ids.length}</b> 個餸，${ppl} 個人食</p>
      <div class="row wrap"><button class="btn sun needs-ai" data-act="go" data-v="ai">${li('ai')}叫 AI 諗食譜</button><button class="btn sun only-no-ai" data-act="newRecipe">${li('plus')}記低新食譜</button><button class="btn" data-act="wheelGo">${li('shuffle')}今日食乜好</button></div>
    </div>
    <div class="mwrap">${iconSVG('wok', 'mascot')}</div>
    <span class="deco" style="right:6px;top:4px;transform:rotate(14deg)">${iconSVG('tomato')}</span>
    <span class="deco" style="right:122px;bottom:-6px;transform:rotate(-12deg)">${iconSVG('egg')}</span>
  </div>
  ${famStrip()}
  ${showDemoBanner() ? `<div class="card sun row wrap"><span style="width:44px;height:44px;flex:none">${iconSVG('basket')}</span><div style="flex:1;min-width:180px"><h4>而家見到嘅係示範資料</h4><div class="small muted">${S.demo ? '食譜、餐單、雪櫃都係例子，你一改就會開始儲存。' : '示範食譜、餐單同雪櫃例子仲喺度，唔要就清走佢。'}</div></div><button class="btn sm coral" data-act="clearDemo">清走示範資料</button><button class="btn sm" data-act="keepDemo">保留住先</button></div>` : ''}
  <div class="tiles">
    <button class="tile" data-act="go" data-v="stats"><span class="v">${dayKcal(k)}</span><span class="l">今日每人大約大卡</span></button>
    <button class="tile" data-act="go" data-v="shop"><span class="v">${left}<span class="small muted">/${total}</span></span><span class="l">清單未買</span></button>
    <button class="tile ${exp ? 'warn' : ''}" data-act="go" data-v="tools"><span class="v">${exp}</span><span class="l">雪櫃就快過期</span></button>
  </div>
  <div class="card">
    <div class="sec-h"><span class="ic" style="background:${iconBg('rice')}">${iconSVG('rice')}</span><h2>今日三餐</h2><div class="act"><button class="btn sm" data-act="go" data-v="plan">${li('plan')}成個禮拜</button></div></div>
    <div class="meals" style="margin-top:12px">${['b', 'l', 'd'].map(m => mealBlock(k, m)).join('')}</div>
  </div>
  <div class="card">
    <div class="sec-h"><span class="ic" style="background:${iconBg('salad')}">${iconSVG('salad')}</span><div><h2>推薦你煮</h2><div class="small muted">按雪櫃食材、就快過期嘢同煮食時間揀</div></div><div class="act"><button class="btn sm" data-act="go" data-v="recipes">睇晒</button></div></div>
    <div class="hscroll" style="margin-top:12px">${recs.map(x => recipeCard(x.r, `<span class="reason">${esc(x.why)}</span>`)).join('')}</div>
  </div>
  <div class="quick">
    <button class="qbtn" data-act="newRecipe">${iconSVG('plate')}記低食譜</button>
    <button class="qbtn needs-ai" data-act="photoGo">${iconSVG('basket')}影相認食材</button><button class="qbtn only-no-ai" data-act="pantryGo">${iconSVG('milk')}雪櫃管理</button>
    <button class="qbtn" data-act="timerGo">${iconSVG('egg')}計時器</button>
    <button class="qbtn" data-act="go" data-v="shop">${iconSVG('carrot')}買餸清單</button>
  </div>`;
}

/* ===== 食譜簿 ===== */
function filteredRecipes() {
  let list;
  const f = RT.recFilter;
  if (f === 'mine') list = S.recipes.filter(r => r.src !== 'ai');
  else if (f === 'ai') list = S.recipes.filter(r => r.src === 'ai');
  else if (f === 'fav') list = allRecipes().filter(r => isFav(r.id));
  else if (f === 'lib') list = [...LIB];
  else list = allRecipes();
  if (RT.recType) list = list.filter(r => r.type === RT.recType);
  const q = RT.recQ.trim();
  if (q) list = list.filter(r => r.name.includes(q) || r.ings.some(i => i.n.includes(q)) || (r.tags || []).some(t => t.includes(q)));
  const s = RT.recSort;
  if (s === 'fast') list.sort((a, b) => a.time - b.time);
  else if (s === 'kcal') list.sort((a, b) => (a.kcal || 0) - (b.kcal || 0));
  else if (s === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  return list;
}
function renderRecipes() {
  const el = $('#v-recipes');
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `
    <div class="sec-h"><span class="ic" style="background:${iconBg('plate')}">${iconSVG('plate')}</span><div><h2>食譜簿</h2><div class="small muted" id="recCount"></div></div>
      <div class="act"><button class="btn sm sun" data-act="newRecipe">${li('plus')}新增食譜</button><button class="btn sm pri needs-ai" data-act="go" data-v="ai">${li('ai')}AI 生成</button></div></div>
    <div class="row"><div class="field" style="flex:1"><label for="recQ" class="hide">搜尋</label><input id="recQ" class="inp" type="search" placeholder="搜尋菜名、材料或者標籤，例如：雞蛋"></div>
      <select id="recSort" class="inp" style="width:auto" aria-label="排序"><option value="new">最新</option><option value="fast">最快煮好</option><option value="kcal">熱量低先</option><option value="name">名稱</option></select></div>
    <div class="chips" id="recFilters"></div>
    <div class="chips scroll" id="recTypes"></div>
    <div class="grid gcards" id="recList"></div>`;
    $('#recQ').addEventListener('input', e => { RT.recQ = e.target.value; renderRecList(); });
    $('#recSort').addEventListener('change', e => { RT.recSort = e.target.value; renderRecList(); });
  }
  renderRecList();
}
function renderRecList() {
  const F = [['all', '全部'], ['mine', '我嘅'], ['ai', 'AI 整嘅'], ['fav', '收藏'], ['lib', '推薦庫']];
  $('#recFilters').innerHTML = F.map(([k, l]) => `<button class="chip" data-act="recFilter" data-f="${k}" aria-pressed="${RT.recFilter === k}">${l}</button>`).join('');
  $('#recTypes').innerHTML = `<button class="chip" data-act="recType" data-t="" aria-pressed="${!RT.recType}">所有類別</button>` +
    TYPE_ORDER.map(t => `<button class="chip" data-act="recType" data-t="${t}" aria-pressed="${RT.recType === t}">${iconSVG(TYPES[t].icon)}${TYPES[t].label}</button>`).join('');
  const list = filteredRecipes();
  $('#recCount').textContent = `${list.length} 個食譜・我嘅 ${S.recipes.length} 個・收藏 ${S.favs.length} 個`;
  $('#recList').innerHTML = list.length ? list.map(r => recipeCard(r)).join('') :
    `<div class="empty" style="grid-column:1/-1">${iconSVG('plate')}<b>搵唔到合適嘅食譜</b><span>試下換個關鍵字，或者叫 AI 幫你諗一個</span><button class="btn pri" data-act="go" data-v="ai">${li('ai')}AI 生成</button></div>`;
  if (RT.recQ !== $('#recQ').value) $('#recQ').value = RT.recQ;
  $('#recSort').value = RT.recSort;
}

/* ===== 食譜詳情 ===== */
function openRecipe(id) {
  const r = getRecipe(id); if (!r) return;
  RT.detail = { id, serv: S.settings.people || r.servings || 2, done: new Set() };
  const bd = openSheet(r.name, detailHTML(r));
  bd.dataset.detail = id;
  bd._onClose = () => { RT.detail = null; };
}
function rerenderDetail() {
  if (!RT.detail) return;
  const bd = $$('#sheets .backdrop').find(b => b.dataset.detail && b.dataset.detail === RT.detail.id); if (!bd) return;
  const r = getRecipe(RT.detail.id); if (!r) { closeSheet(bd); return; }
  const sh = bd.querySelector('.sheet'); const top = sh.scrollTop;
  bd.querySelector('.body').innerHTML = detailHTML(r); sh.scrollTop = top;
}
function nutBars(r) {
  const rows = [['蛋白質', r.p, 'var(--c-pro)', 40], ['碳水', r.c, 'var(--c-carb)', 90], ['脂肪', r.f, 'var(--c-fat)', 40]];
  return rows.map(([l, v, c, max]) => `<div class="nbar"><span>${l}</span><span class="track"><span class="fill" style="display:block;width:${Math.min(100, (v || 0) / max * 100)}%;background:${c}"></span></span><span class="num" style="text-align:right">${v || 0} 克</span></div>`).join('');
}
function detailHTML(r) {
  const D = RT.detail; const factor = D.serv / (r.servings || 1); const mine = S.recipes.includes(r);
  const ctx = (() => { const k = TODAY(); const p = dayPlan(k); const m = ['b', 'l', 'd'].find(m => p[m].includes(r.id)); return m ? p[m] : [r.id]; })();
  const pr = pairings(r, ctx, 4);
  return `
  ${illHTML(r, 'detail-ill')}
  ${avoidHit(r) ? `<div class="card coral" style="box-shadow:none;background:#ffe3dc;padding:8px 12px">留意：有「${esc(avoidHit(r))}」，屋企人唔食</div>` : ''}
  ${r.desc ? `<p style="margin:0">${esc(r.desc)}</p>` : ''}
  <div class="chips"><span class="pill mint">${TYPES[r.type]?.label || '其他'}</span><span class="pill">${esc(r.cuisine || '家常')}</span><span class="pill">${li('clock', 'mi')}${r.time} 分鐘</span><span class="pill">難度：${LV[r.level] || '易'}</span>${(r.tags || []).map(t => `<span class="pill sun">${esc(t)}</span>`).join('')}</div>
  <div class="row wrap">
    <button class="btn pri" data-act="cook" data-id="${esc(r.id)}">${li('pot')}開始煮</button>
    <button class="btn sun" data-act="addPlan" data-id="${esc(r.id)}">${li('plus')}加菜到餐單</button>
    <button class="btn" data-act="fav" data-id="${esc(r.id)}" aria-pressed="${isFav(r.id)}">${li('heart')}${isFav(r.id) ? '已收藏' : '收藏'}</button>
    ${mine ? `<button class="btn icon" data-act="editRecipe" data-id="${esc(r.id)}" aria-label="編輯">${li('edit')}</button>` : `<button class="btn" data-act="copyRecipe" data-id="${esc(r.id)}">${li('edit')}複製去改</button>`}
    <button class="btn" data-act="copyText" data-id="${esc(r.id)}">${li('copy')}複製食譜文字</button>
    <button class="btn" data-act="cookedLog" data-id="${esc(r.id)}">${li('check')}今日煮咗</button>
  </div>
  ${cookedCount(r.id) ? `<div class="small muted">屋企煮過 ${cookedCount(r.id)} 次${lastCooked(r.id) ? `，上次係 ${lastCooked(r.id)}` : ''}</div>` : ''}
  <div class="card">
    <div class="sec-h"><h3>材料</h3><div class="act row">${li('people', 'mi')}${stepper('serv', D.serv, '份量')}<span class="small">人份</span></div></div>
    <div style="margin-top:8px">${r.ings.map(i => { const info = ingInfo(i.n); return `<div class="ing-row"><span class="ic">${iconSVG(info.icon)}</span><span>${esc(i.n)}</span>${inPantry(i.n) ? '<span class="pill mint">雪櫃有</span>' : ''}<span class="q">${esc(qtyText(i, factor))}</span></div>`; }).join('')}</div>
    <button class="btn block sun" style="margin-top:10px" data-act="shopRecipe" data-id="${esc(r.id)}">${li('cart')}將材料加入購物清單（${D.serv} 人份）</button>
  </div>
  <div class="card">
    <h3>步驟</h3>
    ${r.steps.map((s, i) => `<div class="step ${D.done.has(i) ? 'done' : ''}"><button class="check" role="checkbox" aria-checked="${D.done.has(i)}" data-act="stepDone" data-i="${i}" aria-label="完成第 ${i + 1} 步"></button><span class="n">${i + 1}</span><div style="flex:1"><div class="t">${esc(s.t)}</div>${s.min ? `<button class="btn sm" style="margin-top:6px" data-act="stepTimer" data-l="${esc(r.name)}・第${i + 1}步" data-s="${s.min * 60}">${li('clock')}計時 ${s.min} 分鐘</button>` : ''}</div></div>`).join('')}
    ${r.tips ? `<div class="card sun" style="box-shadow:none;margin-top:6px;padding:10px 12px"><b>小貼士：</b>${esc(r.tips)}</div>` : ''}
  </div>
  <div class="card">
    <div class="sec-h"><h3>營養（每份大約）</h3><span class="act"><span class="pill coral num">${r.kcal || '–'} 大卡</span></span></div>
    <div class="list" style="margin-top:8px">${nutBars(r)}</div>
  </div>
  <div class="card tint">
    <div class="sec-h"><span class="ic" style="background:#fff">${iconSVG('soup')}</span><div><h3>搭配菜推薦</h3><div class="small muted">一湯兩餸，有菜有肉</div></div></div>
    <div class="list" style="margin-top:10px">${pr.map(x => `<div class="dish">${dishIc(x.r)}<button class="plain" data-act="openSwap" data-id="${esc(x.r.id)}"><div class="nm">${esc(x.r.name)}</div><div class="sub">${x.why.map(esc).join('・') || TYPES[x.r.type]?.label}</div></button><button class="btn sm sun" data-act="addPlan" data-id="${esc(x.r.id)}">${li('plus')}加菜</button></div>`).join('')}</div>
    <button class="btn sm pri needs-ai" style="margin-top:10px" data-act="aiPair" data-id="${esc(r.id)}">${li('ai')}問 AI 點配</button>
    <div id="aiPairOut" style="margin-top:8px"></div>
  </div>
  ${mine ? `<button class="btn coral" data-act="delRecipe" data-id="${esc(r.id)}">${li('trash')}刪除呢個食譜</button>` : ''}`;
}
function cookedCount(id) { return Object.values(S.log || {}).flat().filter(e => e.id === id).length; }
function lastCooked(id) { const d = Object.values(S.log || {}).flat().filter(e => e.id === id).map(e => e.d).sort().pop(); if (!d) return ''; const n = daysBetween(d, TODAY()); return n === 0 ? '今日' : n === 1 ? '琴日' : `${n} 日前`; }
function recipeText(r, serv) {
  const f = serv / (r.servings || 1);
  return [`【${r.name}】${serv} 人份・${r.time} 分鐘`, r.desc || '', '', '材料：', ...r.ings.map(i => `・${i.n} ${qtyText(i, f)}`), '', '做法：', ...r.steps.map((st, i) => `${i + 1}. ${st.t}`), r.tips ? `\n小貼士：${r.tips}` : '', '', '鑊仔食譜'].join('\n').replace(/\n{3,}/g, '\n\n');
}
function openAddPlan(id) {
  const r = getRecipe(id); if (!r) return;
  const h = new Date().getHours(); const def = h < 10 ? 'b' : h < 15 ? 'l' : 'd';
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => dkey(addDays(new Date(), i)));
  const bd = openSheet('加菜：' + r.name, `
    <div class="field"><label>邊日？</label><div class="chips">${days.map((k, i) => { const d = parseD(k); return `<button class="chip" data-act="apDay" data-k="${k}" aria-pressed="${i === 0}">${i === 0 ? '今日' : i === 1 ? '聽日' : `${d.getMonth() + 1}/${d.getDate()} 星期${WD[d.getDay()]}`}</button>`; }).join('')}</div></div>
    <div class="field"><label>邊餐？</label><div class="chips">${Object.entries(MEALS).map(([m, l]) => `<button class="chip" data-act="apMeal" data-m="${m}" aria-pressed="${m === def}">${iconSVG(MEAL_ICON[m])}${l}</button>`).join('')}</div></div>
    <button class="btn pri block" data-act="apGo" data-id="${esc(id)}">${li('plus')}加入餐單</button>`);
  bd._ap = { k: days[0], m: def };
}
function openPicker(k, meal) {
  const ids = dayPlan(k)[meal];
  const base = ids.length ? getRecipe(ids[0]) : null;
  const sug = base ? pairings(base, ids, 4) : recommend(4).map(x => ({ r: x.r, why: [x.why] }));
  const bd = openSheet(`${fmtDay(k)} ${MEALS[meal]}・加菜`, `
    <div class="small muted">${base ? `同「${esc(base.name)}」最夾：` : '推薦：'}</div>
    <div class="list" id="pkSug">${sug.map(x => pickRow(x.r, x.why.join('・'))).join('')}</div>
    <input class="inp" id="pkQ" type="search" placeholder="搜尋食譜…" aria-label="搜尋食譜">
    <div class="list" id="pkList"></div>`);
  bd._pk = { k, meal, added: 0 };
  const draw = () => { const q = $('#pkQ', bd).value.trim(); const list = allRecipes().filter(r => !q || r.name.includes(q) || r.ings.some(i => i.n.includes(q))).slice(0, 40); $('#pkList', bd).innerHTML = list.map(r => pickRow(r, `${TYPES[r.type]?.label || ''} · ${r.time} 分鐘`)).join(''); };
  $('#pkQ', bd).addEventListener('input', draw); draw();
}
function pickRow(r, sub) { return `<div class="dish">${dishIc(r)}<div style="flex:1;min-width:0"><div class="nm">${esc(r.name)}</div><div class="sub">${esc(sub)}</div></div><button class="btn sm sun" data-act="pkAdd" data-id="${esc(r.id)}">${li('plus')}加</button></div>`; }

/* ===== 餐單 ===== */
function renderPlan() {
  const k = RT.planDay; const wk = weekKeys(k); const today = TODAY(); const ppl = S.settings.people || 2;
  const ws = parseD(wk[0]), we = parseD(wk[6]);
  $('#v-plan').innerHTML = `
  <div class="sec-h"><span class="ic" style="background:${iconBg('soup')}">${iconSVG('soup')}</span><div><h2>餐單</h2><div class="small muted">${ws.getMonth() + 1}月${ws.getDate()}日 至 ${we.getMonth() + 1}月${we.getDate()}日</div></div>
    <div class="act"><button class="btn icon sm" data-act="week" data-d="-7" aria-label="上個禮拜">${li('left')}</button><button class="btn sm" data-act="planToday">今日</button><button class="btn icon sm" data-act="week" data-d="7" aria-label="下個禮拜">${li('right')}</button></div></div>
  <div class="days">${wk.map(d => { const n = dayIds(d).length; const dt = parseD(d); return `<button class="day ${d === k ? 'on' : ''} ${d === today ? 'today' : ''}" data-act="planDay" data-k="${d}" aria-pressed="${d === k}"><span>${WD[dt.getDay()]}</span><span class="d">${dt.getDate()}</span><span class="dots">${'<i></i>'.repeat(Math.min(n, 4))}</span></button>`; }).join('')}</div>
  <div class="card">
    <div class="sec-h"><h3>${fmtDay(k)}</h3><div class="act"><span class="pill coral num">每人約 ${dayKcal(k)} 大卡</span></div></div>
    <div class="meals" style="margin-top:12px">${['b', 'l', 'd'].map(m => mealBlock(k, m)).join('')}</div>
    <div class="row wrap" style="margin-top:12px"><button class="btn sm sun" data-act="shopDay" data-k="${k}">${li('cart')}呢日材料加入清單</button><button class="btn sm" data-act="clearDay" data-k="${k}">${li('trash')}清空呢日</button></div>
  </div>
  <div class="card">
    <div class="sec-h"><h3>成個禮拜一覽</h3><div class="act row"><span class="small">幾多人食</span>${stepper('people', ppl, '人數')}</div></div>
    <div class="list" style="margin-top:10px">${wk.map(d => { const ids = dayIds(d); const dt = parseD(d); return `<button class="li" style="text-align:left" data-act="planDay" data-k="${d}"><b style="width:56px;flex:none;font-family:var(--f-display)">星期${WD[dt.getDay()]}</b><span class="row" style="gap:4px;flex-wrap:wrap;flex:1">${ids.length ? ids.map(id => { const r = getRecipe(id); return `<span title="${esc(r.name)}" style="width:32px;height:32px;border-radius:10px;border:2px solid var(--ink);background:${iconBg(r.icon)};display:grid;place-items:center">${iconSVG(r.icon)}</span>`; }).join('') : '<span class="small muted">未有安排</span>'}</span><span class="q small">${dayKcal(d) || ''}</span></button>`; }).join('')}</div>
    <div class="grid g2" style="margin-top:12px"><button class="btn" data-act="copyWeek">${li('copy')}抄上個禮拜</button><button class="btn sun" data-act="autoWeek">${li('shuffle')}自動排晒晚餐</button><button class="btn pri" style="grid-column:1/-1" data-act="shopWeek">${li('cart')}成個禮拜材料入清單</button></div>
    ${avoidList().length ? `<div class="small muted" style="margin-top:8px">已經避開：${esc(avoidList().join('、'))}</div>` : ''}
  </div>`;
}

/* ===== 購物清單 ===== */
function renderShop() {
  const total = S.shop.length, done = S.shop.filter(i => i.done).length;
  const hide = RT.hideHave;
  const groups = CAT_ORDER.map(c => {
    let items = S.shop.filter(i => i.cat === c);
    if (hide) items = items.filter(i => !inPantry(i.n));
    if (!items.length) return '';
    items.sort((a, b) => a.done - b.done);
    return `<div class="cat-h"><span style="width:34px;height:34px;border-radius:10px;border:2.5px solid var(--ink);background:${iconBg(CATS[c].icon)}">${iconSVG(CATS[c].icon)}</span>${CATS[c].label}<span class="pill">${items.filter(i => !i.done).length}</span></div>
      <div class="list">${items.map(i => `<div class="li ${i.done ? 'done' : ''}"><button class="check" role="checkbox" aria-checked="${i.done}" data-act="shopToggle" data-id="${i.id}" aria-label="買咗 ${esc(i.n)}"></button>
        <span class="ic" style="background:${iconBg(ingInfo(i.n).icon)}">${iconSVG(ingInfo(i.n).icon)}</span>
        <div style="min-width:0;flex:1"><div class="nm">${esc(i.n)} ${inPantry(i.n) ? '<span class="pill mint">雪櫃有</span>' : ''}</div>${(i.from?.length || i.by || i.doneBy) ? `<div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.done && i.doneBy && Store.mode === 'db' ? esc(memberName(i.doneBy)) + ' 買咗・' : (!i.from?.length && i.by && Store.mode === 'db' ? esc(memberName(i.by)) + ' 加・' : '')}${esc((i.from || []).join('、'))}</div>` : ''}</div>
        <span class="q">${i.q ? fmtQ(i.q) + ' ' + esc(i.u) : esc(i.u || '適量')}</span>
        <button class="btn icon sm" data-act="shopDel" data-id="${i.id}" aria-label="刪除 ${esc(i.n)}">${li('x')}</button></div>`).join('')}</div>`;
  }).join('');
  $('#v-shop').innerHTML = `
  <div class="card row wrap">
    ${ringSVG(total ? done / total : 0, '買咗嘅比例')}
    <div style="flex:1;min-width:160px"><h2>購物清單</h2><div class="muted">${total ? `仲有 <b class="num">${total - done}</b> 樣未買，買咗 ${done} 樣` : '清單係空嘅'}</div></div>
    <div class="row wrap"><button class="btn sm sun" data-act="shopDay" data-k="${TODAY()}">${li('plan')}由今日餐單加</button><button class="btn sm" data-act="shopWeek">由本週餐單加</button></div>
  </div>
  <div class="card">
    <form class="row wrap" id="shopAdd" style="gap:8px">
      <input class="inp" id="saN" placeholder="加一樣嘢，例如：豆腐" style="flex:2;min-width:140px" aria-label="材料名" required>
      <input class="inp" id="saQ" type="number" min="0" step="any" placeholder="數量" style="width:84px" aria-label="數量">
      <input class="inp" id="saU" placeholder="單位" style="width:76px" aria-label="單位">
      <button class="btn pri" type="submit">${li('plus')}加</button>
    </form>
    <div class="row wrap" style="margin-top:10px">
      <button class="chip" data-act="hideHave" aria-pressed="${hide}">隱藏雪櫃有嘅</button>
      <span class="spacer"></span>
      <button class="btn sm" data-act="shopCopy">${li('copy')}複製清單</button>
      <button class="btn sm sun" data-act="shopToPantry">${li('check')}買咗嘅放入雪櫃</button>
      <button class="btn sm" data-act="shopClearDone">清走已買</button>
      <button class="btn sm coral" data-act="shopClearAll">全部清走</button>
    </div>
  </div>
  ${groups ? `<div class="card">${groups}</div>` : `<div class="card empty">${iconSVG('basket')}<b>清單係空嘅</b><span>由餐單或者食譜一撳就加材料</span><button class="btn sun" data-act="go" data-v="plan">${li('plan')}去餐單</button></div>`}`;
  $('#shopAdd').addEventListener('submit', e => {
    e.preventDefault(); const n = $('#saN').value.trim(); if (!n) return;
    const q = Number($('#saQ').value) || 0; const u = $('#saU').value.trim();
    $('#saN').value = ''; $('#saQ').value = ''; $('#saU').value = '';
    S.shop.push({ id: uid('s'), n, q, u, cat: CATS[ingInfo(n).cat] ? ingInfo(n).cat : 'other', done: false, from: [], by: RT.me || '', t: Date.now() });
    save(); toast('加咗 ' + n); setTimeout(() => $('#saN')?.focus(), 30);
  });
}

/* ===== 圖表 ===== */
function niceMax(v) { if (v <= 1) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
function barPath(x, y, w, h, r = 4) { if (h <= 0) return ''; r = Math.min(r, h, w / 2); return `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h}Z`; }
function vBars({ labels, series, colors, names, unit, hi = [] }) {
  const W = 340, H = 200, L = 36, R = 8, T = 20, B = 26; const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser[i] || 0), 0));
  const top = Math.max(...totals, 1); const step = niceMax(top / 4); const max = step * Math.ceil(top * 1.05 / step);
  const pw = (W - L - R) / n; const bw = Math.min(26, pw * .56);
  const y = v => T + (H - T - B) * (1 - v / max);
  let g = '';
  for (let v = 0; v <= max + 1e-9; v += step) { g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#d7ebe8" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
  let bars = '';
  labels.forEach((lab, i) => {
    const x = L + pw * i + (pw - bw) / 2; let acc = 0; const segs = series.length;
    series.forEach((ser, si) => {
      const v = ser[i] || 0; if (!v) return;
      const y0 = y(acc + v), y1 = y(acc); let hgt = y1 - y0; const isTop = series.slice(si + 1).every(s2 => !(s2[i] > 0));
      const gap = segs > 1 && acc > 0 ? 2 : 0;
      hgt -= gap;
      bars += isTop ? `<path d="${barPath(x, y0, bw, hgt)}" fill="${colors[si]}"/>` : `<rect x="${x}" y="${y0}" width="${bw}" height="${Math.max(0, hgt)}" fill="${colors[si]}"/>`;
      acc += v;
    });
    const tip = series.length > 1 ? `${lab}：` + series.map((ser, si) => `${names[si]} ${Math.round(ser[i] || 0)}`).join('，') + ` ${unit}` : `${lab}：${Math.round(totals[i])} ${unit}`;
    bars += `<rect x="${L + pw * i}" y="${T}" width="${pw}" height="${H - T - B}" fill="transparent" data-tip="${esc(tip)}"/>`;
    if (hi.includes(i) && totals[i] > 0) bars += `<text class="val" x="${x + bw / 2}" y="${y(totals[i]) - 6}" text-anchor="middle">${Math.round(totals[i])}</text>`;
    bars += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(lab)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="棒形圖">${g}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#9cc9c3" stroke-width="1.5"/>${bars}</svg></div>`;
}
function hBars(items, unit) {
  const W = 340, rowH = 34, L = 104, R = 40; const H = items.length * rowH + 6;
  const max = Math.max(...items.map(i => i.v), 1);
  const rows = items.map((it, i) => {
    const y = 4 + i * rowH; const w = (W - L - R) * it.v / max;
    return `<g data-tip="${esc(it.label)}：${it.v} ${unit}"><rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/>
      <svg x="0" y="${y + 3}" width="28" height="28" viewBox="-4 -4 108 104">${ICONS[it.icon]?.svg() || ''}</svg>
      <text x="32" y="${y + 21}" style="fill:#10393b;font-size:12.5px">${esc(it.label)}</text>
      <path d="${w > 0 ? `M${L} ${y + 9} H${L + w - 4} Q${L + w} ${y + 9} ${L + w} ${y + 13} V${y + 21} Q${L + w} ${y + 25} ${L + w - 4} ${y + 25} H${L}Z` : ''}" fill="var(--teal)"/>
      <text class="val" x="${L + w + 6}" y="${y + 22}">${it.v}</text></g>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="橫向棒形圖"><line x1="${L}" x2="${L}" y1="0" y2="${H}" stroke="#9cc9c3" stroke-width="1.5"/>${rows}</svg></div>`;
}
function tbl(head, rows) { return `<div class="chart"><table class="tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function renderStats() {
  const wk = weekKeys(TODAY()); const lab = wk.map(k => WD[parseD(k).getDay()]);
  const per = wk.map(k => dayIds(k).map(getRecipe));
  const kcal = per.map(rs => rs.reduce((s, r) => s + (r.kcal || 0), 0));
  const P = per.map(rs => rs.reduce((s, r) => s + (r.p || 0), 0)), C = per.map(rs => rs.reduce((s, r) => s + (r.c || 0), 0)), F = per.map(rs => rs.reduce((s, r) => s + (r.f || 0), 0));
  const ti = wk.indexOf(TODAY()); const mx = kcal.indexOf(Math.max(...kcal));
  const book = allRecipes();
  const typeItems = TYPE_ORDER.map(t => ({ label: TYPES[t].label, icon: TYPES[t].icon, v: book.filter(r => r.type === t).length })).sort((a, b) => b.v - a.v);
  const weekDishes = per.flat();
  const srcList = weekDishes.length >= 3 ? weekDishes : book;
  const cnt = {}; srcList.forEach(r => mainIngs(r).filter(i => ingInfo(i.n).icon !== 'basket').forEach(i => { const key = i.n.replace(/^(鮮|滑|乾)/, ''); cnt[key] = (cnt[key] || 0) + 1; }));
  const topIng = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ label: n, icon: ingInfo(n).icon, v }));
  const bk = [['≤15', 0, 15], ['16–30', 16, 30], ['31–45', 31, 45], ['46–60', 46, 60], ['60+', 61, 9999]];
  const hist = bk.map(([l, a, b]) => book.filter(r => r.time >= a && r.time <= b).length);
  const avgT = Math.round(book.reduce((s, r) => s + r.time, 0) / book.length);
  const logs = Object.values(S.log || {}).flat(); const cc = {}, bc = {};
  logs.forEach(e => { if (getRecipe(e.id)) cc[e.id] = (cc[e.id] || 0) + 1; if (e.by) bc[e.by] = (bc[e.by] || 0) + 1; });
  const topCook = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ label: getRecipe(id).name.slice(0, 7), icon: getRecipe(id).icon, v }));
  const byCook = Object.entries(bc).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ label: memberName(id).slice(0, 6), icon: memberIcon(id), v }));
  const tg = k => `<button class="btn sm" data-act="statsTbl" data-k="${k}">${RT.statsTable[k] ? '睇圖' : '睇數字'}</button>`;
  $('#v-stats').innerHTML = `
  <div class="sec-h"><span class="ic" style="background:${iconBg('salad')}">${iconSVG('salad')}</span><div><h2>圖表</h2><div class="small muted">本週餐單同食譜簿嘅數字，營養係每人大約值</div></div></div>
  <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
    <div class="tile"><span class="v">${book.length}</span><span class="l">食譜（我嘅 ${S.recipes.length}）</span></div>
    <div class="tile"><span class="v">${weekDishes.length}</span><span class="l">本週安排咗嘅餸</span></div>
    <div class="tile"><span class="v">${avgT}<span class="small muted"> 分鐘</span></span><span class="l">平均煮食時間</span></div>
    <div class="tile"><span class="v">${S.favs.length}</span><span class="l">收藏</span></div>
    <div class="tile"><span class="v">${(S.log || {})[TODAY().slice(0, 7)]?.length || 0}</span><span class="l">今個月煮咗幾多餐</span></div>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card"><div class="sec-h"><h3>本週每日熱量（每人，大卡）</h3><div class="act">${tg('k')}</div></div>
      ${RT.statsTable.k ? tbl(['日子', '大卡'], wk.map((k, i) => ['星期' + lab[i], kcal[i]])) : vBars({ labels: lab, series: [kcal], colors: ['var(--teal)'], names: ['熱量'], unit: '大卡', hi: [mx, ti] })}
      <div class="small muted">標住數字嘅係最高嗰日同今日</div></div>
    <div class="card"><div class="sec-h"><h3>本週營養（每人，克）</h3><div class="act">${tg('n')}</div></div>
      <div class="legend" style="margin:6px 0"><span><i style="background:var(--c-pro)"></i>蛋白質 ${P.reduce((a, b) => a + b, 0)} 克</span><span><i style="background:var(--c-carb)"></i>碳水 ${C.reduce((a, b) => a + b, 0)} 克</span><span><i style="background:var(--c-fat)"></i>脂肪 ${F.reduce((a, b) => a + b, 0)} 克</span></div>
      ${RT.statsTable.n ? tbl(['日子', '蛋白質', '碳水', '脂肪'], wk.map((k, i) => ['星期' + lab[i], P[i], C[i], F[i]])) : vBars({ labels: lab, series: [P, C, F], colors: ['var(--c-pro)', 'var(--c-carb)', 'var(--c-fat)'], names: ['蛋白質', '碳水', '脂肪'], unit: '克', hi: [ti] })}</div>
    <div class="card"><h3>屋企最常煮</h3>${topCook.length ? hBars(topCook, '次') : `<div class="empty">${iconSVG('wok')}<span>煮完喺「煮食模式」撳「煮好喇」，或者喺食譜撳「今日煮咗」，呢度就會記低</span></div>`}</div>
    ${Store.mode === 'db' && byCook.length ? `<div class="card"><h3>邊個煮得最多</h3>${hBars(byCook, '餐')}</div>` : ''}
    <div class="card"><h3>食譜簿類別</h3>${hBars(typeItems, '個食譜')}</div>
    <div class="card"><h3>${weekDishes.length >= 3 ? '本週最常用食材' : '食譜簿最常用食材'}</h3>${hBars(topIng, '次')}</div>
    <div class="card"><div class="sec-h"><h3>煮食時間分佈（分鐘）</h3><div class="act">${tg('t')}</div></div>
      ${RT.statsTable.t ? tbl(['時間', '食譜數'], bk.map((b, i) => [b[0] + ' 分鐘', hist[i]])) : vBars({ labels: bk.map(b => b[0]), series: [hist], colors: ['var(--teal)'], names: ['食譜'], unit: '個食譜', hi: [hist.indexOf(Math.max(...hist))] })}</div>
  </div>`;
}
