/* ===== 工具頁 ===== */
const MASS = { '克': 1, '公斤': 1000, '斤': 604.79, '両': 37.8, '磅': 453.59, '安士': 28.35 };
const VOL = { '毫升': 1, '公升': 1000, '杯': 240, '湯匙': 15, '茶匙': 5 };
const RICE = { '絲苗白米': [1.3, '洗兩次就夠，唔好大力搓'], '泰國香米': [1.2, '香米吸水少啲，水唔使太多'], '日本珍珠米': [1.1, '浸 30 分鐘先煲，會更煙韌'], '糙米': [1.6, '最好浸 1 至 2 個鐘先煲'], '煲粥（綿）': [10, '水滾先落米，間中攪吓唔好黐底'], '煲粥（稀）': [14, '啱做生滾粥底'] };
const EXP_DAYS = { veg: 4, meat: 2, sea: 1, egg: 10, dry: 90, sauce: 180, other: 7 };
const PRESETS = [['煲蛋（溏心）', 6], ['煲蛋（全熟）', 10], ['蒸魚', 8], ['灼菜', 1], ['煲飯', 20], ['焗蛋撻', 15], ['炆雞翼', 15], ['煲湯', 90]];
Object.assign(RT, { scale: { id: 'L01', n: 4 }, riceCups: 2, wheel: { rot: 0, spinning: false, items: [] }, wheelSeed: String(Math.random()) });
const fmtN = n => n >= 100 ? String(Math.round(n)) : n >= 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n * 100) / 100);
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function renderTools() {
  const el = $('#v-tools');
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `
    <div class="sec-h"><span class="ic" style="background:${iconBg('egg')}">${iconSVG('egg')}</span><div><h2>廚房工具</h2><div class="small muted">雪櫃、計時、轉盤、份量同換算，全部喺度</div></div></div>
    <div class="tools">
      <div class="card" id="tPantry" style="grid-column:1/-1">
        <div class="sec-h"><span class="ic" style="background:${iconBg('milk')}">${iconSVG('milk')}</span><div><h3>雪櫃管理</h3><div class="small muted">記低有乜食材同到期日，推薦會優先用就快過期嘅嘢</div></div>
          <div class="act"><button class="btn sm sun" data-act="pRec">${li('search')}用雪櫃食材推薦</button><button class="btn sm pri" data-act="pAI">${li('ai')}叫 AI 用雪櫃食材整</button></div></div>
        <form class="row wrap" id="pAdd" style="gap:8px;margin-top:12px">
          <input class="inp" id="paN" placeholder="食材，例如：豬扒" style="flex:2;min-width:130px" aria-label="食材名" required>
          <input class="inp" id="paQ" type="number" min="0" step="any" placeholder="數量" style="width:80px" aria-label="數量">
          <input class="inp" id="paU" placeholder="單位" style="width:70px" aria-label="單位">
          <input class="inp" id="paE" type="date" style="width:auto" aria-label="到期日">
          <button class="btn pri" type="submit">${li('plus')}放入雪櫃</button>
        </form>
        <div class="list" id="pList" style="margin-top:12px"></div>
      </div>
      <button class="card row wrap" style="grid-column:1/-1;text-align:left" data-act="famOpen"><span class="ic" style="width:44px;height:44px;flex:none;border:3px solid var(--ink);border-radius:14px;background:${iconBg('wok')};display:grid;place-items:center">${iconSVG('wok')}</span><div style="flex:1;min-width:160px"><h3>家庭共用、分享碼同備份</h3><div class="small muted">同屋企人同步、WhatsApp 傳清單、下載備份</div></div><span class="btn sm sun">打開</span></button>
      <div class="card" id="tTimer">
        <div class="sec-h"><span class="ic" style="background:${iconBg('egg')}">${iconSVG('egg')}</span><h3>計時器</h3></div>
        <div class="chips" style="margin-top:10px">${PRESETS.map(([l, m]) => `<button class="chip" data-act="stepTimer" data-l="${l}" data-s="${m * 60}">${l} ${m}′</button>`).join('')}</div>
        <form class="row" id="tAdd" style="gap:8px;margin-top:10px"><input class="inp" id="taL" placeholder="計乜？" aria-label="計時名稱"><input class="inp" id="taM" type="number" min="1" max="600" value="5" style="width:74px" aria-label="分鐘"><span class="small">分鐘</span><button class="btn pri sm" type="submit">${li('play')}開始</button></form>
        <div class="list" id="timerList" style="margin-top:10px"></div>
        <div class="small muted" style="margin-top:8px">手機鎖咗屏或者轉咗去其他 App，計時器可能唔會響，煮緊嘢時開住呢頁就最穩陣。</div>
      </div>
      <div class="card" id="tWheel">
        <div class="sec-h"><span class="ic" style="background:${iconBg('plate')}">${iconSVG('plate')}</span><h3>今日食乜好？</h3></div>
        <div class="chips" style="margin:10px 0" id="wSrc"></div>
        <div class="wheel-wrap"><canvas id="wheel" width="600" height="600" aria-label="食物轉盤"></canvas>
          <svg class="wheel-ptr" viewBox="0 0 34 40" aria-hidden="true"><path d="M17 38 L3 6 Q17 -2 31 6Z" fill="#ff8f7a" stroke="#10393b" stroke-width="3.5" stroke-linejoin="round"/></svg></div>
        <button class="btn sun block" style="margin-top:12px" data-act="spin">${li('shuffle')}轉！</button>
        <div id="wheelRes" style="margin-top:10px"></div>
      </div>
      <div class="card" id="tScale">
        <div class="sec-h"><span class="ic" style="background:${iconBg('salad')}">${iconSVG('salad')}</span><h3>份量計算</h3></div>
        <div class="row wrap" style="margin-top:10px"><select class="inp" id="scR" style="flex:1;min-width:150px" aria-label="揀食譜"></select>${'<span id="scStep"></span>'}</div>
        <div id="scOut" style="margin-top:8px"></div>
      </div>
      <div class="card" id="tConv">
        <div class="sec-h"><span class="ic" style="background:${iconBg('sauce')}">${iconSVG('sauce')}</span><div><h3>單位換算</h3><div class="small muted">包括香港斤両：1 斤 = 16 両 ≈ 605 克</div></div></div>
        <div class="row" style="margin-top:10px"><input class="inp" id="cvV" type="number" step="any" value="1" aria-label="數值" style="flex:1"><select class="inp" id="cvU" style="width:auto" aria-label="單位">${[...Object.keys(MASS), ...Object.keys(VOL)].map(u => `<option ${u === '斤' ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="conv" id="cvOut" style="margin-top:10px"></div>
      </div>
      <div class="card" id="tRice">
        <div class="sec-h"><span class="ic" style="background:${iconBg('rice')}">${iconSVG('rice')}</span><h3>煲飯水量</h3></div>
        <div class="row wrap" style="margin-top:10px"><select class="inp" id="rcT" style="flex:1;min-width:140px" aria-label="米種">${Object.keys(RICE).map(k => `<option>${k}</option>`).join('')}</select><span id="rcStep"></span><span class="small">米杯</span></div>
        <div id="rcOut" style="margin-top:10px"></div>
      </div>
    </div>`;
    $('#paE').value = dkey(addDays(new Date(), 7));
    $('#paN').addEventListener('input', e => { const c = ingInfo(e.target.value).cat; $('#paE').value = dkey(addDays(new Date(), EXP_DAYS[c] || 7)); });
    $('#pAdd').addEventListener('submit', e => {
      e.preventDefault(); const n = $('#paN').value.trim(); if (!n) return;
      const q = Number($('#paQ').value) || 0, u = $('#paU').value.trim(), exp = $('#paE').value || '';
      $('#paN').value = ''; $('#paQ').value = ''; $('#paU').value = '';
      S.pantry.push({ id: uid('p'), n, q, u, exp, by: RT.me || '' }); save(); toast(`${n} 放咗入雪櫃`);
    });
    $('#tAdd').addEventListener('submit', e => { e.preventDefault(); const m = Number($('#taM').value) || 0; if (m <= 0) return; startTimer($('#taL').value.trim() || `${m} 分鐘`, Math.round(m * 60)); $('#taL').value = ''; });
    $('#cvV').addEventListener('input', conv); $('#cvU').addEventListener('change', conv);
    $('#rcT').addEventListener('change', rice);
    $('#scR').addEventListener('change', e => { RT.scale.id = e.target.value; renderScaler(); });
    conv(); rice(); buildWheel();
  }
  renderPantry(); renderScaler(); renderTimers();
}
function renderPantry() {
  const el = $('#pList'); if (!el) return;
  const list = [...S.pantry].sort((a, b) => (a.exp || '9999') < (b.exp || '9999') ? -1 : 1);
  el.innerHTML = list.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px">${list.map(p => {
    const dl = p.exp ? daysLeft(p.exp) : null;
    const st = dl === null ? ['冇到期日', ''] : dl < 0 ? [`過咗期 ${-dl} 日`, 'coral'] : dl === 0 ? ['今日到期', 'sun'] : dl <= 2 ? [`仲有 ${dl} 日`, 'sun'] : [`仲有 ${dl} 日`, 'mint'];
    const ic = ingInfo(p.n).icon;
    return `<div class="li"><span class="ic" style="background:${iconBg(ic)}">${iconSVG(ic)}</span><div style="flex:1;min-width:0"><div class="nm">${esc(p.n)} <span class="small muted num">${p.q ? fmtQ(p.q) + ' ' + esc(p.u) : esc(p.u)}</span></div><span class="pill ${st[1]}">${st[0]}</span></div><button class="btn sm" data-act="pDel" data-id="${p.id}" aria-label="用咗 ${esc(p.n)}">用咗</button></div>`;
  }).join('')}</div>` : `<div class="empty">${iconSVG('milk')}<b>雪櫃空空如也</b><span>加啲食材，或者用 AI 影相認食材</span></div>`;
}
function renderScaler() {
  const sel = $('#scR'); if (!sel) return;
  const all = allRecipes(); if (!getRecipe(RT.scale.id)) RT.scale.id = all[0].id;
  sel.innerHTML = all.map(r => `<option value="${esc(r.id)}" ${r.id === RT.scale.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  $('#scStep').innerHTML = stepper('scale', RT.scale.n, '人數') + ' <span class="small">人</span>';
  const r = getRecipe(RT.scale.id); const f = RT.scale.n / (r.servings || 1);
  $('#scOut').innerHTML = `<div class="small muted">原本 ${r.servings} 人份 → ${RT.scale.n} 人份（× ${fmtN(f)}）</div>` +
    r.ings.map(i => `<div class="ing-row"><span class="ic">${iconSVG(ingInfo(i.n).icon)}</span><span>${esc(i.n)}</span><span class="q">${esc(qtyText(i, f))}</span></div>`).join('') +
    `<button class="btn sm sun" style="margin-top:8px" data-act="scShop">${li('cart')}加入購物清單</button>`;
}
function conv() {
  const v = Number($('#cvV').value) || 0, u = $('#cvU').value; const isM = u in MASS; const base = v * (isM ? MASS[u] : VOL[u]); const T = isM ? MASS : VOL;
  $('#cvOut').innerHTML = Object.entries(T).filter(([k]) => k !== u).map(([k, f]) => `<div><b>${fmtN(base / f)}</b><span>${k}</span></div>`).join('') +
    `<div><b>${fmtN(base)}</b><span>${isM ? '毫升（如果係水）' : '克（如果係水）'}</span></div>`;
}
function rice() {
  const t = $('#rcT').value; const [ratio, tip] = RICE[t]; const ml = RT.riceCups * 180 * ratio;
  $('#rcStep').innerHTML = stepper('rice', RT.riceCups, '米杯數');
  $('#rcOut').innerHTML = `<div class="row" style="gap:12px"><span style="width:56px;height:56px;flex:none">${iconSVG(t.includes('粥') ? 'congee' : 'rice')}</span><div><div class="num" style="font-size:26px">水 ≈ ${fmtN(ml)} 毫升</div><div class="small muted">米：水 大約 1 : ${ratio}（1 米杯 ≈ 180 毫升）・${esc(tip)}</div></div></div>`;
}

/* 計時器 */
let AC = null, tickH = null;
function ensureAudio() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } }
function beep() {
  if (!AC) return;
  try { const t0 = AC.currentTime; for (let i = 0; i < 4; i++) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = i % 2 ? 660 : 880; const s = t0 + i * .32; g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.35, s + .02); g.gain.exponentialRampToValueAtTime(.0001, s + .28); o.connect(g).connect(AC.destination); o.start(s); o.stop(s + .3); } } catch (e) { }
}
function openUsed(id) {
  const r = getRecipe(id); if (!r) return;
  const hits = S.pantry.filter(p => r.ings.some(i => nameMatch(i.n, p.n)));
  if (!hits.length) return;
  openSheet('用咗雪櫃邊啲嘢？', `<div class="small muted">剔咗嘅會由雪櫃清單刪走，冇用晒嘅可以撳一下取消</div>
    <div class="list">${hits.map(p => `<div class="li"><button class="check" role="checkbox" aria-checked="true" data-act="usedItem" data-id="${p.id}" aria-label="用晒 ${esc(p.n)}"></button><span class="ic" style="background:${iconBg(ingInfo(p.n).icon)}">${iconSVG(ingInfo(p.n).icon)}</span><div class="nm">${esc(p.n)}</div><span class="q small">${p.q ? fmtQ(p.q) + ' ' + esc(p.u) : ''}</span></div>`).join('')}</div>
    <div class="row wrap"><button class="btn pri" data-act="usedGo">${li('check')}用晒，刪走</button><button class="btn" data-act="closeSheet">唔使</button></div>`);
}
function startTimer(label, sec) {
  ensureAudio();
  RT.timers.unshift({ id: uid('t'), label, total: sec, left: sec, end: Date.now() + sec * 1000, running: true, fired: false });
  renderTimers(); tick(); toast(`開始計時：${label}`);
}
function tick() {
  if (tickH) return;
  tickH = setInterval(() => {
    let any = false; const now = Date.now();
    RT.timers.forEach(t => {
      if (!t.running) return; any = true;
      t.left = Math.max(0, Math.round((t.end - now) / 1000));
      if (t.left <= 0 && !t.fired) { t.fired = true; t.running = false; beep(); toast(`夠鐘喇！${t.label}`); try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) { } renderTimers(); }
    });
    updateTimersFast();
    if (!any) { clearInterval(tickH); tickH = null; }
  }, 250);
}
function timerRing(t) { const r = 18, c = 2 * Math.PI * r; const p = t.total ? t.left / t.total : 0; return `<svg viewBox="0 0 46 46" width="46" height="46" aria-hidden="true"><circle cx="23" cy="23" r="${r}" fill="#fff" stroke="#e1f3f0" stroke-width="7"/><circle class="rg" cx="23" cy="23" r="${r}" fill="none" stroke="var(--teal)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 23 23)"/></svg>`; }
function saveTimers() { try { localStorage.setItem('wokzai-timers', JSON.stringify(RT.timers.slice(0, 12))); } catch (e) { } }
function restoreTimers() {
  try { const t = JSON.parse(localStorage.getItem('wokzai-timers') || '[]'); if (!Array.isArray(t)) return; const now = Date.now();
    RT.timers = t.filter(x => x && x.id && x.total).map(x => { if (x.running) { x.left = Math.max(0, Math.round((x.end - now) / 1000)); if (x.left <= 0) { x.running = false; x.fired = true; } } return x; });
    if (RT.timers.some(x => x.running)) tick(); updateTimerChip();
  } catch (e) { }
}
function renderTimers() {
  saveTimers();
  const el = $('#timerList');
  if (el) el.innerHTML = RT.timers.length ? RT.timers.map(t => `<div class="timer ${t.fired ? 'ring-done' : ''}" id="tm-${t.id}">${timerRing(t)}<div style="flex:1;min-width:0"><div class="t">${mmss(t.left)}</div><div class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.label)}${t.fired ? '・夠鐘！' : t.running ? '' : '・暫停'}</div></div>
    <button class="btn icon sm" data-act="tToggle" data-id="${t.id}" aria-label="${t.running ? '暫停' : '繼續'}">${li(t.running ? 'pause' : 'play')}</button>
    <button class="btn sm" data-act="tPlus" data-id="${t.id}">+1′</button>
    <button class="btn icon sm" data-act="tDel" data-id="${t.id}" aria-label="刪除計時">${li('x')}</button></div>`).join('') : `<div class="small muted">撳上面嘅預設或者自己打分鐘數開始計時</div>`;
  updateTimerChip();
}
function updateTimersFast() {
  RT.timers.forEach(t => { const el = $(`#tm-${t.id}`); if (!el) return; el.querySelector('.t').textContent = mmss(t.left); const rg = el.querySelector('.rg'); if (rg) { const c = 2 * Math.PI * 18; rg.setAttribute('stroke-dashoffset', c * (1 - (t.total ? t.left / t.total : 0))); } });
  updateTimerChip();
}
function updateTimerChip() {
  const ch = $('#timerChip'); if (!ch) return;
  const run = RT.timers.filter(t => t.running); const fired = RT.timers.filter(t => t.fired);
  if (!run.length && !fired.length) { ch.classList.add('hide'); return; }
  ch.classList.remove('hide');
  ch.innerHTML = run.length ? `${li('clock', 'mi')}${mmss(Math.min(...run.map(t => t.left)))}${run.length > 1 ? ` ×${run.length}` : ''}` : '夠鐘喇！';
  ch.setAttribute('aria-label', run.length ? `${run.length} 個計時器，撳去睇` : '計時夠鐘');
  ch.classList.toggle('coral', !run.length);
}

