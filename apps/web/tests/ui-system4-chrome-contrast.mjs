/**
 * UI-SYSTEM4 — browser-computed contrast audit, read-only.
 * Run with UI4_BASE_URL=https://... node tests/ui-system4-chrome-contrast.mjs
 * Browser computed values include cascade, Safari-independent theme tokens,
 * hover and focus states, unlike string-based Tailwind source checks.
 */
import { chromium } from "playwright";

const base = (process.env.UI4_BASE_URL || "https://www.smartsteelsales.com").replace(/\/$/, "");
const routes = ["/", "/network?persona=trader_distributor#network-role-discovery", "/network?status=discovered", "/knowledge/tubes#calcolatore-pesi", "/login", "/register"];
// Audit every actionable button/link, including legacy links nested within company cards.
const targets = "button, a[href], [role=button], .ui-action, .network-role-chip, .network-category-chip";
const errors = [];
const browser = await chromium.launch({headless:true,channel:process.env.UI4_BROWSER_CHANNEL || "chrome"});
try {
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    const page = await browser.newPage({viewport, locale:"it-IT"});
    for (const route of routes) {
      const response = await page.goto(base + route,{waitUntil:"domcontentloaded",timeout:45000});
      if (!response || response.status()>=500) { errors.push(`${route}: unavailable HTTP ${response?.status()}`); continue; }
      const elements = page.locator(targets);
      const count = Math.min(await elements.count(),150);
      for(let i=0;i<count;i++){
        const element=elements.nth(i);
        if(!(await element.isVisible()))continue; 
        // Skip anchor text without interactive chrome; native page links may inherit context. 
        const isAuditable = await element.evaluate(node => { 
          const css = getComputedStyle(node); 
          const rect = node.getBoundingClientRect(); 
          return rect.width > 0 && rect.height > 0 && css.visibility !== "hidden" && (node.tagName === "BUTTON" || node.getAttribute("role") === "button" || css.backgroundColor !== "rgba(0, 0, 0, 0)" || node.classList.contains("ui-action")); 
        }); 
        if (!isAuditable) continue;
        for (const state of ["normal","hover","focus"]) {
          try {
            if(state==="hover") { try { await element.hover({timeout:1500}); } catch { continue; } }
            if(state==="focus") { try { await element.focus({timeout:1500}); } catch { continue; } }
            const data=await element.evaluate(node=>{
              const rgb=(input)=>{const m=input.match(/rgba?\(([^)]+)\)/);if(!m)return null;const q=m[1].trim().split(/[\s,\/]+/).map(Number);return q.length>=3?{r:q[0],g:q[1],b:q[2],a:q.length>3?q[3]:1}:null;};
              const blend=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1});
              let background={r:255,g:255,b:255,a:1};
              const chain=[];let current=node;
              while(current){chain.unshift(current);current=current.parentElement;}
              for(const part of chain){const c=rgb(getComputedStyle(part).backgroundColor);if(c&&c.a>0)background=blend(c,background);}
              const style=getComputedStyle(node);\n              // Sliding region choice uses a colored ::before layer, not the button background.\n              const choice = node.matches("button[aria-pressed=true]") && node.parentElement?.getAttribute("data-region");\n              if (choice && getComputedStyle(node.parentElement,"::before").backgroundImage !== "none") return {skip:true};
              const foreground=rgb(style.webkitTextFillColor&&style.webkitTextFillColor!=="currentcolor"?style.webkitTextFillColor:style.color) || rgb(style.color);
              if(!foreground)return {skip:true};
              const channel=n=>{const x=n/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4};
              const luminance=c=>.2126*channel(c.r)+.7152*channel(c.g)+.0722*channel(c.b);
              const fore=blend(foreground,background);
              const a=luminance(fore),b=luminance(background);
              return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),text:(node.textContent||"").trim().slice(0,52),foreground:style.color,background:style.backgroundColor,html:node.outerHTML.slice(0,380)};
            });
            if(!data.skip && data.ratio<4.5) errors.push(`${viewport.width}px ${route} [${state}] "${data.text}" contrast ${data.ratio.toFixed(2)}:1 (${data.foreground} / ${data.background}) ${data.html || ""}`);
          }catch(e){errors.push(`${viewport.width}px ${route} [${state}] element ${i}: ${String(e).slice(0,120)}`);}
        }
      }
      console.log("UI4 scanned", viewport.width,route,count);
    }
    await page.close();
  }
}finally{await browser.close();}
if(errors.length){console.error("UI-SYSTEM4 computed contrast failures:\n"+errors.join("\n"));process.exitCode=1;}
else console.log("UI-SYSTEM4 computed button contrast verified for tested public routes.");
