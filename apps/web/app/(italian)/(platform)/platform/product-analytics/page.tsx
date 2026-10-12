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
    <div className="mx-auto max-w-[1500px]">
      <ProductAnalyticsDashboard snapshot={snapshot} />
    </div>
  );
}
