import type { Metadata } from "next";
import Link from "next/link";

import { SchoolHero } from "@/components/school-ui";
import { SchoolReadingIndex } from "@/components/school-reading-index";
import {
  SCHOOL_CONTENT1C_PATH,
  SCHOOL_CONTENT1C_REVIEW_DATE,
  schoolComparisons,
  schoolGlossary,
} from "@/lib/school-content1c-guides.mjs";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Confronti tecnici e glossario tubi d’acciaio | School",
  description: "Confronta EN 10210 e EN 10219, documenti EN 10204, tubi saldati e seamless, peso teorico e tolleranze. Glossario tecnico con fonti UNI.",
  alternates: { canonical: absoluteUrl(SCHOOL_CONTENT1C_PATH) },
  openGraph: {
    title: "Confronti tecnici e glossario | Smart Steel Sales",
    description: "Guide pratiche per distinguere norme, documenti e materiali. Informazioni pubbliche con fonti e limiti di applicazione.",
    url: absoluteUrl(SCHOOL_CONTENT1C_PATH),
    type: "article",
    publishedTime: "2026-11-02T00:00:00Z",
    modifiedTime: SCHOOL_CONTENT1C_REVIEW_DATE + "T00:00:00Z",
  },
};

function References({ sources }: { sources: { label: string; url: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e5ebe6] pt-4">
      {sources.map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center text-xs font-semibold text-[#1a5144] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
          {source.label} ↗
        </a>
      ))}
    </div>
  );
}

