"use client";

import { useActionState, useId } from "react";

import {
  renameCommercialDeal,
  type DealLabelState,
} from "@/app/(italian)/(workspace)/commercial/deal-label-actions";

const initialState: DealLabelState = { status: "idle", message: "" };

export function CommercialDealLabelForm({ kind, id, label }: { kind: "rfq" | "offer" | "order"; id: string; label: string }) {
  const [state, action, pending] = useActionState(renameCommercialDeal, initialState);
  const messageId = useId();
  return (
    <form action={action} data-testid="commercial-deal-label-form" aria-busy={pending}
      className="rounded-xl border border-[#d6e5db] bg-[#f8fbf9] p-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label htmlFor={messageId + "-label"} className="text-[11px] font-bold uppercase tracking-wide text-[#386b50]">Nome trattativa</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input id={messageId + "-label"} name="label" type="text" maxLength={80} defaultValue={label}
          placeholder="Es. Tubi quadri cantiere Verona" disabled={pending} aria-describedby={messageId}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]" />
        <button type="submit" disabled={pending}
          className="app-primary inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-4 text-xs font-semibold text-white hover:bg-[#104632] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
          {pending ? "Salvo…" : "Salva nome"}
        </button>
      </div>
      <p id={messageId} role="status" aria-live="polite"
        className={"mt-1.5 text-xs " + (state.status === "error" ? "text-[#8a2f1f]" : "text-[var(--text-secondary)]")}>
        {state.message || "Solo tu e il tuo team lo vedete. Lascia vuoto per tornare al nome del cliente."}
      </p>
    </form>
  );
}
