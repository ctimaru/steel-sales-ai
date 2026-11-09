import Link from "next/link";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { safeNetworkWebsiteUrl } from "@/lib/network-free";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const STATES = [
  { key: "all", label: "Tutte" },
  { key: "needs_contact", label: "Da arricchire" },
  { key: "research_seed_missing", label: "Solo candidature" },
  { key: "name_reconciliation_needed", label: "Da riconciliare" },
  { key: "domain_alias_linked", label: "Alias collegati" },
  { key: "candidate_seed_aligned", label: "Allineate" },
  { key: "canonical_collision", label: "Collisioni" },
  { key: "location_to_verify", label: "Provincia da verificare" },
] as const;

type State = (typeof STATES)[number]["key"];
const COHORTS = [
  { key: "all", label: "Tutti i gruppi" },
  { key: "Growth100", label: "Primo gruppo" },
  { key: "E8A", label: "Gruppo 2" },
  { key: "E8B", label: "Gruppo 3" },
  { key: "E8C", label: "Gruppo recente" },
] as const;
type Cohort = (typeof COHORTS)[number]["key"];
type Row = {
  candidate_id: string;
  name: string;
  domain: string;
  cohort: Cohort;
  source_kind: string;
  location_quality: string;
  vat_id: string | null;
  region: string | null;
  province: string | null;
  reconciliation_state: string;
  research_seed_name: string | null;
  vat_identity_review: string | null;
  has_contact: boolean;
  email: string | null;
  phone: string | null;
  company_source_url: string | null;
  contact_source_url: string | null;
  observed_capabilities: string[];
  review_status: string;
  governance_status: string;
  updated_at: string;
};
type Snapshot = {
  contract: "net-it-carp1-e8c-unified-admin-v1";
  total: number;
  unique_domains: number;
  growth100: number;
  e8a: number;
  e8b: number;
  e8c: number;
  with_contact: number;
  needs_contact: number;
  email_count: number;
  phone_count: number;
  aligned: number;
  name_review: number;
  alias_linked: number;
  candidate_first: number;
  collision: number;
  province_to_verify: number;
  provinces: number;
  selected_total: number;
  publications_performed: 0;
  items: Row[];
};

const stateFrom = (value?: string): State =>
  STATES.find((item) => item.key === value)?.key ?? "all";
const cohortFrom = (value?: string): Cohort =>
  COHORTS.find((item) => item.key === value)?.key ?? "all";
const provinceFrom = (value?: string): string => {
  const province = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(province) ? province : "";
};

const pageFrom = (value?: string) =>
  value && /^\d{1,2}$/.test(value) && Number(value) > 0 ? Math.min(10, Number(value)) : 1;

const makeUrl = (state: State, q: string, page: number, cohort: Cohort, province: string) => {
  const params = new URLSearchParams();
  if (state !== "all") params.set("state", state);
  if (cohort !== "all") params.set("cohort", cohort);
  if (province) params.set("province", province);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return "/platform/company-discovery/carpenterie" + (params.size ? "?" + params.toString() : "");
};

const stateLabel = (state: string) => ({
  candidate_seed_aligned: "Allineata",
  name_reconciliation_needed: "Nome da allineare",
  research_seed_missing: "Candidatura principale",
  domain_alias_linked: "Alias collegato",
  canonical_collision: "Collisione",
} as Record<string, string>)[state] ?? "Da esaminare";

const capabilityLabel = (key: string) => ({
  metal_fabrication: "Carpenteria",
  industrial_fabrication: "Carpenteria industriale",
  light_fabrication: "Carpenteria leggera",
  heavy_fabrication: "Carpenteria pesante",
  steel_fabrication: "Lavorazione acciaio",
  structural_fabrication: "Strutture metalliche",
  steel_structures: "Strutture in acciaio",
  structural_steel: "Acciaio strutturale",
  sheet_metal: "Lavorazione lamiera",
  laser_cutting: "Taglio laser",
  welding: "Saldatura",
  metal_cutting: "Taglio metalli",
  metal_assembly: "Assemblaggio",
  machine_frames: "Telai macchine",
  industrial_equipment: "Impianti industriali",
  piping_components: "Tubazioni/componenti",
  industrial_plant_components: "Componenti impianti",
  tube_processing: "Lavorazione tubi",
  container_conversion: "Container e shelter",
  metal_products: "Prodotti metallici",
  safety_structures: "Protezioni industriali",
  on_site_assembly: "Montaggio in cantiere",
} as Record<string, string>)[key] ?? key.replaceAll("_", " ");

function EvidenceLink({ url, label }: { url: string | null; label: string }) {
  const safe = safeNetworkWebsiteUrl(url);
  return safe ? (
    <a href={safe} target="_blank" rel="noopener noreferrer"
      className="text-[11px] font-semibold text-[#17604c] underline underline-offset-2 hover:text-[#0f493a]">
      {label} ↗
    </a>
  ) : <span className="text-[11px] text-[#83928b]">Fonte non disponibile</span>;
}

