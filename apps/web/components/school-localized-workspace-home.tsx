import Link from "next/link";
import { FocusPage } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SchoolQuickAccess } from "@/components/school-quick-access";
import { SchoolWorkspaceFirstViewport } from "@/components/school-workspace-first-viewport";
import { SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SchoolConversionPath } from "@/components/school-unified-navigation";
import { CALCULATOR_ROUTES } from "@/lib/international-calculator-landing";
import { schoolWorkspaceHref, SCHOOL_PRIVATE_COPY, type SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

const privateCards = (locale:SchoolWorkspaceLocale) => {
  const c = SCHOOL_PRIVATE_COPY[locale];
  return [
    {label:"01 · CHS / SHS / RHS",title:c.calculator,description:c.calcHint,href:locale==="it"?schoolWorkspaceHref("/school/tubes",locale):CALCULATOR_ROUTES[locale],isPublic:locale!=="it"},
    {label:"02 · EN",title:c.standards,description:c.searchHint,href:schoolWorkspaceHref("/school/norme",locale),isPublic:false},
    {label:"03 · S355",title:c.grades,description:c.searchHint,href:schoolWorkspaceHref("/school/gradi",locale),isPublic:false},
  ];
};

/** Same compact School first viewport for every authenticated locale.
 * Language changes modify presentation only and do not alter authorization.
 */
export function SchoolLocalizedWorkspaceHome({locale}:{locale:SchoolWorkspaceLocale}){
  const c = SCHOOL_PRIVATE_COPY[locale];
  return <div lang={locale}><FocusPage compact className="max-w-[1180px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
    <PilotEvent eventName="school_home_viewed" metadata={{surface:"school_home"}} />
    <SchoolPrivateTopbar locale={locale} compact/>
    <SchoolWorkspaceFirstViewport locale={locale}/>
    <SchoolConversionPath locale={locale}/>
    <details className="group rounded-[20px] border border-[#d5e3da] bg-white px-4 py-4 sm:px-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#174b3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
        {c.allTools} <span aria-hidden="true" className="text-base transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 space-y-4">
        <SchoolTechnicalSections locale={locale}/>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {privateCards(locale).map(item=><Link key={item.href} href={item.href}
            data-testid="school-private-tool-card" className="group flex min-h-[138px] flex-col rounded-[18px] border border-[#d4e2d8] bg-[#fafcfb] p-4 transition hover:border-[#8bb7a3] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
            <span className="text-[11px] font-bold uppercase tracking-[.1em] text-[#2b7356]">{item.label}</span>
            <h3 className="mt-2 text-sm font-semibold text-[#173f35]">{item.title}</h3>
            <p className="mt-2 flex-1 text-xs leading-5 text-[#506157]">{item.description}</p>
            <span className="mt-3 text-xs font-bold text-[#174b3c]">{item.isPublic?c.publicLabel:c.read} →</span>
          </Link>)}
        </div>
      </div>
    </details>
    <SchoolQuickAccess locale={locale}/>
  </FocusPage></div>;
}
