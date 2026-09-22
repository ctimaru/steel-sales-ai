"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { recoverShadowDuplicateOffer, type OfferRecoveryCandidate } from "./actions";

export function OfferRecoveryButton({ candidate }: { candidate: OfferRecoveryCandidate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || candidate.recovery_status !== "ready"}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await recoverShadowDuplicateOffer(candidate.thread_id);
            if (!result.ok) {
              setMessage(result.error ?? "Recovery bloccato.");
              return;
            }
            setMessage(result.status === "already_recovered" ? "Offer già recuperata." : "Offer recuperata.");
            router.refresh();
          });
        }}
        className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Recovery…" : "Recupera Offer"}
      </button>
      {message ? <span className="text-xs font-medium text-slate-600">{message}</span> : null}
    </div>
  );
}
