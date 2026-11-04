(() => {
  const R = n => ({ name: n || '香煎雞扒', desc: '外脆內嫩', icon: 'chicken', type: 'meat', cuisine: '港式', time: 20, level: 1, servings: 2, kcal: 380, p: 30, c: 5, f: 22, tags: ['快手'], ings: [{ n: '雞髀扒', q: 2, u: '塊', cat: 'meat' }, { n: '蒜頭', q: 2, u: '粒', cat: 'veg' }, { n: '生抽', q: 1, u: '湯匙', cat: 'sauce' }], steps: [{ t: '醃雞扒 10 分鐘', min: 10 }, { t: '落鑊煎香', min: 8 }], tips: '皮向下先煎' });
  const reply = p => {
    if (p.includes('"ideas"')) return JSON.stringify({ ideas: [{ name: '蒜蓉粉絲蒸扇貝', type: 'sea', icon: 'shrimp', why: '加個海鮮' }, { name: '冬瓜湯', type: 'soup', icon: 'soup', why: '清熱' }] });
    if (p.includes('"dishes"')) return JSON.stringify({ title: '清淡一湯兩餸', dishes: [R('蒸魚'), { ...R('菜心'), type: 'veg', icon: 'leaf' }, { ...R('老火湯'), type: 'soup', icon: 'soup' }] });
    if (p.includes('"items"')) return JSON.stringify({ items: [{ n: '番茄', q: 3, u: '個', cat: 'veg' }, { n: '雞蛋', q: 6, u: '隻', cat: 'egg' }] });
    if (p.includes('"kcal":數字')) return '```json\n{"kcal": 410, "p": 28, "c": 12, "f": 20}\n```';
    if (p.includes('問題：')) return '煎魚之前抹乾水，鑊要熱，油要夠。';
    const m = p.match(/寫「(.+?)」嘅食譜/); return 'Sure! ' + JSON.stringify(R(m && m[1]));
  };
  const sample = async (input, opts = {}) => { const t = reply(typeof input === 'string' ? input : input[input.length - 1].content); if (opts.onText) { opts.onText({ text: 'Thinking...', delta: '' }); opts.onText({ text: t.slice(0, 5), delta: t.slice(0, 5) }); } window.__aiCalls = (window.__aiCalls || 0) + 1; if (opts.images) window.__aiImg = opts.images.length; return { text: t, truncated: false }; };
  sample.limits = async () => ({ images: true });
  const prev = window.claude.use; window.claude = { use: async n => n === 'sample' ? sample : prev(n) };
})();
