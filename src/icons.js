/* ===== 卡通插圖庫（全部原創 SVG，viewBox 0 0 100 100） ===== */
const K = '#10393b';
const ST = `stroke="${K}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const ST3 = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
function face(x, y, s = 1, mood = 'smile') {
  const mouth = mood === 'open'
    ? `<path d="M-4.5 4 Q0 11 4.5 4Z" fill="${K}"/>`
    : mood === 'wow'
    ? `<ellipse cx="0" cy="6" rx="2.6" ry="3.2" fill="${K}"/>`
    : `<path d="M-4.5 4.5 Q0 9.5 4.5 4.5" fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-8" cy="-1" rx="2.6" ry="3.4" fill="${K}"/><ellipse cx="8" cy="-1" rx="2.6" ry="3.4" fill="${K}"/><circle cx="-7.2" cy="-2.3" r=".9" fill="#fff"/><circle cx="8.8" cy="-2.3" r=".9" fill="#fff"/>${mouth}<ellipse cx="-13.5" cy="5" rx="3.6" ry="2.2" fill="#ff8f7a" opacity=".75"/><ellipse cx="13.5" cy="5" rx="3.6" ry="2.2" fill="#ff8f7a" opacity=".75"/></g>`;
}
function bowl(fill, stripe = '#fff') {
  return `<path d="M12 50 H88 Q86 86 50 88 Q14 86 12 50Z" fill="${fill}" ${ST}/><path d="M22 62 Q50 68 78 62" stroke="${stripe}" stroke-width="3.5" fill="none" opacity=".55" stroke-linecap="round"/>`;
}
function steam(xs, y = 22, c = '#8fd8ce') {
  return xs.map(x => `<path d="M${x} ${y} q-5 -5 0 -10 q5 -5 0 -10" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`).join('');
}

