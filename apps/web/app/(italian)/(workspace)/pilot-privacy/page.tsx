import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withdrawPilotAnalytics } from "./actions";

export const dynamic = "force-dynamic";

type MyPilotPrivacy = {
  live_gate: "NO-GO";
  organizations: Array<{
    organization_id: string;
    organization_name: string;
    decision: "granted" | "denied" | null;
    notice_version: string | null;
    decided_at: string | null;
  }>;
};

export default async function PilotPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) redirect("/login");
  const { data, error } = await client.rpc("prod_next1e_my_privacy");
  const state: MyPilotPrivacy | null =
    !error && data?.live_gate === "NO-GO" && Array.isArray(data.organizations)
      ? (data as MyPilotPrivacy) : null;
  const { result } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:py-10">
      <section className="rounded-3xl border border-[#d8e7dc] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1d624d]">PROD-NEXT1.E1 · Privacy</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#173c32]">Preferenze analytics del pilot</h1>
        <p className="mt-3 text-sm leading-6 text-[#52625b]">
          Le statistiche di attivazione delle trattative non sono attive. Il consenso ai cookie
          del sito è distinto da un eventuale consenso per il pilot. Nessuna preferenza qui
          equivale all&apos;accettazione dei termini commerciali.
        </p>
        <span role="status" className="mt-4 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
          Pilot NO-GO · nessuna raccolta live
        </span>
      </section>
      {result === "updated" ? (
        <p role="status" className="rounded-xl bg-[#e6f3ea] p-3 text-sm text-[#185241]">Preferenza analytics negata o revocata.</p>
      ) : null}
      {result === "blocked" || result === "invalid" ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Preferenza non aggiornata: impossibile confermare il diritto di accesso a questa azienda.
        </p>
      ) : null}
      {state === null ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Non è possibile leggere le preferenze. Nessuna raccolta è autorizzata.
        </p>
      ) : state.organizations.length === 0 ? (
        <p className="rounded-xl border border-[#d8e7dc] bg-white p-4 text-sm text-[#52625b]">
          Nessuna azienda attiva associata al tuo account per il pilot.
        </p>
      ) : (
        <section className="space-y-3" aria-label="Preferenze per azienda">
          {state.organizations.map((org) => (
            <article key={org.organization_id} className="rounded-2xl border border-[#d8e7dc] bg-white p-5">
              <h2 className="font-semibold text-[#173c32]">{org.organization_name}</h2>
              <p className="mt-1 text-sm text-[#52625b]">
                Analytics del pilot: {org.decision === "denied" ? "non autorizzate" :
                  org.decision === "granted" ? "consenso registrato (raccolta sospesa)" : "nessuna scelta registrata"}
              </p>
              <form action={withdrawPilotAnalytics} className="mt-3">
                <input type="hidden" name="organization_id" value={org.organization_id} />
                <button className="min-h-11 rounded-xl border border-[#cbded3] bg-[#f4f8f5] px-4 text-sm font-semibold text-[#1a5144]">
                  Nega / revoca analytics
                </button>
              </form>
            </article>
          ))}
        </section>
      )}
      <p className="text-xs leading-5 text-[#65756d]">
        L&apos;eventuale richiesta futura di consenso richiederà informativa finale e un nuovo
        atto positivo, distinto dalla revoca. Non è disponibile durante il pre-lancio.
      </p>
      <Link href="/dashboard" className="inline-flex text-sm font-semibold text-[#175640] underline underline-offset-4">Torna alla dashboard</Link>
    </main>
  );
}
