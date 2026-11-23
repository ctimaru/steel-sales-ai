import type { GuidedTubeStandard } from "@/lib/buyer-tube-guidance";

/**
 * DISTINTA-SMART1 (founder decision, 23 Nov 2026): one box on /rfq-hub/distinta.
 * A size («quadro 100x100x5») is a catalog search; a request with quantities,
 * several sizes or several lines goes to the AI assistant. Pure, no I/O.
 */
export type SmartBoxIntent = "empty" | "search" | "ai";

const MEASURE = /\d+(?:[.,]\d+)?\s*[x×*]\s*\d+(?:[.,]\d+)?(?:\s*[x×*]\s*\d+(?:[.,]\d+)?)?/g;
// A number followed by a quantity unit («40 barre», «120 m», «2,5 t»), measures removed first.
const QUANTITY_UNIT = /(?:^|[^\w.,])\d+(?:[.,]\d+)?\s*(?:barre|barra|pz|pezzi|pezzo|tubi|tubo|ml|m|mt|metri|metro|t|ton|tonnellate|kg)(?![\p{L}\d])/u;
// «40 quadri», «25 tondi»: a count in front of a tube word.
const COUNT_BEFORE_ITEM = /(?:^|[^\w.,])\d+\s+(?:tub\p{L}*|quadr\p{L}*|tond\p{L}*|rett\p{L}*)/u;
const REQUEST_WORDS = /(?:^|\s)(?:cerco|cerchiamo|servono|serve|mi serv\p{L}*|vorrei|vorremmo|richiesta|richiedo|offerta|quotazione|preventivo|prezzo)(?![\p{L}])/u;
const GRADE = /(?:^|[^\p{L}\d])s\s?(235|275|355|420|460)\s?(jrh|j0h|j2h|k2h|nh|nlh|mh|mlh|jr|j0|j2|k2|h)?(?![\p{L}\d])/iu;
const STANDARD = /(?:^|[^\d])(?:en\s*)?(10210|10219)(?!\d)/i;

export function smartBoxIntent(text: string, aiAvailable: boolean): SmartBoxIntent {
  const value = text.trim();
  if (!value) return "empty";
  if (!aiAvailable) return "search";
  if (/\n/.test(value)) return "ai";
  const lower = value.toLocaleLowerCase("it");
  if ((lower.match(MEASURE) ?? []).length >= 2) return "ai";
  const withoutMeasures = lower.replace(MEASURE, " ");
  if (QUANTITY_UNIT.test(withoutMeasures) || COUNT_BEFORE_ITEM.test(withoutMeasures)) return "ai";
  if (REQUEST_WORDS.test(lower)) return "ai";
  if (value.length > 60) return "ai";
  return "search";
}

export type SmartBoxHints = { standard: GuidedTubeStandard | null; grade: string | null; query: string };

/**
 * Norm and grade written next to a size («quadro 100x100x5 S355J2H EN 10210»)
 * are applied to the article and removed from the catalog search terms.
 */
export function readSmartBoxHints(text: string): SmartBoxHints {
  let query = text;
  let grade: string | null = null;
  let standard: GuidedTubeStandard | null = null;
  const gradeMatch = query.match(GRADE);
  if (gradeMatch) {
    grade = ("S" + gradeMatch[1] + (gradeMatch[2] ?? "")).toUpperCase();
    query = query.replace(gradeMatch[0], " ");
  }
  const standardMatch = query.match(STANDARD);
  if (standardMatch) {
    standard = standardMatch[1] === "10210" ? "EN 10210" : "EN 10219";
    query = query.replace(standardMatch[0], " ");
  }
  return { standard, grade, query: query.replace(/\s+/g, " ").trim() };
}
