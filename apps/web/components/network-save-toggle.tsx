"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { toggleNetworkSavedCompany } from "@/app/(workspace)/network/save-actions";
import {
  NETWORK_SAVE_EVENT,
  emitNetworkSave,
  emitNetworkSaveError,
  type NetworkSaveEventDetail,
  type NetworkSaveSurface,
} from "@/lib/network-save-events";

/**
 * NET-UX LOT1B — founder decision (2 Nov 2026): each user keeps a private list
 * of Network companies to work on later (Salvate).
 * NET-SAVE-INLINE1 (16 Nov 2026): one click saves in place, no redirect.
 * Optimistic star, server action toggleNetworkSavedCompany, rollback and an
 * error toast on failure, success toast with Annulla, and every other control
 * for the same company (and the "Salvate" counter) kept in sync by events.
 */
export function NetworkSaveToggle({
  companyId,
  name,
  saved: initialSaved,
  surface = "network_directory",
  compact = false,
  appearance = "button",
}: {
  companyId: string;
  name: string;
  saved: boolean;
  surface?: NetworkSaveSurface;
  compact?: boolean;
  /** "ghost" matches the Home feed action row. */
  appearance?: "button" | "ghost" | "toolbar";
  /** @deprecated kept for older call sites; the toggle no longer redirects. */
  returnTo?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pop, setPop] = useState(false);
  const [pending, startTransition] = useTransition();
  // The latest intent wins: rapid clicks only send the final state.
  const intent = useRef(initialSaved);
  const inFlight = useRef(false);

  useEffect(() => {
    function sync(event: Event) {
      const detail = (event as CustomEvent<NetworkSaveEventDetail>).detail;
      if (!detail || detail.companyId !== companyId) return;
      intent.current = detail.saved;
      setSaved(detail.saved);
    }
    window.addEventListener(NETWORK_SAVE_EVENT, sync);
    return () => window.removeEventListener(NETWORK_SAVE_EVENT, sync);
  }, [companyId]);

  function send(wanted: boolean) {
    inFlight.current = true;
    startTransition(async () => {
      const result = await toggleNetworkSavedCompany(companyId, wanted, surface);
      inFlight.current = false;
      if (intent.current !== wanted) {
        // The user changed their mind while the request was running: send the latest intent.
        send(intent.current);
        return;
      }
      if (result.ok) {
        emitNetworkSave({ companyId, name, saved: result.saved, count: result.count, origin: "click", surface });
      } else {
        intent.current = !wanted;
        setSaved(!wanted);
        emitNetworkSaveError({ companyId, name, wanted, reason: result.reason });
      }
    });
  }

  function toggle() {
    const next = !intent.current;
    intent.current = next;
    setSaved(next);
    if (next) {
      setPop(true);
      window.setTimeout(() => setPop(false), 320);
    }
    if (!inFlight.current) send(next);
  }

  const ghost = appearance === "ghost";
  const toolbar = appearance === "toolbar";
  const label = saved ? "Salvata" : compact || ghost ? "Salva" : "Salva azienda";

  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="network-save-toggle"
      data-pending={pending ? "true" : undefined}
      aria-pressed={saved}
      aria-label={(saved ? "Rimuovi dalle aziende salvate: " : "Salva nella tua lista privata: ") + name}
      title={saved ? "Salvata nella tua lista privata · clic per rimuovere" : "Salva nella tua lista privata"}
      className={
        // NET-UX-ROWS1: amber star, filled when saved; label visible so "Salva" reads at a glance.
        "relative z-10 inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
        (ghost
          ? "rounded-lg px-3 " + (saved ? "text-[#6e4400] hover:bg-[#fff4d6]" : "text-[#3f5248] hover:bg-[#f1f6f3]")
          : "rounded-lg border " + (toolbar ? "px-3 " : compact ? "px-3 " : "w-full px-4 ") +
            (saved
              ? "border-[#e9c46a] bg-[#fff4d6] text-[#6e4400] hover:bg-[#ffecbd]"
              : "border-[#d5dfd9] bg-white text-[#3f5248] hover:border-[#e9c46a] hover:bg-[#fffaf0] hover:text-[#6e4400]"))
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={
          "h-[18px] w-[18px] transition-transform duration-300 motion-reduce:transition-none " +
          (saved ? "text-[#b7790a] " : "") +
          (pop ? "scale-125" : "scale-100")
        }
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
      <span className={compact && !ghost ? "hidden xl:inline" : undefined}>{label}</span>
    </button>
  );
}
