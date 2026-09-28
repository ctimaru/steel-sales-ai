import Link from "next/link";

import {
  getCompanyDiscoveryQueue,
  getCompanyDiscoveryRuns,
} from "@/lib/company-discovery";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";

import {
  closeExactDiscoveryDuplicates,
  reviewCompanyDiscovery,
  startCompanyDiscovery,
} from "./actions";

function badgeClass(value: string) {
  if (value === "published") return "bg-emerald-50 text-emerald-700";
  if (value === "rejected") return "bg-rose-50 text-rose-700";
  if (value === "duplicate_existing") return "bg-amber-50 text-amber-800";
  if (value === "enriched_existing") return "bg-cyan-50 text-cyan-800";
  return "bg-[#eef5f6] text-[#1b4c5d]";
}

export default async function CompanyDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string; error?: string }>;
}) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const status =
    params.status &&
    ["pending_review", "published", "rejected", "duplicate_existing", "enriched_existing"].includes(
      params.status,
    )
      ? params.status
      : "pending_review";
  const [queue, runs] = await Promise.all([
    getCompanyDiscoveryQueue(status),
    getCompanyDiscoveryRuns(),
  ]);
  const latestRun = runs[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">
          P3 · Industry Network
        </p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
              Company Discovery
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66768d]">
              Scansiona siti aziendali pubblici, classifica il ruolo nella filiera e
              porta i risultati in review. Il crawler non pubblica e non unisce mai
              automaticamente un&apos;azienda.
            </p>
          </div>
          <Link
            href="/network"
            className="platform-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
          >
            Apri Network ↗
          </Link>
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

      <section className="rounded-2xl border border-[#e1e8f2] bg-white p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6fed]">
              Nuova scansione
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1e2b45]">
              Seed URL → candidati
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">
              Un URL per riga. Il worker visita solo pagine pubbliche dello stesso
              dominio, applica limiti, robots.txt e blocco delle reti private.
            </p>
          </div>
          <form action={startCompanyDiscovery} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[110px_1fr_1.2fr]">
              <input
                name="country_code"
                defaultValue="IT"
                maxLength={2}
                className="h-11 rounded-xl border border-[#e1e8f2] px-3 text-sm uppercase outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                aria-label="Paese"
              />
              <select
                name="source_type"
                defaultValue="manual_url"
                className="h-11 rounded-xl border border-[#e1e8f2] bg-white px-3 text-sm text-[#40516a] outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
              >
                <option value="manual_url">URL manuali</option>
                <option value="web_search_curated">Web search curata</option>
                <option value="industry_directory">Directory industriale</option>
                <option value="association">Associazione</option>
                <option value="registry">Registro pubblico</option>
                <option value="other">Altra fonte</option>
              </select>
              <input
                name="label"
                maxLength={255}
                placeholder="Etichetta campagna, es. P3.5 Italy Tube Coverage B"
                className="h-11 rounded-xl border border-[#e1e8f2] px-3 text-sm outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
              />
            </div>
            <input
              name="source_reference"
              maxLength={2000}
              placeholder="Riferimento/provenance della coorte"
              className="h-11 w-full rounded-xl border border-[#e1e8f2] px-3 text-sm outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
            />
            <textarea
              name="seed_urls"
              required
              rows={6}
              placeholder={"https://azienda1.it/\nhttps://azienda2.it/"}
              className="w-full rounded-xl border border-[#e1e8f2] px-3 py-3 text-sm outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#7a899d]">
                P3.5: usa label e provenance per separare le campagne di coverage dalle revalidation e dagli enrichment batch.
              </p>
              <button className="platform-primary h-11 shrink-0 rounded-xl px-5 text-sm font-semibold">
                Avvia discovery
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["In coda", queue.total],
          ["Con quality flags", queue.quality.flagged],
          ["Enrichment ready", queue.quality.enrichment_ready],
          ["Exact identity match (senza enrichment)", queue.quality.exact_identity_matches],
          ["Ultimo batch", latestRun ? `${latestRun.candidate_count}/${latestRun.seed_count}` : "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
            <p className="text-2xl font-semibold text-[#1e2b45]">{String(value)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#8fa1a9]">
              {label}
            </p>
          </div>
        ))}
      </section>

      {latestRun ? (
        <section className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3c8192]">
                Ultimo run · {latestRun.extraction_version}
              </p>
              <p className="mt-2 text-sm font-semibold text-[#1e2b45]">
                {latestRun.label ?? latestRun.source_type}
              </p>
              <p className="mt-1 text-xs text-[#68788e]">
                {latestRun.seed_count} seed · {latestRun.candidate_count} candidati · {latestRun.skipped_count} skip · {latestRun.error_count} errori · {latestRun.exact_match_count} exact match
              </p>
            </div>
            <span className="rounded-full bg-[#eef5f6] px-3 py-1.5 text-xs font-semibold text-[#1b4c5d]">
              {latestRun.status}
            </span>
          </div>
        </section>
      ) : null}

      {runs.length ? (
        <section className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">
                Coverage telemetry
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#1e2b45]">Batch discovery recenti</h2>
            </div>
            <p className="hidden text-xs text-[#91a0b2] sm:block">seed → candidati → review</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[#91a0b2]">
                <tr className="border-b border-[#edf1f6]">
                  <th className="pb-2 pr-4 font-semibold">Campagna</th>
                  <th className="pb-2 pr-4 font-semibold">Fonte</th>
                  <th className="pb-2 pr-4 font-semibold">Seed</th>
                  <th className="pb-2 pr-4 font-semibold">Candidati</th>
                  <th className="pb-2 pr-4 font-semibold">Yield</th>
                  <th className="pb-2 pr-4 font-semibold">Skip / errori</th>
                  <th className="pb-2 font-semibold">Stato</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 8).map((run) => {
                  const yieldPct =
                    run.seed_count > 0
                      ? Math.round((run.candidate_count / run.seed_count) * 100)
                      : 0;
                  return (
                    <tr key={run.id} className="border-b border-[#f0f3f7] last:border-0">
                      <td className="py-3 pr-4 font-semibold text-[#34445c]">
                        <p>{run.label ?? "Senza etichetta"}</p>
                        <p className="mt-0.5 font-normal text-[#91a0b2]">run {run.id.slice(0, 8)}</p>
                      </td>
                      <td className="py-3 pr-4 text-[#68788e]">{run.source_type.replaceAll("_", " ")}</td>
                      <td className="py-3 pr-4 text-[#40516a]">{run.seed_count}</td>
                      <td className="py-3 pr-4 text-[#40516a]">{run.candidate_count}</td>
                      <td className="py-3 pr-4 font-semibold text-[#2f6fed]">{yieldPct}%</td>
                      <td className="py-3 pr-4 text-[#68788e]">{run.skipped_count} / {run.error_count}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-[#f1f5fa] px-2.5 py-1 font-semibold text-[#53637a]">
                          {run.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3c8192]">
              Review queue
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">
              {queue.total} candidati · {status.replaceAll("_", " ")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status === "pending_review" && queue.quality.exact_identity_matches > 0 ? (
              <form action={closeExactDiscoveryDuplicates}>
                <button className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                  Chiudi {queue.quality.exact_identity_matches} exact match senza enrichment
                </button>
              </form>
            ) : null}
            {[
              ["pending_review", "Da revisionare"],
              ["published", "Pubblicati"],
              ["duplicate_existing", "Duplicati"],
              ["enriched_existing", "Arricchiti"],
              ["rejected", "Rifiutati"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={`/platform/company-discovery?status=${key}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  status === key
                    ? "border border-[#2f6fed] bg-[#2f6fed] text-white"
                    : "border border-[#dbe5f1] bg-white text-[#40516a] hover:border-[#bdd1f4] hover:bg-[#f3f7ff] hover:text-[#2f6fed]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {queue.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c8d2d7] bg-white p-10 text-center">
            <p className="font-semibold text-[#22313a]">Nessun candidato in questa coda</p>
            <p className="mt-2 text-sm text-[#68788e]">
              Avvia una discovery oppure cambia filtro.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.items.map((candidate) => (
              <article
                key={candidate.id}
                className="rounded-2xl border border-[#e1e8f2] bg-white p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#1e2b45]">
                        {candidate.legal_name}
                      </h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass(candidate.review_status)}`}>
                        {candidate.review_status}
                      </span>
                      <span className="rounded-full bg-[#edf1f3] px-2.5 py-1 text-[11px] font-semibold text-[#53637a]">
                        {Math.round(Number(candidate.confidence) * 100)}% confidence
                      </span>
                      {candidate.quality_flags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                        >
                          {flag.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                    <a
                      href={candidate.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm font-medium text-[#2f6fed]"
                    >
                      {candidate.canonical_domain} ↗
                    </a>
                    {candidate.description ? (
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-[#68788e]">
                        {candidate.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-[#8fa1a9]">
                    <p>{candidate.country_code}</p>
                    <p>run {candidate.run_id.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8fa1a9]">
                      Ruoli proposti
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {candidate.role_keys.map((role) => (
                        <span key={role} className="rounded-full bg-[#eef5f6] px-2.5 py-1 text-xs font-semibold text-[#1b4c5d]">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8fa1a9]">
                      Subtype
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {candidate.subtype_keys.map((subtype) => (
                        <span key={subtype} className="rounded-full bg-[#edf1f3] px-2.5 py-1 text-xs text-[#53637a]">
                          {subtype}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8fa1a9]">
                      Identity & quality
                    </p>
                    <p className="mt-2 text-sm text-[#53637a]">
                      {candidate.match_company_id
                        ? `Possibile profilo esistente · ${candidate.match_signals.join(", ")}`
                        : "Nessun exact match rilevato"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#8fa1a9]">
                      extraction {candidate.extraction_version} · producer {Math.round((candidate.classification_scores.producer ?? 0) * 100)}% · trader {Math.round((candidate.classification_scores.trader_distributor ?? 0) * 100)}% · processor {Math.round((candidate.classification_scores.processor_service_provider ?? 0) * 100)}%
                    </p>
                  </div>
                </div>

                {(candidate.facility_candidates.length > 0 ||
                  candidate.capability_keys.length > 0 ||
                  candidate.market_keys.length > 0) ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-cyan-100 bg-cyan-50/40 p-4 lg:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
                        Facility proposte
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-[#53637a]">
                        {candidate.facility_candidates.length > 0 ? (
                          candidate.facility_candidates.map((facility, index) => (
                            <p key={`${facility.source_url}-${index}`}>
                              {[facility.name, facility.city, facility.region, facility.country_code]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ))
                        ) : (
                          <p>Nessuna facility strutturata</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
                        Capability
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {candidate.capability_keys.length > 0 ? (
                          candidate.capability_keys.map((key) => (
                            <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1b4c5d]">
                              {key.replaceAll("_", " ")}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[#68788e]">Nessuna</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
                        Mercati
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {candidate.market_keys.length > 0 ? (
                          candidate.market_keys.map((key) => (
                            <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1b4c5d]">
                              {key.replaceAll("_", " ")}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[#68788e]">Nessuno</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {candidate.evidence?.[0]?.snippet ? (
                  <div className="mt-4 rounded-xl bg-[#f6f8f9] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8fa1a9]">
                      Evidenza web
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#53637a]">
                      {candidate.evidence[0].snippet}
                    </p>
                    <a
                      href={candidate.evidence[0].url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-[#2f6fed]"
                    >
                      Apri fonte ↗
                    </a>
                  </div>
                ) : null}

                {candidate.review_status === "pending_review" ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#edf1f3] pt-4">
                    {!candidate.match_company_id ? (
                      <form action={reviewCompanyDiscovery}>
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <input type="hidden" name="decision" value="publish_new" />
                        <button className="platform-primary h-10 rounded-xl px-4 text-sm font-semibold">
                          Pubblica nuovo profilo
                        </button>
                      </form>
                    ) : null}
                    {candidate.match_company_id &&
                    (candidate.facility_candidates.length > 0 ||
                      candidate.capability_keys.length > 0 ||
                      candidate.market_keys.length > 0) ? (
                      <form
                        action={reviewCompanyDiscovery}
                        className="w-full rounded-xl border border-cyan-100 bg-cyan-50/50 p-4"
                      >
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <input type="hidden" name="decision" value="enrich_existing" />
                        <input
                          type="hidden"
                          name="existing_company_id"
                          value={candidate.match_company_id}
                        />
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div className="grid flex-1 gap-4 md:grid-cols-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
                                Approva facility
                              </p>
                              {candidate.facility_candidates.length > 0 ? (
                                <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-[#334852]">
                                  <input
                                    type="checkbox"
                                    name="include_facilities"
                                    className="mt-1 h-4 w-4"
                                  />
                                  <span>
                                    {candidate.facility_candidates.length} location strutturat
                                    {candidate.facility_candidates.length === 1 ? "a" : "e"}
                                  </span>
                                </label>
                              ) : (
                                <p className="mt-2 text-sm text-[#8fa1a9]">
                                  Nessuna proposta
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
                                Approva capability
                              </p>
                              <div className="mt-2 space-y-1.5">
                                {candidate.capability_keys.length > 0 ? (
                                  candidate.capability_keys.map((key) => (
                                    <label
                                      key={key}
                                      className="flex cursor-pointer items-start gap-2 text-sm text-[#334852]"
                                    >
                                      <input
                                        type="checkbox"
                                        name="capability_key"
                                        value={key}
                                        className="mt-1 h-4 w-4"
                                      />
                                      <span>{key.replaceAll("_", " ")}</span>
                                    </label>
                                  ))
                                ) : (
                                  <p className="text-sm text-[#8fa1a9]">Nessuna proposta</p>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
                                Approva mercati
                              </p>
                              <div className="mt-2 space-y-1.5">
                                {candidate.market_keys.length > 0 ? (
                                  candidate.market_keys.map((key) => (
                                    <label
                                      key={key}
                                      className="flex cursor-pointer items-start gap-2 text-sm text-[#334852]"
                                    >
                                      <input
                                        type="checkbox"
                                        name="market_key"
                                        value={key}
                                        className="mt-1 h-4 w-4"
                                      />
                                      <span>{key.replaceAll("_", " ")}</span>
                                    </label>
                                  ))
                                ) : (
                                  <p className="text-sm text-[#8fa1a9]">Nessuna proposta</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="min-w-[220px] space-y-2">
                            <input
                              name="note"
                              placeholder="Nota review (opzionale)"
                              className="h-10 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm outline-none"
                            />
                            <button className="h-10 w-full rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white">
                              Approva selezione
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-cyan-900/70">
                          Nessun elemento è preselezionato: l&apos;enrichment richiede
                          approvazione esplicita del singolo dato.
                        </p>
                      </form>
                    ) : null}
                    {candidate.match_company_id ? (
                      <form action={reviewCompanyDiscovery}>
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <input type="hidden" name="decision" value="duplicate_existing" />
                        <input
                          type="hidden"
                          name="existing_company_id"
                          value={candidate.match_company_id}
                        />
                        <button className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
                          Segna duplicato
                        </button>
                      </form>
                    ) : null}
                    <form action={reviewCompanyDiscovery}>
                      <input type="hidden" name="candidate_id" value={candidate.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button className="h-10 rounded-xl border border-[#e1e8f2] bg-white px-4 text-sm font-semibold text-[#53637a]">
                        Rifiuta
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
