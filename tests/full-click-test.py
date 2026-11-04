import asyncio, json
from playwright.async_api import async_playwright
STEPS = r'''
show('recipes'); show('ai'); show('plan'); show('shop'); show('stats'); show('tools'); show('home');
ACTS.whoPick({dataset:{n:'阿媽', i:'eggtart'}});
@ show('ai'); $('#aiIngs').value='雞扒'; await aiGen(); if(!$('#aiGenOut [data-act=aiSave]')) throw 'no preview';
@ const n0=S.recipes.length; ACTS.aiSave($('#aiGenOut [data-act=aiSave]')); if(S.recipes.length!==n0+1) throw 'not saved';
@ ACTS.aiPlan($('#aiGenOut [data-act=aiPlan]')); ACTS.apGo($('#sheets [data-act=apGo]'));
@ await aiMenu(); ACTS.aiMenuAll($('#aiMenuOut [data-act=aiMenuAll]')); if(dayPlan(TODAY()).d.length<5) throw 'menu not added';
@ ACTS.aiPreview($('#aiMenuOut [data-act=aiPreview]')); closeSheet();
@ await aiAsk('點樣煎魚唔黐鑊？'); if(!$('#aiAskOut').textContent.includes('抹乾')) throw 'ask '+$('#aiAskOut').textContent;
@ PHOTO
@ await aiPhoto(); if(RT.ai.items.length!==2 || window.__aiImg!==1) throw 'photo items';
@ const p0=S.pantry.length; ACTS.aiItemsPantry(); if(S.pantry.length!==p0+2) throw 'pantry';
@ openRecipe('L03'); ACTS.serv($('#sheets [data-act=serv][data-d="1"]')); ACTS.stepDone($('#sheets [data-act=stepDone]')); ACTS.shopRecipe({dataset:{id:'L03'}}); ACTS.fav({dataset:{id:'L03'}});
@ await ACTS.copyText({dataset:{id:'L03'}}); if($$('#sheets .backdrop').length>1) closeSheet();
@ await aiPair('L03', $$('#sheets .backdrop').pop()); if(!$('#aiPairOut [data-act=aiGenName]')) throw 'pair';
@ await aiGenSheet('冬瓜湯'); const b=$$('#sheets .backdrop').pop(); ACTS.aiSave(b.querySelector('[data-act=aiSave]')); closeSheet(); closeSheet();
@ ACTS.stepTimer({dataset:{l:'x',s:'60'}});
@ openEditor(); const bd=$$('#sheets .backdrop').pop(); $('#edName',bd).value='測試豉汁排骨'; await ACTS.edAIfill(bd.querySelector('[data-act=edAIfill]')); if(!$('#edIngs .erow [data-f=n]',bd).value) throw 'fill';
@ const bd=$$('#sheets .backdrop').pop(); await ACTS.edAINut(bd.querySelector('[data-act=edAINut]')); if($('#edK',bd).value!=='410') throw 'nut '+$('#edK',bd).value;
@ const bd=$$('#sheets .backdrop').pop(); ACTS.edIngAdd(bd.querySelector('[data-act=edIngAdd]')); ACTS.edStepAdd(bd.querySelector('[data-act=edStepAdd]')); ACTS.edIcon(bd.querySelector('[data-act=edIcon][data-k=pork]')); submitEditor(bd); if(!S.recipes.find(r=>r.name==='測試豉汁排骨')) throw 'editor save';
@ closeSheet(); const r=S.recipes.find(x=>x.name==='測試豉汁排骨'); openEditor(r.id); const bd=$$('#sheets .backdrop').pop(); $('#edName',bd).value='測試豉汁排骨二'; submitEditor(bd); closeSheet(); if(!S.recipes.find(x=>x.name==='測試豉汁排骨二')) throw 'edit';
@ const r=S.recipes.find(x=>x.name==='測試豉汁排骨二'); openRecipe(r.id); const d=$('#sheets [data-act=delRecipe]'); ACTS.delRecipe(d); ACTS.delRecipe(d); if(S.recipes.find(x=>x.id===r.id)) throw 'delete';
@ openRecipe('L05'); ACTS.copyRecipe($('#sheets [data-act=copyRecipe]')); submitEditor($$('#sheets .backdrop').pop()); closeSheet();
@ openPicker(TODAY(),'l'); ACTS.pkAdd($('#sheets [data-act=pkAdd]')); closeSheet();
@ autoPair(dkey(addDays(new Date(),3)),'d'); show('plan'); ACTS.week({dataset:{d:'7'}}); ACTS.copyWeek(); ACTS.autoWeek(); ACTS.week({dataset:{d:'-7'}}); ACTS.people({dataset:{d:'1'}}); ACTS.planRm({dataset:{k:TODAY(),m:'d',i:'0'}}); ACTS.shopWeek(); ACTS.shopDay({dataset:{k:TODAY()}}); ACTS.clearDay({dataset:{k:dkey(addDays(new Date(),3))}});
@ show('shop'); $('#saN').value='檸檬'; $('#saQ').value='2'; $('#shopAdd').requestSubmit(); if(!S.shop.find(i=>i.n==='檸檬')) throw 'shop add';
@ const it=S.shop.find(i=>i.n==='檸檬'); ACTS.shopToggle({dataset:{id:it.id}}); ACTS.hideHave(); ACTS.hideHave(); await ACTS.shopCopy(); closeSheet(); ACTS.shopToPantry(); if(!S.pantry.find(p=>p.n==='檸檬')) throw 'to pantry';
@ ACTS.shopToggle({dataset:{id:S.shop[0].id}}); ACTS.shopClearDone(); ACTS.shopDel({dataset:{id:S.shop[0].id}}); const b=document.createElement('button'); ACTS.shopClearAll(b); ACTS.shopClearAll(b); if(S.shop.length) throw 'clear all';
@ show('stats'); ACTS.statsTbl({dataset:{k:'k'}}); ACTS.statsTbl({dataset:{k:'n'}}); ACTS.statsTbl({dataset:{k:'t'}});
@ show('tools'); $('#paN').value='豬扒'; $('#pAdd').requestSubmit(); if(!S.pantry.find(p=>p.n==='豬扒')) throw 'pantry add'; ACTS.pDel({dataset:{id:S.pantry.find(p=>p.n==='豬扒').id}});
@ $('#taM').value='2'; $('#tAdd').requestSubmit(); const t=RT.timers[0]; ACTS.tToggle({dataset:{id:t.id}}); ACTS.tToggle({dataset:{id:t.id}}); ACTS.tPlus({dataset:{id:t.id}}); ACTS.tDel({dataset:{id:t.id}});
@ ACTS.wSrc({dataset:{k:'quick'}}); spin();
@ ACTS.scale({dataset:{d:'2'}}); ACTS.scShop(); $('#cvU').value='両'; $('#cvU').dispatchEvent(new Event('change')); ACTS.rice({dataset:{d:'1'}}); $('#rcT').value='糙米'; $('#rcT').dispatchEvent(new Event('change'));
@ await openFam(); const bd=$$('#sheets .backdrop').pop(); ACTS.famWho(bd.querySelector('[data-act=famWho]')); ACTS.famIcon(bd.querySelector('[data-act=famIcon][data-k=tea]')); ACTS.famSave(bd.querySelector('[data-act=famSave]')); $('#famAvoid',bd).value='牛肉、花生'; ACTS.tasteSave(bd.querySelector('[data-act=tasteSave]')); if(S.settings.avoid!=='牛肉、花生' || S.members[RT.me].icon!=='tea') throw 'fam';
@ const bad = await packCode({recipes:[{id:'U-x1', name:'<img src=x onerror="window.__xss=1">', ings:'oops', steps:5},{id:'U-x2', name:'<b onclick=1>好</b>', ings:[{n:'<script>window.__xss=2</script>', q:'NaN'}], steps:[{t:'<img src=x onerror=window.__xss=3>'}], photo:'javascript:alert(1)'}], shop:[{id:'../../evil', n:'<svg onload=window.__xss=4>', q:'x'}], plan:{'2026-11-05':{d:['U-x2','<x>']}, 'bad':{}}, members:{'x':{name:'<i>阿叔</i>', icon:'wok'}}}, 'WZ1');
  const bd=$$('#sheets .backdrop').pop(); $('#shareIn',bd).value=bad; await ACTS.shareMerge(bd.querySelector('[data-act=shareMerge]')); closeSheet();
  const r=S.recipes.find(x=>x.id==='U-x2'); if(!r || r.photo) throw 'merge clean'; if(S.recipes.find(x=>x.id==='U-x1')) throw 'bad recipe kept'; if(S.shop.some(i=>i.id.includes('/'))) throw 'bad id';
  show('shop'); show('recipes'); openRecipe('U-x2'); closeSheet(); show('plan');
@ const code = await shareText(); if(!code.includes('WZ1Z:') && !code.includes('WZ1J:')) throw 'share text';
@ openCook('L01'); ACTS.cookStep({dataset:{d:'1'}}); ACTS.cookStep({dataset:{d:'9'}}); ACTS.cookDone(); const u=$('#sheets [data-act=usedGo]'); if(u) ACTS.usedGo(u);
@ ACTS.clearDemo(); if(S.recipes.some(r=>r.demo)) throw 'demo';
@ document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); show('home');
'''
async def run(pg, label):
    res=[]
    for i, chunk in enumerate(STEPS.split('\n@ ')):
        if chunk.strip()=='PHOTO':
            await pg.evaluate("show('ai')")
            await pg.set_input_files('#aiFile', '/tmp/food.png'); await pg.wait_for_timeout(400); continue
        try:
            await pg.evaluate("(async()=>{ "+chunk+" })()"); await pg.wait_for_timeout(120)
        except Exception as e:
            res.append(f'step {i}: {str(e).splitlines()[0][:160]}')
    return res
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1)
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)[:200]+' @ '+(e.stack or '')[:600]))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text[:200]) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
        await pg.add_init_script(path='/tmp/mock.js'); await pg.add_init_script(path='/tmp/aimock.js')
        await pg.goto('file:///home/claude/wokzai-recipes.html'); await pg.wait_for_timeout(1500)
        fails = await run(pg, 'claude')
        info = await pg.evaluate("({xss: window.__xss||0, onerr: document.querySelectorAll('[onerror],[onload],[onclick]').length, recipes: S.recipes.length, docs: Object.keys(__store).length, sync: $('#sync').textContent, ai: window.__aiCalls})")
        print('CLAUDE+AI', info); print('\n'.join(fails) or 'all steps ok'); print('\n'.join(errs) or 'no page errors')
        # standalone no-AI: check hidden buttons
        pg2 = await ctx.new_page(); errs2=[]
        pg2.on('pageerror', lambda e: errs2.append('PAGEERR '+str(e)[:200]))
        await pg2.goto('http://localhost:8765/wokzai/index.html'); await pg2.wait_for_timeout(1200)
        vis = await pg2.evaluate("({noai: document.body.classList.contains('no-ai'), aiBtnVisible: !!$$('.needs-ai').find(e=>e.offsetParent), altVisible: !!$$('.only-no-ai').find(e=>e.offsetParent)})")
        print('STANDALONE', vis, errs2 or 'no page errors')
        await pg2.set_viewport_size({'width':1280,'height':900}); await pg2.evaluate("show('plan')"); await pg2.wait_for_timeout(300)
        await pg2.screenshot(path='/home/claude/shot_desktop.png')
        await b.close()
asyncio.run(main())
