import Link from "next/link";
import type { Metadata } from "next";

import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { safeBuyerUiLocale, buyerUiText } from "@/lib/buyer-ui-locale";
import { buildBuyerDistintaCatalogOptions } from "@/lib/buyer-distinta-catalog";
import { listBuyerDistintaPublicDimensions } from "@/lib/public-knowledge";
import { appRoutes } from "@/lib/routes";
import { privateNoIndexRobots } from "@/lib/seo";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nuova distinta · RFQ Hub",
  robots: privateNoIndexRobots,
};

export default async function PrivateBuyerDistintaPage({searchParams}: {searchParams: Promise<{lang?:string}>}) {
  // UI gate is not the authorization boundary. Existing server actions and
  // Supabase policies independently verify the authenticated data owner.
  const context = await requireWorkspaceWriteRole(appRoutes.rfqHub.home);
  const locale=safeBuyerUiLocale((await searchParams).lang);
  const t=(key:Parameters<typeof buyerUiText>[0])=>buyerUiText(key,locale);
  const catalogOptions = buildBuyerDistintaCatalogOptions(await listBuyerDistintaPublicDimensions());

  return (
    <div className="space-y-4" lang={locale}>
      <nav aria-label="Percorso RFQ Hub" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
        <Link href={appRoutes.rfqHub.home} className="hover:text-[var(--brand-deep)]">RFQ Hub</Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--brand-deep)]">{t("Nuova distinta")}</span>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">{t("Workspace aziendale · acquisti")}</p>
          <h1 className="mt-1 text-xl font-extrabold text-[var(--brand-deep)]">{t("Nuova distinta")}</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Parti dalla calcolatrice, aggiungi le misure in un clic e rivedi la distinta sempre visibile. Gli altri metodi di inserimento restano opzionali.
          </p>
        </div>
        <Link href={appRoutes.rfqHub.home} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold">
          Le mie RFQ
        </Link>
      </header>
      <BuyerDistintaBuilder
        workspace
        locale={locale}
        authenticated
        userId={context.userId}
        organizationId={context.organizationId}
        emailConfigured={Boolean(process.env.RESEND_API_KEY)}
        catalogOptions={catalogOptions}
      />
    </div>
  );
}
