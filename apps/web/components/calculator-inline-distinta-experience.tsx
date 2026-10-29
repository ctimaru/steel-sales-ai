"use client";

/** CALC-INT4.5 — One shared five-language calculator + private inline bill. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TechnicalCartShell } from "@/components/technical-cart-shell";
import styles from "./calculator-dense-distinta.module.css";
import Link from "next/link";
import { actionClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { inlinePrivateRfqAccess } from "@/app/(italian)/(public)/knowledge/tubes/actions";
import { createBuyerRfqCampaign, saveBuyerDistinta } from "@/app/(public)/distinta/actions";
import { createPrivateRfqOneStep } from "@/lib/buyer-distinta-rfq-one-step";
import { emptyBuyerDocumentRequirements } from "@/lib/buyer-distinta-documents";
import { appRoutes } from "@/lib/routes";
import { prepareInlinePrivateRfq, privateRfqSnapshotSignature } from "@/lib/calculator-inline-private-rfq";

import { PublicTubeWeightCalculator, type PublicTubeCalculatorInitialValues } from "@/components/public-tube-weight-calculator";
import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";
import type { CalculatorRfqItem } from "@/lib/calculator-rfq-handoff";
import type { UsPipeRfqItem } from "@/lib/us-pipe-rfq-handoff";
import type { BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import { buildBuyerDistintaPlainText, calculateBuyerDistintaLine, calculateBuyerDistintaTotals } from "@/lib/buyer-distinta";
import { priceInputText, type PriceBasis } from "@/lib/calculator-commercial-pricing";
import { localizedInlineBill } from "@/lib/calculator-inline-distinta-copy";
import { trackCalculatorFunnel } from "@/lib/calculator-conversion-funnel.client";
import type { TubeCalculatorLocale } from "@/lib/tube-calculator-locale";
import { CALCULATOR_ROUTES } from "@/lib/international-calculator-landing";
import {
  assignBuyerTargetToLine, buyerTargetPreview, captureBuyerTargetCandidate,
  editBuyerTargetForLine, matchesBuyerTargetWeight, pruneBuyerTargets,
  removeBuyerTarget, type BuyerTargetCandidate, type BuyerTargetState,
} from "@/lib/calculator-inline-buyer-target";
import {
  addInlineDistintaItem, addInlineDistintaUsItem, duplicateInlineDistintaLine, editInlineDistintaLine,
  emptyInlineDistinta, inlineDistintaTotals, persistInlineDistintaSession,
  readInlineDistintaSession, removeInlineDistintaLine, INLINE_DISTINTA_MAX_LINES,
  type InlineDistintaResult, type InlineDistintaState,
} from "@/lib/calculator-inline-distinta";

type Editable = Pick<BuyerDistintaDraftLine,
  "quantityMode" | "quantity" | "barLengthM" | "grade" | "finish" | "note">;

const control = "min-h-11 w-full rounded-lg border border-[#b8cfc3] bg-white px-3 text-sm text-[#143b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146747]";
const action = cn(actionClasses({ variant: "secondary", size: "sm" }), "min-h-11 rounded-lg px-3 py-2 sm:min-h-9 sm:px-2.5 sm:py-1.5");
const rowAction = cn(actionClasses({ variant: "secondary", size: "sm" }), "min-h-11 min-w-0 whitespace-nowrap rounded-md !px-1.5 !text-xs !leading-none sm:min-h-9 sm:!px-2");

/** Compact display only. The canonical full description is retained in the saved bill. */
function compactTechnicalLabel(description: string) {
  return description.replace(/^(?:Tubo (?:tondo|quadro|rettangolare)|Round tube|Square tube|Rectangular tube)\s*/i, "").trim() || description;
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "line-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
}

export type InlineCalculatorBridge = {
  onAddToDistinta: (item: CalculatorRfqItem) => boolean;
  onAddUsToDistinta: (item: UsPipeRfqItem) => boolean;
  canAddToDistinta: boolean;
  inlineBillCount: number;
  inlineBill: ReactNode;
  onOpenInlineBill: () => void;
  onChooseBuyerTarget: (value: {basis: PriceBasis; raw: string; weightKgM: number}) => void;
};

