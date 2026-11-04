import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'file:///home/claude/wokzai-recipes.html'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.add_init_script(path='/tmp/mock.js')
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        # 4x CPU slowdown to approximate a mid-range phone
        cdp = await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        await pg.evaluate("""(()=>{ const ph='data:image/jpeg;base64,'+'Q'.repeat(110000);
          ACTS.whoPick({dataset:{n:'阿媽', i:'egg'}});
          for(let i=0;i<120;i++) S.recipes.push({id:'U-p'+i, name:'食譜'+i, icon:'plate', type:'meat', cuisine:'家常', time:10+i%50, level:1, servings:2, kcal:300, p:10, c:10, f:10, ings:[{n:'雞蛋',q:2,u:'隻'},{n:'番茄',q:1,u:'個'},{n:'蔥',q:1,u:'條'}], steps:[{t:'煮',min:3}], photo: i%1===0?ph:'', src:'me', created:i});
          for(let i=0;i<300;i++) S.shop.push({id:'sx'+i, n:'材料'+i, q:1, u:'個', cat:'veg', done:i%3===0, from:[], t:i});
          save(); })()""")
        await pg.wait_for_timeout(6000)
        await pg.evaluate("show('recipes')"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("""(async()=>{ const N=5; let tot=0, mx=0;
          for (let k=0;k<N;k++){ const id='shop-sx'+k; const v=JSON.parse(JSON.stringify(__store[id])); v.done=!v.done;
            const t0=performance.now(); __extSet(id, v); await new Promise(r=>setTimeout(r,40)); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); const d=performance.now()-t0-40; tot+=d; mx=Math.max(mx,d); }
          return {avgMs: Math.round(tot/N), maxMs: Math.round(mx)}; })()""")
        print('one family tick while on recipes page (4x slow CPU):', t)
        t2 = await pg.evaluate("""(()=>{ const t0=performance.now(); ACTS.shopToggle({dataset:{id:'sx5'}}); return Math.round(performance.now()-t0); })()""")
        print('own tick (save+render) ms:', t2)
        t3 = await pg.evaluate("""(()=>{ const t0=performance.now(); ACTS.shopDel({dataset:{id:'sx6'}}); return Math.round(performance.now()-t0); })()""")
        print('delete with undo snapshot ms:', t3)
        print('docs', await pg.evaluate("Object.keys(__store).length"), errs or 'no errors')
        await b.close()
asyncio.run(main())
