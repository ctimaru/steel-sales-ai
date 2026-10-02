import type { Metadata } from "next";
import Link from "next/link";

import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Norme, gradi, pesi e dimensioni dell'acciaio",
  description:
    "Steel Knowledge è la base tecnica pubblica di Smart Steel Sales: guide su norme e gradi di acciaio, pesi, dimensioni e strumenti pratici per il settore steel e tube.",
  alternates: {
    canonical: absoluteUrl("/knowledge"),
  },
  openGraph: {
    title: "Steel Knowledge — Norme, gradi, pesi e dimensioni",
    description:
      "Conoscenza tecnica pubblica per chi lavora con acciaio e tubi: norme, gradi, dimensioni, pesi e strumenti pratici.",
    url: absoluteUrl("/knowledge"),
    type: "website",
  },
};

const knowledgeAreas = [
  {
    eyebrow: "Norme",
    title: "Capire cosa disciplina ogni standard",
    description:
      "Ambito, prodotti coperti, processi e collegamenti ai gradi con il tipo di evidenza sempre esplicito.",
    status: "Catalogo",
    href: "/knowledge/norme",
  },
  {
    eyebrow: "Gradi di acciaio",
    title: "Leggere designazioni e materiali",
    description:
      "Significato delle sigle, numeri materiale, applicazioni e norme collegate senza equivalenze automatiche.",
    status: "Catalogo",
    href: "/knowledge/gradi",
  },
  {
    eyebrow: "Pesi & dimensioni",
    title: "Dalla geometria al peso",
    description:
      "Riferimenti dimensionali e strumenti per comprendere peso al metro, peso per barra e differenza tra peso teorico e peso di riferimento.",
    status: "Strumento",
    href: "/knowledge/tubes",
  },
  {
    eyebrow: "Guide tecniche",
    title: "Risposte alle domande del settore",
    description:
      "Approfondimenti pratici su tubi, norme, materiali e calcoli, organizzati per essere utili prima ancora di entrare nel SaaS.",
    status: "Editoriale",
  },
] as const;

export default function KnowledgeHomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-[#dce2df] bg-white shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)]">
        <div className="h-1 bg-[#1a5144]" />
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Steel Knowledge
            </span>
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-semibold text-[#1a5144]">
              Pubblico
            </span>
          </div>

          <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-5xl">
            Conoscenza tecnica per chi lavora con acciaio e tubi
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#66736e] sm:text-lg">
            Norme, gradi di acciaio, dimensioni, pesi e strumenti pratici spiegati in modo accessibile.
            Steel Knowledge è consultabile senza account ed è separato dai dati commerciali privati delle aziende.
          </p>
        </div>
      </section>

      <section aria-labelledby="knowledge-paths">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Esplora</p>
          <h2 id="knowledge-paths" className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Trova il contenuto tecnico dal problema che devi risolvere
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            La struttura è pensata per portare rapidamente dalla domanda alla norma, al grado o allo strumento corretto,
            senza trasformare la pagina in un catalogo di dati interni.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {knowledgeAreas.map((area) => {
            const body = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">{area.eyebrow}</p>
                  <span className="rounded-full bg-[#ecefed] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                    {area.status}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#1d2824]">{area.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">{area.description}</p>
                {"href" in area ? (
                  <p className="mt-5 text-xs font-semibold text-[#1a5144]">Apri sezione →</p>
                ) : (
                  <p className="mt-5 text-xs font-semibold text-[#66736e]">Guide in preparazione</p>
                )}
              </>
            );

            return "href" in area ? (
              <Link
                key={area.eyebrow}
                href={area.href}
                className="rounded-2xl border border-[#d9e8e2] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
              >
                {body}
              </Link>
            ) : (
              <article key={area.eyebrow} className="rounded-2xl border border-[#dce2df] bg-white p-5">
                {body}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6 sm:p-8 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Principio editoriale</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Prima utilità, poi prodotto</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
            Ogni pagina pubblica deve rispondere a una domanda reale del settore. Le funzioni di Smart Steel Sales
            entrano in scena solo quando possono aiutare a continuare il lavoro: approfondire un dato, trovare
            un&apos;azienda nel Network o portare l&apos;informazione nella Commercial Memory.
          </p>
        </div>
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-sm font-semibold text-[#1d2824]">Qualità e fonti</p>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Le pagine distinguono spiegazioni editoriali, valori calcolati e riferimenti tecnici verificati.
            Il testo ufficiale delle norme non viene riprodotto quando protetto da licenza o copyright.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Pesi & dimensioni</p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">Base tecnica tubi</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
              La sezione pubblica dedicata a dimensioni e pesi include il calcolatore, i riferimenti canonici
              e i cluster per famiglia, dimensione esterna e spessore.
            </p>
          </div>
          <Link
            href="/knowledge/tubes"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white hover:bg-[#226657]"
          >
            Apri pesi & dimensioni →
          </Link>
        </div>
      </section>
    </div>
  );
}
