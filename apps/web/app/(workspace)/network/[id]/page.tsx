import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  followNetworkCompany,
  removeSavedNetworkCompany,
  saveNetworkCompany,
  unfollowNetworkCompany,
} from "@/app/(workspace)/network/actions";
import { PilotEvent } from "@/components/pilot-event";
import { canInteractWithNetwork } from "@/lib/access-policy";
import { getMyCompanyClaim, type CompanyClaimState } from "@/lib/company-claims";
import {
  getInquiryEligibility,
  getNetworkCompanyLogoUrl,
  getNetworkFollowState,
  getNetworkProfile,
  type PublicProductTechnicalScope,
  type PublicProfileProvenanceKind,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { requireNetworkAccess } from "@/lib/network-access";
import { createClient } from "@/lib/supabase/server";

const relationshipLabels: Record<string, string> = {
  produces: "Produce",
  distributes: "Distribuisce",
  stocks: "Tiene a stock",
  processes: "Lavora / trasforma",
  uses: "Utilizza",
};

const technicalDimensionLabels: Record<string, string> = {
  outer_diameter: "Ø esterno",
  width: "Larghezza",
  height: "Altezza",
  wall_thickness: "Spessore",
  length: "Lunghezza",
};

function provenanceLabel(kind: PublicProfileProvenanceKind) {
  if (kind === "platform_verified") return "Verificato dalla piattaforma";
  if (kind === "company_declared") return "Dichiarato dall'azienda";
  if (kind === "public_web") return "Da fonte pubblica";
  return "Curato dalla piattaforma";
}

function provenanceClass(kind: PublicProfileProvenanceKind) {
  if (kind === "platform_verified") return "bg-emerald-50 text-emerald-700";
  if (kind === "company_declared") return "bg-[#edf5f2] text-[#1a5144]";
  if (kind === "public_web") return "bg-[#ecefed] text-[#65758a]";
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
        (verified ? "bg-emerald-50 text-emerald-700" : "bg-[#ecefed] text-[#66736e]")
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
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1a5144]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">{title}</h2>
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
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#dce7f5] bg-[#f0f4f2] text-xl font-bold text-[#1a5144] sm:h-20 sm:w-20">
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


function uniqueBy<T>(items: T[], keyFor: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function NetworkCompanyProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");
  await requireNetworkAccess();

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

    adminOrganizationId =
      membership?.role === "admin" ? membership.organization_id : null;

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
  const logoUrl = getNetworkCompanyLogoUrl(
    profile.company.logo_path,
    profile.company.logo_updated_at,
  );
  const primaryRole = profile.roles.find((role) => role.is_primary);
  const verifiedAssetCount =
    profile.trust.verified_facilities +
    profile.trust.verified_capabilities +
    profile.trust.verified_certifications;

  const productGroupMap = new Map<
    string,
    {
      key: string;
      name: string;
      facility_id: string | null;
      relationships: string[];
      provenanceKinds: PublicProfileProvenanceKind[];
      technical_scope: PublicProductTechnicalScope;
    }
  >();

  for (const product of profile.products) {
    const groupKey = product.key + "|" + (product.facility_id ?? "");
    const existing = productGroupMap.get(groupKey);
    if (!existing) {
      productGroupMap.set(groupKey, {
        key: product.key,
        name: product.name,
        facility_id: product.facility_id,
        relationships: [product.relationship_type],
        provenanceKinds: [product.provenance_kind],
        technical_scope: {
          standards: [...product.technical_scope.standards],
          grades: [...product.technical_scope.grades],
          dimensions: [...product.technical_scope.dimensions],
        },
      });
      continue;
    }

    existing.relationships = uniqueBy(
      [...existing.relationships, product.relationship_type],
      (item) => item,
    );
    existing.provenanceKinds = uniqueBy(
      [...existing.provenanceKinds, product.provenance_kind],
      (item) => item,
    );
    existing.technical_scope = {
      standards: uniqueBy(
        [...existing.technical_scope.standards, ...product.technical_scope.standards],
        (item) => item.standard_id,
      ),
      grades: uniqueBy(
        [...existing.technical_scope.grades, ...product.technical_scope.grades],
        (item) => item.standard_id + "|" + item.material_grade_id,
      ),
      dimensions: uniqueBy(
        [...existing.technical_scope.dimensions, ...product.technical_scope.dimensions],
        (item) => item.dimension_type,
      ),
    };
  }

  const productGroups = Array.from(productGroupMap.values());
  const technicalStandards = uniqueBy(
    productGroups.flatMap((product) => product.technical_scope.standards),
    (item) => item.standard_id,
  );
  const technicalGrades = uniqueBy(
    productGroups.flatMap((product) => product.technical_scope.grades),
    (item) => item.standard_id + "|" + item.material_grade_id,
  );
  const capabilities = uniqueBy(
    profile.facilities.flatMap((facility) => facility.capabilities),
    (item) => item.key,
  );
  const locationLabels = uniqueBy(
    profile.facilities
      .map((facility) => [facility.city, facility.country_code].filter(Boolean).join(", "))
      .filter(Boolean),
    (item) => item,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <PilotEvent
        eventName="network_profile_viewed"
        entityType="network_company"
        entityId={profile.company.id}
        metadata={{ surface: "network_company_profile" }}
      />

      <Link href="/network" className="text-sm font-semibold text-[#66736e] hover:text-[#1a5144]">
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
        <div className="border-b border-[#e8eef6] bg-gradient-to-r from-[#f6f8f7] to-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4 sm:gap-5">
              {logoUrl ? (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#dce7f5] bg-white p-2 sm:h-20 sm:w-20">
                  <img
                    src={logoUrl}
                    alt={"Logo " + displayName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <CompanyMonogram name={displayName} />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">
                  Steel Industry Network
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
                  {displayName}
                </h1>
                {profile.company.trading_name ? (
                  <p className="mt-1 text-sm text-[#78879a]">{profile.company.legal_name}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#d7dfdb] bg-white px-3 py-1 text-xs font-semibold text-[#52637a]">
                    {profile.company.country_code}
                  </span>
                  {primaryRole ? (
                    <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-xs font-semibold text-[#1a5144]">
                      {primaryRole.name}
                    </span>
                  ) : null}
                  {profile.trust.claimed ? (
                    <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-xs font-semibold text-[#1a5144]">
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
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#43524c] transition hover:border-[#bcd0ed] hover:bg-[#f7faff] hover:text-[#1a5144]"
                >
                  Visita il sito
                </a>
              ) : null}

              {organizationId && canInteract ? (
                <form action={isSaved ? removeSavedNetworkCompany : saveNetworkCompany}>
                  <input type="hidden" name="network_company_id" value={profile.company.id} />
                  <button className="h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#43524c] transition hover:border-[#bcd0ed] hover:bg-[#f7faff] hover:text-[#1a5144]">
                    {isSaved ? "Rimuovi dai salvati" : "Salva azienda"}
                  </button>
                </form>
              ) : null}

              {organizationId && canInteract ? (
                <form action={isFollowed ? unfollowNetworkCompany : followNetworkCompany}>
                  <input type="hidden" name="network_company_id" value={profile.company.id} />
                  <button className="h-10 w-full rounded-xl border border-[#cbdcf7] bg-[#edf5f2] px-4 text-sm font-semibold text-[#1a5144] transition hover:bg-[#e5efff]">
                    {isFollowed ? "Non seguire più" : "Segui aggiornamenti"}
                  </button>
                </form>
              ) : null}

              {inquiryEligible && canInteract ? (
                <Link
                  href={"/network/" + profile.company.id + "/inquiry"}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white transition hover:bg-[#226657]"
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
            <p className="mt-6 text-sm text-[#87938e]">
              Descrizione aziendale non ancora disponibile.
            </p>
          )}

          <div className="mt-5">
            <ProvenanceBadge kind={profile.company.provenance_kind} />
          </div>
        </div>

        <div className="grid gap-px bg-[#e8eef6] sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Prodotti</p>
            <p className="mt-2 text-2xl font-semibold text-[#1d2824]">{productGroups.length}</p>
            <p className="mt-1 text-xs text-[#718197]">
              famiglie · {profile.products.length} relazioni commerciali
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Technical scope</p>
            <p className="mt-2 text-base font-semibold text-[#1d2824]">
              {technicalStandards.length} norme · {technicalGrades.length} gradi
            </p>
            <p className="mt-1 text-xs text-[#718197]">Collegati alla Steel Knowledge canonica.</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Servizi industriali</p>
            <p className="mt-2 text-2xl font-semibold text-[#1d2824]">{capabilities.length}</p>
            <p className="mt-1 text-xs text-[#718197]">capability pubblicate sulle sedi.</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#92a0b1]">Presenza</p>
            <p className="mt-2 text-base font-semibold text-[#1d2824]">
              {profile.facilities.length} sedi · {profile.markets.length} mercati
            </p>
            <p className="mt-1 text-xs text-[#718197]">
              {profile.certifications.length} certificazioni pubblicate
            </p>
          </div>
        </div>
      </section>

      {claimState && ["requested", "under_review"].includes(claimState.status) ? (
        <section className="rounded-2xl border border-[#d9e8e2] bg-[#edf5f2] p-4 text-sm text-[#43524c]">
          <p className="font-semibold text-[#1d2824]">Claim in verifica</p>
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
        <section className="flex flex-col gap-3 rounded-2xl border border-[#d9e8e2] bg-[#f3f6f4] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#1d2824]">Questo profilo è gestito dalla tua organizzazione</p>
            <p className="mt-1 text-sm text-[#66736e]">Aggiorna prodotti, sedi, capability, mercati e certificazioni dal Company Profile Manager.</p>
          </div>
          <Link href="/network/manage" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]">
            Gestisci profilo
          </Link>
        </section>
      ) : null}

      {["unclaimed", "revoked"].includes(profile.company.claimed_status) &&
      adminOrganizationId &&
      (!claimState || ["rejected", "revoked"].includes(claimState.status)) ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#1d2824]">Rappresenti questa azienda?</p>
            <p className="mt-1 text-sm text-[#66736e]">
              Verifica prima identità, ownership e metodo di prova. Il claim abilita la gestione del profilo,
              ma non rende automaticamente l&apos;azienda verificata.
            </p>
          </div>
          <Link
            href={"/network/" + profile.company.id + "/claim"}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]"
          >
            Rivendica questo profilo
          </Link>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[#d9e1dd] bg-[#f6f8f7] p-6 sm:p-7">
        <SectionHeader
          eyebrow="Commercial snapshot"
          title="Quello che serve sapere a colpo d'occhio"
          description="Sintesi commerciale costruita dai dati pubblici, dichiarati o verificati presenti nel Network. Le fonti e il livello di trust restano visibili nelle sezioni di dettaglio."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#dfe7f1] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#87938e]">Posizionamento</p>
            <p className="mt-2 text-sm font-semibold text-[#2f4059]">
              {primaryRole?.name ?? "Ruolo non definito"}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.subtypes.slice(0, 4).map((subtype) => (
                <span key={subtype.key} className="rounded-full bg-[#ecefed] px-2.5 py-1 text-[11px] font-semibold text-[#65758a]">
                  {subtype.name}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe7f1] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#87938e]">Prodotti</p>
            <div className="mt-2 space-y-2">
              {productGroups.slice(0, 4).map((product) => (
                <div key={product.key + String(product.facility_id)}>
                  <p className="text-sm font-semibold text-[#2f4059]">{product.name}</p>
                  <p className="mt-0.5 text-xs text-[#718197]">
                    {product.relationships
                      .map((relationship) => relationshipLabels[relationship] || relationship)
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe7f1] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#87938e]">Norme e materiali</p>
            {technicalStandards.length || technicalGrades.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {technicalStandards.slice(0, 5).map((standard) => (
                  <span key={standard.standard_id} className="rounded-lg border border-[#d8e5f8] bg-[#f3f6f4] px-2.5 py-1.5 text-xs font-semibold text-[#1a5144]">
                    {standard.code}
                  </span>
                ))}
                {technicalGrades.slice(0, 5).map((grade) => (
                  <span key={grade.standard_id + grade.material_grade_id} className="rounded-lg border border-[#dce2df] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4b5d74]">
                    {grade.designation}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[#8a98aa]">Scope tecnico non ancora pubblicato.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[#dfe7f1] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#87938e]">Servizi e mercati</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {capabilities.slice(0, 5).map((capability) => (
                <span key={capability.key} className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[11px] font-semibold text-[#1a5144]">
                  {capability.name}
                </span>
              ))}
              {profile.markets.slice(0, 4).map((market) => (
                <span key={market.key} className="rounded-full bg-[#ecefed] px-2.5 py-1 text-[11px] font-semibold text-[#65758a]">
                  {market.name}
                </span>
              ))}
            </div>
            {locationLabels.length ? (
              <p className="mt-3 text-xs leading-5 text-[#718197]">{locationLabels.join(" · ")}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Products"
              title="Prodotti e disponibilità industriale"
              description="Ogni famiglia prodotto è presentata una sola volta. Stock, distribuzione, produzione e lavorazioni vengono accorpati per rendere immediata la lettura commerciale."
            />
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {productGroups.length ? (
                productGroups.map((product) => {
                  const facility = profile.facilities.find((item) => item.id === product.facility_id);
                  const hasTechnicalScope =
                    product.technical_scope.standards.length > 0 ||
                    product.technical_scope.grades.length > 0 ||
                    product.technical_scope.dimensions.length > 0;

                  return (
                    <article
                      key={product.key + String(product.facility_id)}
                      className="rounded-2xl border border-[#dfe7f1] bg-[#fafbfa] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-[#2f4059]">{product.name}</p>
                          {facility ? (
                            <p className="mt-1 text-xs text-[#7b8a9d]">{facility.name}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {product.relationships.map((relationship) => (
                              <span
                                key={relationship}
                                className="rounded-full border border-[#d8e5f8] bg-[#f4f8ff] px-2.5 py-1 text-[11px] font-semibold text-[#1a5144]"
                              >
                                {relationshipLabels[relationship] || relationship}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {product.provenanceKinds.map((kind) => (
                            <ProvenanceBadge key={kind} kind={kind} />
                          ))}
                        </div>
                      </div>

                      {hasTechnicalScope ? (
                        <div className="mt-5 space-y-4 border-t border-[#e5ecf5] pt-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                            Technical scope
                          </p>

                          {product.technical_scope.standards.length ? (
                            <div>
                              <p className="text-xs font-semibold text-[#718197]">Norme</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {product.technical_scope.standards.map((standard) => (
                                  <div
                                    key={standard.standard_id}
                                    className="rounded-xl border border-[#dfe7f1] bg-white px-3 py-2"
                                    title={standard.title}
                                  >
                                    <p className="text-sm font-semibold text-[#43524c]">{standard.code}</p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      <VerificationBadge status={standard.verification_status} />
                                      <ProvenanceBadge kind={standard.provenance_kind} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {product.technical_scope.grades.length ? (
                            <div>
                              <p className="text-xs font-semibold text-[#718197]">Gradi / materiali</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {product.technical_scope.grades.map((grade) => (
                                  <div
                                    key={grade.standard_id + ":" + grade.material_grade_id}
                                    className="rounded-xl border border-[#dfe7f1] bg-white px-3 py-2"
                                  >
                                    <p className="text-sm font-semibold text-[#43524c]">{grade.designation}</p>
                                    <p className="mt-0.5 text-[11px] text-[#7f8da0]">
                                      {grade.standard_code}
                                      {grade.material_number ? " · " + grade.material_number : ""}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      <VerificationBadge status={grade.verification_status} />
                                      <ProvenanceBadge kind={grade.provenance_kind} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {product.technical_scope.dimensions.length ? (
                            <div>
                              <p className="text-xs font-semibold text-[#718197]">Range pubblicati</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {product.technical_scope.dimensions.map((dimension) => (
                                  <div
                                    key={dimension.dimension_type}
                                    className="rounded-xl border border-[#dfe7f1] bg-white px-3 py-2"
                                  >
                                    <p className="text-xs font-semibold text-[#43524c]">
                                      {technicalDimensionLabels[dimension.dimension_type] || dimension.dimension_type}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-[#2f4059]">
                                      {dimension.min_mm}–{dimension.max_mm} mm
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      <VerificationBadge status={dimension.verification_status} />
                                      <ProvenanceBadge kind={dimension.provenance_kind} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <p className="text-[11px] leading-5 text-[#8795a7]">
                            Lo scope tecnico può derivare da fonti pubbliche, dichiarazioni aziendali o verifiche Platform; i badge indicano sempre l'origine e il livello di trust.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-4 border-t border-[#e5ecf5] pt-4 text-xs leading-5 text-[#8a98aa]">
                          Scope tecnico non ancora pubblicato.
                        </p>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-[#87938e]">Nessun prodotto pubblicato.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Industrial positioning"
              title="Ruolo nella filiera"
              description="Ruoli e specializzazioni descrivono come l'azienda opera all'interno del mercato siderurgico."
            />

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87938e]">Ruoli</p>
                <div className="mt-3 space-y-2">
                  {profile.roles.length ? (
                    profile.roles.map((role) => (
                      <div key={role.key} className="rounded-2xl border border-[#e4eaf2] bg-[#fafbfa] p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#34445c]">
                            {role.name}{role.is_primary ? " · principale" : ""}
                          </p>
                          <ProvenanceBadge kind={role.provenance_kind} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#87938e]">Nessun ruolo pubblicato.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87938e]">Specializzazioni</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.subtypes.length ? (
                    profile.subtypes.map((subtype) => (
                      <div key={subtype.key} className="rounded-xl border border-[#e4eaf2] bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-[#4a5b72]">{subtype.name}</p>
                        <div className="mt-1.5"><ProvenanceBadge kind={subtype.provenance_kind} /></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#87938e]">Nessuna specializzazione pubblicata.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Industrial footprint"
              title="Sedi e capability"
              description="Stabilimenti, magazzini e service center mostrano dove opera l'azienda e quali capacità industriali dichiara o ha verificato."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {profile.facilities.length ? (
                profile.facilities.map((facility) => (
                  <article key={facility.id} className="rounded-2xl border border-[#dfe7f1] bg-[#fafbfa] p-5">
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
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#87938e]">Capability</p>
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
                          <p className="text-sm text-[#87938e]">Nessuna capability pubblicata.</p>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-sm text-[#87938e]">Nessuna sede pubblicata.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Markets"
              title="Mercati e applicazioni"
              description="Settori applicativi supportati dalle evidenze pubbliche, aziendali o verificate disponibili nel Network."
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.markets.length ? (
                profile.markets.map((market) => (
                  <div key={market.key} className="rounded-2xl border border-[#dce2df] bg-[#fafbfa] px-3.5 py-2.5">
                    <p className="text-sm font-semibold text-[#43524c]">{market.name}</p>
                    <div className="mt-1.5"><ProvenanceBadge kind={market.provenance_kind} /></div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#87938e]">Nessun mercato pubblicato.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
            <SectionHeader
              eyebrow="Trust"
              title="Certificazioni pubblicate"
              description="Le certificazioni presenti nel profilo mantengono fonte e stato di verifica separati: pubblicato non significa automaticamente verificato dalla Platform."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {profile.certifications.length ? (
                profile.certifications.map((certification) => {
                  const facility = profile.facilities.find((item) => item.id === certification.facility_id);
                  return (
                    <article key={certification.id} className="rounded-2xl border border-[#dfe7f1] bg-[#fafbfa] p-5">
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
                <p className="text-sm text-[#87938e]">Nessuna certificazione pubblicata.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-3xl border border-[#dce2df] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87938e]">Stato del profilo</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e6edf6]">
              <div
                className="h-full rounded-full bg-[#1a5144]"
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

          <section className="rounded-3xl border border-[#dce2df] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87938e]">Contatti pubblici</p>
            <div className="mt-4 space-y-4">
              {profile.contacts.length ? (
                profile.contacts.map((contact) => (
                  <div key={contact.id} className="border-b border-[#e6ebe8] pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#34445c]">
                          {contact.display_name ?? contact.contact_type}
                        </p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[#95a2b3]">
                          {contact.contact_type}
                        </p>
                      </div>
                      <VerificationBadge status={contact.verification_status} />
                    </div>
                    {contact.email ? <p className="mt-2 break-all text-xs text-[#66736e]">{contact.email}</p> : null}
                    {contact.phone ? <p className="mt-1 text-xs text-[#66736e]">{contact.phone}</p> : null}
                    {contact.website_url ? (
                      <a href={contact.website_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-[#1a5144]">
                        Apri riferimento ↗
                      </a>
                    ) : null}
                    <div className="mt-2">
                      <ProvenanceBadge kind={contact.provenance_kind} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#8b99aa]">
                  Nessun contatto pubblico. Usa l'inquiry governata quando disponibile.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#d9e8e2] bg-[#f3f6f4] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">Network trust</p>
            <p className="mt-2 text-sm font-semibold text-[#34445c]">
              Claim e verifica sono segnali distinti
            </p>
            <p className="mt-2 text-xs leading-5 text-[#718197]">
              Un profilo rivendicato indica chi lo gestisce. La verifica indica invece controlli eseguiti dalla piattaforma su azienda o singoli elementi.
            </p>
            <p className="mt-3 text-xs font-semibold text-[#52637a]">
              {verifiedAssetCount} elementi strutturati verificati
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
