import Link from "next/link";

import { createMarketplaceRequest } from "@/app/(workspace)/marketplace/actions";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function NewMarketplaceRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }] = await Promise.all([
    searchParams,
    requireWorkspaceWriteRole(appRoutes.marketplace.home),
  ]);

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

          <button className="h-11 rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white hover:bg-[#226657]">
            Crea bozza e aggiungi prodotti
          </button>
        </form>
      </section>
    </div>
  );
}
