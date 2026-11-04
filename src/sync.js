/* ===== 唔使 Claude 嘅同步：Firebase（免費）＋ 分享碼 ＋ 備份 ===== */
const FB_VER = '10.12.2';
const FB_KEY = 'wokzai-fb';
const FB_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{fam}/items/{item} {
      allow read, write: if fam.size() >= 20;
    }
  }
}`;
function fbCfgLoad() { try { const v = JSON.parse(localStorage.getItem(FB_KEY) || 'null'); return v && v.c && v.c.apiKey && v.c.projectId && v.f ? v : null; } catch (e) { return null; } }
function fbCfgSave(v) { try { localStorage.setItem(FB_KEY, JSON.stringify(v)); return true; } catch (e) { toast('呢個瀏覽器存唔到設定（可能係私隱模式）'); return false; } }
function loadScript(src, ms = 15000) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; const t = setTimeout(() => { s.remove(); rej(new Error('timeout')); }, ms); s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); s.remove(); rej(new Error('load')); }; document.head.appendChild(s); });
}
async function loadFirebase() {
  if (window.firebase && window.firebase.firestore) return;
  const bases = [`https://www.gstatic.com/firebasejs/${FB_VER}/`, `https://cdn.jsdelivr.net/npm/firebase@${FB_VER}/`];
  let last;
  for (const b of bases) {
    try { if (!(window.firebase && window.firebase.initializeApp)) await loadScript(b + 'firebase-app-compat.js'); await loadScript(b + 'firebase-firestore-compat.js'); if (window.firebase && window.firebase.firestore) return; }
    catch (e) { last = e; }
  }
  throw last || new Error('firebase');
}
function fbErr(e) { const c = e && e.code; return { code: c === 'permission-denied' ? 'invalid_argument' : c === 'resource-exhausted' ? 'quota_exceeded' : 'unavailable', message: (e && e.message) || '' }; }
function fbAdapter(cfg) {
  const fb = window.firebase;
  const app = fb.apps && fb.apps.length ? fb.app() : fb.initializeApp(cfg.c);
  const fs = app.firestore();
  try { const p = fs.enablePersistence({ synchronizeTabs: true }); if (p && p.catch) p.catch(() => { }); } catch (e) { }
  const col = fs.collection('families').doc(cfg.f).collection('items');
  const wrap = s => ({ docs: s.docs.map(d => ({ id: d.id, exists: true, data: () => d.data() })), metadata: { fromCache: !!s.metadata.fromCache, hasPendingWrites: !!s.metadata.hasPendingWrites } });
  return {
    collection: () => ({
      onSnapshot: (next, err) => col.onSnapshot({ includeMetadataChanges: true }, s => next(wrap(s)), e => err && err(fbErr(e))),
      doc: id => ({ set: v => col.doc(id).set(v).catch(e => { throw fbErr(e); }), delete: () => col.doc(id).delete().catch(e => { throw fbErr(e); }) }),
      get: async () => wrap(await col.get()),
    }),
  };
}
function parseFbConfig(text) {
  const t = String(text || ''); const o = {};
  for (const m of t.matchAll(/["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId)["']?\s*:\s*["']([^"']+)["']/g)) o[m[1]] = m[2].trim();
  return o.apiKey && o.projectId ? o : null;
}
function randCode(n = 22) { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; const b = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => b[i] = Math.random() * 256); return [...b].map(x => a[x % a.length]).join(''); }

/* 文字壓縮 ↔ 短碼 */
const b64u = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const s = atob(str); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function packCode(obj, tag) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) {
    try { const st = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw')); const buf = new Uint8Array(await new Response(st).arrayBuffer()); return `${tag}Z:${b64u(buf)}`; } catch (e) { }
  }
  return `${tag}J:${b64u(raw)}`;
}
async function unpackCode(text, tag) {
  const m = String(text || '').match(new RegExp(`${tag}([ZJ]):([A-Za-z0-9_-]+)`));
  if (!m) throw new Error('nocode');
  let bytes = unb64u(m[2]);
  if (m[1] === 'Z') { const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')); bytes = new Uint8Array(await new Response(st).arrayBuffer()); }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function inviteLink(code) { const base = location.protocol.startsWith('http') ? location.origin + location.pathname : ''; return base ? `${base}#join=${code}` : ''; }

/* 合併（分享碼／備份） */
function mergeIn(inc0) {
  const inc = cleanState(inc0); let n = 0; const byId = a => new Map((a || []).map(x => [x.id, x]));
  const rm = byId(S.recipes); (inc.recipes || []).forEach(r => { if (r && r.id && r.name && Array.isArray(r.ings) && !rm.has(r.id)) { S.recipes.push(r); n++; } });
  const sm = byId(S.shop); (inc.shop || []).forEach(i => { const c = sm.get(i.id); if (!c) { S.shop.push({ ...i, t: i.t || Date.now() }); n++; } else if (i.done && !c.done) { c.done = true; c.doneBy = i.doneBy || ''; n++; } });
  const pm = byId(S.pantry); (inc.pantry || []).forEach(p => { if (p && p.id && p.n && !pm.has(p.id)) { S.pantry.push(p); n++; } });
  for (const [k, v] of Object.entries(inc.plan || {})) { if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue; const c = dayPlan(k); let ch = false; for (const m of ['b', 'l', 'd']) (v[m] || []).forEach(id => { if (getRecipe(id) && !c[m].includes(id)) { c[m].push(id); n++; ch = true; } }); if (ch) S.plan[k] = c; }
  (inc.favs || []).forEach(f => { if (getRecipe(f) && !S.favs.includes(f)) S.favs.push(f); });
  S.members = S.members || {}; Object.entries(inc.members || {}).forEach(([k, v]) => { if (!S.members[k] && v && v.name) S.members[k] = v; });
  S.log = S.log || {}; Object.entries(inc.log || {}).forEach(([m, items]) => { const cur = S.log[m] = S.log[m] || []; const key = e => e.d + '|' + e.id + '|' + e.by; const seen = new Set(cur.map(key)); (items || []).forEach(e => { if (e && e.id && !seen.has(key(e))) { cur.push(e); seen.add(key(e)); } }); });
  ['avoid', 'note'].forEach(k => { if (inc.settings && inc.settings[k] && !S.settings[k]) S.settings[k] = inc.settings[k]; });
  S.shop.sort((a, b) => (a.t || 0) - (b.t || 0));
  return n;
}
function sharePayload() {
  const from = dkey(addDays(new Date(), -1)), to = dkey(addDays(new Date(), 14));
  const plan = {}; for (const k in S.plan) if (k >= from && k <= to) plan[k] = S.plan[k];
  const used = new Set(Object.values(plan).flatMap(p => [...(p.b || []), ...(p.l || []), ...(p.d || [])]));
  const recipes = S.recipes.filter(r => !r.demo && (used.has(r.id) || r.src !== 'lib')).map(r => { const c = { ...r }; delete c.photo; return c; });
  return { v: 1, recipes, shop: S.shop, pantry: S.pantry, plan, favs: S.favs, members: S.members, settings: { avoid: S.settings.avoid, note: S.settings.note } };
}
async function shareText() {
  const code = await packCode(sharePayload(), 'WZ1');
  const left = S.shop.filter(i => !i.done);
  return `鑊仔食譜分享碼：喺 App 撳「家庭共用」→「貼上分享碼」就會合併清單、餐單、雪櫃同食譜。\n${left.length ? `（仲有 ${left.length} 樣未買：${left.slice(0, 8).map(i => i.n).join('、')}${left.length > 8 ? '…' : ''}）\n` : ''}${code}`;
}
async function copyOrShow(text, title) {
  try { await navigator.clipboard.writeText(text); toast('複製咗，可以貼去 WhatsApp'); }
  catch (e) { openSheet(title, `<textarea class="inp" rows="10" readonly aria-label="${esc(title)}">${esc(text)}</textarea><div class="small muted">長撳揀晒，再複製</div>`); }
}
function downloadText(name, text) {
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('備份檔下載緊'); }
  catch (e) { toast('呢度唔俾下載檔案'); }
}

/* ===== 家庭共用設定頁 ===== */
let QR_LOADED = null;
async function drawQR(el, text) {
  if (!el || !text) return;
  try {
    if (!window.qrcode) { QR_LOADED = QR_LOADED || loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'); await QR_LOADED; }
    const q = window.qrcode(0, 'L'); q.addData(text); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); el.classList.remove('hide');
  } catch (e) { el.classList.add('hide'); }
}
function famHTML() {
  const k = Store.kind, db = Store.mode === 'db'; const me = (S.members || {})[RT.me] || {};
  const head = k === 'claude' ? ['家庭共用已開啟', '食譜、餐單、購物清單、雪櫃同煮食記錄，全家用同一份，一改即刻同步。']
    : k === 'firebase' ? ['家庭共用已開啟（Firebase）', '唔使 Claude 都即時同步。冇網時照用，有網就自動補上。']
    : ['呢部機嘅獨立版本', '資料只存喺呢部機。想同屋企人同步，可以用下面嘅 Firebase 免費同步，或者用分享碼經 WhatsApp 傳。'];
  const who = `<div class="card" style="box-shadow:none"><h3>我係…</h3>
    <div class="chips" style="margin-top:8px">${WHO.map(w => `<button class="chip" data-act="famWho" data-n="${w}" aria-pressed="${me.name === w}">${w}</button>`).join('')}</div>
    <input id="famName" class="inp" style="margin-top:8px" maxlength="10" placeholder="或者自己打，例如：阿 May" value="${esc(me.name || '')}" aria-label="我嘅稱呼">
    <div class="field" style="margin-top:8px"><label>我嘅頭像</label><div class="icon-pick" style="grid-template-columns:repeat(auto-fill,minmax(48px,1fr))">${WHO_ICONS.map(i => `<button type="button" data-act="famIcon" data-k="${i}" style="background:${iconBg(i)}" aria-pressed="${(me.icon || 'bun') === i}" aria-label="${ICONS[i].label}">${iconSVG(i)}</button>`).join('')}</div></div>
    <button class="btn pri" style="margin-top:10px" data-act="famSave">${li('check')}儲存</button></div>`;
  const taste = `<div class="card" style="box-shadow:none"><h3>屋企口味</h3><div class="small muted">推薦、自動搭配、轉盤同 AI 都會跟住呢度</div>
    <div class="field" style="margin-top:8px"><label for="famAvoid">唔食嘅嘢（用逗號分隔）</label><input id="famAvoid" class="inp" placeholder="例如：牛肉、花生、芫荽" value="${esc(S.settings.avoid || '')}"></div>
    <div class="field" style="margin-top:8px"><label for="famNote">口味備註</label><input id="famNote" class="inp" maxlength="80" placeholder="例如：爺爺要少鹽，細路唔食辣" value="${esc(S.settings.note || '')}"></div>
    <button class="btn pri" style="margin-top:10px" data-act="tasteSave">${li('check')}儲存口味</button></div>`;
  const inviteClaude = `<div class="card sun" style="box-shadow:none"><h3>點樣邀請屋企人</h3>
    <ol style="margin:8px 0 0;padding-left:20px;line-height:1.8"><li>喺 claude.ai 打開呢個 App，撳「分享」。</li><li>加屋企人嘅電郵，權限揀可以編輯（佢哋要有 Claude 帳戶）。</li><li>屋企人用手機嘅 Claude App 或者瀏覽器開條連結，登入之後就會即時同步。</li></ol>
    <div class="small muted" style="margin-top:8px">可以編輯嘅人先可以剔清單、加菜；只可以睇嘅人淨係睇到。有連結嘅人都可能睇到呢度嘅資料，請只分享俾屋企人。</div>
    <div class="small" style="margin-top:8px"><b>唔用 Claude 嘅屋企人：</b>用獨立版（網頁檔案包），配 Firebase 免費同步，或者用下面嘅分享碼。</div></div>`;
  const inviteFb = `<div class="card sun" style="box-shadow:none"><h3>邀請屋企人</h3><div class="small muted">屋企人用手機掃 QR code，或者撳 WhatsApp 收到嘅連結，就會加入同一個家庭。邀請碼好似鎖匙咁，只俾屋企人。</div>
    <div class="small" style="margin-top:6px"><b>iPhone 注意：</b>加咗去主畫面嘅 App 同 Safari 嘅資料係分開嘅。請先「加入主畫面」，再喺主畫面個 App 入面貼邀請碼加入。</div>
    <div id="famQR" class="hide" style="width:200px;max-width:70%;margin:10px auto;background:#fff;border:3px solid var(--ink);border-radius:14px;padding:6px"></div>
    <div class="row wrap" style="margin-top:8px"><button class="btn sm pri" data-act="fbCopyLink">${li('copy')}複製邀請連結</button><button class="btn sm" data-act="fbCopyCode">${li('copy')}複製邀請碼</button></div>
    <button class="btn sm coral" style="margin-top:12px" data-act="fbLeave">離開家庭（之後只用呢部機）</button></div>`;
  const setupFb = `<div class="card sun" style="box-shadow:none"><div class="sec-h"><span class="ic" style="background:#fff">${iconSVG('soup')}</span><div><h3>唔使 Claude 嘅即時同步（Firebase 免費）</h3><div class="small muted">一個人設定一次（大約 10 分鐘），其他屋企人掃 QR code 就加入</div></div></div>
    ${!location.protocol.startsWith('http') ? `<div class="small" style="margin-top:8px;background:#ffe3dc;border-radius:10px;padding:6px 10px">要先將呢個 App 放上網（例如 Netlify），開網址嘅版本先做到同步。</div>` : ''}
    <ol style="margin:10px 0 0;padding-left:20px;line-height:1.75">
      <li>用 Google 帳戶開 <b>console.firebase.google.com</b>，撳「建立專案／Create a project」，改個名，Analytics 可以唔開。</li>
      <li>喺專案主頁撳網頁圖示「&lt;/&gt;」加一個 Web App，註冊後會見到一段 <b>firebaseConfig</b>，成段複製。</li>
      <li>左邊揀「Firestore Database」→「建立資料庫／Create database」，地點可以揀 asia-east2（香港），用正式版模式。</li>
      <li>去「規則／Rules」分頁，貼上下面嘅規則，撳「發布／Publish」。</li>
      <li>返嚟呢度，喺下面貼上 firebaseConfig，撳「建立家庭」。</li></ol>
    <div class="field" style="margin-top:10px"><label>Firestore 規則</label><textarea class="inp" rows="7" readonly id="fbRules" aria-label="Firestore 規則" style="font-family:ui-monospace,monospace;font-size:12px">${esc(FB_RULES)}</textarea><button class="btn sm" data-act="fbCopyRules" style="align-self:flex-start">${li('copy')}複製規則</button></div>
    <div class="field" style="margin-top:10px"><label for="fbCfg">貼上 firebaseConfig</label><textarea id="fbCfg" class="inp" rows="5" placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, projectId: &quot;…&quot;, … };" style="font-family:ui-monospace,monospace;font-size:12px"></textarea></div>
    <button class="btn pri" style="margin-top:8px" data-act="fbCreate">${li('check')}建立家庭</button>
    <div class="field" style="margin-top:14px"><label for="fbJoin">或者：屋企人已經設定好？貼上邀請碼／連結（iPhone 主畫面 App 請用呢度）</label><input id="fbJoin" class="inp" placeholder="WZFZ:… 或者 https://…#join=…"></div>
    <button class="btn" style="margin-top:8px" data-act="fbJoinGo">${li('people')}加入家庭</button></div>`;
  const share = `<div class="card" style="box-shadow:none"><div class="sec-h"><span class="ic" style="background:${iconBg('basket')}">${iconSVG('basket')}</span><div><h3>分享碼同備份</h3><div class="small muted">唔使任何帳戶：將清單、餐單、雪櫃同食譜變成一段文字，WhatsApp 傳俾屋企人，佢貼上就會合併</div></div></div>
    <div class="row wrap" style="margin-top:10px"><button class="btn sm pri" data-act="shareCopy">${li('copy')}複製分享碼</button>${k !== 'claude' ? `<button class="btn sm" data-act="backupDl">${li('copy')}下載完整備份檔</button><label class="btn sm" for="backupFile" style="cursor:pointer">匯入備份檔</label><input id="backupFile" type="file" accept="application/json,.json" class="hide">` : ''}</div>
    <div class="field" style="margin-top:10px"><label for="shareIn">貼上屋企人傳嚟嘅分享碼</label><textarea id="shareIn" class="inp" rows="3" placeholder="鑊仔食譜分享碼… WZ1Z:…"></textarea></div>
    <button class="btn sun" style="margin-top:8px" data-act="shareMerge">${li('check')}合併入我嘅資料</button></div>`;
  return `<div class="card ${db && Store.live ? 'tint' : ''}" style="box-shadow:none"><div class="row"><span style="width:52px;height:52px;flex:none">${iconSVG('wok')}</span><div><b>${Store.canWrite === false ? '你而家只可以睇' : head[0]}</b><div class="small muted">${head[1]}</div></div></div></div>
  ${db ? `<div class="card" style="box-shadow:none"><h3>屋企成員</h3><div class="chips" style="margin-top:8px" data-fam-members>${familyIds().map(id => memberChip(id, id === RT.me ? '（你）' : '')).join('')}</div></div>${who}` : ''}
  ${k === 'firebase' ? inviteFb : k === 'claude' ? inviteClaude : setupFb}
  ${taste}${share}`;
}
async function openFam() {
  const bd = openSheet('家庭共用', famHTML()); bd.dataset.fam = '1'; bd._fam = { icon: (S.members || {})[RT.me]?.icon || 'bun' };
  const f = $('#backupFile', bd);
  if (f) f.addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try { const inc = JSON.parse(await file.text()); if (!inc || inc.app !== 'wokzai') throw 0; const n = mergeIn(inc.data || inc); save(); toast(`匯入咗 ${n} 樣嘢`); }
    catch (er) { toast('呢個唔係鑊仔食譜嘅備份檔'); }
  });
  if (Store.kind === 'firebase') { bd._invite = await packCode({ c: Store.fam.c, f: Store.fam.f }, 'WZF'); drawQR($('#famQR', bd), inviteLink(bd._invite) || bd._invite); }
}
function updateFamSheet() { const bd = $$('#sheets .backdrop').find(b => b.dataset.fam); if (!bd) return; const c = bd.querySelector('[data-fam-members]'); if (c) c.innerHTML = familyIds().map(id => memberChip(id, id === RT.me ? '（你）' : '')).join(''); }
async function joinWith(text) {
  let v; try { v = await unpackCode(String(text).replace(/^.*#join=/, ''), 'WZF'); } catch (e) { toast('邀請碼唔啱，請再複製一次'); return; }
  if (!v || !v.c || !v.c.apiKey || !v.f) { toast('邀請碼唔完整'); return; }
  if (Store.kind === 'claude') { toast('喺 Claude 入面已經有家庭共用，唔使用邀請碼'); return; }
  if (fbCfgSave({ c: v.c, f: v.f })) { Store.saveLocal(); toast('加入緊家庭…'); setTimeout(() => location.reload(), 600); }
}
Object.assign(ACTS, {
  fbCopyRules: () => copyOrShow(FB_RULES, 'Firestore 規則'),
  fbCreate: el => {
    const bd = sheetOf(el); const c = parseFbConfig($('#fbCfg', bd).value);
    if (!c) { toast('搵唔到 apiKey 同 projectId，請成段 firebaseConfig 貼上'); return; }
    if (fbCfgSave({ c, f: randCode(22) })) { Store.saveLocal(); toast('建立緊家庭，你嘅資料會一齊搬上去…'); setTimeout(() => location.reload(), 800); }
  },
  fbJoinGo: el => { const v = $('#fbJoin', sheetOf(el)).value.trim(); if (!v) { toast('貼上邀請碼先'); return; } joinWith(v); },
  fbCopyLink: el => { const bd = sheetOf(el); const l = inviteLink(bd._invite); if (!l) { toast('要放上網先有連結，可以用邀請碼'); return; } copyOrShow(`加入我哋屋企嘅鑊仔食譜：\n${l}`, '邀請連結'); },
  fbCopyCode: el => copyOrShow(sheetOf(el)._invite || '', '邀請碼'),
  fbLeave: el => {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = '再撳一次確認離開'; return; }
    try { localStorage.setItem(LS_KEY, JSON.stringify({ v: 2, init: true, favs: S.favs, plan: prunePlan(S.plan), shop: S.shop, pantry: S.pantry, settings: S.settings, members: S.members, log: S.log, recipes: S.recipes })); localStorage.removeItem(FB_KEY); } catch (e) { }
    toast('離開咗家庭，資料留咗一份喺呢部機'); setTimeout(() => location.reload(), 700);
  },
  shareCopy: async () => { try { copyOrShow(await shareText(), '分享碼'); } catch (e) { toast('整唔到分享碼'); } },
  shareMerge: async el => {
    const bd = sheetOf(el); const t = $('#shareIn', bd).value;
    try { const inc = await unpackCode(t, 'WZ1'); const n = mergeIn(inc); save(); $('#shareIn', bd).value = ''; toast(n ? `合併咗 ${n} 樣嘢` : '冇新嘢要合併'); }
    catch (e) { toast('搵唔到分享碼，請成段貼上'); }
  },
  backupDl: () => downloadText(`鑊仔食譜備份-${TODAY()}.json`, JSON.stringify({ app: 'wokzai', v: 2, at: new Date().toISOString(), data: { recipes: S.recipes, favs: S.favs, plan: S.plan, shop: S.shop, pantry: S.pantry, settings: S.settings, members: S.members, log: S.log } })),
  joinYes: el => { const bd = sheetOf(el); closeSheet(bd); joinWith(RT.joinCode); },
});

/* ===== 啟動 ===== */
async function boot() {
  renderTabs();
  const chip = document.createElement('button'); chip.id = 'timerChip'; chip.className = 'pill sun hide'; chip.dataset.act = 'timerGo'; chip.style.marginLeft = 'auto'; chip.style.cursor = 'pointer';
  $('header.top').insertBefore(chip, $('#sync'));
  let h = location.hash.slice(1);
  if (h.startsWith('join=')) { RT.joinCode = decodeURIComponent(h.slice(5)); h = 'home'; try { history.replaceState(null, '', location.pathname + location.search + '#home'); } catch (e) { } }
  if (S.demo) addDaysToShop([TODAY()], true);
  restoreTimers();
  show(VIEWS.some(x => x[0] === h) ? h : 'home', false);
  setSync();
  await Store.init();
  if (RT.fbErr) toast('連唔到 Firebase，暫時用呢部機嘅資料');
  if (Store.kind === 'firebase') { const data = await Store.loadLocal(); if (data && (data.init || (data.recipes && data.recipes.length))) S = normalize(data); RT.seed = S.demo ? null : clone(S); }
  if (Store.mode === 'db') {
    Store.subscribe((docs, meta) => {
      if (docs === null) {
        if (Store.kind === 'firebase' && meta && meta.timeout && RT.ready && !Store.live) toast('仲未連到 Firebase：如果一直咁，檢查網絡、firebaseConfig 同規則');
        if (!RT.ready) { RT.ready = true; refresh(); toast(meta && meta.error ? (Store.kind === 'firebase' ? '連唔到家庭資料：檢查 Firestore 規則同設定' : '連唔到家庭資料，等陣再試') : '網絡有啲慢，家庭資料載入緊'); }
        setSync(); return;
      }
      if (!Object.keys(docs).length) {
        if (meta.fromCache) { if (Store.kind === 'firebase' && !RT.ready) { RT.ready = true; refresh(); } return; }
        if (!RT.readyServer) {
          RT.readyServer = true; RT.ready = true; refresh();
          if (Store.kind === 'firebase') { if (!S.demo || RT.pending) { RT.pending = false; Store.sync(); toast('家庭建立好喇，你嘅資料已經上載'); } }
          else maybeMigrate().then(done => { if (!done && RT.pending) { RT.pending = false; Store.sync(); } });
        } else if (RT.pending) { RT.pending = false; Store.sync(); }
        setSync(); return;
      }
      S = stateFromDocs(docs);
      const first = !RT.ready; RT.ready = true; RT.pending = false;
      if (!meta.fromCache && !RT.readyServer) {
        RT.readyServer = true;
        if (RT.seed) { const extra = RT.seed.recipes.filter(r => !r.demo && !S.recipes.some(x => x.id === r.id)); RT.seed = null; if (extra.length) { S.recipes.push(...extra); Store.sync(); toast(`將你 ${extra.length} 個食譜加入咗家庭`); } }
      }
      scheduleRefresh(); resolveNames();
      if (first && RT.view === 'tools') setTimeout(renderTools, 0);
    });
  } else {
    const data = await Store.loadLocal();
    if (data && (data.init || (data.recipes && data.recipes.length))) S = normalize(data);
    RT.ready = true; if (RT.pending && !S.demo) Store.saveLocal();
    refresh(); if (RT.view === 'tools') renderTools();
  }
  if (RT.joinCode) openSheet('加入家庭？', `<div class="row"><span style="width:56px;height:56px;flex:none">${iconSVG('wok')}</span><div>有屋企人邀請你加入佢哋嘅鑊仔食譜。加入之後，清單、餐單同雪櫃會同佢哋即時同步。</div></div><div class="row wrap"><button class="btn pri" data-act="joinYes">${li('people')}加入</button><button class="btn" data-act="closeSheet">唔加入</button></div>`);
  initAI();
  if (window.WZ_STANDALONE && 'serviceWorker' in navigator && location.protocol.startsWith('http')) { try { navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { } }
}
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v.startsWith('join=')) { location.reload(); return; } if (v && v !== RT.view) show(v, false); });
boot();
