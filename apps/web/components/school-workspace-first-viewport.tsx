import Link from "next/link";
import { CALCULATOR_ROUTES } from "@/lib/international-calculator-landing";
import {
  SCHOOL_PRIVATE_COPY,
  schoolWorkspaceHref,
  type SchoolWorkspaceLocale,
} from "@/lib/school-workspace-i18n";

const titles: Record<SchoolWorkspaceLocale, string> = {
  it: "L’acciaio, spiegato bene.",
  en: "Steel, explained clearly.",
  de: "Stahlwissen, einfach erklärt.",
  fr: "L’acier, expliqué simplement.",
  es: "El acero, explicado con claridad.",
};
const professor: Record<SchoolWorkspaceLocale, string> = {
  it: "Chiedi al professore",
  en: "Ask the professor (Italian)",
  de: "Professor fragen (Italienisch)",
  fr: "Demander au professeur (italien)",
  es: "Pregunta al profesor (italiano)",
};
const measures: Record<SchoolWorkspaceLocale, string> = {
  it: "Barre", en: "Bars", de: "Stangen", fr: "Barres", es: "Barras",
};
const lookupLabels: Record<SchoolWorkspaceLocale, string> = {
  it: "Hai già una norma o un grado?",
  en: "Already have a standard or grade?",
  de: "Norm oder Stahlsorte bekannt?",
  fr: "Vous avez une norme ou une nuance ?",
  es: "¿Ya tienes una norma o calidad?",
};
const calculatorLabels: Record<SchoolWorkspaceLocale, string> = {
  it: "Calcola peso, barre e tonnellate",
  en: "Calculate weight, bars and tonnes",
  de: "Gewicht, Stangen und Tonnen berechnen",
  fr: "Calculez poids, barres et tonnes",
  es: "Calcula pesos, barras y toneladas",
};

/** One matching photographic hero and technical cockpit for all authenticated School locales.
 * Only the surrounding workspace shell adds company-private features; no private records in public.
 */
export function SchoolWorkspaceFirstViewport({locale}:{locale: SchoolWorkspaceLocale}) {
  const t = SCHOOL_PRIVATE_COPY[locale];
  const calculatorHref = locale === "it"
    ? "/school/tubes?source=school&surface=home_card#calcolatore-pesi"
    : CALCULATOR_ROUTES[locale] + "?source=school&surface=home_card#calcolatore-pesi";
  const shortcutHref = (path: "/school/norme" | "/school/gradi", query: string) =>
    schoolWorkspaceHref(path, locale) + (locale==="it"?"?":"&") + "q=" + encodeURIComponent(query);
  return <>
    <section aria-labelledby="school-workspace-cine-heading"
      className="relative isolate overflow-hidden rounded-[24px] bg-[#102921] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:72%_center] opacity-70"
        style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,29,21,.98)_0%,rgba(7,29,21,.94)_37%,rgba(7,29,21,.60)_73%,rgba(7,29,21,.28)_100%)]" />
      <div className="relative flex min-h-[292px] max-w-3xl flex-col justify-center px-6 py-9 sm:px-10 sm:py-10 lg:py-11">
        <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#b3ddc4]">SMART STEEL SALES / SCHOOL</p>
        <h1 id="school-workspace-cine-heading"
          className="mt-3 max-w-2xl text-[2.35rem] font-semibold leading-[1.1] tracking-[-.045em] text-white sm:text-[3.15rem]">{titles[locale]}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#e0ece4] sm:text-[15px]">{t.intro}</p>
        <p className="mt-2 text-xs leading-5 text-[#b4cebf]">{t.sourceDisclosure}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#school-private-search" className="school-primary-action min-h-11 !rounded-xl !border-[#39876a] !bg-[#247455] !px-5 !text-white transition hover:!bg-[#2c8461] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {t.search} <span aria-hidden="true" className="ml-2">→</span>
          </a>
          <Link href="/knowledge/professore"
            className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold !text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {professor[locale]} <span aria-hidden="true" className="ml-2">↗</span>
          </Link>
        </div>
      </div>
    </section>
    <section id="school-private-tools" aria-label={t.allTools}
      className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)]">
      <div id="school-private-search" className="scroll-mt-20 rounded-[22px] border border-[#d9e3dc] bg-white p-5 sm:p-6">
        <p className="school-kicker">{t.search}</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#163a2e] sm:text-2xl">{lookupLabels[locale]}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#52645a]">{t.searchHint}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["norme","gradi"] as const).map((group) => {
            const label = group==="norme" ? t.standards : t.grades;
            return <form key={group} action={"/school/"+group} method="get" role="search"
              aria-label={label}>
              <label htmlFor={"school-home-"+group+"-"+locale}
                className="mb-1.5 block text-xs font-semibold text-[#365247]">{label}</label>
              <div className="flex min-w-0 gap-1.5">
                <input id={"school-home-"+group+"-"+locale} name="q" type="search" required maxLength={100}
                  placeholder={group==="norme"?"EN 10219":"S355J2H"}
                  className="min-h-11 min-w-0 w-full flex-1 rounded-xl border border-[#c5d5cb] bg-white px-3 text-sm text-[#1d2824] placeholder:text-[#697a70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]" />
                {locale!=="it"?<input type="hidden" name="lang" value={locale}/>:null}
                <button type="submit" aria-label={t.searchAction+": "+label}
                  className="school-primary-action !min-w-11 shrink-0 !px-3">→</button>
              </div>
            </form>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e5ede7] pt-3 text-xs">
          <span className="font-medium text-[#607267]">{t.listed}</span>
          <Link href={shortcutHref("/school/norme","EN 10210")}
            className="rounded-lg bg-[#eef4f0] px-2.5 py-1.5 font-semibold text-[#184638] hover:bg-[#e0ede4]">EN 10210 ↗</Link>
          <Link href={shortcutHref("/school/gradi","S355J2H")}
            className="rounded-lg bg-[#eef4f0] px-2.5 py-1.5 font-semibold text-[#184638] hover:bg-[#e0ede4]">S355J2H ↗</Link>
        </div>
      </div>
      <div className="flex flex-col justify-between rounded-[22px] border border-[#cddfd3] bg-[#eef5ef] p-5 sm:p-6"
        aria-labelledby="school-private-calculator-heading">
        <div>
          <p className="school-kicker">{t.calculator}</p>
          <h2 id="school-private-calculator-heading"
            className="mt-1.5 text-xl font-semibold tracking-tight text-[#163a2e] sm:text-2xl">{calculatorLabels[locale]}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#52645a]">{t.calcHint}</p>
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label={t.calculator}>
            {["kg/m",measures[locale],"t"].map(value=><span key={value}
              className="rounded-lg border border-[#cedfd2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#245442]">{value}</span>)}
          </div>
        </div>
        <Link href={calculatorHref} className="school-primary-action mt-4 w-full self-start sm:w-auto">
          {t.calcAction} <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </div>
    </section>
  </>;
}
