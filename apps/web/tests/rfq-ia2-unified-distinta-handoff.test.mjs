import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const routes = read("../lib/routes.ts");
const ia = read("../lib/workspace-information-architecture.ts");
const publicPage = read("../app/(public)/distinta/page.tsx");
const privatePage = read("../app/(workspace)/rfq-hub/distinta/page.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const wizard = read("../components/buyer-tube-guided-creator.tsx");
const login = read("../app/login/page.tsx");
const authActions = read("../app/login/actions.ts");
const sessionDraft = read("../lib/buyer-distinta-session-draft.ts");
const documents = read("../lib/buyer-distinta-documents.ts");

const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
}}).outputText;
const runtimeDraft = transpile(documents) + "\n" + transpile(sessionDraft)
  .replace(/^import .*buyer-distinta-documents.*\n/m, "");
const session = await import("data:text/javascript;base64," + Buffer.from(runtimeDraft).toString("base64"));

function sampleLine(id = "row1") {
  return { id, description:"Tubo quadro 100 × 100 × 5 mm", standard:"EN 10210",
    grade:"S355J2H", finish:"", quantityMode:"bars", quantity:"2",
    barLengthM:"12", weightKgM:"14,704", targetEurT:"", note:"" };
}
function sampleDraft() {
  return {title:"Acciai strutturali",lines:[sampleLine("r1"),{...sampleLine("r2"),standard:"EN 10219",weightKgM:"14,41"}],
    documents:{inspectionDocument:"3.1",ceDop:true,iso9001:false},
    guidedSpecsByLine:{r1:{family:"square_tube",standard:"EN 10210",grade:"S355J2H",
      diameter:"",side:"100",width:"",height:"",thickness:"5"}},
    selectedCatalog:{},
    wizardDraft:{family:"rectangular_tube",standard:"EN 10219",grade:"S275J0H",diameter:"",
      side:"",width:"120",height:"80",thickness:"4"}};
}

test("RFQ-IA2 uses one engine for public SEO and private Workspace with role enforcement", () => {
  assert.match(routes, /createDistinta: "\/rfq-hub\/distinta"/);
  assert.match(ia, /if \(isPath\(pathname, appRoutes\.rfqHub\.createDistinta\)\) return "rfq:distinta"/);
  assert.match(publicPage, /<BuyerDistintaBuilder/);
  assert.match(privatePage, /<BuyerDistintaBuilder/);
  assert.match(privatePage, /requireWorkspaceWriteRole\(appRoutes\.rfqHub\.home\)/);
  assert.match(privatePage, /catalogOptions=\{catalogOptions\}/);
  assert.match(publicPage, /canonical: absoluteUrl\("\/distinta"\)/);
  assert.match(privatePage, /robots: privateNoIndexRobots/);
  assert.match(login, /safeInternalNext/);
  assert.match(authActions, /nextPath && !isRegistrationNext\(nextPath\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(builder, /router\.push\(appRoutes\.rfqHub\.campaign\(result\.rfqId\)\)/);
});

test("RFQ-IA2 same-tab draft preserves mixed EN norms, global documents, wizard and 12m bars", () => {
  const input = sampleDraft();
  const serialized = session.serializeBuyerSessionDraft(input, Date.UTC(2026,9,8,16));
  assert.ok(serialized);
  const restored = session.parseBuyerSessionDraft(serialized, Date.UTC(2026,9,8,16)+1200);
  assert.deepEqual(restored.lines.map((x)=>x.standard), ["EN 10210","EN 10219"]);
  assert.deepEqual(restored.lines.map((x)=>x.barLengthM), ["12","12"]);
  assert.equal(restored.documents.inspectionDocument,"3.1");
  assert.equal(restored.guidedSpecsByLine.r1.thickness,"5");
  assert.equal(restored.wizardDraft.width,"120");
  assert.equal(restored.wizardDraft.standard,"EN 10219");
  assert.equal(restored.title,"Acciai strutturali");
  assert.notEqual(session.buyerDraftKey(null),session.buyerDraftKey("33333333-3333-3333-3333-333333333333"));
});

test("RFQ-IA2 expired/corrupt/malicious drafts fail closed without creating a server artifact", () => {
  const now=Date.UTC(2026,9,8,16);
  const serialized=session.serializeBuyerSessionDraft(sampleDraft(),now);
  assert.equal(session.parseBuyerSessionDraft(serialized,now+session.BUYER_DRAFT_TTL_MS+1),null);
  assert.equal(session.parseBuyerSessionDraft("{",now),null);
  assert.equal(session.parseBuyerSessionDraft("x".repeat(350001),now),null);
  const bad=JSON.parse(serialized);
  bad.version=2;
  assert.equal(session.parseBuyerSessionDraft(JSON.stringify(bad),now),null);
  bad.version=1;bad.lines[1].id=bad.lines[0].id;
  assert.equal(session.parseBuyerSessionDraft(JSON.stringify(bad),now),null);
  bad.lines=Array.from({length:501},(_,i)=>sampleLine("line"+i));
  assert.equal(session.parseBuyerSessionDraft(JSON.stringify(bad),now),null);
  assert.doesNotMatch(sessionDraft,/localStorage|sendBuyerDistinta|buyer_create_distinta_snapshot/);
  assert.match(builder,/sessionStorage/);
  assert.match(builder,/restoreCandidate/);
  assert.match(builder,/Riprendi la distinta/);
  assert.match(builder,/Scarta e crea nuova/);
});

test("RFQ-IA2 only preserves a tab's temporary draft, never supplier emails and never auto-sends", () => {
  assert.match(builder,/serializeBuyerSessionDraft\(\{/);
  assert.match(builder,/title, lines, documents, guidedSpecsByLine, selectedCatalog, wizardDraft: previewDraft/);
  assert.match(builder,/if \(!draftReady\) return;/);
  assert.match(builder,/onClick=\{persistBrowserDraft\}/);
  assert.match(builder,/encodeURIComponent\(appRoutes\.rfqHub\.createDistinta\)/);
  assert.match(builder,/window\.sessionStorage\.removeItem\(restoreCandidate\.key\)/);
  assert.match(builder,/window\.sessionStorage\.removeItem\(draftKey\)/);
  assert.doesNotMatch(sessionDraft,/recipientInput|emailMessage|emailSubject|marketplace\.publish/);
  assert.match(wizard,/initialDraft\?: GuidedTubeDraft \| null/);
  assert.match(builder,/setWizardRestoreSerial\(\(current\) => current \+ 1\)/);
  assert.match(builder,/key=\{wizardRestoreSerial\}/);
  assert.match(publicPage,/href=\{appRoutes\.rfqHub\.createDistinta\}/);
});
