import type { Metadata } from "next";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

import { requestAccountErasure } from "./actions";

export const metadata: Metadata = {
  title: "Account e privacy",
  robots: privateNoIndexRobots,
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const supabase = await createClient();

  const [{ data: authData }, { data: legalData }, { data: lifecycleData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("lr5_current_legal_acceptance_state"),
    supabase.rpc("lr5_account_lifecycle_state"),
  ]);

  const legal = (legalData ?? {}) as {
    accepted?: boolean;
    privacy_notice_version?: string;
    terms_version?: string;
    accepted_at?: string | null;
  };
  const lifecycle = (lifecycleData ?? {}) as {
    status?: string | null;
    requested_at?: string | null;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="app-kicker">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1d2824]">
          Account e privacy
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
          Controlla le evidenze legali del tuo accesso, esporta i dati account e gestisci la
          chiusura del profilo personale senza confonderla con i dati aziendali del workspace.
        </p>
      </header>

      {params.error ? (
        <div role="alert" className="rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]">
          {params.error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#1d2824]">Identità account</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-[#f7f9f8] p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b8782]">Email</dt>
            <dd className="mt-1 font-medium text-[#1d2824]">{authData.user?.email ?? "—"}</dd>
          </div>
          <div className="rounded-xl bg-[#f7f9f8] p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b8782]">Azienda</dt>
            <dd className="mt-1 font-medium text-[#1d2824]">{context.organizationName}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#1d2824]">Privacy e Termini</h2>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          Privacy acknowledgement e accettazione dei Termini sono registrate come eventi distinti
          e versionati. L’acknowledgement privacy non viene trattato come consenso.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e2e7e4] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b8782]">Informativa privacy</p>
            <p className="mt-1 text-sm font-semibold text-[#173f35]">
              {legal.accepted ? "Confermata" : "Da confermare"}
            </p>
            <p className="mt-1 text-xs text-[#66736e]">{legal.privacy_notice_version ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[#e2e7e4] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b8782]">Termini d’uso</p>
            <p className="mt-1 text-sm font-semibold text-[#173f35]">
              {legal.accepted ? "Accettati" : "Da accettare"}
            </p>
            <p className="mt-1 text-xs text-[#66736e]">{legal.terms_version ?? "—"}</p>
          </div>
        </div>
        {legal.accepted_at ? (
          <p className="mt-3 text-xs text-[#7b8782]">
            Ultima evidenza corrente: {new Date(legal.accepted_at).toLocaleString("it-IT")}.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#1d2824]">Esporta i dati del tuo account</h2>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          Il file JSON include identità account, membership, registrazioni, preferenze Network ed
          evidenze legali. La Commercial Memory appartiene al perimetro dell’azienda e non viene
          esportata come dato personale del singolo utente.
        </p>
        <a
          href="/api/account/export"
          className="app-secondary mt-4 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
        >
          Scarica export JSON
        </a>
      </section>

      <section className="rounded-2xl border border-[#efc5bd] bg-[#fff9f7] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#8f3027]">Chiusura account e richiesta di cancellazione</h2>
        <p className="mt-2 text-sm leading-6 text-[#6b4b45]">
          Se la richiesta è ammissibile, l’accesso al workspace viene sospeso subito e la richiesta
          di cancellazione entra nel processo di retention. I dati aziendali, gli audit e gli
          elementi che devono essere conservati per obblighi o tutela di diritti non vengono
          cancellati automaticamente.
        </p>
        {lifecycle.status ? (
          <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-[#6b4b45]">
            Stato più recente: <strong>{lifecycle.status}</strong>
            {lifecycle.requested_at
              ? " · " + new Date(lifecycle.requested_at).toLocaleString("it-IT")
              : ""}
          </p>
        ) : null}

        <form action={requestAccountErasure} className="mt-5 space-y-3">
          <label className="block text-sm font-semibold text-[#6b4b45]">
            Per confermare scrivi CANCELLA ACCOUNT
            <input
              name="confirmation"
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-xl border border-[#dfb8b0] bg-white px-3 text-sm outline-none focus:border-[#b85d50] focus:ring-4 focus:ring-[#f7e4df]"
              required
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Chiusura in corso…"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#9f2f24] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Chiudi account e richiedi cancellazione
          </PendingSubmitButton>
        </form>
      </section>
    </div>
  );
}