/* 轉盤 */
function wheelItems() {
  const s = RT.wheelSrc; let list;
  if (s === 'mine') list = [...S.recipes, ...LIB.filter(r => isFav(r.id))];
  else if (s === 'quick') list = allRecipes().filter(r => r.time <= 20);
  else if (s === 'soup') list = allRecipes().filter(r => r.type === 'soup' || r.type === 'staple');
  else list = allRecipes().filter(r => r.type !== 'dessert');
  list = [...new Map(list.filter(r => !avoidHit(r)).map(r => [r.id, r])).values()].sort((a, b) => hashRand(a.id + RT.wheelSeed) - hashRand(b.id + RT.wheelSeed)).slice(0, 10);
  return list.length >= 2 ? list : allRecipes().slice(0, 8);
}
function buildWheel() {
  const src = [['all', '全部'], ['mine', '我嘅＋收藏'], ['quick', '20 分鐘內'], ['soup', '湯／飯麵']];
  $('#wSrc').innerHTML = src.map(([k, l]) => `<button class="chip" data-act="wSrc" data-k="${k}" aria-pressed="${RT.wheelSrc === k}">${l}</button>`).join('');
  RT.wheel.items = wheelItems(); drawWheel(); try { document.fonts && document.fonts.ready.then(drawWheel); } catch (e) { }
}
function drawWheel() {
  const cv = $('#wheel'); if (!cv) return; const ctx = cv.getContext('2d'); const items = RT.wheel.items; const N = items.length;
  const size = 600, c = size / 2, R = c - 12, seg = 2 * Math.PI / N; const rot = RT.wheel.rot;
  const cols = ['#bdeee6', '#ffffff', '#ffe9a8', '#d6eefb', '#ffe0d6'];
  ctx.clearRect(0, 0, size, size); ctx.lineJoin = 'round';
  items.forEach((r, i) => {
    const a = rot + i * seg; ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, a, a + seg); ctx.closePath();
    let col = cols[i % cols.length]; if (i === N - 1 && N % cols.length === 1) col = cols[2];
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#10393b'; ctx.lineWidth = 5; ctx.stroke();
    ctx.save(); ctx.translate(c, c); ctx.rotate(a + seg / 2); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#10393b'; ctx.font = `${N > 8 ? 27 : 31}px Huninn, "Noto Sans TC", sans-serif`;
    ctx.fillText(r.name.length > 6 ? r.name.slice(0, 6) + '…' : r.name, R - 20, 0); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.lineWidth = 9; ctx.strokeStyle = '#10393b'; ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, 56, 0, Math.PI * 2); ctx.fillStyle = '#15a596'; ctx.fill(); ctx.lineWidth = 7; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '40px Huninn, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('轉', c, c + 2);
}
function spin() {
  if (RT.wheel.spinning) return;
  const items = RT.wheel.items; const N = items.length; const seg = 2 * Math.PI / N; const i = Math.floor(Math.random() * N);
  const cur = RT.wheel.rot; let target = -Math.PI / 2 - (i + .5) * seg; while (target < cur + Math.PI * 10) target += Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const dur = reduce ? 200 : 3200; const t0 = performance.now();
  RT.wheel.spinning = true; $('#wheelRes').innerHTML = '';
  const step = now => {
    const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - p, 3);
    RT.wheel.rot = cur + (target - cur) * e; drawWheel();
    if (p < 1) requestAnimationFrame(step);
    else { RT.wheel.spinning = false; RT.wheel.rot = target % (Math.PI * 2); const r = items[i]; $('#wheelRes').innerHTML = `<div class="card tint" style="box-shadow:none;padding:10px"><div class="small">鑊仔話今日食：</div><div class="dish" style="margin-top:6px">${dishIc(r)}<div style="flex:1;min-width:0"><div class="nm">${esc(r.name)}</div><div class="sub">${r.time} 分鐘・${r.kcal || '–'} 大卡</div></div></div><div class="row wrap" style="margin-top:8px"><button class="btn sm sun" data-act="wAdd" data-id="${esc(r.id)}">${li('plus')}加入今晚</button><button class="btn sm" data-act="open" data-id="${esc(r.id)}">睇食譜</button></div></div>`; }
  };
  requestAnimationFrame(step);
}

