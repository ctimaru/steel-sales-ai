import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { FocusPage } from "@/components/focus-ui";
import { SchoolPageLanguageSelector } from "@/components/calculator-page-language-selector";
import { SchoolJourney } from "@/components/school-unified-experience";
import { SchoolUnifiedNavigation, SchoolConversionPath } from "@/components/school-unified-navigation";
import { schoolArticles } from "@/lib/school-articles";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Scuola: norme, gradi, pesi e dimensioni dell'acciaio",
  description:
    "La Scuola di Smart Steel Sales è la base tecnica pubblica per il settore steel e tube: norme, gradi di acciaio, pesi, dimensioni e strumenti pratici.",
  alternates: {
    canonical: absoluteUrl("/knowledge"),
    languages: { it: absoluteUrl("/knowledge"), en: absoluteUrl("/en/knowledge"), de: absoluteUrl("/de/knowledge"), fr: absoluteUrl("/fr/knowledge"), es: absoluteUrl("/es/knowledge") },
  },
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
    <FocusPage compact className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#405a4e]">Risorse tecniche pubbliche · accesso gratuito</p>
        <SchoolPageLanguageSelector locale="it" />
      </div>

      <SchoolUnifiedNavigation locale="it" scope="public" compact />

      <section aria-labelledby="school-cine-heading" className="relative isolate overflow-hidden rounded-[24px] bg-[#102921] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:72%_center] opacity-70" style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,29,21,.98)_0%,rgba(7,29,21,.94)_37%,rgba(7,29,21,.60)_73%,rgba(7,29,21,.28)_100%)]" />
        <div className="relative flex min-h-[292px] max-w-3xl flex-col justify-center px-6 py-9 sm:px-10 sm:py-10 lg:py-11">
          <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#b3ddc4]">SMART STEEL SALES / SCHOOL</p>
          <h1 id="school-cine-heading" className="mt-3 max-w-2xl text-[2.35rem] font-semibold leading-[1.1] tracking-[-.045em] text-white sm:text-[3.15rem]">L’acciaio, spiegato bene.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#e0ece4] sm:text-[15px]">
            Norme, materiali e geometrie dei tubi. Risposte tecniche chiare, da consultare liberamente.
          </p>
          <p className="mt-2 text-xs leading-5 text-[#b4cebf]">La Scuola è aperta a tutti e separata dai dati commerciali privati.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="#ricerca-tecnica" className="school-primary-action min-h-11 !rounded-xl !border-[#39876a] !bg-[#247455] !px-5 !text-white transition hover:!bg-[#2c8461] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Cerca una norma o un materiale <span aria-hidden="true" className="ml-2">→</span>
            </Link>
            <Link href="/knowledge/professore" className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold !text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Chiedi al professore <span aria-hidden="true" className="ml-2">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="strumenti" className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)]" aria-label="Trova risposte e strumenti">
        <div id="ricerca-tecnica" className="rounded-[22px] border border-[#d9e3dc] bg-white p-5 sm:p-6" aria-labelledby="school-search-heading">
          <p className="school-kicker">RICERCA TECNICA</p>
          <h2 id="school-search-heading" className="mt-1.5 text-xl font-semibold tracking-tight text-[#163a2e] sm:text-2xl">Hai già una norma o un grado?</h2>
          <p className="mt-1.5 text-sm leading-6 text-[#52645a]">Cerca un riferimento tecnico nei cataloghi della School.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <form action="/knowledge/norme" method="get" role="search" aria-label="Cerca norme tecniche">
              <label htmlFor="school-standard-q" className="mb-1.5 block text-xs font-semibold text-[#365247]">Norma tecnica</label>
              <div className="flex min-w-0 gap-1.5">
                <input id="school-standard-q" name="q" type="search" required maxLength={64} placeholder="EN 10219" className="min-h-11 min-w-0 w-full flex-1 rounded-xl border border-[#c5d5cb] bg-white px-3 text-sm text-[#1d2824] placeholder:text-[#697a70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]" />
                <button type="submit" className="school-primary-action !min-w-11 shrink-0 !px-3" aria-label="Cerca norma tecnica">→</button>
              </div>
            </form>
            <form action="/knowledge/gradi" method="get" role="search" aria-label="Cerca gradi di acciaio">
              <label htmlFor="school-grade-q" className="mb-1.5 block text-xs font-semibold text-[#365247]">Grado di acciaio</label>
              <div className="flex min-w-0 gap-1.5">
                <input id="school-grade-q" name="q" type="search" required maxLength={64} placeholder="S355J2H" className="min-h-11 min-w-0 w-full flex-1 rounded-xl border border-[#c5d5cb] bg-white px-3 text-sm text-[#1d2824] placeholder:text-[#697a70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]" />
                <button type="submit" className="school-primary-action !min-w-11 shrink-0 !px-3" aria-label="Cerca grado di acciaio">→</button>
              </div>
            </form>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e5ede7] pt-3 text-xs">
            <span className="mr-1 font-medium text-[#607267]">Prova subito</span>
            <Link href="/knowledge/norme?q=EN%2010210" className="rounded-lg bg-[#eef4f0] px-2.5 py-1.5 font-semibold text-[#184638] hover:bg-[#e0ede4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">EN 10210 ↗</Link>
            <Link href="/knowledge/gradi?q=S355J2H" className="rounded-lg bg-[#eef4f0] px-2.5 py-1.5 font-semibold text-[#184638] hover:bg-[#e0ede4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">S355J2H ↗</Link>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[22px] border border-[#cddfd3] bg-[#eef5ef] p-5 sm:p-6" aria-labelledby="school-tools-heading">
          <div>
            <p className="school-kicker">Strumento principale · Calcolatore pesi</p>
            <h2 id="school-tools-heading" className="mt-1.5 text-xl font-semibold tracking-tight text-[#163a2e] sm:text-2xl">Calcola peso, barre e tonnellate</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#52645a]">Da CHS, SHS e RHS a kg/m, barre e tonnellate: EN 10210, EN 10219 e geometria libera.</p>
            <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Funzioni del calcolatore">
              {[
                ["kg/m", "Massa lineare"],
                ["Barre", "Lunghezza e quantità"],
                ["t", "Tonnellaggio"],
              ].map(([value,label]) => <span key={value} title={label} className="rounded-lg border border-[#cedfd2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#245442]">{value}</span>)}
            </div>
          </div>
          <Link href="/knowledge/tubes?source=school&surface=home_card#calcolatore-pesi" className="school-primary-action mt-4 w-full self-start sm:w-auto">
            Calcola e crea la distinta <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        </div>
      </section>

      <SchoolJourney locale="it" />
      <SchoolConversionPath locale="it" />

      <section id="approfondimenti" aria-labelledby="school-articles-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="school-kicker">Biblioteca editoriale</p>
            <h2 id="school-articles-heading" className="mt-1 text-2xl font-semibold text-[#1d2824]">Approfondimenti per comprendere l’industria</h2>
            <p className="mt-2 text-sm leading-6 text-[#506157]">Storia, tecnologia e produzione: contenuti originali, con fonti e data di revisione.</p>
          </div>
          <Link href="/knowledge/articoli" className="school-secondary-action">Tutti gli articoli <span aria-hidden="true" className="ml-2">→</span></Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {schoolArticles.slice(0, 3).map((article, index) => (
            <Link
              key={article.slug}
              href={"/knowledge/articoli/" + article.slug}
              className="school-card group flex h-full flex-col overflow-hidden rounded-[22px] border-[#d9e4dd] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#86b4a0] hover:shadow-[0_18px_36px_-28px_rgba(15,50,35,.65)] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"
            >
              <div className="relative overflow-hidden border-b border-[#dce9e1] bg-[#edf5f0]">
                <Image src={article.visual.src} alt={article.visual.alt} width={1200} height={675}
                  unoptimized sizes="(max-width: 768px) 100vw, 33vw"
                  className="aspect-video h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-white/15 bg-[#112c23]/90 px-5 py-2.5 backdrop-blur-sm">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#e5f2e8]">{article.category}</span>
                  <span aria-hidden="true" className="font-mono text-sm font-bold text-[#b8d9c4]">{String(index + 1).padStart(2, "0")}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-semibold leading-6 text-[#1d2824]">{article.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#506157]">{article.description}</p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e4eae6] pt-4">
                  <span className="text-xs text-[#506157]">{article.readMinutes} min di lettura</span>
                  <span className="text-xs font-bold text-[#174b3c]">Leggi <span aria-hidden="true">→</span></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d7e2db] bg-[#f5f8f6] px-5 py-4 sm:px-6" aria-labelledby="school-trust-heading">
        <h2 id="school-trust-heading" className="text-sm font-bold text-[#294c3d]">Dati tecnici, formule e fonti: come interpretarli</h2>
        <p className="mt-2 text-sm leading-6 text-[#506157]">
          La Scuola distingue contenuti editoriali, valori calcolati e riferimenti pubblicati. Le sintesi non sostituiscono i testi ufficiali delle norme o le specifiche contrattuali applicabili.
        </p>
        <details className="mt-2 text-sm text-[#405a4e]">
          <summary className="cursor-pointer py-2 font-semibold underline underline-offset-4">Consulta la metodologia</summary>
          <p className="mt-2 leading-6">
            La sezione tubi include cluster per famiglia, dimensione esterna e spessore. I riferimenti tecnici sono contestualizzati per norma e fonte; un peso pubblicato per tubi in pressione non certifica automaticamente un profilato strutturale.
            I testi normativi protetti non vengono riprodotti. Consulta sempre le fonti e la data di revisione delle schede.
          </p>
        </details>
      </section>
    </FocusPage>
  );
}
