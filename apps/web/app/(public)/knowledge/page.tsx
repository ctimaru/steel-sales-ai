import type { Metadata } from "next";
import Link from "next/link";

import { SchoolHero } from "@/components/school-ui";
import { schoolArticles } from "@/lib/school-articles";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Scuola: norme, gradi, pesi e dimensioni dell'acciaio",
  description:
    "La Scuola di Smart Steel Sales è la base tecnica pubblica per il settore steel e tube: norme, gradi di acciaio, pesi, dimensioni e strumenti pratici.",
  alternates: {
    canonical: absoluteUrl("/knowledge"),
  },
  openGraph: {
    title: "Scuola Smart Steel Sales — Norme, gradi, pesi e dimensioni",
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
    eyebrow: "Articoli",
    title: "Capire storia, processi e industria",
    description:
      "Approfondimenti originali su come nasce il tubo, perché si sviluppa e quali gruppi producono oggi in Europa.",
    status: "Editoriale",
    href: "/knowledge/articoli",
  },
] as const;

export default function KnowledgeHomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <SchoolHero
        eyebrow="Scuola"
        title="Conoscenza tecnica per chi lavora con acciaio e tubi"
        description={
          <>
            Norme, gradi di acciaio, dimensioni, pesi, articoli e strumenti pratici spiegati in modo accessibile.
            La Scuola è consultabile senza account ed è separata dai dati commerciali privati delle aziende.
          </>
        }
        badges={["Pubblico", "Tecnica + industria"]}
      />

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
          {knowledgeAreas.map((area) => (
            <Link
              key={area.eyebrow}
              href={area.href}
              className="rounded-2xl border border-[#d9e8e2] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">{area.eyebrow}</p>
                <span className="rounded-full bg-[#ecefed] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                  {area.status}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1d2824]">{area.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">{area.description}</p>
              <p className="mt-5 text-xs font-semibold text-[#1a5144]">Apri sezione →</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="school-editorial">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="school-kicker">Articoli</p>
            <h2 id="school-editorial" className="mt-2 text-2xl font-semibold text-[#1d2824]">
              La cultura del tubo: storia, tecnologia e produttori
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5d6a65]">
              Non solo norme e numeri: raccontiamo da dove arriva il prodotto, quale problema ha risolto e come si è sviluppata l&apos;industria europea.
            </p>
          </div>
          <Link href="/knowledge/articoli" className="school-secondary-action shrink-0">
            Tutti gli articoli
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {schoolArticles.slice(0, 2).map((article) => (
            <Link
              key={article.slug}
              href={`/knowledge/articoli/${article.slug}`}
              className="school-card group p-6 transition hover:border-[#9fbfb3] hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="school-eyebrow">{article.category}</span>
                <span className="text-xs font-semibold text-[#68736f]">{article.readMinutes} min</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-[#1d2824]">{article.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5d6a65]">{article.description}</p>
              <p className="mt-5 text-sm font-bold text-[#173f35]">Leggi articolo →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6 sm:p-8 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Principio editoriale</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Prima utilità, poi prodotto</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
            Ogni pagina pubblica deve rispondere a una domanda reale del settore. Le funzioni di Smart Steel Sales
            entrano in scena solo quando possono aiutare a continuare il lavoro: approfondire un dato, verificare o rivendicare la propria azienda oppure portare l&apos;informazione nella Commercial Memory.
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
            className="school-primary-action shrink-0"
          >
            Apri pesi & dimensioni →
          </Link>
        </div>
      </section>
    </div>
  );
}
