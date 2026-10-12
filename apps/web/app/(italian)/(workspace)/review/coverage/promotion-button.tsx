"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { promoteReadyRfqObservation } from "./actions";

export function PromotionButton({ observationId }: { observationId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await promoteReadyRfqObservation(observationId);
            if (!result.ok) {
              setMessage(result.error ?? "Promozione non riuscita.");
              return;
            }
            setMessage(result.status === "already_promoted" ? "Già normalizzata." : "RFQ normalizzata.");
            router.refresh();
          });
        }}
        className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Promozione…" : "Promuovi questa RFQ"}
      </button>
      <span className="text-xs text-slate-500">
        Azione singola esplicita · nessuna promozione bulk
      </span>
      {message ? <span className="w-full text-xs font-medium text-slate-700">{message}</span> : null}
    </div>
  );
}
