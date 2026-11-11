/**
 * COMM-AI-NATIVE1.D — deterministic industry matching.
 * Only published Network rows may enter this module. No LLM-generated claims.
 * A Network product label is never proof that a particular size is produced.
 */
import type { CommercialAiNativeEntities } from "@/lib/commercial-ai-native-intent";
import type { NetworkSearchItem } from "@/lib/network";

export type IndustryRole = "producer" | "trader_distributor" | "processor_service_provider" | "end_user";
export type IndustryRequest = {
  role: IndustryRole;
  country: string | null;
  tubes: boolean;
  entities: CommercialAiNativeEntities;
  missing: string[];
};
export type TechnicalClaim = {
  verification_status: string;
  provenance_kind: string;
};
export type ScopeProduct = {
  key: string;
  relationship_type: string;
  facility_id: string | null;
  standards: (TechnicalClaim & { code: string })[];
  grades: (TechnicalClaim & { designation: string; standard_code?: string })[];
  dimensions: (TechnicalClaim & { dimension_type: string; min_mm: number; max_mm: number })[];
};
export type IndustryEvidence = {
  label: string;
  provenance: string;
  verification: string;
};
export type IndustryCompany = {
  id: string;
  name: string;
  country: string;
  role: IndustryRole;
  roleLabel: string;
  match: "documented" | "potential";
  reasons: IndustryEvidence[];
  missing: string[];
  sourceUrl: string;
  sourceLabel: string;
  evidenceDate: null;
};
export type IndustryLookupResult = {
  companies: IndustryCompany[];
  examined: number;
  totalCandidates: number;
  limited: boolean;
  restricted: boolean;
  technicalScopeUnavailable: boolean;
};

const TUBE_FAMILIES = new Set(["tubes_pipes", "hollow_sections"]);
const ROLES: Record<IndustryRole, string> = {
  producer: "Produttore censito",
  trader_distributor: "Commerciante / distributore",
  processor_service_provider: "Terzista / centro servizi",
  end_user: "Utilizzatore industriale",
};

export function parseIndustryRequest(question: string, entities: CommercialAiNativeEntities, missing: string[]): IndustryRequest {
  const text = question.normalize("NFKC").toLocaleLowerCase("it-IT");
  const role: IndustryRole =
    /carpenteri|terzist|lavorazion|service center|processor|subcontract|fabbricazion[ei]\s+metallic/i.test(text)
      ? "processor_service_provider"
      : /commerciant|distribut|rivenditor|stockist|stockholder|chi\s+vende|who\s+sells|dealer/i.test(text)
        ? "trader_distributor"
        : /utilizzator|end.user|customer|buyer\s+industr/i.test(text)
          ? "end_user"
          : "producer";
  const countries: [RegExp, string][] = [
    [/\b(italia|italian[iaoe]|italy)\b/i, "IT"],
    [/\b(romania|romeni[ao]|romanian)\b/i, "RO"],
    [/\b(germania|german[yo]|deutschland)\b/i, "DE"],
    [/\b(francia|france|french)\b/i, "FR"],
    [/\b(spagna|spain|spanish)\b/i, "ES"],
  ];
  const country = countries.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  const tubes = /tub[oi]|pipes?|hollow|hss|[ø⌀]|diametr|\b(?:en\s*10219|en\s*10210|astm\s*a500)\b/i.test(text) ||
    entities.diameterMm !== null;
  return { role, country, tubes, entities, missing };
}

