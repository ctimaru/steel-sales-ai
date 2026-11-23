/**
 * NET-PRO-UX2: Intelligence Produttori skeleton, shown at once from the Network
 * strip, the search form and pagination while the server reads the directory.
 */
function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={"rounded-full bg-[#e3e8e5] motion-safe:animate-pulse " + className} />;
}

export default function NetworkProducersLoading() {
  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-4 pb-14" aria-busy="true" aria-live="polite" data-testid="network-producers-loading">
      <span className="sr-only">Caricamento di Intelligence Produttori…</span>
      <Bar className="h-3 w-48" />
      {/* NET-PRODUCERS-UX3: same compact layout as the page — title line, one search box, list. */}
      <div className="space-y-2"><Bar className="h-7 w-40" /><Bar className="h-4 w-56" /></div>
      <div className="h-12 w-full rounded-xl bg-[#eef2f0] motion-safe:animate-pulse" aria-hidden="true" />
      <ul className="divide-y divide-[#e6eee8] overflow-hidden rounded-2xl border border-[#d9e5dc] bg-white" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <li key={row} className="flex items-center gap-4 px-4 py-4">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-[#e5f1ea] motion-safe:animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-56" /><Bar className="h-3 w-40" /></div>
            <Bar className="h-10 w-28 rounded-xl" />
          </li>
        ))}
      </ul>
    </main>
  );
}
