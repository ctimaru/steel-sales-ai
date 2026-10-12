import {
  PublicTubeFamilyHubPage,
  tubeFamilyMetadata,
} from "@/components/public-tube-family-hub";

export const metadata = tubeFamilyMetadata("rettangolare");

export default function Page() {
  return <PublicTubeFamilyHubPage familySlug="rettangolare" />;
}
