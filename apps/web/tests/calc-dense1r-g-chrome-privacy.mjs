import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
await mkdir("/tmp/calc-dense1r-g",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  const cases=[
    ["/knowledge/tubes",320],["/knowledge/tubes",390],
    ["/knowledge/tubes",1440],["/distinta",320],
    ["/en/knowledge/tubes",390],["/de/knowledge/tubes",390],
    ["/fr/knowledge/tubes",390],["/es/knowledge/tubes",390]
  ];
  for(const [route,width] of cases){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
    const page=await context.newPage();
    const response=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200,"Required locale/route is available: "+route);
    const panel=page.locator('[data-testid="mobile-cookie-consent"]');
    await panel.waitFor({state:"visible"});
    // The first-layer panel stays unchanged: explicit, equivalent opt-in/out.
    const necessary=panel.getByRole("button",{name:/necessari|essential|notwendige|essentiels|necesarios/i}).last();
    await necessary.click();
    await panel.waitFor({state:"detached"});
    const reopen=page.locator('[data-testid="privacy-reopen-button"]');
    await reopen.waitFor({state:"visible"});
    const computed=await reopen.evaluate(el=>({position:getComputedStyle(el).position,height:el.getBoundingClientRect().height}));
    if(width<640){
      assert.equal(computed.position,"relative","Privacy must not float over mobile forms: "+route);
      assert.ok(computed.height>=44,"Privacy preferences must preserve 44px touch target: "+route);
      const rect=await reopen.boundingBox();
      assert.ok(rect&&rect.y>=0,"Privacy is in document flow: "+route);
      const body=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(body.scroll<=body.client+4,"Privacy control causes horizontal overflow: "+route);
    }else{
      assert.equal(computed.position,"fixed","Desktop privacy should retain fast-access tab");
    }
    // Reopenability is legally important: no disappearing opt-out UI.
    await reopen.click();
    await panel.waitFor({state:"visible"});
    assert.equal(await panel.getByRole("button",{name:/necessari|essential|notwendige|essentiels|necesarios/i}).count()>=1,true);
    await necessary.click();
    await panel.waitFor({state:"detached"});
    if(width<640) {
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:"/tmp/calc-dense1r-g/"+route.replaceAll("/","-")+"-"+width+".png",animations:"disabled"});
    }
    console.log("CALC-DENSE1R-G CHROME PASS",route,width,JSON.stringify(computed));
    await context.close();
  }
}finally{await browser.close()}
