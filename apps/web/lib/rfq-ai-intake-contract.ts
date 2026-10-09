import { calculateBuyerDistintaLine, type BuyerDistintaDraftLine, type BuyerQuantityMode } from "@/lib/buyer-distinta";
import { guidedTubeMassKgM, type GuidedTubeFamily, type GuidedTubeStandard } from "@/lib/buyer-tube-guidance";

/**
 * RFQAI1: deterministic, side-effect-free boundary for untrusted AI/parser output.
 * It NEVER authorizes a company, writes data, confirms a row, or dispatches RFQs.
 * Future intake endpoints must bind organization + actor from verified server auth.
 */
export const RFQAI_INTAKE_CONTRACT = "rfqai-intake/v1" as const;
export const RFQAI_MAX_CANDIDATES = 500;
export type RfqAiSourceChannel = "free_text" | "uploaded_file" | "forwarded_email" | "connected_mailbox";
export type RfqAiSourceIntent = "buyer_request" | "supplier_quote" | "unknown";
export type RfqAiCandidateStatus = "ready_for_review" | "needs_review" | "invalid";
export type RfqAiIssueSeverity = "warning" | "error";
export type RfqAiOrigin = "extracted" | "derived" | "human";

export type RfqAiSourceRef = {
  /** Opaque source ID; storage path, email access tokens and raw attachments are excluded. */
  sourceId: string;
  channel: RfqAiSourceChannel;
  sourceFilename?: string;
  /** Optional content checksum, calculated by trusted ingestion, not an authorization token. */
  sha256?: string;
};
export type RfqAiLocator = {
  kind: "text_line" | "spreadsheet_row" | "pdf_page" | "email_part";
  line?: number;
  sheet?: string;
  row?: number;
  page?: number;
  part?: string;
};
export type RfqAiEvidence = {
  origin: RfqAiOrigin;
  locator: RfqAiLocator;
  rawValue: string | null;
};
export type RfqAiIssue = {
  code:
    | "invalid_source" | "untrusted_document_intent" | "untrusted_item_role"
    | "missing_dimensions" | "ambiguous_geometry" | "invalid_geometry"
    | "missing_standard" | "unsupported_standard" | "missing_grade"
    | "missing_quantity" | "invalid_quantity" | "unsupported_quantity_unit"
    | "missing_bar_length" | "invalid_bar_length"
    | "invalid_target" | "parser_validation" | "low_parser_confidence";
  severity: RfqAiIssueSeverity;
  field: string;
};
export type RfqAiRawLine = {
  sourceText?: unknown;
  standard?: unknown;
  grade?: unknown;
  outerDiameterMm?: unknown;
  widthMm?: unknown;
  heightMm?: unknown;
  thicknessMm?: unknown;
  lengthMm?: unknown;
  quantity?: unknown;
  quantityUnit?: unknown;
  finish?: unknown;
  targetEurT?: unknown;
  note?: unknown;
  /** Parser hints cannot confer trust or authorization. */
  parserConfidence?: unknown;
  parserValidationStatus?: unknown;
  itemRole?: unknown;
};
export type RfqAiLineCandidate = {
  contractVersion: typeof RFQAI_INTAKE_CONTRACT;
  candidateId: string;
  source: RfqAiSourceRef;
  sourceIntent: RfqAiSourceIntent;
  locator: RfqAiLocator;
  sourceExcerpt: string;
  parserConfidence: number | null;
  status: RfqAiCandidateStatus;
  approvalState: "pending_human_review";
  /** One canonical commercial line shape, but not an approved/persisted RFQ line. */
  proposedLine: BuyerDistintaDraftLine;
  evidence: Partial<Record<keyof BuyerDistintaDraftLine, RfqAiEvidence>>;
  issues: RfqAiIssue[];
};

const trimmed = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) :
  typeof v === "number" && Number.isFinite(v) ? String(v) : "";
const numeric = (v: unknown): number | null => {
  const source = trimmed(v, 50);
  if (!source) return null;
  // Only decimal comma/dot are accepted; ambiguous thousands separators are never guessed.
  if (!/^-?\d+(?:[.,]\d+)?$/.test(source)) return null;
  if (/^[1-9]\d{0,2}[.,]\d{3}$/.test(source)) return null; // ambiguous thousands/decimals
  const value = Number(source.replace(",", "."));
  return Number.isFinite(value) ? value : null;
};
const display = (n: number, digits = 3): string =>
  n.toLocaleString("it-IT", { maximumFractionDigits: digits });
