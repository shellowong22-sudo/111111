import asyncio
from playwright.async_api import async_playwright
FUZZ = r"""(()=>{
  let seed = 12345; const R = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = a => a[Math.floor(R() * a.length)];
  const atoms = [null, undefined, 0, -1, 1e20, NaN, '', '鸡蛋', '<img src=x onerror=1>', '一'.repeat(500), true, [], {}, [1,2], {n:1}, 'L01', 'U-x', '../x', '2026-11-04', '\u0000', 'meat', 'sea', 'water'];
  const gen = d => { if (d > 3 || R() < .3) return pick(atoms); if (R() < .5) { const n = Math.floor(R() * 6); return Array.from({length:n}, () => gen(d+1)); } const o = {}; const keys = ['id','name','n','q','u','cat','ings','steps','t','min','type','icon','photo','recipes','shop','pantry','plan','favs','members','log','settings','done','exp','d','m','b','l','avoid','note','people','items','title','dishes','kcal','tags','servings','time','level']; const n = Math.floor(R() * 8); for (let i = 0; i < n; i++) o[pick(keys)] = gen(d+1); return o; };
  const res = { normAI_ok: 0, normAI_rejected: 0, normAI_crash: [], merge_crash: [], docs_crash: [], invalid_after: [] };
  for (let i = 0; i < 3000; i++) { const o = gen(0); try { const r = normAI(o); if (!cleanRecipe(r)) res.invalid_after.push('normAI'); res.normAI_ok++; } catch (e) { if (e && e.code) res.normAI_rejected++; else res.normAI_crash.push(String(e).slice(0, 80)); } }
  const keep = S;
  for (let i = 0; i < 1500; i++) { S = cleanState({}); try { mergeIn(gen(0)); const c = cleanState(S); if (stable(c) !== stable(cleanState(c))) res.invalid_after.push('merge'); renderShop(); } catch (e) { res.merge_crash.push(String(e).slice(0, 80)); } }
  for (let i = 0; i < 1500; i++) { const docs = {}; const n = Math.floor(R() * 8); for (let k = 0; k < n; k++) docs[pick(['meta','r-U-a','shop-s1','pantry-p1','pe-2026-11-04-d-L01-0','plan-2026-11-04','member-u_x','log-2026-11','pe-bad','r-'])] = gen(0); try { S = stateFromDocs(docs); stateDocs(); renderPlan(); renderStats(); } catch (e) { res.docs_crash.push(String(e).slice(0, 80)); } }
  S = keep; refresh();
  for (const k in res) if (Array.isArray(res[k])) res[k] = [...new Set(res[k])].slice(0, 5);
  return res; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(); await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
        await pg.goto('file:///home/claude/wokzai-recipes.html'); await pg.wait_for_timeout(1000)
        print(await pg.evaluate(FUZZ)); print(errs or 'no page errors'); await b.close()
asyncio.run(main())
