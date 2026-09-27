import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  followNetworkCompany,
  removeSavedNetworkCompany,
  requestNetworkClaim,
  saveNetworkCompany,
  unfollowNetworkCompany,
} from "@/app/(workspace)/network/actions";
import { PilotEvent } from "@/components/pilot-event";
import { canInteractWithNetwork } from "@/lib/access-policy";
import { getMyCompanyClaim, type CompanyClaimState } from "@/lib/company-claims";
import {
  getInquiryEligibility,
  getNetworkFollowState,
  getNetworkProfile,
  type PublicProfileProvenanceKind,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { createClient } from "@/lib/supabase/server";

const relationshipLabels: Record<string, string> = {
  produces: "Produce",
  distributes: "Distribuisce",
  stocks: "Tiene a stock",
  processes: "Lavora / trasforma",
  uses: "Utilizza",
};

function provenanceLabel(kind: PublicProfileProvenanceKind) {
  if (kind === "platform_verified") return "Verificato dalla piattaforma";
  if (kind === "company_declared") return "Dichiarato dall'azienda";
  if (kind === "public_web") return "Da fonte pubblica";
  return "Curato dalla piattaforma";
}

function provenanceClass(kind: PublicProfileProvenanceKind) {
  if (kind === "platform_verified") return "bg-emerald-50 text-emerald-700";
  if (kind === "company_declared") return "bg-[#eef5ff] text-[#2f6fed]";
  if (kind === "public_web") return "bg-[#f2f5f8] text-[#65758a]";
  return "bg-violet-50 text-violet-700";
}

function ProvenanceBadge({ kind }: { kind: PublicProfileProvenanceKind }) {
  return (
    <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + provenanceClass(kind)}>
      {provenanceLabel(kind)}
    </span>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const verified = status === "verified";
  return (
    <span
      className={
        "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
        (verified ? "bg-emerald-50 text-emerald-700" : "bg-[#f2f5f8] text-[#66768d]")
      }
    >
      {verified ? "Verificato" : "Non verificato"}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f6fed]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f7f93]">{description}</p> : null}
    </div>
  );
}

function CompanyMonogram({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#dce7f5] bg-[#f3f7ff] text-xl font-bold text-[#2f6fed] sm:h-20 sm:w-20">
      {initials || "SS"}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value + "T00:00:00"));
}

