import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const action=read("../app/(italian)/(workspace)/network/save-actions.ts");
const toggle=read("../components/network-save-toggle.tsx");
const feedback=read("../components/network-save-feedback.tsx");
const events=read("../lib/network-save-events.ts");
const count=read("../lib/network-saved-count.ts");
const layout=read("../app/(italian)/(workspace)/layout.tsx");
const shell=read("../components/app-shell.tsx");
const nav=read("../components/workspace-navigation.tsx");
const savedPage=read("../app/(italian)/(workspace)/network/saved/page.tsx");
const freeProfile=read("../components/free-network-profile.tsx");
const directory=read("../components/network-compact-experience.tsx");
const css=read("../app/globals.css");

test("NET-SAVE-INLINE1 one server writer: no redirect, same checks, idempotent, analytics kept",()=>{
  assert.match(action,/^"use server";/);
  assert.doesNotMatch(action,/redirect\(/);
  assert.match(action,/UUID\.test\(companyId\)/);
  assert.match(action,/if \(!canWriteWorkspace\(context\.role\)\) return \{ ok: false, saved: !save, reason: "forbidden" \}/);
  assert.match(action,/if \(!access\?\.can_access_network\) return \{ ok: false, saved: !save, reason: "locked" \}/);
  assert.match(action,/onConflict: "organization_id,user_id,network_company_id", ignoreDuplicates: true/);
  assert.match(action,/\.eq\("organization_id", context\.organizationId\)\s*\.eq\("user_id", userId\)\s*\.eq\("network_company_id", companyId\)/);
  assert.match(action,/after\(\(\) => recordPilotUsageEvent\(\{\s*eventName: save \? "network_saved_created" : "network_saved_removed"/);
  // NET-SAVE-INLINE1B: any revalidation re-renders the whole current route in the action response (~3 s).
  assert.doesNotMatch(action,/revalidatePath|revalidateTag|auth\.getUser/);
  assert.match(action,/const userId = context\.userId;/);
  assert.match(count,/^import "server-only";/);
});

test("NET-SAVE-INLINE1 button: optimistic, latest intent wins, rollback + error event, sync by company",()=>{
  assert.match(toggle,/^"use client";/);
  assert.doesNotMatch(toggle,/<form|saveNetworkCompany|removeSavedNetworkCompany/);
  assert.match(toggle,/type="button"/);
  assert.match(toggle,/intent\.current = next;\s*setSaved\(next\);/);
  assert.match(toggle,/if \(intent\.current !== wanted\) \{[\s\S]*?send\(intent\.current\);/);
  assert.match(toggle,/emitNetworkSaveError\(\{ companyId, name, wanted, reason: result\.reason \}\)/);
  assert.match(toggle,/if \(!detail \|\| detail\.companyId !== companyId\) return;/);
  assert.match(toggle,/motion-reduce:transition-none/);
});

test("NET-SAVE-INLINE1 toast: polite live region, Annulla re-runs the writer, Vedi Salvate link",()=>{
  assert.match(feedback,/aria-live="polite"/);
  assert.match(feedback,/detail\.origin !== "click"/);
  assert.match(feedback,/toggleNetworkSavedCompany\(detail\.companyId, !detail\.saved, detail\.surface\)/);
  assert.match(feedback,/origin: "undo"/);
  assert.match(feedback,/href="\/network\/saved"/);
  assert.match(css,/@keyframes sss-toast-in/);
  assert.match(shell,/\{networkEnabled \? <NetworkSaveToaster \/> : null\}/);
  assert.match(events,/networkSaveErrorMessage/);
});

test("NET-SAVE-INLINE1 Salvate counter: server total for entitled users, live updates, hidden on failure",()=>{
  assert.match(layout,/if \(networkEntitled\) networkSavedCount = await countNetworkSavedCompanies\(context\.organizationId, context\.userId\)/);
  assert.match(shell,/savedCount=\{networkSavedCount\}/);
  assert.match(nav,/item\.contextKey === "network:saved" && savedCount !== undefined \? <NetworkSavedCountBadge initial=\{savedCount\} \/>/);
  assert.match(feedback,/if \(count === null\) return null;/);
});

test("NET-SAVE-INLINE1 surfaces: directory, saved page rows collapse, free profiles get the offer",()=>{
  assert.match(directory,/surface="network_directory" compact\/>/);
  assert.match(savedPage,/<NetworkSavedRow key=\{company\.id\} companyId=\{company\.id\}>/);
  assert.match(savedPage,/surface="network_saved_companies"/);
  assert.match(feedback,/setTimeout\(\(\) => setMounted\(false\), 320\)/);
  assert.match(freeProfile,/canSave && accessMode==="pro" \? <NetworkSaveToggle/);
  assert.match(freeProfile,/data-testid="network-save-upsell"/);
  assert.match(freeProfile,/Salva · incluso in Network PRO/);
});
