import Link from "next/link";

type QueueTab = { value: string; label: string };
export function GovernanceQueueControls({
  title, total, totalLabel = "Elementi nella vista", readOnly, tabs, current, baseHref,
}: {
  title: string; total: number | null; totalLabel?: string; readOnly: boolean;
  tabs?: readonly QueueTab[]; current?: string; baseHref?: string;
}) {
  return (
    <section aria-label={title + " · gestione coda"} className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1d2824]">{title}</h2>
          <p className="mt-1 text-xs text-[#66736e]">{readOnly ? "Consultazione: nessuna decisione consentita al ruolo corrente." : "Apri una pratica e verifica le evidenze prima di decidere."}</p>
        </div>
        <div className="text-right" aria-live="polite">
          <p className="text-xl font-semibold tabular-nums text-[#1d2824]">{total === null ? "—" : total}</p>
          <p className="text-xs text-[#66736e]">{totalLabel}</p>
        </div>
      </div>
      {tabs && baseHref ? (
        <nav aria-label={"Filtri " + title} className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map(({ value, label }) => {
            const active = (current ?? "all") === value;
            const href = value === "all" ? baseHref : baseHref + "?status=" + encodeURIComponent(value);
            return (
              <Link key={value} href={href} aria-current={active ? "page" : undefined}
                className={["inline-flex min-h-10 shrink-0 items-center rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]",
                  active ? "border-[#1a5144] bg-[#1a5144] text-white" : "border-[#d7dfdb] bg-[#f8faf9] text-[#43524c] hover:bg-[#e1ece8]"].join(" ")}>
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}
