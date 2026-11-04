import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2)
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.type+' '+m.text) if m.type in ('error','warning') else None)
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto('file:///home/claude/wokzai-recipes.html')
        await pg.wait_for_timeout(2500)
        for v in ['recipes','ai','plan','shop','stats','tools','home']:
            await pg.evaluate(f"show('{v}')")
            await pg.wait_for_timeout(250)
        # exercise a few flows
        await pg.evaluate("openRecipe('L01')"); await pg.wait_for_timeout(200)
        await pg.evaluate("ACTS.serv($('#sheets [data-act=serv]'))"); await pg.evaluate("closeSheet()")
        await pg.evaluate("openEditor('U-demo1')"); await pg.wait_for_timeout(200); await pg.evaluate("closeSheet()")
        await pg.evaluate("openPicker(TODAY(),'d')"); await pg.evaluate("closeSheet()")
        await pg.evaluate("autoPair(TODAY(),'l')")
        await pg.evaluate("show('tools'); spin()"); await pg.wait_for_timeout(3500)
        await pg.evaluate("startTimer('test',5)"); await pg.wait_for_timeout(600)
        await pg.evaluate("openCook('L03')"); await pg.evaluate("ACTS.cookClose()")
        await pg.evaluate("show('home')"); await pg.wait_for_timeout(400)
        info = await pg.evaluate("({sync: document.querySelector('#sync').textContent, shop: S.shop.length, w: document.documentElement.scrollWidth, wheel: document.querySelector('#wheelRes').textContent.trim().slice(0,30)})")
        print(info)
        await pg.screenshot(path='/home/claude/shot_home.png', full_page=True)
        await pg.evaluate("show('stats')"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/home/claude/shot_stats.png', full_page=True)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
