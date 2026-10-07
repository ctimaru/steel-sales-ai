import PublicTubeWeightsPage from "@/app/(public)/knowledge/tubes/page";
import { PilotEvent } from "@/components/pilot-event";

type SearchParams = Promise<{
  standard?: string;
  family?: string;
  od?: string;
  width?: string;
  height?: string;
  thickness?: string;
  length?: string;
  quantity?: string;
  target?: string;
  density?: string;
  source?: string;
  surface?: string;
}>;

export default function SchoolTubeWeightsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <>
      <PilotEvent eventName="school_calculator_viewed" metadata={{ surface: "school_calculator" }} />
      <PublicTubeWeightsPage searchParams={searchParams} />
    </>
  );
}
