import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

const navigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);
const home = fs.readFileSync(
  new URL("../app/(platform)/platform/page.tsx", import.meta.url),
  "utf8",
);
const queue = fs.readFileSync(
  new URL("../app/(platform)/platform/knowledge/page.tsx", import.meta.url),
  "utf8",
);
const detail = fs.readFileSync(
  new URL(
    "../app/(platform)/platform/knowledge/[type]/[id]/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(platform)/platform/knowledge/actions.ts", import.meta.url),
  "utf8",
);
const accessContract = fs.readFileSync(
  new URL("../lib/platform-access-contract.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260928201500_sa7_knowledge_operations_delegation_cutover.sql",
    import.meta.url,
  ),
  "utf8",
);

test("SA7 exposes Knowledge Operations through knowledge.read_drafts", () => {
  assert.match(
    platformIa,
    /key: "knowledge"[\s\S]*?access: \{ kind: "permission", key: "knowledge\\.read_drafts" \}/,
  );
  assert.match(home, /canReadKnowledge/);
  assert.match(
    home,
    /context\.permissions\.includes\("knowledge\.read_drafts"\)/,
  );
  assert.match(home, /getPlatformKnowledgeQueue/);
  assert.match(home, /Knowledge Operations/);
});

test("SA7 route and detail resolve the effective Knowledge capability set", () => {
  assert.match(queue, /requirePlatformPermission\("knowledge\.read_drafts"\)/);
  assert.match(detail, /requirePlatformPermission\("knowledge\.read_drafts"\)/);

  for (const permission of [
    "knowledge.edit",
    "knowledge.review",
    "knowledge.publish",
    "knowledge.quality_audit",
  ]) {
    assert.match(
      queue,
      new RegExp(
        "permissions\\.includes\\(\"" +
          permission.replaceAll(".", "\\.") +
          "\"\\)",
      ),
    );
  }

  assert.match(detail, /canEdit/);
  assert.match(detail, /canReview/);
  assert.match(detail, /canPublish/);
  assert.match(detail, /pagina pubblica/);
  assert.match(detail, /knowledge\.publish/);
});

test("SA7 Server Actions recheck exact permissions", () => {
  assert.match(
    actions,
    /saveKnowledgeDraft[\s\S]*?requirePlatformPermission\("knowledge\.edit"\)/,
  );
  assert.match(
    actions,
    /submitKnowledgeReview[\s\S]*?requirePlatformPermission\("knowledge\.edit"\)/,
  );
  assert.match(
    actions,
    /reviewKnowledgeDraft[\s\S]*?requirePlatformPermission\("knowledge\.review"\)/,
  );
  assert.match(
    actions,
    /publishKnowledgePage[\s\S]*?requirePlatformPermission\("knowledge\.publish"\)/,
  );
  assert.doesNotMatch(actions, /requirePlatformSuperadmin/);
  assert.doesNotMatch(actions, /requirePlatformContext/);
});

test("SA7 registers Knowledge mutations in the platform capability contract", () => {
  for (const pair of [
    ["saveKnowledgeDraft", "knowledge.edit"],
    ["submitKnowledgeReview", "knowledge.edit"],
    ["reviewKnowledgeDraft", "knowledge.review"],
    ["publishKnowledgePage", "knowledge.publish"],
  ]) {
    assert.match(
      accessContract,
      new RegExp(
        pair[0] +
          ': "' +
          pair[1].replaceAll(".", "\\.") +
          '"',
      ),
    );
  }
});

test("SA7 isolates draft content from the live public copy", () => {
  assert.match(migration, /draft_payload jsonb/);
  assert.match(migration, /workflow_status text/);
  assert.match(migration, /Knowledge draft is frozen while in review/);
  assert.match(
    migration,
    /sa7_save_knowledge_draft_impl[\s\S]*?draft_payload=v_payload[\s\S]*?workflow_status='draft'/,
  );
  assert.doesNotMatch(
    migration.match(
      /create or replace function private\.sa7_save_knowledge_draft_impl[\s\S]*?\$function\$;/,
    )?.[0] ?? "",
    /set seo_title=v_payload|set intro=v_payload/,
  );
  assert.match(
    migration,
    /approved Knowledge review required before publication/,
  );
  assert.match(
    migration,
    /sa7_publish_knowledge_page_impl[\s\S]*?seo_title=v_payload->>'seo_title'[\s\S]*?page_status='published'/,
  );
});

test("SA7 enforces read/edit/review/publish/quality capabilities in Postgres", () => {
  for (const permission of [
    "knowledge.read_drafts",
    "knowledge.edit",
    "knowledge.review",
    "knowledge.publish",
    "knowledge.quality_audit",
  ]) {
    assert.match(
      migration,
      new RegExp(
        "require_platform_permission\\('" +
          permission.replaceAll(".", "\\.") +
          "'\\)",
      ),
    );
  }

  assert.match(migration, /knowledge_draft_saved/);
  assert.match(migration, /knowledge_review_submitted/);
  assert.match(migration, /knowledge_draft_approved/);
  assert.match(migration, /knowledge_changes_requested/);
  assert.match(migration, /knowledge_page_published/);
  assert.match(migration, /knowledge_page_unpublished/);
});

test("SA7 preserves the K2-K8 public contracts rather than replacing them", () => {
  assert.doesNotMatch(
    migration,
    /create or replace function public\.k2_public_knowledge_/,
  );
  assert.doesNotMatch(
    migration,
    /grant select[\s\S]*?steel_knowledge_(standard|grade)_pages[\s\S]*?authenticated/i,
  );
  assert.match(migration, /public\.k8_knowledge_seo_quality_audit\(\)/);
  assert.match(
    migration,
    /Knowledge editorial tables must remain inaccessible directly to browser roles/,
  );
});