/* ===== AI ===== */
const AI = { s: null, checked: false };
Object.assign(RT, { ai: { people: 2, time: 30, tastes: new Set(), cuisine: '隨意', photo: null, items: [], menu: [], mPeople: 3, mMeal: 'd', mStyle: '一湯兩餸' }, aiCache: {} });
const VOICE = '你係香港家常菜廚師「鑊仔」。用香港廣東話書面語（繁體中文，例如「落鑊」「煮滾」「啲」「嘅」「咗」）寫嘢，用香港常用食材叫法。';
const ICON_LIST = ICON_KEYS.map(k => `${k}（${ICONS[k].label}）`).join('、');
const RECIPE_FMT = `{"name":"菜名","desc":"一句介紹","icon":"插圖代號","type":"meat|sea|veg|soup|staple|dessert","cuisine":"粵菜|港式|家常|西式|日韓|東南亞","time":總分鐘數字,"level":1到3,"servings":人數,"kcal":每份大卡數字,"p":每份蛋白質克,"c":每份碳水克,"f":每份脂肪克,"tags":["最多3個短標籤"],"ings":[{"n":"材料名","q":數字（適量就寫0）,"u":"單位，例如 克、毫升、個、隻、條、湯匙、茶匙","cat":"veg|meat|sea|egg|dry|sauce|water|other"}],"steps":[{"t":"步驟內容","min":呢步要等或者煮嘅分鐘數，冇就寫0}],"tips":"一句小貼士"}`;

async function initAI() {
  const cl = window.claude;
  if (cl && cl.use) { try { AI.s = await cl.use('sample'); } catch (e) { AI.s = null; } }
  AI.checked = true; updateAIAvail();
}
function updateAIAvail() { document.body.classList.toggle('no-ai', AI.checked && !AI.s); const off = $('#aiOff'); if (off) off.classList.toggle('hide', !AI.checked || !!AI.s); const fn = $('#aiFamNote'); if (fn) fn.textContent = familyLine() ? '會跟埋屋企口味：' + familyLine().replace(/\n/g, '；') : ''; }
function needAI() { if (AI.s) return true; toast(AI.checked ? 'AI 要喺 Claude 入面打開呢個 App 先用到' : 'AI 準備緊，等一陣再試'); return false; }
function looseJSON(t) {
  t = String(t || '').replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw { code: 'bad', message: 'AI 回覆唔係食譜格式' };
  return JSON.parse(t.slice(a, b + 1));
}
async function askJSON(prompt, opts = {}) {
  if (typeof AI.s.json === 'function') {
    try { const v = await AI.s.json(prompt, opts); if (v && typeof v === 'object') return v; }
    catch (e) { if (e && ['not_granted', 'rate_limited', 'revoked', 'capability_disabled'].includes(e.code)) throw e; }
  }
  const r = await AI.s(prompt, opts);
  return looseJSON(r.text);
}
function aiErrHTML(e) {
  const c = e && e.code;
  const msg = c === 'not_granted' ? '未批准使用 AI。再撳一次，喺彈出視窗揀允許就得。' : c === 'rate_limited' ? 'AI 而家太忙，等一兩分鐘再試。' : (e && e.message) ? 'AI 做唔到：' + e.message : 'AI 做唔到，再試一次。';
  return `<div class="card coral" style="box-shadow:none;background:#ffe3dc;padding:10px 12px">${esc(msg)}</div>`;
}
function loadingHTML(msg) { return `<div class="loading-wok" role="status"><div class="w">${iconSVG('wok')}<span class="bit">${iconSVG('egg')}</span><span class="bit">${iconSVG('tomato')}</span><span class="bit">${iconSVG('leaf')}</span></div>${esc(msg)}</div>`; }
function num(v, a, b, d) { v = Number(v); return isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : d; }
function normAI(o, fallbackName) {
  if (!o || typeof o !== 'object') throw { code: 'bad', message: '回覆格式唔啱' };
  const ings = (Array.isArray(o.ings) ? o.ings : []).slice(0, 20).map(i => { const n = String(i?.n || i?.name || '').slice(0, 24); return { n, q: Number(i?.q) || 0, u: String(i?.u || '').slice(0, 8), cat: (CATS[i?.cat] || i?.cat === 'water') ? i.cat : ingInfo(n).cat }; }).filter(i => i.n);
  const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, 15).map(s => typeof s === 'string' ? { t: s, min: 0 } : { t: String(s?.t || s?.text || '').slice(0, 300), min: num(s?.min, 0, 600, 0) }).filter(s => s.t);
  if (!ings.length || !steps.length) throw { code: 'bad', message: '冇俾齊材料同步驟，再試多次' };
  const icon = ICONS[o.icon] && o.icon !== 'wok' ? o.icon : (ingIcons({ ings })[0] || 'plate');
  return { id: uid('U-'), name: String(o.name || fallbackName || 'AI 食譜').slice(0, 30), desc: String(o.desc || '').slice(0, 120), icon, type: TYPES[o.type] ? o.type : 'veg', cuisine: CUISINES.includes(o.cuisine) ? o.cuisine : '家常', time: num(o.time, 1, 600, 30), level: num(o.level, 1, 3, 1), servings: num(o.servings, 1, 30, 2), kcal: num(o.kcal, 0, 3000, 0), p: num(o.p, 0, 300, 0), c: num(o.c, 0, 500, 0), f: num(o.f, 0, 300, 0), tags: (Array.isArray(o.tags) ? o.tags : []).slice(0, 4).map(t => String(t).slice(0, 8)), ings, steps, tips: String(o.tips || '').slice(0, 200), src: 'ai' };
}
function genPrompt({ ings, people, time, tastes, cuisine, extra, name }) {
  return [VOICE, name ? `請寫「${name}」嘅食譜。` : '請設計一個家常食譜。',
    ings ? `可以用嘅食材：${ings}（唔使全部用，可以加常見調味料）` : '', `人數：${people || 2} 人`,
    time ? `總時間：${time} 分鐘內` : '', tastes ? `口味：${tastes}` : '', cuisine && cuisine !== '隨意' ? `菜系：${cuisine}` : '', extra ? `其他要求：${extra}` : '',
    familyLine(), `icon 由以下代號揀最貼切嘅一個：${ICON_LIST}`, '只可以回覆一個 JSON 物件，唔好有 markdown 或者其他文字，格式：', RECIPE_FMT].filter(Boolean).join('\n');
}
function genPreview(r, inSheet = false) {
  RT.aiCache[r.id] = r; const saved = S.recipes.some(x => x.id === r.id);
  return `<div class="card" style="${inSheet ? 'box-shadow:none' : ''}">
    <div class="grid" style="grid-template-columns:minmax(0,120px) 1fr;gap:12px;align-items:center">${illHTML(r)}<div><h3>${esc(r.name)}</h3><div class="small muted">${esc(r.desc)}</div><div class="chips" style="margin-top:6px"><span class="pill">${li('clock', 'mi')}${r.time} 分鐘</span><span class="pill coral">${r.kcal || '–'} 大卡</span><span class="pill mint">${TYPES[r.type].label}</span></div></div></div>
    <h4 style="margin-top:10px">材料（${r.servings} 人份）</h4>
    <div class="chips" style="margin-top:6px">${r.ings.map(i => `<span class="chip" style="background:${iconBg(ingInfo(i.n).icon)}">${iconSVG(ingInfo(i.n).icon)}${esc(i.n)} <span class="num small">${esc(qtyText(i))}</span></span>`).join('')}</div>
    <h4 style="margin-top:10px">步驟</h4>
    ${r.steps.map((s, i) => `<div class="step"><span class="n">${i + 1}</span><div style="flex:1">${esc(s.t)}${s.min ? ` <span class="pill">${s.min} 分鐘</span>` : ''}</div></div>`).join('')}
    ${r.tips ? `<div class="small" style="margin-top:6px"><b>小貼士：</b>${esc(r.tips)}</div>` : ''}
    <div class="row wrap" style="margin-top:12px"><button class="btn pri" data-act="aiSave" data-id="${r.id}" ${saved ? 'disabled' : ''}>${li('check')}${saved ? '已儲存' : '儲存入食譜簿'}</button><button class="btn sun" data-act="aiPlan" data-id="${r.id}">${li('plus')}加菜到餐單</button><button class="btn" data-act="aiShop" data-id="${r.id}">${li('cart')}材料加入清單</button></div>
  </div>`;
}
function saveAIRecipe(id) { const r = RT.aiCache[id]; if (!r) return null; if (!S.recipes.some(x => x.id === id)) { r.created = Date.now(); r.by = RT.me || ''; S.recipes.unshift(r); save({ recipe: r }); } return r; }

