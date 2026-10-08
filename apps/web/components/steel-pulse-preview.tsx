import Link from "next/link";

import type { SteelPulsePublicCard } from "@/lib/steel-pulse-public";

const topicNames: Record<SteelPulsePublicCard["topic"], string> = {
  market: "Mercato",
  trade: "Commercio",
  regulation: "Normative",
  raw_materials: "Materie prime",
  technology: "Tecnologia",
  companies: "Industria",
};

function displayDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function SteelPulsePreview({ cards }: { cards: SteelPulsePublicCard[] }) {
  const news = cards.slice(0, 3);
  return (
    <aside
      id="steel-pulse"
      aria-labelledby="steel-pulse-heading"
      className="min-w-0 rounded-[28px] border border-[#cdded7] bg-[#f9fbfa] p-5 shadow-[0_14px_44px_rgba(18,61,52,0.05)] sm:p-7 lg:p-8"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#123d34] text-sm font-bold text-white" aria-hidden="true">
          S
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1f6b5a]">
          Steel Pulse
        </span>
        <span className="ml-auto rounded-full border border-[#b9d4c8] bg-[#e8f3ed] px-2.5 py-1 text-[11px] font-semibold text-[#174638]">
          Market intelligence
        </span>
      </div>

      <h2 id="steel-pulse-heading" className="mt-5 text-[1.55rem] font-semibold leading-tight tracking-[-0.025em] text-[#123d34] sm:text-[1.75rem]">
        Un motivo in più per tornare.
      </h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-[#52615b]">
        Aggiornamenti selezionati sul mercato dell’acciaio, con la fonte originale e
        un punto di vista utile a chi compra, produce e vende.
      </p>

      {news.length > 0 ? (
        <div className="mt-6 space-y-3" aria-label="Ultime notizie Steel Pulse">
          {news.map((card) => (
            <article
              key={card.source_url}
              className="rounded-2xl border border-[#dde6e1] bg-white p-4 shadow-[0_4px_16px_rgba(18,61,52,0.025)] sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64736c]">
                <span className="rounded-full bg-[#edf5f1] px-2.5 py-1 font-semibold text-[#24634f]">
                  {topicNames[card.topic]}
                </span>
                {displayDate(card.source_published_at) ? (
                  <time dateTime={card.source_published_at ?? undefined}>
                    {displayDate(card.source_published_at)}
                  </time>
                ) : null}
              </div>
              <h3 className="mt-3 text-base font-semibold leading-6 text-[#173e34]">
                {card.headline}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#52615b]">{card.summary}</p>
              <div className="mt-3 rounded-xl border-l-[3px] border-[#4b907b] bg-[#f2f7f4] px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#2d6855]">
                  Perché ti interessa
                </p>
                <p className="mt-1 text-xs leading-5 text-[#40564d]">{card.relevance}</p>
              </div>
              <a
                href={card.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-[#175b49] underline decoration-[#adcec1] underline-offset-4 hover:text-[#123d34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]"
                aria-label={"Leggi la fonte originale: " + card.source_name + " (si apre in una nuova scheda)"}
              >
                Fonte: {card.source_name} <span className="ml-1" aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-[#bcd1c7] bg-white p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1f6b5a]">
            In preparazione
          </p>
          <h3 className="mt-2 text-base font-semibold text-[#173e34]">
            Le notizie verificate arriveranno qui.
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#52615b]">
            Steel Pulse pubblicherà solo aggiornamenti con fonti e diritti verificati.
            Nel frattempo puoi usare gratuitamente le risorse di settore.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/knowledge"
              className="app-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold"
            >
              Esplora la Scuola
            </Link>
            <Link
              href="/knowledge/tubes#calcolatore-pesi"
              className="inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-[#1d604e] underline decoration-[#bdd3c7] underline-offset-4"
            >
              Calcolo pesi →
            </Link>
          </div>
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-[#62736c]">
        Il feed è pubblico. Il Workspace e i dati commerciali delle aziende rimangono riservati.
      </p>
    </aside>
  );
}
