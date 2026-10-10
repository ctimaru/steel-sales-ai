import Link from "next/link";

/**
 * HOME-SI4 — Public onboarding and trust explainer.
 * Registration requires email verification, a company application and a human
 * review. No promise of immediate, automatic or included Network access.
 */
const steps = [
  { number: "01", title: "Cerca la tua azienda", detail: "Verifica se esiste un profilo rivendicabile oppure avvia una nuova richiesta." },
  { number: "02", title: "Verifica l’account", detail: "Crea l’accesso e conferma l’indirizzo email." },
  { number: "03", title: "Completa i dati", detail: "Invia la richiesta aziendale con le informazioni necessarie." },
  { number: "04", title: "Attendi la revisione", detail: "Il workspace viene attivato dopo l’approvazione." },
] as const;

export function PublicRegistrationTrust() {
  return (
    <section id="registrazione" aria-labelledby="home-registration-title" className="border-t border-[#dce5e0] bg-white">
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1f6b5a]">
              Registrazione e fiducia
            </p>
            <h2 id="home-registration-title" className="mt-2 text-2xl font-semibold tracking-tight text-[#123b34] sm:text-3xl">
              La tua azienda, un accesso governato.
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">
              Non devi creare un secondo profilo se la tua azienda è già presente.
              La richiesta è verificata prima dell&apos;attivazione del workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link href="/register" className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold">
              Avvia la registrazione <span aria-hidden="true" className="ml-2">→</span>
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbdcd3] bg-white px-4 text-sm font-semibold text-[#123b34] hover:bg-[#f4f7f5]">
              Hai già un account?
            </Link>
          </div>
        </div>

        <ol aria-label="Come avviene la registrazione aziendale" className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.number} className="flex min-w-0 gap-3 rounded-xl border border-[#dce5e0] bg-[#f8faf9] px-3.5 py-3">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6f3ed] text-xs font-extrabold text-[#123b34]">{step.number}</span>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#123b34]">{step.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#52615b]">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#cbdcd3] bg-[#edf5f2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[720px] text-xs leading-5 text-[#36574c]">
            <strong className="text-[#123b34]">Profilo aziendale e Network premium sono separati.</strong>{" "}
            La registrazione non abilita automaticamente la directory completa.
            La ricerca pubblica non rende visibili offerte, ordini o dati commerciali del workspace.
          </p>
          <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
            <Link href="/company-data" className="inline-flex min-h-10 items-center text-[#123b34] underline decoration-[#94bdaf] underline-offset-4 hover:text-[#1f6b5a]">
              Fonti, correzioni e rimozioni
            </Link>
            <Link href="/privacy" className="inline-flex min-h-10 items-center text-[#123b34] underline decoration-[#94bdaf] underline-offset-4 hover:text-[#1f6b5a]">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
