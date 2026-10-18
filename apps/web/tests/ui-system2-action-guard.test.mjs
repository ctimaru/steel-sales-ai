import test from "node:test";
import assert from "node:assert/strict";
import { contrastIssues, addedFilesDiff } from "../scripts/check-action-contrast.mjs";

test("UI-SYSTEM2 rejects dark text on solid green action", () => {
  assert.equal(contrastIssues('<button className="bg-[#1f6b5a] text-black px-4">Save</button>').length, 1);
  assert.equal(contrastIssues('<a className="bg-[var(--brand-primary)] text-[#123b34]">Open</a>').length, 1);
});
test("UI-SYSTEM2 retains valid inverse and light actions", () => {
  assert.deepEqual(contrastIssues('<button className="bg-[#1f6b5a] text-white">Save</button>'), []);
  assert.deepEqual(contrastIssues('<button className="bg-white text-[#123b34]">Cancel</button>'), []);
  assert.deepEqual(contrastIssues('<button className="ui-action-primary">Save</button>'), []);
});
test("UI-SYSTEM2 checks only changed TSX application surfaces", () => {
  const diff = '+++ b/apps/web/components/new-button.tsx\n+<button className="bg-[#1f6b5a] text-black">Save</button>\n+++ b/apps/web/tests/example.test.mjs\n+some fixture';
  const files = addedFilesDiff(diff);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, "apps/web/components/new-button.tsx");
});
