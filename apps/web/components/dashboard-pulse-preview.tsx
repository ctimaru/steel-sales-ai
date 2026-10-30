import Image from "next/image";
import Link from "next/link";

import type { DashboardPulseState } from "@/lib/dashboard-pulse";
import { appRoutes } from "@/lib/routes";
import { pulseTopics } from "@/lib/steel-pulse-personalized";

type PulsePreviewCard = {
  headline: string;
  summary: string;
  category: string;
  image: string;
  sourceName?: string;
  publishedAt?: string | null;
  sourceUrl?: string;
};

// Educational examples, NOT actual articles, market facts or sourced news.
// No dates, prices, fabricated sources or publishing/engagement mutations.
const DEMO_CARDS: readonly PulsePreviewCard[] = [
  {
    category: "Mercato · Esempio",
    headline: "Tubi d’acciaio: quali fattori incidono sui prezzi?",
    summary: "Materie prime, geometrie, quantità e tempi di consegna da considerare.",
    image: "/home-cine1e-steel-desktop.webp",
  },
  {
    category: "Acquisti · Esempio",
    headline: "RFQ industriali: come descrivere il materiale",
    summary: "Norme, qualità, misure e documentazione utili per chiedere un’offerta.",
    image: "/home-cine2a2b-factory-desktop.webp",
  },
  {
    category: "Sostenibilità · Esempio",
    headline: "Acciaio a basse emissioni: cosa verificare",
    summary: "Dichiarazioni ambientali, tracciabilità e dati da richiedere ai fornitori.",
    image: "/home-cine1a-steel.webp",
  },
];

function publishedDate(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(value));
}

/**
 * HOME-AUTH-PULSE2: read-only presentation of the already authorized SP5 feed.
 * Show clearly marked static editorial examples only while NO approved
 * items are returned. Never mix demos with genuine news, infer dates, or
 * create a source link/engagement action for a demo.
 */
export function DashboardPulsePreview({ state }: { state: DashboardPulseState }) {
  const published = state.available ? state.feed?.items.slice(0, 3) ?? [] : [];
  const demo = published.length === 0;
  const cards: readonly PulsePreviewCard[] = demo ? DEMO_CARDS : published.map((item, index) => ({
    headline: item.headline,
    summary: item.summary,
    category: pulseTopics.find((topic) => topic.key === item.topic)?.label ?? "Acciaio",
    sourceName: item.source_name,
    publishedAt: item.source_published_at,
    sourceUrl: item.source_url,
    image: DEMO_CARDS[index].image, // decorative industrial library image, not article media
  }));

  return (
    <section
      data-testid="dashboard-pulse-preview"
      aria-labelledby="dashboard-pulse-preview-title"
      className="min-w-0 rounded-2xl border border-[#d3e0da] bg-[linear-gradient(120deg,#f7faf8_0%,#ffffff_88%)] p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 sm:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#26614d]">Steel Pulse · Per te</p>
          <h2 id="dashboard-pulse-preview-title" className="mt-1 text-lg font-semibold tracking-tight text-[#173f35]">
            Segnali dal mondo dell’acciaio
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-[#53665c]">
            {demo
              ? "Esempi dei temi che Steel Pulse potrà raccontare."
              : "Anteprime di notizie approvate e disponibili nel tuo feed."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {demo ? (
            <span
              data-testid="steel-pulse-demo-badge"
              className="inline-flex items-center rounded-full border border-[#bdd6e7] bg-[#eaf3fa] px-2.5 py-1 text-[11px] font-semibold text-[#215476]"
            >
              Anteprime demo · Non sono notizie
            </span>
          ) : null}
          <Link href={appRoutes.steelPulse} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50]">
            {demo ? "Personalizza Steel Pulse" : "Vedi tutte le notizie"} <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        </div>
      </div>
      <div className="mt-3 grid min-w-0 gap-2.5 md:grid-cols-2 xl:grid-cols-3" aria-label={demo ? "Esempi editoriali dimostrativi" : "Anteprime di notizie verificate"}>
        {cards.map((card, index) => {
          const inner = (
            <>
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[#eaf1ec] sm:h-24 sm:w-24">
                <Image src={card.image} alt="" fill sizes="96px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#61746a]">
                  {card.category}
                  {demo ? " · Demo" : (publishedDate(card.publishedAt) ? " · " + publishedDate(card.publishedAt) : "")}
                </p>
                <h3 className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#173f35] sm:text-sm">{card.headline}</h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-[1.05rem] text-[#586a60]">{card.summary}</p>
                {card.sourceName ? <p className="mt-1 truncate text-[10px] text-[#52665a]">Fonte: {card.sourceName}</p> : null}
              </div>
            </>
          );
          const styles = "flex min-w-0 gap-3 rounded-xl border border-[#dce6df] bg-white p-2.5";
          return card.sourceUrl ? (
            <a key={card.sourceUrl} data-testid="steel-pulse-preview-card" href={card.sourceUrl} target="_blank" rel="noopener noreferrer"
              aria-label={"Apri fonte originale: " + (card.sourceName ?? card.headline)}
              className={styles + " transition hover:border-[#a8c6b3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50]"}>
              {inner}
            </a>
          ) : (
            <article key={index} data-testid="steel-pulse-preview-card" data-demo="true" className={styles}>
              {inner}
            </article>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[#64756b]">
        {demo
          ? "Contenuti illustrativi, non notizie pubblicate: nessuna fonte o data è simulata."
          : "Immagini industriali illustrative; consulta sempre la fonte originale per i dettagli."}
      </p>
    </section>
  );
}
