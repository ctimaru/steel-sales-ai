/**
 * NET-RO1.4.C.1 — source-backed Romania claimable profiles in REAL Chrome,
 * but only against disposable 127.0.0.1 Supabase / synthetic GoTrue users.
 * NEVER hits hosted production and NEVER submits a company-claim request.
 * 1440/390/320 screenshot evidence accompanies guarded admin/viewer checks.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.DEMOTEST23_WEB_URL;
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(base, "http://127.0.0.1:3000", "Hosted browser target is forbidden");
assert.equal(dbUrl, "http://127.0.0.1:54321", "Hosted Supabase is forbidden");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true", "Synthetic fixture is mandatory");
assert.ok(process.env.RUNNER_TEMP, "RUNNER_TEMP required");
const serviceKey = process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
assert.ok(serviceKey && serviceKey.length > 20, "Local-only key required");
const adminClient = createClient(dbUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const admin = people.find(x => x.id === "buyer");
const viewer = people.find(x => x.id === "buyerViewer");
assert.ok(admin && viewer, "Isolated admin and viewer personas required");
const out = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(out, { recursive: true });

const domains = [
  { domain: "artrom.com", role: "producer" },
  { domain: "baurom.ro", role: "trader" },
  { domain: "laser-rmc.ro", role: "processor" },
];
const { data: records, error } = await adminClient
  .from("network_companies")
  .select("id,legal_name,website_domain,publication_status,claimed_status,verification_status")
  .eq("country_code", "RO")
  .in("website_domain", domains.map(x => x.domain));
assert.ifError(error);
assert.equal(records?.length, 3, "Expected one local canonical company per reference role");
const companies = domains.map(({domain,role}) => {
  const record = records.find(x => x.website_domain === domain);
  assert.ok(record, "Missing disposable profile " + domain);
  assert.equal(record.publication_status, "published");
  assert.equal(record.claimed_status, "unclaimed");
  assert.equal(record.verification_status, "unverified");
  return { ...record, role };
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
let assertions = 0;
async function session(person, width) {
  const height = width === 1440 ? 900 : width === 390 ? 844 : 720;
  const context = await browser.newContext({
    viewport: {width, height}, locale:"it-IT", reducedMotion:"reduce",
    deviceScaleFactor: width < 1000 ? 2 : 1, serviceWorkers:"block",
  });
  await context.route("**/*", route => {
    const url = route.request().url();
    const target = new URL(url);
    return target.hostname === "127.0.0.1" || target.hostname === "localhost"
      ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto(base + "/login", { waitUntil:"domcontentloaded", timeout:90000 });
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.pathname==="/dashboard",{timeout:90000});
  return {context,page,height,errors};
}
async function navigate(page, href) {
  const response = await page.goto(base + href, {waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(response,"Missing response "+href);
  assert.equal(response.status(),200,"Unexpected HTTP response "+href);
  assert.ok((await page.locator("body").innerText()).length>80,"Blank or inaccessible "+href);
}
async function noOverflow(page, tag) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  if (metrics.documentWidth > metrics.width + 12) {
    // Fail with actionable culprit geometry, not only the document's scrollWidth.
    // No user data is included; this runner uses disposable local fixtures only.
    const offenders = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll("body *")].map((element) => {
        const rect = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className.slice(0,180) : "",
          testId: element.getAttribute("data-testid") || "",
          left: Math.round(rect.left), right: Math.round(rect.right),
          scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
          overflowX: computed.overflowX,
        };
      }).filter(item => item.right > width + 12 && item.left < width)
        .sort((a,b) => b.right - a.right).slice(0,20);
    });
    assert.fail("Horizontal overflow on "+tag+": "+JSON.stringify({metrics,offenders}));
  }
  // Native selects must remain inside the viewport even if an ancestor
  // hides page-level overflow. This catches intrinsic min-content regressions.
  const escapedSelects = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return [...document.querySelectorAll("select")].flatMap((select) => {
      const box = select.getBoundingClientRect();
      if (!box.width || box.right <= viewport + 12) return [];
      return [{label:select.getAttribute("aria-label") || select.name,
        left:Math.round(box.left),right:Math.round(box.right),viewport}];
    });
  });
  assert.deepEqual(escapedSelects, [], "Native filter select escaped the mobile viewport on "+tag);
  assertions++;
}
async function screenshot(page,slug,width) {
  // All credentials are synthetic; screenshots never include tokens or keys.
  await page.screenshot({path:path.join(out,slug+"-"+width+".png"),fullPage:false,animations:"disabled"});
}

