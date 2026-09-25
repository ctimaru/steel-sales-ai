import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  removeSavedNetworkCompany,
  requestNetworkClaim,
  saveNetworkCompany,
} from "@/app/(workspace)/network/actions";
import { getNetworkProfile } from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { createClient } from "@/lib/supabase/server";

function badge(value: string) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
      {value}
    </span>
  );
}

export default async function NetworkCompanyProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");
  const { id } = await params;
  const { error, message } = await searchParams;
  const profile = await getNetworkProfile(id);
  if (!profile) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  let organizationId: string | null = null;
  let adminOrganizationId: string | null = null;
  let isSaved = false;

  if (userId) {
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("organization_id,is_default,role,status")
      .eq("user_id", userId)
      .eq("status", "active");

    const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
    organizationId = membership?.organization_id ?? null;

    const adminMembership =
      memberships?.find((row) => row.is_default && row.role === "admin") ??
      memberships?.find((row) => row.role === "admin");
    adminOrganizationId = adminMembership?.organization_id ?? null;

    if (organizationId) {
      const { data: saved } = await supabase
        .from("network_saved_companies")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("network_company_id", profile.company.id)
        .maybeSingle();

      isSaved = Boolean(saved);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
        ← Torna alla directory
      </Link>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Network company profile</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{profile.company.legal_name}</h1>
            {profile.company.trading_name ? <p className="mt-2 text-base text-slate-500">{profile.company.trading_name}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {badge(profile.company.country_code)}
              {badge("Claim: " + profile.company.claimed_status)}
              {badge("Verification: " + profile.company.verification_status)}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {profile.company.website_url ? (
              <a
                href={profile.company.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              >
                Sito aziendale
              </a>
            ) : null}

            {organizationId ? (
              <form action={isSaved ? removeSavedNetworkCompany : saveNetworkCompany}>
                <input type="hidden" name="network_company_id" value={profile.company.id} />
                <button className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                  {isSaved ? "Rimuovi dai salvati" : "Salva azienda"}
                </button>
              </form>
            ) : null}

            {profile.company.claimed_status === "unclaimed" && adminOrganizationId ? (
              <form action={requestNetworkClaim}>
                <input type="hidden" name="network_company_id" value={profile.company.id} />
                <input type="hidden" name="organization_id" value={adminOrganizationId} />
                <button className="h-10 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
                  Richiedi gestione profilo
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {profile.company.description ? (
          <p className="mt-6 max-w-4xl text-sm leading-7 text-slate-600">{profile.company.description}</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-950">Posizionamento industriale</h2>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Ruoli</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.roles.length ? profile.roles.map((role) => (
                  <span key={role.key} className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                    {role.name}{role.is_primary ? " · primary" : ""}
                  </span>
                )) : <span className="text-sm text-slate-400">Nessun ruolo pubblicato.</span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Prodotti</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.products.length ? profile.products.map((item) => (
                  <span key={item.key + item.relationship_type + String(item.facility_id)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
                    {item.name} · {item.relationship_type}
                  </span>
                )) : <span className="text-sm text-slate-400">Nessun prodotto pubblicato.</span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Mercati</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.markets.length ? profile.markets.map((item) => (
                  <span key={item.key} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">{item.name}</span>
                )) : <span className="text-sm text-slate-400">Nessun mercato pubblicato.</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Contatti pubblici</h2>
          <div className="mt-4 space-y-4">
            {profile.contacts.length ? profile.contacts.map((contact) => (
              <div key={contact.id} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="text-sm font-semibold text-slate-800">{contact.display_name ?? contact.contact_type}</p>
                {contact.email ? <p className="mt-1 break-all text-xs text-slate-500">{contact.email}</p> : null}
                {contact.phone ? <p className="mt-1 text-xs text-slate-500">{contact.phone}</p> : null}
              </div>
            )) : <p className="text-sm text-slate-400">Nessun contatto pubblico.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Facilities & capability</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {profile.facilities.length ? profile.facilities.map((facility) => (
            <div key={facility.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{facility.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[facility.city, facility.region, facility.country_code].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {badge(facility.verification_status)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {facility.capabilities.map((capability) => (
                  <span key={capability.key} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {capability.name}
                  </span>
                ))}
              </div>
            </div>
          )) : <p className="text-sm text-slate-400">Nessuna facility pubblicata.</p>}
        </div>
      </section>
    </div>
  );
}
