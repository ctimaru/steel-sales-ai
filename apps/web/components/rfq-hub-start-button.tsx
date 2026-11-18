"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createBuyerRfqCampaign } from "@/app/(public)/distinta/actions";
import { appRoutes } from "@/lib/routes";

/**
 * RFQHUB1: a saved Distinta without a request continues to step 2. The server
 * action is owner-scoped and idempotent (reuses an existing RFQ); nothing is sent.
 */
export function RfqHubStartButton({ distintaId }: { distintaId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await createBuyerRfqCampaign(distintaId);
            if (!result.ok || !result.rfqId) { setError(result.error ?? "Non è stato possibile continuare."); return; }
            router.push(appRoutes.rfqHub.campaign(result.rfqId));
          });
        }}
        className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-[#175640] px-3 text-xs font-bold text-white hover:bg-[#104632] disabled:opacity-50">
        {pending ? "Preparo…" : "Scegli i fornitori →"}
      </button>
      {error ? <span role="alert" className="mt-1 max-w-48 text-right text-[10px] text-[#8c431e]">{error}</span> : null}
    </span>
  );
}
