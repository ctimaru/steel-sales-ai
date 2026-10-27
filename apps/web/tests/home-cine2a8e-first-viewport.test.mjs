import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css=readFileSync(new URL("../components/public-cinematic-hero.module.css",import.meta.url),"utf8");
const hero=readFileSync(new URL("../components/public-cinematic-hero.tsx",import.meta.url),"utf8");
test("CINE2A.8E mobile first fold prioritizes working calculator action",()=>{
 assert.match(css,/HOME-CINE2A\.8E/);
 assert.match(css,/@media \(max-width: 390px\)/);
 assert.match(css,/@media \(max-width: 359px\)/);
 assert.match(css,/\.actions \{ order: 2/);
 assert.match(hero,/href=\{links\.calculator\} className=\{styles\.primary\}/);
 assert.match(hero,/href=\{links\.builder\} className=\{styles\.secondary\}/);
 assert.match(hero,/className=\{styles\.quickLinks\}/);
 assert.doesNotMatch(css,/display:\s*none\s*!important;\s*\/\*\s*cookie/);
});
