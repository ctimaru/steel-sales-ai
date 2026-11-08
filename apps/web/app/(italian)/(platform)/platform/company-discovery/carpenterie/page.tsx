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
  { key: "name_reconciliation_needed", label: "Nomi da allineare" },
  { key: "candidate_seed_aligned", label: "Allineate" },
  { key: "canonical_collision", label: "Collisioni" },
] as const;

type State = (typeof STATES)[number]["key"];
type Row = {
  candidate_id: string;
  name: string;
  domain: string;
  vat_id: string | null;
  region: string | null;
  province: string | null;
  reconciliation_state: string;
  research_seed_name: string | null;
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
  contract: "net-it-carp1-e5-admin-v1";
  total: number;
  enriched: number;
  email_count: number;
  phone_count: number;
  aligned: number;
  name_review: number;
  research_missing: number;
  collision: number;
  selected_total: number;
  publications_performed: 0;
  items: Row[];
};

const stateFrom = (value?: string): State =>
  STATES.find((item) => item.key === value)?.key ?? "all";

const pageFrom = (value?: string) =>
  value && /^\d{1,2}$/.test(value) && Number(value) > 0 ? Math.min(10, Number(value)) : 1;

const makeUrl = (state: State, q: string, page: number) => {
  const params = new URLSearchParams();
  if (state !== "all") params.set("state", state);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return "/platform/company-discovery/carpenterie" + (params.size ? "?" + params.toString() : "");
};

const stateLabel = (state: string) => ({
  candidate_seed_aligned: "Allineata",
  name_reconciliation_needed: "Nome da allineare",
  research_seed_missing: "Solo candidatura",
  canonical_collision: "Collisione",
} as Record<string, string>)[state] ?? "Da esaminare";

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
  searchParams: Promise<{ state?: string; q?: string; page?: string }>;
}) {
  // Read-only private contact data: Platform superadmin only.
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const state = stateFrom(params.state);
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = pageFrom(params.page);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netit_carp1_e5_admin_snapshot", {
    p_state: state,
    p_query: q,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const result = data as Snapshot | null;
  const valid = !error &&
    result?.contract === "net-it-carp1-e5-admin-v1" &&
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

  return (
    <main className="mx-auto w-full max-w-[1480px] space-y-3 px-3 py-3 sm:px-5 sm:py-5"
      data-testid="net-it-carp1-e5-cockpit">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/platform/company-discovery"
          className="text-xs font-semibold text-[#175640] underline underline-offset-4">
          ← Discovery
        </Link>
        <span className="rounded-full border border-[#d8e7dc] bg-white px-3 py-1 text-[11px] font-semibold text-[#507164]">
          Solo Console Platform · Nessuna pubblicazione automatica
        </span>
      </div>

      <header className="rounded-2xl border border-[#d8e5dc] bg-white px-4 py-3 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#207057]">
          NET-IT-CARP1.E.5 · Growth 100
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-[#173f35] sm:text-2xl">
            Carpenterie · dati e riconciliazione
          </h1>
          <Link href="/platform/company-discovery/contacts"
            className="rounded-lg border border-[#bad4c4] bg-[#f6faf7] px-3 py-2 text-xs font-semibold text-[#175640]">
            Canali pubblici: review separata →
          </Link>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#5a6c61]">
          Fonte aziendale, email generica, telefono e capacità osservate. I record restano candidature
          private: nessuna conferma delle certificazioni o dei rapporti di fornitura.
        </p>
      </header>

      {!snapshot ? (
        <p role="alert" className="rounded-xl border border-[#ebd3b3] bg-white p-4 text-sm text-[#875928]">
          Dati amministrativi non disponibili: controlla la sessione Platform e la migrazione E.5.
          Non interpretiamo il mancato accesso come zero aziende.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"
            aria-label="KPI raccolta Carpenterie Growth100">
            {[
              ["In raccolta", snapshot.total],
              ["Arricchite", snapshot.enriched],
              ["Da arricchire", snapshot.total - snapshot.enriched],
              ["Email aziendali", snapshot.email_count],
              ["Telefoni aziendali", snapshot.phone_count],
              ["Nomi da allineare", snapshot.name_review],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#dce8df] bg-white px-3 py-2">
                <div className="text-xl font-bold tabular-nums text-[#173f35]">{value}</div>
                <div className="mt-0.5 text-[11px] font-medium text-[#61736a]">{label}</div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-[#d9e5dc] bg-white p-3 sm:p-4"
            aria-label="Filtri riconciliazione">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {STATES.map((option) => {
                  const active = state === option.key;
                  return (
                    <Link href={makeUrl(option.key, q, 1)} key={option.key}
                      aria-current={active ? "page" : undefined}
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
            <p className="mt-2 text-[11px] text-[#6c7e72]">
              {snapshot.selected_total} risultati · {snapshot.aligned} allineate ·
              {" "}{snapshot.research_missing} da collegare alla ricerca · {snapshot.collision} collisioni.
              Nessun merge automatico.
            </p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#d9e5dc] bg-white"
            aria-label="Elenco Carpenterie Growth 100">
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
                  className="grid gap-2 border-b border-[#edf1ee] px-3 py-3 last:border-0 hover:bg-[#fbfdfa] sm:px-4 lg:grid-cols-[minmax(200px,1.55fr)_95px_minmax(150px,1.25fr)_minmax(165px,1.1fr)_minmax(130px,1fr)] lg:items-center"
                  data-testid="net-it-carp1-e5-company">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#204d3e]" title={item.name}>
                      {item.name}
                    </h2>
                    <div className="truncate text-[11px] text-[#728277]">{item.domain}</div>
                    <EvidenceLink url={item.company_source_url} label="Sito fonte" />
                  </div>
                  <div className="text-xs text-[#53685c]">
                    <span className="font-bold">{item.province ?? "—"}</span>
                    <span className="ml-2 text-[11px] lg:ml-0 lg:block">{item.region ?? ""}</span>
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
                        {cap.replaceAll("_", " ")}
                      </span>
                    )) : <span className="text-[11px] text-[#8e9b92]">In attesa di evidenza</span>}
                  </div>
                  <div>
                    <span className={"inline-flex rounded-full px-2 py-1 text-[10px] font-bold " +
                      (item.reconciliation_state === "candidate_seed_aligned"
                        ? "bg-[#e4f2e9] text-[#246343]"
                        : "bg-[#fdf0dc] text-[#86531e]")}>
                      {stateLabel(item.reconciliation_state)}
                    </span>
                    {item.research_seed_name &&
                      item.reconciliation_state === "name_reconciliation_needed" ? (
                      <p className="mt-1 truncate text-[11px] text-[#687a6f]" title={item.research_seed_name}>
                        Ricerca: {item.research_seed_name}
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
              {page > 1 ? <Link href={makeUrl(state, q, page - 1)}
                className="rounded-lg border bg-white px-3 py-2 font-semibold text-[#175640]">
                ← Precedente
              </Link> : null}
              {page < pages ? <Link href={makeUrl(state, q, page + 1)}
                className="rounded-lg border bg-white px-3 py-2 font-semibold text-[#175640]">
                Successiva →
              </Link> : null}
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
