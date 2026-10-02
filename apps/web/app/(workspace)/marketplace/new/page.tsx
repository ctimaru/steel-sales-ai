import Link from "next/link";

import { createMarketplaceRequest } from "@/app/(workspace)/marketplace/actions";
import { getMarketplaceEntryReadiness } from "@/lib/marketplace-readiness";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function NewMarketplaceRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, context] = await Promise.all([
    searchParams,
    requireWorkspaceWriteRole(appRoutes.marketplace.home),
  ]);
  const readiness = await getMarketplaceEntryReadiness(
    context.organizationId,
    context.role,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={appRoutes.marketplace.home}
        className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
      >
        ← Torna al Marketplace
      </Link>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#173f35]">
          Nuova ricerca prodotto
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
          Crea una bozza Marketplace
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#66736e]">
          La bozza nasce nel dominio Marketplace. Non importa dati da RFQ, offerte, email o clienti
          della Commercial Memory.
        </p>

        <form action={createMarketplaceRequest} className="mt-7 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
              Titolo
            </label>
            <input
              name="title"
              required
              minLength={5}
              maxLength={200}
              placeholder="Es. Tubi EN 10217-1 per consegna Nord Italia"
              className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
            />
          </div>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
              Visibilità buyer
            </legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="cursor-pointer rounded-2xl border border-[#d7dfdb] bg-[#f8faf9] p-4">
                <input type="radio" name="visibility_mode" value="named" defaultChecked className="mr-2" />
                <span className="text-sm font-semibold text-[#1d2824]">Azienda visibile</span>
                <p className="mt-2 text-xs leading-5 text-[#66736e]">
                  Il futuro teaser potrà collegare la domanda al Company Profile.
                </p>
              </label>
              <label className="cursor-pointer rounded-2xl border border-[#d7dfdb] bg-[#f8faf9] p-4">
                <input type="radio" name="visibility_mode" value="anonymous" className="mr-2" />
                <span className="text-sm font-semibold text-[#1d2824]">Anonima</span>
                <p className="mt-2 text-xs leading-5 text-[#66736e]">
                  Anche dopo un futuro unlock l’identità non verrà rivelata automaticamente.
                </p>
              </label>
            </div>
          </fieldset>

          <div
            className={[
              "rounded-2xl border px-4 py-3",
              readiness.buyer.namedPublicationReady
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-amber-200 bg-amber-50/60",
            ].join(" ")}
          >
            <p className="text-xs font-semibold text-[#1d2824]">
              {readiness.buyer.namedPublicationReady
                ? "✓ Pubblicazione named pronta"
                : "! Pubblicazione named da completare"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              {readiness.buyer.namedPublicationReady
                ? "Il Company Profile della tua organizzazione è collegato e pubblicato."
                : "Puoi creare subito la bozza. Prima di pubblicarla come azienda visibile dovrai completare e pubblicare il Company Profile; in alternativa potrai usare la modalità anonima."}
            </p>
            {!readiness.buyer.namedPublicationReady ? (
              <Link
                href={appRoutes.network.manage}
                className="mt-2 inline-flex text-xs font-semibold text-[#173f35] hover:underline"
              >
                Completa Company Profile →
              </Link>
            ) : null}
          </div>

          <button className="h-11 w-full rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white hover:bg-[#226657] sm:w-auto">
            Crea bozza e aggiungi prodotti
          </button>
        </form>
      </section>
    </div>
  );
}
