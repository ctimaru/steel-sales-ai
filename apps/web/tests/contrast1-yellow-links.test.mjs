import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// CONTRAST1: globals.css has an unlayered `a { color: inherit }` that beats Tailwind's
// layered text utilities on links. Yellow links inside dark panels therefore inherited
// white (1.8:1). Every yellow link/anchor pins its dark ink inline.
const files=[
  "components/public-network-pro.tsx",
  "components/home-network-pro-card.tsx",
  "components/network-producers-entry.tsx",
  "components/network-pro-catalog.tsx",
  "components/network-producers-experience.tsx",
];
const INK=/style=\{\{ color: "#2a1c00", WebkitTextFillColor: "#2a1c00" \}\}/;

test("CONTRAST1 every yellow link pins dark ink inline",()=>{
  for(const f of files){
    const src=readFileSync(new URL("../"+f,import.meta.url),"utf8");
    const tags=[...src.matchAll(/<(Link|a)\b[^>]*bg-\[#f2b544\][^>]*>/g)].map(m=>m[0]);
    for(const tag of tags) assert.match(tag,INK,f+": "+tag.slice(0,90));
  }
});

test("CONTRAST1 toast link keeps its amber color on the dark toast",()=>{
  const src=readFileSync(new URL("../components/network-save-feedback.tsx",import.meta.url),"utf8");
  assert.match(src,/<Link href="\/network\/saved" style=\{\{ color: "#f2b544", WebkitTextFillColor: "#f2b544" \}\}/);
});
