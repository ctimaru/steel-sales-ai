import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const calc = readFileSync(new URL("../components/calculator-inline-distinta-experience.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../components/rfq-hub-create-from-snapshot.tsx", import.meta.url), "utf8");

test("UI-SYSTEM3C: calculator and RFQ CTA use semantic action variants", () => {
  for (const source of [calc, hub]) {
    assert.match(source, /import \{ actionClasses \} from "@\/components\/ui\/button"/);
    assert.match(source, /actionClasses\(\{ variant: "default"/);
  }
  assert.match(calc, /actionClasses\(\{ variant: "secondary"/);
  assert.doesNotMatch(calc, /bg-\[#(?:176647|166346)\]/);
  assert.doesNotMatch(hub, /platform-primary inline-flex/);
});
test("UI-SYSTEM3C: RFQ behavior and conversion flow are preserved", () => {
  assert.match(calc, /createPrivateRfqOneStep/);
  assert.match(calc, /createBuyerRfqCampaign/);
  assert.match(calc, /trackCalculatorFunnel/);
  assert.match(hub, /createBuyerRfqCampaign\(distintaId\)/);
  assert.match(hub, /router\.push\(appRoutes\.rfqHub\.campaign/);
});
