/**
 * SCHOOL-GROWTH1E — repeatable REAL Chrome visual, SEO and image acceptance.
 * Read-only public pages. Use localhost after Next production build or production.
 * Requires Playwright Chrome. Captures screenshots & JSON without private content.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const BASE = (process.env.SCHOOL_QA_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = process.env.SCHOOL_QA_OUT || "/tmp/school-growth1e";
const ORIGIN = new URL(BASE).origin;
const slugs = ["storia-tubi-acciaio", "produttori-tubi-europa", "come-si-producono-tubi-acciaio"];
const cases = [
  { path: "/knowledge", canonical: "/knowledge", index: true, image: true },
  { path: "/knowledge/articoli", canonical: "/knowledge/articoli", index: true, image: true },
  ...slugs.map(slug => ({path: "/knowledge/articoli/" + slug, canonical: "/knowledge/articoli/" + slug, index: true, image: true})),
  { path: "/knowledge/tubes?source=school&surface=home_card", canonical: "/knowledge/tubes", index: false, image: false },
];
const reports = [];
const failures = [];
await fs.mkdir(OUT, {recursive:true});

async function readImage(path, mediaType, signature) {
  const response = await fetch(BASE + path, {redirect:"follow", signal:AbortSignal.timeout(45000)});
  assert.equal(response.status, 200, path + " HTTP status");
  const mime = response.headers.get("content-type") || "";
  assert.ok(mime.toLowerCase().startsWith(mediaType), path + " content-type: " + mime);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 100, path + " must have real image bytes");
  assert.ok(bytes.length < (mediaType === "image/png" ? 500000 : 16000), path + " unexpectedly large: " + bytes.length);
  if (mediaType === "image/png") {
    assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), path+" lacks PNG signature");
    assert.equal(bytes.subarray(12,16).toString("ascii"), "IHDR", path + " lacks IHDR");
    assert.equal(bytes.readUInt32BE(16),1200,path+" width must be 1200px");
    assert.equal(bytes.readUInt32BE(20),630,path+" height must be 630px");
  } else {
    assert.match(bytes.toString("utf8").slice(0,1000), /<svg[^>]+viewBox="0 0 1200 675"/, path+" invalid 1200×675 SVG");
  }
  reports.push({kind:"asset",path,mime,bytes:bytes.length,status:response.status});
}

for (const slug of slugs) {
  await readImage("/school/visuals/" + slug + ".svg", "image/svg+xml");
}
for (const path of ["/api/school-og",...slugs.map(slug=>"/api/school-og/"+slug)]) {
  await readImage(path, "image/png");
}

const browser = await chromium.launch({headless:true, channel: process.env.SCHOOL_QA_BROWSER || "chrome"});
try {
  for (const width of [390,1440]) {
    const context = await browser.newContext({
      viewport:{width,height:width===390?844:900},locale:"it-IT",
      reducedMotion:"reduce",deviceScaleFactor:1,
      isMobile:width===390,hasTouch:width===390,serviceWorkers:"block",
    });
    await context.route("**/*",route => {
      const req = route.request();
      if (!["GET","HEAD"].includes(req.method()) || new URL(req.url()).origin !== ORIGIN) return route.abort();
      return route.continue();
    });
    const page=await context.newPage();
    for (const item of cases) {
      const path=item.path;
      const slug=(item.canonical.split("/").pop()||"home");
      const label=slug+"-"+width+(path.includes("?")?"-source-school":"");
      try {
        const response=await page.goto(BASE+path,{waitUntil:"domcontentloaded",timeout:60000});
        assert.equal(response?.status(),200,label+" page status");
        assert.equal(await page.locator('link[rel="canonical"]').first().getAttribute("href"),BASE+item.canonical,label+" canonical");
        const robots=await page.locator('meta[name="robots"]').first().getAttribute("content");
        assert.match(robots||"",item.index?/\bindex\b/i:/\bnoindex\b/i,label+" robots");
        assert.ok(await page.locator("h1").count()>0,label+" missing page h1");
        const geom=await page.evaluate(()=>({
          width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
          viewport:window.innerWidth,height:document.documentElement.scrollHeight,
        }));
        assert.ok(geom.scroll <= geom.viewport+12,label+" horizontal overflow "+JSON.stringify(geom));
        const covers=await page.locator('img[src*="/school/visuals/"]').evaluateAll(nodes =>
          nodes.map(img=>({alt:img.getAttribute("alt"),width:img.naturalWidth,height:img.naturalHeight,complete:img.complete})));
        if (item.image) {
          // Images below the mobile fold are intentionally lazy. Scroll each
          // into the viewport before expecting the browser to download it.
          const coverLocators = page.locator('img[src*="/school/visuals/"]');
          const coverCount = await coverLocators.count();
          assert.ok(coverCount > 0,label+" missing article covers");
          for(let coverIndex=0;coverIndex<coverCount;coverIndex++){
            await coverLocators.nth(coverIndex).scrollIntoViewIfNeeded({timeout:10000});
            await page.waitForFunction((index)=>{
              const img=document.querySelectorAll('img[src*="/school/visuals/"]')[index];
              return Boolean(img&&img.complete&&img.naturalWidth>0);
            },coverIndex,{timeout:20000});
          }
          const valid=await coverLocators.evaluateAll(nodes=>nodes.every(n=>n.alt?.trim()&&n.naturalWidth===1200&&n.naturalHeight===675));
          assert.ok(valid,label+" broken editorial visual or missing alt");
          if (item.canonical.startsWith("/knowledge/articoli/")) {
            assert.ok(await page.locator("figure figcaption").count()>0,label+" missing educational caption");
          }
        }
        if (item.canonical.startsWith("/knowledge/articoli/")) {
          const meta=await page.locator('meta[property="og:image"]').first().getAttribute("content");
          assert.equal(meta,BASE+"/api/school-og/"+slug,label+" social preview URL");
          assert.equal(await page.locator('meta[name="twitter:card"]').first().getAttribute("content"),"summary_large_image",label+" Twitter card");
        }
        if (item.canonical==="/knowledge/articoli") {
          assert.equal(await page.locator('meta[property="og:image"]').first().getAttribute("content"),BASE+"/api/school-og",label+" social URL");
        }
        if (item.canonical==="/knowledge") {
          assert.ok(await page.getByRole("link",{name:/Calcola e crea la distinta/i}).count()>0,label+" calculator CTA missing");
        }
        let contrastChecked=0;
        for (const element of await page.locator(".school-primary-action, .school-secondary-action").all()) {
          if (!(await element.isVisible())) continue;
          const data=await element.evaluate(el=>{
            const parse=v=>{const m=/rgba?\(([\d.,\s/]+)\)/.exec(v);if(!m)return null;const a=m[1].trim().split(/[\s,/]+/).map(Number);return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1};};
            const mix=(a,b)=>({r:a.r*a.a+b.r*(1-a.a),g:a.g*a.a+b.g*(1-a.a),b:a.b*a.a+b.b*(1-a.a),a:1});
            let bg={r:255,g:255,b:255,a:1},chain=[],node=el;
            while(node){chain.unshift(node);node=node.parentElement;}
            for(const parent of chain){const col=parse(getComputedStyle(parent).backgroundColor);if(col&&col.a>0)bg=mix(col,bg);}
            const css=getComputedStyle(el);
            const textFill=css.webkitTextFillColor!=="currentcolor"?parse(css.webkitTextFillColor):null;
            const foreground=textFill||parse(css.color);
            if(!foreground)return {skip:true};
            const f=mix(foreground,bg);
            const lumi=c=>{const channel=v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};return .2126*channel(c.r)+.7152*channel(c.g)+.0722*channel(c.b)};
            const light=Math.max(lumi(f),lumi(bg)),dark=Math.min(lumi(f),lumi(bg));
            return {ratio:(light+.05)/(dark+.05),text:(el.textContent||"").trim().slice(0,60),
              foreground:css.color, background:css.backgroundColor};
          });
          if(data.skip)continue;
          assert.ok(data.ratio>=4.5,label+" button contrast "+JSON.stringify(data));
          contrastChecked++;
        }
        if (item.canonical==="/knowledge") assert.ok(contrastChecked>=2,label+" no primary/secondary CTA contrast sampled");
        const screenshotPath=OUT+"/"+label+".png";
        await page.screenshot({path:screenshotPath,fullPage:true,animations:"disabled"});
        reports.push({kind:"page",path,width,status:response.status,robots,canonical:item.canonical,
          screenshot:screenshotPath,contrastChecked,covers:covers.length,geometry:geom});
        console.log("SCHOOL-GROWTH1E PASS",path,width,"contrastActions",contrastChecked);
      } catch (error) {
        const message=label+" "+String(error);
        failures.push(message);
        console.error("SCHOOL-GROWTH1E FAIL",message);
        try {await page.screenshot({path:OUT+"/"+label+"-failure.png",fullPage:true});}catch{}
      }
    }
    await context.close();
  }
}finally{
  await browser.close();
  await fs.writeFile(OUT+"/report.json",JSON.stringify({base:BASE,checkedAt:new Date().toISOString(),reports,failures},null,2));
}
if(failures.length) throw new Error("SCHOOL-GROWTH1E visual/SEO acceptance failed\n"+failures.join("\n"));
console.log("SCHOOL-GROWTH1E all public pages & 7 binary assets validated; report in",OUT);
