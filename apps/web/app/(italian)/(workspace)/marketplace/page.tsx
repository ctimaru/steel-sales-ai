import Link from "next/link";

import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { appRoutes } from "@/lib/routes";

/**
 * MKT-VISION1 (founder request, 24 Nov 2026): for now the Marketplace page only illustrates the
 * founder's vision of the B2B steel marketplace (TRANS-B2B1, approved 17 Nov 2026).
 * No feed, no readiness check and no operational CTAs: the existing Marketplace sub-routes and data
 * layer stay untouched and reachable, but this entry page reads no data and promises no dates.
 */

const journey = [
  {
    step: "1",
    title: "Chiedi",
    body: "Scrivi cosa ti serve come lo diresti a un collega: «20 t di tubo EN 10219 S355J2H 200×100×6». L'AI la trasforma in una distinta pulita.",
  },
  {
    step: "2",
    title: "Trova",
    body: "Il Network propone i fornitori pertinenti, con le prove tecniche che li collegano a quel prodotto: norme, gradi, processi.",
  },
  {
    step: "3",
    title: "Pubblica o invia",
    body: "Invia una richiesta riservata ai fornitori che scegli, oppure pubblicala sul Marketplace con il tuo nome o in forma anonima, con una scadenza chiara.",
  },
  {
    step: "4",
    title: "Confronta",
    body: "Le offerte arrivano in un formato unico: prezzo, consegna, resa, validità e certificati, fianco a fianco. Negozia nello stesso posto.",
  },
  {
    step: "5",
    title: "Ordina",
    body: "L'offerta accettata diventa un ordine con condizioni condivise e confermate da entrambe le parti, tracciato fino alla consegna.",
  },
];

const sides = [
  {
    kicker: "Per chi compra",
    title: "Meno email, più offerte confrontabili",
    points: [
      "Una richiesta, molti fornitori qualificati",
      "Anonimato quando serve, sempre deciso da te",
      "Confronto immediato delle condizioni",
      "Dall'offerta all'ordine senza cambiare strumento",
    ],
    tone: "brand",
  },
  {
    kicker: "Per chi vende",
    title: "La domanda reale, nel momento giusto",
    points: [
      "Richieste aperte del tuo prodotto e della tua area",
      "Avvisi sulle opportunità coerenti col profilo aziendale",
      "Risposte strutturate, valutate sul merito",
      "Nuovi clienti oltre la rete abituale",
    ],
    tone: "plain",
  },
] as const;

const principles = [
  {
    title: "Riservatezza",
    body: "Prezzi, trattative e documenti restano tra le aziende coinvolte. Nulla di privato viene pubblicato in automatico.",
  },
  {
    title: "Solo fatti verificabili",
    body: "Nessuna producibilità o disponibilità affermata senza una fonte. Il produttore pertinente non è un'offerta.",
  },
  {
    title: "Decide sempre una persona",
    body: "L'AI prepara e suggerisce; conferma dell'ordine e pagamento restano in mano a chi ne ha l'autorità.",
  },
  {
    title: "Denaro in mani autorizzate",
    body: "Quando arriveranno i pagamenti, i fondi passeranno da un operatore autorizzato, mai dai nostri conti.",
  },
];

const stages = [
  {
    label: "Oggi",
    title: "Le fondamenta",
    body: "Network delle aziende dell'acciaio, Scuola tecnica, Commerciale e distinte con richieste d'offerta ai fornitori.",
    state: "live",
  },
  {
    label: "Prossimo passo",
    title: "Dall'offerta all'ordine",
    body: "L'offerta accettata diventa un ordine B2B con conferme, documenti e cronologia.",
    state: "next",
  },
  {
    label: "Poi",
    title: "Il mercato aperto",
    body: "Richieste pubbliche, con nome o anonime, a cui i fornitori del Network rispondono entro la scadenza.",
    state: "later",
  },
  {
    label: "In prospettiva",
    title: "Pagamenti e servizi",
    body: "Pagamenti integrati tramite partner autorizzati e un team che può gestire la richiesta per te.",
    state: "later",
  },
] as const;

export default function MarketplaceVisionPage() {
  return (
    <FocusPage>
      <PilotEvent eventName="marketplace_home_viewed" metadata={{ surface: "marketplace_home" }} />

      <FocusHeader
        eyebrow="Marketplace · La nostra visione"
        title={<>Il mercato dell&apos;acciaio e del tubo, dalla richiesta all&apos;ordine.</>}
        description={
          <>
            Oggi una richiesta d&apos;acciaio passa da decine di email, telefonate e fogli diversi.
            Vogliamo un unico posto dove chi compra e chi vende si trovano, si capiscono al primo
            colpo e chiudono l&apos;affare con fiducia.
          </>
        }
      />

      <section aria-labelledby="marketplace-journey">
        <FocusSectionHeader
          eyebrow="Come funzionerà"
          title={<span id="marketplace-journey">Cinque passi, un solo flusso</span>}
          description="Dalla prima riga della distinta all'ordine confermato, senza cambiare strumento."
        />
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {journey.map((item) => (
            <li key={item.step} className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ddf5ec] text-sm font-bold text-[#173f35]">
                {item.step}
              </span>
              <h3 className="mt-3 text-base font-semibold text-[#1d2824]">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[#52615b]">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Valore per chi compra e chi vende">
        {sides.map((side) => (
          <div
            key={side.kicker}
            className={
              side.tone === "brand"
                ? "rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-6"
                : "rounded-3xl border border-[#dce2df] bg-white p-6"
            }
          >
            <p className="app-kicker">{side.kicker}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#173f35]">{side.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {side.points.map((point) => (
                <li key={point} className="flex gap-2.5 text-sm leading-6 text-[#43524c]">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f6b5a]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="marketplace-principles">
        <FocusSectionHeader
          eyebrow="Le regole che non cambiano"
          title={<span id="marketplace-principles">Fiducia prima di tutto</span>}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-4">
              <h3 className="text-sm font-semibold text-[#1d2824]">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[#52615b]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="marketplace-stages">
        <FocusSectionHeader
          eyebrow="Il percorso"
          title={<span id="marketplace-stages">Come ci arriviamo</span>}
          description="Un passo alla volta: ogni tappa parte quando la precedente funziona davvero."
        />
        <ol className="grid gap-3 lg:grid-cols-4">
          {stages.map((stage) => (
            <li
              key={stage.label}
              className={[
                "rounded-2xl border p-4",
                stage.state === "live"
                  ? "border-[#1f6b5a] bg-[#edf5f2]"
                  : stage.state === "next"
                    ? "border-[#b8d2c8] bg-white"
                    : "border-dashed border-[#cfd8d4] bg-white",
              ].join(" ")}
            >
              <p
                className={[
                  "text-[10px] font-bold uppercase tracking-[0.14em]",
                  stage.state === "live" ? "text-[#1f6b5a]" : "text-[#5d6a65]",
                ].join(" ")}
              >
                {stage.label}
              </p>
              <h3 className="mt-2 text-base font-semibold text-[#1d2824]">{stage.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[#52615b]">{stage.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#173f35]">Il primo tassello è già qui</p>
          <p className="mt-1 text-sm leading-6 text-[#52615b]">
            Prepara una distinta e chiedi offerte ai fornitori del Network: è il cuore del Marketplace di domani.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={appRoutes.rfqHub.createDistinta}
            className="app-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
          >
            Crea una distinta
          </Link>
          <Link
            href={appRoutes.network.directory}
            className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
          >
            Esplora il Network
          </Link>
        </div>
      </section>
    </FocusPage>
  );
}
