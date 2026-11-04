import asyncio, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844})
        # fonts hang forever (like a blocked network)
        async def hang(route): await asyncio.sleep(25); await route.abort()
        await ctx.route('**/fonts.googleapis.com/**', hang)
        errs=[]
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        t0=time.time()
        await pg.goto('http://localhost:8765/wokzai/index.html', wait_until='commit')
        await pg.wait_for_selector('.hero h1', timeout=8000)
        print('first render with fonts blocked: %.1fs' % (time.time()-t0))
        await pg.wait_for_timeout(600)
        # storage capacity: 60 recipes with ~120KB photos
        await pg.evaluate("""(()=>{ const ph='data:image/jpeg;base64,'+'A'.repeat(120000);
          for(let i=0;i<60;i++){ S.recipes.push({id:'U-big'+i, name:'相片食譜'+i, icon:'plate', type:'meat', cuisine:'家常', time:10, level:1, servings:2, ings:[{n:'雞蛋',q:1,u:'隻'}], steps:[{t:'煮',min:0}], photo:ph, src:'me', created:Date.now()}); }
          save(); })()""")
        await pg.wait_for_timeout(1200)
        await pg.evaluate("ACTS.shopToggle({dataset:{id:S.shop[0].id}})"); await pg.wait_for_timeout(100)
        await pg.reload(wait_until='commit'); await pg.wait_for_selector('.hero h1'); await pg.wait_for_timeout(1500)
        print('after reload: recipes', await pg.evaluate("S.recipes.length"), 'with photo', await pg.evaluate("S.recipes.filter(r=>r.photo).length"), 'first shop item done', await pg.evaluate("S.shop[0].done"))
        # undo
        r = await pg.evaluate("""(async()=>{ const id=S.shop[1].id, n0=S.shop.length; ACTS.shopDel({dataset:{id}}); const n1=S.shop.length; $$('.toast.undo button').pop().click(); await new Promise(r=>setTimeout(r,50)); const n2=S.shop.length;
           const rid='U-big3'; openRecipe(rid); const d=$('#sheets [data-act=delRecipe]'); ACTS.delRecipe(d); ACTS.delRecipe(d); const gone=!getRecipe(rid); $$('.toast.undo button').pop().click(); await new Promise(r=>setTimeout(r,50)); const back=!!getRecipe(rid);
           S.shop[0].done=true; S.shop[2].done=true; save(); const p0=S.pantry.length, s0=S.shop.length; ACTS.shopToPantry(); const p1=S.pantry.length; $$('.toast.undo button').pop().click(); await new Promise(r=>setTimeout(r,50));
           return {shopDel:[n0,n1,n2], recipeGoneThenBack:[gone, back], toPantryUndo:[p0,p1,S.pantry.length, s0, S.shop.length]}; })()""")
        print('undo', r)
        # multi-tab
        pg2 = await ctx.new_page(); pg2.on('pageerror', lambda e: errs.append('tab2 '+str(e)[:200]))
        await pg2.goto('http://localhost:8765/wokzai/index.html', wait_until='commit'); await pg2.wait_for_selector('.hero h1'); await pg2.wait_for_timeout(1500)
        await pg.evaluate("S.pantry.push({id:'tab1x', n:'分頁測試', q:1, u:'個', exp:''}); save(); Store.flushLocal();"); await pg.wait_for_timeout(1200)
        print('tab2 sees tab1 change:', await pg2.evaluate("S.pantry.some(p=>p.id==='tab1x')"))
        # small screens overflow scan
        for w in (320, 360):
            await pg2.set_viewport_size({'width':w,'height':700})
            res={}
            for v in ['home','recipes','ai','plan','shop','stats','tools']:
                await pg2.evaluate(f"show('{v}')"); await pg2.wait_for_timeout(150)
                bad = await pg2.evaluate("""(()=>{ const W=document.documentElement.clientWidth; const out=[]; for (const el of document.querySelectorAll('#v-'+RT.view+' *, header.top *, nav.tabs *')) { if (!el.offsetParent && el.tagName!=='svg') continue; const r=el.getBoundingClientRect(); if (r.width>0 && (r.right>W+1 || r.left<-1) && !el.closest('.hscroll,.chips.scroll,.chart')) out.push((el.className&&el.className.baseVal===undefined?el.className:el.tagName)+':'+Math.round(r.right)); } return [...new Set(out)].slice(0,5); })()""")
                if bad: res[v]=bad
            print(f'{w}px overflow:', res or 'none', 'page scrollWidth', await pg2.evaluate("document.documentElement.scrollWidth"))
        await pg2.set_viewport_size({'width':320,'height':700}); await pg2.evaluate("show('home')"); await pg2.wait_for_timeout(200)
        await pg2.screenshot(path='/home/claude/shot_320.png', full_page=False)
        print(errs or 'no page errors')
        await b.close()
asyncio.run(main())
