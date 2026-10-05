import type { Metadata } from "next";
import Link from "next/link";

import { FocusLink, FocusPage, FocusPanel } from "@/components/focus-ui";
import { SchoolHero } from "@/components/school-ui";
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

const knowledgeAreas = [
  {
    eyebrow: "Calcolatore",
    title: "Calcola peso, barre e tonnellate",
    description: "EN 10210, EN 10219 e calcolo libero con kg/m, peso barra e tonnellaggio.",
    status: "Utility",
    href: "/knowledge/tubes",
  },
  {
    eyebrow: "Norme",
    title: "Capire cosa disciplina ogni standard",
    description: "Ambito, prodotti e collegamenti tecnici.",
    status: "Catalogo",
    href: "/knowledge/norme",
  },
  {
    eyebrow: "Gradi di acciaio",
    title: "Leggere designazioni e materiali",
    description: "Designazioni, materiali e norme collegate.",
    status: "Catalogo",
    href: "/knowledge/gradi",
  },
  {
    eyebrow: "Articoli",
    title: "Storia, processi e industria",
    description: "Approfondimenti originali sul settore steel e tube.",
    status: "Editoriale",
    href: "/knowledge/articoli",
  },
] as const;

export default function KnowledgeHomePage() {
  return (
    <FocusPage className="px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <SchoolHero
        eyebrow="Scuola"
        title="Conoscenza tecnica per chi lavora con acciaio e tubi"
        description={
          <>
            Parti dal problema tecnico: calcola un peso, poi approfondisci norma o grado. È consultabile senza account. La Scuola è
            pubblica e separata dai dati commerciali privati delle aziende.
          </>
        }
        badges={["Pubblico", "Pesi & dimensioni"]}
        compact
      />

      <FocusPanel>
        <p className="app-kicker">Strumento principale</p>
        <FocusLink
          href={`${knowledgeAreas[0].href}?source=school&surface=home_card#calcolatore-pesi`}
          title={knowledgeAreas[0].title}
          description={knowledgeAreas[0].description}
          meta={`${knowledgeAreas[0].eyebrow} · Calcola ora`}
          primary
        />

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {knowledgeAreas.slice(1).map((area) => (
            <FocusLink
              key={area.href}
              href={area.href}
              title={area.eyebrow}
              description={area.description}
            />
          ))}
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
          La sezione tubi include cluster per famiglia, dimensione esterna e spessore. Il testo ufficiale
          delle norme non viene riprodotto quando protetto da licenza o copyright.
        </div>
      </details>
    </FocusPage>
  );
}
