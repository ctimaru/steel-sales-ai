import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { NetworkRdoDistintaPicker } from "@/components/network-rdo-distinta-picker";
import { RequestSteps } from "@/components/request-steps";
import { safeBuyerUiLocale } from "@/lib/buyer-ui-locale";
import { buildBuyerDistintaCatalogOptions } from "@/lib/buyer-distinta-catalog";
import { getCommercialNetworkContext } from "@/lib/commercial-network-context";
import { newRequestHref } from "@/lib/new-request-href";
import { listNetworkRdoSavedDistintas } from "@/lib/network-rdo-saved-distintas";
import { listBuyerDistintaPublicDimensions } from "@/lib/public-knowledge";
import { appRoutes } from "@/lib/routes";
import { privateNoIndexRobots } from "@/lib/seo";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/server";
import { nextRdoTitle, romeYear } from "@/lib/distinta-defaults";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nuova richiesta",
  robots: privateNoIndexRobots,
};

/**
 * DISTINTA-QUICK1: the published sizes are public, tenant-independent data
 * (publishable key, no cookies). Cache them for an hour instead of three
 * Supabase RPCs on every visit. An empty read throws so it is never cached.
 */
const cachedQuickAddCatalog = unstable_cache(async () => {
  const options = buildBuyerDistintaCatalogOptions(await listBuyerDistintaPublicDimensions());
  if (!options.length) throw new Error("Public tube catalog unavailable");
  return options;
}, ["distinta-quick1-public-catalog-v1"], { revalidate: 3600 });

/**
 * DISTINTA-ONE1 (founder decision, 17 Nov 2026): the ONLY screen to create a
 * request. Commerciale, dashboard, Network, RFQ Hub, Marketplace and search all
 * link here (lib/new-request-href.ts); old /commercial?compose=1 links redirect.
 *
 * Step 1 is the Distinta: describe the material in the chat or add a measure
 * with the calculator. «Scegli i fornitori» creates the private RFQ (no send)
 * and opens step 2, the suppliers. Sending (step 3) always needs a confirmation.
 */
/**
 * DISTINTA-DEFAULTS1: the next «RDO <anno>/<nnnn>» among the Distinte and RFQs
 * this user can read (RLS: own Distinte, the organization's RFQs). Only a
 * suggested, editable name: no counter is reserved or written here.
 */
async function loadDefaultDistintaTitle(organizationId: string): Promise<string> {
  const year = romeYear();
  const prefix = "RDO " + year + "/%";
  try {
    const supabase = await createClient();
    const [distinte, rfqs] = await Promise.all([
      supabase.from("buyer_distintas").select("title").eq("organization_id", organizationId).ilike("title", prefix).limit(2000),
      supabase.from("buyer_rfq_campaigns").select("title").eq("organization_id", organizationId).ilike("title", prefix).limit(2000),
    ]);
    const titles = [...(distinte.data ?? []), ...(rfqs.data ?? [])].map((row: { title: string | null }) => row.title);
    return nextRdoTitle(titles, year);
  } catch {
    return nextRdoTitle([], year);
  }
}

export default async function NewRequestPage({ searchParams }: {
  searchParams: Promise<{ lang?: string; aggiungi?: string; network?: string; source?: string; nuova?: string }>;
}) {
  // UI gate is not the authorization boundary. Existing server actions and
  // Supabase policies independently verify the authenticated data owner.
  const context = await requireWorkspaceWriteRole(appRoutes.rfqHub.home);
  const params = await searchParams;
  const locale=safeBuyerUiLocale(params.lang);
  // A Network-originated RDO offers the user's own reusable Distinte first.
  // The company is validated server-side; direct /distinta entry remains unchanged.
  const networkContext = await getCommercialNetworkContext(context.organizationId, params.network)
    .catch(() => null);
  const savedChoice = networkContext && params.nuova !== "1"
    ? await listNetworkRdoSavedDistintas(context.organizationId, context.userId)
    : null;
  if (networkContext && savedChoice?.items.length) {
    return (
      <NetworkRdoDistintaPicker
        networkCompanyId={networkContext.id}
        companyName={networkContext.name}
        items={savedChoice.items}
        newHref={newRequestHref({ network: networkContext.id }) + "&nuova=1"}
      />
    );
  }

  // With no reusable Distinte, directly enter the existing single builder:
  // no empty chooser, extra click or unnecessary public catalog load.
  const [catalogOptions, defaultTitle] = await Promise.all([
    cachedQuickAddCatalog().catch(() => []),
    loadDefaultDistintaTitle(context.organizationId),
  ]);

  return (
    <div data-distinta-steps className="space-y-3" lang={locale}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-[#0f2e23]">Nuova richiesta</h1>
          <RequestSteps current={0} testId="new-request-steps" />
        </div>
        <Link href={appRoutes.commercial.home} className="inline-flex min-h-9 items-center rounded-full border border-[#7a9585] bg-white px-3 text-sm font-semibold !text-[#175640] hover:border-[#175640] hover:bg-[#f2f8f4]">
          Trattative
        </Link>
      </header>
      {savedChoice?.error ? <p role="status" className="rounded-lg border border-[#e9c46a] bg-[#fffaf0] px-3 py-2 text-xs text-[#674b15]">
        Le Distinte salvate non sono disponibili in questo momento. Puoi comunque creare una nuova richiesta.
      </p> : null}
      {networkContext ? (
        <p data-testid="new-request-network-provenance"
          className="rounded-lg border border-[#cfe3d7] bg-[#f4faf6] px-3 py-2 text-xs leading-5 text-[#315c49]">
          Dal Network · <span className="font-semibold">{networkContext.name}</span>{networkContext.name.endsWith(".") ? "" : "."} La trovi in cima al passo 2, già spuntata: non viene aggiunta in automatico, la aggiungi tu.
        </p>
      ) : null}
      <BuyerDistintaBuilder
        defaultTitle={defaultTitle}
        workspace
        focusAiIntake
        // The AI chat is Italian; a bill prepared in another language starts from the «Aggiungi articolo» bar.
        openMeasure={params.aggiungi === "misura" || locale !== "it"}
        locale={locale}
        authenticated
        userId={context.userId}
        organizationId={context.organizationId}
        catalogOptions={catalogOptions}
        stepTwoNetworkCompanyId={networkContext?.id ?? null}
      />
    </div>
  );
}
