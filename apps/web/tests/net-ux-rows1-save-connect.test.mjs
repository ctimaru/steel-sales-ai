import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const ui=read("../components/network-compact-experience.tsx");
const save=read("../components/network-save-toggle.tsx");

test("NET-UX-ROWS1 explains Salva vs Connetti above the list, only for users who can act in Pro",()=>{
  assert.match(ui,/\{accessMode==="pro"&&canCompose\?<NetworkSaveConnectGuide\/>:null\}/);
  const guide=ui.slice(ui.indexOf("function NetworkSaveConnectGuide"));
  assert.match(guide,/data-testid="network-save-connect-guide"/);
  assert.match(guide,/Le vedi solo tu e l’azienda non riceve nulla/);
  assert.match(guide,/può accettarla o rifiutarla/);
  assert.match(guide,/href="\/network\/saved"/);
  assert.match(guide,/href="\/network\/connections"/);
  assert.match(guide,/Possibile con le aziende già attive sulla piattaforma/);
});

test("NET-UX-ROWS1 Connetti states are visually distinct and keep their contracts",()=>{
  assert.match(ui,/<UserPlusIcon\/>Connetti\s*<\/Link>/);
  assert.match(ui,/border-dashed[^"]*"[^>]*>\s*<UserPlusIcon\/>Connetti/);
  assert.match(ui,/✓ Connessa/);
  assert.match(ui,/Richiesta inviata/);
  assert.match(ui,/data-testid="network-row-actions"/);
});

test("NET-UX-ROWS1 role tint on avatar and pill; saved rows highlighted",()=>{
  for(const key of ["producer","trader_distributor","processor_service_provider","end_user"])
    assert.match(ui,new RegExp(key+':"bg-\\[#'));
  assert.match(ui,/const tone=\(role&&roleTone\[role\.key\]\)\|\|neutralTone;/);
  assert.match(ui,/\(saved\?"bg-\[#fffbf2\] ":""\)/);
});

test("NET-UX-ROWS1 star save: SVG star filled when saved, label visible, still a no-JS server action",()=>{
  assert.match(save,/fill=\{saved \? "currentColor" : "none"\}/);
  assert.match(save,/saved \? "Salvata" : compact \? "Salva" : "Salva azienda"/);
  assert.match(save,/aria-pressed=\{saved\}/);
  assert.match(save,/action=\{saved \? removeSavedNetworkCompany : saveNetworkCompany\}/);
  assert.doesNotMatch(save,/"use client"/);
});
