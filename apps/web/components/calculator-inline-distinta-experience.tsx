"use client";

/** CALC-INT4.5 — One shared five-language calculator + private inline bill. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
const action = cn(actionClasses({ variant: "secondary", size: "sm" }), "min-h-11 rounded-lg px-3 py-2");

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
  const cartTriggerRef = useRef<HTMLButtonElement>(null);
  const cartDialogRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Editable | null>(null);
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
      // Do not open the cart when restoring a technical draft.
      setMessage(c.restored);
    }
    setReady(true);
  }, []);

  // Escape, trapped Tab, focus restoration and body scroll lock for modal.
  useEffect(() => {
    if (!open) return;
    const dialog = cartDialogRef.current;
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.focus({ preventScroll: true });
    const keydown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") { ev.preventDefault(); setOpen(false); return; }
      if (ev.key !== "Tab") return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(n => n.getClientRects().length > 0);
      if (!nodes.length) { ev.preventDefault(); dialog.focus(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        ev.preventDefault(); last.focus();
      } else if (!ev.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        ev.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      cartTriggerRef.current?.focus({preventScroll:true});
    };
  }, [open]);

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
    setEditingId(line.id);
    setDraft({
      quantityMode: line.quantityMode, quantity: line.quantity,
      barLengthM: line.barLengthM, grade: line.grade,
      finish: line.finish, note: line.note,
    });
    setMessage("");
  }

  function saveEdit(id: string) {
    if (!draft || !commit(editInlineDistintaLine(liveState.current, id, draft))) return;
    setEditingId(null);
    setDraft(null);
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
  // Technical cart always monitorable; details open in a real portal dialog.
  const bill = (
    <section id="distinta-inline" aria-label={c.title} className="mt-2 min-w-0 scroll-mt-24">
      {count === 0 ? <p className="rounded-xl border border-[#d8e7de] bg-[#f5faf7] px-4 py-3 text-xs text-[#365848]">
        <strong>{c.title}.</strong> {c.empty}
      </p> : null}
      <p aria-live="polite" role="status" className="sr-only">
        {message || (!ready ? c.preparing : !storageAvailable ? c.storageUnavailable : "")}
      </p>
      {ready && count > 0 && typeof document !== "undefined" ? createPortal(
        <>
          <button type="button" data-testid="calculator-cart-trigger" ref={cartTriggerRef}
            aria-haspopup="dialog" aria-expanded={open} aria-controls="distinta-inline-dialog"
            onClick={() => setOpen(true)}
            className="fixed bottom-3 left-3 right-3 z-[80] inline-flex min-h-14 max-w-[calc(100vw-24px)] items-center gap-3 rounded-2xl border border-[#7db39b] bg-[#123d34] px-4 py-3 text-left text-white shadow-[0_12px_36px_rgba(5,39,28,0.27)] hover:bg-[#195342] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a348] sm:bottom-5 sm:left-auto sm:right-5 sm:min-w-[265px]">
            <span aria-hidden="true" className="text-2xl">▤</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">{c.title} · {count}</span>
              <span className="block text-xs text-[#deefe5]">{number(totals?.totalMeters ?? null,2)} m · {number(totals?.totalTonnes ?? null,3)} t</span>
            </span>
            <span aria-hidden="true" className="text-xl">↗</span>
          </button>
          {open ? <div data-testid="calculator-cart-overlay" className="fixed inset-0 z-[120] flex items-end justify-center sm:items-stretch sm:justify-end">
            <div aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#09261b]/60" />
            <div id="distinta-inline-dialog" role="dialog" aria-modal="true" aria-labelledby="distinta-inline-title"
              tabIndex={-1} ref={cartDialogRef}
              className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-[#c6dccc] bg-white text-[#143b2c] shadow-[0_-15px_60px_rgba(3,27,17,0.25)] focus:outline-none sm:h-dvh sm:max-h-dvh sm:w-[min(720px,95vw)] sm:rounded-l-[1.5rem] sm:rounded-tr-none">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d9e7de] bg-white px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#31755a]">{c.eyebrow}</p>
                  <h2 id="distinta-inline-title" className="mt-1 text-lg font-extrabold text-[#123b30]">{c.title} · {count}</h2>
                  <p className="mt-1 text-xs text-[#52685b]">{number(totals?.totalMeters ?? null,2)} m · {number(totals?.totalTonnes ?? null,3)} t</p>
                </div>
                <button type="button" onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center rounded-xl border border-[#cbded3] bg-[#eff7f2] px-4 text-sm font-bold text-[#164d38] hover:bg-[#dcefe4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#267b59]">
                  {c.close} ×
                </button>
              </div>
              <div id="distinta-inline-lines" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-8 sm:p-5">
          {pendingTarget ? (
            <div data-target-pending className="mb-4 rounded-xl border border-[#c8d8a4] bg-[#f5f7eb] p-3 text-sm text-[#31452a]">
              <strong>{c.pendingTarget}</strong> {number(pendingTarget.priceEurT, 2)} €/t
              <p className="mt-1 text-xs">{c.pendingDescription} {number(pendingTarget.sourceKgM, 3)} kg/m. {c.selectMatching}</p>
              <button type="button" className={action} onClick={() => setPendingTarget(null)}>{c.cancelSelection}</button>
            </div>
          ) : null}
          <div className="space-y-3">
            {state.lines.map((line, index) => {
              const computed = calculateBuyerDistintaLine(line);
              const editing = editingId === line.id;
              const privateTarget = buyerTargetPreview(line, targets);
              const matchingPending = pendingTarget && matchesBuyerTargetWeight(line, pendingTarget);
              return <article key={line.id} className="min-w-0 rounded-xl border border-[#d5e4dc] bg-[#f7faf8] p-3 sm:p-4"
                aria-label={`${c.row} ${index + 1}: ${line.description}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#e2f2e8] px-2 py-1 text-xs font-bold text-[#145a41]">{index + 1}</span>
                      <strong className="break-words text-sm leading-6 text-[#163b2d]">{line.description}</strong>
                    </div>
                    <p className="mt-1 text-xs text-[#496757]">{line.standard}{line.grade ? ` · ${line.grade}` : ` · ${c.gradePending}`}</p>
                    <p className="mt-2 text-xs leading-6 text-[#365748]">
                      <strong>{number(computed.quantity, 2)}</strong> {line.quantityMode === "bars" ? c.bars : line.quantityMode === "meters" ? "m" : "t"}
                      {line.quantityMode === "bars" ? ` × ${number(computed.barLengthM, 2)} m` : ""}
                      {" · "}{number(computed.meters, 2)} m
                      {" · "}{number(computed.weightKgM, 3)} kg/m
                      {" · "}<strong>{number(computed.tonnes, 4)} t</strong>
                    </p>
                    {privateTarget ? (
                      <p data-buyer-target className="mt-2 rounded-lg bg-[#e6f3ea] px-3 py-2 text-xs font-semibold text-[#14553c]">
                        {c.targetPrivate} · {number(privateTarget.eurT, 2)} €/t · {number(privateTarget.eurM, 4)} €/m
                        <span className="block font-normal">{c.estimate} {number(privateTarget.estimatedTotal, 2)} € {c.onlyScreen}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={action} aria-expanded={editing}
                      aria-controls={`distinta-inline-edit-${line.id}`}
                      onClick={() => {
                        if (editing) { setEditingId(null); setDraft(null); }
                        else beginEdit(line);
                      }}>
                      {editing ? c.close : c.edit}
                    </button>
                    <button type="button" className={action} disabled={count >= INLINE_DISTINTA_MAX_LINES}
                      aria-label={`${c.duplicateLine} ${c.row.toLowerCase()} ${index + 1}`}
                      onClick={() => commit(duplicateInlineDistintaLine(liveState.current, line.id, makeId()))}>{c.duplicateLine}</button>
                    <button type="button" className={action} aria-label={`${c.remove} ${c.row.toLowerCase()} ${index + 1}`}
                      onClick={() => {
                        if (commit(removeInlineDistintaLine(liveState.current, line.id)) && editing) {
                          setEditingId(null); setDraft(null);
                        }
                      }}>{c.remove}</button>
                  </div>
                </div>
                {pendingTarget && matchingPending ? (
                  <button type="button" data-apply-private-target className={action + " mt-3"}
                    onClick={() => assignTarget(line.id)}>{c.assignTarget} {index + 1}</button>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={action}
                    aria-expanded={editingTargetId === line.id}
                    aria-controls={`private-target-edit-${line.id}`}
                    onClick={() => editingTargetId === line.id ? setEditingTargetId(null) : startTargetEdit(line)}>
                    {privateTarget ? c.editTarget : c.setTarget}
                  </button>
                  {privateTarget ? <button type="button" className={action} onClick={() => {
                    setTargets(current => removeBuyerTarget(current, line.id));
                    setEditingTargetId(null);
                    setMessage(c.targetRemoved);
                  }}>{c.removeTarget}</button> : null}
                </div>
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

          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-[#eaf5ee] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-[#29644c]">{c.totalsTitle}</p>
              <p className="mt-1 text-lg font-bold text-[#123c2c]">
                {number(totals?.totalMeters ?? null, 2)} m · {number(totals?.totalTonnes ?? null, 4)} t
              </p>
              <p className="mt-1 text-xs text-[#476658]">{c.targetSafety}</p>
            </div>
            <button type="button" className={cn(actionClasses({ variant: "default" }), "min-h-12 w-full px-5")}
              onClick={copyBill}>{c.copyBill}</button>
          </div>
          <section id="distinta-inline-rfq" aria-label={c.privateRfq} className="mt-4 scroll-mt-24 rounded-xl border border-[#b7d6c4] bg-white p-4">
            <h3 className="text-base font-bold text-[#123c2c]">{c.privateRfq}</h3>
            <p className="mt-1 text-xs leading-5 text-[#4a6756]">{c.rfqIntro}</p>
            {Object.keys(targets).length > 0 ? (
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-[#f4f8f3] p-3 text-xs leading-5 text-[#27523e]">
                <input type="checkbox" className="mt-1 size-4" checked={includePrivateTargets}
                  onChange={event=>setIncludePrivateTargets(event.target.checked)}/>
                <span><strong>{c.includeTargets}</strong>
                  <span className="block">{c.targetDisclaimer}</span>
                </span>
              </label>
            ) : null}
            <button type="button" data-create-inline-private-rfq
              className={cn(actionClasses({ variant: "default" }), "mt-3 min-h-12 w-full px-5")}
              disabled={rfqPending || Boolean(createdRfq) || !ready}
              onClick={()=>{void createPrivateRfq();}}>
              {createdRfq ? c.rfqCreated : rfqPending ? c.rfqPending : c.createRfqButton}
            </button>
            {rfqError ? <p role="alert" className="mt-2 text-xs font-semibold text-[#9b442a]">{rfqError}</p> : null}
            {rfqAccess === "guest" ? (
              <div data-inline-guest-handoff className="mt-3 rounded-xl border border-[#c6e0d1] bg-[#eef6f1] p-4">
                <p className="text-sm font-bold text-[#174b37]">{c.guestError}</p>
                <p className="mt-2 text-xs leading-5 text-[#315746]">{c.guestDescription}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link className={cn(actionClasses({ variant: "default" }), "min-h-12 rounded-lg px-4 text-center")}
                    href="/register" onClick={() => trackCalculatorFunnel("registration_click", locale)}>{c.registerCompany}</Link>
                  <Link className={action + " min-h-12 text-center text-sm"} href={"/login?next="+encodeURIComponent(CALCULATOR_ROUTES[locale])} onClick={() => trackCalculatorFunnel("login_click", locale)}>{c.loginResume}</Link>
                </div>
                <button type="button" className={action + " mt-3 w-full sm:w-auto"} onClick={copyBill}>{c.copyBill}</button>
                {!storageAvailable ? <p className="mt-2 text-xs font-semibold text-[#8b472c]">{c.noStorage}</p> : null}
              </div>
            ) : null}
            {rfqAccess === "needs-company" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/register" className={action}>{c.completeCompany}</Link>
                <Link href="/registration/status" className={action}>{c.activation}</Link>
              </div>
            ) : null}
            {createdRfq ? <Link href={appRoutes.rfqHub.campaign(createdRfq)} className={action+" mt-3"}>{c.openHub}</Link> : null}
            <p className="mt-2 text-xs text-[#5a7164]">{c.freeCreation}</p>
          </section>

              </div>
            </div>
          </div> : null}
        </>, document.body) : null}
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
