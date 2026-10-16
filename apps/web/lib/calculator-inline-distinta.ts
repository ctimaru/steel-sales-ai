/**
 * CALC-INT4.4A — one validated, tab-scoped line contract for the future
 * public calculator → inline bill → private RFQ workflow.
 *
 * This is a pure state model, NOT a second RFQ database or a supplier payload.
 * Every line is the existing BuyerDistintaDraftLine, calculated with the
 * existing Buyer Distinta engine. No price is accepted/persisted at this stage.
 * C (explicit opt-in buyer target) and D (private RFQ action) come later.
 */
import {
  calculatorItemToBuyerLine, validatedCalculatorRfqItem,
  type CalculatorRfqItem,
} from "@/lib/calculator-rfq-handoff";
import { validUsPipeRfqItem, usPipeRfqSpecification, type UsPipeRfqItem } from "@/lib/us-pipe-rfq-handoff";
import {
  calculateBuyerDistintaLine, calculateBuyerDistintaTotals,
  type BuyerDistintaDraftLine, type BuyerQuantityMode,
} from "@/lib/buyer-distinta";

export const INLINE_DISTINTA_SESSION_KEY = "sss:inline-distinta:v1";
export const INLINE_DISTINTA_TTL_MS = 24 * 60 * 60 * 1000;
export const INLINE_DISTINTA_MAX_LINES = 50;
const MAX_SESSION_CHARS = 100_000;
const ID = /^[a-zA-Z0-9-]{6,90}$/;
const STANDARD = new Set([
  "EN 10210", "EN 10219", "Calcolo geometrico libero",
  "API Spec 5L (edition and PSL to confirm)",
  "ASTM A53/A53M (grade/type to confirm)",
  "ASTM A106/A106M (grade to confirm)",
  "ASTM A500/A500M-23 HSS (grade/certification to confirm)",
]);
const QUANTITY_MODES = new Set<BuyerQuantityMode>(["bars", "meters", "tonnes"]);
const LINE_KEYS = new Set<keyof BuyerDistintaDraftLine>([
  "id", "description", "standard", "grade", "finish", "quantityMode",
  "quantity", "barLengthM", "weightKgM", "targetEurT", "note",
]);
const EDITABLE_KEYS = new Set<keyof BuyerDistintaDraftLine>([
  "grade", "finish", "quantityMode", "quantity", "barLengthM", "note",
]);

export type InlineDistintaState = {
  lines: BuyerDistintaDraftLine[];
};
export type InlineDistintaResult =
  | { ok: true; state: InlineDistintaState }
  | { ok: false; state: InlineDistintaState; reason: "invalid" | "duplicate" | "full" | "missing" };

export const emptyInlineDistinta = (): InlineDistintaState => ({ lines: [] });

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function positive(value: string, max: number): number | null {
  if (!/^[0-9]+(?:[.,][0-9]+)?$/.test(value)) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
}

function safeText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

/** Strict on purpose: no unknown fields, price, unsafe quantity or row IDs. */
function validatedLine(value: unknown): BuyerDistintaDraftLine | null {
  if (!object(value) || Object.keys(value).some(key => !LINE_KEYS.has(key as keyof BuyerDistintaDraftLine)) ||
      !safeText(value.id, 90) || !ID.test(value.id) ||
      !safeText(value.description, 500) || !value.description.trim() ||
      !safeText(value.standard, 100) || !STANDARD.has(value.standard) ||
      !safeText(value.grade, 100) || !safeText(value.finish, 150) ||
      !safeText(value.quantity, 45) || !safeText(value.barLengthM, 45) ||
      !safeText(value.weightKgM, 45) || !safeText(value.note, 1200) ||
      value.targetEurT !== "" ||
      !QUANTITY_MODES.has(value.quantityMode as BuyerQuantityMode)) return null;
  const quantity = positive(value.quantity, 1_000_000);
  const barLength = positive(value.barLengthM, 1_000);
  const kgM = positive(value.weightKgM, 1_000_000);
  if (quantity === null || barLength === null || kgM === null ||
      (value.quantityMode === "bars" && !Number.isSafeInteger(quantity))) return null;
  const line: BuyerDistintaDraftLine = {
    id: value.id, description: value.description, standard: value.standard,
    grade: value.grade, finish: value.finish,
    quantityMode: value.quantityMode as BuyerQuantityMode,
    quantity: value.quantity, barLengthM: value.barLengthM,
    weightKgM: value.weightKgM, targetEurT: "", note: value.note,
  };
  return calculateBuyerDistintaLine(line).complete ? line : null;
}

