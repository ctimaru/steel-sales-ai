import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../components/commercial-unified-worklist.tsx",import.meta.url),"utf8");
test("smart deal cards show title, counterpart context, status, date and accessible open navigation",()=>{
  assert.match(src,/data-testid="commercial-smart-deal-card"/);
  assert.match(src,/itemType\(item\)/);
  assert.match(src,/item\.origin/);
  assert.match(src,/item\.title/);
  assert.match(src,/item\.subtitle/);
  assert.match(src,/item\.status/);
  assert.match(src,/formatHubDate\(item\.at\)/);
  assert.match(src,/Apri →/);
  assert.match(src,/aria-current=\{item\.key === active\?\.key \? "true" : undefined\}/);
  assert.match(src,/href=\{route\(view, query, item\.key/);
  assert.match(src,/data-testid="commercial-list-pane"/);
});
