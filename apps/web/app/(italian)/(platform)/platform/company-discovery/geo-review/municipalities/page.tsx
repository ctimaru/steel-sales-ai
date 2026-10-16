import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { safeNetworkWebsiteUrl } from "@/lib/network-free";
import { decideMunicipalityMatch, stageMunicipalityMatch } from "./actions";

export const dynamic = "force-dynamic";

type Facility = {
  facility_id: string; company_id: string; company: string;
  website_url: string | null; city: string; region: string;
  has_approved_match: boolean; pending_reviews: number;
};
type Proposed = {
  id: string; company: string; city: string; province_code: string;
  municipality_name: string; region: string; istat_code: string;
  source_url: string; evidence_snippet: string;
};
type Queue = {
  contract: "netux3a-reconcile-v1";
  reference_count: number;
  reference_date: string | null;
  items: Facility[];
  pending: Proposed[];
};

export default async function MunicipalityReconciliationPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; message?: string }> }) {
  await requirePlatformPermission("discovery.read");
  const access = await getPlatformAccessContext();
  const canEnrich = access?.permissions.includes("discovery.enrich") ?? false;
  const canDecide = Boolean(access?.permissions.includes("discovery.governance_review") &&
                            access?.permissions.includes("discovery.publish"));
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netux3a_reconciliation_queue");
  const queue = !error && (data as Queue | null)?.contract === "netux3a-reconcile-v1"
    ? data as Queue : null;
  const available = Boolean(queue && queue.reference_count === 7894);

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
    <Link className="text-sm font-semibold text-[#175640] underline"
      href="/platform/company-discovery/geo-review">← Torna a revisione geografica</Link>
    <header className="space-y-2">
      <p className="platform-kicker">NET-UX3A · Italia · ISTAT</p>
      <h1 className="text-3xl font-semibold text-[#173f35]">Riconciliazione comuni e province</h1>
      <p className="max-w-3xl text-sm leading-6 text-[#52615b]">
        Un comune si associa a una sede soltanto con il codice della provincia e
        un indirizzo aziendale documentato. La proposta non modifica le sedi; dopo
        una revisione umana separata abilita solo il filtro geografico avanzato.
      </p>
    </header>
    {params.error || error
      ? <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950">
          {params.error || "Riferimento non disponibile o accesso insufficiente."}
        </p> : null}
    {params.message
      ? <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{params.message}</p>
      : null}
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Stato riferimento ISTAT">
      <div className="rounded-2xl border bg-white p-4">
        <p className="text-xs text-[#52615b]">Comuni di riferimento attivi</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-[#173f35]">{queue?.reference_count ?? "—"} / 7.894</p>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <p className="text-xs text-[#52615b]">Sedi pubblicate con città</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-[#173f35]">{queue?.items.length ?? "—"}</p>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <p className="text-xs text-[#52615b]">Proposte da revisionare</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-[#173f35]">{queue?.pending.length ?? "—"}</p>
      </div>
    </section>
    {!available ? <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      Riferimento ISTAT non ancora importato o incompleto: proposte e approvazioni disabilitate.
      L'import ufficiale deve passare validazione 7.894 comuni e attivazione atomica.
      Nessuna corrispondenza basata sul solo nome di città è ammessa.
    </p> : <p className="text-sm text-[#52615b]">
      Riferimento ISTAT attivo al {queue?.reference_date ?? "—"}.
      Fonte: <a href="https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/"
        target="_blank" rel="noopener noreferrer" className="underline">ISTAT – codici territoriali</a>, CC BY 4.0.
    </p>}

    <section className="space-y-3" aria-labelledby="municipality-facilities">
      <h2 id="municipality-facilities" className="text-xl font-semibold text-[#173f35]">Sedi da riconciliare</h2>
      {queue?.items.filter(item => !item.has_approved_match).length === 0
        ? <p className="rounded-2xl border bg-white p-4 text-sm text-[#52615b]">Nessuna sede aperta.</p>
        : null}
      {queue?.items.filter(item => !item.has_approved_match).map((item) => {
        const website = safeNetworkWebsiteUrl(item.website_url);
        return <article key={item.facility_id} className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-[#173f35]">{item.company}</h3>
              <p className="text-sm text-[#52615b]">{item.city} · {item.region}</p>
            </div>
            {item.pending_reviews > 0
              ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-900">{item.pending_reviews} in revisione</span>
              : null}
          </div>
          {website ? <a href={website} target="_blank" rel="noopener noreferrer"
            className="text-sm text-[#175640] underline">Sito ufficiale aziendale ↗</a> : null}
          {available && website && canEnrich ? (
            <form action={stageMunicipalityMatch} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="facility_id" value={item.facility_id}/>
              <label className="grid gap-1 text-sm">Sigla provincia dichiarata (es. MI)
                <input name="province_code" minLength={2} maxLength={2} required
                  className="min-h-11 rounded-lg border px-3 uppercase" placeholder="MI"/>
              </label>
              <label className="grid gap-1 text-sm">URL fonte ufficiale dell'indirizzo
                <input name="source_url" type="url" maxLength={1800} required defaultValue={website}
                  className="min-h-11 min-w-0 rounded-lg border px-3 text-sm"/>
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Estratto con città e sigla provincia esplicite
                <textarea name="evidence_snippet" minLength={20} maxLength={1500}
                  rows={2} required placeholder="Sede aziendale: Milano (MI), ..."
                  className="rounded-lg border px-3 py-2 text-sm"/>
              </label>
              <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white sm:col-span-2">
                Proponi match ufficiale · non modifica la sede
              </button>
            </form>) : null}
        </article>;
      })}
    </section>
    <section className="space-y-3" aria-labelledby="municipality-review">
      <h2 id="municipality-review" className="text-xl font-semibold text-[#173f35]">
        Evidenze da approvare ({queue?.pending.length ?? "—"})
      </h2>
      {!queue?.pending.length
        ? <p className="rounded-2xl border bg-white p-4 text-sm text-[#52615b]">Nessuna proposta attiva.</p>
        : null}
      {queue?.pending.map((item) => <article key={item.id} className="space-y-2 rounded-2xl border bg-white p-4">
        <h3 className="font-semibold">{item.company}</h3>
        <p className="text-sm">{item.municipality_name} ({item.province_code}) · {item.region} · ISTAT {item.istat_code}</p>
        <p className="text-xs text-[#52615b]">{item.evidence_snippet}</p>
        <a className="block break-all text-sm text-[#175640] underline"
          href={item.source_url} target="_blank" rel="noopener noreferrer">Controlla la fonte ↗</a>
        {available && canDecide ? <form action={decideMunicipalityMatch} className="grid gap-2 sm:grid-cols-2">
          <input name="review_id" type="hidden" value={item.id}/>
          <label className="grid gap-1 text-sm">Decisione
            <select name="decision" className="min-h-11 rounded-lg border px-3">
              <option value="rejected">Rifiuta</option>
              <option value="approved">Approva codice ISTAT</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Motivazione revisore
            <input name="note" minLength={12} maxLength={2000} required
              className="min-h-11 rounded-lg border px-3"/>
          </label>
          <button className="min-h-11 rounded-xl border border-[#173f35] px-4 text-sm font-semibold sm:col-span-2">
            Registra decisione · non modifica la sede
          </button>
        </form> : null}
      </article>)}
    </section>
  </main>;
}
