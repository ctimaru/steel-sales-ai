import Link from "next/link";
import { appRoutes } from "@/lib/routes";

import { ProductAnalyticsDashboard } from "@/components/product-analytics-dashboard";
import { getPlatformAnalyticsSnapshot } from "@/lib/platform-product-analytics";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePlatformSuperadmin();
  const { range } = await searchParams;
  const snapshot = await getPlatformAnalyticsSnapshot(range);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap justify-end">
        <Link href={appRoutes.platform.feedInsights} className="inline-flex min-h-11 items-center rounded-xl border border-[#c7d8ce] bg-white px-4 text-sm font-semibold text-[#175640] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
          DASH-FEED7 · Engagement e retention →
        </Link>
      </div>
      <ProductAnalyticsDashboard snapshot={snapshot} />
    </div>
  );
}
