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
  const shape=family=>root.locator(`[data-calc-shape-buttons] button`).nth(family==='round_tube'?0:family==='square_tube'?1:2);
  const fields=root.locator('[data-cockpit-measurements] input');
  await shape('round_tube').click();
  await fields.nth(0).fill('168.3');await fields.nth(1).fill('8');
  await root.locator('#tube-calculator-quantity').fill('3');
  const mass=root.locator('[data-cockpit-results] [aria-live="polite"].metric-number');
  assert.match(await mass.innerText(),/31[,.]626\s*kg\/m/,'Real engine output, not the illustrative reference number');
  const sectionValue=key=>root.locator(`[data-section-value="${key}"]`);
  assert.match(await sectionValue('outer').innerText(),/168[,.]3\s*mm/);
  assert.match(await sectionValue('inner').innerText(),/152[,.]3\s*mm/,'Internal diameter follows the actual outside diameter and wall');
  assert.equal((await sectionValue('area').innerText()).replace(/[^\d]/g,''),'402878','Known CHS area is 4028.78 mm² in every locale');
  assert.match(await root.locator('[data-cinematic-context]').innerText(),/12 m · 3 /);
  if(locale==='it'&&width===390) {
   const customLength=root.locator('[data-cockpit-length-quantity] > div:first-child input');
   await root.locator('#tube-calculator-quantity').fill('1');
   assert.match(await root.locator('[data-cinematic-context]').innerText(),/12 m · 1 barra$/,'Singular quantity uses the singular unit');
   await customLength.fill('12.345');await root.locator('#tube-calculator-quantity').fill('2.5');
   assert.match(await root.locator('[data-cinematic-context]').innerText(),/12,345 m · 2,5 /,'Visible context must not round away valid input precision');
   await customLength.fill('12');await root.locator('#tube-calculator-quantity').fill('3');
  }
  const [left,stage,right]=await Promise.all(['[data-cockpit-fields]','[data-cinematic-stage]','[data-cockpit-results]'].map(s=>root.locator(s).boundingBox()));
  assert.ok(left&&stage&&right);
  const containerWidth=await root.evaluate(e=>e.parentElement.clientWidth);
  for(const label of await root.locator('[data-cockpit-kpis] > div > p:first-child').all()) {
   assert.equal(await label.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Translated result labels must fit their tiles, including German at 320px');
  }
  if(containerWidth>=1000) {
   assert.ok(left.x+left.width<=stage.x+2 && stage.x+stage.width<=right.x+2,'Three independent desktop columns');
   assert.ok(Math.abs(left.y-right.y)<3,'Controls and results align');
   const action=await root.locator('[data-cockpit-add]').boundingBox();
   const toolbar=await root.locator('[data-cockpit-toolbar]').boundingBox();
   assert.ok(action.y-toolbar.y<430,'Primary bill action stays inside the existing condensed desktop work surface');
  }
  const [primary,geometry]=await Promise.all([root.locator('[data-cockpit-add]'),root.locator('[data-cinematic-geometry]')].map(e=>e.boundingBox()));
  assert.ok(primary.y+primary.height<=geometry.y,'Primary action precedes secondary section facts at every width');
  for(const input of await fields.all()) {
   const styles=await input.evaluate(e=>({color:getComputedStyle(e).webkitTextFillColor || getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));
   assert.ok(contrast(styles.color,styles.bg)>=4.5,'Input numbers must meet WCAG text contrast');
  }
  await fields.first().focus();
  const focus=await fields.first().evaluate(e=>({color:getComputedStyle(e).outlineColor,bg:getComputedStyle(e).backgroundColor}));
  assert.ok(contrast(focus.color,focus.bg)>=3,'Keyboard focus stays visible on the dark fields');
  async function assertProductPhoto(family) {
   const photo=root.locator(`[data-cinematic-product="${family}_tube"] img`);
   await photo.scrollIntoViewIfNeeded();
   await photo.evaluate(e=>e.decode());
   const details=await photo.evaluate(e=>({src:e.currentSrc,width:e.naturalWidth,alt:e.alt}));
   assert.match(details.src,new RegExp(`/calculator/tube-${family}-(384|768)\\.webp$`));
   assert.ok(details.width>0,'Selected family artwork loads successfully');
   assert.equal(details.alt,'','Decorative photo does not duplicate the live diagram');
  }
  await assertProductPhoto('round');
  if(containerWidth<680) {
   const add=await root.locator('[data-cockpit-add]').boundingBox();
   assert.ok(add.height>=44&&add.height<=46,'Mobile primary button is compact with a usable touch target');
   const copy=await root.locator('[data-cinematic-copy]').boundingBox();
   assert.ok(copy.height>=44&&copy.height<=46,'Mobile copy control keeps a small visual surface within a 44px target');
   const control=await root.locator('[data-cockpit-length-quantity] button').first().evaluate(e=>({height:e.getBoundingClientRect().height,border:parseFloat(getComputedStyle(e).borderTopWidth)}));
   assert.ok(control.height>=44&&control.border>=5,'Quantity controls retain a touch area around the smaller painted button');
  }
  await root.screenshot({path:`${output}/${locale}-${width}-round.png`});
  if([390,1440].includes(width)) {
   const result=await new AxeBuilder({page}).include('#calcolatore-pesi').analyze();
   assert.deepEqual(result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  }
  await root.locator('[data-cockpit-add]').click();
  await shape('square_tube').click();await fields.nth(0).fill('120');await fields.nth(1).fill('6.3');
  assert.equal(await sectionValue('inner').count(),0,'CHS internal diameter is not presented for square sections');
  assert.match(await sectionValue('outer').innerText(),/120\s*mm/);
  await assertProductPhoto('square');
  if(locale==='it')await root.screenshot({path:`${output}/${locale}-${width}-square.png`});
  assert.match(await root.locator('[data-cinematic-stage] svg[role="img"]').getAttribute('aria-label'),/120/);
  await root.locator('[data-cockpit-add]').click();
  await shape('rectangular_tube').click();await fields.nth(0).fill('140');await fields.nth(1).fill('80');await fields.nth(2).fill('5');
  assert.match(await sectionValue('outer').innerText(),/140 × 80\s*mm/);
  assert.equal((await sectionValue('area').innerText()).replace(/[^\d]/g,''),'203562','RHS area uses normative corner radii');
  await assertProductPhoto('rectangular');
  if(locale==='it')await root.screenshot({path:`${output}/${locale}-${width}-rectangular.png`});
  assert.match(await root.locator('[data-cinematic-stage] svg[role="img"]').getAttribute('aria-label'),/140/);
  await root.locator('[data-cockpit-add]').click();
  if(locale==='it' && width===1440) {
   const targets=root.locator('[data-commercial-targets]');
   assert.equal(await targets.locator('button').count(),3,'Three commercial modes');
   assert.equal(await targets.locator('button').first().getAttribute('aria-pressed'),'true','Metres default');
   await targets.locator('button').nth(1).click();
   await root.locator('[data-commercial-tonnes] input').fill('1');
   const suggestion=Number((await root.locator('[data-commercial-tonnes] strong').first().innerText()).trim());
   assert.ok(suggestion>=1,'Tonnage produces rounded-up whole bars');
   await root.locator('[data-commercial-tonnes] button').click();
   assert.equal(await root.locator('#tube-calculator-quantity').inputValue(),String(suggestion),'Suggested bars reuse canonical quantity state');
   await root.locator('#tube-calculator-quantity').fill('3');
   await targets.locator('button').nth(2).click();
   assert.equal(await targets.locator('button').nth(2).getAttribute('aria-pressed'),'true','Price selected');

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
  assert.equal(await root.locator('[data-cinematic-product]').count(),0,'Invalid geometry suppresses illustrative product as well');
  for(const fact of await root.locator('[data-section-value]').all())assert.match(await fact.innerText(),/^—/,'Invalid geometry must not present plausible result facts');
  assert.equal(await root.locator('[data-cockpit-add]').isDisabled(),true);
  await fields.nth(0).fill('140');
  const standard=root.locator('[data-cockpit-controls] select').first();
  await standard.selectOption('geometric');
  assert.equal(await root.locator('[data-cinematic-stage] strong').first().innerText(),
   await standard.evaluate(e=>e.selectedOptions[0].textContent),'Free-calculation stage label follows the selected language');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('CALC-CINE1A PASS',locale,width,'layout, contrast, real mass, 3 shapes, copy, bill and invalid geometry');
  await context.close();
 }
}finally {await browser.close();}
