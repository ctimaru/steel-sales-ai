"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

/**
 * COMM-REVIEW1 (25 nov 2026): il dettaglio di una richiesta si apre con un
 * render del server (2-3 secondi). Senza segnale il clic sembrava perso e si
 * cliccava di nuovo, su un'altra riga. Dentro il <Link> della riga: mentre la
 * navigazione è in corso la riga si evidenzia e dice «Apertura…».
 */
export function CommercialDealRowPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" aria-live="polite"
      className="pointer-events-none absolute inset-0 flex items-center justify-end border-l-4 border-[#175640] bg-[#175640]/[0.06] pr-4">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#175640] shadow-sm">
        <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-[#175640]/30 border-t-[#175640]" />
        Apertura…
      </span>
    </span>
  );
}

/**
 * Su schermi stretti la lista sparisce e resta il dettaglio: lo porta in vista.
 * Da desktop il dettaglio sta già accanto alla lista e la pagina non deve saltare.
 */
export function CommercialDealDetailFocus({ targetId, itemKey }: { targetId: string; itemKey: string }) {
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches) return;
    document.getElementById(targetId)?.scrollIntoView({ block: "start" });
  }, [targetId, itemKey]);
  return null;
}