const std = (v: unknown): GuidedTubeStandard | null => {
  const value = trimmed(v, 40).replace(/\s+/g, " ").toUpperCase();
  return value === "EN 10219" || value === "EN10219" ? "EN 10219" :
    value === "EN 10210" || value === "EN10210" ? "EN 10210" : null;
};
const unit = (v: unknown): BuyerQuantityMode | null => {
  const value = trimmed(v, 40).toUpperCase().replace(/\./g, "");
  if (["BARRE", "BARRA", "PZ", "NR", "N", "PCS", "PEZZI", "PEZZO"].includes(value)) return "bars";
  if (["M", "MT", "ML", "METRI", "METRO"].includes(value)) return "meters";
  if (["T", "TON", "TONN", "TONNELLATE", "TONNELLATA"].includes(value)) return "tonnes";
  return null;
};
const sourceValid = (s: RfqAiSourceRef, id: string): boolean =>
  Boolean(s.sourceId && s.sourceId.length <= 120 && /^[a-zA-Z0-9._:-]+$/.test(s.sourceId) &&
    id && id.length <= 120 && /^[a-zA-Z0-9._:-]+$/.test(id) &&
    ["free_text", "uploaded_file", "forwarded_email", "connected_mailbox"].includes(s.channel));

function section(raw: RfqAiRawLine): { family: GuidedTubeFamily; a: number; b: number; wall: number } | null {
  const od = numeric(raw.outerDiameterMm), w = numeric(raw.widthMm);
  const h = numeric(raw.heightMm), t = numeric(raw.thicknessMm);
  if (t === null || !(t > 0)) return null;
  if (od !== null && w === null && h === null && od > 0)
    return { family: "round_tube", a: od, b: od, wall: t };
  if (od === null && w !== null && h !== null && w > 0 && h > 0)
    return { family: w === h ? "square_tube" : "rectangular_tube", a: w, b: h, wall: t };
  return null;
}

