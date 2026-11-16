/**
 * NET-PRO-UX2: Moduli e prezzi skeleton (module cards + summary column), shown
 * at once from the Network strip while the server reads coverage and access.
 */
function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={"rounded-full bg-[#e3e8e5] motion-safe:animate-pulse " + className} />;
}

export default function NetworkProCatalogLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px]" aria-busy="true" aria-live="polite" data-testid="network-pro-loading">
      <span className="sr-only">Caricamento di moduli e prezzi Network PRO…</span>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Bar className="h-3 w-32" />
          <Bar className="h-9 w-full max-w-xl" />
          <Bar className="h-4 w-full max-w-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-14 rounded-xl bg-white motion-safe:animate-pulse" aria-hidden="true" />
            <div className="h-14 rounded-xl bg-white motion-safe:animate-pulse" aria-hidden="true" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((card) => (
              <div key={card} className="space-y-3 rounded-2xl border border-[#dbe6df] bg-white p-4" aria-hidden="true">
                <Bar className="h-5 w-40" /><Bar className="h-3 w-full" /><Bar className="h-3 w-4/5" /><Bar className="mt-4 h-3 w-48" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-3 rounded-[22px] border border-[#dbe6df] bg-white p-5 lg:block" aria-hidden="true">
          <Bar className="h-5 w-48" /><Bar className="h-3 w-full" /><Bar className="h-3 w-3/4" />
          <div className="h-20 rounded-xl bg-[#edf5ef] motion-safe:animate-pulse" />
          <div className="h-12 rounded-xl bg-[#dfe9e3] motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
