import type { Metadata } from "next";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import { legalIdentity } from "@/lib/legal";
import { privateNoIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Chiusura account",
  robots: privateNoIndexRobots,
};

export default function AccountClosurePage() {
  const identity = legalIdentity();

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <ProductBrand href="/" showDescriptor={false} />
        <section className="mt-7 rounded-[28px] border border-[#dce2df] bg-white p-6 shadow-[0_14px_44px_rgba(18,61,52,0.06)] sm:p-8">
          <p className="app-kicker">Account</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#1d2824]">Richiesta di chiusura registrata</h1>
          <p className="mt-3 text-sm leading-6 text-[#5d6a65]">
            L’accesso al workspace è stato sospeso. La richiesta di cancellazione viene ora
            trattata secondo la retention applicabile: i dati personali eleggibili vengono rimossi,
            mentre eventuali evidenze che devono essere conservate per obblighi, sicurezza o tutela
            di diritti restano limitate al periodo necessario.
          </p>
          <p className="mt-4 text-sm leading-6 text-[#5d6a65]">
            La chiusura del tuo account personale non elimina automaticamente i dati aziendali o la
            Commercial Memory dell’organizzazione.
          </p>
          {identity.privacyEmail ? (
            <p className="mt-4 text-sm leading-6 text-[#5d6a65]">
              Per una richiesta privacy formale puoi scrivere a{" "}
              <a
                className="font-semibold text-[#173f35] underline underline-offset-4"
                href={"mailto:" + identity.privacyEmail}
              >
                {identity.privacyEmail}
              </a>.
            </p>
          ) : null}
          <Link
            href="/"
            className="app-secondary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
          >
            Torna al sito pubblico
          </Link>
        </section>
      </div>
    </main>
  );
}
