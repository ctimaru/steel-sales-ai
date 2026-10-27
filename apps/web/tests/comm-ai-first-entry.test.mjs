import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const page=readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx",import.meta.url),"utf8");
test("Commerciale places a permission-gated AI entry ahead of daily actions without duplicating the RFQ builder",()=>{
  assert.match(page,/data-testid="commercial-ai-first"/);
  assert.match(page,/data-testid="commercial-ai-first-cta"/);
  assert.match(page,/Parla con l’assistente/);
  assert.match(page,/\?compose=1#commercial-ai-intake/);
  assert.ok(page.indexOf('data-testid="commercial-ai-first"') < page.indexOf('data-testid="commercial-compact-actions"'));
  assert.match(page,/\{canWrite \? \(\s*<section aria-labelledby="commercial-ai-first-heading"/);
  assert.equal((page.match(/<BuyerDistintaBuilder/g)||[]).length,1);
});
