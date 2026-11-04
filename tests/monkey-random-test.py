import asyncio, random, sys
from playwright.async_api import async_playwright
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 7
JUNK = ['鸡蛋', '<b>x</b>', '"\'`', '😀🍳', '一'*80, '  ', '0', '-5', '999999', 'NaN', '雞翼 2 隻', 'a\nb', '🙂'*30, '%s%s', '../../', '番茄、牛肉, 花生']
async def run(url, label, inits):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':360,'height':760})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())
        for i in inits: await ctx.add_init_script(path=i)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)[:160] + ' @ ' + (e.stack or '').split('\n')[1].strip()[:120] if e.stack else str(e)[:160]))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
        await pg.goto(url); await pg.wait_for_timeout(1500)
        rnd = random.Random(SEED)
        for step in range(600):
            try:
                kind = rnd.random()
                if kind < 0.07:
                    await pg.evaluate(f"show({rnd.choice(['home','recipes','ai','plan','shop','stats','tools'])!r})")
                elif kind < 0.22:
                    n = await pg.evaluate("$$('input:not([type=file]):not([type=date]),textarea').filter(e=>e.offsetParent).length")
                    if n:
                        i = rnd.randrange(n); t = rnd.choice(JUNK)
                        await pg.evaluate("([i,t])=>{ const e=$$('input:not([type=file]):not([type=date]),textarea').filter(e=>e.offsetParent)[i]; e.value=t; e.dispatchEvent(new Event('input',{bubbles:true})); if(e.form && Math.random()<.5) e.form.requestSubmit(); }", [i, t])
                elif kind < 0.25:
                    await pg.keyboard.press(rnd.choice(['Escape','ArrowRight','ArrowLeft','Enter']))
                else:
                    n = await pg.evaluate("$$('[data-act]').filter(e=>e.offsetParent || e.closest('.cook')).length")
                    if n:
                        i = rnd.randrange(n)
                        await pg.evaluate("i=>{ const e=$$('[data-act]').filter(e=>e.offsetParent || e.closest('.cook'))[i]; if (e.dataset.act==='fbLeave'||e.dataset.act==='fbCreate'||e.dataset.act==='fbJoinGo'||e.dataset.act==='joinYes') return; e.click(); }", i)
                await pg.wait_for_timeout(rnd.choice([0, 5, 20, 60]))
            except Exception as ex:
                errs.append('driver: ' + str(ex).splitlines()[0][:120])
        await pg.wait_for_timeout(3500)
        inv = await pg.evaluate("""(()=>{ const c=cleanState(S); const a=stable(c), b2=stable(cleanState(c)); const bad=[]; 
          if (a!==b2) bad.push('clean not idempotent');
          for (const k in S.plan) for (const m of ['b','l','d']) for (const id of (S.plan[k][m]||[])) if (!getRecipe(id)) bad.push('dangling plan '+id);
          if (S.shop.some(i=>!i.id||!i.n)) bad.push('bad shop item');
          if (document.documentElement.scrollWidth > innerWidth+1) bad.push('h-overflow '+document.documentElement.scrollWidth);
          return {bad, recipes:S.recipes.length, shop:S.shop.length, pantry:S.pantry.length, sheets:$$('#sheets .backdrop').length}; })()""")
        uniq = []
        for e in errs:
            if e not in uniq: uniq.append(e)
        print(label, 'seed', SEED, inv, 'errors:', uniq[:8] or 'none')
        await b.close()
async def main():
    await run('file:///home/claude/wokzai-recipes.html', 'CLAUDE', ['/tmp/mock.js', '/tmp/aimock.js'])
    await run('http://localhost:8765/wokzai/index.html', 'STANDALONE', [])
asyncio.run(main())
