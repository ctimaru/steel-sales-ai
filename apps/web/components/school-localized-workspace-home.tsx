import { FocusPage } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SchoolQuickAccess } from "@/components/school-quick-access";
import { SchoolWorkspaceFirstViewport } from "@/components/school-workspace-first-viewport";
import { SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SCHOOL_PRIVATE_COPY, type SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

/** Same compact School first viewport for every authenticated locale.
 * Language changes modify presentation only and do not alter authorization.
 */
export function SchoolLocalizedWorkspaceHome({locale}:{locale:SchoolWorkspaceLocale}){
  const c = SCHOOL_PRIVATE_COPY[locale];
  return <div lang={locale}><FocusPage compact className="max-w-[1180px] px-3 py-2 sm:px-5 sm:py-3 lg:px-6">
    <PilotEvent eventName="school_home_viewed" metadata={{surface:"school_home"}} />
    <SchoolPrivateTopbar locale={locale} compact/>
    <SchoolWorkspaceFirstViewport locale={locale}/>
    <details className="group rounded-[20px] border border-[#d5e3da] bg-white px-4 py-3 sm:px-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#174b3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
        {c.allTools} <span aria-hidden="true" className="text-base transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 space-y-4">
        <SchoolTechnicalSections locale={locale}/>
      </div>
    </details>
    <details data-testid="school-ux6-personal-resources" className="group rounded-[20px] border border-[#d5e3da] bg-white px-4 py-3 sm:px-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#174b3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
        {c.latest} <span aria-hidden="true" className="text-base transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 border-t border-[#e5ede7] pt-4"><SchoolQuickAccess locale={locale}/></div>
    </details>
  </FocusPage></div>;
}
