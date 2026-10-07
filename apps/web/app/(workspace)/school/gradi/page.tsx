import GradesIndexPage from "@/app/(public)/knowledge/gradi/page";
import { PilotEvent } from "@/components/pilot-event";

export default async function SchoolGradesPage({
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
          metadata={{ surface: "school_grades", format: "grade" }}
        />
      ) : null}
      <GradesIndexPage searchParams={Promise.resolve(params)} />
    </>
  );
}
