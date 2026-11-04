import asyncio
from playwright.async_api import async_playwright
AUDIT = """(()=>{ const out={noName:[], noLabel:[], dupIds:[], noAlt:0, smallTargets:[], roleBtnNoTab:0};
  const vis = e => e.offsetParent || e.getClientRects().length;
  const name = e => (e.getAttribute('aria-label')||e.textContent||e.getAttribute('title')||'').trim();
  document.querySelectorAll('button,[role=button],a[href]').forEach(e=>{ if(!vis(e)) return; if(!name(e)) out.noName.push((e.dataset.act||e.className||e.tagName).toString().slice(0,30)); const r=e.getBoundingClientRect(); if (r.width && (r.width<28||r.height<28)) out.smallTargets.push((e.dataset.act||e.className).toString().slice(0,24)+' '+Math.round(r.width)+'x'+Math.round(r.height)); });
  document.querySelectorAll('input:not([type=hidden]):not(.hide),select,textarea').forEach(e=>{ if(!vis(e)) return; const lab = e.id && document.querySelector('label[for="'+e.id+'"]'); if(!lab && !e.getAttribute('aria-label') && !e.closest('label')) out.noLabel.push(e.id||e.dataset.f||e.className); });
  const ids={}; document.querySelectorAll('[id]').forEach(e=>{ ids[e.id]=(ids[e.id]||0)+1; }); out.dupIds=Object.keys(ids).filter(k=>ids[k]>1);
  document.querySelectorAll('img').forEach(e=>{ if(!e.hasAttribute('alt')) out.noAlt++; });
  document.querySelectorAll('[role=button]').forEach(e=>{ if(!e.hasAttribute('tabindex')) out.roleBtnNoTab++; });
  for (const k in out) if (Array.isArray(out[k])) out[k]=[...new Set(out[k])].slice(0,8);
  return out; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844})
        await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await ctx.add_init_script(path='/tmp/mock.js'); await ctx.add_init_script(path='/tmp/aimock.js')
        pg = await ctx.new_page()
        await pg.goto('file:///home/claude/wokzai-recipes.html'); await pg.wait_for_timeout(1500)
        for v in ['home','recipes','ai','plan','shop','stats','tools']:
            await pg.evaluate(f"show('{v}')"); await pg.wait_for_timeout(150)
            r = await pg.evaluate(AUDIT); r = {k:v2 for k,v2 in r.items() if v2}
            print(v, r or 'ok')
        for label, js in [('detail', "openRecipe('L03')"), ('editor', "openEditor()"), ('picker', "openPicker(TODAY(),'d')"), ('addPlan', "openAddPlan('L01')"), ('family', "openFam()"), ('cook', "openCook('L01')")]:
            await pg.evaluate("closeSheet(); closeSheet(); ACTS.cookClose()"); await pg.evaluate(js); await pg.wait_for_timeout(250)
            r = await pg.evaluate(AUDIT); r = {k:v2 for k,v2 in r.items() if v2}
            print(label, r or 'ok')
        await b.close()
asyncio.run(main())
