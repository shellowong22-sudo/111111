import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.add_init_script(path='/tmp/mock.js')
        await ctx.add_init_script(script="(()=>{ const prev=window.claude.use; window.claude={use: async n => n==='downloads' ? {save: async o => { window.__dl={name:o.filename, size:(o.data.size||o.data.length)}; return {status:'saved'}; }} : prev(n)}; })()")
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('file:///home/claude/wokzai-recipes.html'); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""(async()=>{
          show('recipes'); $('#recQ').value='鸡蛋'; $('#recQ').dispatchEvent(new Event('input')); const n1=$$('#recList .rcard').length;
          $('#recQ').value='红萝卜'; $('#recQ').dispatchEvent(new Event('input')); const n2=$$('#recList .rcard').length;
          RT.recQ=''; renderRecList();
          S.pantry=[{id:'z1', n:'鸡蛋', q:6, u:'只', exp:''},{id:'z2', n:'葱', q:1, u:'条', exp:''}]; save();
          const icon=ingInfo('猪扒').icon, cat=ingInfo('西兰花').cat, inP=inPantry('雞蛋');
          S.settings.avoid='牛肉'; const av=avoidHit(getRecipe('L07'));
          const tenYearsShop={id:'old1', n:'舊嘢', q:1, u:'', cat:'other', done:true, doneAt:Date.now()-40*864e5, from:[], t:1}; S.shop.push(tenYearsShop); S.log['2020-01']=[{d:'2020-01-03', id:'L01', by:''}]; save();
          const pruned=[!S.shop.some(i=>i.id==='old1'), !S.log['2020-01']];
          const it=S.shop[0]; ACTS.shopToggle({dataset:{id:it.id}}); const doneAt=!!it.doneAt;
          await ACTS.backupDl();
          return {search_鸡蛋:n1, search_红萝卜:n2, icon_猪扒:icon, cat_西兰花:cat, pantry_simplified_matches_trad:inP, avoid_simplified:av, pruned, doneAt, download: window.__dl};
        })()""")
        print(r); print(errs or 'no errors'); await b.close()
asyncio.run(main())
