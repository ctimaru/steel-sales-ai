/**
 * SCHOOL-CONTENT1.D — deterministic, source-bound routing to the four
 * curated public comparison guides. No LLM, tenant memory, network or prompt
 * submission: the question is inspected only in the local browser.
 */
import { getSchoolComparison } from "./school-content1c-guides.mjs";

const code10210 = /\ben\s*[- ]?\s*10210\b/i;
const code10219 = /\ben\s*[- ]?\s*10219\b/i;
const inspection = /\ben\s*[- ]?\s*10204\b|\bcertificat[oi]\s*(?:di controllo\s*)?3[.,][12]\b|\bdocument[oi]\s*(?:di controllo|en 10204)\b|\brapporto di prova\b/i;
const theoreticalMass = /\bpeso\s+teoric[oaie]\b|\bmassa\s+teoric[oaie]\b|\btolleranz[ae]\b|\bkg\s*\/\s*m\b|\bmetri\s+(?:in|e)\s+tonnellate\b/i;
const welded = /\bsaldat[oiiae]\b|\bwelded\b|\berw\b|\bhfi\b/i;
const seamless = /\bseamless\b|\bsenza\s+saldatur[ae]\b/i;
const compare = /\bdifferenz[ae]\b|\bconfront(?:a|o|are)\b|\boppure\b|\bvs\.?\b|\bmeglio\b/i;

export function getSchoolProfessorComparison(id) {
  if (typeof id !== "string" || id.length > 80) return null;
  return getSchoolComparison(id);
}

export function matchSchoolProfessorComparison(question) {
  if (typeof question !== "string") return null;
  const text = question.trim().slice(0, 500);
  if (text.length < 4) return null;
  let id = null;
  if (code10210.test(text) && code10219.test(text)) id = "en-10210-vs-en-10219";
  else if (inspection.test(text)) id = "documenti-en-10204";
  else if (theoreticalMass.test(text)) id = "tolleranze-peso-teorico";
  else if (welded.test(text) && seamless.test(text) && !/\bcome\s+si\s+(?:produc|fabbric)/i.test(text)) id = "saldato-vs-seamless";
  else if (compare.test(text) && (welded.test(text) || seamless.test(text))) id = "saldato-vs-seamless";
  return id ? getSchoolProfessorComparison(id) : null;
}
