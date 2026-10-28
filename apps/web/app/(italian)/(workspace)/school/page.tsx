import Link from "next/link";
import { FocusPage } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { SchoolAssistantEntry } from "@/components/school-assistant-entry";
import { SchoolWorkspaceFirstViewport } from "@/components/school-workspace-first-viewport";
import { SchoolQuickAccess } from "@/components/school-quick-access";
import { SchoolJourney, SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SchoolUnifiedNavigation, SchoolConversionPath } from "@/components/school-unified-navigation";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SchoolLocalizedWorkspaceHome } from "@/components/school-localized-workspace-home";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";
import { appRoutes } from "@/lib/routes";

/** The first viewport matches public School. Workspace-only capabilities remain below it. */
export default async function SchoolPage({searchParams}:{searchParams:Promise<{lang?:string}>}) {
  const locale = schoolWorkspaceLocale((await searchParams).lang);
  if (locale!=="it") return <SchoolLocalizedWorkspaceHome locale={locale}/>;
  return <FocusPage compact className="max-w-[1180px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
    <PilotEvent eventName="school_home_viewed" metadata={{surface:"school_home"}} />
    <SchoolPrivateTopbar locale="it" compact/>
    <SchoolUnifiedNavigation locale="it" scope="workspace" compact/>
    <SchoolWorkspaceFirstViewport locale="it"/>
    <SchoolAssistantEntry locale="it"/>
    <SchoolJourney locale="it" workspace />
    <SchoolConversionPath locale="it" />
    <details className="group rounded-[20px] border border-[#d5e3da] bg-white px-4 py-4 sm:px-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#174b3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
        Altre risorse tecniche <span aria-hidden="true" className="text-base transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 space-y-3">
        <SchoolTechnicalSections locale="it"/>
        <Link href={appRoutes.knowledge.catalog} className="inline-flex min-h-10 items-center rounded-xl border border-[#c4dccc] bg-[#f4f9f5] px-4 text-xs font-semibold text-[#174b3c] hover:bg-[#e8f3eb]">
          Catalogo completo <span className="ml-2" aria-hidden="true">→</span>
        </Link>
      </div>
    </details>
    <SchoolQuickAccess locale="it"/>
    <section aria-labelledby="school-private-documents" className="rounded-[20px] border border-[#d7e2db] bg-[#f5f8f6] px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="school-kicker">Solo area aziendale</p>
          <h2 id="school-private-documents" className="mt-1 text-lg font-semibold text-[#1b4632]">I tuoi documenti restano privati</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#52645a]">Consulta le informazioni della tua azienda con i permessi esistenti. Non vengono aggiunte alla School pubblica.</p>
        </div>
        <Link href={appRoutes.knowledge.explorer} className="school-primary-action">Apri documenti →</Link>
      </div>
    </section>
  </FocusPage>;
}
