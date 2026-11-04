import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/wokzai-recipes.html'); await pg.wait_for_timeout(1000)
        r = await pg.evaluate("""(()=>{
          S.pantry.push({id:'mine1', n:'我嘅豬扒', q:2, u:'塊', exp:''}); S.shop.push({id:'mine2', n:'我嘅檸檬', q:1, u:'個', cat:'veg', done:false, from:[], t:Date.now()});
          const k=TODAY(); S.plan[k]={...dayPlan(k), d:[...dayPlan(k).d, 'L14']}; S.favs.push('L20'); save();
          const before=[S.pantry.length, S.shop.length, dayPlan(k).d.length, S.favs.length];
          ACTS.clearDemo();
          return {before, after:[S.pantry.map(p=>p.n), S.shop.map(i=>i.n), dayPlan(k).d, S.favs, S.recipes.length, Object.keys(S.plan).filter(x=>dayIds(x).length)]};
        })()""")
        print(r)
        await pg.reload(); await pg.wait_for_timeout(800)
        print('after reload', await pg.evaluate("[S.pantry.map(p=>p.n), S.shop.map(i=>i.n), S.settings.demoCleared, RT.hideHave]"))
        print(errs or 'no errors'); await b.close()
asyncio.run(main())
