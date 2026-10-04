import Link from "next/link";

import {
  getCompanyDataGovernanceRequests,
  getCompanyDiscoveryGovernance,
  getCompanyDiscoveryQueue,
  getCompanyDiscoveryRuns,
} from "@/lib/company-discovery";
import {
  getPlatformAccessContext,
  requirePlatformPermission,
} from "@/lib/platform-admin";

import {
  reviewCompanyDataRequest,
  reviewDiscoveryCandidateGovernance,
  reviewDiscoverySourceGovernance,
} from "../actions";

function statusBadge(status: string) {
  if (status === "approved" || status === "approved_company_data" || status === "resolved") {
    return "bg-emerald-50 text-emerald-800";
  }
  if (status === "blocked" || status === "rejected") {
    return "bg-rose-50 text-rose-800";
  }
  if (status === "restricted" || status === "needs_legal_review" || status === "in_review") {
    return "bg-amber-50 text-amber-800";
  }
  return "bg-[#eef2f0] text-[#52615b]";
}

export default async function CompanyDataGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformPermission("discovery.read");
  const access = await getPlatformAccessContext();
  const canGovern = access?.permissions.includes("discovery.governance_review") ?? false;
  const params = await searchParams;

  const [governance, runs, queue, requests] = await Promise.all([
    getCompanyDiscoveryGovernance(),
    getCompanyDiscoveryRuns(),
    getCompanyDiscoveryQueue("pending_review"),
    canGovern
      ? getCompanyDataGovernanceRequests()
      : Promise.resolve({ items: [], open_count: 0 }),
  ]);

  const runGovernance = new Map(governance.runs.map((item) => [item.run_id, item]));
  const candidateGovernance = new Map(
    governance.candidates.map((item) => [item.candidate_id, item]),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link
          href="/platform/company-discovery"
          className="text-sm font-semibold text-[#66736e] hover:text-[#1d2824]"
        >
          ← Company Discovery
        </Link>
      </div>

      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">PA1.5 · Legal & data governance gate</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
          Public Company Data Governance
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66736e]">
          La discovery può raccogliere candidati in staging, ma pubblicazione ed enrichment
          restano bloccati finché la fonte e il singolo candidato non superano il gate di
          riuso, diritti database e minimizzazione dei dati personali.
        </p>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>Regola PA1.5:</strong> un dato visibile sul web non viene trattato automaticamente
          come dato riutilizzabile. Il Network rimane privato e premium.
        </div>
      </section>

      {params.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {params.message}
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {params.error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Fonti da revisionare", governance.summary.source_review_required],
          ["Candidati da classificare", governance.summary.candidate_review_required],
          ["Pronti alla pubblicazione", governance.summary.publication_ready],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <p className="text-3xl font-semibold text-[#1d2824]">{String(value)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#87938e]">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Source gate
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Termini, riuso e diritti database
            </h2>
          </div>
          {!canGovern ? (
            <p className="text-xs text-[#87938e]">Sola lettura · decisione riservata al Platform Owner</p>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {runs.slice(0, 12).map((run) => {
            const state = runGovernance.get(run.id);
            return (
              <article key={run.id} className="rounded-xl border border-[#e2e7e4] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#1d2824]">{run.label ?? run.source_type}</p>
                  <span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + statusBadge(state?.governance_status ?? "unreviewed")}>
                    {state?.governance_status ?? "unreviewed"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#66736e]">
                  {run.source_type.replaceAll("_", " ")} · {run.source_reference ?? "nessun riferimento fonte"}
                </p>
                {state ? (
                  <p className="mt-2 text-xs leading-5 text-[#87938e]">
                    terms: {state.terms_status} · database rights: {state.database_rights_status} · personal data: {state.personal_data_policy}
                  </p>
                ) : null}

                {canGovern ? (
                  <form action={reviewDiscoverySourceGovernance} className="mt-4 grid gap-3 lg:grid-cols-5">
                    <input type="hidden" name="run_id" value={run.id} />
                    <select name="decision" defaultValue="approved" className="h-10 rounded-xl border border-[#dce2df] bg-white px-3 text-xs">
                      <option value="approved">Approva fonte</option>
                      <option value="restricted">Uso ristretto</option>
                      <option value="blocked">Blocca fonte</option>
                    </select>
                    <select name="terms_status" defaultValue="allows_reuse" className="h-10 rounded-xl border border-[#dce2df] bg-white px-3 text-xs">
                      <option value="allows_reuse">Termini: riuso consentito</option>
                      <option value="allows_limited_reuse">Termini: riuso limitato</option>
                      <option value="restricts_reuse">Termini: riuso ristretto</option>
                      <option value="unknown">Termini: non chiari</option>
                    </select>
                    <select name="database_rights_status" defaultValue="low_risk" className="h-10 rounded-xl border border-[#dce2df] bg-white px-3 text-xs">
                      <option value="low_risk">DB rights: rischio basso</option>
                      <option value="licensed">DB rights: licenza valida</option>
                      <option value="restricted">DB rights: restrizioni</option>
                      <option value="unknown">DB rights: da chiarire</option>
                    </select>
                    <select name="personal_data_policy" defaultValue="exclude_personal_data" className="h-10 rounded-xl border border-[#dce2df] bg-white px-3 text-xs">
                      <option value="company_data_only">Solo dati societari</option>
                      <option value="exclude_personal_data">Escludi dati personali</option>
                      <option value="legal_review_required">Review legale necessaria</option>
                    </select>
                    <button className="platform-primary h-10 rounded-xl px-4 text-xs font-semibold">
                      Registra decisione
                    </button>
                    <input name="note" maxLength={4000} placeholder="Nota/evidenza della review della fonte" className="h-10 rounded-xl border border-[#dce2df] px-3 text-xs lg:col-span-5" />
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3c8192]">
          Candidate gate
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
          Dato societario vs dato personale
        </h2>

        <div className="mt-5 space-y-3">
          {queue.items.slice(0, 80).map((candidate) => {
            const state = candidateGovernance.get(candidate.id);
            const sourceState = runGovernance.get(candidate.run_id);
            return (
              <article key={candidate.id} className="rounded-xl border border-[#e2e7e4] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#1d2824]">{candidate.legal_name}</p>
                  <span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + statusBadge(state?.governance_status ?? "unreviewed")}>
                    {state?.governance_status ?? "unreviewed"}
                  </span>
                  <span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + (state?.publication_gate_ready ? "bg-emerald-50 text-emerald-800" : "bg-[#eef2f0] text-[#52615b]")}>
                    {state?.publication_gate_ready ? "PA1.5 ready" : "PA1.5 locked"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#66736e]">
                  {candidate.country_code} · {candidate.canonical_domain} · source {sourceState?.governance_status ?? "unreviewed"}
                </p>
                {candidate.evidence?.[0]?.snippet ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#87938e]">
                    {candidate.evidence[0].snippet}
                  </p>
                ) : null}

                {canGovern ? (
                  <form action={reviewDiscoveryCandidateGovernance} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]">
                    <input type="hidden" name="candidate_id" value={candidate.id} />
                    <select name="decision" defaultValue="approved_company_data" className="h-10 rounded-xl border border-[#dce2df] bg-white px-3 text-xs">
                      <option value="approved_company_data">Approva: dati societari</option>
                      <option value="needs_legal_review">Review legale</option>
                      <option value="blocked">Blocca candidato</option>
                    </select>
                    <label className="flex h-10 items-center gap-2 rounded-xl border border-[#dce2df] px-3 text-xs text-[#52615b]">
                      <input type="checkbox" name="personal_data_detected" />
                      Dati personali rilevati
                    </label>
                    <input name="personal_data_fields" maxLength={500} placeholder="Campi personali, separati da virgola" className="h-10 rounded-xl border border-[#dce2df] px-3 text-xs" />
                    <button className="platform-primary h-10 rounded-xl px-4 text-xs font-semibold">
                      Salva gate
                    </button>
                    <input name="note" maxLength={4000} placeholder="Nota governance candidato" className="h-10 rounded-xl border border-[#dce2df] px-3 text-xs md:col-span-4" />
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {canGovern ? (
        <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a5a16]">
                Public correction & removal channel
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
                {requests.open_count} richieste aperte
              </h2>
            </div>
            <Link href="/company-data" className="text-xs font-semibold text-[#1a5144]">
              Apri pagina pubblica ↗
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {requests.items.slice(0, 50).map((request) => (
              <article key={request.id} className="rounded-xl border border-[#e2e7e4] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#1d2824]">{request.company_name}</p>
                  <span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + statusBadge(request.status)}>
                    {request.request_type} · {request.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#66736e]">
                  {request.contact_email}{request.country_code ? " · " + request.country_code : ""}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#52615b]">{request.request_text}</p>
                {request.source_url ? (
                  <a href={request.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#1a5144]">
                    Fonte indicata ↗
                  </a>
                ) : null}
                {request.status === "received" || request.status === "in_review" ? (
                  <form action={reviewCompanyDataRequest} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="request_id" value={request.id} />
                    <select name="status" defaultValue={request.status === "received" ? "in_review" : "resolved"} className="h-10 rounded-xl border border-[#dce2df] bg-white px-3 text-xs">
                      <option value="in_review">Prendi in carico</option>
                      <option value="resolved">Risolvi</option>
                      <option value="rejected">Chiudi come non fondata</option>
                    </select>
                    <input name="note" maxLength={4000} placeholder="Nota di gestione" className="h-10 flex-1 rounded-xl border border-[#dce2df] px-3 text-xs" />
                    <button className="h-10 rounded-xl bg-[#1a5144] px-4 text-xs font-semibold text-white">
                      Aggiorna
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