function validityLabel(state: "valid" | "expired" | "not_yet_valid" | "unknown") {
  if (state === "valid") return "In validità";
  if (state === "expired") return "Scaduta";
  if (state === "not_yet_valid") return "Non ancora valida";
  return "Validità non indicata";
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
  let canInteract = false;
  let isSaved = false;
  let inquiryEligible = false;
  let isFollowed = false;
  let claimState: CompanyClaimState | null = null;

  if (userId) {
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("organization_id,is_default,role,status")
      .eq("user_id", userId)
      .eq("status", "active");

    const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
    organizationId = membership?.organization_id ?? null;
    canInteract = membership ? canInteractWithNetwork(membership.role) : false;

    const adminMembership =
      memberships?.find((row) => row.is_default && row.role === "admin") ??
      memberships?.find((row) => row.role === "admin");
    adminOrganizationId = adminMembership?.organization_id ?? null;

    if (adminOrganizationId) {
      claimState = await getMyCompanyClaim(profile.company.id, adminOrganizationId);
    }

    if (organizationId) {
      const { data: saved } = await supabase
        .from("network_saved_companies")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("network_company_id", profile.company.id)
        .maybeSingle();

      isSaved = Boolean(saved);

      const [eligibility, followState] = await Promise.all([
        getInquiryEligibility(organizationId, profile.company.id),
        getNetworkFollowState(organizationId, profile.company.id),
      ]);

      inquiryEligible = eligibility.eligible;
      isFollowed = followState.followed;
    }
  }

  const displayName = profile.company.trading_name || profile.company.legal_name;
  const primaryRole = profile.roles.find((role) => role.is_primary);
  const verifiedAssetCount =
    profile.trust.verified_facilities +
    profile.trust.verified_capabilities +
    profile.trust.verified_certifications;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <PilotEvent
        eventName="network_profile_viewed"
        entityType="network_company"
        entityId={profile.company.id}
        metadata={{ surface: "network_company_profile" }}
      />

      <Link href="/network" className="text-sm font-semibold text-[#68788e] hover:text-[#2f6fed]">
        ← Torna alla directory
      </Link>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-[#dfe7f1] bg-white shadow-sm">
        <div className="border-b border-[#e8eef6] bg-gradient-to-r from-[#f8fbff] to-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4 sm:gap-5">
              <CompanyMonogram name={displayName} />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6fed]">
                  Steel Industry Network
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
                  {displayName}
                </h1>
                {profile.company.trading_name ? (
                  <p className="mt-1 text-sm text-[#78879a]">{profile.company.legal_name}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#dbe5f1] bg-white px-3 py-1 text-xs font-semibold text-[#52637a]">
                    {profile.company.country_code}
                  </span>
                  {primaryRole ? (
                    <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#2f6fed]">
                      {primaryRole.name}
                    </span>
                  ) : null}
                  {profile.trust.claimed ? (
                    <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#2f6fed]">
                      Profilo rivendicato
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-xs font-semibold text-[#6b798c]">
                      Profilo non rivendicato
                    </span>
                  )}
                  {profile.trust.verified ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Azienda verificata
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-xs font-semibold text-[#6b798c]">
                      Azienda non verificata
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-52">
              {profile.company.website_url ? (
                <a
                  href={profile.company.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#dbe5f1] bg-white px-4 text-sm font-semibold text-[#40516a] transition hover:border-[#bcd0ed] hover:bg-[#f7faff] hover:text-[#2f6fed]"
                >
                  Visita il sito
                </a>
              ) : null}

              {organizationId && canInteract ? (
                <form action={isSaved ? removeSavedNetworkCompany : saveNetworkCompany}>
                  <input type="hidden" name="network_company_id" value={profile.company.id} />
                  <button className="h-10 w-full rounded-xl border border-[#dbe5f1] bg-white px-4 text-sm font-semibold text-[#40516a] transition hover:border-[#bcd0ed] hover:bg-[#f7faff] hover:text-[#2f6fed]">
                    {isSaved ? "Rimuovi dai salvati" : "Salva azienda"}
                  </button>
                </form>
              ) : null}

              {organizationId && canInteract ? (
                <form action={isFollowed ? unfollowNetworkCompany : followNetworkCompany}>
                  <input type="hidden" name="network_company_id" value={profile.company.id} />
                  <button className="h-10 w-full rounded-xl border border-[#cbdcf7] bg-[#eef5ff] px-4 text-sm font-semibold text-[#2f6fed] transition hover:bg-[#e5efff]">
                    {isFollowed ? "Non seguire più" : "Segui azienda"}
                  </button>
                </form>
              ) : null}

              {inquiryEligible && canInteract ? (
                <Link
                  href={"/network/" + profile.company.id + "/inquiry"}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white transition hover:bg-[#245ed1]"
                >
                  Invia inquiry
                </Link>
              ) : null}
            </div>
          </div>

          {profile.company.description ? (
            <p className="mt-6 max-w-4xl text-sm leading-7 text-[#56677d]">
              {profile.company.description}
            </p>
          ) : (
            <p className="mt-6 text-sm text-[#91a0b2]">
              Descrizione aziendale non ancora disponibile.
            </p>
          )}

          <div className="mt-5">
            <ProvenanceBadge kind={profile.company.provenance_kind} />
          </div>
        </div>

        <div className="grid gap-px bg-[#e8eef6] sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Profilo</p>
            <p className="mt-2 text-2xl font-semibold text-[#1e2b45]">{profile.completeness.percentage}%</p>
            <p className="mt-1 text-xs text-[#718197]">
              completezza dati · {profile.completeness.passed_sections}/{profile.completeness.total_sections} sezioni
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Ownership</p>
            <p className="mt-2 text-base font-semibold text-[#1e2b45]">
              {profile.trust.claimed ? "Gestito dall'azienda" : "Non rivendicato"}
            </p>
            <p className="mt-1 text-xs text-[#718197]">Claim e verifica sono stati separati.</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Verification</p>
            <p className="mt-2 text-base font-semibold text-[#1e2b45]">
              {profile.trust.verified ? "Company verified" : "Non verificata"}
            </p>
            <p className="mt-1 text-xs text-[#718197]">
              {verifiedAssetCount} elementi strutturati verificati
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Industrial footprint</p>
            <p className="mt-2 text-base font-semibold text-[#1e2b45]">{profile.facilities.length} sedi pubblicate</p>
            <p className="mt-1 text-xs text-[#718197]">
              {profile.facilities.reduce((count, facility) => count + facility.capabilities.length, 0)} capability
            </p>
          </div>
        </div>
      </section>

      {claimState && ["requested", "under_review"].includes(claimState.status) ? (
        <section className="rounded-2xl border border-[#d7e5ff] bg-[#eef5ff] p-4 text-sm text-[#40516a]">
          <p className="font-semibold text-[#1e2b45]">Claim in verifica</p>
          <p className="mt-1">
            {claimState.proof_status === "verified"
              ? "Ownership verificata · in attesa approvazione Superadmin."
              : claimState.proof_status === "rejected"
                ? "Ownership proof rifiutata · serve revisione."
                : "Ownership da verificare · controllo Superadmin richiesto."}
          </p>
        </section>
      ) : null}

      {claimState?.status === "approved" ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#d7e5ff] bg-[#f6f9ff] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#1e2b45]">Questo profilo è gestito dalla tua organizzazione</p>
            <p className="mt-1 text-sm text-[#6e7e92]">Aggiorna prodotti, sedi, capability, mercati e certificazioni dal Company Profile Manager.</p>
          </div>
          <Link href="/network/manage" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245ed1]">
            Gestisci profilo
          </Link>
        </section>
      ) : null}

      {["unclaimed", "revoked"].includes(profile.company.claimed_status) &&
      adminOrganizationId &&
      (!claimState || ["rejected", "revoked"].includes(claimState.status)) ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#1e2b45]">Rappresenti questa azienda?</p>
            <p className="mt-1 text-sm text-[#6e7e92]">Rivendica il profilo per gestire direttamente i dati industriali pubblicati.</p>
          </div>
          <form action={requestNetworkClaim}>
            <input type="hidden" name="network_company_id" value={profile.company.id} />
            <input type="hidden" name="organization_id" value={adminOrganizationId} />
            <button className="h-10 rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245ed1]">
              Rivendica profilo
            </button>
          </form>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Industrial positioning"
              title="Ruolo nella filiera"
              description="Ruoli e specializzazioni descrivono come l'azienda opera all'interno del mercato siderurgico."
            />

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Ruoli</p>
                <div className="mt-3 space-y-2">
                  {profile.roles.length ? (
                    profile.roles.map((role) => (
                      <div key={role.key} className="rounded-2xl border border-[#e4eaf2] bg-[#fbfcfe] p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#34445c]">
                            {role.name}{role.is_primary ? " · principale" : ""}
                          </p>
                          <ProvenanceBadge kind={role.provenance_kind} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#91a0b2]">Nessun ruolo pubblicato.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Specializzazioni</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.subtypes.length ? (
                    profile.subtypes.map((subtype) => (
                      <div key={subtype.key} className="rounded-xl border border-[#e4eaf2] bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-[#4a5b72]">{subtype.name}</p>
                        <div className="mt-1.5"><ProvenanceBadge kind={subtype.provenance_kind} /></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#91a0b2]">Nessuna specializzazione pubblicata.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Products"
              title="Prodotti e disponibilità industriale"
              description="Le relazioni prodotto distinguono ciò che l'azienda produce, distribuisce, tiene a stock, trasforma o utilizza."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {profile.products.length ? (
                profile.products.map((product, index) => {
                  const facility = profile.facilities.find((item) => item.id === product.facility_id);
                  return (
                    <article key={product.key + product.relationship_type + String(product.facility_id) + index} className="rounded-2xl border border-[#e1e8f2] bg-[#fbfcfe] p-4">
                      <p className="font-semibold text-[#2f4059]">{product.name}</p>
                      <p className="mt-1 text-sm text-[#67778d]">
                        {relationshipLabels[product.relationship_type] || product.relationship_type}
                        {facility ? " · " + facility.name : ""}
                      </p>
                      <div className="mt-3"><ProvenanceBadge kind={product.provenance_kind} /></div>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-[#91a0b2]">Nessun prodotto pubblicato.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Industrial footprint"
              title="Sedi e capability"
              description="Stabilimenti, magazzini e service center mostrano dove opera l'azienda e quali capacità industriali dichiara o ha verificato."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {profile.facilities.length ? (
                profile.facilities.map((facility) => (
                  <article key={facility.id} className="rounded-2xl border border-[#dfe7f1] bg-[#fbfcfe] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#2d3f58]">{facility.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-[#8998aa]">{facility.facility_type}</p>
                      </div>
                      <VerificationBadge status={facility.verification_status} />
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[#65758a]">
                      {[
                        facility.address_line_1,
                        facility.postal_code,
                        facility.city,
                        facility.region,
                        facility.country_code,
                      ].filter(Boolean).join(" · ") || "Localizzazione non pubblicata"}
                    </p>

                    <div className="mt-3"><ProvenanceBadge kind={facility.provenance_kind} /></div>

                    <div className="mt-5 border-t border-[#e6edf6] pt-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Capability</p>
                      <div className="mt-3 space-y-2">
                        {facility.capabilities.length ? (
                          facility.capabilities.map((capability) => (
                            <div key={capability.key} className="rounded-xl border border-[#e5ebf3] bg-white px-3 py-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-[#475970]">{capability.name}</p>
                                <VerificationBadge status={capability.verification_status} />
                              </div>
                              <div className="mt-2"><ProvenanceBadge kind={capability.provenance_kind} /></div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[#91a0b2]">Nessuna capability pubblicata.</p>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-sm text-[#91a0b2]">Nessuna sede pubblicata.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Markets"
              title="Mercati serviti"
              description="Settori applicativi e mercati nei quali l'azienda dichiara di operare."
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.markets.length ? (
                profile.markets.map((market) => (
                  <div key={market.key} className="rounded-2xl border border-[#e1e8f2] bg-[#fbfcfe] px-3.5 py-2.5">
                    <p className="text-sm font-semibold text-[#40516a]">{market.name}</p>
                    <div className="mt-1.5"><ProvenanceBadge kind={market.provenance_kind} /></div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#91a0b2]">Nessun mercato pubblicato.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Trust"
              title="Certificazioni"
              description="La piattaforma distingue sempre tra certificazioni dichiarate e certificazioni verificate."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {profile.certifications.length ? (
                profile.certifications.map((certification) => {
                  const facility = profile.facilities.find((item) => item.id === certification.facility_id);
                  return (
                    <article key={certification.id} className="rounded-2xl border border-[#dfe7f1] bg-[#fbfcfe] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#2d3f58]">{certification.certification_type_name}</p>
                          {certification.certificate_identifier ? (
                            <p className="mt-1 text-sm text-[#66778c]">{certification.certificate_identifier}</p>
                          ) : null}
                        </div>
                        <VerificationBadge status={certification.verification_status} />
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-[#66778c]">
                        {certification.issuer ? <p><span className="font-semibold text-[#45566e]">Ente:</span> {certification.issuer}</p> : null}
                        {facility ? <p><span className="font-semibold text-[#45566e]">Sede:</span> {facility.name}</p> : null}
                        {certification.scope_text ? <p><span className="font-semibold text-[#45566e]">Scope:</span> {certification.scope_text}</p> : null}
                        <p>
                          <span className="font-semibold text-[#45566e]">Validità:</span>{" "}
                          {validityLabel(certification.validity_state)}
                          {certification.valid_from || certification.valid_to
                            ? " · " + [formatDate(certification.valid_from), formatDate(certification.valid_to)].filter(Boolean).join(" → ")
                            : ""}
                        </p>
                      </div>

                      <div className="mt-4"><ProvenanceBadge kind={certification.provenance_kind} /></div>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-[#91a0b2]">Nessuna certificazione pubblicata.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Stato del profilo</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e6edf6]">
              <div
                className="h-full rounded-full bg-[#2f6fed]"
                style={{ width: Math.max(4, profile.completeness.percentage) + "%" }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#34445c]">
              {profile.completeness.percentage}% dei dati industriali principali presenti
            </p>
            <p className="mt-1 text-xs leading-5 text-[#7a899d]">
              La completezza indica solo la presenza delle sezioni del profilo; non è un rating dell'azienda.
            </p>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Contatti pubblici</p>
            <div className="mt-4 space-y-4">
              {profile.contacts.length ? (
                profile.contacts.map((contact) => (
                  <div key={contact.id} className="border-b border-[#edf1f6] pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold text-[#34445c]">
                      {contact.display_name ?? contact.contact_type}
                    </p>
                    {contact.email ? <p className="mt-1 break-all text-xs text-[#68788e]">{contact.email}</p> : null}
                    {contact.phone ? <p className="mt-1 text-xs text-[#68788e]">{contact.phone}</p> : null}
                    {contact.website_url ? (
                      <a href={contact.website_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-[#2f6fed]">
                        Apri riferimento ↗
                      </a>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#8b99aa]">
                  Nessun contatto pubblico. Usa l'inquiry governata quando disponibile.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#d7e5ff] bg-[#f6f9ff] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">Network trust</p>
            <p className="mt-2 text-sm font-semibold text-[#34445c]">
              Claim e verifica sono segnali distinti
            </p>
            <p className="mt-2 text-xs leading-5 text-[#718197]">
              Un profilo rivendicato indica chi lo gestisce. La verifica indica invece controlli eseguiti dalla piattaforma su azienda o singoli elementi.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
