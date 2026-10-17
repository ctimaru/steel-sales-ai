"use client";

/** CALC-INT4.5 — One shared five-language calculator + private inline bill. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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
const action = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8d4c5] bg-white px-3 py-2 text-xs font-bold text-[#175840] hover:bg-[#edf7f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175840] disabled:cursor-not-allowed disabled:opacity-50";

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
      setOpen(true);
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
    setOpen(result.state.lines.length > 0);
    let saved = false;
    try { saved = persistInlineDistintaSession(window.sessionStorage, result.state); }
    catch { /* sessionStorage property itself may be denied */ }
    if (!saved) setStorageAvailable(false);
    setMessage(saved ? c.updated : c.noStorage);
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
    setRfqPending(true);
    setRfqError("");
    setRfqAccess(null);
    try {
      const access = await inlinePrivateRfqAccess();
      if (access.state !== "ready") {
        setRfqAccess(access.state);
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
  const bill = (
    <section id="distinta-inline" aria-labelledby="distinta-inline-title"
      className="mt-4 min-w-0 scroll-mt-24 overflow-hidden rounded-[1.35rem] border border-[#c7ded0] bg-white shadow-[0_8px_30px_rgba(20,70,43,0.07)]">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#31755a]">{c.eyebrow}</p>
          <h2 id="distinta-inline-title" className="mt-1 text-lg font-bold text-[#123b30]">{c.title}</h2>
          <p className="mt-1 text-xs leading-5 text-[#52685b]">
            {count ? `${count} ${count === 1 ? c.oneItem : c.items} · ${number(totals?.totalMeters ?? null, 2)} m · ${number(totals?.totalTonnes ?? null, 4)} t`
              : c.empty}
          </p>
        </div>
        {count > 0 ? (
          <button type="button" className={action + " w-full sm:w-auto"} aria-expanded={open} aria-controls="distinta-inline-lines"
            onClick={() => setOpen(v => !v)}>{open ? c.collapse : `${c.show} ${count} ${c.lines}`}</button>
        ) : <span className="rounded-lg bg-[#edf5f0] px-3 py-2 text-xs font-semibold text-[#347055]">{c.free}</span>}
      </div>

      {count > 0 && open ? (
        <div id="distinta-inline-lines" className="min-w-0 border-t border-[#dce9df] p-3 sm:p-5">
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
                    <button type="button" className="inline-flex min-h-11 items-center rounded-lg bg-[#176647] px-5 py-2 text-sm font-bold text-white hover:bg-[#104d35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647]"
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
            <button type="button" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#166346] px-5 py-3 text-sm font-bold text-white hover:bg-[#0e5035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166346]"
              onClick={copyBill}>{c.copyBill}</button>
          </div>
          <section aria-label={c.privateRfq} className="mt-4 rounded-xl border border-[#b7d6c4] bg-white p-4">
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
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#176647] px-5 py-3 text-sm font-bold text-white hover:bg-[#104d35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={rfqPending || Boolean(createdRfq) || !ready}
              onClick={()=>{void createPrivateRfq();}}>
              {createdRfq ? c.rfqCreated : rfqPending ? c.rfqPending : c.createRfqButton}
            </button>
            {rfqError ? <p role="alert" className="mt-2 text-xs font-semibold text-[#9b442a]">{rfqError}</p> : null}
            {(rfqAccess === "guest" || rfqAccess === "unavailable") ? (
              <div data-inline-guest-handoff className="mt-3 rounded-lg bg-[#eef6f1] p-3">
                <p className="text-xs text-[#315746]">{c.guestDescription}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className={action} href={"/login?next="+encodeURIComponent(CALCULATOR_ROUTES[locale])}>{c.loginResume}</Link>
                  <Link className={action} href="/register">{c.registerCompany}</Link>
                </div>
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
      ) : null}
      <p aria-live="polite" role="status" className="px-4 pb-3 text-xs font-semibold text-[#246044] sm:px-5">
        {message || (!ready ? c.preparing : !storageAvailable ? c.storageUnavailable : "")}
      </p>
    </section>
  );

  if (renderCalculator) return renderCalculator({
    onAddToDistinta: add,
    onAddUsToDistinta: addUs,
    canAddToDistinta: ready && count < INLINE_DISTINTA_MAX_LINES,
    inlineBillCount: count,
    inlineBill: bill,
    onChooseBuyerTarget: chooseBuyerTarget,
  });
  return <PublicTubeWeightCalculator references={references} initialValues={initialValues} locale={locale}
    onAddToDistinta={add} canAddToDistinta={ready && count < INLINE_DISTINTA_MAX_LINES}
    inlinePublicDistinta inlineBillCount={count} onChooseBuyerTarget={chooseBuyerTarget}
    inlineBill={bill} />;
}