function roleRelationship(role: IndustryRole, type: string): boolean {
  if (role === "producer") return type === "produces";
  if (role === "trader_distributor") return type === "distributes" || type === "stocks";
  if (role === "processor_service_provider") return type === "processes";
  return true;
}
function clean(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function gradeMatches(requested: string, actual: string): boolean {
  const a = clean(actual), q = clean(requested);
  // Generic S355 can match S355J2H; specific S355J2H must not match S355JR.
  return q.length === 4 ? a.startsWith(q) : a === q;
}
function inRange(target: number, d: { min_mm: number; max_mm: number }): boolean {
  return Number.isFinite(target) && Number(d.min_mm) <= target && target <= Number(d.max_mm);
}
type ScopeAssessment = { mismatch: boolean; reasons: IndustryEvidence[]; missing: string[] };
function assessProduct(product: ScopeProduct, req: IndustryRequest): ScopeAssessment {
  const reasons: IndustryEvidence[] = [];
  const missing: string[] = [];
  const add = (label: string, claim: TechnicalClaim) => {
    reasons.push({ label, provenance: claim.provenance_kind, verification: claim.verification_status });
  };
  const standard = req.entities.standard;
  if (standard) {
    const found = (product.standards ?? []).find(x => clean(x.code) === clean(standard));
    if (found) add("Norma " + found.code, found);
    else if ((product.standards ?? []).length) return { mismatch: true, reasons: [], missing: [] };
    else missing.push("norma");
  }
  const grade = req.entities.grade;
  if (grade) {
    const known = product.grades ?? [];
    const sameGrade = known.filter(x => gradeMatches(grade, x.designation));
    // Grade evidence must belong to the requested standard; a record for
    // another norm cannot prove EN 10219 compatibility.
    const found = standard
      ? sameGrade.find(x => x.standard_code && clean(x.standard_code) === clean(standard))
      : sameGrade[0];
    if (found) add("Acciaio " + found.designation, found);
    else if (known.length && (!sameGrade.length ||
      sameGrade.every(x => x.standard_code && clean(x.standard_code) !== clean(standard ?? ""))))
      return { mismatch: true, reasons: [], missing: [] };
    else missing.push("grado associato alla norma");
  }
  const dimensions = product.dimensions ?? [];
  for (const [target, field, label] of [
    [req.entities.diameterMm, "outer_diameter", "Ø esterno"],
    [req.entities.thicknessMm, "wall_thickness", "Spessore"],
  ] as const) {
    if (target === null) continue;
    const relevant = dimensions.filter(x => x.dimension_type === field);
    const found = relevant.find(x => inRange(target, x));
    if (found) add(label + " " + target + " mm nell’intervallo censito " + found.min_mm + "–" + found.max_mm + " mm", found);
    else if (relevant.length) return { mismatch: true, reasons: [], missing: [] };
    else missing.push(label.toLocaleLowerCase("it-IT"));
  }
  return { mismatch: false, reasons, missing };
}

/** Returns null only for explicit role/product mismatch or scoped contradictory data. */
export function rankIndustryCompany(
  company: NetworkSearchItem,
  request: IndustryRequest,
  scopes: ScopeProduct[] | null,
): IndustryCompany | null {
  if (!company.roles.some(x => x.key === request.role)) return null;
  if (request.country && company.country_code !== request.country &&
      !(company.facility_countries ?? []).includes(request.country)) return null;
  const products = company.products.filter(p => !request.tubes || TUBE_FAMILIES.has(p.key));
  if (request.tubes && !products.length) return null;
  if (request.tubes && !products.some(p => roleRelationship(request.role, p.relationship_type))) return null;
  // No technical scope access is NOT a negative assertion.
  const relevant = (scopes ?? []).filter(p =>
    (!request.tubes || TUBE_FAMILIES.has(p.key)) && roleRelationship(request.role, p.relationship_type)
  );
  const assessments = relevant.map(p => assessProduct(p, request));
  const accepted = assessments.filter(x => !x.mismatch).sort((a, b) =>
    b.reasons.length - a.reasons.length || a.missing.length - b.missing.length
  );
  const best = accepted[0];
  if (relevant.length && !best) return null;
  const supplied = [
    request.entities.standard, request.entities.grade,
    request.entities.diameterMm, request.entities.thicknessMm,
  ].filter(x => x !== null).length;
  const documented = Boolean(best && supplied > 0 && !request.missing.length &&
    best.reasons.length === supplied && best.reasons.every(r =>
      r.provenance && r.provenance !== "unknown" && r.verification && r.verification !== "rejected"
    ));
  const source = "/network/" + encodeURIComponent(company.id);
  return {
    id: company.id,
    name: company.trading_name?.trim() || company.legal_name,
    country: company.country_code,
    role: request.role,
    roleLabel: ROLES[request.role],
    match: documented ? "documented" : "potential",
    reasons: best?.reasons ?? [],
    missing: [...new Set([...(request.missing ?? []), ...(best?.missing ?? [])])].slice(0, 4),
    sourceUrl: source,
    sourceLabel: "Scheda pubblicata nel Network",
    // Source observed_at is not exposed by p3_7e; never invent it.
    evidenceDate: null,
  };
}

export function rankIndustryResults(
  candidates: NetworkSearchItem[],
  request: IndustryRequest,
  scoped: Record<string, ScopeProduct[] | null>,
  max = 6,
): IndustryCompany[] {
  return candidates.flatMap(c => {
    const match = rankIndustryCompany(c, request, scoped[c.id] ?? null);
    return match ? [match] : [];
  }).sort((a, b) =>
    Number(b.match === "documented") - Number(a.match === "documented") ||
    b.reasons.length - a.reasons.length ||
    a.name.localeCompare(b.name, "it")
  ).slice(0, max);
}