export function CalculatorInlineDistintaExperience({
  references, initialValues, locale = "it", renderCalculator,
}: {
  references: PublicTubeDimensionSummary[];
  initialValues?: PublicTubeCalculatorInitialValues;
  locale?: TubeCalculatorLocale;
  renderCalculator?: (bridge: InlineCalculatorBridge) => ReactNode;
}) {
  const router = useRouter();
  const c = localizedInlineBill(locale);
  // Compact drawer copy is presentational only; the RFQ and private target
  // business contracts remain in the existing shared five-language strings.
  const drawerCopy = ({
    it: { back:"Torna alla calcolatrice", quantity:"Quantità", safety:"I target economici restano privati", more:"Dettagli privacy", help:"Come funziona la RFQ privata", actions:"Azioni riga" },
    en: { back:"Back to calculator", quantity:"Quantity", safety:"Commercial targets stay private", more:"Privacy details", help:"How private RFQs work", actions:"Line actions" },
    de: { back:"Zurück zum Rechner", quantity:"Menge", safety:"Preisziele bleiben privat", more:"Datenschutzdetails", help:"So funktionieren private Anfragen", actions:"Zeilenaktionen" },
    fr: { back:"Retour à la calculatrice", quantity:"Quantité", safety:"Les objectifs de prix restent privés", more:"Détails de confidentialité", help:"Fonctionnement des demandes privées", actions:"Actions de ligne" },
    es: { back:"Volver a la calculadora", quantity:"Cantidad", safety:"Los precios objetivo siguen siendo privados", more:"Detalles de privacidad", help:"Cómo funcionan las solicitudes privadas", actions:"Acciones de línea" },
  } as const)[locale];
  const number = (value: number | null, digits: number) =>
    value === null || !Number.isFinite(value) ? "—" :
      value.toLocaleString({it:"it-IT",en:"en-GB",de:"de-DE",fr:"fr-FR",es:"es-ES"}[locale], {
        maximumFractionDigits: digits,
      });
  const fieldLabels: { key: keyof Editable; label: string }[] = [
    { key: "quantity", label: c.quantity },
    { key: "barLengthM", label: c.barLength },
    { key: "grade", label: c.grade },
    { key: "finish", label: c.finish },
    { key: "note", label: c.note },
  ];
  const [state, setState] = useState<InlineDistintaState>(emptyInlineDistinta);
  const liveState = useRef<InlineDistintaState>(state);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Editable | null>(null);
  // DENSE1C: local drafts per row; no session/RFQ data is changed before Save.
  const [quickQuantities, setQuickQuantities] = useState<Record<string, string>>({});
  const [quickLengths, setQuickLengths] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  // Commercial rates intentionally live only in this mounted React experience.
  // Do not include them in the legacy 4.4A session draft or clipboard export.
  const [targets, setTargets] = useState<BuyerTargetState>({});
  const [pendingTarget, setPendingTarget] = useState<BuyerTargetCandidate | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [targetRaw, setTargetRaw] = useState("");
  const [targetBasis, setTargetBasis] = useState<PriceBasis>("tonne");
  const [includePrivateTargets, setIncludePrivateTargets] = useState(false);
  const [rfqPending, setRfqPending] = useState(false);
  const [rfqError, setRfqError] = useState("");
  const [rfqAccess, setRfqAccess] = useState<"guest"|"ready"|"needs-company"|"unavailable"|null>(null);
  const [createdRfq, setCreatedRfq] = useState<string|null>(null);
  const creatingRef = useRef(false);
  const savedSnapshotRef = useRef<{signature:string;id:string}|null>(null);

  // Restore only in this browser tab, after hydration. No account, cookies or
  // URL payload; keep calculator SEO/server markup unchanged on initial render.
  useEffect(() => {
    let restored: InlineDistintaState | null = null;
    try { restored = readInlineDistintaSession(window.sessionStorage); }
    catch { /* Storage denial remains usable in memory. */ }
    if (restored?.lines.length) {
      liveState.current = restored;
      setState(restored);
      // Only explicit post-login resume requests open the recovered bill.
      // Ordinary calculator visits keep the cart collapsed.
      if (new URLSearchParams(window.location.search).get("resume") === "rfq") {
        setOpen(true);
      }
      setMessage(c.restored);
    }
    setReady(true);
  }, []);

  function commit(result: InlineDistintaResult): boolean {
    if (!result.ok) {
      setMessage(result.reason === "full" ? c.tooMany
        : result.reason === "missing" ? c.missing
        : result.reason === "duplicate" ? c.duplicate : c.invalid);
      return false;
    }
    // Synchronous ref avoids lost updates on rapid clicks before React commits.
    liveState.current = result.state;
    setState(result.state);
    setTargets(current => pruneBuyerTargets(result.state, current));
    // Explicit opening only: adding a measure should not interrupt calculation.
    if (!result.state.lines.length) setOpen(false);
    let saved = false;
    try { saved = persistInlineDistintaSession(window.sessionStorage, result.state); }
    catch { /* sessionStorage property itself may be denied */ }
    if (!saved) setStorageAvailable(false);
    setMessage(saved ? c.updated : c.noStorage);
    if (result.state.lines.length > state.lines.length) trackCalculatorFunnel("bill_line_added", locale);
    return true;
  }

  function add(item: CalculatorRfqItem): boolean {
    if (!ready) return false;
    const result = addInlineDistintaItem(liveState.current, item);
    return commit(result);
  }

  function addUs(item: UsPipeRfqItem): boolean {
    if (!ready) return false;
    return commit(addInlineDistintaUsItem(liveState.current, item));
  }

  function beginEdit(line: BuyerDistintaDraftLine) {
    // Move any unsaved compact quantity into the expanded form rather than lose it.
    const quantity = quickQuantities[line.id] ?? line.quantity;
    const barLengthM = quickLengths[line.id] ?? line.barLengthM;
    setQuickLengths(current => { const next = { ...current }; delete next[line.id]; return next; });
    setQuickQuantities(current => { const next = { ...current }; delete next[line.id]; return next; });
    setEditingId(line.id);
    setDraft({
      quantityMode: line.quantityMode, quantity,
      barLengthM, grade: line.grade,
      finish: line.finish, note: line.note,
    });
    setMessage("");
  }

  function saveEdit(id: string) {
    if (!draft || !commit(editInlineDistintaLine(liveState.current, id, draft))) return;
    setEditingId(null);
    setDraft(null);
  }

  function hasPendingQuantities(): boolean {
    return liveState.current.lines.some(line =>
      (quickQuantities[line.id] !== undefined && quickQuantities[line.id] !== line.quantity ||
        line.quantityMode === "bars" && quickLengths[line.id] !== undefined && quickLengths[line.id] !== line.barLengthM));
  }

  function saveQuickQuantity(id: string) {
    const current = liveState.current.lines.find(line => line.id === id);
    const value = quickQuantities[id] ?? current?.quantity;
    const barLengthM = quickLengths[id] ?? current?.barLengthM;
    if (!current || value === undefined || barLengthM === undefined) return;
    if ((value !== current.quantity || current.quantityMode === "bars" && barLengthM !== current.barLengthM) &&
      !commit(editInlineDistintaLine(liveState.current, id, { quantity: value, barLengthM }))) return;
    setQuickLengths(previous => { const next = { ...previous }; delete next[id]; return next; });
    setQuickQuantities(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  function chooseBuyerTarget(value: { basis: PriceBasis; raw: string; weightKgM: number }) {
    const candidate = captureBuyerTargetCandidate(value.raw, value.basis, value.weightKgM, locale);
    if (!candidate) { setMessage(c.priceInvalid); return; }
    setPendingTarget(candidate);
    setOpen(true);
    setMessage(c.targetReady);
  }

  function assignTarget(id: string) {
    if (!pendingTarget) return;
    const result = assignBuyerTargetToLine(liveState.current, targets, id, pendingTarget);
    if (!result.ok) {
      setMessage(result.reason === "weight-mismatch" ? c.weightMismatch : c.targetMissing);
      return;
    }
    setTargets(result.targets);
    setPendingTarget(null);
    setEditingTargetId(null);
    setMessage(c.targetAssigned);
  }

  function startTargetEdit(line: BuyerDistintaDraftLine) {
    const preview = buyerTargetPreview(line, targets);
    setEditingTargetId(line.id);
    setTargetBasis("tonne");
    setTargetRaw(preview ? priceInputText(preview.eurT, locale) : "");
  }

  function saveTargetEdit(id: string) {
    const result = editBuyerTargetForLine(liveState.current, targets, id, targetRaw, targetBasis, locale);
    if (!result.ok) { setMessage(c.targetAmountInvalid); return; }
    setTargets(result.targets);
    setEditingTargetId(null);
    setMessage(c.targetEdited);
  }

  async function createPrivateRfq() {
    if (creatingRef.current || createdRfq || !ready || !liveState.current.lines.length) return;
    if (hasPendingQuantities()) { setRfqError(c.unsavedQuantity); return; }
    const built = prepareInlinePrivateRfq(liveState.current, targets, includePrivateTargets);
    if (!built.ok) { setRfqError(built.error); return; }
    creatingRef.current = true;
    trackCalculatorFunnel("rfq_create_click", locale);
    setRfqPending(true);
    setRfqError("");
    setRfqAccess(null);
    try {
      const access = await inlinePrivateRfqAccess();
      if (access.state !== "ready") {
        setRfqAccess(access.state);
        if (access.state === "guest") trackCalculatorFunnel("guest_handoff", locale);
        setRfqError(access.state === "guest" ? c.guestError
          : access.state === "needs-company" ? c.companyError : c.accessError);
        return;
      }
      setRfqAccess("ready");
      // If a snapshot was already saved but campaign creation failed, reuse it
      // only when all rows AND the optional target-consent snapshot are unchanged.
      const signature = privateRfqSnapshotSignature(built.snapshot);
      const result = await createPrivateRfqOneStep({
        existingDistintaId: savedSnapshotRef.current?.signature === signature
          ? savedSnapshotRef.current.id : null,
        save: () => saveBuyerDistinta({
          title: built.snapshot.title, lines: built.snapshot.lines,
          documents: emptyBuyerDocumentRequirements(),
        }),
        create: (savedId) => createBuyerRfqCampaign(savedId),
        onSaved: id => { savedSnapshotRef.current = {signature,id}; },
      });
      if (!result.ok) {
        setRfqError(result.error);
        return;
      }
      setCreatedRfq(result.rfqId);
      trackCalculatorFunnel("rfq_created", locale);
      try { window.sessionStorage.removeItem("sss:inline-distinta:v1"); }
      catch { /* restore already handled; no failure of private creation */ }
      setMessage(c.rfqCreatedNotice);
      router.push(appRoutes.rfqHub.campaign(result.rfqId));
    } catch {
      setRfqError(c.rfqFailure);
    } finally {
      creatingRef.current = false;
      setRfqPending(false);
    }
  }

  function copyBill() {
    if (hasPendingQuantities()) { setMessage(c.unsavedQuantity); return; }
    const calculated = liveState.current.lines.map(calculateBuyerDistintaLine);
    if (!calculated.length || calculated.some(line => !line.complete)) {
      setMessage(c.copyIncomplete);
      return;
    }
    // Canonical 4.4A rows have blank targetEurT even if opt-in memory state has
    // private targets. Public clipboard/export NEVER uses the private map.
    const totalsForCopy = calculateBuyerDistintaTotals(calculated);
    // Keep the canonical Italian export, but deliver truly localized technical
    // copies elsewhere. Both paths consume the same validated calculations;
    // private buyer targets are always excluded.
    const plain = locale === "it" ? buildBuyerDistintaPlainText(c.quoteTitle, calculated) : [
      c.quoteTitle, "",
      [c.oneItem, "Standard", c.grade, c.finish, c.quantity, "kg/m", c.note].join("\t"),
      ...calculated.map(line => [
        line.description, line.standard, line.grade, line.finish,
        line.quantityMode === "bars"
          ? `${number(line.quantity, 0)} ${c.bars} × ${number(line.barLengthM, 2)} m`
          : `${number(line.quantity, 3)} ${line.quantityMode === "meters" ? "m" : "t"}`,
        number(line.weightKgM, 3), line.note,
      ].join("\t")),
      "",
      `${c.meters}: ${number(totalsForCopy.totalMeters, 2)}`,
      `${c.tonnes}: ${number(totalsForCopy.totalTonnes, 3)}`,
      "", "Smart Steel Sales",
    ].join("\n");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      void navigator.clipboard.writeText(plain).then(
        () => setMessage(c.copied),
        () => setMessage(c.copyError),
      );
    } catch { setMessage(c.copyError); }
  }

  const totals = inlineDistintaTotals(state);
  const count = state.lines.length;
  const hasUnsavedQuantity = hasPendingQuantities();
  // Technical cart always monitorable; details open in a real portal dialog.
  const bill = (
    <section id="distinta-inline" aria-label={c.title} className="mt-2 min-w-0 scroll-mt-24">
      {count === 0 ? <p className="rounded-xl border border-[#d8e7de] bg-[#f5faf7] px-4 py-3 text-xs text-[#365848]">
        <strong>{c.title}.</strong> {c.empty}
      </p> : null}
      <p aria-live="polite" role="status" className="sr-only">
        {message || (!ready ? c.preparing : !storageAvailable ? c.storageUnavailable : "")}
      </p>
      <TechnicalCartShell
        compact visible={ready && count > 0} open={open}
        onOpen={() => setOpen(true)} onClose={() => setOpen(false)}
        count={count} title={c.title} eyebrow={c.eyebrow} closeLabel={drawerCopy.back}
         countLabel={(count === 1 ? c.row : c.lines).toLowerCase()}
        summary={`${number(totals?.totalMeters ?? null, 2)} m · ${number(totals?.totalTonnes ?? null, 3)} t`}
        dialogId="distinta-inline-dialog" titleId="distinta-inline-title" bodyId="distinta-inline-lines"
        triggerTestId="calculator-cart-trigger" overlayTestId="calculator-cart-overlay"
        footer={<div data-distinta-sticky-footer className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#416653]">{c.totalsTitle}</p>
              <p className="text-base font-extrabold tabular-nums text-[#123d34]">{number(totals?.totalMeters ?? null, 2)} m · {number(totals?.totalTonnes ?? null, 4)} t</p>
            </div>
            <span className="shrink-0 rounded-md bg-[#eef6f0] px-2 py-1 text-xs font-bold text-[#285a43]">{count} {c.lines}</span>
          </div>
          {hasUnsavedQuantity ? <p role="status" className="text-[11px] font-semibold text-[#915421]">{c.unsavedQuantity}</p> : null}
          <div data-distinta-footer-actions className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
            <button type="button" className={cn(actionClasses({variant:"secondary",size:"sm"}),"min-h-11 rounded-lg border border-[#a6cdb6] bg-white px-2 text-xs font-semibold text-[#1a533b] sm:text-sm")}
              disabled={hasUnsavedQuantity} onClick={copyBill} aria-label={c.copyBill}>
              <span className="sm:hidden">{c.shortCopy}</span><span className="hidden sm:inline">{c.copyBill}</span>
            </button>
            <button type="button" data-create-inline-private-rfq
              className={cn(actionClasses({variant:"default"}),"min-h-11 rounded-lg !bg-[#16694b] px-2 text-xs font-bold !text-white hover:!bg-[#0e5137] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f9c69] sm:text-sm")}
              disabled={rfqPending || Boolean(createdRfq) || !ready || hasUnsavedQuantity}
              aria-label={createdRfq ? c.rfqCreated : rfqPending ? c.rfqPending : c.createRfqButton}
              onClick={() => { void createPrivateRfq(); }}>
              {createdRfq ? c.rfqCreated : rfqPending ? c.rfqPending : <>
                <span className="sm:hidden">{c.shortRfq} →</span>
                <span className="hidden sm:inline">{c.createRfqButton}</span>
              </>}
            </button>
          </div>
          {rfqError ? <p role="alert" className="text-xs font-semibold text-[#9b442a]">{rfqError}</p> : null}
        </div>}>
                {message ? <p data-distinta-feedback role="status" aria-live="polite"
                  className="mb-2 rounded-md border-l-[3px] border-[#2b9b65] bg-[#e5f4e9] px-2 py-1.5 text-[11px] font-semibold text-[#215a40]">
                  {message}
                </p> : null}
          {pendingTarget ? (
            <div data-target-pending className="mb-4 rounded-xl border border-[#c8d8a4] bg-[#f5f7eb] p-3 text-sm text-[#31452a]">
              <strong>{c.pendingTarget}</strong> {number(pendingTarget.priceEurT, 2)} €/t
              <p className="mt-1 text-xs">{c.pendingDescription} {number(pendingTarget.sourceKgM, 3)} kg/m. {c.selectMatching}</p>
              <button type="button" className={action} onClick={() => setPendingTarget(null)}>{c.cancelSelection}</button>
            </div>
          ) : null}

          {/* Each self-contained article identifies its own metrics; no cramped table labels. */}
          <div data-distinta-compact-grid className={styles.rows}>
            {state.lines.map((line, index) => {
              const computed = calculateBuyerDistintaLine(line);
              const editing = editingId === line.id;
              const privateTarget = buyerTargetPreview(line, targets);
              const matchingPending = pendingTarget && matchesBuyerTargetWeight(line, pendingTarget);
              const quickValue = quickQuantities[line.id] ?? line.quantity;
              const quickLength = quickLengths[line.id] ?? line.barLengthM;
              const quickChanged = quickValue !== line.quantity || line.quantityMode === "bars" && quickLength !== line.barLengthM;
              // Draft-only calculation: preserve the canonical bill until explicit Save.
              const previewResult = quickChanged
                ? editInlineDistintaLine(state, line.id, { quantity: quickValue, barLengthM: quickLength }) : null;
              const previewLine = previewResult?.ok ? previewResult.state.lines.find(item => item.id === line.id) : null;
              const preview = previewLine ? calculateBuyerDistintaLine(previewLine) : null;
              const previewLabel = { it: "Anteprima", en: "Preview", de: "Vorschau", fr: "Aperçu", es: "Vista previa" }[locale];
              return <article key={line.id} data-distinta-compact-row data-distinta-tabular-row
                className={styles.row} aria-label={c.row + " " + (index + 1) + ": " + line.description}>
                <div className={styles.mainRow}>
                  <div className={styles.description} title={line.description+" · "+line.standard+(line.grade ? " · "+line.grade : "")}>
                    <strong>{index + 1}. {compactTechnicalLabel(line.description)}</strong>
                    <span>{line.standard}{line.grade ? " · "+line.grade : " · "+c.gradePending}</span>
                  </div>
                  <div data-inline-quantity className={styles.quantity}>
                    <span className={styles.fieldLabel}>{line.quantityMode === "bars" ? c.bars : drawerCopy.quantity}</span>
                    <input type="text" inputMode={line.quantityMode === "bars" ? "numeric" : "decimal"}
                      value={quickValue} maxLength={45} disabled={editing}
                      aria-label={c.quantity + " " + c.row.toLowerCase() + " " + (index + 1)}
                      aria-describedby={"distinta-inline-quantity-unit-" + line.id}
                      onChange={event => setQuickQuantities(current => ({ ...current, [line.id]: event.target.value }))}
                      onKeyDown={event => {
                        if (event.key === "Enter") { event.preventDefault(); saveQuickQuantity(line.id); }
                        else if (event.key === "Escape") { setQuickQuantities(current => { const next = { ...current }; delete next[line.id]; return next; }); }
                      }}/>
                    <span id={"distinta-inline-quantity-unit-" + line.id} className="sr-only">
                      {line.quantityMode === "bars" ? c.bars : line.quantityMode === "meters" ? c.meters : c.tonnes}
                      {line.quantityMode === "bars" ? " × " + number(computed.barLengthM, 2) + " m" : ""}
                    </span>
                  </div>
                  <div className={styles.metrics} title={"kg/m: "+number(computed.weightKgM,3)}>
                    <div><span className={styles.fieldLabel}>{c.meters}</span><strong>{number(computed.meters, 2)} m</strong></div>
                    <div><span className={styles.fieldLabel}>{c.tonnes}</span><strong>{number(computed.tonnes, 4)} t</strong></div>
                    <span className={styles.weightLine}>{number(computed.weightKgM, 2)} kg/m</span>
                  </div>
                  <div data-distinta-row-actions className={styles.actions} role="group" aria-label={drawerCopy.actions + " " + (index + 1)}>
                    <button type="button" className={styles.action} title={editing ? c.close : c.edit}
                      aria-label={editing ? c.close : c.edit}
                      aria-expanded={editing} aria-controls={editing ? "distinta-inline-edit-" + line.id : undefined}
                      onClick={() => { if (editing) { setEditingId(null); setDraft(null); } else beginEdit(line); }}>✎</button>
                    <button type="button" className={styles.action} title={c.duplicateLine}
                      disabled={count >= INLINE_DISTINTA_MAX_LINES}
                      aria-label={c.duplicateLine + " " + c.row.toLowerCase() + " " + (index + 1)}
                      onClick={() => commit(duplicateInlineDistintaLine(liveState.current, line.id, makeId()))}>⧉</button>
                    <button type="button" className={styles.actionDanger} title={c.remove}
                      aria-label={c.remove + " " + c.row.toLowerCase() + " " + (index + 1)}
                      onClick={() => {
                        if (commit(removeInlineDistintaLine(liveState.current, line.id)) && editing) {
                          setEditingId(null); setDraft(null);
                        }
                      }}>×</button>
                    <button type="button" className={styles.actionTarget} title={privateTarget ? c.editTarget : c.setTarget}
                      aria-label={privateTarget ? c.editTarget : c.setTarget}
                      aria-expanded={editingTargetId === line.id}
                      aria-controls={editingTargetId === line.id ? `private-target-edit-${line.id}` : undefined}
                      onClick={() => editingTargetId === line.id ? setEditingTargetId(null) : startTargetEdit(line)}>€</button>
                  {line.quantityMode === "bars" ? <label className={styles.lengthControl}>
                    <span className="sr-only">{c.barLength}</span>
                    <input data-inline-bar-length type="text" inputMode="decimal" className={styles.lengthInput}
                      aria-label={c.barLength + " " + c.row.toLowerCase() + " " + (index + 1)} value={quickLength} disabled={editing}
                      onChange={event => setQuickLengths(current => ({ ...current, [line.id]: event.target.value }))}
                      onKeyDown={event => {
                        if (event.key === "Enter") { event.preventDefault(); saveQuickQuantity(line.id); }
                        else if (event.key === "Escape") setQuickLengths(current => { const next={...current}; delete next[line.id]; return next; });
                      }}/><span>m</span>
                  </label> : null}

                  </div>
                </div>
                {quickChanged ? <p data-inline-draft-preview aria-live="polite"
                  className="mt-1 truncate px-1 text-[10px] font-semibold leading-4 text-[#23644d]">
                  {preview?.complete
                    ? `${previewLabel} · ${number(preview.meters, 2)} m · ${number(preview.tonnes, 4)} t`
                    : `${previewLabel} · ${c.invalid}`}
                </p> : null}
                {quickChanged ? <button type="button" data-save-quick-quantity
                  onClick={() => saveQuickQuantity(line.id)}
                  className={styles.saveQuantity}>{c.saveQuantity}</button> : null}
                {privateTarget ? (
                  <p data-buyer-target className="mt-1.5 rounded-md bg-[#e6f3ea] px-2 py-1.5 text-[11px] font-semibold text-[#14553c]">
                    {c.targetPrivate} · {number(privateTarget.eurT, 2)} €/t · {number(privateTarget.eurM, 4)} €/m
                    <span className="block font-normal">{c.estimate} {number(privateTarget.estimatedTotal, 2)} € {c.onlyScreen}</span>
                  </p>
                ) : null}
                {pendingTarget && matchingPending ? (
                  <button type="button" data-apply-private-target className={action + " mt-2"}
                    onClick={() => assignTarget(line.id)}>{c.assignTarget} {index + 1}</button>
                ) : null}
                {editingTargetId === line.id ? (
                  <div id={`private-target-edit-${line.id}`} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-[#d7e5dc] bg-white p-3">
                    <label className="text-xs font-bold text-[#315846]">{c.targetUnit}<select className={control} value={targetBasis}
                        onChange={e => { setTargetBasis(e.target.value as PriceBasis); setTargetRaw(""); }}>
                        <option value="tonne">€/ton</option><option value="metre">€/m</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-[#315846]">{c.reservedAmount}<input type="text" inputMode="decimal" autoComplete="off" className={control}
                        value={targetRaw} onChange={e => setTargetRaw(e.target.value)} placeholder={c.priceExample}/>
                    </label>
                    <button type="button" className={action} onClick={() => saveTargetEdit(line.id)}>{c.saveTarget}</button>
                    <button type="button" className={action} onClick={() => setEditingTargetId(null)}>{c.cancel}</button>
                    <p className="w-full text-xs text-[#526657]">{c.targetExplanation}</p>
                  </div>
                ) : null}
                {editing && draft ? <div id={`distinta-inline-edit-${line.id}`}
                  className="mt-4 grid gap-3 border-t border-[#d7e5dc] pt-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#315846]">{c.quantityUnit}<select className={control} value={draft.quantityMode}
                      onChange={event => setDraft(v => v ? { ...v, quantityMode: event.target.value as Editable["quantityMode"] } : v)}>
                      <option value="bars">{c.bars}</option><option value="meters">{c.meters}</option><option value="tonnes">{c.tonnes}</option>
                    </select>
                  </label>
                  {fieldLabels.map(({key,label}) => {
                    if (key === "barLengthM" && draft.quantityMode !== "bars") return null;
                    return <label key={key} className={`text-xs font-semibold text-[#315846] ${key === "note" ? "sm:col-span-2" : ""}`}>
                      {label}
                      <input type="text" className={control} value={draft[key]} maxLength={key === "note" ? 1200 : 150}
                        inputMode={key === "quantity" || key === "barLengthM" ? "decimal" : "text"}
                        onChange={event => setDraft(v => v ? { ...v, [key]: event.target.value } : v)}/>
                    </label>;
                  })}
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <button type="button" className={cn(actionClasses({ variant: "default" }), "min-h-11 px-5 rounded-lg")}
                      onClick={() => saveEdit(line.id)}>{c.saveRow}</button>
                    <button type="button" className={action} onClick={() => {setEditingId(null);setDraft(null);}}>{c.cancel}</button>
                  </div>
                  <p className="sm:col-span-2 text-xs leading-5 text-[#66796c]">{c.geometryHint}</p>
                </div> : null}
              </article>;
            })}
          </div>

          <details data-distinta-privacy-info className="mt-3 rounded-lg border border-[#d1e5d7] bg-[#eaf5ed] text-[11px] text-[#365d47]">
            <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-2 px-3 font-semibold focus-visible:outline-2 focus-visible:outline-[#187b51]">
              {drawerCopy.safety} <span aria-hidden="true">ⓘ</span>
            </summary>
            <p className="border-t border-[#d1e5d7] px-3 py-2 leading-5">{c.targetSafety}</p>
          </details>
          <section id="distinta-inline-rfq" aria-label={c.privateRfq} className="mt-2 scroll-mt-24">
            <details data-distinta-rfq-help
              open={Boolean(createdRfq) || Object.keys(targets).length > 0 || (rfqAccess !== null && rfqAccess !== "ready")}
              className="rounded-lg border border-[#c5decf] bg-white">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-[#21563c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16724e]">
                {drawerCopy.help} <span aria-hidden="true">ⓘ</span>
              </summary>
              <div className="border-t border-[#e0ece5] px-3 py-3">
                <p className="text-xs leading-5 text-[#4a6756]">{c.rfqIntro}</p>
            {Object.keys(targets).length > 0 ? (
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-[#f4f8f3] p-3 text-xs leading-5 text-[#27523e]">
                <input type="checkbox" className="mt-1 size-4" checked={includePrivateTargets}
                  onChange={event=>setIncludePrivateTargets(event.target.checked)}/>
                <span><strong>{c.includeTargets}</strong>
                  <span className="block">{c.targetDisclaimer}</span>
                </span>
              </label>
            ) : null}
            {rfqAccess === "guest" ? (
              <div data-inline-guest-handoff className="mt-3 rounded-xl border border-[#c6e0d1] bg-[#eef6f1] p-4">
                <p className="text-sm font-bold text-[#174b37]">{c.guestError}</p>
                <p className="mt-2 text-xs leading-5 text-[#315746]">{c.guestDescription}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link className={cn(actionClasses({ variant: "default" }), "min-h-12 rounded-lg px-4 text-center")}
                    target="_top" href="/register" onClick={() => trackCalculatorFunnel("registration_click", locale)}>{c.registerCompany}</Link>
                  <Link className={action + " min-h-12 text-center text-sm"} target="_top" href={"/login?next="+encodeURIComponent(CALCULATOR_ROUTES[locale]+"?resume=rfq")} onClick={() => trackCalculatorFunnel("login_click", locale)}>{c.loginResume}</Link>
                </div>
                <button type="button" className={action + " mt-3 w-full sm:w-auto"} onClick={copyBill}>{c.copyBill}</button>
                {!storageAvailable ? <p className="mt-2 text-xs font-semibold text-[#8b472c]">{c.noStorage}</p> : null}
              </div>
            ) : null}
            {rfqAccess === "needs-company" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link target="_top" href="/register" className={action}>{c.completeCompany}</Link>
                <Link target="_top" href="/registration/status" className={action}>{c.activation}</Link>
              </div>
            ) : null}
            {createdRfq ? <Link href={appRoutes.rfqHub.campaign(createdRfq)} className={action+" mt-3"}>{c.openHub}</Link> : null}
            <p className="mt-2 text-xs text-[#5a7164]">{c.freeCreation}</p>
              </div>
            </details>
          </section>


      </TechnicalCartShell>
    </section>
  );

  if (renderCalculator) return renderCalculator({
    onAddToDistinta: add,
    onAddUsToDistinta: addUs,
    canAddToDistinta: ready && count < INLINE_DISTINTA_MAX_LINES,
    inlineBillCount: count,
    inlineBill: bill,
    onOpenInlineBill: () => setOpen(true),
    onChooseBuyerTarget: chooseBuyerTarget,
  });
  return <PublicTubeWeightCalculator references={references} initialValues={initialValues} locale={locale}
    onAddToDistinta={add} canAddToDistinta={ready && count < INLINE_DISTINTA_MAX_LINES}
    inlinePublicDistinta inlineBillCount={count} onOpenInlineBill={() => setOpen(true)} onChooseBuyerTarget={chooseBuyerTarget}
    inlineBill={bill} />;
}
