import StandardsIndexPage from "@/app/(public)/knowledge/norme/page";
import { PilotEvent } from "@/components/pilot-event";

export default async function SchoolStandardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      {params.q?.trim() ? (
        <PilotEvent
          eventName="school_reference_search"
          metadata={{ surface: "school_standards", format: "standard" }}
        />
      ) : null}
      <StandardsIndexPage searchParams={Promise.resolve(params)} />
    </>
  );
}
