import {
  PublicTubeFamilyHubPage,
  tubeFamilyMetadata,
} from "@/components/public-tube-family-hub";

export const metadata = tubeFamilyMetadata("quadro");

export default function Page() {
  return <PublicTubeFamilyHubPage familySlug="quadro" />;
}
