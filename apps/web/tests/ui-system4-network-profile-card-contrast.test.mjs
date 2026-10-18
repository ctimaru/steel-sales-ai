import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cards = readFileSync(new URL("../components/network-launch-discovery.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("discovered company profile CTAs use semantic primary button rather than raw dark green", () => {
  assert.match(cards, /actionClasses\(\{ variant: "default", size: "sm" \}\)/);
  assert.doesNotMatch(cards, /bg-\[#173f35\][^"]*text-white">Apri profilo/);
  assert.match(cards, /Esplora azienda/);
});
test("semantic primary action forces white foreground including Safari", () => {
  const style = css.match(/\.ui-action-primary\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(style, /color:\s*#ffffff\s*!important/);
  assert.match(style, /-webkit-text-fill-color:\s*#ffffff\s*!important/);
});
