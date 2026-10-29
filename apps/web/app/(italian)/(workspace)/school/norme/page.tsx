import { PilotEvent } from "@/components/pilot-event";
import { SchoolPrivateReferenceIndex } from "@/components/school-private-reference-index";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

export default async function SchoolStandardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const locale = schoolWorkspaceLocale(params.lang);
  return (
    <>
      {params.q?.trim() ? (
        <PilotEvent
          eventName="school_reference_search"
          metadata={{ surface: "school_standards", format: "standard" }}
        />
      ) : null}
      <SchoolPrivateReferenceIndex locale={locale} kind="norme" query={params.q??""}/>
    </>
  );
}
