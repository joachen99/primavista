# Headless smoke test. abcjs is now inlined in index.html, so this runs against the REAL renderer;
# STUB below is only served if a page ever requests abcjs over the network again. Other network requests are blocked.
# Run: python3 tests/ui_smoke.py   (needs: pip install playwright && playwright install chromium)
import asyncio, pathlib
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
from playwright.async_api import async_playwright
STUB = r"""
window.ABCJS={renderAbc:function(el,abc,o){
  window.__n=(window.__n||0)+1;
  var lines=abc.split('\n').filter(function(l){return l && !/^[A-Z]:|^%%/.test(l)});
  var W=(o.staffwidth||760)+8, H=20+lines.length*60, svg='<svg viewBox="0 0 '+W+' '+H+'" width="'+(o.responsive?'100%':W*(o.scale||1))+'">';
  var x0=90;
  lines.forEach(function(line,vi){
    var y=20+vi*60; for(var k=0;k<5;k++) svg+='<rect class="abcjs-staff" x="0" y="'+(y+k*8)+'" width="'+W+'" height="1"/>';
    var body=line.replace(/^\[V:\w+\] /,'').replace(/![^!]*!/g,'').replace(/[()]/g,'');
    var bars=body.split('|').filter(function(b){return b.trim() && b.trim()!==']'});
    var step=(W-x0-10)/Math.max(bars.length,1);
    bars.forEach(function(b,bi){
      var toks=b.match(/(\^\^|__|[_^=])?[A-Ga-gzx][,']*\d*/g)||[];
      var durs=toks.map(function(t){var m=t.match(/\d+$/);return m?+m[0]:1}); var tot=durs.reduce(function(a,c){return a+c},0)||1; var acc=0;
      toks.forEach(function(tk,i){ var x=x0+bi*step+8+(acc/tot)*(step-14); acc+=durs[i]; var cls=tk.indexOf('z')>=0?'abcjs-rest':'abcjs-note';
        svg+='<rect class="'+cls+' abcjs-v'+vi+'" x="'+x+'" y="'+(y+10)+'" width="7" height="6"/>'; });
      svg+='<rect class="abcjs-bar" x="'+(x0+(bi+1)*step-1)+'" y="'+y+'" width="1.5" height="32"/>';
    });
  });
  el.innerHTML=svg+'</svg>'; return [{}];
}};"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1300,'height':1000}, locale='nb-NO')
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
        pg.on('console', lambda m: m.type=='error' and 'net::' not in m.text and errs.append(m.text))
        async def route(r):
            if 'abcjs' in r.request.url: await r.fulfill(body=STUB, content_type='application/javascript')
            else: await r.abort()
        await pg.route('http*://**/*', route)
        await pg.goto(PAGE); await pg.wait_for_timeout(400)
        print('lang from browser:', await pg.evaluate("document.querySelector('#set-lang [aria-pressed=true]').dataset.v"), '| tab:', await pg.text_content('#tabbar [data-view="sr"]'), '| bar:', await pg.text_content('#bar-title'))
        await pg.click('#sr-level button[data-v="3"]')
        await pg.evaluate("document.getElementById('sr-tempo').value=120; document.getElementById('sr-tempo').dispatchEvent(new Event('input'))")
        await pg.click('#bar-actions [data-act="through"]')
        xs=[]
        for k in range(8):
            await pg.wait_for_timeout(450)
            xs.append(await pg.evaluate("(()=>{const c=[...document.querySelectorAll('.cursor')].find(e=>e.style.display==='block');const s=[...document.querySelectorAll('.sweep')].map(e=>parseFloat(e.style.width)||0);return c?[c.parentElement.id,parseFloat(c.style.left).toFixed(0),s.map(v=>v.toFixed(0)).join('/')]:null})()"))
        print('cursor samples (system, x, sweep widths):'); [print('  ',x) for x in xs]
        await pg.screenshot(path='/tmp/v1.png')
        await pg.click('#bar-actions [data-act="through"]')
        # swipe/new + tabs
        await pg.click('#bar-actions [data-act="new"]')
        # theory in Norwegian
        await pg.click('#tabbar [data-view="ws"]'); await pg.screenshot(path='/tmp/v2.png')
        await pg.click('#tabbar [data-view="qz"]'); await pg.click('#qz-start-big'); await pg.wait_for_timeout(100)
        for i in range(3): await pg.keyboard.press('2'); await pg.wait_for_timeout(350)
        before = await pg.text_content('.qz-prompt')
        await pg.click('#tabbar [data-view="set"]'); await pg.click('#set-lang [data-v="en"]'); await pg.click('#tabbar [data-view="qz"]'); await pg.wait_for_timeout(100)
        print('prompt nb -> en:', before, '->', await pg.text_content('.qz-prompt'), '| answered:', await pg.text_content('.qz-top span:nth-child(3)'))
        await pg.click('#tabbar [data-view="set"]'); await pg.click('#set-lang [data-v="nb"]'); await pg.click('#tabbar [data-view="qz"]'); await pg.click('#qz-handin'); await pg.click('#qz-final'); await pg.wait_for_timeout(100)
        await pg.screenshot(path='/tmp/v3.png')
        await pg.click('#tabbar [data-view="set"]'); await pg.click('#set-lang [data-v="en"]'); await pg.click('#tabbar [data-view="qz"]'); print('results heading:', await pg.text_content('#qz-sheet h2'))
        print('errors', errs)
        await b.close()
asyncio.run(main())
