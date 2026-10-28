"use client";

type Props = { canWrite: boolean; composeHref: string; originalHref: string };

export function CommercialDealQuickActions({ canWrite, composeHref, originalHref }: Props) {
  return (
    <section data-testid="comm-cine4-quick-actions" aria-label="Strumenti per questa trattativa"
      className="rounded-xl border border-[#d6e6dc] bg-white px-3 py-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#246c53]">Strumenti rapidi</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => window.dispatchEvent(new Event("sss:open-commercial-calculator"))}
          className="min-h-10 rounded-lg border border-[#c6ded0] bg-[#f3faf5] px-2.5 text-xs font-semibold text-[#175640] hover:bg-[#e7f3eb]">
          Calcolatrice pesi
        </button>
        {canWrite ? (
          <a href={composeHref} className="flex min-h-10 items-center justify-center rounded-lg border border-[#c6ded0] bg-white px-2.5 text-center text-xs font-semibold text-[#175640] hover:bg-[#f3faf5]">
            Nuova distinta / RFQ
          </a>
        ) : (
          <span className="flex min-h-10 items-center justify-center rounded-lg border border-[#e2e9e5] bg-[#f8faf9] px-2.5 text-center text-xs text-[#61736a]">RFQ · sola lettura</span>
        )}
      </div>
      <a href={originalHref} className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] hover:underline">
        Apri documenti e operazioni originali →
      </a>
      <p className="mt-1 text-[11px] leading-4 text-[#61736a]">Il calcolo non modifica questa trattativa. Distinte e invii richiedono conferma esplicita.</p>
    </section>
  );
}
