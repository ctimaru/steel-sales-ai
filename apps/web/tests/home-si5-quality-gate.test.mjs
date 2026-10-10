import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const chrome = read("./home-si5-chrome-visual-qa.mjs");
const workflow = read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");

test("HOME-SI5 runs real Chrome visual/SEO/WCAG audit in disposable CI without Vercel build", () => {
  assert.match(workflow, /HOME-SI5 Chrome visual \/ WCAG \/ SEO acceptance/);
  assert.match(workflow, /node tests\/home-si5-chrome-visual-qa\.mjs/);
  assert.match(workflow, /home-si5-public-visual-qa/);
  assert.match(workflow, /playwright@1\.56\.1/);
  assert.match(workflow, /@axe-core\/playwright@4\.10\.2/);
  assert.doesNotMatch(workflow, /vercel deploy|vercel --prod|deploy --force/);
  assert.match(chrome, /mobile-320/);
  assert.match(chrome, /mobile-390/);
  assert.match(chrome, /tablet-768/);
  assert.match(chrome, /desktop-1440/);
  assert.match(chrome, /axe\.violations/);
  assert.match(chrome, /screenshot/);
  assert.match(chrome, /robots\.txt/);
  assert.match(chrome, /sitemap\.xml/);
  assert.match(chrome, /getByRole/);
  assert.match(chrome, /route\.abort\(\)/);
  assert.match(home, /export const dynamic = "force-static"/);
});