function renderAI() {
  const el = $('#v-ai');
  if (!el.dataset.built) {
    el.dataset.built = '1'; const A = RT.ai;
    el.innerHTML = `
    <div class="card hero"><div style="position:relative;z-index:1"><h1>AI 廚房</h1><p>話我知你有乜食材，鑊仔幫你諗食譜、認食材、砌一餐。</p></div><div class="mwrap">${iconSVG('wok', 'mascot')}</div>
      <span class="deco" style="right:8px;top:4px;transform:rotate(12deg)">${iconSVG('broccoli')}</span></div>
    <div id="aiOff" class="card ai-off hide"><span style="width:56px;height:56px;flex:none">${iconSVG('wok')}</span><div><b>AI 未開通</b><div class="small">要喺 Claude 入面打開呢個 App 先用到 AI。食譜、清單、餐單、工具照用得。</div></div></div>
    <div class="card" id="aiGenCard">
      <div class="sec-h"><span class="ic" style="background:${iconBg('tomato')}">${iconSVG('tomato')}</span><div><h2>自動生成食譜</h2><div class="small muted">連插圖、營養同步驟一次過整好</div></div></div>
      <div class="field" style="margin-top:12px"><label for="aiIngs">有乜食材？</label><div class="row"><input id="aiIngs" class="inp" placeholder="例如：雞翼、薯仔、洋蔥"><button class="btn sm" data-act="aiPantry">${li('plus')}用雪櫃食材</button></div></div>
      <div class="row wrap" style="margin-top:10px"><span class="small">人數</span><span id="aiPplS">${stepper('aiPpl', A.people, '人數')}</span><span class="small" style="margin-left:8px">時間</span><div class="chips">${[[15, '15 分鐘'], [30, '30 分鐘'], [60, '1 個鐘'], [0, '唔限']].map(([v, l]) => `<button class="chip" data-act="aiTime" data-v="${v}" aria-pressed="${A.time === v}">${l}</button>`).join('')}</div></div>
      <div class="field" style="margin-top:10px"><label>口味（可以揀多個）</label><div class="chips">${['清淡', '濃味', '微辣', '酸甜', '少油', '高蛋白', '細路啱食'].map(t => `<button class="chip" data-act="aiTaste" data-v="${t}" aria-pressed="false">${t}</button>`).join('')}</div></div>
      <div class="field" style="margin-top:10px"><label>菜系</label><div class="chips">${['隨意', ...CUISINES].map(c => `<button class="chip" data-act="aiCui" data-v="${c}" aria-pressed="${A.cuisine === c}">${c}</button>`).join('')}</div></div>
      <div class="field" style="margin-top:10px"><label for="aiExtra">其他要求</label><input id="aiExtra" class="inp" placeholder="例如：唔食牛、用氣炸鍋、要可以帶飯"></div>
      <div class="small muted" id="aiFamNote" style="margin-top:8px"></div>
      <button class="btn pri block" style="margin-top:12px" data-act="aiGen">${li('ai')}生成食譜</button>
      <div id="aiGenOut" style="margin-top:12px"></div>
    </div>
    <div class="card" id="aiPhotoCard">
      <div class="sec-h"><span class="ic" style="background:${iconBg('basket')}">${iconSVG('basket')}</span><div><h2>影相認食材</h2><div class="small muted">影低雪櫃或者買返嚟嘅餸，AI 幫你列出食材</div></div></div>
      <label class="dropzone" for="aiFile" style="margin-top:12px;cursor:pointer">${iconSVG('basket')}撳呢度揀相或者影相</label>
      <input id="aiFile" type="file" accept="image/*" class="hide">
      <img id="aiPrev" class="photo-prev hide" alt="揀咗嘅相" style="margin-top:10px">
      <button class="btn pri block" style="margin-top:10px" data-act="aiPhoto" id="aiPhotoBtn" disabled>${li('search')}認食材</button>
      <div id="aiPhotoOut" style="margin-top:10px"></div>
    </div>
    <div class="card" id="aiMenuCard">
      <div class="sec-h"><span class="ic" style="background:${iconBg('soup')}">${iconSVG('soup')}</span><div><h2>幫我砌一餐</h2><div class="small muted">營養均衡、有菜有肉有湯</div></div></div>
      <div class="row wrap" style="margin-top:12px"><span class="small">人數</span><span id="aiMPS">${stepper('aiMP', A.mPeople, '人數')}</span><div class="chips">${['l', 'd'].map(m => `<button class="chip" data-act="aiMM" data-v="${m}" aria-pressed="${A.mMeal === m}">${MEALS[m]}</button>`).join('')}</div></div>
      <div class="chips" style="margin-top:10px">${['一湯兩餸', '三餸一湯', '兩餸一甜品', '輕食', '宴客'].map(s => `<button class="chip" data-act="aiMS" data-v="${s}" aria-pressed="${A.mStyle === s}">${s}</button>`).join('')}</div>
      <input id="aiMExtra" class="inp" style="margin-top:10px" placeholder="例如：有老人家，要軟身少鹽" aria-label="砌餐要求">
      <button class="btn pri block" style="margin-top:12px" data-act="aiMenu">${li('ai')}砌一餐</button>
      <div id="aiMenuOut" style="margin-top:12px"></div>
    </div>
    <div class="card" id="aiAskCard">
      <div class="sec-h"><span class="ic" style="background:${iconBg('wok')}">${iconSVG('wok')}</span><div><h2>問鑊仔</h2><div class="small muted">煮食疑難，即問即答</div></div></div>
      <div class="chips" style="margin-top:10px">${['點樣煎魚唔黐鑊？', '雞胸點煮先唔韌？', '剩飯可以點變花樣？', '湯太鹹點救？'].map(q => `<button class="chip" data-act="aiAskEx">${q}</button>`).join('')}</div>
      <textarea id="aiQ" class="inp" style="margin-top:10px" placeholder="打你嘅問題…" aria-label="問題"></textarea>
      <button class="btn pri" style="margin-top:10px" data-act="aiAsk">${li('ai')}問</button>
      <div id="aiAskOut" class="ai-out" style="margin-top:10px"></div>
    </div>`;
    $('#aiFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { RT.ai.photo = await resizeImage(f, 1024, .8); const img = $('#aiPrev'); img.src = URL.createObjectURL(RT.ai.photo); img.classList.remove('hide'); $('#aiPhotoBtn').disabled = false; $('#aiPhotoOut').innerHTML = ''; }
      catch (er) { toast('開唔到呢張相，試下另一張'); }
    });
  }
  updateAIAvail();
}
async function aiGen(extra = {}) {
  if (!needAI()) return;
  const A = RT.ai; const out = $('#aiGenOut'); const btn = $('[data-act=aiGen]');
  out.innerHTML = loadingHTML('鑊仔諗緊食譜…'); btn.disabled = true;
  try {
    const o = await askJSON(genPrompt({ ings: $('#aiIngs').value.trim(), people: A.people, time: A.time, tastes: [...A.tastes].join('、'), cuisine: A.cuisine, extra: $('#aiExtra').value.trim(), ...extra }));
    const r = normAI(o); out.innerHTML = genPreview(r);
  } catch (e) { out.innerHTML = aiErrHTML(e); }
  finally { btn.disabled = false; }
}
async function aiGenSheet(name) {
  if (!needAI()) return;
  const bd = openSheet('AI 食譜：' + name, loadingHTML('鑊仔寫緊食譜…'));
  try { const o = await askJSON(genPrompt({ name, people: S.settings.people || 2 })); const r = normAI(o, name); if (bd.isConnected) bd.querySelector('.body').innerHTML = genPreview(r, true); }
  catch (e) { if (bd.isConnected) bd.querySelector('.body').innerHTML = aiErrHTML(e); }
}
async function aiPhoto() {
  if (!needAI() || !RT.ai.photo) return;
  const out = $('#aiPhotoOut');
  let lim = null; try { lim = await AI.s.limits(); } catch (e) { }
  if (!(lim && lim.images)) { out.innerHTML = `<div class="small muted">呢度暫時唔支援 AI 睇相。可以直接喺上面「自動生成食譜」打食材名。</div>`; return; }
  out.innerHTML = loadingHTML('鑊仔睇緊張相…');
  try {
    const o = await askJSON(`${VOICE}\n睇吓呢張相入面有咩食材。只回覆 JSON：{"items":[{"n":"食材名（香港叫法）","q":估計數量或者0,"u":"單位","cat":"veg|meat|sea|egg|dry|sauce|other"}]}。如果唔係食物相，回覆 {"items":[]}。`, { images: [RT.ai.photo] });
    RT.ai.items = (Array.isArray(o.items) ? o.items : []).slice(0, 30).map(i => ({ n: String(i?.n || '').slice(0, 20), q: Number(i?.q) || 0, u: String(i?.u || '').slice(0, 6), cat: CATS[i?.cat] ? i.cat : ingInfo(String(i?.n || '')).cat, on: true })).filter(i => i.n);
    drawPhotoItems();
  } catch (e) { out.innerHTML = aiErrHTML(e); }
}
function drawPhotoItems() {
  const out = $('#aiPhotoOut'); const it = RT.ai.items;
  if (!it.length) { out.innerHTML = `<div class="empty">${iconSVG('basket')}<b>搵唔到食材</b><span>試下影清楚啲，或者近啲影</span></div>`; return; }
  out.innerHTML = `<div class="small muted">認到 ${it.length} 樣，撳一下可以剔走：</div><div class="chips" style="margin-top:8px">${it.map((i, k) => `<button class="chip" data-act="aiItem" data-i="${k}" aria-pressed="${i.on}">${iconSVG(ingInfo(i.n).icon)}${esc(i.n)}${i.q ? ` <span class="num small">${fmtQ(i.q)}${esc(i.u)}</span>` : ''}</button>`).join('')}</div>
    <div class="row wrap" style="margin-top:10px"><button class="btn sun sm" data-act="aiItemsPantry">${li('plus')}放入雪櫃</button><button class="btn pri sm" data-act="aiItemsGen">${li('ai')}用呢啲生成食譜</button></div>`;
}
async function aiMenu() {
  if (!needAI()) return;
  const A = RT.ai; const out = $('#aiMenuOut'); const btn = $('[data-act=aiMenu]');
  out.innerHTML = loadingHTML('鑊仔砌緊餐單…'); btn.disabled = true;
  try {
    const prompt = [VOICE, `幫一家 ${A.mPeople} 人砌一餐${MEALS[A.mMeal]}，款式：${A.mStyle}。`, $('#aiMExtra').value.trim() ? `要求：${$('#aiMExtra').value.trim()}` : '', '要營養均衡、顏色好睇、煮嘅時間可以同步。', familyLine(), `icon 由以下代號揀：${ICON_LIST}`,
      '只回覆一個 JSON 物件，唔好有其他文字：{"title":"一句講呢餐","dishes":[每個餸用以下格式，每個最多 8 樣材料、5 個步驟]}', RECIPE_FMT].filter(Boolean).join('\n');
    const o = await askJSON(prompt);
    const dishes = (Array.isArray(o.dishes) ? o.dishes : []).slice(0, 6).map(d => { try { return normAI({ ...d, servings: d.servings || A.mPeople }); } catch (e) { return null; } }).filter(Boolean);
    if (!dishes.length) throw { code: 'bad', message: '冇砌到餸，再試一次' };
    A.menu = dishes; A.menuTitle = String(o.title || '').slice(0, 60);
    dishes.forEach(d => RT.aiCache[d.id] = d);
    const kc = dishes.reduce((s, d) => s + d.kcal, 0);
    out.innerHTML = `<div class="card tint" style="box-shadow:none">${A.menuTitle ? `<h3>${esc(A.menuTitle)}</h3>` : ''}<div class="small muted">每人大約 ${kc} 大卡・撳個餸睇詳細</div>
      <div class="grid gcards" style="margin-top:10px">${dishes.map(d => `<div class="rcard" role="button" tabindex="0" data-act="aiPreview" data-id="${d.id}">${illHTML(d)}<h4>${esc(d.name)}</h4><div class="meta"><span>${TYPES[d.type].label}</span><span>${d.time} 分鐘</span><span>${d.kcal} 大卡</span></div></div>`).join('')}</div>
      <button class="btn pri block" style="margin-top:12px" data-act="aiMenuAll">${li('check')}全部儲存，加入今日${MEALS[A.mMeal]}</button></div>`;
  } catch (e) { out.innerHTML = aiErrHTML(e); }
  finally { btn.disabled = false; }
}
async function aiAsk(q) {
  if (!needAI()) return;
  q = (q || $('#aiQ').value).trim(); if (!q) { toast('打個問題先'); return; }
  const out = $('#aiAskOut'); out.innerHTML = loadingHTML('鑊仔諗緊…'); let got = false;
  try {
    const res = await AI.s(`${VOICE}用親切嘅語氣答以下煮食問題，200 字以內，有需要就用簡短列點，唔好用 markdown 標題：\n${familyLine() ? familyLine() + '\n' : ''}問題：${q}`, { cache: false, onText: ({ text }) => { if (text && text !== 'Thinking...') { got = true; out.textContent = text; } } });
    out.textContent = res.text || (got ? out.textContent : '冇答案，再試一次');
  } catch (e) { out.innerHTML = aiErrHTML(e); }
}
async function aiPair(id, bd) {
  if (!needAI()) return;
  const r = getRecipe(id); const out = $('#aiPairOut', bd); if (!out) return;
  out.innerHTML = loadingHTML('鑊仔諗緊點配…');
  try {
    const o = await askJSON(`${VOICE}\n我今餐有「${r.name}」（${TYPES[r.type]?.label}）。建議 3 個最夾嘅餸、湯或者主食，令成餐更均衡。${familyLine()}\nicon 由以下揀：${ICON_LIST}\n只回覆 JSON：{"ideas":[{"name":"菜名","type":"meat|sea|veg|soup|staple|dessert","icon":"代號","why":"一句原因"}]}`);
    const ideas = (Array.isArray(o.ideas) ? o.ideas : []).slice(0, 4).filter(x => x && x.name);
    out.innerHTML = ideas.length ? `<div class="list">${ideas.map(x => { const ic = ICONS[x.icon] && x.icon !== 'wok' ? x.icon : 'plate'; return `<div class="dish"><span class="ic" style="background:${iconBg(ic)}">${iconSVG(ic)}</span><div style="flex:1;min-width:0"><div class="nm">${esc(String(x.name).slice(0, 30))}</div><div class="sub">${esc(String(x.why || '').slice(0, 60))}</div></div><button class="btn sm pri" data-act="aiGenName" data-n="${esc(String(x.name).slice(0, 30))}">${li('ai')}生成</button></div>`; }).join('')}</div>` : '<div class="small muted">AI 冇俾到建議</div>';
  } catch (e) { out.innerHTML = aiErrHTML(e); }
}