const ICONS = {
  rice: { label: '白飯', bg: '#d4f3ee', svg: () =>
    `<path d="M64 6 L46 40" stroke="#b5743a" stroke-width="5" stroke-linecap="round"/><path d="M78 10 L52 42" stroke="#b5743a" stroke-width="5" stroke-linecap="round"/>
     <path d="M18 51 Q20 24 50 22 Q80 24 82 51Z" fill="#fff" ${ST}/>
     <g stroke="#bcd3d0" stroke-width="2.6" stroke-linecap="round"><path d="M32 40 l4 -2"/><path d="M48 32 l4 1"/><path d="M62 41 l3 -3"/><path d="M42 46 l4 0"/><path d="M56 36 l3 1"/></g>
     ${bowl('#4fc7b8')}${face(50, 72)}` },
  congee: { label: '粥', bg: '#e3f6f2', svg: () =>
    `${steam([38, 52, 66], 30)}<ellipse cx="50" cy="50" rx="38" ry="8" fill="#fffbf0" ${ST}/>
     <g fill="#55c27a"><circle cx="38" cy="49" r="2.6"/><circle cx="56" cy="47" r="2.6"/><circle cx="64" cy="52" r="2.2"/></g><circle cx="46" cy="52" r="4" fill="#4a5a3a"/>
     ${bowl('#7fd6cb')}${face(50, 72)}` },
  noodles: { label: '麵', bg: '#fff1cf', svg: () =>
    `<path d="M58 4 L66 42" stroke="#b5743a" stroke-width="5" stroke-linecap="round"/><path d="M70 4 L72 42" stroke="#b5743a" stroke-width="5" stroke-linecap="round"/>
     <path d="M63 18 q-5 7 0 13 q5 7 0 14" fill="none" stroke="#e6b43c" stroke-width="4" stroke-linecap="round"/>
     <path d="M18 51 Q22 30 50 30 Q78 30 82 51Z" fill="#ffe08a" ${ST}/>
     <path d="M24 46 q6 -7 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#e6b43c" stroke-width="3.5" stroke-linecap="round"/><path d="M30 38 q5 -6 10 0 t10 0 t10 0" fill="none" stroke="#e6b43c" stroke-width="3.5" stroke-linecap="round"/>
     ${bowl('#ff9f6e')}${face(50, 72)}` },
  soup: { label: '湯', bg: '#d4f3ee', svg: () =>
    `${steam([36, 50, 64], 26)}
     <rect x="4" y="50" width="12" height="9" rx="4" fill="#7fe0d2" ${ST}/><rect x="84" y="50" width="12" height="9" rx="4" fill="#7fe0d2" ${ST}/>
     <path d="M16 40 H84 V72 Q84 86 70 86 H30 Q16 86 16 72Z" fill="#2fb3a3" ${ST}/>
     <rect x="10" y="34" width="80" height="11" rx="5.5" fill="#7fe0d2" ${ST}/>
     ${face(50, 64)}` },
  egg: { label: '蛋', bg: '#fff3c9', svg: () =>
    `<path d="M20 58 Q8 40 26 28 Q40 14 60 22 Q84 26 86 48 Q90 72 66 80 Q44 90 30 78 Q14 72 20 58Z" fill="#fff" ${ST}/>
     <circle cx="52" cy="52" r="19" fill="#ffc93c" ${ST}/><path d="M43 41 q4 -4 9 -4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
     ${face(52, 55, .8)}` },
  tomato: { label: '番茄', bg: '#ffe2db', svg: () =>
    `<circle cx="50" cy="57" r="32" fill="#ff6b5b" ${ST}/>
     <path d="M50 24 L56 31 L66 27 L61 35 L69 40 L57 39 L50 46 L43 39 L31 40 L39 35 L34 27 L44 31Z" fill="#4cc38a" ${ST3}/>
     <path d="M29 52 q2 -10 10 -14" stroke="#fff" stroke-width="3.5" fill="none" opacity=".8" stroke-linecap="round"/>
     ${face(50, 63)}` },
  broccoli: { label: '西蘭花', bg: '#dcf5dc', svg: () =>
    `<path d="M40 58 L36 88 H64 L60 58Z" fill="#b8eab0" ${ST}/>
     <circle cx="29" cy="48" r="16" fill="#38b26a" ${ST}/><circle cx="71" cy="48" r="16" fill="#38b26a" ${ST}/><circle cx="50" cy="34" r="19" fill="#43c076" ${ST}/><circle cx="50" cy="56" r="15" fill="#38b26a" ${ST}/>
     <g fill="#2a9456"><circle cx="44" cy="28" r="2.5"/><circle cx="58" cy="32" r="2.5"/><circle cx="25" cy="46" r="2.2"/><circle cx="74" cy="44" r="2.2"/></g>
     ${face(50, 76, .7)}` },
  carrot: { label: '紅蘿蔔', bg: '#ffe7cf', svg: () =>
    `<path d="M50 30 Q38 10 30 14 Q40 20 45 31Z" fill="#4cc38a" ${ST3}/><path d="M50 30 Q50 6 58 8 Q56 18 54 31Z" fill="#4cc38a" ${ST3}/><path d="M52 31 Q66 12 74 18 Q64 22 57 33Z" fill="#4cc38a" ${ST3}/>
     <path d="M28 32 Q50 24 72 32 Q63 64 50 93 Q37 64 28 32Z" fill="#ff9a3c" ${ST}/>
     <path d="M36 54 h7 M57 64 h7 M43 76 h5" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
     ${face(50, 44, .8)}` },
  fish: { label: '魚', bg: '#d6eefb', svg: () =>
    `<path d="M36 32 Q46 14 60 30Z" fill="#4aa9dc" ${ST}/><path d="M70 50 L93 31 Q88 50 93 69Z" fill="#4aa9dc" ${ST}/>
     <ellipse cx="45" cy="51" rx="34" ry="22" fill="#7cc9ef" ${ST}/>
     <path d="M22 58 Q45 70 70 57" stroke="#fff" stroke-width="3.5" fill="none" opacity=".7" stroke-linecap="round"/>
     <path d="M32 40 Q38 51 32 62" fill="none" ${ST3}/>
     <circle cx="22" cy="46" r="3.6" fill="${K}"/><circle cx="23" cy="44.8" r="1" fill="#fff"/><path d="M15 56 q4 3 8 0" fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="27" cy="55" rx="3.5" ry="2" fill="#ff8f7a" opacity=".75"/>` },
  shrimp: { label: '蝦', bg: '#ffe2d6', svg: () =>
    `<path d="M56 24 Q48 8 30 10" fill="none" ${ST3}/><path d="M60 24 Q60 6 76 4" fill="none" ${ST3}/>
     <path d="M26 72 L10 62 L13 82Z" fill="#ff8a5c" ${ST}/>
     <path d="M54 22 Q86 28 84 56 Q82 84 50 86 Q30 86 24 72 Q38 76 50 70 Q64 62 62 46 Q60 36 50 32Z" fill="#ff9d72" ${ST}/>
     <path d="M70 34 L78 28 M74 50 L86 50 M68 64 L78 72 M54 72 L58 84" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
     <circle cx="60" cy="31" r="3.6" fill="${K}"/><circle cx="61" cy="30" r="1" fill="#fff"/><ellipse cx="68" cy="40" rx="3.4" ry="2" fill="#ff6b5b" opacity=".6"/>` },
  chicken: { label: '雞', bg: '#ffeccf', svg: () =>
    `<g transform="rotate(45 72 70)"><rect x="65" y="52" width="14" height="32" rx="6" fill="#fff" ${ST}/></g>
     <circle cx="85" cy="78" r="7.5" fill="#fff" ${ST}/><circle cx="77" cy="88" r="7.5" fill="#fff" ${ST}/>
     <path d="M18 44 Q16 16 44 14 Q72 14 72 42 Q72 58 62 66 Q52 75 36 71 Q20 65 18 44Z" fill="#e8a046" ${ST}/>
     <path d="M28 32 q6 -9 15 -9" stroke="#fff" stroke-width="3.5" fill="none" opacity=".8" stroke-linecap="round"/>
     ${face(44, 46, .9)}` },
  pork: { label: '叉燒', bg: '#ffe0da', svg: () =>
    `<ellipse cx="50" cy="80" rx="42" ry="10" fill="#fff" ${ST}/>
     <path d="M18 56 Q50 44 82 56 L78 74 Q50 66 22 74Z" fill="#f6b0a3" ${ST}/><path d="M18 56 Q50 44 82 56" stroke="#c4302b" stroke-width="6" fill="none" stroke-linecap="round"/>
     <path d="M16 36 Q50 22 84 36 L80 56 Q50 46 20 56Z" fill="#f6b0a3" ${ST}/><path d="M16 36 Q50 22 84 36" stroke="#c4302b" stroke-width="7" fill="none" stroke-linecap="round"/>
     ${face(50, 44, .8)}` },
  beef: { label: '牛肉', bg: '#ffe0d6', svg: () =>
    `<path d="M16 50 Q14 24 42 22 Q70 18 82 36 Q92 56 74 72 Q54 88 32 78 Q16 70 16 50Z" fill="#c8553d" ${ST}/>
     <path d="M28 38 Q46 30 60 38 Q70 46 62 58" fill="none" stroke="#ffe3d6" stroke-width="5" stroke-linecap="round"/>
     <circle cx="68" cy="44" r="7" fill="#fff" ${ST3}/>
     ${face(42, 58, .9)}` },
  tofu: { label: '豆腐', bg: '#fff6d8', svg: () =>
    `<path d="M18 36 L50 21 L82 36 L50 51Z" fill="#fffaf0" ${ST}/>
     <path d="M18 36 L50 51 V86 L18 71Z" fill="#fff0c2" ${ST}/><path d="M82 36 L50 51 V86 L82 71Z" fill="#ffe39b" ${ST}/>
     ${face(34, 61, .65)}` },
  dumpling: { label: '雲吞餃子', bg: '#e7f6f3', svg: () =>
    `<ellipse cx="50" cy="78" rx="40" ry="9" fill="#c9ece6"/>
     <path d="M10 66 Q14 26 50 24 Q86 26 90 66 Q50 80 10 66Z" fill="#fff6e8" ${ST}/>
     <path d="M30 31 q5 6 3 12 M44 26 q5 6 3 12 M58 26 q5 6 3 12 M71 31 q3 6 1 11" stroke="${K}" stroke-width="3" fill="none" stroke-linecap="round"/>
     ${face(50, 56)}` },
  bun: { label: '包點', bg: '#fdf3e2', svg: () =>
    `<ellipse cx="50" cy="80" rx="40" ry="8" fill="#e9dcc6"/>
     <path d="M12 72 Q12 30 50 26 Q88 30 88 72 Q50 84 12 72Z" fill="#fffaf0" ${ST}/>
     <path d="M42 32 Q50 20 58 32" fill="none" ${ST3}/><circle cx="50" cy="27" r="2.5" fill="#ff6b5b"/>
     ${face(50, 58)}` },
  leaf: { label: '菜', bg: '#dcf5dc', svg: () =>
    `<path d="M50 90 Q18 72 22 38 Q28 12 50 10 Q72 12 78 38 Q82 72 50 90Z" fill="#46b86a" ${ST}/>
     <path d="M50 84 Q34 66 38 40 Q44 26 50 24 Q56 26 62 40 Q66 66 50 84Z" fill="#8fd98a"/>
     <path d="M50 28 V86" stroke="#ecfbe6" stroke-width="5" stroke-linecap="round"/>
     <g fill="#ffd84d" ${ST3}><circle cx="40" cy="12" r="4.5"/><circle cx="52" cy="7" r="4.5"/><circle cx="62" cy="13" r="4.5"/></g>
     ${face(50, 52, .75)}` },
  mushroom: { label: '冬菇', bg: '#f3e8dc', svg: () =>
    `<path d="M38 52 Q35 80 42 87 H58 Q65 80 62 52Z" fill="#fff3dc" ${ST}/>
     <path d="M10 56 Q12 16 50 14 Q88 16 90 56 Q50 64 10 56Z" fill="#9b6a43" ${ST}/>
     <g fill="#d9b08c"><ellipse cx="32" cy="34" rx="7" ry="4.5"/><ellipse cx="58" cy="26" rx="6" ry="4"/><ellipse cx="70" cy="44" rx="5" ry="3.5"/></g>
     ${face(50, 72, .65)}` },
  cake: { label: '蛋糕', bg: '#ffe6ee', svg: () =>
    `<ellipse cx="50" cy="86" rx="42" ry="7" fill="#fff" ${ST3}/>
     <rect x="16" y="46" width="68" height="38" rx="8" fill="#ffd3df" ${ST}/>
     <path d="M16 54 Q24 63 33 54 Q41 63 50 54 Q59 63 67 54 Q75 63 84 54 V48 Q84 40 76 40 H24 Q16 40 16 48Z" fill="#fff" ${ST}/>
     <path d="M50 32 Q52 20 60 16" fill="none" ${ST3}/><circle cx="50" cy="33" r="7.5" fill="#ff5f6d" ${ST}/>
     ${face(50, 70, .8)}` },
  tea: { label: '奶茶', bg: '#f3e6da', svg: () =>
    `${steam([40, 54], 24, '#d9c2ad')}
     <ellipse cx="48" cy="88" rx="36" ry="6" fill="#fff" ${ST3}/>
     <path d="M74 46 Q93 46 91 60 Q89 73 70 71" fill="none" ${ST}/>
     <path d="M20 34 H76 L70 80 Q68 88 60 88 H36 Q28 88 26 80Z" fill="#fff" ${ST}/>
     <path d="M22 41 H74 L73 50 H23Z" fill="#c98a5a"/>
     ${face(48, 66, .8)}` },
  salad: { label: '沙律', bg: '#e1f6dd', svg: () =>
    `<path d="M16 50 Q14 30 30 30 Q34 18 48 22 Q58 12 70 22 Q86 22 84 40 Q88 46 86 50Z" fill="#5cc46f" ${ST}/>
     <circle cx="36" cy="38" r="7" fill="#ff6b5b" ${ST3}/><circle cx="64" cy="34" r="7" fill="#ff6b5b" ${ST3}/><circle cx="52" cy="42" r="6" fill="#ffe08a" ${ST3}/>
     ${bowl('#8fd9cf')}${face(50, 72)}` },
  corn: { label: '粟米', bg: '#fff3c4', svg: () =>
    `<ellipse cx="50" cy="44" rx="19" ry="35" fill="#ffd54a" ${ST}/>
     <g stroke="#e0a91f" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M36 26 Q50 22 64 26"/><path d="M33 38 Q50 34 67 38"/><path d="M32 50 Q50 46 68 50"/><path d="M34 62 Q50 58 66 62"/><path d="M50 12 V78"/></g>
     <path d="M50 92 Q18 74 24 42 Q32 62 50 72Z" fill="#6cc46a" ${ST}/><path d="M50 92 Q82 74 76 42 Q68 62 50 72Z" fill="#57b85a" ${ST}/>
     ${face(50, 46, .7)}` },
  potato: { label: '薯仔', bg: '#f6e7d2', svg: () =>
    `<path d="M18 52 Q14 30 36 24 Q60 16 76 30 Q92 46 82 66 Q70 86 44 82 Q22 78 18 52Z" fill="#d9a066" ${ST}/>
     <g fill="#b87d45"><circle cx="32" cy="40" r="2.5"/><circle cx="70" cy="36" r="2.5"/><circle cx="74" cy="62" r="2.5"/><circle cx="30" cy="66" r="2.2"/></g>
     ${face(52, 54)}` },
  garlic: { label: '蒜薑蔥', bg: '#f4f1e6', svg: () =>
    `<path d="M50 12 Q54 26 66 34 Q86 48 80 68 Q72 88 50 88 Q28 88 20 68 Q14 48 34 34 Q46 26 50 12Z" fill="#fffdf6" ${ST}/>
     <path d="M50 34 Q40 60 44 86 M50 34 Q60 60 56 86" fill="none" stroke="#d6cfbf" stroke-width="3"/>
     ${face(50, 62, .8)}` },
  milk: { label: '奶類', bg: '#e3f3fb', svg: () =>
    `<path d="M28 34 L36 16 H64 L72 34 V88 H28Z" fill="#fff" ${ST}/><path d="M28 34 H72 M36 16 L44 34" fill="none" ${ST3}/>
     <rect x="28" y="48" width="44" height="26" fill="#4fc7b8"/><path d="M28 48 H72 M28 74 H72" ${ST3}/>
     ${face(50, 60, .7)}` },
  eggtart: { label: '蛋撻', bg: '#fff0c8', svg: () =>
    `<path d="M10 52 Q14 44 20 50 Q24 42 32 48 Q38 40 46 46 Q50 38 56 46 Q64 40 68 48 Q76 42 80 50 Q86 44 90 52 L80 80 Q50 90 20 80Z" fill="#e8a54a" ${ST}/>
     <ellipse cx="50" cy="52" rx="34" ry="11" fill="#ffd23f" ${ST}/><path d="M34 50 q6 -4 14 -4" stroke="#fff6c8" stroke-width="3" fill="none" stroke-linecap="round"/>
     ${face(50, 69, .8)}` },
  pineapplebun: { label: '菠蘿包', bg: '#fff0c8', svg: () =>
    `<path d="M10 70 Q10 30 50 26 Q90 30 90 70 Q50 82 10 70Z" fill="#f0b448" ${ST}/>
     <g stroke="#c98a26" stroke-width="3" stroke-linecap="round"><path d="M22 48 L36 36"/><path d="M22 62 L50 34"/><path d="M36 66 L66 36"/><path d="M54 70 L80 46"/><path d="M30 38 L60 70"/><path d="M48 32 L80 62"/><path d="M18 56 L36 72"/></g>
     <rect x="30" y="50" width="40" height="18" rx="9" fill="#f0b448"/>
     ${face(50, 58)}` },
  sauce: { label: '調味料', bg: '#efe3d8', svg: () =>
    `<rect x="38" y="6" width="24" height="11" rx="3" fill="#ff6b5b" ${ST}/>
     <path d="M40 16 H60 V26 Q74 34 74 50 V84 Q74 90 68 90 H32 Q26 90 26 84 V50 Q26 34 40 26Z" fill="#7a4a2c" ${ST}/>
     <rect x="31" y="52" width="38" height="25" rx="7" fill="#fff" ${ST3}/>
     ${face(50, 64, .65)}` },
  basket: { label: '其他', bg: '#e6f4f1', svg: () =>
    `<path d="M28 46 Q28 14 50 14 Q72 14 72 46" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
     <circle cx="38" cy="40" r="10" fill="#ff6b5b" ${ST3}/><path d="M56 44 Q54 26 66 24 Q70 36 62 46Z" fill="#46b86a" ${ST3}/>
     <path d="M12 44 H88 L80 86 Q78 90 74 90 H26 Q22 90 20 86Z" fill="#f2c48a" ${ST}/>
     <path d="M20 58 H80 M22 72 H78" stroke="#c99459" stroke-width="3"/>
     ${face(50, 64, .75)}` },
  plate: { label: '碟頭', bg: '#e3f6f2', svg: () =>
    `<path d="M8 22 V44 M4 22 V34 Q4 40 8 40 Q12 40 12 34 V22" fill="none" ${ST3}/><path d="M8 40 V84" ${ST}/>
     <path d="M92 22 Q84 36 88 52 H92 V84" fill="#fff" ${ST}/>
     <circle cx="50" cy="54" r="33" fill="#fff" ${ST}/><circle cx="50" cy="54" r="22" fill="#e6f7f5" stroke="#bde7e1" stroke-width="3"/>
     ${face(50, 56, .8)}` },
  chili: { label: '辣', bg: '#ffe0da', svg: () =>
    `<path d="M70 18 Q76 8 84 10" fill="none" stroke="#3aa35c" stroke-width="5" stroke-linecap="round"/>
     <path d="M66 20 Q80 30 74 52 Q66 80 30 88 Q18 90 20 82 Q50 72 54 44 Q56 26 66 20Z" fill="#ff4d3d" ${ST}/>
     ${face(56, 52, .7)}` },
  wok: { label: '鑊仔', bg: '#d4f3ee', svg: () =>
    `<rect x="78" y="46" width="22" height="9" rx="4.5" fill="#b5743a" ${ST}/>
     <path d="M30 30 Q20 16 34 12 Q38 2 49 6 Q59 0 64 10 Q76 12 68 30Z" fill="#fff" ${ST}/>
     <rect x="31" y="27" width="36" height="13" rx="4" fill="#fff" ${ST}/>
     <path d="M6 46 H84 Q82 84 45 86 Q8 84 6 46Z" fill="#1f9a8e" ${ST}/>
     <path d="M14 56 Q45 62 76 56" stroke="#8fe3d7" stroke-width="3.5" fill="none" opacity=".7" stroke-linecap="round"/>
     ${face(45, 68, 1.05, 'open')}` },
};
const ICON_KEYS = Object.keys(ICONS).filter(k => k !== 'wok');

