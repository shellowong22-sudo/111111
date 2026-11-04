import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
        # seed local data first (local mode), then switch to firebase mock
        await pg.goto('http://localhost:8765/wokzai/index.html')
        await pg.wait_for_timeout(800)
        print('L0', await pg.evaluate("({kind: Store.kind, sync: $('#sync').textContent})"))
        # local-mode features
        await pg.evaluate("ACTS.whoLater && 0; S.shop[0].done=true; S.shop[1].done=true; save(); ACTS.shopToPantry()"); await pg.wait_for_timeout(500)
        print('L1 pantry/shop', await pg.evaluate("[S.pantry.length, S.shop.length]"))
        await pg.evaluate("RT.planDay=dkey(addDays(new Date(),7)); ACTS.copyWeek()"); await pg.wait_for_timeout(200)
        print('L2 copied next week days', await pg.evaluate("weekKeys(RT.planDay).filter(k=>dayIds(k).length).length"))
        await pg.evaluate("ACTS.cookedLog({dataset:{id:'L01'}})"); await pg.wait_for_timeout(200)
        print('L3 used sheet', await pg.evaluate("$$('#sheets [data-act=usedItem]').length"))
        await pg.evaluate("ACTS.usedGo($('#sheets [data-act=usedGo]'))")
        code = await pg.evaluate("shareText()")
        print('L4 code len', len(code))
        # roundtrip merge into empty state
        n = await pg.evaluate("(async()=>{ const keep=S; S=normalize({}); const inc=await unpackCode(%r,'WZ1'); const n=mergeIn(inc); const r=[n,S.shop.length,S.pantry.length,Object.keys(S.plan).length]; S=keep; return r; })()" % code)
        print('L5 merge', n)
        await pg.evaluate("startTimer('test',300)"); await pg.wait_for_timeout(300)
        await pg.reload(); await pg.wait_for_timeout(800)
        print('L6 timers after reload', await pg.evaluate("RT.timers.length"), 'recipes', await pg.evaluate("S.recipes.length"), 'demo', await pg.evaluate("S.demo"))
        sw = await pg.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)")
        print('L7 sw', sw)
        # now firebase mode
        await pg.add_init_script(path='/tmp/fbmock.js')
        await pg.reload(); await pg.wait_for_timeout(1500)
        print('F1', await pg.evaluate("({kind: Store.kind, sync: $('#sync').textContent, path: window.__famPath, docs: Object.keys(__fs).length, writes: __fsWrites, recipes: S.recipes.length})"))
        await pg.evaluate("ACTS.whoPick({dataset:{n:'阿爸', i:'bun'}})"); await pg.wait_for_timeout(400)
        await pg.evaluate("__fsExt('shop-x9', {id:'x9', n:'豆腐', q:1, u:'盒', cat:'egg', done:false, from:[], by:'d_mum', t:Date.now()})"); await pg.wait_for_timeout(300)
        print('F2', await pg.evaluate("({has: S.shop.some(i=>i.id==='x9'), member: S.members[RT.me]?.name})"))
        await pg.evaluate("openFam()"); await pg.wait_for_timeout(500)
        inv = await pg.evaluate("$$('#sheets .backdrop').pop()._invite")
        dec = await pg.evaluate("unpackCode(%r,'WZF')" % inv)
        print('F3 invite', len(inv), dec['f'], 'link', await pg.evaluate("inviteLink($$('#sheets .backdrop').pop()._invite).slice(0,40)"))
        await pg.screenshot(path='/home/claude/shot_fb.png')
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
