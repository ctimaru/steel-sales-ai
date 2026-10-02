import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const feedback = read("../components/action-feedback.tsx");
const pendingButton = read("../components/pending-submit-button.tsx");
const registration = read("../app/register/registration-form.tsx");
const claim = read("../app/(workspace)/network/[id]/claim/page.tsx");
const marketplace = read("../components/marketplace-response-workspace.tsx");
const alerts = read("../app/(workspace)/alerts/operational-alert-actions.tsx");
const reviewConfirm = read("../components/review-confirm-form.tsx");
const reviewCorrect = read("../components/review-correct-form.tsx");
const identityConfirm = read("../components/identity-confirm-form.tsx");
const humanEvidence = read("../components/human-time-evidence-form.tsx");

test("HP14 defines shared pending and action-feedback contracts", () => {
  assert.match(pendingButton, /useFormStatus/);
  assert.match(pendingButton, /disabled=\{blocked\}/);
  assert.match(pendingButton, /aria-busy=\{pending\}/);

  assert.match(feedback, /export function ActionFeedback/);
  assert.match(feedback, /role=\{isError \? "alert" : "status"\}/);
  assert.match(feedback, /aria-live=\{isError \? "assertive" : "polite"\}/);
  assert.match(feedback, /aria-atomic="true"/);
});

test("HP14 protects high-frequency server-action forms from duplicate submission", () => {
  assert.match(registration, /PendingSubmitButton/);
  assert.doesNotMatch(registration, /useFormStatus/);
  assert.match(registration, /pendingLabel="Invio in corso…"/);

  assert.match(claim, /PendingSubmitButton/);
  assert.match(claim, /pendingLabel="Invio richiesta…"/);

  for (const label of [
    "Creazione bozza…",
    "Salvataggio bozza…",
    "Invio risposta…",
    "Ritiro bozza…",
    "Ritiro risposta…",
  ]) {
    assert.ok(marketplace.includes(label), "missing marketplace pending state " + label);
  }
});

test("HP14 gives action-state forms one accessible success/error feedback pattern", () => {
  for (const source of [reviewConfirm, reviewCorrect, identityConfirm, humanEvidence]) {
    assert.match(source, /ActionFeedback/);
  }

  assert.match(reviewConfirm, /pendingMessage="Salvataggio in corso…"/);
  assert.match(reviewCorrect, /pendingMessage="Salvataggio in corso…"/);
  assert.match(identityConfirm, /pendingMessage="Salvataggio, verifica consenso e attivazione in corso…"/);
  assert.match(humanEvidence, /pendingMessage="Salvataggio in corso…"/);
});

test("HP14 makes operational alert feedback stateful and accessible", () => {
  assert.match(alerts, /status: "success" \| "error"/);
  assert.match(alerts, /ActionFeedback/);
  assert.match(alerts, /pendingMessage="Operazione in corso…"/);
  assert.match(alerts, /result\.ok \? "success" : "error"/);
});
