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
    <FocusPage className="px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#405a4e]">Risorse tecniche pubbliche · accesso gratuito</p>
        <SchoolPageLanguageSelector locale="it" />
      </div>

      <SchoolUnifiedNavigation locale="it" scope="public" compact />

      <section aria-labelledby="school-cine-heading" className="relative isolate overflow-hidden rounded-[24px] bg-[#0b241b] text-white">
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
            <Link href="#approfondimenti" className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold !text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Esplora le guide <span aria-hidden="true" className="ml-2">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="strumenti" className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" aria-labelledby="school-tools-heading">
        <div className="school-card flex flex-col justify-between gap-5 border-[#b6d5c6] bg-[#f7faf8] p-5 sm:p-7">
          <div>
            <p className="school-kicker">Strumento principale</p>
            <h2 id="school-tools-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">Calcola peso, barre e tonnellate</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#43554b]">
              Tubi tondi, quadri e rettangolari. EN 10210, EN 10219 e geometria libera: passa dai kg/m alla distinta nello stesso flusso.
            </p>
          </div>
          <div>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                ["kg/m", "Massa lineare"],
                ["Barre", "Lunghezza e quantità"],
                ["t", "Tonnellaggio"],
              ].map(([value, label]) => (
                <div key={value} className="rounded-xl border border-[#d1dfd7] bg-white px-3 py-3">
                  <p className="text-base font-bold text-[#184638]">{value}</p>
                  <p className="mt-1 text-xs leading-4 text-[#506157]">{label}</p>
                </div>
              ))}
            </div>
            <Link href="/knowledge/tubes?source=school&surface=home_card#calcolatore-pesi" className="school-primary-action">
              Calcola e crea la distinta <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </div>
        </div>

        <div id="ricerca-tecnica" className="school-card p-5 sm:p-7" aria-labelledby="school-search-heading">
          <p className="school-kicker">Ricerca tecnica</p>
          <h2 id="school-search-heading" className="mt-2 text-xl font-semibold text-[#1d2824]">Hai già una sigla?</h2>
          <p className="mt-2 text-sm leading-6 text-[#506157]">Cerca direttamente nei cataloghi verificabili. Sono due ricerche distinte: scegli cosa vuoi consultare.</p>
          <form action="/knowledge/norme" method="get" role="search" aria-label="Cerca norme tecniche" className="mt-5">
            <label htmlFor="school-standard-q" className="block text-xs font-bold text-[#365247]">Norma tecnica</label>
            <div className="mt-2 flex gap-2">
              <input id="school-standard-q" name="q" type="search" required maxLength={64} placeholder="Es. EN 10219" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#b8cac0] bg-white px-3 text-sm text-[#1d2824] placeholder:text-[#66756c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]" />
              <button type="submit" className="school-primary-action shrink-0">Cerca</button>
            </div>
          </form>
          <form action="/knowledge/gradi" method="get" role="search" aria-label="Cerca gradi di acciaio" className="mt-4">
            <label htmlFor="school-grade-q" className="block text-xs font-bold text-[#365247]">Grado di acciaio</label>
            <div className="mt-2 flex gap-2">
              <input id="school-grade-q" name="q" type="search" required maxLength={64} placeholder="Es. P235TR2" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#b8cac0] bg-white px-3 text-sm text-[#1d2824] placeholder:text-[#66756c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]" />
              <button type="submit" className="school-secondary-action shrink-0">Cerca</button>
            </div>
          </form>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Esempi di ricerche">
            <Link href="/knowledge/norme?q=EN%2010210" className="rounded-lg border border-[#b8cac0] bg-[#f2f7f4] px-3 py-2 text-xs font-semibold text-[#184638] hover:bg-[#e5f0e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">EN 10210 ↗</Link>
            <Link href="/knowledge/gradi?q=S355J2H" className="rounded-lg border border-[#b8cac0] bg-[#f2f7f4] px-3 py-2 text-xs font-semibold text-[#184638] hover:bg-[#e5f0e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">S355J2H ↗</Link>
          </div>
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
