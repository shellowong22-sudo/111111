import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.add_init_script(path='/tmp/mock-shared.js')
        errs=[]
        A = await ctx.new_page(); A.on('pageerror', lambda e: errs.append('A '+str(e)))
        await A.goto('http://localhost:8765/wokzai/index.html?u=mum'); await A.wait_for_timeout(800)
        await A.evaluate("localStorage.clear()"); await A.reload(); await A.wait_for_timeout(800)
        await A.evaluate("ACTS.whoPick({dataset:{n:'阿媽', i:'eggtart'}})"); await A.wait_for_timeout(1500)
        B = await ctx.new_page(); B.on('pageerror', lambda e: errs.append('B '+str(e)))
        await B.goto('http://localhost:8765/wokzai/index.html?u=dad'); await B.wait_for_timeout(1200)
        await B.evaluate("ACTS.whoPick({dataset:{n:'阿爸', i:'bun'}})"); await A.wait_for_timeout(800)
        print('B sees', await B.evaluate("[S.shop.length, S.pantry.length, Object.keys(S.members).length]"))
        ids = await A.evaluate("[S.shop[0].id, S.shop[1].id]")
        # simultaneous edits
        await asyncio.gather(
          A.evaluate("ACTS.shopToggle({dataset:{id:%r}}); const k=TODAY(); S.plan[k]={...dayPlan(k), d:[...dayPlan(k).d,'L14']}; save(); S.pantry.push({id:'pa1', n:'阿媽豬扒', q:1, u:'塊', exp:''}); save();" % ids[0]),
          B.evaluate("ACTS.shopToggle({dataset:{id:%r}}); const k=TODAY(); S.plan[k]={...dayPlan(k), d:[...dayPlan(k).d,'L19']}; save(); S.shop.push({id:'sb1', n:'阿爸檸檬', q:1, u:'個', cat:'veg', done:false, from:[], t:Date.now()}); save();" % ids[1]))
        await A.wait_for_timeout(2000)
        chk = "(()=>{ const k=TODAY(); const a=S.shop.find(i=>i.id===%r), b=S.shop.find(i=>i.id===%r); return {aDone:a&&a.done, bDone:b&&b.done, plan:dayPlan(k).d.filter(x=>x==='L14'||x==='L19'), pantry:S.pantry.some(p=>p.id==='pa1'), shop:S.shop.some(i=>i.id==='sb1'), doneBy:[a&&a.doneBy, b&&b.doneBy]}; })()" % (ids[0], ids[1])
        ra = await A.evaluate(chk); rb = await B.evaluate(chk)
        print('A', ra); print('B', rb)
        same = await A.evaluate("stable(stateDocs())") == await B.evaluate("stable(stateDocs())")
        print('A and B identical:', same)
        # dedupe
        n1 = await A.evaluate("(()=>{ const n0=S.shop.length; addDaysToShop([TODAY()]); const n1=S.shop.length; addDaysToShop([TODAY()]); return [n0, n1, S.shop.length]; })()")
        print('dedupe shop counts [before, after 1st, after 2nd]', n1)
        print('plan docs', await A.evaluate("Object.keys(stateDocs()).filter(k=>k.startsWith('pe-')).length"), 'legacy', await A.evaluate("Object.keys(stateDocs()).filter(k=>k.startsWith('plan-')).length"))
        # back button in standalone
        h0 = await A.evaluate("history.length")
        await A.evaluate("openRecipe('L01')"); await A.wait_for_timeout(100)
        await A.go_back(); await A.wait_for_timeout(300)
        print('back closes sheet:', await A.evaluate("$$('#sheets .backdrop').length===0"), 'still in app:', 'index.html' in A.url)
        await A.evaluate("openRecipe('L02')"); await A.wait_for_timeout(100); await A.evaluate("closeSheet()"); await A.wait_for_timeout(300)
        await A.evaluate("openFam()"); await A.wait_for_timeout(200); await A.go_back(); await A.wait_for_timeout(300)
        print('after X then back:', await A.evaluate("$$('#sheets .backdrop').length"), 'depth', await A.evaluate("RT.backDepth"))
        print('input font', await A.evaluate("show('shop'); getComputedStyle($('#saN')).fontSize"))
        print(errs or 'no page errors')
        await b.close()
asyncio.run(main())
