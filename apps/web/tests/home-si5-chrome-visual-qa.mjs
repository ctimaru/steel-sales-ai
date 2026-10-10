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
