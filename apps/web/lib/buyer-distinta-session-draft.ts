import { normalizeBuyerDocumentRequirements, type BuyerDistintaDocumentRequirements } from "@/lib/buyer-distinta-documents";
import type { BuyerDistintaDraftLine, BuyerQuantityMode } from "@/lib/buyer-distinta";
import type { GuidedTubeDraft } from "@/lib/buyer-tube-guidance";

export const BUYER_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DRAFT_BYTES = 350_000;
const PREFIX = "smart-steel-sales:buyer-distinta:v1:";
const DEFAULT_TITLE = "Richiesta di offerta";

type CatalogSelection = { family: string; sizeKey: string; optionId: string };
export type BuyerSessionDraft = {
  version: 1;
  savedAt: number;
  title: string;
  lines: BuyerDistintaDraftLine[];
  documents: BuyerDistintaDocumentRequirements;
  guidedSpecsByLine: Record<string, GuidedTubeDraft>;
  selectedCatalog: Record<string, CatalogSelection>;
  wizardDraft: GuidedTubeDraft | null;
};

export function buyerDraftKey(userId: string | null): string {
  return PREFIX + (userId ? "user:" + userId.replace(/[^a-zA-Z0-9-]/g, "") : "guest");
}

function bounded(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalLine(value: unknown): BuyerDistintaDraftLine | null {
  if (!plainObject(value)) return null;
  const id = bounded(value.id, 96);
  if (!id) return null;
  const quantityMode: BuyerQuantityMode =
    value.quantityMode === "meters" || value.quantityMode === "bars" || value.quantityMode === "tonnes"
      ? value.quantityMode
      : "bars";
  return {
    id,
    description: bounded(value.description, 500),
    standard: bounded(value.standard, 100),
    grade: bounded(value.grade, 100),
    finish: bounded(value.finish, 150),
    quantityMode,
    quantity: bounded(value.quantity, 45),
    barLengthM: typeof value.barLengthM === "string" ? bounded(value.barLengthM, 45) : "12",
    weightKgM: bounded(value.weightKgM, 45),
    targetEurT: bounded(value.targetEurT, 45),
    note: bounded(value.note, 1200),
  };
}

function normalGuidedDraft(input: unknown): GuidedTubeDraft | null {
  if (!plainObject(input)) return null;
  const family = input.family;
  const standard = input.standard;
  return {
    family: family === "round_tube" || family === "square_tube" || family === "rectangular_tube" ? family : "",
    standard: standard === "EN 10219" || standard === "EN 10210" ? standard : "",
    grade: bounded(input.grade, 100),
    diameter: bounded(input.diameter, 45),
    side: bounded(input.side, 45),
    width: bounded(input.width, 45),
    height: bounded(input.height, 45),
    thickness: bounded(input.thickness, 45),
  };
}

export function parseBuyerSessionDraft(raw: string | null, now = Date.now()): BuyerSessionDraft | null {
  if (!raw || raw.length > MAX_DRAFT_BYTES) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!plainObject(data) || data.version !== 1 ||
        typeof data.savedAt !== "number" || !Number.isFinite(data.savedAt) ||
        data.savedAt > now + 60_000 || now - data.savedAt > BUYER_DRAFT_TTL_MS ||
        !Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > 500) return null;
    const lines = data.lines.map(normalLine);
    if (lines.some((line) => line === null)) return null;
    const keys = new Set(lines.map((line) => line!.id));
    if (keys.size !== lines.length) return null;
    const ids = keys;
    const guidedSpecsByLine: Record<string, GuidedTubeDraft> = {};
    if (plainObject(data.guidedSpecsByLine)) {
      for (const [id, input] of Object.entries(data.guidedSpecsByLine)) {
        if (!ids.has(id) || !plainObject(input)) continue;
        const guided = normalGuidedDraft(input);
        if (guided) guidedSpecsByLine[id] = guided;
      }
    }
    const selectedCatalog: Record<string, CatalogSelection> = {};
    if (plainObject(data.selectedCatalog)) {
      for (const [id, input] of Object.entries(data.selectedCatalog)) {
        if (!ids.has(id) || !plainObject(input)) continue;
        selectedCatalog[id] = {
          family: bounded(input.family, 100),
          sizeKey: bounded(input.sizeKey, 120),
          optionId: bounded(input.optionId, 160),
        };
      }
    }
    return {
      version: 1,
      savedAt: data.savedAt,
      title: bounded(data.title, 240) || DEFAULT_TITLE,
      lines: lines as BuyerDistintaDraftLine[],
      documents: normalizeBuyerDocumentRequirements(data.documents),
      guidedSpecsByLine,
      selectedCatalog,
      wizardDraft: normalGuidedDraft(data.wizardDraft),
    };
  } catch {
    return null;
  }
}

export function isMeaningfulBuyerDraft(input: Pick<BuyerSessionDraft, "title" | "lines" | "documents" | "wizardDraft">): boolean {
  return input.title.trim() !== DEFAULT_TITLE ||
    input.lines.length > 1 ||
    input.lines.some((line) => Boolean(
      line.description.trim() || line.standard.trim() || line.grade.trim() ||
      line.finish.trim() || line.quantity.trim() || line.weightKgM.trim() ||
      line.targetEurT.trim() || line.note.trim() ||
      (line.quantityMode !== "bars" || line.barLengthM !== "12"),
    )) ||
    Boolean(input.documents.inspectionDocument || input.documents.ceDop || input.documents.iso9001) ||
    Boolean(input.wizardDraft && (
      input.wizardDraft.family || input.wizardDraft.standard || input.wizardDraft.grade ||
      input.wizardDraft.diameter || input.wizardDraft.side || input.wizardDraft.width ||
      input.wizardDraft.height || input.wizardDraft.thickness
    ));
}

export function serializeBuyerSessionDraft(
  input: Omit<BuyerSessionDraft, "version" | "savedAt">,
  now = Date.now(),
): string | null {
  if (!isMeaningfulBuyerDraft(input)) return null;
  const raw = JSON.stringify({ version: 1, savedAt: now, ...input });
  return raw.length <= MAX_DRAFT_BYTES ? raw : null;
}