export default function SchoolContent1CPage() {
  const alphabeticalGlossary = [...schoolGlossary].sort((a, b) => a.term.localeCompare(b.term, "it"));
  const allSourceUrls = [...new Set(schoolComparisons.flatMap((entry) => entry.sources.map((source) => source.url)))];
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Confronti tecnici e glossario dei tubi d’acciaio",
    description: "Guide originali per distinguere norme strutturali, certificati, processi, massa e tolleranze.",
    inLanguage: "it-IT",
    datePublished: "2026-11-02",
    dateModified: SCHOOL_CONTENT1C_REVIEW_DATE,
    mainEntityOfPage: absoluteUrl(SCHOOL_CONTENT1C_PATH),
    author: { "@type": "Organization", name: "Smart Steel Sales" },
    citation: allSourceUrls,
    isPartOf: { "@type": "CollectionPage", name: "Guide School", url: absoluteUrl("/knowledge/articoli") },
  };
  const termsJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Glossario tubi d’acciaio",
    inLanguage: "it-IT",
    url: absoluteUrl(SCHOOL_CONTENT1C_PATH + "#glossario-tecnico"),
    hasDefinedTerm: schoolGlossary.map(({ term, definition }) => ({
      "@type": "DefinedTerm",
      name: term,
      description: definition,
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Scuola", item: absoluteUrl("/knowledge") },
      { "@type": "ListItem", position: 2, name: "Articoli", item: absoluteUrl("/knowledge/articoli") },
      { "@type": "ListItem", position: 3, name: "Confronti e glossario", item: absoluteUrl(SCHOOL_CONTENT1C_PATH) },
    ],
  };
  return (
    <div className="mx-auto max-w-[1080px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      {[articleJsonLd, termsJsonLd, breadcrumbJsonLd].map((payload, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }} />
      ))}

      <nav aria-label="Breadcrumb" className="school-breadcrumb">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/articoli" className="hover:text-[#1a5144]">Guide</Link>
        <span className="mx-2">/</span>
        <span>Confronti e glossario</span>
      </nav>

      <SchoolHero
        reading compact editorial
        eyebrow="Guide tecniche · SCHOOL-CONTENT1"
        title="Confronta prima di specificare."
        description={<>Quattro confronti operativi e un glossario per capire le differenze tra norma, processo, materiale, documento e peso. Nessun risultato sostituisce il testo normativo o la documentazione del prodotto reale.</>}
        badges={["4 confronti", String(schoolGlossary.length) + " termini", "Rivisto 2 novembre 2026"]}
      />

      <SchoolReadingIndex locale="it" entries={[
        ...schoolComparisons.map(({ id, title }) => ({ id, label: title })),
        { id: "glossario-tecnico", label: "Glossario tecnico" },
        { id: "guida-fonti", label: "Limiti e fonti" },
      ]} />

      <div className="grid gap-3 sm:grid-cols-2">
        {schoolComparisons.map((comparison, index) => (
          <Link key={comparison.id} href={"#" + comparison.id}
            className="group rounded-2xl border border-[#dce5df] bg-white p-4 transition hover:border-[#91b3a1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#256449]">Confronto 0{index + 1}</span>
            <p className="mt-1 text-sm font-semibold text-[#173f35]">{comparison.title}</p>
            <p className="mt-1 text-xs leading-5 text-[#52615b]">{comparison.subtitle}</p>
          </Link>
        ))}
      </div>

      {schoolComparisons.map((comparison, index) => (
        <section id={comparison.id} key={comparison.id}
          className="scroll-mt-24 rounded-[20px] border border-[#dce6df] bg-white p-5 sm:p-7"
          aria-labelledby={comparison.id + "-title"}>
          <p className="school-kicker">Confronto {index + 1} / {schoolComparisons.length}</p>
          <h2 id={comparison.id + "-title"} className="mt-2 text-xl font-semibold text-[#1d2824] sm:text-2xl">{comparison.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">{comparison.subtitle}</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#dce5df]">
            <div className="hidden grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-[#edf5f0] px-4 py-3 text-xs font-bold text-[#174b3c] md:grid">
              <span>Aspetto</span><span>{comparison.left}</span><span>{comparison.right}</span>
            </div>
            <div className="divide-y divide-[#e5ebe6]">
              {comparison.rows.map((item) => (
                <div key={item.label} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-3">
                  <h3 className="text-sm font-bold text-[#173f35]">{item.label}</h3>
                  <div className="text-xs leading-5 text-[#52615b]">
                    <span className="mr-1 font-bold text-[#174b3c] md:hidden">{comparison.left}: </span>
                    {item.left}
                  </div>
                  <div className="text-xs leading-5 text-[#52615b]">
                    <span className="mr-1 font-bold text-[#174b3c] md:hidden">{comparison.right}: </span>
                    {item.right}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 rounded-xl border border-[#d5e4da] bg-[#f3f8f4] px-4 py-3 text-sm leading-6 text-[#214c38]">
            <strong>Da ricordare: </strong>{comparison.takeaway}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {comparison.links.map((link) => (
              <Link key={link.href} href={link.href}
                className="school-secondary-action min-h-10 text-xs">{link.label} →</Link>
            ))}
            <Link href={"/knowledge/professore?topic=" + encodeURIComponent(comparison.id)}
              className="school-secondary-action min-h-10 text-xs"
              aria-label={"Chiedi al Professore di spiegare " + comparison.title}>
              Chiedi al Professore →
            </Link>
          </div>
          <References sources={comparison.sources} />
        </section>
      ))}

      <section id="glossario-tecnico" className="scroll-mt-24 rounded-[20px] border border-[#dce6df] bg-white p-5 sm:p-7" aria-labelledby="glossario-title">
        <p className="school-kicker">Riferimenti rapidi</p>
        <h2 id="glossario-title" className="mt-2 text-2xl font-semibold text-[#1d2824]">Glossario tecnico</h2>
        <p className="mt-2 text-sm leading-6 text-[#52615b]">Definizioni introduttive collegate alle schede; per certificazioni e dimensioni prevale sempre la norma pertinente.</p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {alphabeticalGlossary.map((item) => (
            <div key={item.term} className="rounded-xl border border-[#e0e8e2] bg-[#f9fbfa] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-sm font-bold text-[#173f35]">{item.term}</dt>
                <span className="text-[11px] font-semibold text-[#52615b]">{item.category}</span>
              </div>
              <dd className="mt-2 text-xs leading-6 text-[#52615b]">
                {item.definition}
                <Link href={item.href} className="ml-1 inline-flex font-bold text-[#174b3c] underline underline-offset-4">Approfondisci →</Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <aside id="guida-fonti" className="scroll-mt-24 rounded-[20px] border border-[#e0d6b9] bg-[#fffdf8] p-5 sm:p-6">
        <h2 className="text-base font-bold text-[#624c27]">Come usare questa guida</h2>
        <p className="mt-2 text-sm leading-6 text-[#645a48]">
          Contenuto editoriale originale, non copia delle tabelle UNI. I riferimenti sono stati controllati il 2 novembre 2026.
          Le edizioni e le correzioni possono cambiare: verifica sempre testo ufficiale, campo di applicazione, ordine, certificati e progetto.
          Per impieghi a pressione, la sola specifica del materiale non dimostra la conformità dell'attrezzatura.
        </p>
      </aside>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/knowledge/articoli" className="school-secondary-action min-h-12">← Torna alle guide</Link>
        <Link href="/knowledge/tubes?source=school&surface=school_section#calcolatore-pesi" className="school-primary-action min-h-12">Apri Pesi e dimensioni →</Link>
      </div>
    </div>
  );
}
