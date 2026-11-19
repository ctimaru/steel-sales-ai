"use client";

import { useActionState, useId, type ReactNode } from "react";

import { applyDealCycleAction, type CycleActionState } from "@/app/(italian)/(workspace)/commercial/cycle-actions";
import { CLOSE_REASONS, closeReasonLabel, type CycleAction, type DealOutcome } from "@/lib/commercial-cycle";

const idle: CycleActionState = { status: "idle", message: "" };

function Hidden({ item }: { item: CycleAction }) {
  return (
    <>
      <input type="hidden" name="record_kind" value={item.recordKind} />
      <input type="hidden" name="record_id" value={item.recordId} />
      <input type="hidden" name="action" value={item.action} />
      {item.toStatus ? <input type="hidden" name="to_status" value={item.toStatus} /> : null}
    </>
  );
}

function Message({ state, id }: { state: CycleActionState; id: string }) {
  if (!state.message) return null;
  return (
    <p id={id} role={state.status === "error" ? "alert" : "status"} aria-live="polite"
      className={"mt-1.5 text-xs " + (state.status === "error" ? "font-semibold text-[#8a2f1f]" : "text-[#276147]")}>
      {state.message}
    </p>
  );
}

/** Un pulsante = un'azione, con il suo esito sotto. */
function ActionButton({ item, tone, children }: { item: CycleAction; tone: "primary" | "secondary"; children?: ReactNode }) {
  const [state, action, pending] = useActionState(applyDealCycleAction, idle);
  const messageId = useId();
  const cls = tone === "primary"
    ? "app-primary inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-4 text-sm font-semibold text-white hover:bg-[#104632] disabled:opacity-60"
    : "inline-flex min-h-10 items-center rounded-lg border border-[#c9dccf] bg-white px-3 text-xs font-semibold !text-[#175640] hover:bg-[#f2f8f4] disabled:opacity-60";
  return (
    <form action={action} aria-busy={pending} data-testid={"deal-cycle-" + item.action} className="min-w-0">
      <Hidden item={item} />
      {children}
      <button type="submit" disabled={pending} aria-describedby={state.message ? messageId : undefined}
        className={cls + " focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]"}>
        {pending ? "Salvo…" : item.label}
      </button>
      <Message state={state} id={messageId} />
    </form>
  );
}

function CloseForm({ item, subject }: { item: CycleAction; subject: string }) {
  const [state, action, pending] = useActionState(applyDealCycleAction, idle);
  const id = useId();
  return (
    <details className="group rounded-xl border border-[#e7d9c7] bg-[#fffaf3]" data-testid="deal-cycle-close">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold !text-[#7a4d0e] [&::-webkit-details-marker]:hidden">
        {item.label}
        <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
      </summary>
      <form action={action} aria-busy={pending} className="space-y-2 border-t border-[#efe2cf] p-3">
        <Hidden item={item} />
        <p className="text-xs text-[#5c4a2e]">{subject} va in Archiviate con il motivo. Si può riaprire.</p>
        <label htmlFor={id + "-reason"} className="block text-[11px] font-semibold text-[#5c4a2e]">Motivo</label>
        <select id={id + "-reason"} name="reason" required defaultValue="" disabled={pending}
          className="min-h-10 w-full rounded-lg border border-[#d9c8ad] bg-white px-2 text-sm text-[#2b2217] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4d0e]">
          <option value="" disabled>Scegli il motivo…</option>
          {CLOSE_REASONS.map((reason) => <option key={reason.key} value={reason.key}>{reason.label}</option>)}
        </select>
        <label htmlFor={id + "-note"} className="block text-[11px] font-semibold text-[#5c4a2e]">Nota <span className="font-normal">(obbligatoria con «Altro»)</span></label>
        <textarea id={id + "-note"} name="note" maxLength={500} rows={2} disabled={pending}
          className="w-full rounded-lg border border-[#d9c8ad] bg-white px-2 py-1.5 text-sm text-[#2b2217] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4d0e]" />
        <button type="submit" disabled={pending}
          className="inline-flex min-h-10 items-center rounded-lg border border-[#7a4d0e] bg-white px-4 text-xs font-semibold !text-[#7a4d0e] hover:bg-[#fff1d6] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4d0e]">
          {pending ? "Chiudo…" : "Chiudi come non conclusa"}
        </button>
        <Message state={state} id={id + "-msg"} />
      </form>
    </details>
  );
}

/**
 * COMM-CYCLE1 — le azioni della trattativa: l'azione principale, eventuali
 * scorciatoie, «Chiudi come non conclusa» con motivo, oppure «Riapri».
 */
export function CommercialDealCycleActions({
  primary, secondary, canClose, reopen, outcome, subject = "La trattativa",
}: {
  primary: CycleAction | null;
  secondary: CycleAction[];
  canClose: CycleAction | null;
  reopen: CycleAction | null;
  outcome: DealOutcome | null;
  subject?: string;
}) {
  if (!primary && !secondary.length && !canClose && !reopen && !outcome) return null;
  return (
    <div className="space-y-2" data-testid="deal-cycle-actions">
      {outcome ? (
        <p className="text-xs text-[#5c4a2e]" data-testid="deal-cycle-outcome">
          <span className="font-semibold">Non conclusa</span>{closeReasonLabel(outcome.reason) ? " · " + closeReasonLabel(outcome.reason) : ""}
          {outcome.note ? <span className="block text-[#6b5a40]">{outcome.note}</span> : null}
        </p>
      ) : null}
      {primary || secondary.length ? (
        <div className="flex flex-wrap items-start gap-2">
          {primary ? (
            <ActionButton item={primary} tone="primary">
              {primary.askOrderRef ? (
                <input name="customer_order_ref" type="text" maxLength={80} placeholder="Rif. ordine del cliente (facoltativo)"
                  aria-label="Riferimento ordine del cliente"
                  className="mb-2 block min-h-10 w-full rounded-lg border border-[#c9dccf] bg-white px-3 text-sm text-[#173f35] placeholder:text-[#6b7d73]" />
              ) : null}
            </ActionButton>
          ) : null}
          {secondary.map((item) => <ActionButton key={item.action + (item.toStatus ?? "")} item={item} tone="secondary" />)}
        </div>
      ) : null}
      {reopen ? <ActionButton item={reopen} tone="secondary" /> : null}
      {canClose ? <CloseForm item={canClose} subject={subject} /> : null}
    </div>
  );
}
