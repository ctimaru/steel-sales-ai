import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { safeBuyerUiLocale } from "@/lib/buyer-ui-locale";
import { buildBuyerDistintaCatalogOptions } from "@/lib/buyer-distinta-catalog";
import { getCommercialNetworkContext } from "@/lib/commercial-network-context";
import { listBuyerDistintaPublicDimensions } from "@/lib/public-knowledge";
import { appRoutes } from "@/lib/routes";
import { privateNoIndexRobots } from "@/lib/seo";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nuova richiesta",
  robots: privateNoIndexRobots,
};

const steps = ["Cosa ti serve", "A chi lo chiedi", "Invia"] as const;

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
export default async function NewRequestPage({ searchParams }: {
  searchParams: Promise<{ lang?: string; aggiungi?: string; network?: string; source?: string }>;
}) {
  // UI gate is not the authorization boundary. Existing server actions and
  // Supabase policies independently verify the authenticated data owner.
  const context = await requireWorkspaceWriteRole(appRoutes.rfqHub.home);
  const params = await searchParams;
  const locale=safeBuyerUiLocale(params.lang);
  const [catalogOptions, networkContext] = await Promise.all([
    cachedQuickAddCatalog().catch(() => []),
    // Provenance only: the Network company is never added as a recipient automatically.
    getCommercialNetworkContext(context.organizationId, params.network).catch(() => null),
  ]);

  return (
    <div className="space-y-3" lang={locale}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-[#143f30]">Nuova richiesta</h1>
          <ol aria-label="Passaggi della richiesta" className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="new-request-steps">
            {steps.map((step, index) => (
              <li key={step} aria-current={index === 0 ? "step" : undefined}
                className={"flex items-center gap-1.5 " + (index === 0 ? "font-semibold text-[#143f30]" : "text-[#5c7063]")}>
                <span aria-hidden="true" className={"flex h-5 w-5 items-center justify-center rounded-full text-[11px] " +
                  (index === 0 ? "bg-[#175640] text-white" : "border border-[#c9d9cf] text-[#5c7063]")}>{index + 1}</span>
                {step}
                {index < steps.length - 1 ? <span aria-hidden="true" className="ml-1.5 text-[#b3c4ba]">—</span> : null}
              </li>
            ))}
          </ol>
        </div>
        <Link href={appRoutes.commercial.home} className="inline-flex min-h-9 items-center rounded-full border border-[#d6e5db] bg-white px-3 text-sm font-semibold !text-[#175640] hover:bg-[#f2f8f4]">
          Trattative
        </Link>
      </header>
      {networkContext ? (
        <p data-testid="new-request-network-provenance"
          className="rounded-lg border border-[#cfe3d7] bg-[#f4faf6] px-3 py-2 text-xs leading-5 text-[#315c49]">
          Dal Network · <span className="font-semibold">{networkContext.name}</span>{networkContext.name.endsWith(".") ? "" : "."} La trovi in cima al passo 2, già spuntata: non viene aggiunta in automatico, la aggiungi tu.
        </p>
      ) : null}
      <BuyerDistintaBuilder
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
