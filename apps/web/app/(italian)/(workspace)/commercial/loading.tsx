/** COMM-TRUST1.C — truthful pending state, never a simulated zero. */
export default function CommercialLoading() {
  return (
    <section aria-busy="true" role="status" aria-live="polite"
      className="mx-auto max-w-[1480px] space-y-3 px-3 py-5 sm:px-5" data-commercial-loading>
      <div className="rounded-2xl border border-[#dce8df] bg-white px-4 py-4">
        <p className="text-sm font-semibold text-[#173f35]">Caricamento delle attività commerciali…</p>
        <p className="mt-1 text-xs text-[#53675b]">
          Verifico le informazioni disponibili nel tuo workspace. I conteggi appariranno solo dopo il caricamento.
        </p>
      </div>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-2xl bg-[#edf4ef] motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-2xl bg-[#edf4ef] motion-reduce:animate-none" />
      </div>
    </section>
  );
}
