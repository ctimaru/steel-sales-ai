import { Space_Grotesk } from "next/font/google";
import Link from "next/link";

import { MarketplaceVisionSteps, type MarketplaceVisionStep } from "@/components/marketplace-vision-steps";
import { PilotEvent } from "@/components/pilot-event";
import { appRoutes } from "@/lib/routes";

/**
 * MKT-VISION1 (founder request, 24 Nov 2026): for now the Marketplace page only illustrates the
 * founder's vision of the B2B steel marketplace (TRANS-B2B1, approved 17 Nov 2026).
 * No feed, no readiness check and no operational CTAs: the existing Marketplace sub-routes and data
 * layer stay untouched and reachable, but this entry page reads no data and promises no dates.
 *
 * MKT-VISION2 (founder approval, 26 Nov 2026): same copy, new look. Dark "blueprint" hero with the
 * call to action up front and an illustrative request (no prices, no real data), interactive five
 * steps, buyer/seller contrast, icon principles, roadmap as a timeline, dark closing band.
 */

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-mkt-display", display: "swap" });

const journey: MarketplaceVisionStep[] = [
  {
    title: "Chiedi",
    body: "Scrivi cosa ti serve come lo diresti a un collega: «20 t di tubo EN 10219 S355J2H 200×100×6». L'AI la trasforma in una distinta pulita.",
    sample: [["Norma", "EN 10219"], ["Grado", "S355J2H"], ["Misura · quantità", "200×100×6 · 20 t"]],
  },
  {
    title: "Trova",
    body: "Il Network propone i fornitori pertinenti, con le prove tecniche che li collegano a quel prodotto: norme, gradi, processi.",
    sample: [["Tubificio A", "EN 10219 · S355"], ["Commerciante B", "Profili cavi"], ["Tubificio C", "Saldato ERW"]],
  },
  {
    title: "Pubblica o invia",
    body: "Invia una richiesta riservata ai fornitori che scegli, oppure pubblicala sul Marketplace con il tuo nome o in forma anonima, con una scadenza chiara.",
    sample: [["Riservata", "ai fornitori che scegli"], ["Pubblica", "con nome o anonima"], ["Scadenza", "chiara per tutti"]],
  },
  {
    title: "Confronta",
    body: "Le offerte arrivano in un formato unico: prezzo, consegna, resa, validità e certificati, fianco a fianco. Negozia nello stesso posto.",
    sample: [["Prezzo e consegna", "stesso formato"], ["Resa e validità", "stesso formato"], ["Certificati", "fianco a fianco"]],
  },
  {
    title: "Ordina",
    body: "L'offerta accettata diventa un ordine con condizioni condivise e confermate da entrambe le parti, tracciato fino alla consegna.",
    sample: [["Offerta accettata", "diventa ordine"], ["Condizioni", "confermate da entrambi"], ["Consegna", "tracciata"]],
  },
];

const buyerPoints = [
  "Una richiesta, molti fornitori qualificati",
  "Anonimato quando serve, sempre deciso da te",
  "Confronto immediato delle condizioni",
  "Dall'offerta all'ordine senza cambiare strumento",
];
const sellerPoints = [
  "Richieste aperte del tuo prodotto e della tua area",
  "Avvisi sulle opportunità coerenti col profilo aziendale",
  "Risposte strutturate, valutate sul merito",
  "Nuovi clienti oltre la rete abituale",
];

const principles = [
  {
    title: "Riservatezza",
    body: "Prezzi, trattative e documenti restano tra le aziende coinvolte. Nulla di privato viene pubblicato in automatico.",
    icon: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  },
  {
    title: "Solo fatti verificabili",
    body: "Nessuna producibilità o disponibilità affermata senza una fonte. Il produttore pertinente non è un'offerta.",
    icon: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  },
  {
    title: "Decide sempre una persona",
    body: "L'AI prepara e suggerisce; conferma dell'ordine e pagamento restano in mano a chi ne ha l'autorità.",
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  },
  {
    title: "Denaro in mani autorizzate",
    body: "Quando arriveranno i pagamenti, i fondi passeranno da un operatore autorizzato, mai dai nostri conti.",
    icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  },
];