/* ===== 相片 ===== */
async function resizeImage(file, max = 1024, q = .8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height)); const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
const blobToDataURL = b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });

/* ===== 食譜編輯 ===== */
function blankRecipe() { return { name: '', icon: 'plate', type: 'meat', cuisine: '粵菜', time: 20, level: 1, servings: 2, kcal: '', p: '', c: '', f: '', tags: [], desc: '', ings: [{ n: '', q: '', u: '' }, { n: '', q: '', u: '' }], steps: [{ t: '', min: 0 }], tips: '' }; }
function openEditor(id, prefill) {
  const orig = id ? getRecipe(id) : null; const r = orig || prefill || blankRecipe();
  const E = { id: orig ? orig.id : null, orig, icon: r.icon || 'plate', photo: r.photo || null, src: orig ? orig.src : (r.src || 'me') };
  const bd = openSheet(orig ? '編輯食譜' : '記低新食譜', `<form id="edForm" style="display:flex;flex-direction:column;gap:14px"></form>`);
  bd._E = E; bd.dataset.editor = '1'; fillEditor(bd, r);
}
function fillEditor(bd, r) {
  const E = bd._E; const f = $('#edForm', bd);
  const opt = (arr, v) => arr.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  f.innerHTML = `
    <div class="field"><label for="edName">菜名</label><div class="row"><input id="edName" class="inp" required maxlength="30" value="${esc(r.name)}" placeholder="例如：豉汁蒸排骨"><button type="button" class="btn sm pri needs-ai" data-act="edAIfill">${li('ai')}AI 補完</button></div><span class="small muted needs-ai">打咗菜名，可以叫 AI 幫你填晒材料同步驟</span></div>
    <div class="field"><label>插圖</label><div class="icon-pick">${ICON_KEYS.map(k => `<button type="button" data-act="edIcon" data-k="${k}" style="background:${iconBg(k)}" aria-pressed="${k === E.icon}" aria-label="${ICONS[k].label}" title="${ICONS[k].label}">${iconSVG(k)}</button>`).join('')}</div></div>
    <div class="field"><label>相片（可以唔加）</label><div class="row wrap"><label class="btn sm" for="edPhoto" style="cursor:pointer">${li('cam')}揀相</label><input id="edPhoto" type="file" accept="image/*" class="hide"><span id="edPhotoPrev" class="row">${E.photo ? `<img src="${esc(E.photo)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:12px;border:2.5px solid var(--ink)"><button type="button" class="btn sm" data-act="edPhotoDel">移走相片</button>` : ''}</span></div></div>
    <div class="grid g2">
      <div class="field"><label for="edType">類別</label><select id="edType" class="inp">${opt(TYPE_ORDER.map(t => [t, TYPES[t].label]), r.type)}</select></div>
      <div class="field"><label for="edCui">菜系</label><select id="edCui" class="inp">${opt(CUISINES.map(c => [c, c]), r.cuisine)}</select></div>
      <div class="field"><label for="edTime">時間（分鐘）</label><input id="edTime" class="inp" type="number" min="1" max="600" value="${esc(r.time)}"></div>
      <div class="field"><label for="edServ">份量（人）</label><input id="edServ" class="inp" type="number" min="1" max="30" value="${esc(r.servings)}"></div>
      <div class="field"><label for="edLv">難度</label><select id="edLv" class="inp">${opt([[1, '易'], [2, '中'], [3, '難']], r.level)}</select></div>
      <div class="field"><label for="edTags">標籤（用逗號分隔）</label><input id="edTags" class="inp" value="${esc((r.tags || []).join('，'))}" placeholder="送飯，快手"></div>
    </div>
    <div class="field"><label for="edDesc">簡介</label><input id="edDesc" class="inp" maxlength="120" value="${esc(r.desc || '')}" placeholder="一句講呢個餸"></div>
    <div class="field"><label>材料</label><div class="small muted">名稱・數量・單位（適量就唔使填數量）</div><div class="list" id="edIngs">${r.ings.map(ingRowHTML).join('')}</div><button type="button" class="btn sm" data-act="edIngAdd" style="align-self:flex-start">${li('plus')}加材料</button></div>
    <div class="field"><label>步驟</label><div class="small muted">內容・要等幾多分鐘（會變計時掣）</div><div class="list" id="edSteps">${r.steps.map(stepRowHTML).join('')}</div><button type="button" class="btn sm" data-act="edStepAdd" style="align-self:flex-start">${li('plus')}加步驟</button></div>
    <div class="field"><label for="edTips">小貼士</label><textarea id="edTips" class="inp" maxlength="200">${esc(r.tips || '')}</textarea></div>
    <div class="field"><label>營養（每份，可以留空）</label><div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">
      ${[['edK', '大卡', r.kcal], ['edP', '蛋白質克', r.p], ['edC', '碳水克', r.c], ['edF', '脂肪克', r.f]].map(([i, l, v]) => `<div class="field"><label for="${i}" class="small">${l}</label><input id="${i}" class="inp" type="number" min="0" value="${esc(v ?? '')}"></div>`).join('')}</div>
      <button type="button" class="btn sm pri needs-ai" data-act="edAINut" style="align-self:flex-start">${li('ai')}AI 估營養</button></div>
    <button type="submit" class="btn pri block">${li('check')}儲存食譜</button>`;
  $('#edPhoto', bd).addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try { let url = await blobToDataURL(await resizeImage(file, 640, .72)); if (url.length > 170000) url = await blobToDataURL(await resizeImage(file, 480, .6)); if (url.length > 170000) url = await blobToDataURL(await resizeImage(file, 360, .5)); E.photo = url; const cur = readEditor(bd); cur.photo = E.photo; fillEditor(bd, cur); }
    catch (er) { toast('開唔到呢張相'); }
  });
  f.onsubmit = e => { e.preventDefault(); submitEditor(bd); };
}
function ingRowHTML(i) { return `<div class="erow"><input class="inp" data-f="n" value="${esc(i.n)}" placeholder="材料" aria-label="材料名"><input class="inp" data-f="q" type="number" min="0" step="any" value="${i.q ? esc(i.q) : ''}" placeholder="數量" aria-label="數量"><input class="inp" data-f="u" value="${esc(i.u || '')}" placeholder="單位" aria-label="單位"><button type="button" class="btn icon sm" data-act="edRowDel" aria-label="刪除呢行">${li('x')}</button></div>`; }
function stepRowHTML(s) { return `<div class="erow st"><input class="inp" data-f="t" value="${esc(s.t)}" placeholder="步驟內容" aria-label="步驟"><input class="inp" data-f="min" type="number" min="0" max="600" value="${s.min ? esc(s.min) : ''}" placeholder="分鐘" aria-label="分鐘"><button type="button" class="btn icon sm" data-act="edRowDel" aria-label="刪除呢步">${li('x')}</button></div>`; }
function readEditor(bd) {
  const v = id => $('#' + id, bd).value;
  return {
    name: v('edName').trim(), icon: bd._E.icon, photo: bd._E.photo, type: v('edType'), cuisine: v('edCui'), time: num(v('edTime'), 1, 600, 20), servings: num(v('edServ'), 1, 30, 2), level: num(v('edLv'), 1, 3, 1),
    tags: v('edTags').split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean).slice(0, 5), desc: v('edDesc').trim(), tips: v('edTips').trim(),
    kcal: v('edK') === '' ? '' : num(v('edK'), 0, 3000, 0), p: v('edP') === '' ? '' : num(v('edP'), 0, 300, 0), c: v('edC') === '' ? '' : num(v('edC'), 0, 500, 0), f: v('edF') === '' ? '' : num(v('edF'), 0, 300, 0),
    ings: $$('#edIngs .erow', bd).map(row => ({ n: $('[data-f=n]', row).value.trim(), q: Number($('[data-f=q]', row).value) || 0, u: $('[data-f=u]', row).value.trim() })),
    steps: $$('#edSteps .erow', bd).map(row => ({ t: $('[data-f=t]', row).value.trim(), min: num($('[data-f=min]', row).value, 0, 600, 0) })),
  };
}
function submitEditor(bd) {
  const E = bd._E; const d = readEditor(bd);
  const ings = d.ings.filter(i => i.n).map(i => ({ ...i, cat: ingInfo(i.n).cat })); const steps = d.steps.filter(s => s.t);
  if (!d.name) { toast('要有菜名'); $('#edName', bd).focus(); return; }
  if (!ings.length) { toast('最少要有一樣材料'); return; }
  const r = { ...(E.orig || {}), ...d, ings, steps: steps.length ? steps : [{ t: '照自己習慣煮', min: 0 }], kcal: d.kcal || 0, p: d.p || 0, c: d.c || 0, f: d.f || 0,
    id: E.id || uid('U-'), src: E.src === 'ai' ? 'ai' : 'me', created: E.orig?.created || Date.now(), by: E.orig?.by || RT.me || '', demo: false };
  if (!r.photo) delete r.photo;
  const i = S.recipes.findIndex(x => x.id === r.id);
  if (i >= 0) S.recipes[i] = r; else S.recipes.unshift(r);
  save({ recipe: r }); closeSheet(bd); toast(E.id ? '改好喇' : '記低咗新食譜'); openRecipe(r.id);
}

