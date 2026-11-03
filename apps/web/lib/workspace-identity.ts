/**
 * HOME-FIRSTRUN1B: presentation-only helpers for how the Home names the company.
 *
 * - workspaceGreeting: Italian time-of-day greeting for the Home title.
 * - organizationNameMatchesPerson: true when the workspace name is just the
 *   registrant's personal name (e.g. a test account or a mistyped ragione
 *   sociale). It is a soft hint only: a ditta individuale legitimately carries
 *   the owner's name, so this never blocks setup or changes any state.
 *
 * Kept free of runtime imports so it can be unit-tested in isolation.
 */

const COMPANY_FORM_TOKENS = new Set([
  // Italy
  "srl", "srls", "spa", "sapa", "snc", "sas", "scarl", "scrl", "coop", "cooperativa",
  "societa", "soc", "consorzio", "ditta", "gruppo", "group", "holding", "industrie", "industria",
  // Common EU / international forms
  "ltd", "limited", "plc", "llc", "inc", "corp", "gmbh", "kg", "ohg", "ug", "ag",
  "sarl", "eurl", "sl", "sll", "bv", "nv", "oy", "oyj", "ab", "sro", "spzoo", "kft",
]);

function nameTokens(value: string | null | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "S.r.l." → "srl", "S.p.A." → "spa" before splitting on other punctuation.
    .replace(/\./g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function organizationNameMatchesPerson(
  organizationName: string | null | undefined,
  personName: string | null | undefined,
): boolean {
  const company = nameTokens(organizationName);
  const person = nameTokens(personName);
  // A single word ("Mario") is too weak a signal to comment on.
  if (person.length < 2 || company.length !== person.length) return false;
  if (company.some((token) => COMPANY_FORM_TOKENS.has(token))) return false;
  const remaining = [...person];
  for (const token of company) {
    const index = remaining.indexOf(token);
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return remaining.length === 0;
}

export function workspaceGreeting(now: Date = new Date(), timeZone = "Europe/Rome"): "Buongiorno" | "Buonasera" {
  let hour = now.getUTCHours();
  try {
    const parts = new Intl.DateTimeFormat("it-IT", { hour: "numeric", hourCycle: "h23", timeZone }).formatToParts(now);
    const value = Number(parts.find((part) => part.type === "hour")?.value);
    if (Number.isFinite(value)) hour = value;
  } catch {
    // Unknown time zone: fall back to UTC hours rather than failing the Home.
  }
  return hour >= 5 && hour < 18 ? "Buongiorno" : "Buonasera";
}
