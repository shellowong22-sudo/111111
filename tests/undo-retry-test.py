import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.add_init_script(path='/tmp/mock-shared.js')
        errs=[]
        A = await ctx.new_page(); A.on('pageerror', lambda e: errs.append('A '+str(e)[:150]))
        await A.goto('http://localhost:8765/wokzai/index.html?u=mum'); await A.wait_for_timeout(600)
        await A.evaluate("localStorage.clear()"); await A.reload(); await A.wait_for_timeout(800)
        await A.evaluate("ACTS.whoPick({dataset:{n:'阿媽', i:'eggtart'}})"); await A.wait_for_timeout(1500)
        B = await ctx.new_page(); B.on('pageerror', lambda e: errs.append('B '+str(e)[:150]))
        await B.goto('http://localhost:8765/wokzai/index.html?u=dad'); await B.wait_for_timeout(1500)
        x, y = await A.evaluate("[S.shop[0].id, S.shop[1].id]")
        await A.evaluate("show('shop'); ACTS.shopDel({dataset:{id:%r}})" % x); await A.wait_for_timeout(300)
        await B.evaluate("ACTS.shopToggle({dataset:{id:%r}})" % y); await A.wait_for_timeout(900)
        await A.evaluate("$$('.toast.undo button').pop().click()"); await A.wait_for_timeout(1200)
        chk = "[S.shop.some(i=>i.id===%r), !!(S.shop.find(i=>i.id===%r)||{}).done]" % (x, y)
        print('A after undo [X back, Y still ticked]:', await A.evaluate(chk), ' B:', await B.evaluate(chk))
        print(errs or 'no errors'); await b.close()
        # retry after transient failure
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(); await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.add_init_script(path='/tmp/mock.js')
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
        await pg.goto('file:///home/claude/wokzai-recipes.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("ACTS.whoPick({dataset:{n:'阿媽', i:'egg'}})"); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""(async()=>{ const col = Store.col(); const realDoc = col.doc.bind(col); let failNext = true;
          Store.col = () => ({ ...col, doc: id => { const d = realDoc(id); return { ...d, set: async v => { if (failNext) { failNext = false; throw {code:'unavailable'}; } return d.set(v); } }; } });
          const it = S.shop[2]; ACTS.shopToggle({dataset:{id:it.id}}); await new Promise(r=>setTimeout(r,300));
          const before = !!__store['shop-'+it.id].done; await new Promise(r=>setTimeout(r,9000)); return {writtenBeforeRetry: before, writtenAfterRetry: !!__store['shop-'+it.id].done}; })()""")
        print('retry', r)
        # photo shrink on import
        r2 = await pg.evaluate("""(async()=>{ const cv=document.createElement('canvas'); cv.width=2000; cv.height=1500; const g=cv.getContext('2d'); for(let i=0;i<4000;i++){ g.fillStyle='hsl('+(i*37%360)+',70%,50%)'; g.fillRect(Math.random()*2000,Math.random()*1500,30,30); } const big=cv.toDataURL('image/jpeg', .95);
          const n = mergeIn({recipes:[{id:'U-imp1', name:'匯入相', icon:'plate', type:'meat', ings:[{n:'蛋',q:1,u:'隻'}], steps:[{t:'煮'}], photo: big.length<400000?big:big.slice(0,399000)}]}); save(); await shrinkBigPhotos();
          const r = getRecipe('U-imp1'); return {originalLen: big.length, afterLen: r && r.photo ? r.photo.length : 0, kept: !!r}; })()""")
        print('shrink', r2); print(errs or 'no errors'); await b.close()
asyncio.run(main())
