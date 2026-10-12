import {
  PublicTubeFamilyHubPage,
  tubeFamilyMetadata,
} from "@/components/public-tube-family-hub";

export const metadata = tubeFamilyMetadata("tondo");

export default function Page() {
  return <PublicTubeFamilyHubPage familySlug="tondo" />;
}
