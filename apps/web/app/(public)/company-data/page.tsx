import type { Metadata } from "next";
import Link from "next/link";

import { CompanyDataRequestForm } from "./request-form";

export const metadata: Metadata = {
  title: "Dati aziendali, fonti e correzioni | Smart Steel Sales",
  description:
    "Come Smart Steel Sales governa i dati aziendali pubblici e come richiedere correzione, rimozione o informazioni sulla fonte.",
};

export default function CompanyDataPage() {
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#1d2824]">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <Link href="/" className="text-sm font-semibold text-[#1a5144]">
          ← Smart Steel Sales
        </Link>

        <section className="mt-8 rounded-[32px] border border-[#dce2df] bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
            PA1.5 · Data governance
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Dati aziendali, fonti e correzioni
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#66736e]">
            La ricerca pubblica di Smart Steel Sales mostra soltanto l&apos;identità minima
            necessaria a capire se un&apos;azienda è già presente e rivendicabile. Il Network
            completo non è una directory pubblica.
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            [
              "Cosa privilegiamo",
              "Dati della persona giuridica e informazioni business a livello aziendale, con fonte e provenance tracciate.",
            ],
            [
              "Cosa escludiamo di default",
              "Contatti personali di dipendenti, email personali, numeri mobili personali e dati della Commercial Memory.",
            ],
            [
              "Fonti web",
              "La semplice visibilità online non viene trattata come licenza di riuso. Termini della fonte e rischio relativo ai database devono essere valutati prima della pubblicazione.",
            ],
            [
              "Claim e verifica",
              "Rivendicare un profilo non significa essere verificati. Claim, provenance, verification e accesso al Network restano controlli distinti.",
            ],
          ].map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-[#dce2df] bg-white p-5">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Rettifica · rimozione · privacy · fonte
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Segnala un dato da verificare
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Indica solo le informazioni necessarie a identificare l&apos;azienda e la
              correzione richiesta. L&apos;email serve per poter gestire la richiesta e non
              viene pubblicata nel Network.
            </p>
          </div>
          <CompanyDataRequestForm />
        </section>
      </div>
    </main>
  );
}
