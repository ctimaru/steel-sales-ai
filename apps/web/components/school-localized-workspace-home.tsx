import Link from "next/link";
import {SchoolAssistantEntry} from "@/components/school-assistant-entry";
import { FocusPage } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SchoolQuickAccess } from "@/components/school-quick-access";
import { SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SchoolUnifiedNavigation, SchoolConversionPath } from "@/components/school-unified-navigation";
import { CALCULATOR_ROUTES } from "@/lib/international-calculator-landing";
import { schoolWorkspaceHref,SCHOOL_PRIVATE_COPY,type SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

const privateCards = (locale:SchoolWorkspaceLocale) => {
  const c=SCHOOL_PRIVATE_COPY[locale];
  return [
    {label:"01 · CHS / SHS / RHS",title:c.calculator,description:c.calcHint,href:locale==="it"?schoolWorkspaceHref("/school/tubes",locale):CALCULATOR_ROUTES[locale],isPublic:locale!=="it"},
    {label:"02 · EN",title:c.standards,description:c.searchHint,href:schoolWorkspaceHref("/school/norme",locale)},
    {label:"03 · S355",title:c.grades,description:c.searchHint,href:schoolWorkspaceHref("/school/gradi",locale)},
    {label:"04 · PRIVATE",title:c.docs,description:c.docsHint,href:schoolWorkspaceHref("/school/explorer",locale)},
  ];
};

export function SchoolLocalizedWorkspaceHome({locale}:{locale:SchoolWorkspaceLocale}){
  const c=SCHOOL_PRIVATE_COPY[locale];
  return <div lang={locale}><FocusPage className="max-w-[1180px]">
    <PilotEvent eventName="school_home_viewed" metadata={{surface:"school_home"}} />
    <SchoolPrivateTopbar locale={locale}/>
    <SchoolUnifiedNavigation locale={locale} scope="workspace"/>
    <section className="grid items-center gap-5 overflow-hidden rounded-[28px] bg-[#102921] px-6 py-9 text-white sm:px-9 sm:py-11 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" aria-label={c.welcome}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:72%_center] opacity-65" style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,31,23,.97)_0%,rgba(9,31,23,.86)_55%,rgba(9,31,23,.50)_100%)]" />
      <div className="space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#a6d4ba]">{c.brand} · Smart Steel Sales</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{c.welcome}</h1>
        <p className="max-w-2xl text-sm leading-7 text-[#d2e4d9] sm:text-base">{c.intro}</p>
        <p className="text-xs leading-6 text-[#b4cbbb]">{c.sourceDisclosure}</p>
      </div>
      <SchoolTechnicalSections locale={locale}/>
    </section>
    <SchoolAssistantEntry locale={locale}/>
    <section className="space-y-3" aria-labelledby="school-private-tools">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#1a5144]">{c.kicker}</p>
        <h2 id="school-private-tools" className="mt-2 text-2xl font-semibold text-[#173f35]">{c.allTools}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {privateCards(locale).map(item=><Link key={item.href} href={item.href}
          className="group flex min-h-[184px] flex-col rounded-2xl border border-[#cddfd5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8bb7a3] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-[#2b7356]">{item.label}</span>
          <h3 className="mt-3 text-base font-bold text-[#173f35]">{item.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-6 text-[#506157]">{item.description}</p>
          <span className="mt-3 text-sm font-bold text-[#174b3c]">{item.isPublic?c.publicLabel:c.read} →</span>
        </Link>)}
      </div>
      <p className="text-xs leading-6 text-[#52615b]">{c.publicNote}</p>
    </section>
    <SchoolConversionPath locale={locale}/>
    <section aria-labelledby="school-private-search" className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-7">
      <h2 id="school-private-search" className="text-xl font-semibold text-[#173f35]">{c.search}</h2>
      <p className="mt-2 text-sm leading-6 text-[#52615b]">{c.searchHint}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(["norme","gradi"] as const).map(group=><form key={group} method="get"
          action={"/school/"+group} role="search"
          className="min-w-0 rounded-xl border border-[#dce5df] bg-[#f7faf8] p-4">
          <label htmlFor={"school-private-"+group+"-"+locale} className="block text-xs font-bold text-[#365247]">
            {group==="norme"?c.standards:c.grades}
          </label>
          <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
            <input id={"school-private-"+group+"-"+locale} name="q" required maxLength={120} type="search"
              placeholder={group==="norme"?"EN 10219":"S355J2H"}
              className="min-h-11 min-w-0 w-full flex-1 rounded-xl border border-[#b8cac0] bg-white px-3 text-base text-[#1d2824] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"/>
            {locale!=="it"?<input type="hidden" name="lang" value={locale}/>:null}
            <button type="submit" className="school-primary-action w-full shrink-0 sm:w-auto">{c.searchAction}</button>
          </div>
        </form>)}
      </div>
    </section>
    <SchoolQuickAccess locale={locale}/>
    <section className="rounded-3xl border border-[#cddfd5] bg-[#eaf4ef] p-5 sm:p-7">
      <h2 className="text-xl font-semibold text-[#173f35]">{c.docs}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#52615b]">{c.docsHint}</p>
      <Link href={schoolWorkspaceHref("/school/explorer",locale)} className="school-primary-action mt-4">{c.docsAction} →</Link>
    </section>
  </FocusPage></div>;
}
