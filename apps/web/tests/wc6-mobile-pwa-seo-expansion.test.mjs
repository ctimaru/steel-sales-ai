import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);
const denseStyles = fs.readFileSync(new URL("../components/calculator-dense-cockpit.module.css", import.meta.url), "utf8");
const cartStyles = fs.readFileSync(new URL("../components/technical-cart-shell.module.css", import.meta.url), "utf8");
const installGuide = fs.readFileSync(
  new URL("../components/calculator-install-guide.tsx", import.meta.url),
  "utf8",
);
const manifest = fs.readFileSync(
  new URL("../app/manifest.ts", import.meta.url),
  "utf8",
);
const iconRoute = fs.readFileSync(
  new URL("../app/pwa-icon/[size]/route.ts", import.meta.url),
  "utf8",
);
const rootLayout = fs.readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const calculatorPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);
const familyHub = fs.readFileSync(
  new URL("../components/public-tube-family-hub.tsx", import.meta.url),
  "utf8",
);
const sitemap = fs.readFileSync(
  new URL("../app/sitemap.ts", import.meta.url),
  "utf8",
);

test("WC6 manifest satisfies install icon and calculator shortcut contracts", () => {
  assert.match(manifest, /src: "\/pwa-icon\/192"/);
  assert.match(manifest, /sizes: "192x192"/);
  assert.match(manifest, /src: "\/pwa-icon\/512"/);
  assert.match(manifest, /sizes: "512x512"/);
  assert.match(manifest, /name: "Calcolatore peso tubo"/);
  assert.match(manifest, /#calcolatore-pesi/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(rootLayout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(rootLayout, /apple:/);
});

test("WC6 serves bounded PNG PWA icons", () => {
  assert.match(iconRoute, /ImageResponse/);
  assert.match(iconRoute, /new Set\(\[192, 512\]\)/);
  assert.match(iconRoute, /status: 404/);
  assert.match(iconRoute, /width: size, height: size/);
});

test("WC6 provides cross-platform Add to Home Screen guidance", () => {
  assert.match(installGuide, /display-mode: standalone/);
  assert.match(installGuide, /iPad\|iPhone\|iPod/);
  assert.match(installGuide, /Aggiungi alla schermata Home/);
  assert.match(installGuide, /Installa app/);
  assert.match(installGuide, /Nessun account richiesto/);
  assert.match(calculator, /<CalculatorInstallGuide locale=\{locale\} \/>/);
});

test("WC6 hardens one-hand mobile interaction without removing the desktop cockpit", () => {
  assert.match(calculator, /data-cockpit-workspace/);
  assert.match(denseStyles, /\.workspace \{grid-template-columns:minmax\(0,1\.25fr\) minmax\(340px,\.85fr\)/);
  assert.doesNotMatch(calculator, /overscroll-contain/);
  assert.doesNotMatch(calculator, /overflow-y-auto/);
  assert.match(cartStyles, /safe-area-inset-bottom/);
  assert.match(calculator, /min-h-11/);
  // CALC-UX uses a 44px mobile preset inside a single compact rail;
  // at desktop widths presets shrink to 36px to fit the measures panel.
  assert.match(calculator, /flex w-fit items-center gap-1\.5/);
  assert.match(calculator, /aria-label=\{t\("Lunghezza barra personalizzata"\)\}/);
  assert.match(calculator, /data-cockpit-length-quantity/);
  assert.match(denseStyles, /\.lengthQuantity \{grid-template-columns:minmax\(0,1\.15fr\) minmax\(170px,\.85fr\)/);
  assert.doesNotMatch(calculator, /lg:h-\[calc\(100svh-6\.75rem\)\]/);
});

test("WC6 turns the three existing family hubs into canonical SEO shape landings", () => {
  assert.match(familyHub, /Calcolo peso tubo tondo acciaio/);
  assert.match(familyHub, /Calcolo peso profilo quadro acciaio/);
  assert.match(familyHub, /Calcolo peso profilo rettangolare acciaio/);
  assert.match(familyHub, /calculatorFamilyBySlug/);
  assert.match(familyHub, /round_tube/);
  assert.match(familyHub, /square_tube/);
  assert.match(familyHub, /rectangular_tube/);
  assert.match(familyHub, /BreadcrumbList/);
  assert.match(familyHub, /WebApplication/);
  assert.match(familyHub, /Calcolo immediato/);
  assert.match(familyHub, /#calcolatore-pesi/);
});

test("WC6 strengthens calculator canonical structured data and sitemap discovery", () => {
  assert.match(calculatorPage, /isAccessibleForFree: true/);
  assert.match(calculatorPage, /featureList/);
  assert.match(calculatorPage, /BreadcrumbList/);
  assert.match(calculatorPage, /robotsForParameterizedPage/);
  assert.match(sitemap, /priority: 0\.92/);
  assert.match(sitemap, /priority: 0\.86/);
  assert.match(sitemap, /familyHubEntries/);
});
