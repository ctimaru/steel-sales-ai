import type { NetworkCompanyResearch } from "@/lib/network-research";

// NET-RESEARCH1 (founder, 26 nov 2026): employees and revenue shown as bands.
const EMPLOYEES: Record<string, string> = {
  "1-9": "1–9", "10-49": "10–49", "50-249": "50–249", "250-999": "250–999", "1000+": "oltre 1.000",
};
const REVENUE: Record<string, string> = {
  lt2m: "sotto 2 M€", "2-10m": "2–10 M€", "10-50m": "10–50 M€", "50-250m": "50–250 M€", gt250m: "oltre 250 M€",
};

function Chips({ label, items, strong = false }: { label: string; items: string[]; strong?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="grid min-w-0 gap-2 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="pt-1 text-xs font-bold text-[#37664d]">{label}</dt>
      <dd className="flex min-w-0 flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={"rounded-md px-2.5 py-1 text-xs " + (strong
            ? "bg-[#eef6f0] font-semibold text-[#24573c]" : "bg-[#f4f7f5] font-medium text-[#536a58]")}>{item}</span>
        ))}
      </dd>
    </div>
  );
}

export function NetworkResearchProfile({ research }: { research: NetworkCompanyResearch }) {
  const figures = [
    research.foundedYear ? { label: "Fondata nel", value: String(research.foundedYear) } : null,
    research.employeesBand && EMPLOYEES[research.employeesBand]
      ? { label: "Dipendenti", value: EMPLOYEES[research.employeesBand] } : null,
    research.revenueBand && REVENUE[research.revenueBand]
      ? { label: research.revenueYear ? `Fatturato ${research.revenueYear}` : "Fatturato", value: REVENUE[research.revenueBand] } : null,
    research.plantsCount ? { label: "Stabilimenti", value: String(research.plantsCount) } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const updated = research.researchedAt
    ? new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(research.researchedAt))
    : null;
  const source = research.sourceUrls[0] ?? null;

  return (
    <div data-testid="network-research-profile" className="min-w-0 space-y-3 rounded-2xl border border-[#dce7df] bg-[#fbfdfb] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-[#173f35]">Profilo in breve</h4>
        {research.preview ? (
          <span data-testid="network-research-preview" className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            Anteprima pilota · visibile solo allo staff
          </span>
        ) : null}
      </div>
      {research.summary ? <p className="max-w-4xl text-sm leading-6 text-[#34493c]">{research.summary}</p> : null}
      {figures.length ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="network-research-figures">
          {figures.map((figure) => (
            <div key={figure.label} className="rounded-xl border border-[#e3ece6] bg-white px-3 py-2">
              <dt className="text-[11px] font-semibold text-[#5d7466]">{figure.label}</dt>
              <dd className="mt-0.5 text-sm font-bold text-[#173f35]">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <dl className="divide-y divide-[#e5ece7] border-y border-[#e5ece7]">
        <Chips label="Attività" items={research.activities} />
        <Chips label="Prodotti" items={research.products} strong />
        <Chips label="Settori serviti" items={research.sectors} />
        <Chips label="Certificazioni" items={research.certifications} strong />
        <Chips label="Mercati" items={research.markets} />
      </dl>
      <p className="text-xs leading-5 text-[#60776b]">
        Da fonte pubblica: ricerca sul sito ufficiale dell'azienda{updated ? `, ${updated}` : ""}.
        {source ? <> <a href={source} target="_blank" rel="noopener noreferrer"
          className="font-semibold text-[#235c41] underline underline-offset-2">Consulta la fonte ↗</a></> : null}
        {" "}L'azienda può correggere questi dati reclamando il profilo.
      </p>
    </div>
  );
}
