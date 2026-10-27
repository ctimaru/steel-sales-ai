import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const tsx=fs.readFileSync(new URL("../components/home-cinematic-tools.tsx",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../components/home-cinematic-tools.module.css",import.meta.url),"utf8");
test("CINE2A.8D five decorative previews, no invented commercial data",()=>{
 for(const n of ["01","02","03","04","05"]) assert.ok(tsx.includes('kind === "'+n+'"'));
 assert.match(tsx,/aria-hidden="true"/);
 assert.match(tsx,/<ProductMiniature kind=\{tool.number\}/);
 assert.doesNotMatch(tsx,/fetch\(|useEffect\(|useState\(/);
 assert.match(css,/\.miniCalculator/);
 assert.match(css,/\.miniBill/);
 assert.match(css,/\.miniNetwork/);
 assert.match(css,/\.miniInbox/);
 assert.match(css,/\.miniKnowledge/);
 assert.match(css,/@media\(max-width:560px\)/);
});
