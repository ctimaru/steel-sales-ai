import Link from "next/link";
import { notFound } from "next/navigation";

import { PrivateProductDemoRoom } from "@/components/private-product-demo-room";
import {
  investorDemoMeta,
  isInvestorDemoSurface,
} from "@/lib/marketing-private-demo-data";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PlatformMarketingDemoRoomPage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  await requirePlatformSuperadmin();
  const { surface } = await params;
  if (!isInvestorDemoSurface(surface)) notFound();

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-base)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="platform-kicker">MKT6 · Authenticated Demo Room</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Private Product Demo Dataset
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Fixture sintetica owner-only per produrre visual investor-safe. Nessuna riga demo viene scritta nel database e nessun evento viene inviato alla telemetria.
          </p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--semantic-warning)]">
            {investorDemoMeta.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={appRoutes.platform.marketingVisualEvidenceQa} className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold">
            Visual Evidence QA
          </Link>
          <Link href={appRoutes.platform.marketingInvestorDeck} className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold">
            Investor Deck
          </Link>
        </div>
      </section>

      <PrivateProductDemoRoom surface={surface} />
    </div>
  );
}
