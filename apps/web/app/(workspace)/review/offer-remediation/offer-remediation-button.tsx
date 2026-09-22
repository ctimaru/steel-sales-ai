"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { enqueueOfferRemediation, type OfferRemediationCandidate } from "./actions";

export function OfferRemediationButton({ candidate }: { candidate: OfferRemediationCandidate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const queued = candidate.queue_status === "pending";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || queued}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await enqueueOfferRemediation(candidate.thread_id);
            if (!result.ok) {
              setMessage(result.error ?? "Queue non aggiornata.");
              return;
            }
            setMessage(result.status === "already_enqueued" ? "Già in remediation queue." : "Aggiunto alla remediation queue.");
            router.refresh();
          });
        }}
        className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Enqueue…" : queued ? "In queue" : "Aggiungi alla queue"}
      </button>
      {message ? <span className="text-xs font-medium text-slate-600">{message}</span> : null}
    </div>
  );
}
