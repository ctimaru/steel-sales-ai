"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  closeOfferReparseRemediation,
  type ReparseRemediationClosureItem,
} from "./actions";

function closureLabel(status: string) {
  if (status === "ready_resolve") return "Pronta da risolvere";
  if (status === "ready_dismiss_no_candidates") return "Pronta da archiviare · nessuna candidate";
  if (status === "ready_dismiss_no_recovery") return "Pronta da archiviare · nessun recupero";
  if (status === "run_queued") return "Reparse in coda";
  if (status === "run_processing") return "Reparse in esecuzione";
  if (status === "run_failed") return "Reparse fallito";
  if (status === "candidates_pending") return "Candidate da decidere";
  if (status === "decisions_incomplete") return "Decisioni incomplete";
  if (status === "conflict_review_required") return "Conflitto non-null da gestire";
  if (status === "residual_evidence_gap") return "Gap residui ancora presenti";
  if (status === "already_closed") return "Remediation chiusa";
  return status.replaceAll("_", " ");
}

export function ReparseRemediationClosureCard({
  item,
}: {
  item: ReparseRemediationClosureItem;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const ready =
    item.closure_status === "ready_resolve" ||
    item.closure_status === "ready_dismiss_no_candidates" ||
    item.closure_status === "ready_dismiss_no_recovery";
  const dismissal = item.recommended_outcome === "dismissed";
  const noteRequired = dismissal;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              remediation #{item.remediation_queue_id}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              {closureLabel(item.closure_status)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              run {item.run_status ?? "missing"}
            </span>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-950">
            {item.subject ?? item.thread_id}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.thread_id}</p>

          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <span>Candidate: {item.candidate_count}</span>
            <span>Adottate: {item.accepted_count}</span>
            <span>Rifiutate: {item.rejected_count}</span>
            <span>Gap quantità: {item.residual_gaps.quantity}</span>
            <span>Gap prezzo: {item.residual_gaps.price}</span>
            <span>Gap valuta: {item.residual_gaps.currency}</span>
          </div>

          {item.unresolved_conflict_count > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                {item.unresolved_conflict_count} conflitto/i non-null bloccano la chiusura
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.unresolved_conflicts.map((conflict, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800"
                  >
                    {String(conflict.field ?? "field")} · candidate #{String(conflict.candidate_id ?? "?")}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="w-full max-w-md rounded-xl bg-slate-50 p-4 lg:w-96">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Chiusura controllata
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {ready
              ? item.recommended_outcome === "resolved"
                ? "I requisiti PA2.30 sono soddisfatti. La chiusura resta comunque esplicita."
                : "Il reparse non ha prodotto evidenza recuperabile. Per archiviare è obbligatoria una nota."
              : "La remediation resta aperta finché tutti i prerequisiti PA2.30 non sono soddisfatti."}
          </p>

          {ready ? (
            <>
              <textarea
                value={note}
                disabled={pending}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  noteRequired
                    ? "Motivazione obbligatoria per archiviare la remediation"
                    : "Nota opzionale sulla chiusura"
                }
                className="mt-3 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              />
              <button
                type="button"
                disabled={pending || (noteRequired && !note.trim())}
                onClick={() => {
                  setMessage(null);
                  startTransition(async () => {
                    const result = await closeOfferReparseRemediation({
                      remediationQueueId: item.remediation_queue_id,
                      note,
                    });
                    setMessage(
                      result.ok
                        ? result.status === "already_closed"
                          ? "Remediation già chiusa."
                          : result.status === "resolved"
                            ? "Remediation risolta."
                            : "Remediation archiviata."
                        : result.error ?? "Chiusura non riuscita.",
                    );
                    if (result.ok) router.refresh();
                  });
                }}
                className="mt-3 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending
                  ? "Chiusura…"
                  : item.recommended_outcome === "resolved"
                    ? "Chiudi come risolta"
                    : "Archivia remediation"}
              </button>
            </>
          ) : null}

          {message ? <p className="mt-3 text-xs font-medium text-slate-600">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