export function normalizeRfqAiCandidate(
  source: RfqAiSourceRef, candidateId: string, locator: RfqAiLocator,
  intent: RfqAiSourceIntent, raw: RfqAiRawLine,
): RfqAiLineCandidate {
  const issues: RfqAiIssue[] = [];
  const issue = (code: RfqAiIssue["code"], severity: RfqAiIssueSeverity, field: string) =>
    issues.push({ code, severity, field });
  if (!sourceValid(source, candidateId)) issue("invalid_source", "error", "source");
  if (intent !== "buyer_request") issue("untrusted_document_intent", "warning", "sourceIntent");
  if (raw.itemRole !== undefined && raw.itemRole !== null && !["requested", "request", "rfq", "buyer_request"].includes(trimmed(raw.itemRole, 60).toLowerCase()))
    issue("untrusted_item_role", "warning", "itemRole");

  const geometry = section(raw);
  const hasAnyGeometry = ["outerDiameterMm", "widthMm", "heightMm", "thicknessMm"].some(
    (key) => trimmed(raw[key as keyof RfqAiRawLine]).length > 0,
  );
  if (!geometry) issue(hasAnyGeometry ? "invalid_geometry" : "missing_dimensions",
    hasAnyGeometry ? "error" : "warning", "dimensions");
  if (trimmed(raw.outerDiameterMm) && (trimmed(raw.widthMm) || trimmed(raw.heightMm)))
    issue("ambiguous_geometry", "error", "dimensions");

  const standard = std(raw.standard);
  if (!trimmed(raw.standard)) issue("missing_standard", "warning", "standard");
  else if (!standard) issue("unsupported_standard", "warning", "standard");
  const grade = trimmed(raw.grade, 80).toUpperCase();
  if (!grade) issue("missing_grade", "warning", "grade");

  const quantity = numeric(raw.quantity);
  if (quantity === null && !trimmed(raw.quantity)) issue("missing_quantity", "warning", "quantity");
  else if (quantity === null || quantity <= 0) issue("invalid_quantity", "error", "quantity");
  const quantityMode = unit(raw.quantityUnit);
  if (!quantityMode) issue("unsupported_quantity_unit", "warning", "quantityMode");
  if (quantityMode === "bars" && quantity !== null && !Number.isInteger(quantity))
    issue("invalid_quantity", "error", "quantity");

  const lengthMm = numeric(raw.lengthMm);
  if (quantityMode === "bars" && (lengthMm === null || lengthMm <= 0))
    issue(lengthMm === null && !trimmed(raw.lengthMm) ? "missing_bar_length" : "invalid_bar_length",
      lengthMm === null && !trimmed(raw.lengthMm) ? "warning" : "error", "barLengthM");

  const target = numeric(raw.targetEurT);
  if (trimmed(raw.targetEurT) && (target === null || target <= 0))
    issue("invalid_target", "error", "targetEurT");

  const mass = geometry && standard
    ? guidedTubeMassKgM(geometry.family, standard, geometry.a, geometry.b, geometry.wall)
    : null;
  if (geometry && standard && mass === null) issue("invalid_geometry", "error", "dimensions");

  const description = geometry
    ? (geometry.family === "round_tube" ? "Tubo tondo Ø " + display(geometry.a, 2) :
      geometry.family === "square_tube" ? "Tubo quadro " + display(geometry.a, 2) + " × " + display(geometry.b, 2) :
        "Tubo rettangolare " + display(geometry.a, 2) + " × " + display(geometry.b, 2)) +
      " × " + display(geometry.wall, 2) + " mm"
    : "";
  const proposedLine: BuyerDistintaDraftLine = {
    id: candidateId, description, standard: standard ?? "", grade,
    finish: trimmed(raw.finish, 150),
    quantityMode: quantityMode ?? "bars",
    // Unsupported units must NEVER silently become an amount of bars.
    quantity: quantityMode && quantity !== null && quantity > 0 ? display(quantity, 3) : "",
    // Never assume the manual configurator's 12m default from untrusted documents.
    barLengthM: lengthMm !== null && lengthMm > 0 ? display(lengthMm / 1000, 3) : "",
    weightKgM: mass !== null ? display(mass, 3) : "",
    targetEurT: target !== null && target > 0 ? display(target, 2) : "",
    note: trimmed(raw.note, 1000),
  };
  // Reuse canonical buyer calculator. It is insufficient alone for technical
  // acceptance, so requirements above independently flag missing norm/grade.
  if (issues.every((i) => i.severity !== "error") &&
      !calculateBuyerDistintaLine(proposedLine).complete)
    issue("parser_validation", "warning", "proposedLine");

  const parserConfidence = numeric(raw.parserConfidence);
  const score = parserConfidence !== null && parserConfidence >= 0 && parserConfidence <= 1
    ? parserConfidence : null;
  if (raw.parserValidationStatus === "invalid")
    issue("parser_validation", "error", "parser");
  else if (raw.parserValidationStatus === "review_required")
    issue("parser_validation", "warning", "parser");
  if (score !== null && score < 0.9)
    issue("low_parser_confidence", "warning", "parserConfidence");

  const evidence: RfqAiLineCandidate["evidence"] = {};
  const attach = (field: keyof BuyerDistintaDraftLine, rawValue: unknown, origin: RfqAiOrigin = "extracted") => {
    if (trimmed(rawValue)) evidence[field] = { origin, locator: { ...locator }, rawValue: trimmed(rawValue, 250) };
  };
  attach("description", raw.sourceText, "derived");
  attach("standard", raw.standard);
  attach("grade", raw.grade);
  attach("quantity", raw.quantity);
  attach("quantityMode", raw.quantityUnit);
  attach("barLengthM", raw.lengthMm);
  attach("finish", raw.finish);
  attach("targetEurT", raw.targetEurT);
  attach("note", raw.note);
  if (mass !== null) evidence.weightKgM = { origin: "derived", locator: { ...locator }, rawValue: null };
  const status: RfqAiCandidateStatus = issues.some((i) => i.severity === "error")
    ? "invalid" : issues.length ? "needs_review" : "ready_for_review";
  return {
    contractVersion: RFQAI_INTAKE_CONTRACT, candidateId,
    source: { ...source }, sourceIntent: intent, locator: { ...locator },
    sourceExcerpt: trimmed(raw.sourceText, 800), parserConfidence: score,
    status, approvalState: "pending_human_review", proposedLine, evidence, issues,
  };
}

/** Strictly a staging payload: callers MUST NOT pass candidate lines directly
 * to saveBuyerDistinta / createBuyerRfqCampaign before authorized user review.
 */
export function makeRfqAiIntakeBatch(
  source: RfqAiSourceRef, intent: RfqAiSourceIntent,
  observations: readonly { candidateId: string; locator: RfqAiLocator; raw: RfqAiRawLine }[],
): { contractVersion: typeof RFQAI_INTAKE_CONTRACT; source: RfqAiSourceRef; candidates: RfqAiLineCandidate[] } {
  if (!Array.isArray(observations) || observations.length > RFQAI_MAX_CANDIDATES)
    throw new Error("RFQAI batch exceeds the 500-line limit");
  const seen = new Set<string>();
  const candidates = observations.map((item) => {
    if (seen.has(item.candidateId)) throw new Error("Duplicate candidate ID");
    seen.add(item.candidateId);
    return normalizeRfqAiCandidate(source, item.candidateId, item.locator, intent, item.raw);
  });
  return { contractVersion: RFQAI_INTAKE_CONTRACT, source: { ...source }, candidates };
}
