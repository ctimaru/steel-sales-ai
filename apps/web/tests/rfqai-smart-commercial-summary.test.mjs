import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../components/rfq-ai-text-review.tsx", import.meta.url), "utf8");
test("RFQAI commercial summary displays verified inputs without inventing missing data", () => {
  for (const token of ["data-rfqai-commercial-summary", "Sintesi commerciale", "Geometria", "Norma", "Qualità", "Quantità", "Lunghezza barra", "Peso teorico", "Da definire", "Da verificare", "data-rfqai-summary-missing", "missingQuestions.length", "editable ? candidate.proposedLine.weightKgM", "setConfirmed((previous) => ({ ...previous, [candidate.candidateId]: false })", "disabled={!editable}"]) {
    assert.ok(source.includes(token), token);
  }
});
