import type { Metadata } from "next";
import Link from "next/link";

import { FocusHeader, FocusLink, FocusPage, FocusPanel } from "@/components/focus-ui";
import { schoolArticles } from "@/lib/school-articles";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Scuola: norme, gradi, pesi e dimensioni dell'acciaio",
  description:
    "La Scuola di Smart Steel Sales è la base tecnica pubblica per il settore steel e tube: norme, gradi di acciaio, pesi, dimensioni e strumenti pratici.",
  alternates: { canonical: absoluteUrl("/knowledge") },
  openGraph: {
    title: "Scuola Smart Steel Sales — Norme, gradi, pesi e dimensioni",
    description:
      "Conoscenza tecnica pubblica per chi lavora con acciaio e tubi: norme, gradi, dimensioni, pesi e strumenti pratici.",
    url: absoluteUrl("/knowledge"),
    type: "website",
  },
};

export default function KnowledgeHomePage() {
  return (
    <FocusPage className="px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <FocusHeader
        eyebrow="Scuola"
        title="Parti dal problema tecnico"
        description="Calcola un peso, poi approfondisci norma o grado. Gli articoli e il contesto editoriale restano disponibili senza competere con lo strumento principale."
      />

      <FocusPanel>
        <p className="app-kicker">Strumento principale</p>
        <FocusLink
          href="/knowledge/tubes?source=school&surface=home_card#calcolatore-pesi"
          title="Calcola peso, barre e tonnellate"
          description="EN 10210, EN 10219 e calcolo libero con kg/m, peso barra e tonnellaggio."
          meta="Calcolatore"
          primary
        />

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <FocusLink
            href="/knowledge/norme"
            title="Norme"
            description="Ambito, prodotti e collegamenti tecnici."
          />
          <FocusLink
            href="/knowledge/gradi"
            title="Gradi"
            description="Designazioni, materiali e norme collegate."
          />
          <FocusLink
            href="/knowledge/articoli"
            title="Articoli"
            description="Storia, processi e industria steel."
          />
        </div>
      </FocusPanel>

      <details className="rounded-2xl border border-[#dce2df] bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#43524c]">
          Approfondimenti editoriali
          <span className="ml-2 text-xs font-normal text-[#7b8782]">· ultimi articoli</span>
        </summary>
        <div className="grid gap-3 border-t border-[#e7ece9] p-4 lg:grid-cols-3">
          {schoolArticles.slice(0, 3).map((article) => (
            <Link
              key={article.slug}
              href={`/knowledge/articoli/${article.slug}`}
              className="rounded-xl border border-[#e2e7e4] bg-[#f8faf9] p-4 hover:border-[#b8d2c8]"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">{article.category}</p>
              <h2 className="mt-2 text-base font-semibold text-[#1d2824]">{article.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#66736e]">{article.description}</p>
              <p className="mt-3 text-xs font-semibold text-[#173f35]">{article.readMinutes} min · Leggi →</p>
            </Link>
          ))}
        </div>
      </details>

      <details className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8]">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#43524c]">
          Come leggere dati, calcoli e fonti
        </summary>
        <div className="border-t border-[#e2e7e4] px-5 py-4 text-sm leading-6 text-[#66736e]">
          Le pagine distinguono spiegazioni editoriali, valori calcolati e riferimenti tecnici verificati.
          Il testo ufficiale delle norme non viene riprodotto quando protetto da licenza o copyright.
          Smart Steel Sales porta il prodotto in primo piano solo quando aiuta a continuare il lavoro.
        </div>
      </details>
    </FocusPage>
  );
}
