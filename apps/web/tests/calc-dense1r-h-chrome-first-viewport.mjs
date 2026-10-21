import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

// H measures the real 900px viewport, not markup-only class snapshots.
// Data are synthetic; RFQ is not created/sent and no company data are opened.
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
await mkdir("/tmp/calc-dense1r-h",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  const scenarios=[
    ["/distinta",320],[ "/distinta",390],[ "/distinta",768],[ "/distinta",1440],
    ["/en/distinta",390],[ "/de/distinta",390],[ "/fr/distinta",390],[ "/es/distinta",390]
  ];
  for(const [route,width] of scenarios){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
    const page=await context.newPage();
    const response=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200,route+" should be available");
    const consent=page.locator('[data-testid="mobile-cookie-consent"]');
    if(await consent.isVisible()){
      const necessary=consent.getByRole("button",{name:/necessari|essential|notwendige|essentiels|necesarios/i}).last();
      await necessary.click();
      await consent.waitFor({state:"detached"});
    }
    if(route==="/distinta"){
      const landing=page.locator("[data-public-bill-landing]");
      const hero=landing.locator("[data-public-bill-hero]");
      const builder=landing.locator("[data-public-bill-builder]");
      const cockpit=builder.locator("#calcolatore-pesi");
      const search=cockpit.getByRole("searchbox");
      const hud=builder.locator("[data-public-bill-summary]");
      const [h,searchBox,summaryBox]=await Promise.all([hero.boundingBox(),search.boundingBox(),hud.boundingBox()]);
      assert.ok(h&&searchBox&&summaryBox,"Public landing calculator operational landmarks");
      if(width<=390){
        assert.ok(h.height<=115,"Hero is still too tall on mobile: "+h.height);
        assert.ok(searchBox.y<=650,"Dimension search must be in first viewport "+width+": "+searchBox.y);
        assert.ok(summaryBox.height<=64,"Duplicate summary pushes operational editor down: "+summaryBox.height);
        assert.ok(await builder.locator('[data-private-calculator-heading] input').isVisible(),"Bill title remains editable");
        assert.ok(await builder.locator('[data-private-calculator-grade] input').isVisible(),"Steel grade remains editable");
        assert.ok(await builder.locator('[data-testid="private-cart-inline-open"]').isVisible(),"Cart remains reachable");
        assert.ok(await hud.getByRole("button").count()===1,"Summary must keep completion/RFQ action");
      }
      if(width>=768)assert.ok(await hero.getByRole("heading",{level:1}).isVisible());
      console.log("CALC-DENSE1R-H IT",width,JSON.stringify({heroHeight:Math.round(h.height),searchY:Math.round(searchBox.y),summaryHeight:Math.round(summaryBox.height)}));
    } else {
      const hero=page.locator('[data-rfq-hero="true"]');
      const workspace=page.locator("[data-international-bill-workspace]");
      const firstInput=workspace.locator("input").first();
      const [h,input]=await Promise.all([hero.boundingBox(),firstInput.boundingBox()]);
      assert.ok(h&&input,"International bill input and heading visible: "+route);
      assert.ok(h.height<270,"International hero needs to stay compact on 390px: "+route+" "+h.height);
      assert.ok(input.y<800,"First RFQ field should be well inside the initial viewport: "+route+" "+input.y);
      assert.ok(await hero.getByRole("heading",{level:1}).isVisible(),"localized H1 preserved "+route);
      console.log("CALC-DENSE1R-H LOCALE",route,JSON.stringify({heroHeight:Math.round(h.height),firstInputY:Math.round(input.y)}));
    }
    const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.client+8,"Horizontal overflow "+route+" "+width+" "+JSON.stringify(dimensions));
    await page.screenshot({path:"/tmp/calc-dense1r-h/"+route.replaceAll("/","-")+"-"+width+".png",animations:"disabled"});
    await context.close();
  }
}finally{await browser.close()}
