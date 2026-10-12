import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import {
  ACCOUNT_PRIVACY_NOTICE_VERSION,
  ACCOUNT_TERMS_VERSION,
} from "@/lib/account-legal";
import { safeInternalNext } from "@/lib/auth-next";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

import { acceptCurrentLegalTerms } from "./actions";

export const metadata: Metadata = {
  title: "Privacy e Termini",
  robots: privateNoIndexRobots,
};

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; source?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeInternalNext(params.next, "/dashboard");
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login?next=" + encodeURIComponent("/legal/accept?next=" + encodeURIComponent(nextPath)));
  }

  const { data } = await supabase.rpc("lr5_current_legal_acceptance_state");
  const state = (data ?? {}) as { accepted?: boolean };
  if (state.accepted === true) redirect(nextPath);

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <ProductBrand href="/" showDescriptor={false} />

        <section className="mt-7 rounded-[28px] border border-[#dce2df] bg-white p-6 shadow-[0_14px_44px_rgba(18,61,52,0.06)] sm:p-8">
          <p className="app-kicker">Account · Privacy</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1d2824]">
            Due conferme, tenute separate
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5d6a65]">
            L’informativa privacy descrive come trattiamo i dati: prenderne visione non equivale a
            prestare consenso. I Termini d’uso regolano invece l’accesso al servizio.
          </p>

          {params.error ? (
            <div role="alert" className="mt-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]">
              {params.error}
            </div>
          ) : null}

          <form action={acceptCurrentLegalTerms} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <input
              type="hidden"
              name="source"
              value={params.source === "team_invite" ? "team_invite" : "first_login"}
            />

            <label className="flex gap-3 rounded-2xl border border-[#dce2df] p-4 text-sm leading-6 text-[#43524c]">
              <input type="checkbox" name="privacy_acknowledged" required className="mt-1 h-4 w-4 shrink-0 accent-[#1a5144]" />
              <span>
                Ho letto l’{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-[#173f35] underline underline-offset-4">
                  Informativa privacy
                </Link>{" "}
                (versione {ACCOUNT_PRIVACY_NOTICE_VERSION}).
              </span>
            </label>

            <label className="flex gap-3 rounded-2xl border border-[#dce2df] p-4 text-sm leading-6 text-[#43524c]">
              <input type="checkbox" name="terms_accepted" required className="mt-1 h-4 w-4 shrink-0 accent-[#1a5144]" />
              <span>
                Accetto i{" "}
                <Link href="/terms" target="_blank" className="font-semibold text-[#173f35] underline underline-offset-4">
                  Termini d’uso
                </Link>{" "}
                (versione {ACCOUNT_TERMS_VERSION}).
              </span>
            </label>

            <PendingSubmitButton pendingLabel="Registrazione…" className="app-primary h-11 w-full rounded-xl px-5 text-sm font-semibold">
              Conferma e continua
            </PendingSubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