function validState(state: InlineDistintaState): boolean {
  if (!state || !Array.isArray(state.lines) || state.lines.length > INLINE_DISTINTA_MAX_LINES) return false;
  const ids = new Set<string>();
  for (const line of state.lines) {
    const valid = validatedLine(line);
    if (!valid || ids.has(valid.id)) return false;
    ids.add(valid.id);
  }
  return true;
}

function reject(state: InlineDistintaState, reason: "invalid" | "duplicate" | "full" | "missing"): InlineDistintaResult {
  return { ok: false, state, reason };
}

/** Uses the existing calculator handoff validator and Buyer Distinta adapter. */
export function addInlineDistintaItem(
  state: InlineDistintaState, input: CalculatorRfqItem, now = Date.now(),
): InlineDistintaResult {
  if (!validState(state)) return reject(state, "invalid");
  const item = validatedCalculatorRfqItem(input, now);
  if (!item) return reject(state, "invalid");
  if (state.lines.some(line => line.id === item.id)) return reject(state, "duplicate");
  if (state.lines.length >= INLINE_DISTINTA_MAX_LINES) return reject(state, "full");
  const line = validatedLine(calculatorItemToBuyerLine(item, item.id));
  if (!line) return reject(state, "invalid");
  return { ok: true, state: { lines: [...state.lines, line] } };
}

/**
 * CALC-USA-FLOW1: accept only a validated US size or HSS source reference.
 * The existing US normalizer RECOMPUTES theoretical mass and provenance;
 * never use a published/manufacturer nominal weight as the bill's kg/m.
 * The stored technical line contains no commercial price, compliance claim,
 * or forged source identifiers; price remains an explicit React-only opt-in.
 */
export function addInlineDistintaUsItem(
  state: InlineDistintaState, input: UsPipeRfqItem, now = Date.now(),
): InlineDistintaResult {
  if (!validState(state)) return reject(state, "invalid");
  const valid = validUsPipeRfqItem(input, now);
  if (!valid) return reject(state, "invalid");
  if (state.lines.some(line => line.id === valid.id)) return reject(state, "duplicate");
  if (state.lines.length >= INLINE_DISTINTA_MAX_LINES) return reject(state, "full");
  const spec = usPipeRfqSpecification(valid);
  if (!spec) return reject(state, "invalid");
  const line = validatedLine({
    id: valid.id,
    description: spec.designation.slice(0, 500),
    standard: spec.standardLabel,
    grade: "", finish: "",
    quantityMode: "bars", quantity: String(spec.bars),
    barLengthM: String(spec.lengthM),
    weightKgM: String(Number(spec.theoreticalKgM.toFixed(6))),
    targetEurT: "",
    note: spec.provenanceNote.slice(0, 1200),
  });
  if (!line) return reject(state, "invalid");
  return {ok:true,state:{lines:[...state.lines,line]}};
}

/** Quantity and buyer details only: editing geometry or kg/m requires a new calculation. */
export function editInlineDistintaLine(
  state: InlineDistintaState, id: string, patch: Partial<BuyerDistintaDraftLine>,
): InlineDistintaResult {
  if (!validState(state) || !object(patch) ||
      Object.keys(patch).some(key => !EDITABLE_KEYS.has(key as keyof BuyerDistintaDraftLine))) return reject(state, "invalid");
  const index = state.lines.findIndex(line => line.id === id);
  if (index < 0) return reject(state, "missing");
  const next = validatedLine({ ...state.lines[index], ...patch });
  if (!next) return reject(state, "invalid");
  return { ok: true, state: { lines: state.lines.map(line => line.id === id ? next : line) } };
}

