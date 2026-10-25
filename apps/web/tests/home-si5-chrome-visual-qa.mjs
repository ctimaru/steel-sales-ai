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
      await page.getByRole("heading", { name: /L.acciaio ha una nuova intelligenza/i }).waitFor();
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
        const sections = ["home-cinematic-title", "network", "intelligence", "aziende", "registrazione"];
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

      // HOME-CONV1A: a public calculator is the first action, even after scrolling.
      // Company sign-in/registration share one native, keyboard-accessible menu.
      const publicHeader = page.locator("header").first();
      const stickyCalculator = publicHeader.locator('[data-home-primary-cta]');
      const expectedCalculator = "/knowledge/tubes?source=home&surface=header#calcolatore-pesi";
      check(await stickyCalculator.count() === 1, "Persistent calculator CTA missing");
      check(await stickyCalculator.getAttribute("href") === expectedCalculator, "Header calculator destination changed");
      const hero = page.locator('section[aria-labelledby="home-cinematic-title"]');
      check(await hero.getByRole("link", { name: "Apri calcolatrice" }).getAttribute("href")
        === "/knowledge/tubes?source=home&surface=hero#calcolatore-pesi",
        "Hero calculator must be the first direct action");
      const publicDistinta = hero.getByRole("link", { name: "Crea una distinta gratis" });
      check(await publicDistinta.count() === 1, "No public builder second step");
      check(await publicDistinta.getAttribute("href") === "/distinta", "Builder CTA is not public");
      const account = publicHeader.locator('nav[aria-label="Area aziende"] details');
      const accountSummary = account.locator("summary");
      check(await accountSummary.count() === 1, "Area aziende access menu missing");
      await accountSummary.click();
      check(await account.locator('a[href="/login"]').count() === 1, "Company login menu item missing");
      check(await account.locator('a[href="/register"]').count() === 1, "Company registration menu item missing");
      await accountSummary.click();
      const language = publicHeader.locator('nav[aria-label="Seleziona lingua del sito"]');
      check(await language.count() === 1, "Compact locale selector missing");
      check(await language.locator("summary").innerText() === "IT", "Home locale should display compact IT code");
      await page.evaluate(() => window.scrollTo(0, 450));
      const stickyRect = await stickyCalculator.boundingBox();
      check(Boolean(stickyRect && stickyRect.y >= 0 && stickyRect.y < 90),
        viewport.name + " calculator action not sticky after scroll");
      await page.evaluate(() => window.scrollTo(0, 0));

      const networkLinks = await page.locator('a[href="/network"], a[href="/rfq-hub"], a[href="/platform"]').count();
      assert.equal(networkLinks, 0, "Public page must not link users into private data");
      // HOME-CINE1C: the industrial technical showcase must remain navigable
      // and safe at every viewport, without privileged RFQ/Network links.
      const geometryProof = page.locator("#steel-tools-proof");
      check(await geometryProof.count() === 1, viewport.name + " geometry proof missing");
      for (const family of ["CHS", "SHS", "RHS"]) {
        check(await geometryProof.getByText(family, { exact: true }).count() === 1,
          viewport.name + " missing public geometric family " + family);
      }
      check(await geometryProof.getByRole("link", { name: "Apri il calcolatore" }).getAttribute("href")
        === "/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi",
        "CINE1C calculator attribution changed");
      check(await geometryProof.getByRole("link", { name: "Crea una distinta" }).getAttribute("href")
        === "/distinta", "CINE1C builder must remain public");
      check(await page.locator("#registrazione").count() === 1,
        viewport.name + " existing IT trust section missing");

      if (viewport.width === 390 || viewport.width === 1440) {
        const english = await page.goto(BASE + "/en", { waitUntil: "domcontentloaded", timeout: 50000 });
        check(english?.status() === 200, "CINE1C English homepage unavailable");
        check(await page.locator("#steel-tools-proof").count() === 1, "CINE1C English product proof missing");
        const enHeader = page.locator("header").first();
        check(await enHeader.locator('[data-home-primary-cta]').getAttribute("href") === "/en/knowledge/tubes",
          "EN persistent calculator not linked to public English calculator");
        const enCompany = enHeader.locator('nav[aria-label="Company account"] details');
        await enCompany.locator("summary").click();
        check(await enCompany.locator('a[href="/en/login"]').count() === 1, "English sign-in missing");
        check(await enCompany.locator('a[href="/en/register"]').count() === 1, "English registration missing");
        await enCompany.locator("summary").click();
        check(await enHeader.locator('nav[aria-label="Choose website language"] summary').innerText() === "EN",
          "English locale must stay compact");
        check(await page.getByRole("heading", { name: "Your company. A governed workspace." }).count() === 1,
          "CINE1C English trusted access panel missing");
        check(await page.locator("#steel-tools-proof").getByRole("link", { name: "Open tube calculator" }).getAttribute("href")
          === "/en/knowledge/tubes", "CINE1C EN calculator route mismatch");
        const enOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(enOverflow <= 12, "CINE1C EN overflow: " + enOverflow);
        await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 50000 });
      }

      // HOME-CINE1D — ensure photographic composition never hides the action.
      const visualRhythm = await page.evaluate(() => {
        const title = document.getElementById("home-cinematic-title");
        const hero = title?.closest("section");
        const primary = hero?.querySelector('a[href="/distinta"]');
        const rect = title?.getBoundingClientRect();
        const action = primary?.getBoundingClientRect();
        const heroRect = hero?.getBoundingClientRect();
        return {
          headingWidth: Math.round(rect?.width || 0),
          headingRight: Math.round(rect?.right || 0),
          actionBottom: Math.round(action?.bottom || 0),
          actionWidth: Math.round(action?.width || 0),
          heroHeight: Math.round(heroRect?.height || 0),
          headingSize: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
        };
      });
      check(visualRhythm.headingWidth > 0 && visualRhythm.actionWidth >= 130,
        viewport.name + " hero typography or tool CTA lost: " + JSON.stringify(visualRhythm));
      if (viewport.width === 1440) {
        check(visualRhythm.headingSize <= 86 && visualRhythm.heroHeight <= 705,
          "CINE1D desktop composition regressed: " + JSON.stringify(visualRhythm));
      }
      if (viewport.width <= 390) {
        check(visualRhythm.headingSize <= 42 && visualRhythm.actionBottom <= viewport.height + 20,
          "CINE1D mobile first CTA not visible: " + JSON.stringify(visualRhythm));
      }

      // HOME-CINE1E: verify actual media-query selection at 320/390/768/1440.
      // Keep the 6KB poster on mobile/tablet; load the 47KB sharp version on desktop.
      const photoBackground = await page.locator('[data-home-cine-motion="photo"]').evaluate(
        (node) => getComputedStyle(node).backgroundImage
      );
      const photoWanted = viewport.width >= 1024
        ? "/home-cine1e-steel-desktop.webp"
        : "/home-cine1a-steel.webp";
      check(photoBackground.includes(photoWanted),
        "CINE1E missing expected responsive hero image at " + viewport.width);
      const photoForbidden = viewport.width >= 1024
        ? "/home-cine1a-steel.webp"
        : "/home-cine1e-steel-desktop.webp";
      check(!photoBackground.includes(photoForbidden),
        "CINE1E asset selection leaks extra image on " + viewport.width);

      const h1 = await page.locator("h1").count();
      assert.equal(h1, 1, "Homepage must have one H1");

      // HOME-CINE1B: verify the actual computed animations, not just source CSS.
      // This QA browser has reducedMotion='reduce' by default for screenshot determinism.
      const readCinematicMotion = () => page.locator('[data-home-cine-motion]').evaluateAll((nodes) =>
        nodes.map((node) => ({
          layer: node.getAttribute('data-home-cine-motion'),
          animation: window.getComputedStyle(node).animationName,
        }))
      );
      const quietMotion = await readCinematicMotion();
      check(quietMotion.length === 3, viewport.name + " is missing a cinematic layer");
      check(quietMotion.every((layer) => layer.animation === "none"),
        viewport.name + " failed reduced-motion gate: " + JSON.stringify(quietMotion));
      if (viewport.width === 1440) {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        const desktopMotion = await readCinematicMotion();
        check(desktopMotion.every((layer) => layer.animation !== "none"),
          "Desktop opt-in cinematics not present: " + JSON.stringify(desktopMotion));
        await page.emulateMedia({ reducedMotion: "reduce" });
        const restored = await readCinematicMotion();
        check(restored.every((layer) => layer.animation === "none"),
          "Cinematic motion remained after reduce: " + JSON.stringify(restored));
      }

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
          check(await calculator.locator('select option[value="en10219"]').count() === 1, "Missing shared standard control");
          // DENSE1A: copy and sharing are secondary actions behind an explicit disclosure.
          await calculator.locator("details[class*=\'group/extra\'] > summary").click();
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
            return { tag: anchor.tagName, disabled: anchor.hasAttribute("disabled"), color: style.color,
              fill: style.webkitTextFillColor, background: style.backgroundColor,
              width: box.width, height: box.height,
              viewport: document.documentElement.clientWidth,
              scroll: document.documentElement.scrollWidth };
          });
          assert.equal(actual.tag, "BUTTON", "RFQ transfer must be an explicit action");
          assert.equal(actual.disabled, false, "RFQ transfer must be enabled for valid data");
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
          // CALC-INT4.5: both IT and EN add to the same-page inline bill.
          // The draft intentionally survives a locale switch in the same tab.
          const previousCount=await page.evaluate(() => {
            try {
              return JSON.parse(sessionStorage.getItem("sss:inline-distinta:v1")||"null")?.lines?.length||0;
            } catch { return 0; }
          });
          for (let repeat = 0; repeat < 2; repeat++) {
            if (repeat) {
              await page.goto(BASE + tube.path, {waitUntil:"domcontentloaded",timeout:50000});
              await page.locator("#calcolatore-pesi").waitFor({state:"visible"});
            }
            const move=page.locator("#calcolatore-pesi .tube-calculator-rfq-link");
            await move.click();
            // The technical cart is now collapsed by default. Respect the
            // cookie overlay and explicitly open the visible buyer drawer.
            if (await page.locator('[data-testid="mobile-cookie-consent"] > button').isVisible())
              await page.locator('[data-testid="mobile-cookie-consent"] > button').click();
            await page.locator('[data-testid="calculator-cart-trigger"]').click();
            const inline=page.locator("#distinta-inline-dialog");
            await inline.locator("article").last().waitFor({state:"visible",timeout:20000});
            await page.waitForFunction(n=>document.querySelectorAll("#distinta-inline-dialog article").length===n,previousCount+repeat+1);
            await page.waitForFunction(()=>Boolean(sessionStorage.getItem("sss:inline-distinta:v1")));
            assert.equal(new URL(page.url()).pathname,tube.path,"Inline bill must not navigate");
            const target=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("sss:inline-distinta:v1")).lines);
            check(target.every(line=>line.targetEurT===""),"Inline bill must never persist commercial target");
            check(target.every(line=>line.grade===""),"Inline bill must not invent steel grade");
            console.log("CALC-INT4.5 IN-PLACE PASS",tube.locale,viewport.name,repeat+1);
            const queued=await page.evaluate(()=>sessionStorage.getItem("sss:calc-rfq-handoff:v1"));
            check(!queued || queued==="[]","Legacy RFQ handoff queue should remain empty");
          }
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
          // WC7 measures the wheel routing, not a minimum page length. With the
          // genuinely dense cockpit the document can be too short at 1440px.
          // Add a test-only inert tail so wheel behaviour remains measurable.
          await page.evaluate(() => {
            const spacer = document.createElement("div");
            spacer.setAttribute("data-wc7-scroll-fixture", "");
            spacer.style.cssText = "height:1600px;pointer-events:none";
            document.body.appendChild(spacer);
          });
          for (const section of ["#calcolatore-pesi [data-cockpit-fields]", "#calcolatore-pesi [data-cockpit-results]"]) {
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
          // One calculator-first UX for IT and EN: the technical appendix
          // starts closed in both locales, but is accessible on demand.
          const supplemental = page.locator('[data-testid="calculator-technical-disclosure"]');
          await supplemental.waitFor({state:"attached"});
          assert.equal(await supplemental.evaluate(el=>el.open),false,
            "Technical catalogue must start closed in every inline calculator");
          await supplemental.locator(":scope > summary").click();
          const caption = page.locator("#tube-reference-heading");
          await caption.waitFor({state:"visible"});
          const title = await caption.innerText();
          check(!title.includes("pesi verificati"),"Incorrect public 'verified' heading");
          const summary = catalog.locator("summary");
          check((await summary.innerText()).includes(entry.summary),"Reference summary label lost");
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
