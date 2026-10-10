import Link from "next/link";

/**
 * HOME-SI3: public, static product explainer.
 * UI labels reflect RFQ Hub/Network/Scuola, but examples are not fetched
 * from tenant data and never imply that an RFQ has actually been dispatched.
 */
const workflow = [
  {
    number: "01",
    title: "Distinte salvate",
    description: "Prepara articoli, norme, gradi e quantità.",
  },
  {
    number: "02",
    title: "Campagne RFQ",
    description: "Seleziona i fornitori e governa l'invio.",
  },
  {
    number: "03",
    title: "Offerte ricevute",
    description: "Confronta risposte, copertura e revisioni.",
  },
  {
    number: "04",
    title: "Purchase Order",
    description: "Conferma la scelta e gestisci l'ordine.",
  },
] as const;

export function PublicProductPreview() {
  return (
    <div className="relative min-w-0" aria-label="Anteprima dimostrativa del RFQ Hub, senza dati aziendali">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-3 rounded-[32px] border border-[#dbe8e1] bg-white/30 sm:-inset-5" />
      <div className="relative overflow-hidden rounded-[24px] border border-[#cbd9d2] bg-white shadow-[0_20px_60px_rgba(18,59,52,0.10)]">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#123b34] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#bdd9ce]">
              Workspace aziendale · acquisti
            </p>
            <p className="mt-1 text-base font-semibold">RFQ Hub</p>
          </div>
          <span className="rounded-full border border-white/25 px-2.5 py-1 text-[10px] font-semibold text-[#e1eee8]">
            Anteprima UI
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#1f6b5a]">
                Nuova distinta
              </p>
              <p className="mt-1 text-sm font-semibold text-[#123b34]">Articolo tecnico di esempio</p>
            </div>
            <span className="rounded-full bg-[#ddf5ec] px-2.5 py-1 text-[10px] font-semibold text-[#123b34]">
              EN 10219
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-[#dce5e0] bg-[#f8faf9] p-3">
            <p className="text-sm font-semibold text-[#173f35]">Tubo quadro</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-[#475569]">
              <span className="rounded-md border border-[#dce5e0] bg-white px-2 py-1">Norma · EN 10219</span>
              <span className="rounded-md border border-[#dce5e0] bg-white px-2 py-1">Grado · S355J2H</span>
              <span className="rounded-md border border-[#dce5e0] bg-white px-2 py-1">Quantità · configurabile</span>
            </div>
          </div>

          <div className="mt-4 border-t border-[#e1eae5] pt-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#52615b]">
              Le sezioni reali del RFQ Hub
            </p>
            <ol className="mt-2 grid grid-cols-2 gap-2">
              {workflow.map((step) => (
                <li key={step.number} className="min-w-0 rounded-xl border border-[#dce5e0] bg-white p-3">
                  <span className="text-[10px] font-extrabold text-[#1f6b5a]">{step.number}</span>
                  <p className="mt-1 text-xs font-semibold text-[#123b34]">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-[1.5] text-[#52615b]">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
          <Link
            href="/distinta"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#b9c9c2] bg-[#e6f3ed] px-4 text-xs font-bold text-[#123b34] hover:border-[#1f6b5a] hover:bg-[#ddf5ec]"
          >
            Apri il configuratore pubblico <span aria-hidden="true" className="ml-2">↗</span>
          </Link>
        </div>
        <p className="border-t border-[#e1eae5] bg-[#f8faf9] px-5 py-3 text-[11px] leading-5 text-[#52615b]">
          Flusso illustrativo dell&apos;interfaccia, non uno screenshot né dati reali. L’AI assiste, la decisione resta alle persone.
        </p>
      </div>
    </div>
  );
}

export function PublicIntelligencePillars() {
  return (
    <section
      id="intelligence"
      aria-labelledby="home-intelligence-title"
      className="border-b border-[#dce5e0] bg-[#f6f8f7]"
    >
      <div className="mx-auto max-w-[1180px] px-4 py-11 sm:px-6 sm:py-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1f6b5a]">
            La piattaforma, in pratica
          </p>
          <h2 id="home-intelligence-title" className="mt-2 text-2xl font-semibold tracking-tight text-[#123b34] sm:text-3xl">
            Tre forme di intelligence. Un solo ecosistema.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#475569]">
            Parti dagli strumenti pubblici e scopri cosa cambia quando lavori con un workspace aziendale approvato.
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <article className="flex min-w-0 flex-col rounded-2xl border border-[#cbdcd3] bg-white p-5 shadow-[0_2px_12px_rgba(18,59,52,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#1f6b5a]">01 · Procurement Intelligence</span>
              <span className="rounded-full bg-[#e8f0f4] px-2.5 py-1 text-[10px] font-semibold text-[#315c74]">Workspace</span>
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-[#123b34]">Dal materiale all&apos;ordine.</h3>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">
              RFQ Hub collega distinte, richieste multi-fornitore, confronto delle offerte e ordini,
              con conferme esplicite e supervisione umana.
            </p>
            <p className="mt-3 text-xs leading-5 text-[#52615b]">
              Funzioni aziendali in validazione pilota, accessibili secondo ruolo e abilitazione.
            </p>
            <Link href="/register" className="mt-auto inline-flex min-h-11 items-center pt-5 text-sm font-bold text-[#1f6b5a] underline decoration-[#a8cbbd] underline-offset-4 hover:text-[#123b34]">
              Registra la tua azienda <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </article>

          <article className="flex min-w-0 flex-col rounded-2xl border border-[#cbdcd3] bg-white p-5 shadow-[0_2px_12px_rgba(18,59,52,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#315c74]">02 · Network Intelligence</span>
              <span className="rounded-full bg-[#e8f0f4] px-2.5 py-1 text-[10px] font-semibold text-[#315c74]">Privato</span>
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-[#123b34]">Trova chi può essere utile.</h3>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">
              Esplora la filiera per ruolo, prodotto e territorio. I filtri avanzati e la directory completa
              sono riservati alle aziende registrate e abilitate.
            </p>
            <p className="mt-3 text-xs leading-5 text-[#52615b]">
              Profili rivendicabili e relazioni da costruire, senza rendere pubblica la memoria commerciale.
            </p>
            <Link href="#network" className="mt-auto inline-flex min-h-11 items-center pt-5 text-sm font-bold text-[#1f6b5a] underline decoration-[#a8cbbd] underline-offset-4 hover:text-[#123b34]">
              Scopri il Network per ruolo <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </article>

          <article className="flex min-w-0 flex-col rounded-2xl border border-[#cbdcd3] bg-white p-5 shadow-[0_2px_12px_rgba(18,59,52,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#895028]">03 · Steel Knowledge</span>
              <span className="rounded-full bg-[#ddf5ec] px-2.5 py-1 text-[10px] font-semibold text-[#123b34]">Pubblico</span>
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-[#123b34]">La competenza, a portata di click.</h3>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">
              Consulta norme, gradi d&apos;acciaio, dimensioni e calcolo dei pesi. La Scuola e gli strumenti
              tecnici rimangono utilizzabili anche senza login.
            </p>
            <p className="mt-3 text-xs leading-5 text-[#52615b]">
              Contenuti tecnici pubblici per orientare richieste e scelte di prodotto.
            </p>
            <Link href="/knowledge" className="mt-auto inline-flex min-h-11 items-center pt-5 text-sm font-bold text-[#1f6b5a] underline decoration-[#a8cbbd] underline-offset-4 hover:text-[#123b34]">
              Entra nella Scuola <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
