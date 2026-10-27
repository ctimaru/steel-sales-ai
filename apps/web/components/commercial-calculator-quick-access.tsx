"use client";

import { useEffect, useRef, useState } from "react";
import { CalculatorRegionSwitch } from "@/components/calculator-region-switch";
import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";

/** COMM-CALC1: one on-demand working surface, reusing the public calculator and inline bill. */
export function CommercialCalculatorQuickAccess({ references }: { references: PublicTubeDimensionSummary[] }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Respect nested dialogs (the calculator's bill editor) on first Escape.
        if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-commercial-calculator-panel])')) return;
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <section data-commercial-calculator-access className="flex flex-wrap items-center gap-2">
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#17583f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d4630] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17583f]">
        <span aria-hidden="true">▦</span> Calcolatrice pesi
      </button>
      <span className="text-xs text-[#61736a]">Calcola → aggiungi alla distinta → prepara la RFQ</span>
      {open ? (
        <div className="fixed inset-0 z-[80] bg-[#08291e]/70 p-2 sm:p-4" data-commercial-calculator-overlay
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Calcolatrice e distinta commerciale"
            data-commercial-calculator-panel
            className="mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-[#b2cfc0] bg-white shadow-2xl">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d6e4db] bg-white px-3 py-2 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#123d2d]">Calcolatrice e distinta</h2>
                <p className="text-xs text-[#53675b]">Stesso motore tecnico della Scuola · prezzi privati solo con conferma esplicita</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)}
                className="min-h-11 rounded-lg border border-[#9bbbaa] bg-white px-3 text-sm font-semibold text-[#143b2d] focus-visible:outline-2 focus-visible:outline-offset-2">
                Chiudi
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f2f4f3] p-2 sm:p-3">
              <CalculatorRegionSwitch locale="it" initialRegion="eu" references={references} />
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
