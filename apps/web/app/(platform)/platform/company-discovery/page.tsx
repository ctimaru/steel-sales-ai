import Link from "next/link";

import { getCompanyDiscoveryQueue } from "@/lib/company-discovery";

import {
  reviewCompanyDiscovery,
  startCompanyDiscovery,
} from "./actions";

function badgeClass(value: string) {
  if (value === "published") return "bg-emerald-50 text-emerald-700";
  if (value === "rejected") return "bg-rose-50 text-rose-700";
  if (value === "duplicate_existing") return "bg-amber-50 text-amber-800";
  return "bg-[#eef5f6] text-[#1b4c5d]";
}

export default async function CompanyDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status &&
    ["pending_review", "published", "rejected", "duplicate_existing"].includes(
      params.status,
    )
      ? params.status
      : "pending_review";
  const queue = await getCompanyDiscoveryQueue(status);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl bg-[#0b171e] p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8fb7c1]">
          P3 · Industry Network
        </p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Company Discovery
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9babb2]">
              Scansiona siti aziendali pubblici, classifica il ruolo nella filiera e
              porta i risultati in review. Il crawler non pubblica e non unisce mai
              automaticamente un&apos;azienda.
            </p>
          </div>
          <Link
            href="/network"
            className="inline-flex h-10 items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white"
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

      <section className="rounded-2xl border border-[#d9e0e4] bg-white p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#28677a]">
              Nuova scansione
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#17232d]">
              Seed URL → candidati
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66737d]">
              Un URL per riga. Il worker visita solo pagine pubbliche dello stesso
              dominio, applica limiti, robots.txt e blocco delle reti private.
            </p>
          </div>
          <form action={startCompanyDiscovery} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
              <input
                name="country_code"
                defaultValue="IT"
                maxLength={2}
                className="h-11 rounded-xl border border-[#d9e0e4] px-3 text-sm uppercase outline-none"
                aria-label="Paese"
              />
              <textarea
                name="seed_urls"
                required
                rows={6}
                placeholder={"https://azienda1.it/\nhttps://azienda2.it/"}
                className="w-full rounded-xl border border-[#d9e0e4] px-3 py-3 text-sm outline-none"
              />
            </div>
            <button className="h-11 rounded-xl bg-[#1b4c5d] px-5 text-sm font-semibold text-white">
              Avvia discovery
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3c8192]">
              Review queue
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#17232d]">
              {queue.total} candidati · {status.replaceAll("_", " ")}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["pending_review", "Da revisionare"],
              ["published", "Pubblicati"],
              ["duplicate_existing", "Duplicati"],
              ["rejected", "Rifiutati"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={`/platform/company-discovery?status=${key}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  status === key
                    ? "bg-[#0b171e] text-white"
                    : "border border-[#d9e0e4] bg-white text-[#52636c]"
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
            <p className="mt-2 text-sm text-[#66737d]">
              Avvia una discovery oppure cambia filtro.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.items.map((candidate) => (
              <article
                key={candidate.id}
                className="rounded-2xl border border-[#d9e0e4] bg-white p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#17232d]">
                        {candidate.legal_name}
                      </h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass(candidate.review_status)}`}>
                        {candidate.review_status}
                      </span>
                      <span className="rounded-full bg-[#edf1f3] px-2.5 py-1 text-[11px] font-semibold text-[#52636c]">
                        {Math.round(Number(candidate.confidence) * 100)}% confidence
                      </span>
                    </div>
                    <a
                      href={candidate.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm font-medium text-[#28677a]"
                    >
                      {candidate.canonical_domain} ↗
                    </a>
                    {candidate.description ? (
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66737d]">
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
                        <span key={subtype} className="rounded-full bg-[#edf1f3] px-2.5 py-1 text-xs text-[#52636c]">
                          {subtype}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8fa1a9]">
                      Identity match
                    </p>
                    <p className="mt-2 text-sm text-[#52636c]">
                      {candidate.match_company_id
                        ? `Possibile profilo esistente · ${candidate.match_signals.join(", ")}`
                        : "Nessun exact match rilevato"}
                    </p>
                  </div>
                </div>

                {candidate.evidence?.[0]?.snippet ? (
                  <div className="mt-4 rounded-xl bg-[#f6f8f9] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8fa1a9]">
                      Evidenza web
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#52636c]">
                      {candidate.evidence[0].snippet}
                    </p>
                    <a
                      href={candidate.evidence[0].url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-[#28677a]"
                    >
                      Apri fonte ↗
                    </a>
                  </div>
                ) : null}

                {candidate.review_status === "pending_review" ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#edf1f3] pt-4">
                    <form action={reviewCompanyDiscovery}>
                      <input type="hidden" name="candidate_id" value={candidate.id} />
                      <input type="hidden" name="decision" value="publish_new" />
                      <button className="h-10 rounded-xl bg-[#0b171e] px-4 text-sm font-semibold text-white">
                        Pubblica nuovo profilo
                      </button>
                    </form>
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
                      <button className="h-10 rounded-xl border border-[#d9e0e4] bg-white px-4 text-sm font-semibold text-[#52636c]">
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
