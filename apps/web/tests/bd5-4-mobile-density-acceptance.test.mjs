import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const qa = css.slice(css.indexOf("/* BD5.4 QA follow-up"));
test("BD5.4 viewport audits keep 44px controls at tablet width too", () => {
  assert.match(qa, /@media \(min-width: 641px\) and \(max-width: 820px\)/);
  assert.match(qa, /\.bd54-page input:not\(\[type="checkbox"\]\)/);
  assert.match(qa, /font-size: 16px/);
  assert.match(qa, /min-height: 44px/);
  assert.match(qa, /\.bd6-suggestion, \.bd6-choice, \.bd6-add-button/);
});

test("BD5.4 mobile row stays in two header strips and three form strips", () => {
  assert.match(qa, /@media \(max-width: 430px\)/);
  assert.match(qa, /grid-template-areas:\s*"number description description status"\s*"norm norm grade grade"/);
  assert.match(qa, /grid-template-columns: minmax\(0, 0\.75fr\) minmax\(0, 1fr\) auto/);
  assert.match(qa, /\.bd8-tonnes \{\s*grid-column: 1;/);
  assert.match(qa, /\.bd52-details-toggle \{\s*grid-column: 2;/);
  assert.match(qa, /\.bd5-row-actions \{\s*grid-column: 3;/);
  assert.match(qa, /width: 44px;/);
});
