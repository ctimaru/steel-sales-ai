import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { ITALY_REGION_PATHS } from "@/lib/italy-region-paths";
import { safeNetworkWebsiteUrl } from "@/lib/network-free";
import { decideGeoEvidence, publishReviewedGeoEvidence, stageOfficialGeoEvidence, stageOfficialGeoWithIstat } from "./actions";

export const dynamic = "force-dynamic";

type Entry = {
  id: string; company_id: string; legal_name: string;
  city: string; province_code: string | null; region: string | null;
  address_line_1: string | null; source_url: string; source_kind: string;
  evidence_snippet: string; created_at: string;
};
type BacklogCompany = {
  id: string; legal_name: string; website_url: string | null;
  website_domain: string | null; pending_evidence: number; approved_evidence: number;
};
type Backlog = {
  contract: "netux3-backlog-v1"; missing_region: number;
  pending_evidence: number; ready_for_publication: number;
  istat_municipalities: number; items: BacklogCompany[];
};
type ApprovedEntry = {
  id: string; company_id: string; legal_name: string; city: string; region: string;
  source_url: string; evidence_snippet: string; review_note: string;
  reviewed_at: string;
};

export default async function GeoReviewPage({
  searchParams,
}: { searchParams: Promise<{ message?: string; error?: string }> }) {
  await requirePlatformPermission("discovery.read");
  const context = await getPlatformAccessContext();
  const permissions = context?.permissions ?? [];
  const canReview = permissions.includes("discovery.governance_review");
  const canEnrich = permissions.includes("discovery.enrich");
  const canPublish = canReview && permissions.includes("discovery.publish");
  const params = await searchParams;
  const supabase = await createClient();

  const [pendingResult, backlogResult, approvedResult] = await Promise.all([
    supabase.rpc("crawl_it61_geo_review_queue"),
    supabase.rpc("netux3_geographic_backlog"),
    supabase.rpc("netux3_reviewed_geo_queue"),
  ]);
  const items = (pendingResult.data ?? []) as Entry[];
  const backlog = !backlogResult.error && (backlogResult.data as Backlog | null)?.contract === "netux3-backlog-v1"
    ? (backlogResult.data as Backlog) : null;
  const approved = !approvedResult.error && (approvedResult.data as { contract?: string } | null)?.contract === "netux3-approved-v1"
    ? (approvedResult.data as { items: ApprovedEntry[] }).items : null;
  const hasError = pendingResult.error || backlogResult.error || approvedResult.error;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <Link className="text-sm font-medium text-[#175640] underline" href="/platform/company-discovery/governance">← Governance Discovery</Link>
      <Link href="/platform/company-discovery/geo-review/municipalities"
  className="inline-flex min-h-11 items-center rounded-xl border border-[#bad4c5] bg-white px-4 py-2 text-sm font-semibold text-[#175640]">
  Riconcilia comuni e province ISTAT →
</Link>
<header className="space-y-2">
        <p className="platform-kicker">NET-UX3 · Geographic Coverage</p>
        <h1 className="text-3xl font-semibold text-[#1d2824]">Abbina le aziende alle regioni</h1>
        <p className="max-w-4xl text-sm leading-6 text-[#52615b]">
          Trova una sede sul sito ufficiale, salva l'evidenza, revisiona e pubblica
          con un secondo gesto esplicito. Le proposte non alimentano la mappa finché
          la sede non è pubblicata. Non inserire nomi, email o telefoni personali.
        </p>
      </header>

      {params.message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{params.message}</p> : null}
      {params.error || hasError
        ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {params.error ?? "Impossibile leggere lo stato geografico. Controlla le autorizzazioni e la migrazione NET-UX3."}
          </p> : null}

      {backlog ? (
        <section aria-label="Copertura della mappa" className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-xs font-semibold text-[#52615b]">Aziende senza regione</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[#173f35]">{backlog.missing_region}</p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-xs font-semibold text-[#52615b]">Evidenze in review</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[#173f35]">{backlog.pending_evidence}</p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-xs font-semibold text-[#52615b]">Pronte alla pubblicazione</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[#173f35]">{backlog.ready_for_publication}</p>
          </div>
        </section>
      ) : null}

      {backlog?.istat_municipalities === 0 ? (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Dizionario dei comuni ISTAT non ancora importato: è consentito documentare
          città e regione da sito ufficiale, ma non assegnare automaticamente provincia,
          codice ISTAT o coordinate. Questo blocco non crea geocodifiche fittizie.
        </p>
      ) : null}

      <section aria-labelledby="geo-coverage-backlog" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="geo-coverage-backlog" className="text-xl font-semibold">Da localizzare ({backlog?.missing_region ?? "—"})</h2>
          <Link className="text-sm font-semibold text-[#175640] underline" href="/platform/company-discovery/coverage">Apri coverage dashboard</Link>
        </div>
        {!backlog?.items.length ? <p className="rounded-xl border bg-white p-4 text-sm text-[#52615b]">Nessuna azienda in arretrato, oppure dati non disponibili.</p> : null}
        {backlog?.items.map((company) => {
          const website = safeNetworkWebsiteUrl(company.website_url);
          return (
            <details key={company.id} className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#173f35]">
                {company.legal_name}{" "}
                <span className="ml-2 text-xs font-normal text-[#52615b]">
                  {company.pending_evidence ? company.pending_evidence + " in review" : ""}
                  {company.approved_evidence ? " · " + company.approved_evidence + " approvate" : ""}
                </span>
              </summary>
              {website ? <a className="mt-3 inline-block break-all text-sm text-[#175640] underline" href={website} target="_blank" rel="noopener noreferrer">Sito ufficiale aziendale ↗</a> : <p className="mt-2 text-sm text-amber-800">Sito ufficiale non disponibile: raccolta manuale disabilitata.</p>}
              {canEnrich && website ? (
                <form action={stageOfficialGeoWithIstat} className="mt-4 grid gap-3 rounded-xl border border-[#b8d3c5] bg-[#f6fbf8] p-3 sm:grid-cols-2">
                  <input type="hidden" name="company_id" value={company.id} />
                  <p className="text-sm font-semibold text-[#173f35] sm:col-span-2">
                    Nuova evidenza ISTAT · città e sigla provincia
                  </p>
                  <label className="grid gap-1 text-sm sm:col-span-2">Pagina ufficiale che documenta la sede
                    <input name="source_url" type="url" required maxLength={1800} defaultValue={website}
                      className="min-h-11 min-w-0 rounded-lg border bg-white px-3 text-sm" />
                  </label>
                  <label className="grid gap-1 text-sm">Città documentata
                    <input name="city" required minLength={2} maxLength={120} placeholder="Es. Istrana"
                      className="min-h-11 rounded-lg border bg-white px-3" />
                  </label>
                  <label className="grid gap-1 text-sm">Provincia esplicita nella fonte (2 lettere)
                    <input name="province_code" required minLength={2} maxLength={2} placeholder="Es. TV"
                      className="min-h-11 rounded-lg border bg-white px-3 uppercase" />
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-2">Estratto con città e sigla provincia (senza contatti personali)
                    <textarea name="evidence_snippet" required minLength={20} maxLength={1500} rows={2}
                      placeholder="Sede: Via ..., 31036 Istrana (TV), Italy"
                      className="rounded-lg border bg-white px-3 py-2 text-sm" />
                  </label>
                  <p className="text-xs text-[#52615b] sm:col-span-2">
                    Regione e codice ISTAT sono ricavati esclusivamente da un abbinamento univoco città + provincia.
                    Il salvataggio crea una proposta in Review, mai una sede pubblicata.
                  </p>
                  <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white sm:col-span-2">
                    Salva proposta verificabile · non pubblica
                  </button>
                </form>
              ) : null}
              {canEnrich && website ? (
                <details className="mt-3 rounded-xl border bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[#52615b]">
                    Inserimento manuale precedente (senza codice ISTAT)
                  </summary>
                <form action={stageOfficialGeoEvidence} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="company_id" value={company.id}/>
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    URL della pagina ufficiale che riporta l'indirizzo
                    <input name="source_url" type="url" required maxLength={1800} defaultValue={website}
                      className="min-h-11 w-full rounded-lg border px-3 text-sm" />
                  </label>
                  <label className="grid gap-1 text-sm">Città esattamente citata nella fonte
                    <input name="city" required minLength={2} maxLength={120} className="min-h-11 rounded-lg border px-3 text-sm"/>
                  </label>
                  <label className="grid gap-1 text-sm">Regione confermata dalla fonte
                    <select name="region" required defaultValue="" className="min-h-11 rounded-lg border bg-white px-3 text-sm">
                      <option value="" disabled>Seleziona regione</option>
                      {ITALY_REGION_PATHS.map((reg) => <option value={reg.name} key={reg.code}>{reg.name}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    Estratto della fonte che dimostra la città (senza dati personali)
                    <textarea name="evidence_snippet" minLength={20} maxLength={1500} required rows={3}
                      className="rounded-lg border px-3 py-2 text-sm" placeholder="Indirizzo/sede esplicitamente indicati sul sito ufficiale..."/>
                  </label>
                  <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white sm:col-span-2">
                    Invia alla revisione · non pubblica
                  </button>
                </form>
                </details>
              ) : null}
            </details>
          );
        })}
      </section>

      <section aria-labelledby="geo-evidence-review" className="space-y-3">
        <h2 id="geo-evidence-review" className="text-xl font-semibold">Evidenze da revisionare ({items.length})</h2>
        {!items.length && !pendingResult.error
          ? <p className="rounded-xl border bg-white p-4 text-sm text-[#52615b]">Nessuna evidenza geografica in attesa.</p> : null}
        {items.map((e) => <article key={e.id} className="space-y-3 rounded-2xl border bg-white p-4">
          <h3 className="font-semibold">{e.legal_name}</h3>
          <p className="text-sm">{e.city}{e.province_code ? " (" + e.province_code + ")" : ""}{e.region ? " · " + e.region : ""}</p>
          {e.address_line_1 ? <p className="text-sm">{e.address_line_1}</p> : null}
          <p className="text-xs text-[#52615b]">{e.source_kind} · {e.evidence_snippet}</p>
          <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm underline">Apri l'evidenza ↗</a>
          {canReview ? <form action={decideGeoEvidence} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={e.id}/>
            <label className="grid gap-1 text-sm">Decisione
              <select name="decision" className="min-h-11 rounded-lg border px-3 text-sm">
                <option value="conflict">Conflitto</option>
                <option value="rejected">Rifiuta</option>
                <option value="approved_for_facility_review">Approva per revisione sede</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">Motivazione
              <input name="note" required minLength={12} maxLength={2000} className="min-h-11 rounded-lg border px-3 text-sm" placeholder="Motivazione e controlli eseguiti"/>
            </label>
            <button className="min-h-11 rounded-xl border border-[#173f35] px-4 font-semibold sm:col-span-2">Registra prima revisione</button>
          </form> : null}
        </article>)}
      </section>

      <section aria-labelledby="geo-ready-publish" className="space-y-3">
        <h2 id="geo-ready-publish" className="text-xl font-semibold">Pubblicazione sedi approvate ({approved?.length ?? "—"})</h2>
        <p className="max-w-4xl text-sm text-[#52615b]">
          Seconda decisione esplicita. Pubblica solo città e regione documentate, con stato
          «non verificato» e ledger della fonte; non crea coordinate né attribuisce certificazioni.
        </p>
        {approved?.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm text-[#52615b]">Nessuna evidenza approvata da pubblicare.</p> : null}
        {approved?.map((e) => <article key={e.id} className="space-y-3 rounded-2xl border bg-white p-4">
          <h3 className="font-semibold">{e.legal_name} — {e.city} · {e.region}</h3>
          <p className="text-xs text-[#52615b]">Evidenza: {e.evidence_snippet}</p>
          <p className="text-xs text-[#52615b]">Prima revisione: {e.review_note || "—"}</p>
          <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm underline">Rivedi sito ufficiale ↗</a>
          {canPublish ? <form action={publishReviewedGeoEvidence} className="grid gap-2">
            <input type="hidden" name="evidence_id" value={e.id}/>
            <label className="grid gap-1 text-sm">Motivazione finale di pubblicazione
              <input name="publication_note" minLength={12} maxLength={2000} required
                className="min-h-11 rounded-lg border px-3 text-sm" placeholder="Verificati identità, città, regione e fonte ufficiale"/>
            </label>
            <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white">
              Pubblica sede dopo verifica
            </button>
          </form> : null}
        </article>)}
      </section>
    </main>
  );
}
