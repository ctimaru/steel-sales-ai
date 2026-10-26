import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const origin=process.env.CINE1A_ORIGIN ?? 'http://127.0.0.1:3000';
const output=process.env.CINE1A_ARTIFACTS ?? '/tmp/calc-cine1a';
await mkdir(output,{recursive:true});
function contrast(foreground,background) {
 const luminance=rgb=>rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const a=luminance(foreground),b=luminance(background);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
const browser=await chromium.launch({headless:true,...(process.env.CINE1A_CHROMIUM?{executablePath:process.env.CINE1A_CHROMIUM}:{channel:'chrome'})});
try {
 for(const locale of ['it','en','de','fr','es']) for(const width of [320,390,768,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+(locale==='it'?'':'/'+locale)+'/knowledge/tubes',{waitUntil:'domcontentloaded',timeout:60000});
  const root=page.locator('#calcolatore-pesi[data-calculator-ready="true"]');
  await root.waitFor({state:'visible'});
  // Explicitly choose essential-only consent through the real interface.
  const consent=page.getByTestId('mobile-cookie-consent');
  if(await consent.isVisible())await consent.locator('button').nth(1).click();
  assert.equal(await root.getAttribute('data-calc-cine1a'),'true');
  const shape=root.locator('[data-cockpit-controls] select').nth(1);
  const fields=root.locator('[data-cockpit-measurements] input');
  await shape.selectOption('round_tube');
  await fields.nth(0).fill('168.3');await fields.nth(1).fill('8');
  await root.locator('#tube-calculator-quantity').fill('3');
  const mass=root.locator('[data-cockpit-results] [aria-live="polite"].metric-number');
  assert.match(await mass.innerText(),/31[,.]626\s*kg\/m/,'Real engine output, not the illustrative reference number');
  const [left,stage,right]=await Promise.all(['[data-cockpit-fields]','[data-cinematic-stage]','[data-cockpit-results]'].map(s=>root.locator(s).boundingBox()));
  assert.ok(left&&stage&&right);
  const containerWidth=await root.evaluate(e=>e.parentElement.clientWidth);
  if(containerWidth>=1000) {
   assert.ok(left.x+left.width<=stage.x+2 && stage.x+stage.width<=right.x+2,'Three independent desktop columns');
   assert.ok(Math.abs(left.y-right.y)<3,'Controls and results align');
  }
  for(const input of await fields.all()) {
   const styles=await input.evaluate(e=>({color:getComputedStyle(e).webkitTextFillColor || getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));
   assert.ok(contrast(styles.color,styles.bg)>=4.5,'Input numbers must meet WCAG text contrast');
  }
  await root.screenshot({path:`${output}/${locale}-${width}-round.png`});
  if([390,1440].includes(width)) {
   const result=await new AxeBuilder({page}).include('#calcolatore-pesi').analyze();
   assert.deepEqual(result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  }
  await root.locator('[data-cockpit-add]').click();
  await shape.selectOption('square_tube');await fields.nth(0).fill('120');await fields.nth(1).fill('6.3');
  assert.match(await root.locator('[data-cinematic-stage] svg[role="img"]').getAttribute('aria-label'),/120/);
  await root.locator('[data-cockpit-add]').click();
  await shape.selectOption('rectangular_tube');await fields.nth(0).fill('140');await fields.nth(1).fill('80');await fields.nth(2).fill('5');
  assert.match(await root.locator('[data-cinematic-stage] svg[role="img"]').getAttribute('aria-label'),/140/);
  await root.locator('[data-cockpit-add]').click();
  if(locale==='it' && width===1440) {
   await root.locator('[data-commercial-price] summary').click();
   await root.locator('[data-commercial-price] input').first().fill('850');
  }
  await root.locator('[data-cinematic-copy]').click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  assert.doesNotMatch(copied,/850/,'Copy results excludes ephemeral commercial prices');
  assert.match(copied,/EN 10219/);assert.match(copied,/140/);assert.match(copied,/36/);
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sss:inline-distinta:v1')));
  assert.equal(saved.lines.length,3,'All three shapes retained without duplication');
  assert.ok(saved.lines.every(line=>line.targetEurT===''),'No private price introduced by the new presentation');
  await page.getByTestId('calculator-cart-trigger').click();
  assert.equal(await page.locator('#distinta-inline-dialog article').count(),3);
  await page.keyboard.press('Escape');
  // Invalid dimensions must never leave a plausible-looking technical drawing.
  await fields.nth(0).fill('1');
  assert.equal(await root.locator('[data-cinematic-stage] svg').count(),0);
  assert.equal(await root.locator('[data-cockpit-add]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('CALC-CINE1A PASS',locale,width,'layout, contrast, real mass, 3 shapes, copy, bill and invalid geometry');
  await context.close();
 }
}finally {await browser.close();}