/* ===== 煮食模式 ===== */
async function wakeOn() { try { if (navigator.wakeLock) RT.wake = await navigator.wakeLock.request('screen'); } catch (e) { RT.wake = null; } }
function wakeOff() { try { RT.wake && RT.wake.release(); } catch (e) { } RT.wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && RT.cook) wakeOn(); });
function openCook(id) { wakeOn(); RT.cook = { id, i: 0 }; const ov = document.createElement('div'); ov.className = 'cook'; ov.id = 'cookOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '煮食模式'); document.body.appendChild(ov); drawCook(); }
function drawCook() {
  const ov = $('#cookOv'); if (!ov) return; const r = getRecipe(RT.cook.id); const i = RT.cook.i, s = r.steps[i], n = r.steps.length;
  ov.innerHTML = `<div class="row"><span style="width:54px;height:54px;flex:none;background:#fff;border-radius:16px;border:3px solid var(--ink)">${iconSVG(r.icon)}</span><div><h3 style="color:#fff">${esc(r.name)}</h3><div class="small">第 ${i + 1} 步，共 ${n} 步</div></div><button class="btn icon" style="margin-left:auto" data-act="cookClose" aria-label="收埋煮食模式">${li('x')}</button></div>
  <div class="bar" style="margin:14px 0"><i style="width:${(i + 1) / n * 100}%"></i></div>
  <div class="big">${esc(s.t)}</div>
  <div class="row wrap" style="justify-content:center;gap:10px;max-width:760px;margin:0 auto;width:100%">
    <button class="btn" data-act="cookStep" data-d="-1" ${i === 0 ? 'disabled' : ''}>${li('left')}上一步</button>
    ${s.min ? `<button class="btn sun" data-act="stepTimer" data-l="${esc(r.name)}・第${i + 1}步" data-s="${s.min * 60}">${li('clock')}計時 ${s.min} 分鐘</button>` : ''}
    ${i < n - 1 ? `<button class="btn sun" data-act="cookStep" data-d="1">下一步${li('right')}</button>` : `<button class="btn sun" data-act="cookDone">${li('check')}煮好喇！記低佢</button>`}
  </div>`;
}

/* ===== 事件 ===== */
function pressOnly(el, sel) { $$(sel, el.parentElement).forEach(b => b.setAttribute('aria-pressed', b === el)); }
function scrollToEl(sel) { setTimeout(() => $(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
const ACTS = {
  go: el => { $$('#sheets .backdrop').forEach(b => closeSheet(b)); show(el.dataset.v); },
  open: el => openRecipe(el.dataset.id),
  openSwap: el => { closeSheet(sheetOf(el)); openRecipe(el.dataset.id); },
  closeSheet: el => closeSheet(sheetOf(el)),
  fav: el => { const id = el.dataset.id; const on = !isFav(id); S.favs = on ? [...S.favs, id] : S.favs.filter(x => x !== id); save(); toast(on ? '收藏咗' : '取消咗收藏'); rerenderDetail(); },
  planRm: el => { const { k, m, i } = el.dataset; const p = dayPlan(k); p[m] = p[m].filter((_, j) => j !== +i); S.plan[k] = p; save(); },
  picker: el => openPicker(el.dataset.k, el.dataset.m),
  pkAdd: el => { const bd = sheetOf(el); const { k, meal } = bd._pk; S.plan[k] = { ...dayPlan(k), [meal]: [...dayPlan(k)[meal], el.dataset.id] }; save(); el.innerHTML = li('check') + '加咗'; el.disabled = true; toast('加咗：' + getRecipe(el.dataset.id).name); },
  autoPair: el => autoPair(el.dataset.k, el.dataset.m),
  addPlan: el => openAddPlan(el.dataset.id),
  apDay: el => { sheetOf(el)._ap.k = el.dataset.k; pressOnly(el, '[data-act=apDay]'); },
  apMeal: el => { sheetOf(el)._ap.m = el.dataset.m; pressOnly(el, '[data-act=apMeal]'); },
  apGo: el => { const bd = sheetOf(el); const { k, m } = bd._ap; S.plan[k] = { ...dayPlan(k), [m]: [...dayPlan(k)[m], el.dataset.id] }; save(); closeSheet(bd); toast(`加咗去${k === TODAY() ? '今日' : fmtDay(k)}${MEALS[m]}`); },
  serv: el => { RT.detail.serv = Math.max(1, Math.min(30, RT.detail.serv + Number(el.dataset.d))); rerenderDetail(); },
  stepDone: el => { const i = +el.dataset.i; const d = RT.detail.done; d.has(i) ? d.delete(i) : d.add(i); rerenderDetail(); },
  stepTimer: el => startTimer(el.dataset.l, +el.dataset.s),
  shopRecipe: el => { const r = getRecipe(el.dataset.id); const n = addIngsToShop(r, RT.detail.serv / (r.servings || 1)); save(); toast(`加咗 ${n} 樣材料入清單`); },
  cook: el => openCook(el.dataset.id),
  cookStep: el => { RT.cook.i = Math.max(0, Math.min(getRecipe(RT.cook.id).steps.length - 1, RT.cook.i + Number(el.dataset.d))); drawCook(); },
  cookClose: () => { $('#cookOv')?.remove(); RT.cook = null; wakeOff(); },
  editRecipe: el => { closeSheet(sheetOf(el)); openEditor(el.dataset.id); },
  copyRecipe: el => { const r = getRecipe(el.dataset.id); closeSheet(sheetOf(el)); const c = JSON.parse(JSON.stringify(r)); delete c.id; c.name = (r.name + '（我嘅版本）').slice(0, 30); c.src = 'me'; c.demo = false; openEditor(null, c); },
  delRecipe: el => {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.innerHTML = li('trash') + '再撳一次確認刪除'; return; }
    const id = el.dataset.id; S.recipes = S.recipes.filter(r => r.id !== id); S.favs = S.favs.filter(x => x !== id);
    for (const k in S.plan) { const p = S.plan[k]; for (const m of ['b', 'l', 'd']) if (p[m]) p[m] = p[m].filter(x => x !== id); }
    closeSheet(sheetOf(el)); save({ del: id }); toast('刪咗');
  },
  newRecipe: () => openEditor(),
  recFilter: el => { RT.recFilter = el.dataset.f; renderRecList(); },
  recType: el => { RT.recType = el.dataset.t; renderRecList(); },
  week: el => { RT.planDay = dkey(addDays(parseD(RT.planDay), Number(el.dataset.d))); renderPlan(); },
  planDay: el => { RT.planDay = el.dataset.k; renderPlan(); },
  planToday: () => { RT.planDay = TODAY(); renderPlan(); },
  people: el => { S.settings.people = Math.max(1, Math.min(20, (S.settings.people || 2) + Number(el.dataset.d))); save(); },
  shopDay: el => addDaysToShop([el.dataset.k]),
  shopWeek: () => addDaysToShop(weekKeys(RT.view === 'plan' ? RT.planDay : TODAY())),
  clearDay: el => { delete S.plan[el.dataset.k]; save(); toast('清空咗呢日'); },
  shopToggle: el => { const it = S.shop.find(i => i.id === el.dataset.id); if (it) { it.done = !it.done; it.doneBy = it.done ? (RT.me || '') : ''; save(); } },
  shopDel: el => { S.shop = S.shop.filter(i => i.id !== el.dataset.id); save(); },
  shopClearDone: () => { const n = S.shop.filter(i => i.done).length; S.shop = S.shop.filter(i => !i.done); save(); toast(`清走咗 ${n} 樣`); },
  shopClearAll: el => { if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = '再撳確認'; return; } S.shop = []; save(); },
  hideHave: () => { RT.hideHave = !RT.hideHave; try { localStorage.setItem('wokzai-hidehave', RT.hideHave ? '1' : '0'); } catch (e) { } renderShop(); },
  shopCopy: async () => {
    const t = shopText();
    try { await navigator.clipboard.writeText(t); toast('複製咗，可以貼去 WhatsApp'); }
    catch (e) { openSheet('複製清單', `<textarea class="inp" rows="12" readonly aria-label="清單文字">${esc(t)}</textarea><div class="small muted">長撳揀晒，再複製</div>`); }
  },
  statsTbl: el => { const k = el.dataset.k; RT.statsTable[k] = !RT.statsTable[k]; renderStats(); },
  clearDemo: () => {
    const dp = S.settings.demoPlan || {}, df = S.settings.demoFavs || [];
    const demoIds = S.recipes.filter(r => r.demo).map(r => r.id);
    S.recipes = S.recipes.filter(r => !r.demo); S.pantry = S.pantry.filter(p => !p.demo); S.shop = S.shop.filter(i => !i.demo);
    S.favs = S.favs.filter(f => !df.includes(f) && !demoIds.includes(f));
    for (const [k, d] of Object.entries(dp)) { if (!S.plan[k]) continue; const p = dayPlan(k); for (const m of ['b', 'l', 'd']) for (const id of d[m] || []) { const i = p[m].indexOf(id); if (i >= 0) p[m].splice(i, 1); } S.plan[k] = p; }
    for (const k in S.plan) for (const m of ['b', 'l', 'd']) if (S.plan[k][m]) S.plan[k][m] = S.plan[k][m].filter(id => !demoIds.includes(id));
    delete S.settings.demoPlan; delete S.settings.demoFavs; S.settings.demoCleared = true;
    save(); toast('清走咗示範資料，你自己加嘅嘢保留晒');
  },
  keepDemo: () => { S.settings.demoCleared = true; save(); },
  wheelGo: () => { show('tools'); scrollToEl('#tWheel'); },
  timerGo: () => { show('tools'); scrollToEl('#tTimer'); },
  photoGo: () => { show('ai'); scrollToEl('#aiPhotoCard'); },
  pantryGo: () => { show('tools'); scrollToEl('#tPantry'); },
  wSrc: el => { RT.wheelSrc = el.dataset.k; RT.wheelSeed = String(Math.random()); buildWheel(); $('#wheelRes').innerHTML = ''; },
  spin: () => spin(),
  wAdd: el => { const k = TODAY(); S.plan[k] = { ...dayPlan(k), d: [...dayPlan(k).d, el.dataset.id] }; save(); toast('加咗入今晚晚餐'); },
  tToggle: el => { const t = RT.timers.find(x => x.id === el.dataset.id); if (!t) return; if (t.running) { t.running = false; } else if (t.left > 0) { t.end = Date.now() + t.left * 1000; t.running = true; t.fired = false; ensureAudio(); tick(); } renderTimers(); },
  tPlus: el => { const t = RT.timers.find(x => x.id === el.dataset.id); if (!t) return; t.left += 60; t.total = Math.max(t.total, t.left); t.fired = false; if (t.running) t.end += 60000; else { t.end = Date.now() + t.left * 1000; t.running = true; ensureAudio(); tick(); } renderTimers(); },
  tDel: el => { RT.timers = RT.timers.filter(x => x.id !== el.dataset.id); renderTimers(); updateTimerChip(); },
  pDel: el => { const p = S.pantry.find(x => x.id === el.dataset.id); S.pantry = S.pantry.filter(x => x.id !== el.dataset.id); save(); if (p) toast(`用咗 ${p.n}`); },
  pRec: () => { show('home'); },
  pAI: () => { show('ai'); const names = [...S.pantry].sort((a, b) => (a.exp || '9') < (b.exp || '9') ? -1 : 1).map(p => p.n).slice(0, 10).join('、'); $('#aiIngs').value = names; scrollToEl('#aiGenCard'); },
  scale: el => { RT.scale.n = Math.max(1, Math.min(30, RT.scale.n + Number(el.dataset.d))); renderScaler(); },
  scShop: () => { const r = getRecipe(RT.scale.id); const n = addIngsToShop(r, RT.scale.n / (r.servings || 1)); save(); toast(`加咗 ${n} 樣材料入清單`); },
  rice: el => { RT.riceCups = Math.max(0.5, Math.min(10, RT.riceCups + Number(el.dataset.d) * 0.5)); rice(); },
  famOpen: () => openFam(),
  whoPick: el => { S.members = S.members || {}; S.members[RT.me] = { name: el.dataset.n, icon: el.dataset.i || 'bun', t: Date.now() }; save(); toast(`你好，${el.dataset.n}！`); },
  whoLater: () => { RT.whoLater = true; renderHome(); },
  famWho: el => { const bd = sheetOf(el); $('#famName', bd).value = el.dataset.n; pressOnly(el, '[data-act=famWho]'); },
  famIcon: el => { sheetOf(el)._fam.icon = el.dataset.k; pressOnly(el, '[data-act=famIcon]'); },
  famSave: el => { const bd = sheetOf(el); const n = ($('#famName', bd).value.trim() || memberName(RT.me)).slice(0, 10); S.members = S.members || {}; S.members[RT.me] = { name: n, icon: bd._fam.icon, t: Date.now() }; save(); toast('儲存咗：' + n); },
  tasteSave: el => { const bd = sheetOf(el); S.settings.avoid = $('#famAvoid', bd).value.trim().slice(0, 80); S.settings.note = $('#famNote', bd).value.trim().slice(0, 80); save(); updateAIAvail(); toast('屋企口味儲存咗'); },
  autoWeek: () => autoWeek(),
  cookedLog: el => { logCooked(el.dataset.id); rerenderDetail(); openUsed(el.dataset.id); },
  cookDone: () => { const id = RT.cook?.id; ACTS.cookClose(); if (id) { logCooked(id); rerenderDetail(); openUsed(id); } },
  usedGo: el => { const bd = sheetOf(el); const ids = $$('[data-act=usedItem][aria-checked=true]', bd).map(b => b.dataset.id); S.pantry = S.pantry.filter(p => !ids.includes(p.id)); closeSheet(bd); if (ids.length) { save(); toast(`由雪櫃剔走咗 ${ids.length} 樣`); } },
  usedItem: el => el.setAttribute('aria-checked', el.getAttribute('aria-checked') !== 'true'),
  shopToPantry: () => {
    const done = S.shop.filter(i => i.done); if (!done.length) { toast('未有剔咗買咗嘅嘢'); return; }
    done.forEach(i => { if (ingInfo(i.n).cat === 'sauce' && inPantry(i.n)) return; S.pantry.push({ id: uid('p'), n: i.n, q: i.q, u: i.u, exp: dkey(addDays(new Date(), EXP_DAYS[i.cat] || 7)), by: RT.me || '' }); });
    S.shop = S.shop.filter(i => !i.done); save(); toast(`${done.length} 樣放咗入雪櫃，記得睇吓到期日`);
  },
  copyWeek: () => {
    const wk = weekKeys(RT.planDay); let n = 0;
    wk.forEach(k => { if (dayIds(k).length) return; const prev = dkey(addDays(parseD(k), -7)); const p = dayPlan(prev); if (p.b.length + p.l.length + p.d.length) { S.plan[k] = { b: [...p.b], l: [...p.l], d: [...p.d] }; n++; } });
    if (!n) { toast('上個禮拜冇餐單可以抄，或者呢個禮拜已經排好'); return; }
    save(); toast(`抄咗 ${n} 日嘅餐單過嚟`);
  },
  copyText: async el => {
    const r = getRecipe(el.dataset.id); if (!r) return; const t = recipeText(r, RT.detail?.serv || r.servings || 2);
    try { await navigator.clipboard.writeText(t); toast('複製咗，可以貼去 WhatsApp'); }
    catch (e) { openSheet('複製食譜', `<textarea class="inp" rows="14" readonly aria-label="食譜文字">${esc(t)}</textarea><div class="small muted">長撳揀晒，再複製</div>`); }
  },
  aiPantry: () => { $('#aiIngs').value = S.pantry.map(p => p.n).slice(0, 10).join('、'); if (!S.pantry.length) toast('雪櫃未有嘢，去工具頁加'); },
  aiPpl: el => { RT.ai.people = Math.max(1, Math.min(20, RT.ai.people + Number(el.dataset.d))); $('#aiPplS').innerHTML = stepper('aiPpl', RT.ai.people, '人數'); },
  aiTime: el => { RT.ai.time = +el.dataset.v; pressOnly(el, '[data-act=aiTime]'); },
  aiTaste: el => { const v = el.dataset.v; const s = RT.ai.tastes; s.has(v) ? s.delete(v) : s.add(v); el.setAttribute('aria-pressed', s.has(v)); },
  aiCui: el => { RT.ai.cuisine = el.dataset.v; pressOnly(el, '[data-act=aiCui]'); },
  aiGen: () => aiGen(),
  aiSave: el => { const r = saveAIRecipe(el.dataset.id); if (r) { el.disabled = true; el.innerHTML = li('check') + '已儲存'; toast('儲存咗入食譜簿'); } },
  aiPlan: el => { const r = saveAIRecipe(el.dataset.id); if (r) { $$(`[data-act=aiSave][data-id="${r.id}"]`).forEach(b => { b.disabled = true; b.innerHTML = li('check') + '已儲存'; }); openAddPlan(r.id); } },
  aiShop: el => { const r = RT.aiCache[el.dataset.id]; if (!r) return; const n = addIngsToShop(r, 1); save(); toast(`加咗 ${n} 樣材料入清單`); },
  aiPhoto: () => aiPhoto(),
  aiItem: el => { const it = RT.ai.items[+el.dataset.i]; it.on = !it.on; el.setAttribute('aria-pressed', it.on); },
  aiItemsPantry: () => { const sel = RT.ai.items.filter(i => i.on); sel.forEach(i => S.pantry.push({ id: uid('p'), n: i.n, q: i.q, u: i.u, exp: dkey(addDays(new Date(), EXP_DAYS[i.cat] || 7)), by: RT.me || '' })); save(); toast(`放咗 ${sel.length} 樣入雪櫃`); },
  aiItemsGen: () => { $('#aiIngs').value = RT.ai.items.filter(i => i.on).map(i => i.n).join('、'); scrollToEl('#aiGenCard'); aiGen(); },
  aiMP: el => { RT.ai.mPeople = Math.max(1, Math.min(20, RT.ai.mPeople + Number(el.dataset.d))); $('#aiMPS').innerHTML = stepper('aiMP', RT.ai.mPeople, '人數'); },
  aiMM: el => { RT.ai.mMeal = el.dataset.v; pressOnly(el, '[data-act=aiMM]'); },
  aiMS: el => { RT.ai.mStyle = el.dataset.v; pressOnly(el, '[data-act=aiMS]'); },
  aiMenu: () => aiMenu(),
  aiMenuAll: el => { const k = TODAY(); const m = RT.ai.mMeal; const ids = RT.ai.menu.map(d => saveAIRecipe(d.id)?.id).filter(Boolean); S.plan[k] = { ...dayPlan(k), [m]: [...dayPlan(k)[m], ...ids] }; save(); el.disabled = true; el.innerHTML = li('check') + '已加入'; toast(`加咗 ${ids.length} 個餸入今日${MEALS[m]}`); },
  aiPreview: el => { const r = RT.aiCache[el.dataset.id]; if (r) openSheet(r.name, genPreview(r, true)); },
  aiAsk: () => aiAsk(),
  aiAskEx: el => { $('#aiQ').value = el.textContent; aiAsk(el.textContent); },
  aiPair: el => aiPair(el.dataset.id, sheetOf(el)),
  aiGenName: el => aiGenSheet(el.dataset.n),
  edIcon: el => { sheetOf(el)._E.icon = el.dataset.k; pressOnly(el, '[data-act=edIcon]'); },
  edIngAdd: el => { $('#edIngs', sheetOf(el)).insertAdjacentHTML('beforeend', ingRowHTML({ n: '', q: '', u: '' })); $('#edIngs .erow:last-child input', sheetOf(el)).focus(); },
  edStepAdd: el => { $('#edSteps', sheetOf(el)).insertAdjacentHTML('beforeend', stepRowHTML({ t: '', min: 0 })); $('#edSteps .erow:last-child input', sheetOf(el)).focus(); },
  edRowDel: el => el.closest('.erow').remove(),
  edPhotoDel: el => { const bd = sheetOf(el); bd._E.photo = null; const cur = readEditor(bd); cur.photo = null; fillEditor(bd, cur); },
  edAIfill: async el => {
    if (!needAI()) return; const bd = sheetOf(el); const cur = readEditor(bd);
    if (!cur.name) { toast('打咗菜名先'); $('#edName', bd).focus(); return; }
    el.disabled = true; el.innerHTML = '寫緊…';
    try { const r = normAI(await askJSON(genPrompt({ name: cur.name, people: cur.servings })), cur.name); bd._E.icon = r.icon; if (bd._E.src !== 'me' || !bd._E.orig) bd._E.src = 'ai'; fillEditor(bd, { ...r, name: cur.name, photo: bd._E.photo }); toast('AI 幫你填好晒，睇吓啱唔啱'); }
    catch (e) { toast(e?.code === 'rate_limited' ? 'AI 太忙，等陣再試' : 'AI 補完唔到，再試一次'); el.disabled = false; el.innerHTML = li('ai') + 'AI 補完'; }
  },
  edAINut: async el => {
    if (!needAI()) return; const bd = sheetOf(el); const cur = readEditor(bd); const ings = cur.ings.filter(i => i.n);
    if (!ings.length) { toast('填咗材料先'); return; }
    el.disabled = true; el.innerHTML = '估緊…';
    try {
      const o = await askJSON(`估算以下食譜每份嘅營養（${cur.servings} 人份）：${cur.name || '家常菜'}。材料：${ings.map(i => `${i.n} ${i.q || ''}${i.u}`).join('，')}。只回覆 JSON：{"kcal":數字,"p":蛋白質克,"c":碳水克,"f":脂肪克}`);
      [['edK', o.kcal, 3000], ['edP', o.p, 300], ['edC', o.c, 500], ['edF', o.f, 300]].forEach(([id, v, mx]) => { $('#' + id, bd).value = num(v, 0, mx, 0); });
      toast('估好喇（大約數）');
    } catch (e) { toast('估唔到，再試一次'); }
    el.disabled = false; el.innerHTML = li('ai') + 'AI 估營養';
  },
};
document.addEventListener('pointerdown', () => ensureAudio(), { once: true, capture: true });
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const fn = ACTS[el.dataset.act]; if (fn) fn(el, e); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#cookOv')) ACTS.cookClose(); else closeSheet(); return; }
  if ($('#cookOv') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { RT.cook.i = Math.max(0, Math.min(getRecipe(RT.cook.id).steps.length - 1, RT.cook.i + (e.key === 'ArrowRight' ? 1 : -1))); drawCook(); return; }
  const t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t.matches('[role=button][data-act]')) { e.preventDefault(); t.click(); }
});
/* 圖表提示 */
const tipEl = $('#tip');
function posTip(e) { const w = tipEl.offsetWidth; const x = Math.max(8, Math.min(innerWidth - w - 8, e.clientX - w / 2)); tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(8, e.clientY - 44) + 'px'; }
document.addEventListener('pointerover', e => { const t = e.target.closest?.('[data-tip]'); if (!t) { tipEl.style.display = 'none'; return; } tipEl.textContent = t.dataset.tip || t.getAttribute('data-tip'); tipEl.style.display = 'block'; posTip(e); });
document.addEventListener('pointermove', e => { if (tipEl.style.display === 'block') posTip(e); });
document.addEventListener('scroll', () => { tipEl.style.display = 'none'; }, { passive: true });

