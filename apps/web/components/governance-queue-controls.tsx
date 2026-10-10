import Link from "next/link";

type QueueTab = { value: string; label: string };
export function GovernanceQueueControls({
  title, total, totalLabel = "Elementi nella vista", readOnly, tabs, current, baseHref, searchQuery, priorityValues = [],
}: {
  title: string; total: number | null; totalLabel?: string; readOnly: boolean;
  tabs?: readonly QueueTab[]; current?: string; baseHref?: string; searchQuery?: string; priorityValues?: readonly string[];
}) {
  return (
    <section aria-label={title + " · gestione coda"} className="min-w-0 rounded-2xl border border-[#dce2df] bg-white p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1d2824]">{title}</h2>
          <p className="mt-1 text-xs text-[#66736e]">{readOnly ? "Consultazione: nessuna decisione consentita al ruolo corrente." : "Apri una pratica e verifica le evidenze prima di decidere."}</p>
        </div>
        <div className="shrink-0 text-right" aria-live="polite">
          <p className="text-xl font-semibold tabular-nums text-[#1d2824]">{total === null ? "—" : total}</p>
          <p className="text-xs text-[#66736e]">{totalLabel}</p>
        </div>
      </div>
      {tabs && baseHref && priorityValues.length > 0 ? (
        <p className="mt-3 text-xs text-[#52615b]">Le viste contrassegnate come <strong>Da gestire</strong> indicano stati che richiedono attenzione; non sono una misura di urgenza temporale.</p>
      ) : null}
      {tabs && baseHref ? (
        <nav aria-label={"Filtri " + title} className="mt-3 flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 sm:mt-4">
          {tabs.map(({ value, label }) => {
            const active = (current ?? "all") === value;
            const params = new URLSearchParams();
            if (value !== "all") params.set("status", value);
            if (searchQuery?.trim()) params.set("q", searchQuery.trim());
            const href = params.size ? baseHref + "?" + params.toString() : baseHref;
            return (
              <Link key={value} href={href} aria-current={active ? "page" : undefined}
                className={["inline-flex min-h-11 shrink-0 snap-start items-center rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]",
                  active ? "platform-selected-solid" : "border-[#d7dfdb] bg-[#f8faf9] text-[#43524c] hover:bg-[#e1ece8]"].join(" ")}>
                {label}{priorityValues.includes(value) ? <span className="ml-1.5 text-[10px] font-semibold opacity-80">· Da gestire</span> : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}
