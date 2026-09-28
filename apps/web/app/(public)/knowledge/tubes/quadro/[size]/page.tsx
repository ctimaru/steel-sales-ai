import type { Metadata } from "next";

import {
  PublicTubeSizeHubPage,
  tubeSizeHubMetadata,
} from "@/components/public-tube-size-hub";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ size: string }>;
}): Promise<Metadata> {
  const { size } = await params;
  return tubeSizeHubMetadata("quadro", size);
}

export default async function Page({
  params,
}: {
  params: Promise<{ size: string }>;
}) {
  const { size } = await params;
  return <PublicTubeSizeHubPage familySlug="quadro" sizeSlug={size} />;
}
