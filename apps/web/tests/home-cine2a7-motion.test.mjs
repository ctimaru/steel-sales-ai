import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const hero=fs.readFileSync(new URL("../components/public-cinematic-hero.module.css",import.meta.url),"utf8");
const gallery=fs.readFileSync(new URL("../components/home-cinematic-tools.module.css",import.meta.url),"utf8");
const jsx=fs.readFileSync(new URL("../components/public-cinematic-hero.tsx",import.meta.url),"utf8");
test("CINE2A.7 ambient motion is off for compact, touch and reduced-motion users",()=>{
 assert.match(hero,/HOME-CINE2A\.7/);
 assert.match(hero,/max-width: 1023px/);
 assert.match(hero,/hover: none/);
 assert.match(hero,/prefers-reduced-motion: reduce/);
 assert.match(hero,/prefers-reduced-data: reduce/);
 assert.match(gallery,/pointer: coarse/);
 assert.match(gallery,/prefers-reduced-motion: reduce/);
});
test("CINE2A.7 keeps accessible static primary action and no duplicate demo CTA",()=>{
 assert.match(jsx,/Norme e pesi/);
 assert.match(jsx,/href=\{links\.calculator\} className=\{styles\.primary\}/);
 assert.doesNotMatch(jsx,/className=\{styles\.hintCta\}/);
 assert.match(hero,/:focus-visible/);
});
