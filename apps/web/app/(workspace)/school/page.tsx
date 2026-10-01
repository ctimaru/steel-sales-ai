import Link from "next/link";

import { appRoutes } from "@/lib/routes";

export default function SchoolPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 shadow-[0_1px_2px_rgba(20,46,38,0.03)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#173f35]">
          Scuola
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
          Formazione e conoscenza tecnica
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e] sm:text-base">
          La Scuola riunisce la conoscenza privata del tuo workspace e la base tecnica pubblica
          su norme, gradi, pesi e dimensioni.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Link
          href={appRoutes.knowledge.explorer}
          className="rounded-3xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
        >
          <span className="rounded-full bg-[#ecefed] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716c]">
            Privato
          </span>
          <h2 className="mt-4 text-xl font-semibold text-[#1d2824]">Knowledge Explorer</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Ricerca semantica su documenti, offerte, ordini e knowledge aziendale con fonti e provenance.
          </p>
          <p className="mt-5 text-sm font-semibold text-[#173f35]">Apri Explorer →</p>
        </Link>

        <Link
          href={appRoutes.knowledge.catalog}
          className="rounded-3xl border border-[#d9e8e2] bg-[#f3f7f5] p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
        >
          <span className="rounded-full bg-[#e1ece8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
            Pubblico
          </span>
          <h2 className="mt-4 text-xl font-semibold text-[#1d2824]">Steel Knowledge</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Catalogo pubblico indicizzabile con norme, gradi, dimensioni, pesi e strumenti tecnici.
          </p>
          <p className="mt-5 text-sm font-semibold text-[#173f35]">Apri catalogo →</p>
        </Link>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b8782]">Accesso rapido</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Riferimenti tecnici</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Norme", appRoutes.knowledge.schoolStandards],
            ["Gradi", appRoutes.knowledge.schoolGrades],
            ["Pesi & dimensioni", appRoutes.knowledge.schoolTubes],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-2xl border border-[#dce2df] bg-white px-5 py-4 text-sm font-semibold text-[#43524c] transition hover:border-[#b8d2c8] hover:text-[#173f35]"
            >
              <span>{label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