/** Explicit duplicate only; re-clicking the same calculator event does not duplicate. */
export function duplicateInlineDistintaLine(
  state: InlineDistintaState, id: string, newId: string,
): InlineDistintaResult {
  if (!validState(state) || !ID.test(newId)) return reject(state, "invalid");
  const source = state.lines.find(line => line.id === id);
  if (!source) return reject(state, "missing");
  if (state.lines.some(line => line.id === newId)) return reject(state, "duplicate");
  if (state.lines.length >= INLINE_DISTINTA_MAX_LINES) return reject(state, "full");
  const next = validatedLine({ ...source, id: newId, targetEurT: "" });
  if (!next) return reject(state, "invalid");
  return { ok: true, state: { lines: [...state.lines, next] } };
}

export function removeInlineDistintaLine(state: InlineDistintaState, id: string): InlineDistintaResult {
  if (!validState(state)) return reject(state, "invalid");
  if (!state.lines.some(line => line.id === id)) return reject(state, "missing");
  return { ok: true, state: { lines: state.lines.filter(line => line.id !== id) } };
}

/** Same calculation and totals as /distinta; no parallel mass or pricing engine. */
export function inlineDistintaTotals(state: InlineDistintaState) {
  if (!validState(state)) return null;
  return calculateBuyerDistintaTotals(state.lines.map(calculateBuyerDistintaLine));
}

/**
 * The future private RFQ action must authenticate/authorize and save via the
 * existing Buyer Distinta server action. This is just a validated clone.
 * Neither this adapter nor the browser session sends or publishes anything.
 */
export function inlineDistintaBuyerLines(state: InlineDistintaState): BuyerDistintaDraftLine[] | null {
  if (!validState(state) || state.lines.length === 0) return null;
  return state.lines.map(line => ({ ...line, targetEurT: "" }));
}

/** Only a dedicated, namespaced session; never writes legacy /distinta drafts. */
export function serializeInlineDistinta(
  state: InlineDistintaState, now = Date.now(),
): string | null {
  if (!validState(state) || !state.lines.length || !Number.isFinite(now) || now < 0) return null;
  const raw = JSON.stringify({ version: 1, savedAt: now,
    lines: state.lines.map(line => ({ ...line, targetEurT: "" })) });
  return raw.length <= MAX_SESSION_CHARS ? raw : null;
}

export function parseInlineDistinta(raw: string | null, now = Date.now()): InlineDistintaState | null {
  if (!raw || raw.length > MAX_SESSION_CHARS) return null;
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!object(candidate) || candidate.version !== 1 ||
        typeof candidate.savedAt !== "number" || !Number.isFinite(candidate.savedAt) ||
        candidate.savedAt > now + 60_000 || now - candidate.savedAt > INLINE_DISTINTA_TTL_MS ||
        !Array.isArray(candidate.lines) || candidate.lines.length < 1 ||
        candidate.lines.length > INLINE_DISTINTA_MAX_LINES) return null;
    const lines = candidate.lines.map(validatedLine);
    if (lines.some(line => line === null)) return null;
    const state: InlineDistintaState = { lines: lines as BuyerDistintaDraftLine[] };
    return validState(state) ? state : null;
  } catch {
    return null;
  }
}

export function readInlineDistintaSession(storage: Pick<Storage, "getItem">, now = Date.now()) {
  try { return parseInlineDistinta(storage.getItem(INLINE_DISTINTA_SESSION_KEY), now); }
  catch { return null; }
}
export function persistInlineDistintaSession(
  storage: Pick<Storage, "setItem" | "removeItem">, state: InlineDistintaState, now = Date.now(),
): boolean {
  if (!validState(state)) return false;
  try {
    const raw = serializeInlineDistinta(state, now);
    if (raw) storage.setItem(INLINE_DISTINTA_SESSION_KEY, raw);
    else if (state.lines.length === 0) storage.removeItem(INLINE_DISTINTA_SESSION_KEY);
    else return false;
    return true;
  } catch { return false; }
}