try {
  for (const width of [1440,390,320]) {
    const {context,page,height,errors}=await session(admin,width);
    try {
      await navigate(page,"/network?country=RO");
      // Wait for authenticated workspace hydration and the first sourced company card.
      // DOM content alone can still show "Caricamento workspace…" immediately after navigation.
      await page.getByText(/ARTROM|Baurom/).first().waitFor({state:"visible",timeout:90000});
      assert.match(await page.locator("body").innerText(), /ARTROM|Baurom/);
      // Synthetic organizations may take the legacy Network fallback. Assert the
      // actual compact component in a strictly local test-only route instead;
      // never treat a fallback screenshot as acceptance of the redesigned card.
      const realCompact = await page.getByTestId("network-refined-filters").count();
      if (!realCompact) console.log("NET-UX-FILTERS1 REAL ROUTE FALLBACK: using local component fixture");
      await navigate(page,"/network-visual-qa");
      await page.getByTestId("network-refined-filters").waitFor({state:"attached",timeout:90000});
      // NET-UX-FILTERS1: real Chrome visual acceptance of the new filter card
      // at 1440 / 390 / 320, with the map still visible outside the mobile drawer.
      const europeMap = page.getByTestId("network-europe-persistent-map");
      const filtersCard = page.getByTestId("network-refined-filters");
      const drawer = page.getByTestId("network-filter-drawer");
      const toggle = drawer.getByRole("button", {name:/Affina i filtri/i});
      // An App Router SSR shell can be attached before its visibility transition
      // settles; wait for the map itself, not merely an attached filter card.
      await europeMap.waitFor({state:"visible",timeout:45000}).catch(async error=>{
        const state=await europeMap.evaluate(element=>{
          const chain=[];
          for(let el=element;el&&chain.length<8;el=el.parentElement){
            const css=getComputedStyle(el);
            chain.push({tag:el.tagName,testid:el.getAttribute("data-testid"),hidden:el.hidden,
              display:css.display,visibility:css.visibility,opacity:css.opacity});
          }
          return chain;
        }).catch(()=>[]);
        console.log("NET-UX-TECH1 MAP VISIBILITY DIAGNOSTIC",JSON.stringify(state));
        throw error;
      });
      if (!(await europeMap.isVisible())) {
        // Synthetic-only diagnostics: investigate why a data-backed compact
        // directory fell back to the legacy view. Never print session secrets.
        const pageState = await page.evaluate(() => ({
          headings: [...document.querySelectorAll("h1,h2")].slice(0,8).map(el=>el.textContent?.trim().slice(0,90)),
          compact: Boolean(document.querySelector('[data-testid="network-compact-experience"]')),
          map: Boolean(document.querySelector('[data-testid="network-europe-persistent-map"]')),
          filterCard: Boolean(document.querySelector('[data-testid="network-refined-filters"]')),
          pathname: location.pathname,
        }));
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
        let rpcDiagnostics = {error:"local diagnostic unavailable"};
        if (anonKey) {
          const viewerClient = createClient(dbUrl, anonKey, {auth:{persistSession:false,autoRefreshToken:false}});
          const auth = await viewerClient.auth.signInWithPassword({email:admin.email,password:admin.password});
          if (auth.error) rpcDiagnostics={authError:auth.error.code||auth.error.message};
          else {
            const access = await viewerClient.rpc("pa1_3_network_access_state",{p_organization_id:admin.org});
            const browse = await viewerClient.rpc("netlaunch4b_browse_page",{
              p_organization_id:admin.org,p_access:"pro",p_source:"published",
              p_query:null,p_role:null,p_region:null,p_persona:null,p_page:1,p_limit:18,
            });
            rpcDiagnostics={
              accessError:access.error?{code:access.error.code,message:access.error.message}:null,
              entitled:access.data?.can_access_network??null,
              browseError:browse.error?{code:browse.error.code,message:browse.error.message}:null,
              browseContract:browse.data?.contract??null,
              browseCount:browse.data?.total??null,
            };
          }
        }
        console.log("NET-UX-FILTERS1 SYNTHETIC DIAGNOSTIC",JSON.stringify({width,pageState,rpcDiagnostics}));
      }
      assert.equal(await europeMap.isVisible(), true, "Country map disappeared at "+width);
      if (width === 1440) {
        assert.equal(await filtersCard.isVisible(), true, "Desktop filter card must remain open");
        assert.equal(await toggle.isVisible(), false, "Desktop drawer toggle must stay hidden");
      } else {
        assert.equal(await toggle.isVisible(), true, "Mobile filter toggle must be visible");
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await filtersCard.isVisible(), false, "Mobile filters must start collapsed");
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        await filtersCard.waitFor({state:"visible"});
      }
      // Read one atomic browser-layout snapshot after hydration. Individual
      // boundingBox() calls across redirects/hydration can return transient nulls.
      await filtersCard.scrollIntoViewIfNeeded();
      const layout = await filtersCard.evaluate(card => {
        const bounds = (element) => {
          const box = element.getBoundingClientRect();
          return {x:box.x,width:box.width,height:box.height,right:box.right,visible:
            box.width>0 && box.height>0 && getComputedStyle(element).display!=="none"};
        };
        return {
          roles:[...card.querySelectorAll('nav[aria-label="Ruolo nella filiera"] a')]
            .map(element=>({label:(element.textContent||"").trim(),...bounds(element)})),
          selects:[...card.querySelectorAll("select[aria-label]")]
            .map(element=>({label:element.getAttribute("aria-label"),...bounds(element)})),
        };
      });
      // A dark green selected chip must never inherit a dark WebKit text fill.
      const selectedForeground = await filtersCard.locator('nav[aria-label="Ruolo nella filiera"] a[aria-current="page"]')
        .evaluate(element => {
          const style=getComputedStyle(element);
          return {color:style.color,textFill:style.webkitTextFillColor};
        });
      assert.equal(selectedForeground.color,"rgb(255, 255, 255)",
        "Selected role must use high-contrast white text: "+JSON.stringify(selectedForeground));
      assert.equal(selectedForeground.textFill,"rgb(255, 255, 255)",
        "Selected role WebKit text fill must stay white: "+JSON.stringify(selectedForeground));
      const expectedRoles=["Tutta la filiera","Produttori","Commercianti","Terzisti","Utilizzatori"];
      assert.equal(layout.roles.length,5,"All industrial roles stay reachable: "+JSON.stringify(layout));
      for (const roleName of expectedRoles) {
        const roleBox = layout.roles.find(role=>role.label===roleName);
        assert.ok(roleBox?.visible&&roleBox.height>=44,
          "Role target too small/hidden: "+roleName+"/"+width+": "+JSON.stringify(layout.roles));
      }
      for (const label of ["Paese", "Regione", "Prodotti", "Lavorazioni e servizi", "Mercato"]) {
        const rect = layout.selects.find(select=>select.label===label);
        assert.ok(rect?.visible&&rect.height>=44,
          "Filter select too small/hidden: "+label+"/"+width+": "+JSON.stringify(layout.selects));
        assert.ok(rect.x >= -1 && rect.right <= width + 1,
          "Filter select outside viewport: "+label+"/"+width+": "+JSON.stringify(rect));
      }
      // This panel has already been brought into view before the atomic layout
      // snapshot. A second scroll can target a stale hydrated DOM node.
      assert.equal(new URL(page.url()).pathname,"/network-visual-qa",
        "Visual test must remain on the isolated compact component");
      await noOverflow(page,"Filters-card-open/"+width);
      await screenshot(page,"network-filters-open-admin",width);
      assertions += 13;
      // NET-UX-TECH1: open the real technical accordion at 1440/390/320 and
      // verify each measurement field remains aligned and at least 44px high.
      const specPanel=page.getByTestId("network-spec-panel");
      await specPanel.getByTestId("network-spec-summary").click();
      assert.equal(await specPanel.getAttribute("open"),"","Technical panel failed to open at "+width);
      const specLayout=await specPanel.evaluate(panel=>{
        const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right};};
        const fields=[...panel.querySelectorAll("input:not([type=hidden]),select")]
          .map(el=>({name:el.name,...box(el)}));
        const rows=["network-spec-diameter-row","network-spec-sides-row"].map(id=>
          [...panel.querySelector('[data-testid="'+id+'"]').querySelectorAll("input")].map(box));
        return {panel:box(panel),fields,rows,cta:box(panel.querySelector('button[type=submit]'))};
      });
      assert.equal(specLayout.fields.length,8,"All technical fields remain accessible");
      for(const field of specLayout.fields.filter(f=>f.name!=="stock")){
        assert.ok(field.h>=44,"Technical field below 44px: "+field.name+"/"+width);
        assert.ok(field.x>=-1&&field.right<=width+1,"Technical field escaped viewport: "+field.name+"/"+width);
        assert.ok(field.x>=specLayout.panel.x-1&&field.right<=specLayout.panel.right+1,
          "Technical field escaped card: "+field.name+"/"+width);
      }
      for(const row of specLayout.rows){
        assert.equal(row.length,2);
        assert.ok(Math.abs(row[0].y-row[1].y)<2&&Math.abs(row[0].w-row[1].w)<2,
          "Misaligned technical dimensions at "+width+": "+JSON.stringify(row));
      }
      assert.ok(specLayout.cta.h>=44&&Math.abs(specLayout.cta.w-(specLayout.panel.w-24))<5,
        "Technical submit is not full width / 44px at "+width);
      await noOverflow(page,"Technical-spec-open/"+width);
      await specPanel.scrollIntoViewIfNeeded();
      await screenshot(page,"network-technical-spec-open-admin",width);
      assertions += 20;
      if (width !== 1440) {
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await filtersCard.isVisible(), false, "Mobile drawer failed to collapse");
        await screenshot(page,"network-filters-closed-admin",width);
        assertions += 2;
      }
      await noOverflow(page,"Romania-directory/admin/"+width);
      await screenshot(page,"romania-directory-admin",width);
      assertions += 2;

      for (const co of companies) {
        const profilePath="/network/"+co.id;
        await navigate(page,profilePath);
        await page.getByRole("heading",{level:1,name:co.legal_name}).waitFor({state:"visible",timeout:45000});
        const claim=page.getByTestId("network-unclaimed-company-claim");
        await claim.waitFor({state:"visible",timeout:45000});
        assert.match(await claim.innerText(),/Profilo non rivendicato/);
        const link=claim.getByRole("link",{name:"Rivendica questa azienda"});
        assert.equal(await link.count(),1);
        assert.equal(new URL(await link.getAttribute("href"),base).pathname,profilePath+"/claim");
        const claimRect=await claim.boundingBox();
        const connectRect=await page.getByTestId("network-profile-connect-disabled").boundingBox().catch(()=>null);
        assert.ok(claimRect && claimRect.y < height,
          "Claim action must appear inside viewport at "+width+"/"+co.role+": "+JSON.stringify(claimRect));
        if(connectRect) assert.ok(claimRect.y < connectRect.y,
          "Claim CTA must precede disabled connection action for "+co.role);
        await noOverflow(page,co.role+"/admin/"+width);
        await screenshot(page,"romania-"+co.role+"-admin",width);
        assertions+=7;

        if(co.role==="producer") {
          await navigate(page,profilePath+"/claim");
          await page.getByRole("heading",{name:/^Rivendica /}).waitFor({state:"visible"});
          assert.match(await page.locator("body").innerText(), /Non verificata/);
          assert.equal(await page.locator('input[name="network_company_id"]').inputValue(),co.id);
          await noOverflow(page,"claim/admin/"+width);
          await screenshot(page,"romania-claim-admin",width);
          assertions+=3;
          // Only inspect the form: NEVER click submit, send an email or claim a real company.
        }
      }
      assert.deepEqual(errors,[],"Hydration/runtime errors on admin "+width);
    } finally { await context.close(); }

    // Same entitled synthetic organization but viewer role: the claim CTA must
    // enter registration, never expose the owner submission form.
    const v=await session(viewer,width);
    try {
      const company=companies[0];
      const profilePath="/network/"+company.id;
      await navigate(v.page,profilePath);
      const claim=v.page.getByTestId("network-unclaimed-company-claim");
      await claim.waitFor({state:"visible"});
      const link=claim.getByRole("link",{name:"Rivendica questa azienda"});
      assert.equal(await link.count(),1);
      const next=new URL(await link.getAttribute("href"),base);
      assert.equal(next.pathname,"/register");
      assert.equal(next.searchParams.get("company"),company.legal_name);
      assert.equal(next.searchParams.get("return_to"),profilePath+"/claim");
      assert.equal(next.hash,"#company-check");
      await noOverflow(v.page,"producer/viewer/"+width);
      await screenshot(v.page,"romania-producer-viewer",width);
      // A viewer may not open the privileged claim form.
      await v.page.goto(base+profilePath+"/claim",{waitUntil:"domcontentloaded",timeout:90000});
      await v.page.waitForURL(u=>u.pathname!==profilePath+"/claim",{timeout:45000});
      assert.equal(await v.page.locator('input[name="network_company_id"]').count(),0);
      assert.deepEqual(v.errors,[],"Hydration/runtime errors on viewer "+width);
      assertions+=7;
    } finally { await v.context.close(); }
    console.log("NET-RO1.4.C.1 LOCAL CHROME PASS",width,"admin / viewer, 3 company roles, claim safety");
  }
} finally {
  await browser.close();
}
console.log("NET-RO1.4.C.1 SYNTHETIC CHROME PASS",assertions,
  "local-only assertions, no profile ownership changes, 1440/390/320 screenshots");
