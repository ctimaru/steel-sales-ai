"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createBuyerRfqCampaign } from "@/app/(public)/distinta/actions";
import { appRoutes } from "@/lib/routes";

export function RfqHubCreateFromSnapshot({ distintaId }: { distintaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErrorMessage(null);
          startTransition(async () => {
            const result = await createBuyerRfqCampaign(distintaId);
            if (!result.ok || !result.rfqId) {
              setErrorMessage(result.error || "Non è stato possibile avviare la campagna RFQ.");
              return;
            }
            router.push(appRoutes.rfqHub.campaign(result.rfqId));
          });
        }}
        className="platform-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Creazione RFQ…" : "Avvia RFQ multi-fornitore"}
      </button>
      {errorMessage ? <p role="alert" className="text-xs font-semibold text-red-700">{errorMessage}</p> : null}
    </div>
  );
}
