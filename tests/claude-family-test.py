import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2)
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.type+' '+m.text) if m.type in ('error',) and 'ERR_FAILED' not in m.text else None)
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.add_init_script(path='/tmp/mock.js')
        await pg.goto('file:///home/claude/wokzai-recipes.html')
        await pg.wait_for_timeout(1500)
        print('A', await pg.evaluate("({sync: $('#sync').textContent, demo: S.demo, docs: Object.keys(__store).length})"))
        # pick identity -> first persist
        await pg.evaluate("ACTS.whoPick({dataset:{n:'阿媽', i:'eggtart'}})")
        await pg.wait_for_timeout(1500)
        print('B', await pg.evaluate("({sync: $('#sync').textContent, demo: S.demo, docs: Object.keys(__store).length, writes: __writes, members: JSON.stringify(S.members)})"))
        # toggle shop item, check doneBy and write count small
        await pg.evaluate("show('shop')"); await pg.wait_for_timeout(200)
        w0 = await pg.evaluate("__writes")
        await pg.evaluate("ACTS.shopToggle({dataset:{id:S.shop[0].id}})"); await pg.wait_for_timeout(500)
        print('C writes for one toggle:', await pg.evaluate("__writes") - w0, await pg.evaluate("JSON.stringify(__store['shop-'+S.shop[0].id].doneBy)"))
        # external member adds an item, typing in add box should be preserved
        await pg.fill('#saN', '豆腐花')
        await pg.focus('#saN')
        await pg.evaluate("__extSet('shop-ext1', {id:'ext1', n:'檸檬', q:2, u:'個', cat:'veg', done:false, from:[], by:'u_mum', t:Date.now()})")
        await pg.wait_for_timeout(800)
        print('D', await pg.evaluate("({has: S.shop.some(i=>i.id==='ext1'), typed: $('#saN').value, focus: document.activeElement.id, pname: RT.pnames['u_mum']})"))
        # auto week + cooked log + taste
        await pg.evaluate("S.settings.avoid='牛肉'; save(); show('plan'); autoWeek()"); await pg.wait_for_timeout(500)
        print('E', await pg.evaluate("JSON.stringify(weekKeys(TODAY()).map(k=>dayPlan(k).d.map(id=>getRecipe(id).name)))"))
        await pg.evaluate("logCooked('L01'); logCooked('L01'); logCooked('L09')"); await pg.wait_for_timeout(400)
        await pg.evaluate("openFam()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/home/claude/shot_fam.png')
        await pg.evaluate("closeSheet(); show('home')"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/home/claude/shot_home2.png')
        print('F', await pg.evaluate("({docs: Object.keys(__store).length, writes: __writes, sync: $('#sync').textContent})"))
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