export default async function CarpenterieGrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; cohort?: string; province?: string; q?: string; page?: string }>;
}) {
  // Read-only private contact data: Platform superadmin only.
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const state = stateFrom(params.state);
  const cohort = cohortFrom(params.cohort);
  const province = provinceFrom(params.province);
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = pageFrom(params.page);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netit_carp1_e8_admin_snapshot", {
    p_cohort: cohort,
    p_state: state,
    p_query: q,
    p_province: province,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const result = data as Snapshot | null;
  const valid = !error &&
    result?.contract === "net-it-carp1-e8c-unified-admin-v1" &&
    Number.isInteger(result.total) &&
    result.total >= 0 &&
    Number.isInteger(result.selected_total) &&
    Array.isArray(result.items) &&
    result.items.length <= PAGE_SIZE &&
    result.publications_performed === 0 &&
    result.items.every((item) =>
      typeof item.candidate_id === "string" &&
      typeof item.name === "string" &&
      typeof item.domain === "string"
    );
  const snapshot = valid ? result : null;
  const pages = snapshot ? Math.max(1, Math.ceil(snapshot.selected_total / PAGE_SIZE)) : 1;
  const cohortCounts: Record<Cohort, number> = {
    all: snapshot?.total ?? 0,
    Growth100: snapshot?.growth100 ?? 0,
    E8A: snapshot?.e8a ?? 0,
    E8B: snapshot?.e8b ?? 0,
    E8C: snapshot?.e8c ?? 0,
  };

  return (
    <section aria-label="Gestione carpenterie italiane" className="mx-auto w-full max-w-[1480px] space-y-2 px-2 py-2 sm:space-y-3 sm:px-5 sm:py-5"
      data-testid="net-it-carp1-e5-cockpit">
      <div className="flex items-center justify-between gap-2">
        <Link href="/platform/company-discovery"
          className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-[#175640] underline underline-offset-4 sm:text-xs">
          ← Gestione aziende
        </Link>
        <span className="rounded-full border border-[#d8e7dc] bg-white px-2 py-1 text-[10px] font-semibold text-[#507164] sm:px-3 sm:text-[11px]">
          <span className="sm:hidden">Console privata · Non pubblica</span>
          <span className="hidden sm:inline">Solo Console Platform · Nessuna pubblicazione automatica</span>
        </span>
      </div>

      <header className="rounded-xl border border-[#d8e5dc] bg-white px-3 py-2 sm:rounded-2xl sm:px-5 sm:py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#207057]">
          NETWORK ITALIA · PANORAMICA
        </p>
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1 sm:mt-1 sm:gap-2">
          <h1 className="text-[18px] font-bold leading-6 text-[#173f35] sm:text-2xl">
            Carpenterie italiane
          </h1>
          <Link href="/platform/company-discovery/contacts"
            className="rounded-lg border border-[#bad4c4] bg-[#f6faf7] px-2 py-1 text-[11px] font-semibold text-[#175640] sm:px-3 sm:py-2 sm:text-xs">
            <span className="sm:hidden">Review canali pubblici →</span>
            <span className="hidden sm:inline">Canali pubblici: review separata →</span>
          </Link>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#5a6c61] sm:text-xs sm:leading-5">
          <span className="sm:hidden">Solo candidature private; recapiti e lavorazioni non verificati.</span>
          <span className="hidden sm:inline">
            Fonte aziendale, email generica, telefono e capacità osservate. I record restano candidature
            private: nessuna conferma delle certificazioni o dei rapporti di fornitura.
          </span>
        </p>
      </header>

      {!snapshot ? (
        <p role="alert" className="rounded-xl border border-[#ebd3b3] bg-white p-4 text-sm text-[#875928]">
          Dati momentaneamente non disponibili. Verifica di avere accesso alla console amministrativa.
          Non interpretiamo il mancato accesso come zero aziende.
        </p>
      ) : (
        <>
          <section aria-label="Riepilogo per il fondatore" className="grid gap-2 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border border-[#d8e5dc] bg-[#f6faf7] p-3 sm:p-4">
              <h2 className="text-sm font-bold text-[#173f35]">Cosa sta succedendo</h2>
              <p className="mt-1 text-xs leading-5 text-[#415f50]">
                Stiamo ampliando il database delle carpenterie italiane. Qui trovi {snapshot.total} candidature
                dei gruppi di lavoro selezionati, ancora riservate: non sono tutte imprese giuridicamente
                distinte o verificate e non sono pubblicate sul Network.
              </p>
              <p className="mt-2 text-xs font-semibold text-[#175640]">
                {snapshot.with_contact} con almeno un recapito · {snapshot.needs_contact} da arricchire
              </p>
            </div>
            <div className="rounded-xl border border-[#d8e5dc] bg-white p-3 sm:p-4">
              <h2 className="text-sm font-bold text-[#173f35]">Serve una decisione?</h2>
              <p className="mt-1 text-xs leading-5 text-[#415f50]">
                No, per consultare e arricchire queste aziende. La ricerca può continuare.
                Rendere pubbliche nuove schede è un passaggio distinto, soggetto a verifiche e autorizzazioni.
              </p>
              <Link href="/platform/company-discovery"
                className="mt-2 inline-flex text-xs font-bold text-[#175640] underline underline-offset-4">
                Vai alla gestione completa delle aziende →
              </Link>
            </div>
          </section>
          <section className="grid grid-cols-4 gap-1 sm:grid-cols-4 sm:gap-2 lg:grid-cols-7"
            aria-label="Risultati della raccolta carpenterie italiane">
            {[
              ["Candidature", snapshot.total],
              ["Con recapito", snapshot.with_contact],
              ["Senza recapito", snapshot.needs_contact],
              ["Email aziendali", snapshot.email_count],
              ["Telefoni aziendali", snapshot.phone_count],
              ["Siti collegati", snapshot.alias_linked],
              ["Sedi da verificare", snapshot.province_to_verify],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg border border-[#dce8df] bg-white px-1.5 py-1 sm:rounded-xl sm:px-3 sm:py-2">
                <div className="text-base font-bold tabular-nums text-[#173f35] sm:text-xl">{value}</div>
                <div className="mt-0.5 text-[9px] font-medium leading-3 text-[#61736a] sm:text-[11px] sm:leading-4">{label}</div>
              </div>
            ))}
          </section>

          <nav aria-label="Filtra per gruppo di aziende" className="flex gap-1 overflow-x-auto pb-0.5">
            {COHORTS.map((option) => {
              const active = cohort === option.key;
              return (
                <Link key={option.key} href={makeUrl(state, q, 1, option.key, province)}
                  aria-current={active ? "page" : undefined}
                  style={{ color: active ? "#ffffff" : "#426354" }}
                  className={"shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-semibold " +
                    (active ? "bg-[#175640] text-white" : "bg-[#eef4ef] text-[#426354]")}>
                  {option.label} <span className="tabular-nums">{cohortCounts[option.key]}</span>
                </Link>
              );
            })}
          </nav>
          <section className="rounded-xl border border-[#d9e5dc] bg-white p-2 sm:rounded-2xl sm:p-4"
            aria-label="Filtri riconciliazione">
            <div className="flex flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between lg:gap-2">
              <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
                {STATES.map((option) => {
                  const active = state === option.key;
                  return (
                    <Link href={makeUrl(option.key, q, 1, cohort, province)} key={option.key}
                      aria-current={active ? "page" : undefined}
                      style={{ color: active ? "#ffffff" : "#426354" }}
                      className={"shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold " +
                        (active ? "bg-[#175640] text-white" : "bg-[#eef4ef] text-[#426354] hover:bg-[#dceade]")}>
                      {option.label}
                    </Link>
                  );
                })}
              </div>
              <form action="/platform/company-discovery/carpenterie" method="get"
                className="flex w-full items-center gap-2 lg:max-w-[340px]">
                {state !== "all" ? <input type="hidden" name="state" value={state} /> : null}
                {cohort !== "all" ? <input type="hidden" name="cohort" value={cohort} /> : null}
                <input name="province" defaultValue={province} maxLength={2} type="text"
                  placeholder="Prov."
                  aria-label="Filtra provincia (sigla)"
                  className="min-h-10 w-14 rounded-lg border border-[#cddcd2] px-1 text-center text-[11px] font-semibold uppercase text-[#183f33] outline-none focus:border-[#1b7259]" />
                <input name="q" defaultValue={q} maxLength={80} type="search"
                  placeholder="Azienda, dominio o provincia"
                  aria-label="Cerca carpenteria"
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#cddcd2] px-3 text-xs text-[#183f33] outline-none focus:border-[#1b7259]" />
                <button type="submit"
                  className="min-h-10 rounded-lg bg-[#175640] px-4 text-xs font-semibold text-white">
                  Cerca
                </button>
              </form>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-[#6c7e72] sm:mt-2 sm:text-[11px]">
              {snapshot.selected_total} risultati · {snapshot.growth100} Growth100 ·
              {" "}{snapshot.e8a + snapshot.e8b + snapshot.e8c} E.8 ·
              {" "}{snapshot.candidate_first} candidature principali · {snapshot.collision} collisioni.
              Solo lettura.
            </p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#d9e5dc] bg-white"
            aria-label="Elenco delle carpenterie italiane">
            <div className="hidden grid-cols-[minmax(200px,1.55fr)_95px_minmax(150px,1.25fr)_minmax(165px,1.1fr)_minmax(130px,1fr)] gap-2 border-b border-[#dfe7e1] bg-[#f4f8f5] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#597368] lg:grid">
              <span>Azienda e fonte</span><span>Provincia</span><span>Recapiti privati</span>
              <span>Capacità da fonte</span><span>Riconciliazione</span>
            </div>
            {snapshot.items.length === 0 ? (
              <div className="p-6 text-sm text-[#5c7064]">Nessuna carpenteria corrisponde ai filtri.</div>
            ) : snapshot.items.map((item) => {
              const capabilities = Array.isArray(item.observed_capabilities)
                ? item.observed_capabilities.filter((v): v is string => typeof v === "string").slice(0, 4)
                : [];
              return (
                <article key={item.candidate_id}
                  className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-[#edf1ee] px-3 py-3 last:border-0 hover:bg-[#fbfdfa] sm:px-4 lg:grid-cols-[minmax(200px,1.55fr)_95px_minmax(150px,1.25fr)_minmax(165px,1.1fr)_minmax(130px,1fr)] lg:items-center"
                  data-testid="net-it-carp1-e5-company">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#204d3e]" title={item.name}>
                      {item.name}
                    </h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className="rounded bg-[#edf4ef] px-1.5 py-0.5 text-[10px] font-bold text-[#1f5b46]">{COHORTS.find(group => group.key === item.cohort)?.label ?? "Gruppo aziende"}</span>
                      {item.source_kind === "third_party_directory_company_source" ? (
                        <span className="rounded bg-[#fff3e2] px-1.5 py-0.5 text-[10px] text-[#865c26]">Fonte terza</span>
                      ) : null}
                    </div>
                    <div className="truncate text-[11px] text-[#728277]">{item.domain}</div>
                    <EvidenceLink url={item.company_source_url} label="Fonte" />
                  </div>
                  <div className="text-xs text-[#53685c]">
                    <span className="font-bold">{item.province ?? "—"}</span>
                    <span className="ml-2 text-[11px] lg:ml-0 lg:block">{item.region ?? ""}</span>
                    {item.location_quality === "research_area_to_verify" ? (
                      <span className="block text-[10px] font-medium text-[#986d34]">Provincia da verificare</span>
                    ) : null}
                  </div>
                  <div className="min-w-0 text-xs">
                    {item.email ? <p className="truncate text-[#24483e]" title={item.email}>{item.email}</p> : null}
                    {item.phone ? <p className="text-[#587266]">{item.phone}</p> : null}
                    {!item.has_contact ? <span className="text-[#a16a2f]">Da arricchire</span> : null}
                    {item.has_contact ? <EvidenceLink url={item.contact_source_url} label="Prova recapiti" /> : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {capabilities.length ? capabilities.map(cap => (
                      <span key={cap} className="rounded-md bg-[#eef3f0] px-1.5 py-1 text-[10px] font-medium text-[#406353]">
                        {capabilityLabel(cap)}
                      </span>
                    )) : <span className="text-[11px] text-[#8e9b92]">In attesa di evidenza</span>}
                  </div>
                  <div>
                    <span className={"inline-flex rounded-full px-2 py-1 text-[10px] font-bold " +
                      (item.reconciliation_state === "candidate_seed_aligned" ||
                        item.reconciliation_state === "domain_alias_linked"
                        ? "bg-[#e4f2e9] text-[#246343]"
                        : "bg-[#fdf0dc] text-[#86531e]")}>
                      {stateLabel(item.reconciliation_state)}
                    </span>
                    {item.research_seed_name &&
                      (item.reconciliation_state === "name_reconciliation_needed" ||
                        item.reconciliation_state === "domain_alias_linked") ? (
                      <p className="mt-1 truncate text-[11px] text-[#687a6f]" title={item.research_seed_name}>
                        Ricerca: {item.research_seed_name}
                      </p>
                    ) : null}
                    {item.vat_identity_review === "historical_sole_trader_entity_explained" ? (
                      <p className="mt-1 text-[11px] font-medium text-[#805e32]">
                        P.IVA storica distinta · verifica finale
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 pb-5 text-xs text-[#6c7e72]">
            <span>Pagina {page} di {pages} · {snapshot.selected_total} risultati · sola lettura</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={makeUrl(state, q, page - 1, cohort, province)}
                className="rounded-lg border bg-white px-3 py-2 font-semibold text-[#175640]">
                ← Precedente
              </Link> : null}
              {page < pages ? <Link href={makeUrl(state, q, page + 1, cohort, province)}
                className="rounded-lg border bg-white px-3 py-2 font-semibold text-[#175640]">
                Successiva →
              </Link> : null}
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
