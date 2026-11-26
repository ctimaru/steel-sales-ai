"use client";

import { useRef, useState, type KeyboardEvent } from "react";

// MKT-VISION2 (founder request, 26 Nov 2026): i cinque passi del Marketplace
// come schede interattive. Ogni passo mostra la spiegazione e un piccolo
// esempio di cosa succede. Nessun dato reale: solo la visione.

export type MarketplaceVisionStep = {
  title: string;
  body: string;
  sample: ReadonlyArray<readonly [string, string]>;
};

export function MarketplaceVisionSteps({ steps }: { steps: readonly MarketplaceVisionStep[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = steps[active];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const next = (active + move + steps.length) % steps.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div data-testid="marketplace-vision-steps">
      <div role="tablist" aria-label="I cinque passi" className="mt-7 grid grid-cols-5 gap-0">
        {steps.map((step, index) => {
          const on = index === active;
          return (
            <button key={step.title} ref={(node) => { tabs.current[index] = node; }}
              type="button" role="tab" id={"mkt-step-tab-" + index} aria-selected={on} aria-controls="mkt-step-panel"
              tabIndex={on ? 0 : -1} onClick={() => setActive(index)} onKeyDown={onKeyDown}
              className={"flex min-h-14 items-center gap-2.5 border-t-[3px] pr-2 pt-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
                (index <= active ? "border-[#175640]" : "border-[#cfdcd4]")}>
              <span aria-hidden="true"
                className={"mkt-display inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
                  (on ? "bg-[#175640] text-white" : index < active ? "bg-[#d9e8df] text-[#175640]" : "border border-[#cfdcd4] bg-white text-[#175640]")}>
                {index + 1}
              </span>
              <span className={"mkt-display hidden text-lg font-bold md:inline " + (on ? "text-[#0f2e23]" : "text-[#3f564a]")}>{step.title}</span>
              <span className="sr-only md:hidden">{step.title}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="mkt-step-panel" aria-labelledby={"mkt-step-tab-" + active}
        className="mt-4 flex flex-wrap items-center gap-8 rounded-[20px] border border-[#bfd0c5] bg-white p-6 sm:p-7">
        <div className="min-w-0 flex-[1_1_340px]">
          <p className="mkt-display text-sm font-bold text-[#8a4b00]">Passo {active + 1} di {steps.length}</p>
          <h3 className="mkt-display mt-1.5 text-[28px] font-bold leading-tight text-[#0f2e23]">{current.title}</h3>
          <p className="mt-2.5 text-base leading-7 text-[#3f564a]">{current.body}</p>
        </div>
        <ul aria-label={"Esempio: " + current.title} className="flex min-w-0 flex-[1_1_340px] flex-col gap-2 rounded-2xl bg-[#f3f8f5] p-4">
          {current.sample.map(([label, value]) => (
            <li key={label} className="flex items-center justify-between gap-3 rounded-xl border border-[#d6e5db] bg-white px-3.5 py-3 text-sm">
              <span className="font-semibold text-[#0f2e23]">{label}</span>
              <span className="text-right text-[#3f564a]">{value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
