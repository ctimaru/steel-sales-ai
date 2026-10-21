"use client";

import { guidedTubeToBuyerLine } from "@/lib/buyer-guided-commercial-line";
import { calculatorItemToBuyerLine, consumeCalculatorRfqIds, readCalculatorRfqQueue, type CalculatorRfqItem } from "@/lib/calculator-rfq-handoff";
import { consumeUsPipeRfqIds, readUsPipeRfqQueue, usPipeRfqSpecification } from "@/lib/us-pipe-rfq-handoff";
import { PublicTubeWeightCalculator } from "@/components/public-tube-weight-calculator";
import { dimensionsFromBuyerCatalog } from "@/lib/calculator-dimension-discovery";
import { Bd17GuestRfqCta } from "@/components/bd17-guest-rfq-cta";
import { trackProductEvent } from "@/lib/product-analytics-events.client";
import { createPrivateRfqOneStep } from "@/lib/buyer-distinta-rfq-one-step";

import Link from "next/link";
import { BuyerTubeGuidedCreator } from "@/components/buyer-tube-guided-creator";
import { RfqAiIntakeUx, type RfqAiIntakeMode } from "@/components/rfq-ai-intake-ux";
import { guidedTubeMassKgM, guidedTubeMeasurement,  type GuidedTubeDraft } from "@/lib/buyer-tube-guidance";
import { emptyBuyerDocumentRequirements, formatBuyerDocumentRequirements, type BuyerDistintaDocumentRequirements } from "@/lib/buyer-distinta-documents";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/routes";
import {
  buyerDraftKey, parseBuyerSessionDraft, serializeBuyerSessionDraft,
  type BuyerSessionDraft,
} from "@/lib/buyer-distinta-session-draft";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { TechnicalCartShell } from "@/components/technical-cart-shell";
import { buyerUiText, safeBuyerUiLocale, type BuyerUiLocale } from "@/lib/buyer-ui-locale";
import {networkReviewedHandoffKey,parseNetworkReviewedHandoff,type NetworkReviewedHandoff} from "@/lib/network-reviewed-rfq-handoff";

import {
  createBuyerRfqCampaign,
  saveBuyerDistinta,
  sendBuyerDistinta,
} from "@/app/(public)/distinta/actions";
import {
  buildBuyerDistintaHtml,
  buildBuyerDistintaPlainText,
  calculateBuyerDistintaLine,
  calculateBuyerDistintaTotals,
  type BuyerDistintaDraftLine,
  type BuyerQuantityMode,
} from "@/lib/buyer-distinta";
import {
  buyerTubeFamilyLabels,
  searchBuyerDistintaCatalog,
  type BuyerDistintaCatalogOption,
} from "@/lib/buyer-distinta-catalog";

function blankLine(id: string): BuyerDistintaDraftLine {
  return {
    id,
    description: "",
    standard: "",
    grade: "",
    finish: "",
    quantityMode: "bars",
    quantity: "",
    barLengthM: "12",
    weightKgM: "",
    targetEurT: "",
    note: "",
  };
}

function newLineId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "line-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function isUntouchedLine(line: BuyerDistintaDraftLine) {
  return !line.description.trim() && !line.weightKgM.trim() &&
    !line.quantity.trim() && !line.standard.trim() && !line.grade.trim() &&
    !line.finish.trim() && !line.targetEurT.trim() && !line.note.trim();
}

