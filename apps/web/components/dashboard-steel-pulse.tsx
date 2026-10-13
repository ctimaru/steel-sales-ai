import Link from "next/link";

import { setPulseArticleEngagement } from "@/app/(italian)/(workspace)/pulse/actions";
import { appRoutes } from "@/lib/routes";
import type { DashboardPulseState } from "@/lib/dashboard-pulse";
import { pulseTopics } from "@/lib/steel-pulse-personalized";

function publicationDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(value));
}

const actionClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#c4d6cb] bg-white px-3 text-xs font-semibold text-[#195543] transition hover:bg-[#edf5f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50]";

export function DashboardSteelPulse({ state }: { state: DashboardPulseState }) {
  const cards = state.feed?.items ?? [];
  const saved = new Set(state.engagement?.saved_urls ?? []);
  const read = new Set(state.engagement?.read_urls ?? []);

  return (
    <section aria-labelledby="dashboard-pulse-heading" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#22634f]">Steel Pulse · Per te</p>
          <h2 id="dashboard-pulse-heading" className="mt-1 text-2xl font-semibold tracking-tight text-[#173f35] sm:text-[1.7rem]">
            Il tuo aggiornamento sull’acciaio
          </h2>
          <p className="mt-1 text-sm text-[#52615b]">Notizie e segnali selezionati in base ai tuoi interessi.</p>
        </div>
        <Link href={appRoutes.steelPulse} className="inline-flex min-h-11 items-center rounded-lg border border-[#bcd5c7] bg-white px-3 text-xs font-semibold text-[#175640] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
          Personalizza il feed →
        </Link>
      </div>

      <nav aria-label="Viste Steel Pulse" className="flex flex-wrap gap-2 text-xs">
        <span aria-current="page" className="inline-flex min-h-10 items-center rounded-full bg-[#173f35] px-4 font-semibold text-white">
          Per te
        </span>
        <Link href="/pulse?view=unread" className="inline-flex min-h-10 items-center rounded-full border border-[#d1ded7] bg-white px-4 font-semibold text-[#245344] hover:bg-[#f2f7f4]">
          Da leggere
        </Link>
        <Link href="/pulse?view=saved" className="inline-flex min-h-10 items-center rounded-full border border-[#d1ded7] bg-white px-4 font-semibold text-[#245344] hover:bg-[#f2f7f4]">
          Salvati
        </Link>
      </nav>

      {!state.available ? (
        <div role="status" className="rounded-2xl border border-[#d3e0d8] bg-white p-5">
          <h3 className="text-base font-semibold text-[#173f35]">Steel Pulse temporaneamente non disponibile</h3>
          <p className="mt-2 text-sm leading-6 text-[#53655c]">
            Non possiamo mostrare gli aggiornamenti verificati in questo momento. Le tue attività commerciali rimangono disponibili.
          </p>
          <Link href={appRoutes.steelPulse} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">Apri Steel Pulse →</Link>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#bdcfc6] bg-white p-5 sm:p-6">
          <h3 className="text-base font-semibold text-[#173f35]">Nessuna notizia verificata per ora</h3>
          <p className="mt-2 text-sm leading-6 text-[#53655c]">
            Il feed mostra soltanto contenuti approvati e con fonti verificabili. Personalizza gli interessi oppure consulta la Scuola.
          </p>
          <Link href={appRoutes.knowledge.home} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">Esplora la Scuola →</Link>
        </div>
      ) : (
        <div className="space-y-3" aria-label="Notizie Steel Pulse">
          {cards.map((card) => (
            <article key={card.source_url} className="rounded-2xl border border-[#d7e3dc] bg-white p-4 shadow-[0_4px_20px_rgba(18,61,52,0.03)] sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#586a60]">
                <span className="rounded-full bg-[#e9f4ed] px-2.5 py-1 font-semibold text-[#205b45]">
                  {pulseTopics.find((topic) => topic.key === card.topic)?.label ?? "Acciaio"}
                </span>
                <span className="font-medium">{card.source_name}</span>
                {publicationDate(card.source_published_at) ? (
                  <time dateTime={card.source_published_at ?? undefined}>· {publicationDate(card.source_published_at)}</time>
                ) : null}
                {read.has(card.source_url) ? <span className="ml-auto text-[#53655c]">Già letto</span> : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-snug text-[#173f35]">{card.headline}</h3>
              <p className="mt-2 text-sm leading-6 text-[#43554d]">{card.summary}</p>
              <div className="mt-3 rounded-xl border-l-[3px] border-[#49876e] bg-[#f3f8f4] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#27664c]">Perché ti interessa</p>
                <p className="mt-1 text-sm leading-6 text-[#43584b]">{card.relevance}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={card.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label={"Apri fonte originale: " + card.source_name + " (nuova scheda)"}
                >Fonte originale ↗</a>
                {state.engagement ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={setPulseArticleEngagement}>
                      <input type="hidden" name="return_to" value="dashboard" />
                      <input type="hidden" name="source_url" value={card.source_url} />
                      <input type="hidden" name="engagement_action" value={saved.has(card.source_url) ? "unsave" : "save"} />
                      <button type="submit" className={actionClass} aria-label={saved.has(card.source_url) ? "Rimuovi la notizia dai salvati" : "Salva la notizia"}>
                        {saved.has(card.source_url) ? "Salvato ✓" : "Salva"}
                      </button>
                    </form>
                    <form action={setPulseArticleEngagement}>
                      <input type="hidden" name="return_to" value="dashboard" />
                      <input type="hidden" name="source_url" value={card.source_url} />
                      <input type="hidden" name="engagement_action" value={read.has(card.source_url) ? "unread" : "read"} />
                      <button type="submit" className={actionClass} aria-label={read.has(card.source_url) ? "Segna la notizia come da leggere" : "Segna la notizia come letta"}>
                        {read.has(card.source_url) ? "Letto ✓" : "Segna letto"}
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="text-xs text-[#52615b]">Salvataggi non disponibili</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="flex justify-center">
        <Link href={appRoutes.steelPulse} className="inline-flex min-h-11 items-center rounded-xl border border-[#b9d1c4] bg-[#f5faf7] px-5 text-sm font-semibold text-[#175640] hover:bg-[#eaf4ed]">
          Apri tutto Steel Pulse →
        </Link>
      </div>
    </section>
  );
}
