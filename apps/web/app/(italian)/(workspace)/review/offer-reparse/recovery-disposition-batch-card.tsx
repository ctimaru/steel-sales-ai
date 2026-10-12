"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  executeOfferRecoveryDispositionBatch,
  type RecoveryRemediationDispositionItem,
  type RecoveryDispositionBatchHistoryItem,
} from "./actions";

export function RecoveryDispositionBatchCard({
  items,
  history,
}: {
  items: RecoveryRemediationDispositionItem[];
  history: RecoveryDispositionBatchHistoryItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const eligible = items.filter(
    (item) =>
      item.disposition_status === "ready_dismiss_no_offered_evidence" &&
      item.requires_explicit_close === true,
  );
  const ids = eligible.map((item) => item.remediation_queue_id);

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">
            PA2.30.13 · Controlled Recovery Disposition Execution
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Il batch include soltanto le remediation PA2.30.12 attualmente pronte per
            l’archiviazione perché il recovery valido non ha prodotto candidate Offer.
            Ogni elemento viene ricontrollato dal database al momento dell’esecuzione.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {eligible.map((item) => (
              <span
                key={item.remediation_queue_id}
                className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-800"
              >
                #{item.remediation_queue_id} · {item.subject ?? item.thread_id}
              </span>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Candidate di altri ruoli restano intatte. I casi con decisione Offer richiesta,
            recovery ambiguo o stato cambiato vengono bloccati, non forzati.
          </p>
        </div>

        <div className="w-full rounded-xl border border-slate-200 bg-white p-4 lg:w-96">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Esecuzione esplicita · {eligible.length} remediation
          </p>

          <textarea
            value={note}
            disabled={pending || eligible.length === 0}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Nota obbligatoria per il batch di archiviazione"
            className="mt-3 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          />

          <button
            type="button"
            disabled={pending || eligible.length === 0 || !note.trim()}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await executeOfferRecoveryDispositionBatch({
                  remediationQueueIds: ids,
                  confirmedCount: ids.length,
                  note,
                });

                if (!result.ok || !result.result) {
                  setMessage(result.error ?? "Batch non riuscito.");
                  return;
                }

                setMessage(
                  `Batch ${result.result.batch_id ?? ""}: ${result.result.dismissed_count ?? 0} archiviate, ` +
                    `${result.result.already_closed_count ?? 0} già chiuse, ` +
                    `${result.result.blocked_count ?? 0} bloccate.`,
                );
                router.refresh();
              });
            }}
            className="mt-3 w-full rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Esecuzione batch…" : `Archivia ${eligible.length} remediation selezionate`}
          </button>

          {message ? <p className="mt-3 text-xs font-medium text-slate-700">{message}</p> : null}
        </div>
      </div>

      {history.length ? (
        <div className="mt-5 border-t border-indigo-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ultimi batch auditati
          </p>
          <div className="mt-2 space-y-2">
            {history.slice(0, 3).map((batch) => (
              <div
                key={batch.batch_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600"
              >
                <span className="font-mono text-[11px]">{batch.batch_id}</span>
                <span>
                  {batch.dismissed_count} archiviate · {batch.blocked_count} bloccate · {batch.requested_count} richieste
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
