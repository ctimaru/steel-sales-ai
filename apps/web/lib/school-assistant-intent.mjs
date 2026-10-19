/**
 * SCHOOL-UNIFY6A — small, deterministic intent extractor.
 * Interpret only explicit numbers/designations, never infer product suitability.
 * This is NOT an LLM and never reads customer documents.
 */
const standardPattern = /\ben\s*[- ]?\s*(10210|10219|10216\s*[- ]?2|10217\s*[- ]?[12]|10224)\b/gi;
const gradePattern = /\b(s355j2h|s355nlh|s355nh|p265gh|p235gh|16mo3|p235tr1|p235tr2|p265tr1|p265tr2)\b/gi;
const partialGradePattern = /\b(s235|s275|s355|p235|p265)\b/i;
const quantityPattern = /\b(\d{1,5})\s*(?:tubi|tubo|tubes?|tubos?|rohre|rohr|pezzi|pz|pieces?|bars?|barre|st[uü]ck|pi[eè]ces?)\b/i;
const lengthPattern = /\b(?:l\s*[:=]\s*|length\s*[:=]?\s*|lunghezza\s*[:=]?\s*|l[aä]nge\s*[:=]?\s*|longueur\s*[:=]?\s*|largo\s*[:=]?\s*|da\s+|de\s+|at\s+)?(\d+(?:[,.]\d+)?)\s*(?:m|metri|meters?|metres?|m[eè]tres?|metros?)\b(?!\s*m)/i;
const dimsPattern = /\b(\d+(?:[,.]\d+)?)\s*(?:x|×)\s*(\d+(?:[,.]\d+)?)(?:\s*(?:x|×)\s*(\d+(?:[,.]\d+)?))?\s*(?:mm)?\b/i;
const toNumber = value => {
  if (value == null) return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const norm = raw => "en" + raw.replace(/[^\d]/g, "");
const within = (value, min, max) => value !== undefined && value >= min && value <= max;
const familyPatterns = [
  ["rectangular_tube", /\b(?:rettangolar[ei]|rectangular|rhs|rechteck|rectangulaires?|rectangulares?)\b/i],
  ["square_tube", /\b(?:quadr[oi]|square|shs|vierkant|quadratisch|carr[eé]s?|cuadrad[oa]s?)\b/i],
  ["round_tube", /\b(?:tond[oi]|round|circular|chs|rund|ronds?|redond[oa]s?)\b/i],
];

/** Facts are deliberately incomplete when the input does not contain verified dimensions. */
export function parseSteelAssistantInput(input, previous = {}) {
  const text = String(input ?? "").trim().slice(0, 500);
  const foundStandards = [...text.matchAll(standardPattern)].map(m => norm(m[1]));
  const foundGrades = [...text.matchAll(gradePattern)].map(m => m[1].toUpperCase().replace("16MO3", "16Mo3"));
  const quantityMatch = text.match(quantityPattern);
  const lengthMatch = text.match(lengthPattern);
  const dimensions = text.match(dimsPattern);
  const family = familyPatterns.find(([, regex]) => regex.test(text))?.[0];
  const purpose = /\b(?:cerco|cercando|richiest[ae]|rfq|preventivo|offerta|need|looking|buy|quotation|quote|suche|anfrage|devis|cherche|busco|cotizaci[oó]n)\b/i.test(text)
    || Boolean(quantityMatch) ? "rfq" : "knowledge";
  const facts = { purpose };
  if (foundStandards.length) facts.standard = foundStandards[0];
  if (foundGrades.length) facts.grade = foundGrades[0];
  else {
    const partial = text.match(partialGradePattern);
    if (partial) facts.partialGrade = partial[1].toUpperCase();
  }
  if (family) facts.family = family;
  const familyForDimensions = family || previous.family;
  const count = toNumber(quantityMatch?.[1]);
  if (within(count, 1, 100000) && Number.isInteger(count)) facts.quantityBars = count;
  const len = toNumber(lengthMatch?.[1]);
  if (within(len, 0.05, 30)) facts.lengthM = len;
  if (familyForDimensions && dimensions) {
    const a = toNumber(dimensions[1]), b = toNumber(dimensions[2]), c = toNumber(dimensions[3]);
    if (familyForDimensions === "round_tube" && c === undefined && within(a, 5, 2000) && within(b, 0.1, 100) && b < a / 2) {
      facts.odMm = a; facts.thicknessMm = b;
    } else if (familyForDimensions === "square_tube" && within(a, 5, 2000)) {
      const thickness = c === undefined ? b : c;
      if ((c === undefined || a === b) && within(thickness, 0.1, 100) && thickness < a / 2) {
        facts.widthMm = a; facts.heightMm = a; facts.thicknessMm = thickness;
      }
    } else if (familyForDimensions === "rectangular_tube" && c !== undefined && within(a, 5, 2000) && within(b, 5, 2000) && within(c, 0.1, 100) && c < Math.min(a, b) / 2) {
      facts.widthMm = a; facts.heightMm = b; facts.thicknessMm = c;
    }
  }
  return { facts, codes: [...new Set([...foundStandards, ...foundGrades])].slice(0, 3) };
}

export function mergeSteelAssistantFacts(previous = {}, next = {}) {
  const clean = { ...previous };
  if (next.family && previous.family && next.family !== previous.family) {
    delete clean.odMm; delete clean.widthMm; delete clean.heightMm; delete clean.thicknessMm;
  }
  if (next.grade) delete clean.partialGrade;
  Object.entries(next).forEach(([key, value]) => { if (value !== undefined) clean[key] = value; });
  if (previous.purpose === "rfq") clean.purpose = "rfq";
  return clean;
}

export function missingSteelAssistantFields(facts) {
  if (facts.purpose !== "rfq") return [];
  const missing = [];
  if (!facts.standard) missing.push("standard");
  if (!facts.grade) missing.push("grade");
  if (!facts.family) missing.push("family");
  if (facts.family === "round_tube" && !facts.odMm) missing.push("dimensions");
  if ((facts.family === "square_tube" || facts.family === "rectangular_tube") && (!facts.widthMm || !facts.heightMm)) missing.push("dimensions");
  if (facts.family && !facts.thicknessMm) missing.push("thickness");
  if (!facts.quantityBars) missing.push("quantity");
  if (!facts.lengthM) missing.push("length");
  return missing;
}
export function hasCalculatorGeometry(facts) {
  if (!["en10210", "en10219"].includes(facts.standard)) return false;
  if (!facts.family || !facts.thicknessMm || !facts.lengthM || !facts.quantityBars) return false;
  return facts.family === "round_tube" ? Boolean(facts.odMm) : Boolean(facts.widthMm && facts.heightMm);
}
export function schoolAssistantEvidenceCodes(text, facts) {
  const direct = parseSteelAssistantInput(text).codes;
  if (direct.length) return direct.slice(0, 2);
  if (facts.standard) return [facts.standard];
  if (facts.grade) return [facts.grade];
  return [];
}
/** Only validated technical fields cross into the public calculator query. */
export function schoolAssistantCalculatorUrl(locale, facts) {
  if (!hasCalculatorGeometry(facts) || !["it", "en", "de", "fr", "es"].includes(locale)) return null;
  const qs = new URLSearchParams({
    standard: facts.standard, family: facts.family,
    thickness: String(facts.thicknessMm), length: String(facts.lengthM),
    quantity: String(facts.quantityBars), source: "school", surface: "school_section",
  });
  if (facts.family === "round_tube") qs.set("od", String(facts.odMm));
  else { qs.set("width", String(facts.widthMm)); qs.set("height", String(facts.heightMm)); }
  return (locale === "it" ? "/knowledge/tubes" : "/" + locale + "/knowledge/tubes") + "?" + qs.toString();
}
