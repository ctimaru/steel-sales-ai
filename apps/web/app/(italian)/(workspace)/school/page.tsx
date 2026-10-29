import { FocusPage } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { SchoolWorkspaceFirstViewport } from "@/components/school-workspace-first-viewport";
import { SchoolQuickAccess } from "@/components/school-quick-access";
import { SchoolJourney, SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SchoolConversionPath } from "@/components/school-unified-navigation";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SchoolLocalizedWorkspaceHome } from "@/components/school-localized-workspace-home";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

/** The first viewport matches public School. Workspace-only capabilities remain below it. */
export default async function SchoolPage({searchParams}:{searchParams:Promise<{lang?:string}>}) {
  const locale = schoolWorkspaceLocale((await searchParams).lang);
  if (locale!=="it") return <SchoolLocalizedWorkspaceHome locale={locale}/>;
  return <FocusPage compact className="max-w-[1180px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
    <PilotEvent eventName="school_home_viewed" metadata={{surface:"school_home"}} />
    <SchoolPrivateTopbar locale="it" compact/>
    <SchoolWorkspaceFirstViewport locale="it"/>
    <SchoolJourney locale="it" workspace />
    <SchoolConversionPath locale="it" />
    <details className="group rounded-[20px] border border-[#d5e3da] bg-white px-4 py-4 sm:px-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#174b3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
        Altre risorse tecniche <span aria-hidden="true" className="text-base transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 space-y-3">
        <SchoolTechnicalSections locale="it"/>
      </div>
    </details>
    <SchoolQuickAccess locale="it"/>
  </FocusPage>;
}
