import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type ScaleSnapshot = {
  scope: "published_it_companies";
  published_companies: number;
  companies_with_published_city: number;
  companies_missing_published_city: number;
  website_ready_location_gaps: number;
  city_coverage_pct: number;
  geo_evidence_pending: number;
  geo_evidence_approved_for_facility_review: number;
  geo_evidence_conflicts: number;
  istat_municipalities: number;
  source_registry_total: number;
  source_registry_approved: number;
  source_registry_eligible_enabled: number;
  discovery_leads_pending: number;
  source_gate_ready: boolean;
  worker_runtime_status: "not_observable_from_database";
  publication_automatic: false;
  next_gate: "source_rights_review" | "geo_evidence_human_review" | "manual_worker_opt_in";
};

function NumberCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#52615b]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[#1d2824]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#53635d]">{note}</p>
    </div>
  );
}

export default async function ItalianGeographicCoveragePage() {
  // Read authority is checked on the page AND inside the privileged SQL aggregate.
  await requirePlatformPermission("discovery.read");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crawl_it64_geographic_scale_snapshot");
  const snapshot = !error && data && typeof data === "object"
    ? (data as ScaleSnapshot)
    : null;
  const available = snapshot?.scope === "published_it_companies" &&
    Number.isFinite(snapshot.published_companies) &&
    Number.isFinite(snapshot.companies_with_published_city) &&
    snapshot.companies_with_published_city <= snapshot.published_companies;
  const kpi = available ? snapshot : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/platform/company-discovery/governance"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1a5144] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
        ← Governance Discovery
      </Link>
      <header className="space-y-2">
        <p className="platform-kicker">CRAWL-IT6.4 · Italia</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1d2824]">Copertura geografica e readiness</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#53635d]">
          Stato delle aziende italiane pubblicate, delle sedi con città strutturata e del percorso di acquisizione.
          I candidati non verificati non alimentano i filtri del Network. Nessuna scansione o pubblicazione parte da questa pagina.
        </p>
      </header>

      {!kpi ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          KPI non disponibili: impossibile verificare lo stato di copertura. Non considerare i valori mancanti come zero.
          Verifica la migrazione CRAWL-IT6.4 e le autorizzazioni della console.
        </div>
      ) : (
        <>
          <section aria-labelledby="coverage-heading" className="space-y-4">
            <h2 id="coverage-heading" className="text-lg font-semibold">Copertura del Network italiano</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NumberCard label="Aziende pubblicate" value={kpi.published_companies}
                note="Solo aziende italiane pubblicate e non archiviate" />
              <NumberCard label="Con città pubblicata" value={kpi.companies_with_published_city}
                note="Almeno una sede strutturata, pubblicata e non archiviata" />
              <NumberCard label="Località mancanti" value={kpi.companies_missing_published_city}
                note="Profili pubblicati senza città verificabile nei filtri" />
              <NumberCard label="Copertura per città" value={`${kpi.city_coverage_pct}%`}
                note="Aziende con città / aziende pubblicate, non provincia ISTAT" />
            </div>
            <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">Copertura strutturata</span>
                <span className="tabular-nums">{kpi.companies_with_published_city} / {kpi.published_companies}</span>
              </div>
              <progress aria-label="Quota aziende italiane con città pubblicata"
                value={kpi.companies_with_published_city} max={Math.max(1, kpi.published_companies)}
                className="h-3 w-full accent-[#175640]" />
            </div>
          </section>

          <section aria-labelledby="pipeline-heading" className="space-y-4">
            <h2 id="pipeline-heading" className="text-lg font-semibold">Pipeline di arricchimento e acquisizione</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NumberCard label="Siti con gap geografico" value={kpi.website_ready_location_gaps}
                note="Possibile bacino per una verifica mirata, non siti autorizzati al crawl" />
              <NumberCard label="Evidenze da verificare" value={kpi.geo_evidence_pending}
                note="Evidenze in staging; nessuna nuova sede pubblicata" />
              <NumberCard label="Evidenze approvate" value={kpi.geo_evidence_approved_for_facility_review}
                note="Approvazione preliminare: revisione sede ancora necessaria" />
              <NumberCard label="Domini da esaminare" value={kpi.discovery_leads_pending}
                note="Lead scoperti non equivalgono ad aziende pubblicate" />
            </div>
            {kpi.geo_evidence_conflicts > 0 ? (
              <p role="status" className="rounded-xl border border-amber-300 p-3 text-sm">
                {kpi.geo_evidence_conflicts} evidenze geografiche in conflitto richiedono verifica umana.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="activation-heading" className="space-y-4 rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
            <div>
              <h2 id="activation-heading" className="text-lg font-semibold">Preparazione all’espansione controllata</h2>
              <p className="mt-1 text-sm text-[#53635d]">
                La readiness delle fonti non dimostra che il worker Railway sia attivo.
                Ogni attivazione richiede autorizzazione operativa separata e verifica dei limiti di crawl.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberCard label="Fonti registrate" value={kpi.source_registry_total}
                note={`${kpi.source_registry_approved} approvate per governance`} />
              <NumberCard label="Fonti abilitate idonee" value={kpi.source_registry_eligible_enabled}
                note="Diritti, condizioni d’uso, privacy e approvazione documentata" />
              <NumberCard label="Comuni ISTAT importati" value={kpi.istat_municipalities}
                note="Il codice provincia resta non confermato senza riconciliazione ufficiale" />
            </div>
            {!kpi.source_gate_ready ? (
              <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">
                Espansione autonoma non pronta: nessuna fonte italiana risulta idonea e abilitata.
                Prima verifica termini di riutilizzo, diritti sul database e minimizzazione dei dati personali.
              </p>
            ) : (
              <p role="status" className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-900">
                Fonti idonee presenti. Stato del worker non verificato: il passaggio successivo è un dry run autorizzato,
                seguito da revisione manuale dei domini. Nessun avvio automatico eseguito.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/platform/company-discovery/sources"
                className="inline-flex min-h-11 items-center rounded-xl border border-[#d7dfdb] px-4 py-2 text-sm font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2">
                Esamina le fonti →
              </Link>
              <Link href="/platform/company-discovery/geo-review"
                className="inline-flex min-h-11 items-center rounded-xl border border-[#d7dfdb] px-4 py-2 text-sm font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2">
                Revisiona evidenze geografiche →
              </Link>
            </div>
            <p className="text-xs leading-5 text-[#66736e]">
              Modalità osservazione: sola lettura. I dati in staging non pubblicano profili, sedi o località.
              Il rilevamento automatico delle nuove aziende e l’eventuale schedulazione richiedono un’abilitazione esplicita.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
