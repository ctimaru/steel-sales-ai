import Link from "next/link";

import { ITALY_REGION_PATHS } from "@/lib/italy-region-paths";
import type { ItalyRegionCoverage } from "@/lib/network-region-coverage";

/** Only geography names from the known official 20-region set are accepted as map input. */
export const ITALY_REGION_NAMES = ITALY_REGION_PATHS.map((region) => region.name);

export function canonicalItalianRegion(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLocaleLowerCase("it-IT")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-\s]+/g, " ");
  const region = ITALY_REGION_PATHS.find((item) =>
    item.name.toLocaleLowerCase("it-IT").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[-\s]+/g, " ") === normalized
  );
  return region?.name ?? null;
}

export function italyRegionFilterHref(
  filters: Record<string, string | undefined>,
  region: string | null,
) {
  const params = new URLSearchParams();
  // Explicit allowlist: flash/error params are never copied into navigation URLs.
  for (const key of ["q", "role", "product", "capability", "country", "market", "province", "city", "persona"]) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (region) params.set("region", region);
  // Province/city filters are specific to the old region: never carry them
  // when a different region is selected from the national map.
  params.delete("province");
  params.delete("city");
  return "/network" + (params.size ? "?" + params.toString() : "") + "#network-region-results";
}

export function regionCoverageCount(coverage: ItalyRegionCoverage | null, name: string): number | null {
  if (!coverage) return null;
  return coverage.regions.filter((entry) => canonicalItalianRegion(entry.name) === name)
    .reduce((sum, entry) => sum + entry.count, 0);
}

export function ItalyRegionMap({
  coverage, selectedRegion, filters,
}: {
  coverage: ItalyRegionCoverage | null;
  selectedRegion?: string | null;
  filters: Record<string, string | undefined>;
}) {
  const selected = canonicalItalianRegion(selectedRegion);
  const selectedCount = selected ? regionCoverageCount(coverage, selected) : null;

  return (
    <section id="network-regional-map" aria-labelledby="network-regional-map-heading"
      className="rounded-3xl border border-[#d6e3db] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#28745d]">Esplora per regione</p>
          <h2 id="network-regional-map-heading" className="mt-1 text-xl font-semibold text-[#173f35]">
            Italia · 20 regioni cliccabili
          </h2>
        </div>
        {selected ? (
          <Link href={italyRegionFilterHref(filters, null)}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#c6d9cf] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#eef5f1]">
            Rimuovi filtro {selected}
          </Link>
        ) : null}
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">
        Scegli una regione per filtrare le aziende. Il conteggio indica le aziende
        pubblicate con almeno una sede localizzata in quella regione, non tutte le
        aziende che potrebbero operare nel territorio.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="flex justify-center rounded-2xl border border-[#e3ece7] bg-[#f7faf8] p-2 sm:p-4">
          <svg viewBox="0 0 800 875" role="group"
            aria-label="Mappa interattiva delle 20 regioni italiane"
            className="h-auto max-h-[540px] w-full max-w-[480px]">
            {ITALY_REGION_PATHS.map((region) => {
              const count = regionCoverageCount(coverage, region.name);
              const active = selected === region.name;
              return (
                <a key={region.code}
                  href={italyRegionFilterHref(filters, active ? null : region.name)}
                  aria-label={region.name + " · " + (count === null ? "copertura non disponibile" :
                    count + (count === 1 ? " azienda localizzata" : " aziende localizzate"))}
                  aria-current={active ? "location" : undefined}
                  data-region={region.name}
                  className="group cursor-pointer outline-none">
                  <path
                    d={region.path}
                    fill={active ? "#17604e" : count !== null && count > 0 ? "#79bda5" : "#dbe9e1"}
                    stroke="#ffffff" strokeWidth={2}
                    className="transition-colors group-hover:fill-[#2c8669] group-focus-visible:fill-[#256e58] group-focus-visible:stroke-[#b56a22] group-focus-visible:stroke-[4px]"
                  />
                  <title>{region.name}: {count === null ? "copertura non disponibile" : count + " aziende localizzate"}</title>
                </a>
              );
            })}
          </svg>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {coverage ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#c7e1d3] bg-[#f0f8f3] p-3">
                <p className="text-[11px] text-[#52615b]">Con regione disponibile</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#17533e]">{coverage.mapped_companies}</p>
              </div>
              <div className="rounded-xl border border-[#e3e9e4] bg-[#f7f8f7] p-3">
                <p className="text-[11px] text-[#52615b]">Regione non disponibile</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#173f35]">{coverage.unlocated_companies}</p>
              </div>
            </div>
          ) : <p className="rounded-xl border border-[#e3e9e4] p-3 text-sm text-[#52615b]">
            I conteggi geografici non sono disponibili. Puoi comunque selezionare le regioni.
          </p>}
          {selected && (
            <div aria-live="polite" className="rounded-xl border border-[#bcd8ca] bg-[#f3f9f5] px-3 py-2 text-sm font-medium text-[#173f35]">
              {selected} · {selectedCount === null ? "copertura non disponibile" : selectedCount + " aziende con sede localizzata"}
            </div>
          )}
          <nav className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-2"
            aria-label="Seleziona regione dalla lista">
            {ITALY_REGION_PATHS.map((region) => {
              const count = regionCoverageCount(coverage, region.name);
              const active = selected === region.name;
              return (
                <Link key={region.code} href={italyRegionFilterHref(filters, active ? null : region.name)}
                  aria-current={active ? "page" : undefined}
                  className={"flex min-h-9 min-w-0 items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition " +
                    (active ? "bg-[#173f35] text-white" : "bg-[#f3f7f5] text-[#335b49] hover:bg-[#dfece5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17604e]")}>
                  <span className="min-w-0 truncate">{region.name}</span>
                  <span className={"shrink-0 tabular-nums " + (active ? "text-white" : "text-[#476557]")}>
                    {count ?? "—"}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-[#63766c]">
        La mappa riporta solo geografie attendibili presenti nei profili pubblicati.
        Le aziende senza sede geolocalizzata restano nella ricerca nazionale.
        Confini regionali: ISTAT, rielaborazione
        {" "}<a className="underline" href="https://github.com/guglielmo/geojson-italy" target="_blank" rel="noopener noreferrer">geojson-italy</a>
        {" "}(CC BY 4.0). La mappa non indica sedi puntuali.
      </p>
    </section>
  );
}
