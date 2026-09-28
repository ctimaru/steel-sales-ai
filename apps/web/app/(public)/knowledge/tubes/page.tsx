import type { Metadata } from "next";
import Link from "next/link";

import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pesi e dimensioni dei tubi in acciaio",
  description:
    "Guida pubblica ai pesi e alle dimensioni dei tubi in acciaio. Base per il calcolatore Steel Knowledge di kg/m, peso per barra e tonnellaggio.",
  alternates: {
    canonical: absoluteUrl("/knowledge/tubes"),
  },
  openGraph: {
    title: "Pesi e dimensioni dei tubi in acciaio · Steel Knowledge",
    description:
      "Comprendi peso al metro, peso per barra e differenza tra peso teorico e riferimenti tecnici dei tubi in acciaio.",
    url: absoluteUrl("/knowledge/tubes"),
    type: "article",
  },
};

export default function PublicTubeWeightsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#2f6fed]">Steel Knowledge</Link>
        <span className="mx-2">/</span>
        <span>Pesi &amp; dimensioni</span>
      </nav>

      <article className="rounded-3xl border border-[#dce7f7] bg-white p-6 shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)] sm:p-8 lg:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Steel Knowledge · pubblico</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
          Pesi e dimensioni dei tubi in acciaio
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#68788e]">
          Questa sezione diventerà il riferimento pubblico per calcolare e interpretare il peso dei tubi:
          kg/m, peso della barra, tonnellaggio e differenza tra valori teorici e riferimenti tecnici.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Peso al metro", "Calcolo della massa lineare partendo dalla geometria del tubo."],
            ["Peso per barra", "Conversione del kg/m sulla lunghezza effettiva del pezzo."],
            ["Tonnellaggio", "Calcolo del peso complessivo in funzione della quantità."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-4">
              <h2 className="text-sm font-semibold text-[#1e2b45]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">{description}</p>
            </div>
          ))}
        </div>
      </article>

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Metodo</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">Peso teorico e peso di riferimento non sono la stessa cosa</h2>
        <p className="mt-3 text-sm leading-7 text-[#68788e]">
          Il futuro calcolatore distinguerà sempre un valore ottenuto matematicamente dalla geometria da un peso
          pubblicato o verificato proveniente da una fonte tecnica. Questa distinzione evita di presentare una stima
          come se fosse automaticamente un valore normativo.
        </p>
      </section>

      <section className="rounded-2xl border border-[#d7e5ff] bg-[#eef5ff] p-5">
        <p className="text-sm font-semibold text-[#1e2b45]">Calcolatore pubblico: prossimo sviluppo dedicato</p>
        <p className="mt-2 text-sm leading-6 text-[#5f7088]">
          In K5 questa pagina riceverà il calcolatore per tubo tondo, quadro e rettangolare. L&apos;attuale archivio
          tecnico autenticato rimane disponibile nel workspace durante la transizione.
        </p>
        <Link href="/company/tools/tubi-norme" className="mt-4 inline-flex text-sm font-semibold text-[#2f6fed]">
          Apri l&apos;archivio tecnico nel workspace →
        </Link>
      </section>
    </div>
  );
}
