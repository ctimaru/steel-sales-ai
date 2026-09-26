import Link from "next/link";

import { getRegistrationQueue } from "@/lib/platform-admin";

export default async function PlatformHomePage() {
  const queue = await getRegistrationQueue();
  const counts = queue.applications.reduce<Record<string, number>>((acc, application) => {
    acc[application.application_status] = (acc[application.application_status] ?? 0) + 1;
    return acc;
  }, {});

  const needsAttention =
    (counts.pending_review ?? 0) +
    (counts.needs_information ?? 0) +
    (counts.approved ?? 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl bg-[#0b171e] p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8fb7c1]">Platform Control Plane</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Governance della piattaforma</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8fa1a9]">
          Questo contesto gestisce registrazioni, activation e governance globale. La Commercial Memory dei tenant resta nel rispettivo Company Workspace.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Da revisionare", counts.pending_review ?? 0],
          ["In attesa dati", counts.needs_information ?? 0],
          ["Approvate da attivare", counts.approved ?? 0],
          ["Tenant attivati", counts.activated ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#d9e0e4] bg-white p-5">
            <p className="metric-number text-3xl font-semibold text-[#17232d]">{Number(value)}</p>
            <p className="mt-1 text-xs font-semibold text-[#66737d]">{label}</p>
          </div>
        ))}
      </section>

      {needsAttention > 0 ? (
        <Link
          href="/platform/registrations"
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Richiede attenzione</p>
            <p className="mt-1 text-lg font-semibold text-amber-950">{needsAttention} registration da gestire</p>
            <p className="mt-1 text-sm text-amber-800">Review, richiesta informazioni o activation.</p>
          </div>
          <span className="text-sm font-semibold text-amber-900">Apri registrazioni →</span>
        </Link>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/platform/registrations"
          className="rounded-2xl border border-[#d9e0e4] bg-white p-6 transition hover:border-[#8fb7c1] hover:shadow-sm"
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#28677a]">Companies</p>
          <h2 className="mt-3 text-lg font-semibold text-[#17232d]">Registrazioni aziende</h2>
          <p className="mt-2 text-sm leading-6 text-[#66737d]">
            Revisiona identity, approva, attiva il tenant e completa il Registration Bridge verso il Network.
          </p>
        </Link>

        <Link
          href="/platform/company-discovery"
          className="rounded-2xl border border-[#d9e0e4] bg-white p-6 transition hover:border-[#8fb7c1] hover:shadow-sm"
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#28677a]">Network population</p>
          <h2 className="mt-3 text-lg font-semibold text-[#17232d]">Company Discovery</h2>
          <p className="mt-2 text-sm leading-6 text-[#66737d]">
            Avvia crawl di siti pubblici, revisiona classificazione ed evidenze, gestisci duplicati e promuovi profili claimable nel Network.
          </p>
        </Link>
      </section>
    </div>
  );
}
