"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { appRoutes } from "@/lib/routes";
import { CalculatorRegionSwitch } from "@/components/calculator-region-switch";
import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";

const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(node => node.getClientRects().length > 0 && !node.closest("[inert]"));
}

function activeCartDialog(): HTMLElement | null {
  // The inline Distinta uses a body portal and is outside the calculator DOM.
  return document.querySelector<HTMLElement>('[data-technical-cart-variant][aria-modal="true"]');
}

function activeCartTrigger(): HTMLElement | null {
  const trigger = document.querySelector<HTMLElement>('[data-testid="calculator-cart-trigger"]');
  return trigger && trigger.getClientRects().length > 0 ? trigger : null;
}

/** COMM-TRUST1.A/B: keep an opened calculator in memory; constrain modal focus including portaled cart. */
export function CommercialCalculatorQuickAccess({ references }: { references: PublicTubeDimensionSummary[] }) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function showCalculator() {
    setHasOpened(true);
    setOpen(true);
  }

  function closeCalculator() {
    // Escape and close must dismiss the portaled Distinta before its parent.
    if (activeCartDialog()) return;
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (activeCartDialog()) {
        // TechnicalCartShell owns Escape and Tab while the nested dialog is open.
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      // The floating bill shortcut lives in a body portal. It is deliberately
      // the last stop in the parent focus loop, instead of being unreachable.
      const controls = visibleFocusables(panelRef.current);
      const cartTrigger = activeCartTrigger();
      if (cartTrigger) controls.push(cartTrigger);
      const first = controls[0] ?? panelRef.current;
      const last = controls[controls.length - 1] ?? panelRef.current;
      const active = document.activeElement;
      const inside = controls.some(control => control === active);
      if (!inside || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
        event.preventDefault();
        (event.shiftKey && inside ? last : first).focus({ preventScroll: true });
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const nested = activeCartDialog();
      if (nested) {
        if (!nested.contains(event.target as Node)) nested.focus({ preventScroll: true });
        return;
      }
      const panel = panelRef.current;
      if (!panel) return;
      const trigger = activeCartTrigger();
      if (!panel.contains(event.target as Node) && event.target !== trigger) {
        closeRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const onOpen = () => showCalculator();
    window.addEventListener("sss:open-commercial-calculator", onOpen);
    return () => window.removeEventListener("sss:open-commercial-calculator", onOpen);
  }, []);

  return (
    <section data-commercial-calculator-access className="flex flex-wrap items-center gap-2">
      <button ref={triggerRef} type="button" onClick={showCalculator}
        aria-haspopup="dialog" aria-expanded={open} aria-controls="commercial-calculator-panel"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#17583f] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0d4630] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17583f]">
        <span aria-hidden="true">▦</span> Calcolatrice pesi
      </button>
      <Link href={appRoutes.rfqHub.savedDistinte} data-commercial-saved-distinte-entry
        className="inline-flex min-h-10 items-center rounded-lg border border-[#bdd7c6] bg-white px-2.5 text-xs font-bold text-[#17583f] hover:bg-[#edf8f1]">
        Distinte salvate →
      </Link>
      <span className="hidden text-[11px] text-[#61736a] xl:inline">Calcola → salva → scegli i fornitori</span>
      {/* First mount stays alive after close: all unsaved inputs, named bill,
          per-line edits and in-memory private prices survive reopening. */}
      {hasOpened ? (
        <div data-commercial-calculator-overlay aria-hidden={!open} inert={!open}
          className={open ? "fixed inset-0 z-[80] bg-[#08291e]/70 p-2 sm:p-4" : "hidden"}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeCalculator(); }}>
          <section id="commercial-calculator-panel" ref={panelRef} role="dialog" aria-modal="true"
            aria-label="Calcolatrice e distinta commerciale" tabIndex={-1}
            data-commercial-calculator-panel
            className="mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-[#b2cfc0] bg-white shadow-2xl">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d6e4db] bg-white px-3 py-2 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#123d2d]">Calcolatrice e distinta</h2>
                <p className="text-xs text-[#53675b]">Bozza conservata finché resti in questa scrivania · salva la Distinta per conservarla nel Commerciale</p>
              </div>
              <button ref={closeRef} type="button" onClick={closeCalculator}
                className="min-h-11 rounded-lg border border-[#9bbbaa] bg-white px-3 text-sm font-semibold text-[#143b2d] focus-visible:outline-2 focus-visible:outline-offset-2">
                Chiudi
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f2f4f3] p-2 sm:p-3">
              <CalculatorRegionSwitch locale="it" initialRegion="eu" references={references} active={open} />
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