const stages = [
  {
    label: "Oggi · attivo",
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

const stageLook = {
  live: { line: "border-solid border-[#175640]", dot: "border-[#175640] bg-[#175640]", label: "text-[#175640]" },
  next: { line: "border-solid border-[#d9922e]", dot: "border-[#d9922e] bg-white", label: "text-[#8a4b00]" },
  later: { line: "border-dashed border-[#b9cfc2]", dot: "border-[#b9cfc2] bg-white", label: "text-[#4a6155]" },
} as const;

const PRIMARY = "inline-flex min-h-12 items-center rounded-xl bg-[#f2b544] px-5 text-sm font-bold !text-[#2b1c00] hover:bg-[#f5c364] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2b544]";
const GHOST = "inline-flex min-h-12 items-center rounded-xl border border-white/35 px-5 text-sm font-semibold !text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const KICKER = "text-xs font-bold uppercase tracking-[0.1em] text-[#3d6b52]";

function Check({ tone }: { tone: "light" | "dark" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true"
      className={"mt-0.5 shrink-0 " + (tone === "dark" ? "stroke-[#f2b544]" : "stroke-[#175640]")}>
      <circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" />
    </svg>
  );
}

export default function MarketplaceVisionPage() {
  return (
    <div className={display.variable + " mx-auto w-full max-w-[1200px] space-y-16 pb-10 sm:space-y-20"} data-testid="marketplace-vision">
      <PilotEvent eventName="marketplace_home_viewed" metadata={{ surface: "marketplace_home" }} />

      <section aria-labelledby="marketplace-title" className="mkt-blueprint overflow-hidden rounded-[28px] text-white">
        <div className="flex flex-wrap items-center gap-12 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
          <div className="min-w-0 flex-[1_1_440px]">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#f2b544]/55 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#f2b544]">
              <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#f2b544]" />
              Marketplace · La nostra visione
            </p>
            <h1 id="marketplace-title" className="mkt-display mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-[56px]">
              Il mercato dell&apos;acciaio e del tubo, <span className="text-[#f2b544]">dalla richiesta all&apos;ordine.</span>
            </h1>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-[#c9ddd2] sm:text-lg">
              Oggi una richiesta d&apos;acciaio passa da decine di email, telefonate e fogli diversi.
              Vogliamo un unico posto dove chi compra e chi vende si trovano, si capiscono al primo
              colpo e chiudono l&apos;affare con fiducia.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={appRoutes.rfqHub.createDistinta} className={PRIMARY}>Crea una distinta →</Link>
              <a href="#marketplace-journey" className={GHOST}>Come funzionerà</a>
            </div>
          </div>

          <figure className="relative mx-auto w-full max-w-[480px] flex-[1_1_380px]" data-testid="marketplace-vision-example">
            <div aria-hidden="true" className="overflow-hidden rounded-[20px] mkt-lift bg-white text-[#0f2e23]">
              <div className="space-y-1.5 border-b border-[#e4ece7] px-5 py-4">
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 text-[#1a5144]">Richiesta pubblica</span>
                  <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 text-[#1a5144]">Anonima</span>
                  <span className="rounded-full bg-[#fff4d6] px-2 py-0.5 text-[#6b4a07]">Scade tra 3 giorni</span>
                </div>
                <p className="mkt-display pt-1 text-xl font-bold">20 t · Tubo EN 10219 S355J2H</p>
                <p className="text-[13px] text-[#3f564a]">200×100×6 · barre da 12 m · resa franco destino</p>
              </div>
              <div className="px-3 pb-4 pt-2">
                <p className="mx-2 my-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#3d6b52]">Offerte ricevute, fianco a fianco</p>
                <div className="grid grid-cols-[minmax(0,1.4fr)_1fr_1fr] items-center gap-x-2.5 gap-y-1 text-[13px]">
                  <span className="rounded-lg bg-[#f3f8f5] px-2 py-2 font-semibold">
                    Fornitore A <span className="ml-1 whitespace-nowrap rounded-full bg-[#175640] px-1.5 py-0.5 text-[10px] font-bold text-white">Consegna più rapida</span>
                  </span>
                  <span>2 settimane</span><span>Cert. 3.1</span>
                  <span className="px-2 py-2 font-semibold">Fornitore B</span><span>3 settimane</span><span>Cert. 3.1</span>
                  <span className="px-2 py-2 font-semibold">Fornitore C</span><span>4 settimane</span><span>Cert. 2.2</span>
                </div>
              </div>
            </div>
            <div aria-hidden="true" className="absolute -bottom-6 left-0 flex items-center gap-2.5 rounded-2xl bg-[#175640] px-4 py-3 text-[13px] font-semibold mkt-lift-sm text-white sm:-left-7">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f2b544" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
              Offerta accettata → ordine confermato
            </div>
            <figcaption className="mt-10 text-right text-[11px] text-[#9dbbab]">
              Esempio illustrativo: una richiesta pubblica e le offerte affiancate.
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="marketplace-journey" className="scroll-mt-24">
        <p className={KICKER}>Come funzionerà</p>
        <h2 id="marketplace-journey" className="mkt-display mt-2 text-3xl font-bold text-[#0f2e23] sm:text-[38px]">Cinque passi, un solo flusso</h2>
        <p className="mt-2 text-[#3f564a]">Dalla prima riga della distinta all&apos;ordine confermato, senza cambiare strumento.</p>
        <MarketplaceVisionSteps steps={journey} />
      </section>

      <section aria-label="Valore per chi compra e chi vende" className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#bfd0c5] bg-white p-7 sm:p-9">
          <p className={KICKER}>Per chi compra</p>
          <h2 className="mkt-display mt-2.5 text-[28px] font-bold leading-tight text-[#0f2e23] sm:text-[30px]">Meno email, più offerte confrontabili</h2>
          <ul className="mt-6 space-y-3.5">
            {buyerPoints.map((point) => (
              <li key={point} className="flex gap-3 text-base text-[#173f35]"><Check tone="light" />{point}</li>
            ))}
          </ul>
        </div>
        <div className="mkt-blueprint rounded-3xl p-7 text-white sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#f2b544]">Per chi vende</p>
          <h2 className="mkt-display mt-2.5 text-[28px] font-bold leading-tight sm:text-[30px]">La domanda reale, nel momento giusto</h2>
          <ul className="mt-6 space-y-3.5">
            {sellerPoints.map((point) => (
              <li key={point} className="flex gap-3 text-base text-[#e3efe8]"><Check tone="dark" />{point}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="marketplace-principles">
        <p className={KICKER}>Le regole che non cambiano</p>
        <h2 id="marketplace-principles" className="mkt-display mt-2 text-3xl font-bold text-[#0f2e23] sm:text-[38px]">Fiducia prima di tutto</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((item) => (
            <div key={item.title} className="rounded-[18px] border border-[#d6e5db] bg-white p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4f0e9]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#175640" strokeWidth="2" aria-hidden="true">{item.icon}</svg>
              </span>
              <h3 className="mkt-display mt-4 text-[19px] font-bold text-[#0f2e23]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#3f564a]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="marketplace-stages">
        <p className={KICKER}>Il percorso</p>
        <h2 id="marketplace-stages" className="mkt-display mt-2 text-3xl font-bold text-[#0f2e23] sm:text-[38px]">Come ci arriviamo</h2>
        <p className="mt-2 text-[#3f564a]">Un passo alla volta: ogni tappa parte quando la precedente funziona davvero.</p>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage) => {
            const look = stageLook[stage.state];
            return (
              <li key={stage.label} className={"border-t-4 pt-4 " + look.line}>
                <p className={"inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] " + look.label}>
                  <span aria-hidden="true" className={"h-3 w-3 rounded-full border-2 " + look.dot} />
                  {stage.label}
                </p>
                <h3 className="mkt-display mt-2.5 text-[21px] font-bold text-[#0f2e23]">{stage.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#3f564a]">{stage.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="marketplace-start" className="mkt-blueprint flex flex-wrap items-center justify-between gap-7 rounded-[28px] px-6 py-10 text-white sm:px-12 sm:py-12">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2 id="marketplace-start" className="mkt-display text-3xl font-bold sm:text-[34px]">Il primo tassello è già qui</h2>
          <p className="mt-2.5 max-w-[560px] text-base leading-7 text-[#c9ddd2] sm:text-[17px]">
            Prepara una distinta e chiedi offerte ai fornitori del Network: è il cuore del Marketplace di domani.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={appRoutes.rfqHub.createDistinta} className={PRIMARY}>Crea una distinta →</Link>
          <Link href={appRoutes.network.directory} className={GHOST}>Esplora il Network</Link>
        </div>
      </section>
    </div>
  );
}
