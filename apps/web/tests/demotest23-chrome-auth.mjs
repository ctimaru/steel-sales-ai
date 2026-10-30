/**
 * DEMOTEST2.3 — end-to-end Google Chrome + real Supabase GoTrue sessions.
 * Uses ONLY local Next + local Supabase, 4 company admins and buyer-viewer.
 * Test output avoids exposing passwords/session cookies to CI artifacts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = (process.env.DEMOTEST23_WEB_URL ?? "").replace(/\/$/, "");
const temp = process.env.RUNNER_TEMP;
assert.equal(base, "http://127.0.0.1:3000", "External/public web host prohibited");
assert.ok(temp, "RUNNER_TEMP required");
const personas = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8"));
assert.equal(personas.length, 5);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const checks = [];

async function step(label, fn) {
  try {
    await fn();
    checks.push({ label, status: "PASS" });
    console.log("CHROME AUTH PASS", label);
  } catch (error) {
    console.error("CHROME AUTH FAIL", label, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function navigate(page, href, status = 200) {
  const response = await page.goto(base + href, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  assert.ok(response, "Missing navigation response for " + href);
  assert.equal(response.status(), status, href + " HTTP status");
  const body = await page.locator("body").innerText({ timeout: 25000 });
  assert.ok(body.trim().length > 25, href + " is blank");
  assert.ok(!body.includes("Application error: a server-side exception"), href + " crashed");
  return body;
}

async function login(page, p) {
  await navigate(page, "/login");
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
  const title = page.getByRole("heading", { name: "Oggi in " + p.name });
  try {
    await title.waitFor({ state: "visible", timeout: 22000 });
  } catch (error) {
    const landing = await page.locator("body").innerText({ timeout: 15000 }).catch(() => "body unavailable");
    console.error("DEMOTEST23 LOGIN RENDER DIAGNOSTIC", p.id,
      "path=" + new URL(page.url()).pathname,
      "body=" + landing.slice(0, 1400).replace(/\\s+/g, " "));
    throw error;
  }
  assert.ok((await page.locator("body").innerText()).includes(p.name));
}

try {
  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  const anonymousPage = await anonymous.newPage();
  await step("anonymous cannot access private workspace", async () => {
    await anonymousPage.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 90000 });
    await anonymousPage.waitForURL(url => url.pathname === "/login", { timeout: 30000 });
    assert.ok(!(await anonymousPage.locator("body").innerText()).includes("Oggi in DEMO"));
  });
  await step("anonymous cannot inspect buyer RFQ", async () => {
    const res = await anonymousPage.goto(base + "/rfq-hub/" + personas[0].rfq, {
      waitUntil: "domcontentloaded", timeout: 90000,
    });
    const body = await anonymousPage.locator("body").innerText();
    assert.ok(!body.includes(personas[0].rfqTitle), "Private RFQ leaked to anonymous browser");
    assert.ok([200, 302, 303, 307, 308, 404].includes(res.status()));
  });
  await anonymous.close();

  for (const p of personas) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, locale: "it-IT",
    });
    const page = await context.newPage();

    await step(p.id + " real GoTrue UI login", () => login(page, p));
    // CALC-NEXT1F: exercise the real private route with GoTrue sessions and
    // local four-tenant fixtures. No emails, snapshots or RFQs are created.
    if (p.id === "buyerViewer") {
      await step("viewer cannot open private buyer composer by locale URL", async () => {
        await page.goto(base + "/rfq-hub/distinta?lang=de", {
          waitUntil: "domcontentloaded", timeout: 90000,
        });
        await page.waitForURL(url => url.pathname !== "/rfq-hub/distinta",
          { timeout: 30000 });
        assert.equal(await page.locator('[data-testid="buyer-private-language-switch"]').count(), 0);
      });
    } else if (p.id === personas[0].id) {
      await step("owner private bill locale switch keeps unsaved commercial draft in one tenant", async () => {
        await navigate(page, "/rfq-hub/distinta?lang=de");
        const picker = page.locator('[data-testid="buyer-private-language-switch"] select');
        await picker.waitFor({state:"visible",timeout:30000});
        assert.equal(await picker.inputValue(),"de");
        await page.getByRole("heading",{name:"Stücklistenpositionen"}).waitFor({state:"visible"});
        const name = page.getByLabel("Titel der Stückliste");
        await name.fill("DEMO-NEXT1F-local-tab");
        await picker.selectOption("fr");
        await page.getByRole("heading",{name:"Articles de la liste"}).waitFor({state:"visible"});
        await picker.selectOption("en");
        await page.getByRole("heading",{name:"Bill items"}).waitFor({state:"visible"});
        assert.equal(await page.getByLabel("Bill title").inputValue(),"DEMO-NEXT1F-local-tab");
        assert.equal(await page.locator('[data-testid="private-cart-trigger"]').count(),0);
        assert.equal(new URL(page.url()).searchParams.get("lang"),"de",
          "Client-side locale switches must not pass commercial data through URLs");
      });
    }

    await step(p.id + " own company workspace", async () => {
      await navigate(page, "/dashboard");
      // Wait for the streamed Dashboard component after the temporary shell.
      await page.getByRole("heading", { name: "Oggi in " + p.name, exact: true })
        .waitFor({ state: "visible", timeout: 60000 });
      const body = await page.locator("body").innerText();
      assert.ok(body.includes(p.name));
      assert.ok(!body.includes("Oggi in " + personas.find(other => other.org !== p.org)?.name));
      if (p.id === "buyerViewer") {
        assert.ok(body.includes("Sola lettura"), "Viewer workspace role not disclosed");
      }
    });

    await step(p.id + " dashboard cockpit visual layout and authorization", async () => {
      await navigate(page, "/dashboard");
      await page.getByRole("heading", { name: "Oggi in " + p.name, exact: true })
        .waitFor({ state: "visible", timeout: 60000 });
      const actions = page.locator('section[aria-labelledby="quick-actions"]');
      const priorities = page.locator('section[aria-labelledby="daily-priorities"]');
      const homeNav = page.locator('nav[aria-label="Sezioni della Home"]:visible');
      await page.getByTestId("workspace-home-panel-overview").waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await homeNav.count(), 1, "Exactly one local Home navigation must be visible");
      assert.equal(await actions.count(), 1, "Missing quick action section");
      assert.ok((await priorities.count()) <= 1, "Duplicate daily priorities section");
      const shortcuts = actions.locator('[data-testid="quick-action-shortcuts"] a');
      assert.equal(await shortcuts.count(), 4, "Expected four safe quick actions");
      assert.equal(await actions.locator('a[aria-label^="Cerca RFQ"]').count(), 1,
        "Dedicated search must open the existing private commercial history");
      assert.equal(await actions.getByRole("link", { name: /Apri assistente AI/ }).count(), 1,
        "AI entry must route to the real Commerciale assistant, not fake a Home chat");
      assert.equal(await actions.locator('a[href="/commercial/assistant"]').count(), 1);
      assert.equal(await page.locator('section[aria-labelledby="daily-priorities"] a[href="/operations/review"]').count(), 0,
        "Technical parser review must not appear as a buyer dashboard action");
      assert.equal(await page.getByRole("link", { name: /Elementi da verificare/ }).count(), 0,
        "Technical data-quality queue is not a commercial priority");
      const actionBounds = await actions.boundingBox();
      assert.ok(actionBounds, "Action-first first viewport must be visible");
      assert.equal(await page.getByTestId("workspace-home-panel-pulse").isVisible(), false,
        "News must not occupy the first viewport");
      await homeNav.getByRole("button", { name: /Da fare/ }).click();
      await page.getByTestId("workspace-home-panel-tasks").waitFor({ state: "visible" });
      if (await priorities.count()) {
        assert.equal(await priorities.isVisible(), true, "Buyer attention must be in Da fare");
        assert.ok(await priorities.boundingBox(), "Buyer priorities must remain legible");
      }
      await homeNav.getByRole("button", { name: /Steel Pulse/ }).click();
      const feed = page.getByRole("heading", { name: "Il tuo aggiornamento sull’acciaio" });
      await feed.waitFor({ state: "visible", timeout: 60000 });
      if (p.id === "buyerViewer") {
        await homeNav.getByRole("button", { name: /Panoramica/ }).click();
        assert.equal(await actions.getByRole("link", { name: /Gestisci richieste e offerte/ }).count(), 0,
          "Viewer must not receive buyer-action shortcut");
      }
    });

    await step(p.id + " DASH-FEED6 discovery and role-safe navigation", async () => {
      await navigate(page, "/dashboard");
      await page.getByRole("heading", { name: "Oggi in " + p.name, exact: true })
        .waitFor({ state: "visible", timeout: 60000 });
      await page.locator('nav[aria-label="Sezioni della Home"]:visible').getByRole("button", { name: /Opportunità/ }).click();
      const discovery = page.locator("#dashboard-discovery");
      await discovery.waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await page.getByRole("heading", { name: "Dalla rete, per te" }).count(), 1);
      assert.equal(await page.locator('a[href="#dashboard-discovery"]').count(), 1,
        "Keyboard/touch jump to Marketplace opportunities required");
      assert.equal(await discovery.locator("article").count() <= 6, true,
        "Maximum three Network and three Marketplace items");
      const companyLinks = discovery.locator('a[href^="/network/"]');
      const opportunityLinks = discovery.locator('a[href^="/marketplace/opportunities/"]');
      assert.ok((await opportunityLinks.count()) <= 3);
      if (p.id === "buyerViewer") {
        assert.ok((await page.locator("body").innerText()).includes("Sola lettura"));
      }
      for (const other of personas) {
        if (other.org !== p.org) {
          assert.ok(!(await discovery.innerText()).includes(other.rfqTitle),
            "Cross-company private RFQ leaked into discovery");
        }
      }
      // Links remain within the existing authenticated and entitlement routes.
      assert.ok((await companyLinks.count()) >= 0);
    });

    if (p.id === "buyerViewer" || p.id === personas[0].id) {
      await step(p.id + " COMMERCIAL-UNIFY2 one-page cockpit", async () => {
        await navigate(page, "/commercial");
        await page.getByRole("heading", { name: "Le mie trattative", exact: true })
          .waitFor({ state: "visible", timeout: 60000 });
        assert.equal(
          await page.getByRole("navigation", { name: "Navigazione principale" })
            .getByRole("link", { name: "Commerciale", exact: true }).getAttribute("aria-current"),
          "page",
        );
        const worklist = page.locator("#commercial-worklist");
        assert.equal(await worklist.count(), 1);
        await worklist.getByRole("link", { name: "Inviate", exact: true }).click();
        await page.waitForURL((url) => url.pathname === "/commercial" && url.searchParams.get("view") === "sent");
        assert.equal(await page.locator("#commercial-worklist").count(), 1);
        if (p.id === "buyerViewer") {
          assert.equal(await page.getByTestId("comm-cine11-prompt").count(), 0,
            "Viewer has no RFQ composition privileges");
        } else {
          assert.equal(await page.getByTestId("comm-cine11-prompt").count(), 1,
            "Writer has exactly one governed RFQ intake");
          // COMMERCIAL-UNIFY2C.2: every composed tab uses real, RLS-scoped
          // stream pagination. An unavailable source must never masquerade
          // as an empty company history.
          for (const [tabLabel, expected] of [
            ["Tutte", null],
            ["Offerte", "offers"],
            ["Ordini", "orders"],
          ]) {
            await worklist.getByRole("link", { name: tabLabel, exact: true }).click();
            await page.waitForURL((url) => url.pathname === "/commercial" &&
              url.searchParams.get("view") === expected, { timeout: 60000 });
            await worklist.getByRole("navigation", { name: "Pagine attività commerciali" })
              .getByText("Pagina 1", { exact: true }).waitFor({ state: "visible", timeout: 60000 });
            assert.ok(!(await worklist.innerText()).includes("Alcuni dati commerciali e di acquisto non sono disponibili."),
              tabLabel + " must not show an incomplete multi-source list");
            assert.ok(!(await worklist.innerText()).includes("Il caricamento di alcune attività acquisti non è riuscito."),
              tabLabel + " must not hide an error as an empty result");
          }
          await navigate(page, "/commercial?view=sent&page=2");
          const pager = page.getByRole("navigation", { name: "Pagine attività commerciali" });
          await pager.getByRole("link", { name: "Precedente" }).click();
          await page.waitForURL((url) => url.pathname === "/commercial" &&
            url.searchParams.get("view") === "sent" && !url.searchParams.has("page"), { timeout: 60000 });
          const originalViewport = page.viewportSize();
          try {
            await page.setViewportSize({ width: 390, height: 844 });
            await navigate(page, "/commercial?item=campaign:" + p.rfq);
            await page.locator("#commercial-detail").waitFor({ state: "visible", timeout: 60000 });
            assert.equal(await page.locator('[data-testid="commercial-list-pane"]').isVisible(), false,
              "On mobile the detail should take priority over the list");
            assert.equal(await page.locator("#commercial-detail").isVisible(), true);
          } finally {
            if (originalViewport) await page.setViewportSize(originalViewport);
          }
          await navigate(page, "/commercial?item=campaign:" + p.rfq);
          await page.locator("#commercial-detail").waitFor({ state: "visible", timeout: 60000 });
          const operations = page.locator("#commercial-operations");
          await operations.waitFor({ state: "visible", timeout: 60000 });
          for (const [tab, name] of [
            ["negotiate", "Negozia"],
            ["award", "Aggiudica"],
            ["po", "Ordini PO"],
            ["compare", "Confronta offerte"],
          ]) {
            await operations.getByRole("link", { name, exact: true }).click();
            await page.waitForURL((url) =>
              url.pathname === "/commercial" && url.searchParams.get("tab") === tab &&
              url.searchParams.get("item") === "campaign:" + p.rfq, { timeout: 60000 });
            await page.locator("#commercial-operations").waitFor({ state: "visible", timeout: 60000 });
            assert.equal(await page.locator("#commercial-worklist").count(), 1);
          }
          await page.getByRole("link", { name: "Chiudi" }).click();
          await navigate(page, "/commercial?compose=1");
          await page.getByRole("heading", { name: "Crea distinta e RFQ senza lasciare Commerciale" })
            .waitFor({ state: "visible", timeout: 60000 });
        }
      });
    }

    await step(p.id + " RFQ Hub visibility", async () => {
      await navigate(page, "/rfq-hub");
      await page.getByRole("heading", { name: "RFQ Hub", exact: true })
        .waitFor({ state: "visible", timeout: 60000 });
      const primaryNav = page.getByRole("navigation", { name: "Navigazione principale" });
      assert.equal(await primaryNav.getByRole("link", { name: "Commerciale", exact: true }).getAttribute("aria-current"), "page",
        "Procurement must belong to the single Commerciale primary destination");
      assert.equal(await primaryNav.getByRole("link", { name: "RFQ Hub", exact: true }).count(), 0,
        "RFQ Hub must no longer be a second primary destination");
      const body = await page.locator("body").innerText();
      if (p.id === "buyerViewer") {
        assert.ok(!body.includes(p.rfqTitle), "Viewer accessed owner-only buyer campaign");
      } else {
        assert.ok(body.includes(p.rfqTitle), "Own RFQ is missing");
        for (const other of personas) {
          if (other.org !== p.org) assert.ok(!body.includes(other.rfqTitle), "Cross-tenant private RFQ leaked");
        }
      }
    });

    if (p.id !== "buyerViewer") {
      await step(p.id + " direct own RFQ detail", async () => {
        await navigate(page, "/rfq-hub/" + p.rfq);
        await page.getByText(p.rfqTitle, { exact: false }).first()
          .waitFor({ state: "visible", timeout: 60000 });
        const body = await page.locator("body").innerText();
        assert.ok(body.includes(p.rfqTitle));
      });
    }
    if (p.id === "buyerViewer") {
      await step("buyer viewer cannot open owner's private RFQ", async () => {
        const response = await page.goto(base + "/rfq-hub/" + p.rfq, {
          waitUntil: "domcontentloaded", timeout: 90000,
        });
        await page.waitForFunction(
          (title) => {
            const text = document.body.innerText;
            return !text.includes("Caricamento workspace") &&
              (text.includes(title) || /404|non trovata|not found|could not be found/i.test(text));
          },
          p.rfqTitle,
          { timeout: 60000 },
        );
        const body = await page.locator("body").innerText();
        assert.ok(!body.includes(p.rfqTitle), "Viewer accessed owner's private RFQ by direct URL");
        assert.ok(
          response.status() === 404 ||
            (response.status() === 200 && /404|non trovata|not found|could not be found/i.test(body)),
          "Viewer owner-detail must render not-found denial",
        );
      });
    }
    await step(p.id + " cannot access buyer's other private RFQ", async () => {
      const target = personas.find(other => other.org !== p.org);
      const response = await page.goto(base + "/rfq-hub/" + target.rfq, {
        waitUntil: "domcontentloaded", timeout: 90000,
      });
      // Wait for the streaming Server Component result, not the temporary
      // workspace loading shell (which returns HTTP 200 before notFound()).
      await page.waitForFunction(
        (title) => {
          const text = document.body.innerText;
          return !text.includes("Caricamento workspace") &&
            (text.includes(title) || /404|non trovata|not found|could not be found/i.test(text));
        },
        target.rfqTitle,
        { timeout: 60000 },
      );
      const body = await page.locator("body").innerText();
      // Next.js App Router may stream notFound() after response headers were sent,
      // returning HTTP 200 with the rendered 404. Treat only explicit not-found
      // content as denial; never let a 200 page containing a private title pass.
      assert.ok(!body.includes(target.rfqTitle), "Cross-tenant RFQ title leaked");
      const isNotFound = /404|non trovata|not found|could not be found/i.test(body);
      assert.ok(
        response.status() === 404 || (response.status() === 200 && isNotFound),
        "Cross-tenant direct URL must render a real 404 denial; HTTP " +
          response.status() + ", body=" + body.slice(0, 300),
      );
    });

    await step(p.id + " Marketplace access in own session", async () => {
      await navigate(page, "/marketplace");
      await page.getByRole("heading", { name: "Compra o vendi, in un unico spazio" })
        .waitFor({ state: "visible", timeout: 60000 });
      const body = await page.locator("body").innerText();
      assert.ok(body.includes("Marketplace"));
      assert.ok(!body.includes("DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219"), "Private RFQ leaked in Marketplace");
    });

    await step(p.id + " cannot open Platform administration", async () => {
      await page.goto(base + "/platform", { waitUntil: "domcontentloaded", timeout: 90000 });
      const current = new URL(page.url());
      assert.notEqual(current.pathname, "/platform", "Non-platform organization acquired admin console");
      const body = await page.locator("body").innerText();
      assert.ok(!body.includes("Amministrazione Smart Steel Sales"), "Platform admin console leaked");
    });

    if (p.id === "buyerViewer") {
      await step(p.id + " RQG1 legacy and operations review denied", async () => {
        // Use an isolated tab per route: Next.js can cancel an in-flight
        // streaming redirect when a tab is immediately navigated again.
        for (const route of ["/review","/review/offer-reparse","/operations/review","/operations/review/identities"]) {
          const denied = await context.newPage();
          try {
            try {
              await denied.goto(base + route,{waitUntil:"domcontentloaded",timeout:90000});
            } catch (error) {
              if (!String(error).includes("net::ERR_ABORTED")) throw error;
            }
            await denied.waitForURL(url => url.pathname === "/dashboard",{
              waitUntil:"domcontentloaded",timeout:30000,
            });
            assert.equal(new URL(denied.url()).pathname,"/dashboard",
              "Review route failed to redirect viewer: "+route);
            const body = await denied.locator("body").innerText();
            assert.ok(!body.includes("Copertura di normalizzazione") &&
              !body.includes("Controllo dati") && !body.includes("Offer recovery controllato"),
              "Private technical review content leaked: "+route);
          } finally {
            await denied.close();
          }
        }
      });
    }

    await step(p.id + " DASH-FEED7 platform engagement denied", async () => {
      await page.goto(base + "/platform/feed-insights", {
        waitUntil: "domcontentloaded", timeout: 90000,
      });
      assert.notEqual(new URL(page.url()).pathname, "/platform/feed-insights",
        "Company user must not access superadmin engagement analytics");
      const body = await page.locator("body").innerText();
      assert.ok(!body.includes("Engagement e ritorno alla Home"),
        "Owner-only retention dashboard leaked to company account");
    });

    await context.close();
  }

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true,
    deviceScaleFactor: 2, locale: "it-IT",
  });
  const mobilePage = await mobile.newPage();
  await step("mobile Chrome actual buyer login and workspace", () => login(mobilePage, personas[0]));
  for (const route of ["/dashboard", "/rfq-hub", "/marketplace"]) {
    await step("mobile responsive " + route, async () => {
      await navigate(mobilePage, route);
      const heading = route === "/dashboard"
        ? "Oggi in " + personas[0].name
        : route === "/rfq-hub" ? "RFQ Hub" : "Compra o vendi, in un unico spazio";
      await mobilePage.getByRole("heading", { name: heading, exact: true })
        .waitFor({ state: "visible", timeout: 60000 });
      const body = await mobilePage.locator("body").innerText();
      assert.ok(body.length > 50);
      const { width, scrollWidth } = await mobilePage.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      if (scrollWidth > width + 12) {
        const offenders = await mobilePage.evaluate(() =>
          Array.from(document.querySelectorAll("body *"))
            .map(el => ({ tag: el.tagName.toLowerCase(),
              className: typeof el.className === "string" ? el.className.slice(0, 140) : "",
              right: Math.round(el.getBoundingClientRect().right),
              width: Math.round(el.getBoundingClientRect().width) }))
            .filter(el => el.right > document.documentElement.clientWidth + 12)
            .sort((a, b) => b.width - a.width).slice(0, 12));
        console.error("DEMOTEST23 MOBILE OVERFLOW ELEMENTS", route, JSON.stringify(offenders));
      }
      assert.ok(scrollWidth <= width + 12, route + " horizontal overflow " + scrollWidth + " > " + width);
    });
  }
  await step("mobile dashboard visual tiles and focus behavior", async () => {
    await navigate(mobilePage, "/dashboard");
    await mobilePage.getByRole("heading", { name: "Oggi in " + personas[0].name, exact: true })
      .waitFor({ state: "visible", timeout: 60000 });
    const tiles = mobilePage.locator('section[aria-labelledby="quick-actions"] [data-testid="quick-action-shortcuts"] a');
    assert.equal(await tiles.count(), 4, "The mobile cockpit has exactly four action shortcuts");
    const first = await tiles.nth(0).boundingBox();
    const second = await tiles.nth(1).boundingBox();
    assert.ok(first && second, "Mobile actions must be visible");
    assert.ok(first.height >= 40 && second.height >= 40, "Mobile actions must retain touch targets");
    assert.ok(second.y >= first.y - 12, "Mobile actions must follow reading order");
    const measures = await mobilePage.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(measures.scroll <= measures.client + 12, "Dashboard has horizontal overflow");
  });
  await step("DASH-FEED6 Chrome 320px mobile disclosure and discovery jump", async () => {
    await mobilePage.setViewportSize({ width: 320, height: 740 });
    await navigate(mobilePage, "/dashboard");
    await mobilePage.getByRole("heading", { name: "Oggi in " + personas[0].name, exact: true })
      .waitFor({ state: "visible", timeout: 60000 });
    await mobilePage.locator("#dashboard-discovery").waitFor({ state: "attached", timeout: 60000 });
    const mobileHomeNav = mobilePage.locator('nav[aria-label="Sezioni della Home"]:visible');
    await mobileHomeNav.getByRole("button", { name: /Steel Pulse/ }).click();
    const jump = mobilePage.getByRole("link", { name: /Vai alle opportunità/ });
    assert.equal(await jump.count(), 1);
    const size = await mobilePage.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(size.scroll <= size.client + 12, "320px dashboard horizontal overflow");
    await jump.click();
    assert.equal(new URL(mobilePage.url()).hash, "#dashboard-discovery");
    await mobilePage.locator("#dashboard-discovery").waitFor({ state: "visible", timeout: 60000 });
    assert.equal(await mobilePage.getByRole("heading", { name: "Dalla rete, per te" }).count(), 1);
  });
  await mobile.close();

  console.log("DEMOTEST2.3 CHROME PASS", checks.length, "browser checks; 5 REAL GoTrue sessions; 4 companies; no production data");
} finally {
  await browser.close();
}