function formatNumber(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function BuyerDistintaBuilder({
  authenticated,
  emailConfigured,
  catalogOptions,
  workspace = false,
  userId = null,
  organizationId = null,
  returnToCommercial = false,
  locale = "it",
}: {
  authenticated: boolean;
  emailConfigured: boolean;
  catalogOptions: BuyerDistintaCatalogOption[];
  workspace?: boolean;
  userId?: string | null;
  organizationId?: string | null;
  returnToCommercial?: boolean;
  locale?: BuyerUiLocale;
}) {
  const router = useRouter();
  const [uiLocale,setUiLocale]=useState<BuyerUiLocale>(safeBuyerUiLocale(locale));
  const t=(key:keyof typeof import("@/lib/buyer-ui-locale").buyerUiCopy)=>buyerUiText(key,uiLocale);
  const [title, setTitle] = useState("Richiesta di offerta");
  const [documents, setDocuments] = useState<BuyerDistintaDocumentRequirements>(emptyBuyerDocumentRequirements);
  const [previewDraft, setPreviewDraft] = useState<GuidedTubeDraft | null>(null);
  const [wizardRestoreSerial, setWizardRestoreSerial] = useState(0);
  const [intakeMode, setIntakeMode] = useState<RfqAiIntakeMode>("manual");
  const [quickQuery, setQuickQuery] = useState("");
  const [quickGrade, setQuickGrade] = useState("");
  const [quickAddedCount, setQuickAddedCount] = useState(0);
  const [compactMode, setCompactMode] = useState(true);
  // CALC-NEXT1D: the private draft uses the same intentional-access cart
  // interaction as the public calculator, without sharing commercial data.
  const [cartOpen, setCartOpen] = useState(false);
  const cartReturnFocusRef = useRef<HTMLElement | null>(null);
  const pendingCartRowRef = useRef<string | null>(null);
  function openPrivateCart() {
    cartReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCartOpen(true);
  }
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editingRows, setEditingRows] = useState<Record<string, boolean>>({});
  const focusQuantityId = useRef<string | null>(null);
  const rfqInFlightRef = useRef(false);
  const [selectedCatalog, setSelectedCatalog] = useState<Record<string, { family: string; sizeKey: string; optionId: string }>>({});
  const [guidedSpecsByLine, setGuidedSpecsByLine] = useState<Record<string, GuidedTubeDraft>>({});
  const [lines, setLines] = useState<BuyerDistintaDraftLine[]>([
    blankLine("line-1"),
  ]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [calculatorHandoffCount, setCalculatorHandoffCount] = useState(0);
  const [calculatorHandoffOverflow, setCalculatorHandoffOverflow] = useState(false);
  const [networkHandoff,setNetworkHandoff]=useState<NetworkReviewedHandoff|null>(null);
  const [networkHandoffError,setNetworkHandoffError]=useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState("");
  const [emailSubject, setEmailSubject] = useState("Richiesta di offerta");
  const [emailMessage, setEmailMessage] = useState(
    "Buongiorno,\nvi chiediamo cortesemente la vostra migliore offerta per i materiali indicati nella distinta seguente.",
  );
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [rfqMessage, setRfqMessage] = useState<string | null>(null);
  // Only a same-tab session draft; no cookie, URL payload, remote autosave or email data.
  const [draftReady, setDraftReady] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<{ key: string; draft: BuyerSessionDraft } | null>(null);
  const draftKey = buyerDraftKey(authenticated ? userId : null);
  const networkHandoffKey = authenticated&&userId&&organizationId
    ? networkReviewedHandoffKey(userId,organizationId):null;
  const [savePending, startSaveTransition] = useTransition();
  const [sendPending, startSendTransition] = useTransition();
  const [rfqPending, startRfqTransition] = useTransition();

  const calculated = useMemo(
    () => lines.map(calculateBuyerDistintaLine),
    [lines],
  );
  const totals = useMemo(
    () => calculateBuyerDistintaTotals(calculated),
    [calculated],
  );
  // Only the initial reusable empty placeholder is excluded from progress.
  // Explicitly added blank rows must still block copy until they are completed.
  const initialEmptyRow = lines.length === 1 && isUntouchedLine(lines[0]) && !editingRows[lines[0].id];
  const activeLineCount = initialEmptyRow ? 0 : lines.length;
  const allComplete =
    calculated.length > 0 && calculated.every((line) => line.complete);
  const discoveredBuyerDimensions = useMemo(() => dimensionsFromBuyerCatalog(catalogOptions), [catalogOptions]);
  const quickMatches = useMemo(
    () => searchBuyerDistintaCatalog(catalogOptions, quickQuery, 8),
    [catalogOptions, quickQuery],
  );

  useEffect(() => {
    try {
      // After authentication prefer the guest handoff. Never silently load one
      // browser user's commercial text into a different account.
      const candidates = authenticated
        ? [buyerDraftKey(null), draftKey]
        : [draftKey];
      for (const key of candidates) {
        const raw = window.sessionStorage.getItem(key);
        const recovered = parseBuyerSessionDraft(raw);
        if (recovered) {
          setRestoreCandidate({ key, draft: recovered });
          return;
        }
        if (raw) window.sessionStorage.removeItem(key);
      }
    } catch {
      // Storage may be disabled in private mode; builder remains fully usable.
    }
    setDraftReady(true);
  }, [authenticated, draftKey]);

  function persistBrowserDraft() {
    try {
      const value = serializeBuyerSessionDraft({
        title, lines, documents, guidedSpecsByLine, selectedCatalog, wizardDraft: previewDraft,
      });
      if (value) window.sessionStorage.setItem(draftKey, value);
      else window.sessionStorage.removeItem(draftKey);
    } catch {
      // Storage unavailable or quota exceeded; server save and copy still work.
    }
  }

  useEffect(() => {
    if (!draftReady) return;
    persistBrowserDraft();
    // Deliberately store only changes to the draft payload, not message, email
    // recipients or subject; none of these can be sent from browser storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, draftKey, title, lines, documents, guidedSpecsByLine, selectedCatalog, previewDraft]);

  // NET-UX COMPACT6D: an independent, user+tenant-bound reviewed handoff.
  // Never overwrite a saved or unsaved current draft and never auto-import.
  useEffect(()=>{
    if(!draftReady||restoreCandidate||!workspace||!networkHandoffKey)return;
    try{
      const raw=window.sessionStorage.getItem(networkHandoffKey);
      const imported=parseNetworkReviewedHandoff(raw);
      if(imported)setNetworkHandoff(imported);
      else if(raw)window.sessionStorage.removeItem(networkHandoffKey);
    }catch{
      setNetworkHandoffError("Archivio temporaneo non disponibile: nessuna riga importata.");
    }
  },[draftReady,restoreCandidate,workspace,networkHandoffKey]);

  function discardNetworkHandoff(){
    try{if(networkHandoffKey)window.sessionStorage.removeItem(networkHandoffKey);}catch{/* no-op */}
    setNetworkHandoff(null);setNetworkHandoffError("");
  }
  function importNetworkHandoff(){
    if(!networkHandoff||!draftReady||restoreCandidate)return;
    if(!insertRfqAiTextLines(networkHandoff.lines)){
      setNetworkHandoffError("Impossibile aggiungere le righe: verifica validità o capienza (500 articoli).");
      return;
    }
    discardNetworkHandoff();
  }

  // CALC-UX2: read only after the optional existing draft has been either
  // restored or explicitly discarded. Never overwrite previous RFQ lines.
  useEffect(() => {
    if (!draftReady || restoreCandidate) return;
    const pending = readCalculatorRfqQueue(window.sessionStorage);
    if (!pending.length) return;
    const baseSize = lines.length === 1 && isUntouchedLine(lines[0]) ? 0 : lines.length;
    const accepted = pending.slice(0, Math.max(0,500-baseSize));
    if (!accepted.length) { setCalculatorHandoffOverflow(true); return; }
    const imported = accepted.map((item) => calculatorItemToBuyerLine(item, newLineId()));
    setLines((current) => {
      const base = current.length === 1 && isUntouchedLine(current[0]) ? [] : current;
      return [...base, ...imported.slice(0,Math.max(0,500-base.length))];
    });
    consumeCalculatorRfqIds(window.sessionStorage, accepted.map(v=>v.id));
    setCalculatorHandoffCount(accepted.length);
    setCalculatorHandoffOverflow(accepted.length < pending.length);
    setCompactMode(true);
    setCopyState("idle");
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
  // Run once when the existing draft decision is complete. The queue is
  // consumed synchronously; StrictMode effect replay cannot double-import.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, restoreCandidate]);

  // CALC-INT3C: independent opt-in US pipe queue. Never modify the EN/geometric
  // v1 handoff, and do not auto-send a line or claim API/ASTM compliance.
  useEffect(() => {
    if (!draftReady || restoreCandidate) return;
    const pending = readUsPipeRfqQueue(window.sessionStorage);
    if (!pending.length) return;
    const room = lines.length === 1 && isUntouchedLine(lines[0]) ? 500 : Math.max(0, 500 - lines.length);
    const accepted = pending.slice(0,room);
    const imported = accepted.flatMap((item) => {
      const spec=usPipeRfqSpecification(item);
      if (!spec) return [];
      const summary=spec.calculationMethod==="aisc-a500" ? spec.designation : `${spec.designation}, OD ${spec.outerDiameterMm} × ${spec.wallMm} mm`;
      return [{
        id:newLineId(),
        description:spec.calculationMethod==="aisc-a500" ? `${summary} · HSS ASTM A500` : `Tubo tondo ${summary}`,
        standard:spec.standardLabel,
        grade:"",finish:"",quantityMode:"bars" as const,quantity:String(spec.bars),
        barLengthM:String(spec.lengthM),
        weightKgM:spec.theoreticalKgM.toLocaleString("it-IT",{maximumFractionDigits:3}),
        targetEurT:"",
        note:`${spec.provenanceNote} Requested: ${spec.standardLabel}; ${spec.designation}. ${spec.publishedKgM != null ? `Manufacturer-published reference ${spec.publishedKgM} kg/m (comparison only, not RFQ mass).` : `No manufacturer-published weight exists for this user-supplied geometry.`}`,
      }];
    });
    if (imported.length) {
      setLines(current => {
        const base = current.length === 1 && isUntouchedLine(current[0]) ? [] : current;
        return [...base,...imported.slice(0,Math.max(0,500-base.length))];
      });
      setCalculatorHandoffCount(count => count + imported.length);
      setCompactMode(true);
      setCopyState("idle");
      setSavedId(null);
      setSaveMessage(null);
      setSendMessage(null);
      setRfqMessage(null);
    }
    consumeUsPipeRfqIds(window.sessionStorage,accepted.map(v=>v.id));
    setCalculatorHandoffOverflow(accepted.length < pending.length);
    // The accepted v2 ids are consumed synchronously; replay cannot duplicate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[draftReady,restoreCandidate]);

  function restoreBrowserDraft() {
    if (!restoreCandidate) return;
    const recovered = restoreCandidate.draft;
    setTitle(recovered.title);
    setLines(recovered.lines);
    setEditingRows({});
    setDocuments(recovered.documents);
    setGuidedSpecsByLine(recovered.guidedSpecsByLine);
    setSelectedCatalog(recovered.selectedCatalog);
    setPreviewDraft(recovered.wizardDraft);
    setWizardRestoreSerial((current) => current + 1);
    setEmailSubject(recovered.title);
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    try {
      // Transfer ownership into the authenticated user's tab-scoped key only
      // after an explicit choice, never silently on login.
      if (restoreCandidate.key !== draftKey) window.sessionStorage.removeItem(restoreCandidate.key);
    } catch { /* storage may be disabled */ }
    setRestoreCandidate(null);
    setDraftReady(true);
  }

  function discardBrowserDraft() {
    try { if (restoreCandidate) window.sessionStorage.removeItem(restoreCandidate.key); }
    catch { /* optional session storage */ }
    setRestoreCandidate(null);
    setDraftReady(true);
  }

  useEffect(() => {
    const id = focusQuantityId.current;
    if (!id) return;
    const input = document.getElementById("buyer-quantity-" + id);
    if (!input) return;
    focusQuantityId.current = null;
    input.focus({ preventScroll: true });
    input.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [lines, compactMode]);

  function updateLine(
    id: string,
    patch: Partial<BuyerDistintaDraftLine>,
  ) {
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function chooseFamily(id: string, family: string) {
    setSelectedCatalog((current) => ({ ...current, [id]: { family, sizeKey: "", optionId: "" } }));
    updateLine(id, { description: "", weightKgM: "" });
  }

  function chooseSize(id: string, family: string, sizeKey: string) {
    setSelectedCatalog((current) => ({ ...current, [id]: { family, sizeKey, optionId: "" } }));
    updateLine(id, { description: "", weightKgM: "" });
  }

  function weightFromCatalogForStandard(option: BuyerDistintaCatalogOption, standard: string): string {
    if (standard !== "EN 10210" && standard !== "EN 10219") {
      return option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 });
    }
    const parts = option.sizeKey.split(":");
    const a = Number(parts[1]), b = Number(parts[2]);
    const weight = guidedTubeMassKgM(option.family, standard, a, b, option.thicknessMm);
    return (weight ?? option.weightKgM).toLocaleString("it-IT", { maximumFractionDigits: 3 });
  }

  // BD11: numerical values are validated by the existing public calculator bridge.
  // Append in the current React state so the user sees the editable RFQ bill immediately.
  function addCalculatorLine(item: CalculatorRfqItem): boolean {
    if (!draftReady || restoreCandidate) return false;
    const reusable = lines.length === 1 && isUntouchedLine(lines[0]);
    if (!reusable && lines.length >= 500) return false;
    const id = reusable ? lines[0].id : newLineId();
    const nextLine = { ...calculatorItemToBuyerLine(item, id), grade: quickGrade.trim() };
    if (!calculateBuyerDistintaLine(nextLine).complete) return false;
    setLines((current) => {
      const empty = current.length === 1 && isUntouchedLine(current[0]);
      const existing = empty ? [] : current;
      return existing.length >= 500 ? current : [...existing, nextLine];
    });
    setQuickAddedCount((count) => count + 1);
    trackProductEvent("rfq_calculator_line_added", { surface: workspace ? "workspace" : "public", standard: item.standard });
    setCompactMode(true);
    setEditingRows((current) => ({ ...current, [id]: false }));
    setExpandedRows((current) => ({ ...current, [id]: false }));
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setCopyState("idle");
    // NEXT1D: never auto-open or scroll to the cart after adding.
    return true;
  }

  function addGuidedTube(draft: GuidedTubeDraft) {
    const reusable = lines.length === 1 && isUntouchedLine(lines[0]);
    if (lines.length >= 500 && !reusable) return;
    const id = reusable ? lines[0].id : newLineId();
    const nextLine = guidedTubeToBuyerLine(draft, id);
    if (!nextLine) return; // Never create a partial article from the guided flow.
    setLines((current) => reusable ? [nextLine] : [...current, nextLine]);
    setGuidedSpecsByLine((current) => ({ ...current, [id]: { ...draft } }));
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setCompactMode(true);
    setExpandedRows((current) => ({ ...current, [id]: false }));
    setEditingRows((current) => ({ ...current, [id]: false }));
    // The confirmed row already contains quantity and theoretical weight;
    // no secondary quantity-entry step or forced focus is needed.
  }

  function insertRfqAiTextLines(proposals: BuyerDistintaDraftLine[]) {
    // Explicit human-approved candidates from the review UI. Recheck even
    // client-provided rows, then let existing server actions validate on save.
    const valid = proposals.filter((line) =>
      Boolean(line.standard && line.grade && calculateBuyerDistintaLine(line).complete)
    );
    const recyclable = lines.length === 1 && isUntouchedLine(lines[0]);
    const capacity = 500 - (recyclable ? 0 : lines.length);
    if (!valid.length || valid.length !== proposals.length || valid.length > capacity) return false;
    const prepared = valid.map((line) => ({ ...line, id: newLineId() }));
    setLines((current) => {
      const recyclable = current.length === 1 && isUntouchedLine(current[0]);
      const base = recyclable ? [] : current;
      return [...base, ...prepared.slice(0, Math.max(0, 500 - base.length))];
    });
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setCopyState("idle");
    setCompactMode(true);
    setEditingRows((current) => ({
      ...current,
      ...Object.fromEntries(prepared.map((line) => [line.id, false])),
    }));
    return true;
  }

  function chooseCatalogOption(id: string, family: string, sizeKey: string, optionId: string) {
    const selected = catalogOptions.find((option) =>
      option.id === optionId && option.family === family && option.sizeKey === sizeKey
    );
    if (!selected) return;
    setSelectedCatalog((current) => ({ ...current, [id]: { family, sizeKey, optionId } }));
    updateLine(id, {
      description: selected.description,
      weightKgM: weightFromCatalogForStandard(selected, lines.find((line) => line.id === id)?.standard ?? ""),
    });
  }

  // The specification belongs to this line: switching its norm never changes
  // previously entered lines, even when their shapes and dimensions match.
  function changeLineStandard(id: string, standard: string) {
    const selection = selectedCatalog[id];
    const reference = catalogOptions.find((option) => option.id === selection?.optionId);
    const guided = guidedSpecsByLine[id];
    const recalculated = (standard === "EN 10219" || standard === "EN 10210") && guided
      ? guidedTubeMeasurement({ ...guided, standard })
      : null;
    updateLine(id, reference
      ? { standard, weightKgM: weightFromCatalogForStandard(reference, standard) }
      : recalculated
        ? { standard, weightKgM: recalculated.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 }) }
        : { standard });
    if (guided) {
      setGuidedSpecsByLine((current) => ({
        ...current,
        [id]: { ...guided, standard: standard === "EN 10219" || standard === "EN 10210" ? standard : "" },
      }));
    }
  }

  function addCatalogLine(option: BuyerDistintaCatalogOption) {
    if (lines.length >= 500 && !(lines.length === 1 && isUntouchedLine(lines[0]))) return;
    const reuse = lines.length === 1 && isUntouchedLine(lines[0]);
    const id = reuse ? lines[0].id : newLineId();
    focusQuantityId.current = id;
    const nextLine: BuyerDistintaDraftLine = {
      ...blankLine(id),
      description: option.description,
      weightKgM: option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 }),
    };
    setLines((current) => reuse ? [nextLine] : [...current, nextLine]);
    setSelectedCatalog((current) => ({
      ...current,
      [id]: { family: option.family, sizeKey: option.sizeKey, optionId: option.id },
    }));
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setQuickQuery("");
    setCompactMode(true);
    setExpandedRows((current) => ({ ...current, [id]: false }));
    setEditingRows((current) => ({ ...current, [id]: true }));
  }

  function duplicateLine(id: string) {
    if (lines.length >= 500) return;
    const source = lines.find((line) => line.id === id);
    if (!source || !source.description.trim()) return;
    const duplicateId = newLineId();
    const copy = { ...source, id: duplicateId, quantity: "" };
    if (guidedSpecsByLine[id]) {
      setGuidedSpecsByLine((current) => ({ ...current, [duplicateId]: { ...current[id] } }));
    }
    setExpandedRows((current) => ({ ...current, [duplicateId]: false }));
    setEditingRows((current) => ({ ...current, [duplicateId]: true }));
    focusQuantityId.current = duplicateId;
    setLines((current) => {
      const index = current.findIndex((line) => line.id === id);
      if (index === -1 || current.length >= 500) return current;
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    const selection = selectedCatalog[id];
    if (selection) {
      setSelectedCatalog((current) => ({ ...current, [duplicateId]: { ...selection } }));
    }
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
  }

  function toggleRowDetails(id: string) {
    setExpandedRows((current) => ({ ...current, [id]: !(current[id] ?? !compactMode) }));
  }

  function addLine() {
    if (lines.length >= 500) return;
    setSavedId(null);
    setSaveMessage(null);
    if (initialEmptyRow) {
      // The initial blank row is recyclable; opening manual mode must not
      // create a second empty line and break completion unexpectedly.
      setEditingRows((current) => ({ ...current, [lines[0].id]: true }));
      return;
    }
    const id = newLineId();
    setEditingRows((current) => ({ ...current, [id]: true }));
    setLines((current) =>
      current.length >= 500 ? current : [...current, blankLine(id)],
    );
  }

  function removeLine(id: string) {
    setSavedId(null);
    setSaveMessage(null);
    setSelectedCatalog((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setExpandedRows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditingRows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setGuidedSpecsByLine((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLines((current) =>
      current.length === 1
        ? [blankLine(newLineId())]
        : current.filter((line) => line.id !== id),
    );
  }

  function goToIncompleteRow() {
    const index = calculated.findIndex((line) => !line.complete);
    if (index < 0) return;
    const row = lines[index];
    if (initialEmptyRow) {
      setIntakeMode("manual");
      document.getElementById("rfqai2-intake-modes")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setEditingRows((current) => ({ ...current, [row.id]: true }));
    // A provided but invalid target is editable in this row's details panel.
    if (row.targetEurT.trim() && calculated[index].targetEurT === null) {
      setExpandedRows((current) => ({ ...current, [row.id]: true }));
    }
    // The row editor is now portaled into the drawer on demand.
    if (!cartOpen) {
      pendingCartRowRef.current = row.id;
      openPrivateCart();
      return;
    }
    const element = document.getElementById("buyer-row-" + row.id);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  async function copyDistinta() {
    const valid = calculated.filter((line) => line.complete);
    if (!valid.length || valid.length !== calculated.length) {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
      return;
    }

    const plain = buildBuyerDistintaPlainText(title, valid, documents);
    const html = buildBuyerDistintaHtml(title, valid, documents);

    try {
      if (
        navigator.clipboard &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard.write
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plain], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      trackProductEvent("rfq_bill_copied", { surface: workspace ? "workspace" : "public", line_count: valid.length });
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  function saveDistinta() {
    if (savedId) {
      setSaveMessage("Distinta già salvata: puoi creare la RFQ senza salvarla di nuovo.");
      return;
    }
    if (savePending || rfqPending) return;
    setSaveMessage(null);
    startSaveTransition(async () => {
      const result = await saveBuyerDistinta({ title, lines, documents });
      if (!result.ok || !result.distintaId) {
        setSaveMessage(result.error ?? "Salvataggio non riuscito.");
        return;
      }
      setSavedId(result.distintaId);
      try { window.sessionStorage.removeItem(draftKey); } catch { /* optional storage */ }
      setSaveMessage("Distinta salvata nel tuo spazio privato.");
    });
  }

  function createRfqHub() {
    // One deliberate click creates a private draft only: never send email, dispatch
    // supplier invitations or publish a marketplace listing from this action.
    if (!authenticated || !draftReady || restoreCandidate || !allComplete) {
      setRfqMessage("Completa le righe della distinta e accedi con una azienda attiva prima di creare la RFQ.");
      if (!allComplete) goToIncompleteRow();
      return;
    }
    if (rfqInFlightRef.current || rfqPending || savePending) return;
    rfqInFlightRef.current = true;
    setRfqMessage(null);
    startRfqTransition(async () => {
      try {
        const result = await createPrivateRfqOneStep({
          existingDistintaId: savedId,
          save: () => saveBuyerDistinta({ title, lines, documents }),
          create: (savedId) => createBuyerRfqCampaign(savedId),
          onSaved: (id) => {
            setSavedId(id);
            try { window.sessionStorage.removeItem(draftKey); } catch { /* optional tab-scoped draft */ }
          },
        });
        if (!result.ok) {
          setRfqMessage(result.error);
          return;
        }
        if (returnToCommercial) {
          router.push(appRoutes.commercial.home + "?item=campaign:" + encodeURIComponent(result.rfqId) + "#commercial-detail");
        } else {
          // Existing public and RFQ Hub flows keep their canonical deep link.
          router.push(appRoutes.rfqHub.campaign(result.rfqId));
        }
      } finally {
        rfqInFlightRef.current = false;
      }
    });
  }

  function sendDistinta() {
    if (!savedId) {
      setSendMessage("Salva prima la distinta, poi puoi inviarla ai fornitori.");
      return;
    }

    const recipients = recipientInput
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    setSendMessage(null);
    startSendTransition(async () => {
      const result = await sendBuyerDistinta({
        distintaId: savedId,
        recipients,
        subject: emailSubject,
        message: emailMessage,
      });

      if (!result.ok) {
        setSendMessage(result.error ?? "Invio non riuscito.");
        return;
      }
      setSendMessage(
        "Distinta inviata a " +
          String(result.sentCount ?? recipients.length) +
          ((result.sentCount ?? recipients.length) === 1 ? " fornitore." : " fornitori."),
      );
    });
  }

  return (
    <div className="bd54-page space-y-4 sm:space-y-5" lang={uiLocale}>\n      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-strong)] bg-white px-3 py-2" data-testid="buyer-private-language-switch">\n        <p className="text-xs font-semibold text-[var(--brand-deep)]">{t("RFQ privata · nessun invio automatico")}</p>\n        <label className="flex items-center gap-2 text-xs font-bold text-[var(--brand-deep)]">{t("Scegli la lingua")}\n          <select aria-label={t("Scegli la lingua")} value={uiLocale} onChange={e=>setUiLocale(safeBuyerUiLocale(e.target.value))}\n            className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-white px-2 text-sm text-[var(--brand-deep)]">\n            {(["it","en","de","fr","es"] as const).map(lang=><option key={lang} value={lang}>{lang.toUpperCase()}</option>)}\n          </select>\n        </label>\n      </div>
      {networkHandoff&&workspace&&!restoreCandidate?<aside aria-label="Articoli approvati dal Network"
        data-testid="network-reviewed-rfq-import"
        className="rounded-xl border border-[#b7d1c4] bg-[#f1faf4] p-3 sm:p-4">
        <p className="text-sm font-bold text-[#173f35]">Dal Network · {networkHandoff.lines.length} articoli verificati</p>
        <p className="mt-1 text-xs leading-5 text-[#52615b]">
          Hai confermato queste righe nella chat Network. Puoi aggiungerle alla distinta qui sotto,
          mantenendo gli articoli già presenti. Non viene creata o inviata alcuna RFQ.
        </p>
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-[#173f35]">
          {networkHandoff.lines.map(line=><li key={line.id}>
            {line.description} · {line.standard} · {line.grade} · {line.quantity} {line.quantityMode==="bars"?"barre":line.quantityMode==="meters"?"m":"t"} · {line.barLengthM} m/barra
          </li>)}
        </ul>
        {networkHandoffError?<p role="alert" className="mt-2 text-xs text-[#875117]">{networkHandoffError}</p>:null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={importNetworkHandoff}
            className="ui-action ui-action-primary min-h-10 rounded-lg px-3 text-xs font-semibold">
            Aggiungi {networkHandoff.lines.length} articoli alla distinta
          </button>
          <button type="button" onClick={discardNetworkHandoff}
            className="ui-action ui-action-secondary min-h-10 rounded-lg px-3 text-xs font-semibold">
            Scarta passaggio
          </button>
        </div>
      </aside>:null}
      {networkHandoffError&&!networkHandoff?<p role="alert" className="text-xs text-[#875117]">{networkHandoffError}</p>:null}
      {calculatorHandoffCount > 0 ? (
        <aside role="status" aria-live="polite" className="rounded-xl border border-[#b5d9c7] bg-[#edf8f1] px-4 py-3 text-sm text-[#123b34]">
          <strong>{calculatorHandoffCount === 1 ? "Misura importata dal calcolatore" : calculatorHandoffCount + " misure importate dal calcolatore"} ✓</strong>
          <p className="mt-1 text-xs leading-5">Norma, geometria, lunghezza, numero barre e kg/m teorico sono già nella distinta. Verifica il grado acciaio e i requisiti di fornitura prima di inviare la richiesta. Nessuna RFQ è stata inviata.</p>
        </aside>
      ) : null}
      {calculatorHandoffOverflow ? <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Distinta piena: alcune misure rimangono in attesa nella scheda. Rimuovi righe prima di importarle.</p> : null}
      {restoreCandidate ? (
        <aside className="rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] p-3 sm:p-4" aria-label="Bozza da recuperare">
          <p className="text-sm font-bold text-[var(--brand-deep)]">Bozza trovata in questa scheda</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {restoreCandidate.draft.lines.length} righe, ultima modifica in questa sessione.
            Riprendila soltanto se è la tua richiesta: niente è stato inviato o salvato online.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={restoreBrowserDraft}
              className="platform-primary min-h-11 rounded-lg px-4 text-sm font-bold">
              Riprendi la distinta
            </button>
            <button type="button" onClick={discardBrowserDraft}
              className="app-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">
              Scarta e crea nuova
            </button>
          </div>
        </aside>
      ) : null}
      {workspace && !restoreCandidate ? (
        <p className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-secondary)]">
          RFQ Hub · Le modifiche non ancora salvate sono temporanee e rimangono solo in questa scheda.
          Salva la distinta per registrarla nel tuo account aziendale.
        </p>
      ) : null}
      <aside className="bd53-hud" aria-label="Riepilogo in tempo reale della distinta">
        <div className="bd53-hud-progress">
          <span className="bd53-hud-caption">Righe pronte</span>
          <span className="bd53-hud-complete">{totals.completeLines}/{activeLineCount}</span>
          <div
            className="bd53-hud-track"
            role="progressbar"
            aria-label="Righe complete nella distinta"
            aria-valuemin={0}
            aria-valuemax={activeLineCount}
            aria-valuenow={totals.completeLines}
          >
            <span
              className="bd53-hud-progress-fill"
              style={{ width: (activeLineCount ? totals.completeLines / activeLineCount : 0) * 100 + "%" }}
            />
          </div>
        </div>
        <div className="bd53-hud-metrics">
          <div className="bd53-hud-metric">
            <span>Metri</span>
            <strong>{formatNumber(totals.totalMeters, 2)}</strong>
          </div>
          <div className="bd53-hud-metric">
            <span>Tonnellate</span>
            <strong>{formatNumber(totals.totalTonnes, 3)}</strong>
          </div>
          {!allComplete ? <span className="bd53-hud-partial">Totali parziali</span> : null}
        </div>
        <button
          type="button"
          onClick={allComplete ? (authenticated ? createRfqHub : copyDistinta) : goToIncompleteRow}
          disabled={(allComplete && !authenticated && copyState === "copied") || rfqPending || savePending || !draftReady || Boolean(restoreCandidate)}
          className="bd53-hud-action"
        >
          {!allComplete ? t("Completa le righe")
            : authenticated ? (rfqPending ? t("Creazione RFQ…") : t("Crea RFQ privata →"))
              : copyState === "copied" ? t("Copiata ✓") : copyState === "error" ? t("Riprova copia") : t("Copia distinta")}
        </button>
      </aside>
      <section className="rounded-3xl border border-[#d8e1dd] bg-white p-3 shadow-[0_16px_50px_rgba(18,61,52,0.06)] sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c6dccc] bg-[#f4faf7] px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-[#173f35]">Calcola qui, gestisci nel carrello</p>
            <p className="text-[11px] text-[#50695a]">{activeLineCount} {t("righe")} · {formatNumber(totals.totalMeters,2)} m · {formatNumber(totals.totalTonnes,3)} t</p>
          </div>
          <button type="button" data-testid="private-cart-inline-open"
            onClick={openPrivateCart} aria-haspopup="dialog" aria-expanded={cartOpen}
            aria-controls="buyer-live-preview-dialog"
            className="ui-action ui-action-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold">
            <span aria-hidden="true">▤</span> {t("Apri carrello")} · {activeLineCount}
          </button>
        </div>
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              {t(workspace ? "RFQ Hub · Distinta privata" : "Creazione articoli")}
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--brand-deep)]">
              Articoli in distinta
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
Scegli forma e dimensioni, inserisci le barre e aggiungi con un clic. Il carrello aggiorna righe e peso senza aprirsi automaticamente.
            </p>
          </div>
          <label className="w-full max-w-sm text-xs font-semibold text-[var(--text-secondary)]">
            Titolo distinta
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSavedId(null);
                setEmailSubject(event.target.value || "Richiesta di offerta");
              }}
              className="mt-1 h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm font-semibold text-[var(--text-primary)]"
            />
          </label>
        </div>


        <div className="bd7-workbench" style={{gridTemplateColumns:"minmax(0,1fr)"}}>
          <div className="bd7-workbench-editor">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2 rounded-xl border border-[#cddbd6] bg-[#f4faf7] p-3">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[#123d34]">1 · Calcola e aggiungi</h3>
                <p className="mt-1 text-xs text-[#52615b]">Norma, forma, dimensioni e quantità. Un clic per aggiungere la riga senza uscire.</p>
              </div>
              <label className="min-w-[145px] flex-1 text-xs font-bold text-[#344e43] sm:max-w-[215px]">
                Grado acciaio · facoltativo ora
                <input list="buyer-quick-grades" value={quickGrade} onChange={(event) => setQuickGrade(event.target.value)}
                  placeholder="Es. S355J2H" className="mt-1 h-11 w-full rounded-lg border border-[#b9d0c5] bg-white px-3 text-sm text-[#123d34]" />
                <datalist id="buyer-quick-grades"><option value="S235JRH" /><option value="S275J0H" /><option value="S355J2H" /><option value="S355K2H" /></datalist>
              </label>
            </div>
            <PublicTubeWeightCalculator references={[]} discoveryOptions={discoveredBuyerDimensions} locale={uiLocale} onAddToDistinta={addCalculatorLine}
              canAddToDistinta={draftReady && !restoreCandidate && (lines.length < 500 || initialEmptyRow)} />
            <p role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-[#1d5748]">
              {quickAddedCount > 0 ? `${quickAddedCount} ${quickAddedCount === 1 ? "articolo nel carrello" : "articoli nel carrello"} · aprilo quando vuoi.` : "Il peso teorico si aggiorna mentre scrivi; nessuna RFQ viene inviata automaticamente."}
            </p>
            <details className="mt-4 rounded-xl border border-[#d5e1db] bg-white">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 text-xs font-bold text-[#1d5748]">Altri metodi · testo AI, configuratore assistito e ricerca catalogo</summary>
              <div className="border-t border-[#d5e1db] p-2 sm:p-3">
            <RfqAiIntakeUx
              mode={intakeMode}
              onModeChange={setIntakeMode}
              workspace={workspace}
              authenticated={authenticated}
              onInsertTextLines={insertRfqAiTextLines}
            >
            <BuyerTubeGuidedCreator
              key={wizardRestoreSerial}
              initialDraft={previewDraft}
              catalogOptions={catalogOptions}
              onAdd={addGuidedTube}
              onDraftChange={setPreviewDraft}
              canAdd={lines.length < 500 || (lines.length === 1 && isUntouchedLine(lines[0]))}
            />

        <details className="bd6-legacy-search">
          <summary className="bd6-legacy-summary">Ricerca rapida alternativa · misure pubblicate e compilazione libera</summary>
        <section aria-label="Ricerca rapida articoli" className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--brand-deep)]">Aggiunta rapida degli articoli</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Trova una misura pubblica, aggiungila e compila la quantità. Per altri articoli usa la riga libera.
              </p>
            </div>
            <button
              type="button"
              aria-pressed={!compactMode}
              onClick={() => {
                setCompactMode((current) => !current);
                setExpandedRows({});
              }}
              className={!compactMode
                ? "platform-primary min-h-11 rounded-xl px-4 text-xs font-bold"
                : "min-h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-xs font-bold text-[var(--brand-deep)] hover:bg-[var(--surface-muted)]"}
            >
              {compactMode ? "Mostra tutti i dettagli" : "Comprimi tutte le righe"}
            </button>
          </div>
          <label className="mt-3 block text-xs font-semibold text-[var(--text-secondary)]">
            Cerca per forma, dimensioni o spessore
            <input
              type="search"
              value={quickQuery}
              onChange={(event) => setQuickQuery(event.target.value)}
              placeholder="Es. quadro 100x100x4, tondo 60,3x3"
              autoComplete="off"
              className="mt-1.5 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
          {quickQuery.trim() ? (
            <div className="mt-3" aria-live="polite">
              {catalogOptions.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">Catalogo pubblico non disponibile. Aggiungi una riga libera.</p>
              ) : quickMatches.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">Nessuna misura trovata. Prova una ricerca diversa oppure usa una riga libera.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickMatches.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => addCatalogLine(option)}
                      disabled={lines.length >= 500}
                      aria-label={"Aggiungi " + option.description}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0 font-semibold">{option.description}</span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                        {option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 })} kg/m <span aria-hidden="true">＋</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {quickMatches.length === 8 ? (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">Mostriamo i primi 8 risultati: affina la ricerca per trovare la misura desiderata.</p>
              ) : null}
            </div>
          ) : null}
        </section>
        </details>
            </RfqAiIntakeUx>
              </div>
            </details>
          </div>
          <TechnicalCartShell visible={activeLineCount > 0} open={cartOpen}
            onOpen={openPrivateCart} onClose={() => setCartOpen(false)}
            count={activeLineCount} title={t("La tua distinta")} eyebrow={t("Commerciale · Carrello privato")}
            summary={`${formatNumber(totals.totalMeters, 2)} m · ${formatNumber(totals.totalTonnes, 3)} t · ${totals.completeLines}/${activeLineCount} ${t("righe pronte")}`}
            closeLabel={t("Chiudi")} dialogId="buyer-live-preview-dialog"
            dialogAriaLabel={t("Carrello della distinta privata")} titleId="buyer-live-preview-title"
            triggerTestId="private-cart-trigger" overlayTestId="private-cart-overlay"
            restoreFocusRef={cartReturnFocusRef} pendingFocusRowRef={pendingCartRowRef} wide>
          <aside className="bd7-preview" id="buyer-live-preview" style={{ scrollMarginTop: "6rem",position:"static",top:"auto" }} aria-label="Distinta in composizione">
            <div className="bd7-preview-head">
              <div>
                <p className="bd6-eyebrow">Anteprima in tempo reale</p>
                <h3 className="text-sm font-extrabold text-[var(--brand-deep)]">2 · {t("La tua distinta")}</h3>
              </div>
              <span className="bd7-preview-counter">{totals.completeLines}/{activeLineCount} righe</span>
            </div>
            {previewDraft && (previewDraft.family || previewDraft.standard || previewDraft.grade) ? (
              <div className="bd7-draft-pending">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">In configurazione</span>
                <p className="mt-1 text-xs font-semibold text-[var(--brand-deep)]">
                  {guidedTubeMeasurement(previewDraft)?.description ||
                    [previewDraft.family ? buyerTubeFamilyLabels[previewDraft.family] : "", previewDraft.standard, previewDraft.grade].filter(Boolean).join(" · ")}
                </p>
                {guidedTubeMeasurement(previewDraft) ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatNumber(guidedTubeMeasurement(previewDraft)!.weightKgM, 3)} kg/m teorici
                  </p>
                ) : null}
              </div>
            ) : null}
            {activeLineCount === 0 ? (
              <p className="bd9-preview-empty">Nessun articolo ancora inserito. Scegli misura e quantità nella calcolatrice e premi “Aggiungi alla distinta”.</p>
            ) : null}
                    <div className="bd10-preview-lines" aria-label="Articoli della distinta">
        <datalist id="buyer-standards"><option value="EN 10219" /><option value="EN 10210" /><option value="EN 10305" /></datalist>
        <datalist id="buyer-grades"><option value="S235JRH" /><option value="S275J0H" /><option value="S355J2H" /></datalist>
        <datalist id="buyer-finishes"><option value="Nero" /><option value="Zincato" /><option value="Decapato" /></datalist>
        <p className="bd10-preview-help">Ogni riga è pronta per la richiesta e può essere modificata qui, senza un secondo passaggio.</p>
        <div className="mt-3 space-y-3 sm:space-y-4">
          {lines.map((line, index) => {
            const calc = calculated[index];
            const detailOpen = expandedRows[line.id] ?? !compactMode;
            const editOpen = editingRows[line.id] ?? false;
            const invalidTarget = line.targetEurT.trim() !== "" && calc.targetEurT === null;
            const rowStage = calc.complete ? "complete" : isUntouchedLine(line) ? "empty" : "pending";
            const selection = selectedCatalog[line.id] ?? { family: "", sizeKey: "", optionId: "" };
            const familyOptions = catalogOptions.filter((option) => option.family === selection.family);
            const sizeChoices = familyOptions.filter((option, optionIndex, all) =>
              all.findIndex((candidate) => candidate.sizeKey === option.sizeKey) === optionIndex
            );
            const thicknessChoices = familyOptions.filter((option) => option.sizeKey === selection.sizeKey);

            return (
              <article
                key={line.id}
                id={"buyer-row-" + line.id}
                tabIndex={-1}
                aria-label={`Riga ${index + 1}: ${calc.complete ? "completa" : rowStage === "empty" ? "da iniziare" : "da completare"}`}
                data-stage={rowStage}
                hidden={initialEmptyRow && !editingRows[line.id]}
                className="bd5-row-card bd10-preview-row"
              >
                <div className="bd10-row-summary">
                  <span className="bd7-preview-number" aria-hidden="true">{index + 1}</span>
                  <div className="bd10-row-summary-content">
                    <strong>{line.description.trim() || t("Articolo da compilare")}</strong>
                    <span>{line.standard || t("Norma da scegliere")}{line.grade ? " · " + line.grade : ""}</span>
                    <span>{calc.quantity !== null
                      ? formatNumber(calc.quantity, line.quantityMode === "bars" ? 0 : 2) + " " +
                        (line.quantityMode === "bars" ? "barre" : line.quantityMode === "meters" ? "m" : "t")
                      : t("Quantità mancante")} · {formatNumber(calc.meters, 2)} m · {formatNumber(calc.tonnes, 3)} t
                      {" · "}{formatNumber(calc.weightKgM, 3)} kg/m
                      {calc.targetEurT !== null ? " · Target " + formatNumber(calc.targetEurT, 2) + " €/t" : ""}</span>
                  </div>
                  <div className="bd10-row-actions">
                    <button type="button" className="bd10-edit-button"
                      aria-expanded={editOpen}
                      aria-controls={"buyer-inline-editor-" + line.id}
                      onClick={() => setEditingRows((current) => ({ ...current, [line.id]: !editOpen }))}>
                      {t(editOpen ? "Chiudi" : "Modifica")}
                    </button>
                    <button type="button" className="bd10-mini-action" title="Duplica articolo"
                      aria-label={`Duplica articolo riga ${index + 1}`}
                      disabled={!line.description.trim() || lines.length >= 500}
                      onClick={() => duplicateLine(line.id)}>⧉</button>
                    <button type="button" className="bd10-mini-action bd10-mini-danger" title="Rimuovi articolo"
                      aria-label={`Rimuovi articolo riga ${index + 1}`}
                      onClick={() => removeLine(line.id)}>×</button>
                  </div>
                </div>
                <div id={"buyer-inline-editor-" + line.id} className="bd10-row-editor" hidden={!editOpen}>
                  <div className="bd5-row-header">
                  <span className="bd5-row-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <label className="bd52-field bd52-field-description">
                    Articolo *
                    <input
                      value={line.description}
                      onChange={(event) => updateLine(line.id, { description: event.target.value })}
                      placeholder="Tubo quadro 100 × 100 × 4 mm"
                      className="bd52-input"
                    />
                  </label>
                  <label className="bd8-inline-norm bd52-field">
                    Norma
                    <select
                      aria-label={`Norma della riga ${index + 1}`}
                      value={line.standard}
                      onChange={(event) => changeLineStandard(line.id, event.target.value)}
                      className="bd52-input"
                    >
                      <option value="">{t("Scegli")}</option>
                      <option value="EN 10219">EN 10219</option>
                      <option value="EN 10210">EN 10210</option>
                      {line.standard && !["EN 10219", "EN 10210"].includes(line.standard)
                        ? <option value={line.standard}>{line.standard}</option> : null}
                    </select>
                  </label>
                  <label className="bd8-inline-grade bd52-field">
                    Grado
                    <input
                      list="buyer-grades"
                      aria-label={`Grado della riga ${index + 1}`}
                      value={line.grade}
                      onChange={(event) => updateLine(line.id, { grade: event.target.value })}
                      placeholder="S355J2H"
                      className="bd52-input"
                    />
                  </label>
                  <span className="bd5-status-badge" title={calc.complete ? "Completa" : rowStage === "empty" ? "Da iniziare" : "Da completare"}>
                    <span aria-hidden="true" className="bd5-status-dot" />
                    <span className="sr-only">{calc.complete ? "Completa" : rowStage === "empty" ? "Da iniziare" : "Da completare"}</span>
                  </span>
                </div>
                <div className="bd5-row-body">
                  <div className="bd52-core">
                    <div className="bd52-core-fields">
                      <label className="bd52-field bd52-field-quantity">
                        Quantità *
                        <input
                          id={"buyer-quantity-" + line.id}
                          inputMode="decimal"
                          aria-label={`Quantità riga ${index + 1}`}
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                          placeholder="0"
                          className="bd52-input bd52-quantity-input"
                        />
                      </label>
                      <label className="bd52-field bd52-field-unit">
                        Unità
                        <select
                          value={line.quantityMode}
                          onChange={(event) => updateLine(line.id, { quantityMode: event.target.value as BuyerQuantityMode })}
                          className="bd52-input"
                        >
                          <option value="meters">{t("Metri")}</option>
                          <option value="bars">{t("Barre / pezzi")}</option>
                          <option value="tonnes">{t("Tonnellate")}</option>
                        </select>
                      </label>
                      {line.quantityMode === "bars" ? (
                        <label className="bd52-field bd52-field-bars">
                          Barra (m) *
                          <input
                            inputMode="decimal"
                            value={line.barLengthM}
                            onChange={(event) => updateLine(line.id, { barLengthM: event.target.value })}
                            placeholder="12"
                            className="bd52-input"
                          />
                        </label>
                      ) : null}
                      <label className="bd52-field bd52-field-weight">
                        Peso kg/m *
                        <input
                          inputMode="decimal"
                          value={line.weightKgM}
                          onChange={(event) => updateLine(line.id, { weightKgM: event.target.value })}
                          placeholder="kg/m"
                          className="bd52-input"
                        />
                      </label>
                      <div className="bd8-tonnes" aria-label={`Peso riga ${index + 1}`}>
                        <span>Tonnellate</span>
                        <strong className="bd52-weight-pill">{formatNumber(calc.tonnes, 3)} t</strong>
                      </div>
                      <button
                        type="button"
                        aria-expanded={detailOpen}
                        aria-controls={"buyer-details-" + line.id}
                        aria-label={(detailOpen ? "Chiudi dettagli riga " : "Apri dettagli riga ") + String(index + 1)}
                        onClick={() => toggleRowDetails(line.id)}
                        className="bd52-details-toggle"
                      >
                        {t(detailOpen ? "Chiudi" : invalidTarget ? "Correggi target" : "Dettagli e opzioni")}
                        <span aria-hidden="true" className={detailOpen ? "bd52-chevron bd52-chevron-open" : "bd52-chevron"}>⌄</span>
                      </button>
                      <div className="bd5-row-actions flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateLine(line.id)}
                          disabled={!line.description.trim() || lines.length >= 500}
                          title="Duplica articolo (quantità vuota, norma invariata)"
                          aria-label={`Duplica articolo riga ${index + 1}`}
                          className="bd5-row-action bd8-icon-button"
                        >
                          <span aria-hidden="true">⧉</span><span className="sr-only">Duplica articolo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="bd5-row-action bd5-row-action-danger bd8-icon-button"
                          aria-label={`Rimuovi riga ${index + 1}`}
                          title="Rimuovi articolo"
                        >
                          <span aria-hidden="true">×</span><span className="sr-only">Rimuovi</span>
                        </button>
                      </div>
                    </div>
                    {(line.targetEurT.trim() || line.finish || line.note) ? (
                      <div className="bd52-core-footer">
                        {line.targetEurT.trim()
                          ? <span>{invalidTarget ? "Verifica Target €/t" : `Target ${formatNumber(calc.targetEurT, 2)} €/t`}</span> : null}
                        {line.finish ? <span>Finitura: {line.finish}</span> : null}
                        {line.note ? <span>Nota inserita</span> : null}
                      </div>
                    ) : null}
                  </div>

                <div
                  id={"buyer-details-" + line.id}
                  hidden={!detailOpen}
                  className="bd52-detail-panel"
                >
                  <div className="bd52-detail-section">
                    <p className="bd52-detail-heading">Misure da catalogo Knowledge</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="bd52-field">
                        Tipo di tubo
                        <select
                          aria-label={`Tipo di tubo, riga ${index + 1}`}
                          value={selection.family}
                          onChange={(event) => chooseFamily(line.id, event.target.value)}
                          className="bd52-input"
                        >
                          <option value="">Compilazione libera</option>
                          {(["round_tube", "square_tube", "rectangular_tube"] as const).map((family) => (
                            <option key={family} value={family}>{buyerTubeFamilyLabels[family]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="bd52-field">
                        Misura
                        <select
                          aria-label={`Misura, riga ${index + 1}`}
                          value={selection.sizeKey}
                          disabled={!selection.family || sizeChoices.length === 0}
                          onChange={(event) => chooseSize(line.id, selection.family, event.target.value)}
                          className="bd52-input"
                        >
                          <option value="">Scegli misura</option>
                          {sizeChoices.map((option) => (
                            <option key={option.sizeKey} value={option.sizeKey}>{option.sizeLabel}</option>
                          ))}
                        </select>
                      </label>
                      <label className="bd52-field">
                        Spessore
                        <select
                          aria-label={`Spessore, riga ${index + 1}`}
                          value={selection.optionId}
                          disabled={!selection.sizeKey || thicknessChoices.length === 0}
                          onChange={(event) => chooseCatalogOption(line.id, selection.family, selection.sizeKey, event.target.value)}
                          className="bd52-input"
                        >
                          <option value="">Scegli spessore</option>
                          {thicknessChoices.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.thicknessMm.toLocaleString("it-IT")} mm · {option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 })} kg/m
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {catalogOptions.length === 0 ? (
                      <p className="mt-2 text-xs text-[var(--semantic-warning)]">
                        Riferimenti pubblici temporaneamente non disponibili: usa la compilazione libera.
                      </p>
                    ) : null}
                    {selection.optionId ? (
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Il peso precompilato è indicativo; verifica sempre specifiche e tolleranze richieste.
                      </p>
                    ) : null}
                  </div>
                  <div className="bd52-detail-section">
                    <p className="bd52-detail-heading">Specifiche e condizioni (facoltative)</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="bd52-field">
                        Norma
                        <input
                          list="buyer-standards"
                          value={line.standard}
                          onChange={(event) => changeLineStandard(line.id, event.target.value)}
                          placeholder="EN 10219"
                          className="bd52-input"
                        />
                      </label>
                      <label className="bd52-field">
                        Grado
                        <input
                          list="buyer-grades"
                          value={line.grade}
                          onChange={(event) => updateLine(line.id, { grade: event.target.value })}
                          placeholder="S355J2H"
                          className="bd52-input"
                        />
                      </label>
                      <label className="bd52-field">
                        Finitura
                        <input
                          list="buyer-finishes"
                          value={line.finish}
                          onChange={(event) => updateLine(line.id, { finish: event.target.value })}
                          placeholder="Nero / zincato"
                          className="bd52-input"
                        />
                      </label>
                      <label className="bd52-field">
                        Target €/t (facoltativo)
                        <input
                          inputMode="decimal"
                          value={line.targetEurT}
                          onChange={(event) => updateLine(line.id, { targetEurT: event.target.value })}
                          placeholder="Opzionale"
                          className="bd52-input"
                        />
                      </label>
                      <div className="bd52-field">
                        Target €/m (calcolato)
                        <output className="bd52-output">{formatNumber(calc.targetEurM, 4)}</output>
                      </div>
                      <label className="bd52-field">
                        Note
                        <input
                          value={line.note}
                          onChange={(event) => updateLine(line.id, { note: event.target.value })}
                          placeholder="Tolleranze, consegna…"
                          className="bd52-input"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {!calc.complete && rowStage === "pending" ? (
                  <p className="bd5-row-hint mt-3 text-xs leading-5">
                    Completa descrizione, quantità e peso kg/m. Il Target €/t è facoltativo, ma se inserito deve essere positivo.
                  </p>
                ) : null}
                </div>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addLine}
          disabled={lines.length >= 500}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 text-sm font-bold text-[#173f35] hover:bg-[#e1ece8]"
        >
          + {t("Aggiungi riga libera").replace(/^\+\s*/, "")}
        </button>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">{lines.length} / 500 righe · Duplica per riutilizzare le specifiche senza ripetere la quantità.</p>
        </div>
            <div className="bd7-preview-totals">
              <span>{formatNumber(totals.totalMeters, 2)} m</span>
              <strong>{formatNumber(totals.totalTonnes, 3)} t</strong>
            </div>
            {authenticated ? (
              <div className="mt-3 rounded-xl border border-[#c5ddd0] bg-[#f0f8f3] p-3">
                <button type="button" onClick={createRfqHub}
                  disabled={!allComplete || !draftReady || Boolean(restoreCandidate) || rfqPending || savePending}
                  className="platform-primary flex min-h-12 w-full items-center justify-center rounded-lg px-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50">
                  {rfqPending ? t("Salvataggio e creazione…") : t("Crea RFQ privata →")}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-[#34594c]">
                  Salva la distinta e crea la RFQ con un clic. Bozza privata: nessun invio ai fornitori.
                </p>
                {rfqMessage ? <p role="alert" className="mt-2 text-xs font-semibold text-[#95420e]">{rfqMessage}</p> : null}
              </div>
            ) : (
              <Bd17GuestRfqCta
                eligible={!workspace && allComplete && draftReady && !restoreCandidate}
                onNavigate={persistBrowserDraft}
              />
            )}
            <details className="bd7-global-documents">
              <summary className="bd7-doc-summary">
                <span className="font-bold">Documentazione richiesta · intera distinta</span>
                <span className="bd7-doc-caption">{t(formatBuyerDocumentRequirements(documents) ? "Condizioni impostate" : "Facoltativa")}</span>
              </summary>
              <div className="bd7-doc-fields">
                <label className="bd6-dimension-field">
                  Certificato di controllo EN 10204
                  <select
                    value={documents.inspectionDocument}
                    onChange={(event) => {
                      setDocuments((current) => ({ ...current, inspectionDocument: event.target.value as BuyerDistintaDocumentRequirements["inspectionDocument"] }));
                      setSavedId(null);
                    }}
                    className="bd6-input"
                  >
                    <option value="">{t("Non specificato")}</option>
                    <option value="2.1">2.1 · Dichiarazione conformità</option>
                    <option value="2.2">2.2 · Rapporto di prova</option>
                    <option value="3.1">3.1 · Certificato materiale</option>
                    <option value="3.2">3.2 · Con ispezione indipendente</option>
                  </select>
                </label>
                <label className="bd6-check">
                  <input type="checkbox" checked={documents.ceDop} onChange={(event) => {
                    setDocuments((current) => ({ ...current, ceDop: event.target.checked })); setSavedId(null);
                  }} />
                  Marcatura CE + DoP, se applicabili
                </label>
                <label className="bd6-check">
                  <input type="checkbox" checked={documents.iso9001} onChange={(event) => {
                    setDocuments((current) => ({ ...current, iso9001: event.target.checked })); setSavedId(null);
                  }} />
                  Produttore certificato UNI EN ISO 9001
                </label>
                <p className="text-[11px] leading-4 text-[var(--text-secondary)]">
                  Vale per tutta la richiesta; non viene ripetuto in ogni articolo. CE/DoP, EN 10204 e ISO 9001 hanno finalità differenti.
                </p>
              </div>
            </details>
            {formatBuyerDocumentRequirements(documents) ? (
              <p className="bd7-preview-doc-note">{formatBuyerDocumentRequirements(documents)}</p>
            ) : null}
          </aside>
          </TechnicalCartShell>
        </div>


      </section>

      <details className="rounded-2xl border border-[#d8e1dd] bg-white shadow-sm">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 text-sm font-bold text-[#174e40]">
          Altre opzioni · salva solo la distinta o invia direttamente via email
        </summary>
        <div className="grid gap-6 border-t border-[#d8e1dd] p-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Spazio privato
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Salva soltanto la distinta.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Lo snapshot resta privato e separato dai contenuti pubblici. Potrai usarlo come base per richieste e invii ai fornitori.
            </p>

            {authenticated ? (
              <button
                type="button"
                disabled={!allComplete || savePending || rfqPending}
                onClick={saveDistinta}
                className="platform-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t(savePending ? "Salvataggio…" : savedId ? "Salvata ✓" : "Salva distinta")}
              </button>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={"/login?next=" + encodeURIComponent(appRoutes.rfqHub.createDistinta)}
                  onClick={persistBrowserDraft}
                  className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold"
                >
                  Accedi per salvare
                </Link>
                <Link
                  href="/register"
                  onClick={persistBrowserDraft}
                  className="app-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
                >
                  Registra azienda
                </Link>
              </div>
            )}

            {savedId ? (
              <p className="mt-3 rounded-xl bg-[#edf5f2] px-3 py-2 text-xs font-semibold text-[#173f35]">
                Distinta salvata ✓ · per creare la RFQ usa il pulsante principale qui sopra.
              </p>
            ) : null}

            {saveMessage ? (
              <p className="mt-3 text-xs font-semibold text-[#52615b]">{saveMessage}</p>
            ) : null}
            {rfqMessage ? (
              <p className="mt-2 text-xs font-semibold text-[#7b6a43]">{rfqMessage}</p>
            ) : null}
          </div>

          <div className="border-t border-[#e5eae8] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Invio fornitori
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Invia direttamente a più fornitori.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Gli indirizzi vengono gestiti separatamente: ogni fornitore riceve la propria email e può rispondere direttamente al tuo indirizzo.
            </p>

            {authenticated ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-[#52615b]">
                  Email fornitori
                  <textarea
                    value={recipientInput}
                    onChange={(event) => setRecipientInput(event.target.value)}
                    placeholder={"acquisti@fornitore1.it\nofferte@fornitore2.it"}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#52615b]">
                  Oggetto
                  <input
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#52615b]">
                  Messaggio
                  <textarea
                    value={emailMessage}
                    onChange={(event) => setEmailMessage(event.target.value)}
                    rows={4}
                    className="mt-1.5 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                  />
                </label>

                <button
                  type="button"
                  disabled={!savedId || sendPending || rfqPending || savePending}
                  onClick={sendDistinta}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-5 text-sm font-bold text-[#173f35] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(sendPending ? "Invio…" : "Invia ai fornitori")}
                </button>

                {!emailConfigured ? (
                  <p className="text-[11px] leading-5 text-[#7b6a43]">
                    Il flusso è pronto; il server richiede la chiave del provider email per effettuare l&apos;invio reale.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[#f7f9f8] px-4 py-3 text-xs leading-5 text-[#66736e]">
                L&apos;invio diretto è un servizio privato: accedi o registra la tua azienda per utilizzarlo.
              </p>
            )}

            {sendMessage ? (
              <p className="mt-3 text-xs font-semibold text-[#52615b]">{sendMessage}</p>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
