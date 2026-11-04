import asyncio
from playwright.async_api import async_playwright
def fake(y,mo,d,h,mi,s):
    return f"""(() => {{ const fixed = new Date({y},{mo-1},{d},{h},{mi},{s}).getTime(); const RD = Date; const t0 = RD.now();
      class FD extends RD {{ constructor(...a) {{ if (!a.length) super(fixed + (RD.now() - t0)); else super(...a); }} static now() {{ return fixed + (RD.now() - t0); }} }}
      window.Date = FD; }})();"""
async def case(p, label, when, js):
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = await b.new_context(viewport={'width':390,'height':844})
    await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await ctx.add_init_script(script=fake(*when))
    pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
    await pg.goto('file:///home/claude/wokzai-recipes.html'); await pg.wait_for_timeout(1200)
    r = await pg.evaluate(js)
    print(label, r, errs or 'no errors'); await b.close()
async def main():
    async with async_playwright() as p:
        await case(p, 'NYE 2026-12-31 Thu', (2026,12,31,23,59,57), """(async()=>{
          const wk=weekKeys(TODAY()); logCooked('L01'); const m1=Object.keys(S.log);
          const h0=$('.hero p').textContent.slice(0,12);
          await new Promise(r=>setTimeout(r,4000)); window.dispatchEvent(new Event('focus'));
          Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange'));
          await new Promise(r=>setTimeout(r,200));
          return {today_before:'2026-12-31', week:[wk[0],wk[6]], logMonth:m1, heroBefore:h0, todayAfter:TODAY(), heroAfter:$('.hero p').textContent.slice(0,12), planDay:RT.planDay};
        })()""")
        await case(p, 'Sunday 2027-01-03', (2027,1,3,10,0,0), """(()=>{ const wk=weekKeys(TODAY()); show('plan'); ACTS.week({dataset:{d:'7'}}); const next=weekKeys(RT.planDay)[0]; ACTS.planToday(); autoWeek(); return {week:[wk[0],wk[6]], dayLabel:WD[parseD(TODAY()).getDay()], nextWeekStart:next, todayDinner:dayPlan(TODAY()).d.length}; })()""")
        await case(p, 'Leap 2028-02-29', (2028,2,29,8,0,0), """(()=>{ const t=TODAY(); return {today:t, plus1:dkey(addDays(new Date(),1)), minus365:dkey(addDays(new Date(),-365)), week:[weekKeys(t)[0],weekKeys(t)[6]], pantryDays:daysLeft('2028-03-01'), fmt:fmtDay(t)}; })()""")
        await case(p, 'Month-end 2026-11-30 Mon', (2026,11,30,12,0,0), """(()=>{ show('stats'); const wk=weekKeys(TODAY()); S.pantry.push({id:'x',n:'奶',q:1,u:'',exp:'2026-12-01'}); return {week:[wk[0],wk[6]], expDays:daysLeft('2026-12-01'), stats:!!$('#v-stats .chart')}; })()""")
asyncio.run(main())