function iconSVG(key, cls = '') {
  const ic = ICONS[key] || ICONS.plate;
  return `<svg class="${cls}" width="100%" height="100%" viewBox="-4 -4 108 104" aria-hidden="true" focusable="false">${ic.svg()}</svg>`;
}
function iconBg(key) { return (ICONS[key] || ICONS.plate).bg; }

/* 食材 → 插圖 / 分類 */
const ING_RULES = [
  [/水$|^水|熱水|暖水|清水/, 'water', 'water'],
  [/醬|豉油|蠔油|魚露|生抽|老抽|雞粉|雞精|茄汁|茄膏/, 'sauce', 'sauce'],
  [/番茄|蕃茄|車厘茄/, 'tomato', 'veg'],
  [/麵粉|粟粉|生粉|糖粉|澄麵/, 'basket', 'dry'],
  [/蛋撻/, 'eggtart', 'other'],
  [/蛋/, 'egg', 'egg'],
  [/豆腐|腐竹/, 'tofu', 'egg'],
  [/淡奶|牛奶|鮮奶|芝士|牛油|忌廉|奶/, 'milk', 'egg'],
  [/雞/, 'chicken', 'meat'],
  [/叉燒|豬|排骨|梅頭|免治|瘦肉|肉碎|肉片|煙肉|火腿|腸/, 'pork', 'meat'],
  [/牛/, 'beef', 'meat'],
  [/魚|三文|鱸|斑/, 'fish', 'sea'],
  [/蝦|蟹|帶子|蜆|魷|海鮮|蠔$/, 'shrimp', 'sea'],
  [/西蘭花|椰菜花/, 'broccoli', 'veg'],
  [/紅蘿蔔|甘筍/, 'carrot', 'veg'],
  [/菇|木耳/, 'mushroom', 'veg'],
  [/粟米/, 'corn', 'veg'],
  [/薯/, 'potato', 'veg'],
  [/蒜|薑|蔥|洋蔥|乾蔥|芫荽|韭/, 'garlic', 'veg'],
  [/辣椒|指天椒|豆瓣|花椒/, 'chili', 'sauce'],
  [/菜|生菜|白菜|芥蘭|芽菜|青瓜|節瓜|冬瓜|椰菜|豆角|青豆|苦瓜|茄子|翠玉瓜|蘆筍|菠菜/, 'leaf', 'veg'],
  [/米$|白米|飯|糙米/, 'rice', 'dry'],
  [/麵|意粉|米粉|河粉|烏冬|雲吞皮|餃子皮/, 'noodles', 'dry'],
  [/粉|糖|酵母|茶葉|紅棗|蜜棗|杞子|乾/, 'basket', 'dry'],
  [/油|鹽|醬|醋|酒|豉|蠔油|胡椒|麻油|蜜糖|生抽|老抽|味精|雞粉|露/, 'sauce', 'sauce'],
];
function ingInfo(name) {
  for (const [re, icon, cat] of ING_RULES) if (re.test(name)) return { icon, cat };
  return { icon: 'basket', cat: 'other' };
}
const CATS = {
  veg: { label: '蔬菜生果', icon: 'broccoli' },
  meat: { label: '肉類', icon: 'chicken' },
  sea: { label: '海鮮', icon: 'fish' },
  egg: { label: '蛋奶豆腐', icon: 'egg' },
  dry: { label: '米麵乾貨', icon: 'rice' },
  sauce: { label: '調味料', icon: 'sauce' },
  other: { label: '其他', icon: 'basket' },
};
const CAT_ORDER = ['veg', 'meat', 'sea', 'egg', 'dry', 'sauce', 'other'];
