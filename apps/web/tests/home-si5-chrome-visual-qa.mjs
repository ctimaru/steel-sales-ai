/**
 * HOME-SI5 — real Chrome static-home desktop/mobile visual, accessibility and
 * SEO acceptance. Uses only a disposable local production Next server.
 * Screenshots contain PUBLIC pages only. Never sign in, submit forms or
 * contact APIs. All non-GET/HEAD requests are aborted.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://127.0.0.1:3000";
const OUT = "/tmp/home-si5";
const WIDTHS = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
const results = [];
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let writeAttempts = 0;

function check(condition, reason) {
  assert.ok(condition, reason);
}

async function setup(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: "it-IT",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  await context.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      writeAttempts += 1;
      await route.abort();
      return;
    }
    // The public QA fixture is local only; external telemetry/images cannot
    // affect the screenshots or send data from the test runner.
    if (new URL(req.url()).origin !== BASE) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  return { context, page: await context.newPage() };
}

try {
  for (const viewport of WIDTHS) {
    const { context, page } = await setup(viewport.width, viewport.height);
    try {
      const response = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 50000 });
      assert.equal(response?.status(), 200, viewport.name + " homepage should return HTTP 200");
      await page.getByRole("heading", { name: /L.intelligenza che connette/i }).waitFor();
      const expected = [
        "La filiera steel, utile in base al tuo ruolo.",
        "Tre forme di intelligence. Un solo ecosistema.",
        "Prima utilità, poi prodotto.",
        "Cercala per nome o Partita IVA.",
        "La tua azienda, un accesso governato.",
      ];
      for (const name of expected) {
        check(await page.getByRole("heading", { name, exact: true }).count() === 1, "Missing section: " + name);
      }

      const layout = await page.evaluate(() => {
        const dom = document.documentElement;
        const actualWidth = dom.clientWidth;
        const pageWidth = dom.scrollWidth;
        const sections = ["home-hero-title", "network", "intelligence", "aziende", "registrazione"];
        const geometry = sections.map((id) => {
          const el = document.getElementById(id);
          if (!el) return { id, missing: true };
          const r = el.getBoundingClientRect();
          return { id, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
        });
        return { actualWidth, pageWidth, geometry };
      });
      check(layout.pageWidth <= layout.actualWidth + 12,
        viewport.name + " has page overflow " + JSON.stringify(layout));
      for (const g of layout.geometry) {
        check(!g.missing && g.width > 0, viewport.name + " has invisible or absent section " + g.id);
        check(g.left >= -12 && g.right <= layout.actualWidth + 12,
          viewport.name + " section clipped: " + JSON.stringify(g));
      }

      const heroLinks = page.getByRole("link", { name: /Registra la tua azienda/i });
      check(await heroLinks.count() >= 1, "Registration CTA not present");
      check(await heroLinks.first().getAttribute("href") === "/register", "Registration CTA points elsewhere");
      const publicDistinta = page.getByRole("link", { name: "Crea distinta gratis" });
      check(await publicDistinta.count() === 1, "No public builder CTA");
      check(await publicDistinta.getAttribute("href") === "/distinta", "Builder CTA is not public");

      const networkLinks = await page.locator('a[href="/network"], a[href="/rfq-hub"], a[href="/platform"]').count();
      assert.equal(networkLinks, 0, "Public page must not link users into private data");
      const h1 = await page.locator("h1").count();
      assert.equal(h1, 1, "Homepage must have one H1");

      if (viewport.width === 390 || viewport.width === 1440) {
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const severe = axe.violations.filter((item) => item.impact === "critical" || item.impact === "serious");
        console.log("HOME-SI5 AXE", JSON.stringify({
          viewport: viewport.name,
          totalViolations: axe.violations.length,
          seriousOrCritical: severe.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
          other: axe.violations.filter((item) => item.impact !== "critical" && item.impact !== "serious")
            .map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
        }));
        assert.deepEqual(severe.map((item) => item.id), [], viewport.name + " has severe WCAG violations");
      }

      if (viewport.width === 1440) {
        const meta = await page.evaluate(() => {
          const get = (selector, attr = "content") => document.querySelector(selector)?.getAttribute(attr) || "";
          const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .flatMap((el) => {
              try { return [JSON.parse(el.textContent || "{}")]; } catch { return []; }
            });
          return {
            title: document.title,
            description: get('meta[name="description"]'),
            canonical: get('link[rel="canonical"]', "href"),
            ogTitle: get('meta[property="og:title"]'),
            ogDescription: get('meta[property="og:description"]'),
            robots: get('meta[name="robots"]'),
            schemaTypes: schemas.map((x) => x["@type"]),
            imgsWithoutAlt: document.querySelectorAll("img:not([alt])").length,
          };
        });
        check(meta.title.includes("Smart Steel Sales"), "SEO title missing");
        check(meta.description.length > 75, "SEO description missing");
        assert.equal(new URL(meta.canonical).origin, BASE, "Local canonical should use local CI origin");
        assert.equal(new URL(meta.canonical).pathname, "/", "Canonical homepage path missing");
        check(meta.ogTitle.includes("Smart Steel Sales") && meta.ogDescription.length > 30, "OG metadata missing");
        check(!meta.robots.includes("noindex"), "Public homepage must remain indexable");
        check(meta.schemaTypes.includes("Organization") && meta.schemaTypes.includes("WebSite"), "JSON-LD schema missing");
        assert.equal(meta.imgsWithoutAlt, 0, "Unlabelled image on home");
        const robotsRes = await page.request.get(BASE + "/robots.txt");
        check(robotsRes.ok(), "robots.txt unavailable");
        const robots = await robotsRes.text();
        check(robots.includes("Sitemap:") && robots.includes("/dashboard"), "Private SEO boundaries missing");
        const sitemapRes = await page.request.get(BASE + "/sitemap.xml");
        check(sitemapRes.ok(), "sitemap.xml unavailable");
        const sitemap = await sitemapRes.text();
        check(sitemap.includes("/knowledge") && !sitemap.includes("https://www.smartsteelsales.com/dashboard"),
          "Unexpected private sitemap entry");
        console.log("HOME-SI5 SEO PASS", JSON.stringify(meta));
      }

      // Screenshots are anonymized by design: public static homepage only.
      await page.screenshot({ path: OUT + "/" + viewport.name + ".png", fullPage: true, animations: "disabled" });
      console.log("HOME-SI5 VIEWPORT PASS", JSON.stringify({ viewport: viewport.name, width: layout.actualWidth, documentWidth: layout.pageWidth }));
      // CONTACT-CTA1: assert actual computed text, WebKit text fill and backgrounds
      // on both public homepages across all existing mobile/desktop viewports.
      for (const home of [
        { path: "/", locale: "it", investorHref: "/investitori" },
        { path: "/en", locale: "en", investorHref: "/en/investors" },
      ]) {
        const homeResponse = await page.goto(BASE + home.path, { waitUntil: "domcontentloaded", timeout: 50000 });
        assert.equal(homeResponse?.status(), 200, "Contact homepage should return HTTP 200: " + home.path);
        const contact = page.locator("#get-in-touch");
        await contact.waitFor({ state: "visible" });
        const ctaChecks = [
          { cls: "public-contact-email", color: "rgb(18, 59, 52)", bg: "rgb(255, 255, 255)", href: "mailto:hello@smartsteelsales.com" },
          { cls: "public-contact-linkedin", color: "rgb(255, 255, 255)", bg: "rgba(0, 0, 0, 0)", href: "https://www.linkedin.com/company/smart-steel-sales" },
          { cls: "public-contact-investor", color: "rgb(18, 59, 52)", bg: "rgb(223, 243, 233)", href: home.investorHref },
        ];
        for (const expected of ctaChecks) {
          const link = contact.locator("." + expected.cls);
          assert.equal(await link.count(), 1, home.locale + " " + expected.cls + " must exist exactly once");
          const actual = await link.evaluate((element) => {
            const computed = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return {
              color: computed.color,
              background: computed.backgroundColor,
              webkitTextFillColor: computed.webkitTextFillColor,
              width: box.width,
              height: box.height,
              href: element.getAttribute("href"),
            };
          });
          assert.equal(actual.color, expected.color, home.locale + " " + expected.cls + " text foreground");
          assert.equal(actual.webkitTextFillColor, expected.color, home.locale + " " + expected.cls + " WebKit text foreground");
          assert.equal(actual.background, expected.bg, home.locale + " " + expected.cls + " background");
          check(actual.height >= 44 && actual.width >= 44, home.locale + " " + expected.cls + " touch target too small");
          check(actual.href?.startsWith(expected.href), home.locale + " " + expected.cls + " unexpected href");
        }
        const geometry = await contact.evaluate((section) => {
          const rect = section.getBoundingClientRect();
          return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth };
        });
        check(geometry.left >= -12 && geometry.right <= geometry.viewport + 12,
          home.locale + " Get in touch section clipped: " + JSON.stringify(geometry));
        check(geometry.scroll <= geometry.viewport + 12,
          home.locale + " Get in touch creates horizontal overflow: " + JSON.stringify(geometry));
        await contact.screenshot({ path: OUT + "/contact-cta1-" + home.locale + "-" + viewport.name + ".png", animations: "disabled" });
        console.log("CONTACT-CTA1 CHROME PASS", home.locale, viewport.name);
      }
      // INVEST2: exercise the actual CSS cascade in Chrome, not just static source.
      // These are static public pages; all non-read-only requests remain blocked above.
      for (const investor of [
        { path: "/investitori", label: "Richiedi accesso al Business Plan" },
        { path: "/en/investors", label: "Request Business Plan access" },
      ]) {
        const investorResponse = await page.goto(BASE + investor.path, { waitUntil: "domcontentloaded", timeout: 50000 });
        assert.equal(investorResponse?.status(), 200, investor.path + " should return HTTP 200");
        const planCta = page.getByRole("link", { name: investor.label, exact: true });
        await planCta.waitFor({ state: "visible" });
        const actual = await planCta.evaluate((anchor) => {
          const css = getComputedStyle(anchor);
          const label = anchor.querySelector(".investor-plan-cta-label");
          const labelCss = label ? getComputedStyle(label) : null;
          const bounds = anchor.getBoundingClientRect();
          return {
            color: css.color, background: css.backgroundColor,
            textFillColor: css.webkitTextFillColor,
            labelColor: labelCss?.color,
            labelTextFill: labelCss?.webkitTextFillColor,
            width: bounds.width, height: bounds.height,
            href: anchor.getAttribute("href"),
            scroll: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth,
          };
        });
        assert.equal(actual.background, "rgb(255, 255, 255)", "Investor primary CTA must have white background");
        assert.equal(actual.color, "rgb(18, 59, 52)", "Investor CTA must have dark visible lettering");
        assert.equal(actual.labelColor, "rgb(18, 59, 52)", "Investor label must have dark visible lettering");
        assert.equal(actual.textFillColor, "rgb(18, 59, 52)", "Investor CTA must override WebKit text fill");
        assert.equal(actual.labelTextFill, "rgb(18, 59, 52)", "Investor label must override WebKit text fill");
        check(actual.width >= 210 && actual.height >= 48, "Investor CTA touch target or width too small");
        check(actual.href?.startsWith("mailto:hello@smartsteelsales.com"), "Investor CTA mailto destination wrong");
        if (actual.scroll > actual.viewport + 12) {
          const widest = await page.evaluate(() => [...document.querySelectorAll("body *")]
            .map((element) => ({ tag: element.tagName.toLowerCase(), text: element.textContent?.trim().slice(0, 45), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) }))
            .filter((item) => item.right > document.documentElement.clientWidth + 12)
            .sort((a, b) => b.right - a.right).slice(0, 5));
          console.error("INVEST2 MOBILE OVERFLOW DIAGNOSTIC", investor.path, viewport.name, actual.viewport, actual.scroll, JSON.stringify(widest));
        }
        check(actual.scroll <= actual.viewport + 12, "Investor landing horizontal overflow at " + viewport.name);
        await page.screenshot({
          path: OUT + "/invest2-" + (investor.path === "/investitori" ? "it" : "en") + "-" + viewport.name + ".png",
          fullPage: true, animations: "disabled",
        });
        console.log("INVEST2 CHROME CTA PASS", viewport.name, investor.path, actual.color, actual.background);
      }
      if (viewport.width === 390 || viewport.width === 1440) {
        // I18N7: one source of truth for the IT and EN calculator.
        await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
        for (const tube of [
          { path: "/knowledge/tubes", locale: "it", copy: "Copia risultato", builder: "/distinta" },
          { path: "/en/knowledge/tubes", locale: "en", copy: "Copy result", builder: "/en/distinta" },
        ]) {
          const tubeResponse = await page.goto(BASE + tube.path, { waitUntil: "domcontentloaded", timeout: 50000 });
          assert.equal(tubeResponse?.status(), 200, "I18N7 calculator page HTTP status");
          const calculator = page.locator("#calcolatore-pesi");
          await calculator.waitFor({ state: "visible" });
          check(await calculator.getByRole("button", { name: "EN 10219" }).count() === 1, "Missing shared standard control");
          const copy = calculator.getByRole("button", { name: tube.copy, exact: true });
          await copy.waitFor({ state: "visible" });
          check(!(await copy.isDisabled()), "Copy should be enabled for valid default section");
          await copy.click();
          const copied = await page.evaluate(async () => navigator.clipboard.readText());
          check(copied.includes("kg/m") && copied.includes("EN 10219") && copied.includes("12 m"),
            "I18N7 clipboard result missing practical RFQ information: " + tube.locale);
          const rfq = calculator.locator(".tube-calculator-rfq-link");
          const actual = await rfq.evaluate((anchor) => {
            const style = getComputedStyle(anchor);
            const box = anchor.getBoundingClientRect();
            return { href: anchor.getAttribute("href"), color: style.color,
              fill: style.webkitTextFillColor, background: style.backgroundColor,
              width: box.width, height: box.height,
              viewport: document.documentElement.clientWidth,
              scroll: document.documentElement.scrollWidth };
          });
          assert.equal(actual.href, tube.builder, "Wrong language-specific RFQ bill route");
          assert.equal(actual.color, "rgb(18, 59, 52)", "Unreadable RFQ link label");
          assert.equal(actual.fill, "rgb(18, 59, 52)", "Unreadable RFQ link in Safari");
          assert.equal(actual.background, "rgb(227, 244, 235)", "RFQ link background");
          check(actual.height >= 44 && actual.width >= 44, "RFQ link touch target");
          check(actual.scroll <= actual.viewport + 12, "Tube calculator horizontal overflow");
          const styles = await copy.evaluate((element) => ({
            color: getComputedStyle(element).color,
            fill: getComputedStyle(element).webkitTextFillColor,
          }));
          assert.equal(styles.color, "rgb(255, 255, 255)", "Copy label must be white on dark");
          assert.equal(styles.fill, "rgb(255, 255, 255)", "Copy label Safari contrast");
          await calculator.screenshot({
            path: OUT + "/i18n7-calc-" + tube.locale + "-" + viewport.name + ".png",
            animations: "disabled",
          });
          console.log("I18N7 CHROME PASS", tube.locale, viewport.name);
        }
      }
      // WC7: physical wheel events over BOTH calculator panes must scroll the
      // document itself, not a trapped internal panel. Run on both locales,
      // desktop and a narrow mobile viewport.
      if (viewport.width === 390 || viewport.width === 1440) {
        for (const path of ["/knowledge/tubes", "/en/knowledge/tubes"]) {
          const response = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 50000 });
          assert.equal(response?.status(), 200, "WC7 tube page should load " + path);
          const calculator = page.locator("#calcolatore-pesi");
          await calculator.waitFor({ state: "visible" });
          for (const section of ["#calcolatore-pesi > div.grid > div", "#calcolatore-pesi aside"]) {
            const pane = page.locator(section);
            await pane.evaluate((element) => {
              element.scrollIntoView({ block: "start", behavior: "instant" });
              window.scrollBy({ top: -100, behavior: "instant" });
            });
            const scrollState = await pane.evaluate((element) => {
              const r = element.getBoundingClientRect();
              return { x: Math.round(Math.min(document.documentElement.clientWidth - 24, Math.max(24, r.left + 65))),
                y: Math.round(Math.min(window.innerHeight - 80, Math.max(120, r.top + 65))),
                overflowY: getComputedStyle(element).overflowY,
                scrollY: window.scrollY,
                documentHeight: document.documentElement.scrollHeight };
            });
            assert.notEqual(scrollState.overflowY, "auto", "WC7 unexpected inner scroll pane " + section);
            check(scrollState.documentHeight > viewport.height + scrollState.scrollY + 280,
              "WC7 test needs room to scroll below calculator pane: " + path + section);
            await page.mouse.move(scrollState.x, scrollState.y);
            await page.mouse.wheel(0, 260);
            await page.waitForTimeout(150);
            const after = await page.evaluate(() => window.scrollY);
            check(after > scrollState.scrollY + 30,
              "WC7 wheel did not scroll document " + JSON.stringify({ path, viewport: viewport.name,
                section, before: scrollState.scrollY, after, pos: scrollState }));
            console.log("WC7 DOCUMENT WHEEL PASS", viewport.name, path, section);
          }
        }
      }
      // CALC-UX1 — both locales: catalogue is secondary, readable and optional.
      if (viewport.width === 390 || viewport.width === 1440) {
        for (const entry of [
          {path:"/knowledge/tubes", locale:"it", summary:"Esplora riferimenti e fonti"},
          {path:"/en/knowledge/tubes", locale:"en", summary:"Explore references and sources"},
        ]) {
          const response = await page.goto(BASE + entry.path, {waitUntil:"domcontentloaded",timeout:50000});
          assert.equal(response?.status(),200,"CALC-UX1 public route");
          const catalog = page.locator('[data-testid="tube-reference-catalogue"]');
          await catalog.waitFor({state:"attached"});
          assert.equal(await catalog.evaluate(el => el.open),false,"Reference catalogue must start collapsed");
          const caption = page.locator("#tube-reference-heading");
          await caption.waitFor({state:"visible"});
          const title = await caption.innerText();
          check(!title.includes("pesi verificati"),"Incorrect public 'verified' heading");
          const summary = catalog.getByText(entry.summary,{exact:true});
          const style = await summary.evaluate(el => {
            const s=getComputedStyle(el);
            return {color:s.color,height:el.getBoundingClientRect().height,fill:s.webkitTextFillColor};
          });
          assert.equal(style.color,"rgb(18, 59, 52)","Reference summary text contrast");
          check(style.height>=44,"Reference disclosure touch target");
          await summary.click();
          assert.equal(await catalog.evaluate(el => el.open),true,"Catalogue did not expand");
          const input = catalog.getByRole("textbox");
          await input.waitFor({state:"visible"});
          const sourceRows = catalog.locator("tbody tr");
          const count = await sourceRows.count();
          check(count<=18,"Reference table exceeds the maximum preview limit");
          if(count>0){
            const first=sourceRows.first();
            check(await first.locator("a[href^='/knowledge/tubes/']").count()===1,"SEO detail link missing");
            check(await first.locator("a[target='_blank']").count()===1,"External provenance link missing");
          }
          const overflow=await page.evaluate(()=>({
            width:document.documentElement.clientWidth,
            scroll:document.documentElement.scrollWidth,
            escaped:document.body.innerText.includes(String.raw`\\n\\n`),
          }));
          check(!overflow.escaped,"CALC-UX1 literal escaped newlines remain");
          check(overflow.scroll<=overflow.width+12,"CALC-UX1 document horizontal overflow");
          await catalog.screenshot({path:OUT+"/calc-ux1-"+entry.locale+"-"+viewport.name+".png",animations:"disabled"});
          console.log("CALC-UX1 CHROME PASS",entry.locale,viewport.name,count);
        }
      }
      results.push(viewport.name);
    } finally {
      await context.close();
    }
  }
  // A consent telemetry ping can be blocked but never reaches any backend.
  console.log("HOME-SI5 WRITE REQUESTS ABORTED", writeAttempts);
  console.log("HOME-SI5 PASS", results.length, "responsive viewports, 2 axe runs, SEO, CTA, and privacy checks");
} finally {
  await browser.close();
}
