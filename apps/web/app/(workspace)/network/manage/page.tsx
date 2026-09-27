import Link from "next/link";
import { redirect } from "next/navigation";

import {
  archiveManagedFacility,
  archiveManagedPublicContact,
  removeManagedCertification,
  removeManagedCompanyLogo,
  removeManagedProductDimensionScope,
  setInquiryPreferences,
  setManagedCompanyMarket,
  setManagedCompanyProduct,
  setManagedCompanyRole,
  setManagedCompanySubtype,
  setManagedFacilityCapability,
  setManagedProductGradeScope,
  setManagedProductStandardScope,
  updateManagedNetworkProfile,
  uploadManagedCompanyLogo,
  upsertManagedCertification,
  upsertManagedProductDimensionScope,
  upsertManagedFacility,
  upsertManagedPublicContact,
} from "@/app/(workspace)/network/actions";
import {
  getInquiryPreferences,
  getManagedNetworkCompany,
  getManagedNetworkProfileState,
  getNetworkCompanyLogoUrl,
  type ManagedProfileRelationMeta,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 text-sm text-[#24354e] outline-none transition focus:border-[#9bb9ee] focus:ring-2 focus:ring-[#e8f0ff]";
const textareaClass =
  "mt-2 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 py-3 text-sm leading-6 text-[#24354e] outline-none transition focus:border-[#9bb9ee] focus:ring-2 focus:ring-[#e8f0ff]";
const primaryButton =
  "inline-flex h-10 items-center justify-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white transition hover:bg-[#245ed1]";
const secondaryButton =
  "inline-flex h-10 items-center justify-center rounded-xl border border-[#dbe5f1] bg-white px-4 text-sm font-semibold text-[#40516a] transition hover:border-[#bdd1f4] hover:bg-[#f5f8ff] hover:text-[#2f6fed]";
const dangerButton =
  "inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50";

const relationshipLabels: Record<string, string> = {
  produces: "Produce",
  distributes: "Distribuisce",
  stocks: "Tiene a stock",
  processes: "Lavora / trasforma",
  uses: "Utilizza",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">
      {children}
    </label>
  );
}

function SectionHeader({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div id={id} className="scroll-mt-28">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f6fed]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68788e]">{description}</p>
    </div>
  );
}

function ProvenanceBadge({
  item,
}: {
  item: Pick<ManagedProfileRelationMeta, "ownership_type" | "source_type" | "review_state">;
}) {
  const managed = item.ownership_type === "company_managed";
  return (
    <span
      className={
        "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
        (managed
          ? "bg-[#eef5ff] text-[#2f6fed]"
          : item.ownership_type === "platform_verified"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-[#f2f5f8] text-[#66768d]")
      }
    >
      {item.ownership_type === "platform_verified"
        ? "Platform verified"
        : managed
          ? "Dichiarato dall'azienda"
          : item.source_type === "public_web"
            ? "Da fonte pubblica"
            : "Curato dalla piattaforma"}
    </span>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const verified = status === "verified";
  return (
    <span
      className={
        "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
        (verified
          ? "bg-emerald-50 text-emerald-700"
          : status === "pending"
            ? "bg-amber-50 text-amber-800"
            : "bg-[#f2f5f8] text-[#66768d]")
      }
    >
      {verified ? "Verificato" : status === "pending" ? "Verifica in corso" : "Non verificato"}
    </span>
  );
}

const technicalDimensionLabels: Record<string, string> = {
  outer_diameter: "Diametro esterno",
  width: "Larghezza",
  height: "Altezza",
  wall_thickness: "Spessore parete",
  length: "Lunghezza",
};

function ScopeProvenanceBadge({
  kind,
}: {
  kind: "platform_verified" | "company_declared" | "public_web" | "platform_curated";
}) {
  return (
    <span
      className={
        "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
        (kind === "platform_verified"
          ? "bg-emerald-50 text-emerald-700"
          : kind === "company_declared"
            ? "bg-[#eef5ff] text-[#2f6fed]"
            : kind === "public_web"
              ? "bg-[#f2f5f8] text-[#66768d]"
              : "bg-violet-50 text-violet-700")
      }
    >
      {kind === "platform_verified"
        ? "Platform verified"
        : kind === "company_declared"
          ? "Dichiarato dall'azienda"
          : kind === "public_web"
            ? "Da fonte pubblica"
            : "Curato dalla piattaforma"}
    </span>
  );
}

function CompletenessItem({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#edf1f6] bg-[#fbfcfe] px-3 py-2.5">
      <span className="text-sm text-[#4f6077]">{label}</span>
      <span className={complete ? "text-xs font-bold text-emerald-700" : "text-xs font-bold text-[#9aa7b7]"}>
        {complete ? "Completo" : "Da completare"}
      </span>
    </div>
  );
}

export default async function ManagedNetworkProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const { error, message } = await searchParams;
  const managed = await getManagedNetworkCompany();

  if (!managed) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/network" className="text-sm font-semibold text-[#68788e] hover:text-[#1e2b45]">
          ← Torna alla directory
        </Link>
        <section className="rounded-3xl border border-[#e1e8f2] bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6fed]">Company Profile Manager</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1e2b45]">Nessun profilo azienda gestibile</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#68788e]">
            Per gestire un profilo Network servono Organization Admin attivo, link organizzazione-azienda
            attivo e claim approvato.
          </p>
          <Link href="/network" className={"mt-5 " + primaryButton}>
            Cerca la tua azienda
          </Link>
        </section>
      </div>
    );
  }

  const [state, inquiryPreferences] = await Promise.all([
    getManagedNetworkProfileState(managed.network_company_id),
    getInquiryPreferences(managed.organization_id),
  ]);

  if (!state) redirect("/network?error=Profilo%20gestito%20non%20disponibile");

  const companyId = managed.network_company_id;
  const roleKeys = new Set(state.roles.map((item) => item.key));
  const availableSubtypes = state.taxonomy.subtypes.filter((item) => roleKeys.has(item.role_key));
  const completeness = state.completeness.sections;
  const logoUrl = getNetworkCompanyLogoUrl(
    state.company.logo_path,
    state.company.logo_updated_at,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/network" className="text-sm font-semibold text-[#68788e] hover:text-[#1e2b45]">
          ← Torna alla directory
        </Link>
        <Link href={"/network/" + companyId} className={secondaryButton}>
          Visualizza profilo pubblico
        </Link>
      </div>

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

      <section className="rounded-3xl border border-[#dfe7f1] bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6fed]">Company Profile Manager · P3.7B</p>
            <p className="mt-1 text-xs font-semibold text-[#718197]">P3.7D · Identity & Public Contacts</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
              {state.company.trading_name || state.company.legal_name}
            </h1>
            <p className="mt-2 text-sm text-[#7a899d]">{state.company.legal_name}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Claim {state.company.claimed_status}
              </span>
              <VerificationBadge status={state.company.verification_status} />
              <span className="rounded-full bg-[#eef3fa] px-3 py-1 text-xs font-semibold text-[#4a5b72]">
                {state.company.country_code}
              </span>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-[#68788e]">
              Gestisci il profilo industriale che il Network utilizzerà per directory, discovery e in futuro
              per il matching Marketplace. Le dichiarazioni aziendali restano distinte dalle verifiche della piattaforma.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dce6f3] bg-[#f8faff] p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8291a5]">Completezza profilo</p>
                <p className="mt-1 text-3xl font-semibold text-[#1e2b45]">{state.completeness.percentage}%</p>
              </div>
              <p className="text-xs font-semibold text-[#7b8ba1]">
                {state.completeness.passed_sections}/{state.completeness.total_sections}
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e4ebf5]">
              <div
                className="h-full rounded-full bg-[#2f6fed]"
                style={{ width: Math.max(4, state.completeness.percentage) + "%" }}
              />
            </div>
            <div className="mt-4 grid gap-2">
              <CompletenessItem label="Identità" complete={completeness.identity} />
              <CompletenessItem label="Prodotti" complete={completeness.products} />
              <CompletenessItem label="Sedi" complete={completeness.facilities} />
              <CompletenessItem label="Capability" complete={completeness.capabilities} />
              <CompletenessItem label="Mercati" complete={completeness.markets} />
              <CompletenessItem label="Certificazioni" complete={completeness.certifications} />
              <CompletenessItem label="Inquiry" complete={completeness.inquiry_readiness} />
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-3 z-10 overflow-x-auto rounded-2xl border border-[#e1e8f2] bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-1">
          {[
            ["overview", "Overview"],
            ["positioning", "Tipologia"],
            ["products", "Prodotti"],
            ["facilities", "Sedi & capability"],
            ["markets", "Mercati"],
            ["certifications", "Certificazioni"],
            ["contacts", "Contatti pubblici"],
            ["inquiries", "Inquiry"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={"#" + href}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-[#5d6e85] hover:bg-[#f1f5fb] hover:text-[#2f6fed]"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section className="space-y-5 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="overview"
          eyebrow="01 · Overview"
          title="Identità commerciale"
          description="I dati legali restano governati dalla piattaforma. Qui puoi gestire la presentazione commerciale del profilo."
        />

        <div className="grid gap-5 rounded-2xl border border-[#dfe7f1] bg-[#fbfcfe] p-5 lg:grid-cols-[180px_1fr] lg:items-center">
          <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-[#dbe5f1] bg-white">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={"Logo " + (state.company.trading_name || state.company.legal_name)}
                className="max-h-28 max-w-[140px] object-contain"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#eef5ff] text-2xl font-bold text-[#2f6fed]">
                {(state.company.trading_name || state.company.legal_name)
                  .split(/\\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("") || "SS"}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-[#34445c]">Logo aziendale</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#718197]">
              PNG, JPEG o WebP fino a 2 MB. Il logo è pubblico nel Network ma non modifica lo stato di verifica dell&apos;azienda.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <form action={uploadManagedCompanyLogo} encType="multipart/form-data" className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="network_company_id" value={companyId} />
                <div className="min-w-0 flex-1">
                  <FieldLabel>File logo</FieldLabel>
                  <input
                    type="file"
                    name="logo"
                    accept="image/png,image/jpeg,image/webp"
                    required
                    className="mt-2 block w-full rounded-xl border border-[#dbe5f1] bg-white px-3 py-2 text-sm text-[#52637a] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef5ff] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#2f6fed]"
                  />
                </div>
                <button className={primaryButton}>Carica logo</button>
              </form>

              {state.company.logo_path ? (
                <form action={removeManagedCompanyLogo}>
                  <input type="hidden" name="network_company_id" value={companyId} />
                  <input type="hidden" name="logo_path" value={state.company.logo_path} />
                  <button className={dangerButton}>Rimuovi logo</button>
                </form>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-[#edf1f6] bg-[#fafbfd] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#96a3b4]">Ragione sociale</p>
            <p className="mt-1 text-sm font-semibold text-[#34445c]">{state.company.legal_name}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#96a3b4]">Paese</p>
            <p className="mt-1 text-sm font-semibold text-[#34445c]">{state.company.country_code}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#96a3b4]">P. IVA</p>
            <p className="mt-1 text-sm font-semibold text-[#34445c]">{state.company.vat_id || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#96a3b4]">Registration ID</p>
            <p className="mt-1 text-sm font-semibold text-[#34445c]">{state.company.registration_id || "—"}</p>
          </div>
        </div>

        <form action={updateManagedNetworkProfile} className="grid gap-5 lg:grid-cols-2">
          <input type="hidden" name="network_company_id" value={companyId} />
          <div>
            <FieldLabel>Nome commerciale</FieldLabel>
            <input name="trading_name" defaultValue={state.company.trading_name ?? ""} maxLength={255} className={inputClass} />
          </div>
          <div>
            <FieldLabel>Sito web</FieldLabel>
            <input name="website_url" defaultValue={state.company.website_url ?? ""} maxLength={500} className={inputClass} />
          </div>
          <div className="lg:col-span-2">
            <FieldLabel>Descrizione azienda</FieldLabel>
            <textarea name="description" defaultValue={state.company.description ?? ""} maxLength={4000} rows={6} className={textareaClass} />
          </div>
          <div className="lg:col-span-2">
            <button className={primaryButton}>Salva overview</button>
          </div>
        </form>
      </section>

      <section className="space-y-6 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="positioning"
          eyebrow="02 · Company type"
          title="Tipologia e posizionamento"
          description="Definisci il ruolo dell'azienda nella filiera. Il ruolo principale guida la lettura del profilo, mentre ruoli secondari e sottotipi descrivono attività ibride."
        />

        <div>
          <h3 className="text-sm font-semibold text-[#34445c]">Ruoli aziendali</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.roles.map((role) => (
              <div key={role.id} className="flex items-center gap-2 rounded-2xl border border-[#e1e8f2] bg-[#fbfcfe] px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-[#34445c]">
                    {role.name}{role.is_primary ? " · principale" : ""}
                  </p>
                  <div className="mt-1">
                    <ProvenanceBadge item={role} />
                  </div>
                </div>
                {!role.is_primary ? (
                  <div className="ml-2 flex gap-1.5">
                    <form action={setManagedCompanyRole}>
                      <input type="hidden" name="network_company_id" value={companyId} />
                      <input type="hidden" name="role_key" value={role.key} />
                      <input type="hidden" name="enabled" value="true" />
                      <input type="hidden" name="is_primary" value="true" />
                      <button className="rounded-lg border border-[#dbe5f1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#53657c]">
                        Rendi principale
                      </button>
                    </form>
                    <form action={setManagedCompanyRole}>
                      <input type="hidden" name="network_company_id" value={companyId} />
                      <input type="hidden" name="role_key" value={role.key} />
                      <input type="hidden" name="enabled" value="false" />
                      <input type="hidden" name="is_primary" value="false" />
                      <button className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">Rimuovi</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
            {state.roles.length === 0 ? <p className="text-sm text-[#8a98aa]">Nessun ruolo definito.</p> : null}
          </div>

          <form action={setManagedCompanyRole} className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-[#cfdae8] bg-[#fafcff] p-4 sm:flex-row sm:items-end">
            <input type="hidden" name="network_company_id" value={companyId} />
            <input type="hidden" name="enabled" value="true" />
            <div className="min-w-0 flex-1">
              <FieldLabel>Aggiungi ruolo</FieldLabel>
              <select name="role_key" required className={inputClass}>
                <option value="">Seleziona ruolo</option>
                {state.taxonomy.roles.map((role) => (
                  <option key={role.key} value={role.key}>{role.name}</option>
                ))}
              </select>
            </div>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5f1] bg-white px-3 text-sm text-[#53657c]">
              <input type="checkbox" name="is_primary" value="true" />
              Principale
            </label>
            <button className={primaryButton}>Aggiungi</button>
          </form>
        </div>

        <div className="border-t border-[#edf1f6] pt-5">
          <h3 className="text-sm font-semibold text-[#34445c]">Sottotipi</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.subtypes.map((subtype) => (
              <div key={subtype.id} className="flex items-center gap-2 rounded-xl border border-[#e1e8f2] bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-[#40516a]">{subtype.name}</p>
                  <div className="mt-1"><ProvenanceBadge item={subtype} /></div>
                </div>
                <form action={setManagedCompanySubtype}>
                  <input type="hidden" name="network_company_id" value={companyId} />
                  <input type="hidden" name="subtype_key" value={subtype.key} />
                  <input type="hidden" name="enabled" value="false" />
                  <button className="ml-1 text-xs font-semibold text-rose-700">Rimuovi</button>
                </form>
              </div>
            ))}
            {state.subtypes.length === 0 ? <p className="text-sm text-[#8a98aa]">Nessun sottotipo definito.</p> : null}
          </div>

          <form action={setManagedCompanySubtype} className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-[#cfdae8] bg-[#fafcff] p-4 sm:flex-row sm:items-end">
            <input type="hidden" name="network_company_id" value={companyId} />
            <input type="hidden" name="enabled" value="true" />
            <div className="min-w-0 flex-1">
              <FieldLabel>Aggiungi sottotipo</FieldLabel>
              <select name="subtype_key" required className={inputClass}>
                <option value="">Seleziona sottotipo coerente con i ruoli</option>
                {availableSubtypes.map((subtype) => (
                  <option key={subtype.key} value={subtype.key}>{subtype.name}</option>
                ))}
              </select>
            </div>
            <button className={primaryButton}>Aggiungi</button>
          </form>
        </div>
      </section>

      <section className="space-y-5 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="products"
          eyebrow="03 · Products"
          title="Prodotti e scope tecnico"
          description="Definisci cosa produce, distribuisce o tiene a stock l'azienda e, dove disponibile, collega norme, gradi/materiali e range dimensionali canonici. Questo scope prepara il profilo al matching Marketplace."
        />

        <div className="space-y-4">
          {state.products.map((product) => {
            const facility = state.facilities.find((item) => item.id === product.facility_id);
            const productStandards = state.technical_scope.standard_scopes.filter(
              (scope) => scope.company_product_id === product.id,
            );
            const productGrades = state.technical_scope.grade_scopes.filter(
              (scope) => scope.company_product_id === product.id,
            );
            const productDimensions = state.technical_scope.dimension_scopes.filter(
              (scope) => scope.company_product_id === product.id,
            );
            const selectedStandardIds = new Set(productStandards.map((scope) => scope.standard_id));
            const selectedGradeIds = new Set(productGrades.map((scope) => scope.material_grade_id));
            const availableStandards = state.technical_scope.taxonomy.standards.filter(
              (standard) =>
                standard.network_product_keys.includes(product.key) &&
                !selectedStandardIds.has(standard.id),
            );
            const availableGrades = state.technical_scope.taxonomy.grades.filter(
              (grade) =>
                selectedStandardIds.has(grade.standard_id) &&
                !selectedGradeIds.has(grade.material_grade_id),
            );
            const dimensionTypes =
              product.key === "tubes_pipes"
                ? ["outer_diameter", "wall_thickness", "length"]
                : product.key === "hollow_sections"
                  ? ["outer_diameter", "width", "height", "wall_thickness", "length"]
                  : [];
            const hasTechnicalScope =
              productStandards.length > 0 ||
              productGrades.length > 0 ||
              productDimensions.length > 0;

            return (
              <article key={product.id} className="rounded-2xl border border-[#dfe7f1] bg-[#fbfcfe] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#2f4059]">{product.name}</p>
                    <p className="mt-1 text-sm text-[#6f7f93]">
                      {relationshipLabels[product.relationship_type] || product.relationship_type}
                      {facility ? " · " + facility.name : " · intera azienda"}
                    </p>
                    <div className="mt-2"><ProvenanceBadge item={product} /></div>
                  </div>
                  <div className="text-right">
                    <form action={setManagedCompanyProduct}>
                      <input type="hidden" name="network_company_id" value={companyId} />
                      <input type="hidden" name="product_key" value={product.key} />
                      <input type="hidden" name="relationship_type" value={product.relationship_type} />
                      <input type="hidden" name="facility_id" value={product.facility_id ?? ""} />
                      <input type="hidden" name="enabled" value="false" />
                      <button className={dangerButton} disabled={hasTechnicalScope}>
                        Rimuovi prodotto
                      </button>
                    </form>
                    {hasTechnicalScope ? (
                      <p className="mt-1 max-w-48 text-[11px] leading-4 text-[#8a98aa]">
                        Rimuovi prima norme, gradi e range tecnici.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 border-t border-[#e5ecf5] pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
                        Technical / Marketplace scope
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#718197]">
                        Dati tecnici dichiarati dall&apos;azienda e collegati alla Steel Knowledge canonica.
                      </p>
                    </div>
                    {availableStandards.length === 0 && productStandards.length === 0 ? (
                      <span className="rounded-full bg-[#f2f5f8] px-2.5 py-1 text-[11px] font-semibold text-[#718197]">
                        Catalogo tecnico non ancora disponibile
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Norme</p>
                      <div className="mt-3 space-y-2">
                        {productStandards.map((scope) => (
                          <div key={scope.id} className="rounded-xl border border-[#e7edf5] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-[#40516a]">{scope.standard_code}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7a899d]">{scope.standard_title}</p>
                              </div>
                              {scope.verification_status === "unverified" &&
                              !productGrades.some((grade) => grade.standard_id === scope.standard_id) ? (
                                <form action={setManagedProductStandardScope}>
                                  <input type="hidden" name="network_company_id" value={companyId} />
                                  <input type="hidden" name="company_product_id" value={product.id} />
                                  <input type="hidden" name="standard_id" value={scope.standard_id} />
                                  <input type="hidden" name="enabled" value="false" />
                                  <button className="text-xs font-semibold text-rose-700">Rimuovi</button>
                                </form>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <ScopeProvenanceBadge kind={scope.provenance_kind} />
                              <VerificationBadge status={scope.verification_status} />
                            </div>
                          </div>
                        ))}
                        {productStandards.length === 0 ? (
                          <p className="text-sm text-[#8a98aa]">Nessuna norma dichiarata.</p>
                        ) : null}
                      </div>
                      {availableStandards.length ? (
                        <form action={setManagedProductStandardScope} className="mt-3 space-y-3">
                          <input type="hidden" name="network_company_id" value={companyId} />
                          <input type="hidden" name="company_product_id" value={product.id} />
                          <input type="hidden" name="enabled" value="true" />
                          <select name="standard_id" required className={inputClass}>
                            <option value="">Aggiungi norma</option>
                            {availableStandards.map((standard) => (
                              <option key={standard.id} value={standard.id}>{standard.code}</option>
                            ))}
                          </select>
                          <button className={secondaryButton}>Aggiungi norma</button>
                        </form>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Gradi / materiali</p>
                      <div className="mt-3 space-y-2">
                        {productGrades.map((scope) => (
                          <div key={scope.id} className="rounded-xl border border-[#e7edf5] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-[#40516a]">{scope.designation}</p>
                                <p className="mt-1 text-xs text-[#7a899d]">
                                  {scope.standard_code}
                                  {scope.material_number ? " · " + scope.material_number : ""}
                                </p>
                              </div>
                              {scope.verification_status === "unverified" ? (
                                <form action={setManagedProductGradeScope}>
                                  <input type="hidden" name="network_company_id" value={companyId} />
                                  <input type="hidden" name="company_product_id" value={product.id} />
                                  <input type="hidden" name="standard_id" value={scope.standard_id} />
                                  <input type="hidden" name="material_grade_id" value={scope.material_grade_id} />
                                  <input type="hidden" name="enabled" value="false" />
                                  <button className="text-xs font-semibold text-rose-700">Rimuovi</button>
                                </form>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <ScopeProvenanceBadge kind={scope.provenance_kind} />
                              <VerificationBadge status={scope.verification_status} />
                            </div>
                          </div>
                        ))}
                        {productGrades.length === 0 ? (
                          <p className="text-sm text-[#8a98aa]">Nessun grado dichiarato.</p>
                        ) : null}
                      </div>
                      {availableGrades.length ? (
                        <form action={setManagedProductGradeScope} className="mt-3 space-y-3">
                          <input type="hidden" name="network_company_id" value={companyId} />
                          <input type="hidden" name="company_product_id" value={product.id} />
                          <input type="hidden" name="enabled" value="true" />
                          <select
                            name="grade_scope"
                            required
                            className={inputClass}
                            onChange={undefined}
                          >
                            <option value="">Seleziona grado</option>
                            {availableGrades.map((grade) => (
                              <option
                                key={grade.standard_id + ":" + grade.material_grade_id}
                                value={grade.standard_id + ":" + grade.material_grade_id}
                              >
                                {grade.designation} · {grade.standard_code}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] leading-4 text-[#8a98aa]">
                            Il salvataggio usa standard e materiale canonici associati.
                          </p>
                        </form>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Range dimensionali</p>
                      <div className="mt-3 space-y-2">
                        {productDimensions.map((scope) => (
                          <div key={scope.id} className="rounded-xl border border-[#e7edf5] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-[#40516a]">
                                  {technicalDimensionLabels[scope.dimension_type] || scope.dimension_type}
                                </p>
                                <p className="mt-1 text-xs text-[#7a899d]">
                                  {scope.min_mm}–{scope.max_mm} mm
                                </p>
                              </div>
                              {scope.verification_status === "unverified" ? (
                                <form action={removeManagedProductDimensionScope}>
                                  <input type="hidden" name="network_company_id" value={companyId} />
                                  <input type="hidden" name="company_product_id" value={product.id} />
                                  <input type="hidden" name="dimension_type" value={scope.dimension_type} />
                                  <button className="text-xs font-semibold text-rose-700">Rimuovi</button>
                                </form>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <ScopeProvenanceBadge kind={scope.provenance_kind} />
                              <VerificationBadge status={scope.verification_status} />
                            </div>
                          </div>
                        ))}
                        {productDimensions.length === 0 ? (
                          <p className="text-sm text-[#8a98aa]">
                            {dimensionTypes.length ? "Nessun range dichiarato." : "Range non previsto per questa famiglia."}
                          </p>
                        ) : null}
                      </div>
                      {dimensionTypes.length ? (
                        <form action={upsertManagedProductDimensionScope} className="mt-3 grid gap-3">
                          <input type="hidden" name="network_company_id" value={companyId} />
                          <input type="hidden" name="company_product_id" value={product.id} />
                          <select name="dimension_type" required className={inputClass}>
                            <option value="">Tipo dimensione</option>
                            {dimensionTypes.map((type) => (
                              <option key={type} value={type}>{technicalDimensionLabels[type]}</option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="number" step="0.01" min="0.01" name="min_mm" required placeholder="Min mm" className={inputClass} />
                            <input type="number" step="0.01" min="0.01" name="max_mm" required placeholder="Max mm" className={inputClass} />
                          </div>
                          <button className={secondaryButton}>Salva range</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {state.products.length === 0 ? (
            <p className="text-sm text-[#8a98aa]">Nessun prodotto pubblicato.</p>
          ) : null}
        </div>

        <form action={setManagedCompanyProduct} className="grid gap-3 rounded-2xl border border-dashed border-[#cfdae8] bg-[#fafcff] p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <input type="hidden" name="network_company_id" value={companyId} />
          <input type="hidden" name="enabled" value="true" />
          <div>
            <FieldLabel>Famiglia prodotto</FieldLabel>
            <select name="product_key" required className={inputClass}>
              <option value="">Seleziona</option>
              {state.taxonomy.products.map((product) => (
                <option key={product.key} value={product.key}>{product.name}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Relazione</FieldLabel>
            <select name="relationship_type" required className={inputClass} defaultValue="distributes">
              {Object.entries(relationshipLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Sede opzionale</FieldLabel>
            <select name="facility_id" className={inputClass}>
              <option value="">Intera azienda</option>
              {state.facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>{facility.name}</option>
              ))}
            </select>
          </div>
          <button className={primaryButton}>Aggiungi prodotto</button>
        </form>
      </section>

      <section className="space-y-6 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="facilities"
          eyebrow="04 · Facilities"
          title="Sedi, stabilimenti e capability"
          description="Descrivi dove opera l'azienda e quali lavorazioni o servizi sono disponibili in ogni sede. Le entità verificate dalla piattaforma diventano read-only finché non vengono riesaminate."
        />

        <div className="space-y-4">
          {state.facilities.map((facility) => {
            const locked = facility.verification_status !== "unverified";
            return (
              <article key={facility.id} className="rounded-2xl border border-[#dfe7f1] bg-[#fbfcfe] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#2d3f58]">{facility.name}</h3>
                    <p className="mt-1 text-xs text-[#8090a4]">
                      {facility.facility_type} · {[facility.city, facility.region, facility.country_code].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <VerificationBadge status={facility.verification_status} />
                </div>

                {locked ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                    Questa sede ha uno stato di verifica Platform e non può essere modificata direttamente.
                  </div>
                ) : (
                  <form action={upsertManagedFacility} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="network_company_id" value={companyId} />
                    <input type="hidden" name="facility_id" value={facility.id} />
                    <div><FieldLabel>Nome sede</FieldLabel><input name="name" required defaultValue={facility.name} className={inputClass} /></div>
                    <div><FieldLabel>Tipo</FieldLabel><input name="facility_type" required defaultValue={facility.facility_type} className={inputClass} /></div>
                    <div><FieldLabel>Indirizzo</FieldLabel><input name="address_line_1" defaultValue={facility.address_line_1 ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>Indirizzo 2</FieldLabel><input name="address_line_2" defaultValue={facility.address_line_2 ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>CAP</FieldLabel><input name="postal_code" defaultValue={facility.postal_code ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>Città</FieldLabel><input name="city" defaultValue={facility.city ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>Regione</FieldLabel><input name="region" defaultValue={facility.region ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>Paese</FieldLabel><input name="country_code" required maxLength={2} defaultValue={facility.country_code} className={inputClass} /></div>
                    <div className="sm:col-span-2"><FieldLabel>Sito sede</FieldLabel><input name="website_url" defaultValue={facility.website_url ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>Visibilità</FieldLabel><select name="publication_status" defaultValue={facility.publication_status} className={inputClass}><option value="published">Pubblicata</option><option value="draft">Bozza</option></select></div>
                    <div className="flex items-end"><button className={primaryButton}>Salva sede</button></div>
                  </form>
                )}

                <div className="mt-5 border-t border-[#e7edf5] pt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#91a0b2]">Capability</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {facility.capabilities.map((capability) => (
                      <div key={capability.id} className="flex items-center gap-2 rounded-xl border border-[#dfe7f1] bg-white px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-[#40516a]">{capability.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <ProvenanceBadge item={capability} />
                            <VerificationBadge status={capability.verification_status} />
                          </div>
                        </div>
                        {capability.verification_status === "unverified" ? (
                          <form action={setManagedFacilityCapability}>
                            <input type="hidden" name="network_company_id" value={companyId} />
                            <input type="hidden" name="facility_id" value={facility.id} />
                            <input type="hidden" name="capability_key" value={capability.key} />
                            <input type="hidden" name="enabled" value="false" />
                            <button className="ml-1 text-xs font-semibold text-rose-700">Rimuovi</button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {facility.capabilities.length === 0 ? <p className="text-sm text-[#8a98aa]">Nessuna capability.</p> : null}
                  </div>
                  <form action={setManagedFacilityCapability} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <input type="hidden" name="network_company_id" value={companyId} />
                    <input type="hidden" name="facility_id" value={facility.id} />
                    <input type="hidden" name="enabled" value="true" />
                    <div className="min-w-0 flex-1">
                      <FieldLabel>Aggiungi capability</FieldLabel>
                      <select name="capability_key" required className={inputClass}>
                        <option value="">Seleziona capability</option>
                        {state.taxonomy.capabilities.map((capability) => (
                          <option key={capability.key} value={capability.key}>{capability.name}</option>
                        ))}
                      </select>
                    </div>
                    <button className={secondaryButton}>Aggiungi</button>
                  </form>
                </div>

                {!locked ? (
                  <div className="mt-4 flex justify-end">
                    <form action={archiveManagedFacility}>
                      <input type="hidden" name="network_company_id" value={companyId} />
                      <input type="hidden" name="facility_id" value={facility.id} />
                      <button className={dangerButton}>Archivia sede</button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}
          {state.facilities.length === 0 ? <p className="text-sm text-[#8a98aa]">Nessuna sede ancora presente.</p> : null}
        </div>

        <div className="rounded-2xl border border-dashed border-[#c7d5e7] bg-[#fafcff] p-5">
          <h3 className="font-semibold text-[#34445c]">Aggiungi una sede</h3>
          <form action={upsertManagedFacility} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="network_company_id" value={companyId} />
            <div><FieldLabel>Nome sede</FieldLabel><input name="name" required placeholder="Es. Stabilimento Torino" className={inputClass} /></div>
            <div><FieldLabel>Tipo</FieldLabel><input name="facility_type" required placeholder="plant / warehouse / office" className={inputClass} /></div>
            <div><FieldLabel>Indirizzo</FieldLabel><input name="address_line_1" className={inputClass} /></div>
            <div><FieldLabel>Indirizzo 2</FieldLabel><input name="address_line_2" className={inputClass} /></div>
            <div><FieldLabel>CAP</FieldLabel><input name="postal_code" className={inputClass} /></div>
            <div><FieldLabel>Città</FieldLabel><input name="city" className={inputClass} /></div>
            <div><FieldLabel>Regione</FieldLabel><input name="region" className={inputClass} /></div>
            <div><FieldLabel>Paese</FieldLabel><input name="country_code" required maxLength={2} defaultValue={state.company.country_code} className={inputClass} /></div>
            <div className="sm:col-span-2"><FieldLabel>Sito sede</FieldLabel><input name="website_url" className={inputClass} /></div>
            <div><FieldLabel>Visibilità</FieldLabel><select name="publication_status" defaultValue="published" className={inputClass}><option value="published">Pubblicata</option><option value="draft">Bozza</option></select></div>
            <div className="flex items-end"><button className={primaryButton}>Crea sede</button></div>
          </form>
        </div>
      </section>

      <section className="space-y-5 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="markets"
          eyebrow="05 · Markets"
          title="Mercati e settori serviti"
          description="Dichiara i settori nei quali opera l'azienda. Questi segnali alimenteranno filtri, discovery e matching commerciale."
        />
        <div className="flex flex-wrap gap-2">
          {state.markets.map((market) => (
            <div key={market.id} className="flex items-center gap-2 rounded-xl border border-[#e1e8f2] bg-[#fbfcfe] px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-[#40516a]">{market.name}</p>
                <div className="mt-1"><ProvenanceBadge item={market} /></div>
              </div>
              <form action={setManagedCompanyMarket}>
                <input type="hidden" name="network_company_id" value={companyId} />
                <input type="hidden" name="market_key" value={market.key} />
                <input type="hidden" name="enabled" value="false" />
                <button className="ml-1 text-xs font-semibold text-rose-700">Rimuovi</button>
              </form>
            </div>
          ))}
          {state.markets.length === 0 ? <p className="text-sm text-[#8a98aa]">Nessun mercato definito.</p> : null}
        </div>
        <form action={setManagedCompanyMarket} className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#cfdae8] bg-[#fafcff] p-4 sm:flex-row sm:items-end">
          <input type="hidden" name="network_company_id" value={companyId} />
          <input type="hidden" name="enabled" value="true" />
          <div className="min-w-0 flex-1">
            <FieldLabel>Aggiungi mercato</FieldLabel>
            <select name="market_key" required className={inputClass}>
              <option value="">Seleziona mercato</option>
              {state.taxonomy.markets.map((market) => (
                <option key={market.key} value={market.key}>{market.name}</option>
              ))}
            </select>
          </div>
          <button className={primaryButton}>Aggiungi</button>
        </form>
      </section>

      <section className="space-y-5 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="certifications"
          eyebrow="06 · Certifications"
          title="Certificazioni"
          description="Registra certificazioni e relativo scope. Le certificazioni dichiarate dall'azienda partono come non verificate; la verifica resta sotto controllo Platform."
        />

        <div className="space-y-4">
          {state.certifications.map((certification) => {
            const locked = certification.verification_status !== "unverified";
            return (
              <article key={certification.id} className="rounded-2xl border border-[#e1e8f2] bg-[#fbfcfe] p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#2d3f58]">{certification.name}</h3>
                    <p className="mt-1 text-sm text-[#718197]">
                      {certification.certificate_identifier || "Identificativo non indicato"}
                      {certification.issuer ? " · " + certification.issuer : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ProvenanceBadge item={certification} />
                      <VerificationBadge status={certification.verification_status} />
                    </div>
                  </div>
                  {!locked ? (
                    <form action={removeManagedCertification}>
                      <input type="hidden" name="network_company_id" value={companyId} />
                      <input type="hidden" name="certification_id" value={certification.id} />
                      <button className={dangerButton}>Rimuovi</button>
                    </form>
                  ) : null}
                </div>

                {locked ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                    La certificazione ha una verifica Platform e non può essere modificata direttamente.
                  </div>
                ) : (
                  <form action={upsertManagedCertification} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="network_company_id" value={companyId} />
                    <input type="hidden" name="certification_id" value={certification.id} />
                    <div>
                      <FieldLabel>Tipo</FieldLabel>
                      <select name="certification_type_key" defaultValue={certification.key} required className={inputClass}>
                        {state.taxonomy.certifications.map((item) => (
                          <option key={item.key} value={item.key}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Sede</FieldLabel>
                      <select name="facility_id" defaultValue={certification.facility_id ?? ""} className={inputClass}>
                        <option value="">Intera azienda</option>
                        {state.facilities.map((facility) => (
                          <option key={facility.id} value={facility.id}>{facility.name}</option>
                        ))}
                      </select>
                    </div>
                    <div><FieldLabel>Ente</FieldLabel><input name="issuer" defaultValue={certification.issuer ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>ID certificato</FieldLabel><input name="certificate_identifier" defaultValue={certification.certificate_identifier ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>Valido dal</FieldLabel><input type="date" name="valid_from" defaultValue={certification.valid_from ?? ""} className={inputClass} /></div>
                    <div><FieldLabel>Valido fino al</FieldLabel><input type="date" name="valid_to" defaultValue={certification.valid_to ?? ""} className={inputClass} /></div>
                    <div className="sm:col-span-2"><FieldLabel>Evidence reference</FieldLabel><input name="evidence_reference" defaultValue={certification.evidence_reference ?? ""} className={inputClass} /></div>
                    <div className="sm:col-span-2 lg:col-span-4"><FieldLabel>Scope</FieldLabel><textarea name="scope_text" defaultValue={certification.scope_text ?? ""} rows={3} className={textareaClass} /></div>
                    <div className="sm:col-span-2 lg:col-span-4"><button className={primaryButton}>Salva certificazione</button></div>
                  </form>
                )}
              </article>
            );
          })}
          {state.certifications.length === 0 ? <p className="text-sm text-[#8a98aa]">Nessuna certificazione registrata.</p> : null}
        </div>

        <div className="rounded-2xl border border-dashed border-[#c7d5e7] bg-[#fafcff] p-5">
          <h3 className="font-semibold text-[#34445c]">Aggiungi certificazione</h3>
          <form action={upsertManagedCertification} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="network_company_id" value={companyId} />
            <div>
              <FieldLabel>Tipo</FieldLabel>
              <select name="certification_type_key" required className={inputClass}>
                <option value="">Seleziona</option>
                {state.taxonomy.certifications.map((item) => (
                  <option key={item.key} value={item.key}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Sede</FieldLabel>
              <select name="facility_id" className={inputClass}>
                <option value="">Intera azienda</option>
                {state.facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>{facility.name}</option>
                ))}
              </select>
            </div>
            <div><FieldLabel>Ente</FieldLabel><input name="issuer" className={inputClass} /></div>
            <div><FieldLabel>ID certificato</FieldLabel><input name="certificate_identifier" className={inputClass} /></div>
            <div><FieldLabel>Valido dal</FieldLabel><input type="date" name="valid_from" className={inputClass} /></div>
            <div><FieldLabel>Valido fino al</FieldLabel><input type="date" name="valid_to" className={inputClass} /></div>
            <div className="sm:col-span-2"><FieldLabel>Evidence reference</FieldLabel><input name="evidence_reference" placeholder="URL o riferimento documento" className={inputClass} /></div>
            <div className="sm:col-span-2 lg:col-span-4"><FieldLabel>Scope</FieldLabel><textarea name="scope_text" rows={3} className={textareaClass} /></div>
            <div className="sm:col-span-2 lg:col-span-4"><button className={primaryButton}>Aggiungi certificazione</button></div>
          </form>
        </div>
      </section>

      <section className="space-y-5 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="contacts"
          eyebrow="07 · Public contacts"
          title="Contatti pubblici"
          description="Pubblica solo riferimenti che l'azienda vuole rendere visibili nel Network. I contatti della Commercial Memory restano completamente separati."
        />

        <div className="space-y-4">
          {state.contacts.map((contact) => {
            const editable =
              contact.ownership_type === "company_managed" &&
              contact.verification_status !== "verified";

            return (
              <article key={contact.id} className="rounded-2xl border border-[#e1e8f2] bg-[#fbfcfe] p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#34445c]">
                      {contact.display_name || contact.contact_type}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ProvenanceBadge
                        item={{
                          ownership_type: contact.ownership_type || "platform_curated",
                          source_type: contact.source_type || "platform_curated",
                          review_state: contact.review_state || "accepted",
                        }}
                      />
                      <VerificationBadge status={contact.verification_status} />
                      <span className="rounded-full bg-[#f2f5f8] px-2.5 py-1 text-[11px] font-semibold text-[#66768d]">
                        {contact.publication_status === "published" ? "Pubblico" : "Bozza"}
                      </span>
                    </div>
                  </div>
                  {editable ? (
                    <form action={archiveManagedPublicContact}>
                      <input type="hidden" name="network_company_id" value={companyId} />
                      <input type="hidden" name="contact_id" value={contact.id} />
                      <button className={dangerButton}>Archivia</button>
                    </form>
                  ) : null}
                </div>

                {editable ? (
                  <form action={upsertManagedPublicContact} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="network_company_id" value={companyId} />
                    <input type="hidden" name="contact_id" value={contact.id} />
                    <div>
                      <FieldLabel>Tipo</FieldLabel>
                      <select name="contact_type" defaultValue={contact.contact_type} required className={inputClass}>
                        <option value="general">Generale</option>
                        <option value="sales">Commerciale</option>
                        <option value="purchasing">Acquisti</option>
                        <option value="technical">Tecnico</option>
                        <option value="quality">Qualità</option>
                        <option value="logistics">Logistica</option>
                      </select>
                    </div>
                    <div><FieldLabel>Nome / reparto</FieldLabel><input name="display_name" defaultValue={contact.display_name ?? ""} maxLength={200} className={inputClass} /></div>
                    <div><FieldLabel>Email</FieldLabel><input type="email" name="email" defaultValue={contact.email ?? ""} maxLength={320} className={inputClass} /></div>
                    <div><FieldLabel>Telefono</FieldLabel><input name="phone" defaultValue={contact.phone ?? ""} maxLength={100} className={inputClass} /></div>
                    <div className="sm:col-span-2"><FieldLabel>URL pubblico</FieldLabel><input type="url" name="website_url" defaultValue={contact.website_url ?? ""} maxLength={500} className={inputClass} /></div>
                    <div>
                      <FieldLabel>Sede</FieldLabel>
                      <select name="facility_id" defaultValue={contact.facility_id ?? ""} className={inputClass}>
                        <option value="">Intera azienda</option>
                        {state.facilities.map((facility) => (
                          <option key={facility.id} value={facility.id}>{facility.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Visibilità</FieldLabel>
                      <select name="publication_status" defaultValue={contact.publication_status} className={inputClass}>
                        <option value="published">Pubblico</option>
                        <option value="draft">Bozza</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <button className={primaryButton}>Salva contatto</button>
                    </div>
                  </form>
                ) : (
                  <div className="grid gap-2 text-sm text-[#66778c] sm:grid-cols-2">
                    {contact.email ? <p><span className="font-semibold text-[#45566e]">Email:</span> {contact.email}</p> : null}
                    {contact.phone ? <p><span className="font-semibold text-[#45566e]">Telefono:</span> {contact.phone}</p> : null}
                    {contact.website_url ? <p className="sm:col-span-2"><span className="font-semibold text-[#45566e]">URL:</span> {contact.website_url}</p> : null}
                    <p className="sm:col-span-2 text-xs text-[#8594a7]">
                      Questo contatto proviene da Platform/crawler o ha una verifica attiva e non può essere sovrascritto direttamente dall&apos;azienda.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
          {state.contacts.length === 0 ? (
            <p className="text-sm text-[#8a98aa]">Nessun contatto pubblico configurato.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-dashed border-[#c7d5e7] bg-[#fafcff] p-5">
          <h3 className="font-semibold text-[#34445c]">Aggiungi contatto pubblico</h3>
          <p className="mt-1 text-sm text-[#718197]">
            Inserisci almeno uno tra email, telefono o URL. Il dato sarà trattato come dichiarazione pubblica dell&apos;azienda.
          </p>
          <form action={upsertManagedPublicContact} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="network_company_id" value={companyId} />
            <div>
              <FieldLabel>Tipo</FieldLabel>
              <select name="contact_type" defaultValue="general" required className={inputClass}>
                <option value="general">Generale</option>
                <option value="sales">Commerciale</option>
                <option value="purchasing">Acquisti</option>
                <option value="technical">Tecnico</option>
                <option value="quality">Qualità</option>
                <option value="logistics">Logistica</option>
              </select>
            </div>
            <div><FieldLabel>Nome / reparto</FieldLabel><input name="display_name" maxLength={200} placeholder="Es. Ufficio commerciale" className={inputClass} /></div>
            <div><FieldLabel>Email</FieldLabel><input type="email" name="email" maxLength={320} className={inputClass} /></div>
            <div><FieldLabel>Telefono</FieldLabel><input name="phone" maxLength={100} className={inputClass} /></div>
            <div className="sm:col-span-2"><FieldLabel>URL pubblico</FieldLabel><input type="url" name="website_url" maxLength={500} className={inputClass} /></div>
            <div>
              <FieldLabel>Sede</FieldLabel>
              <select name="facility_id" className={inputClass}>
                <option value="">Intera azienda</option>
                {state.facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>{facility.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Visibilità</FieldLabel>
              <select name="publication_status" defaultValue="published" className={inputClass}>
                <option value="published">Pubblico</option>
                <option value="draft">Bozza</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className={primaryButton}>Aggiungi contatto</button>
            </div>
          </form>
        </div>
      </section>

      <section className="space-y-5 rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <SectionHeader
          id="inquiries"
          eyebrow="08 · Network availability"
          title="Ricezione inquiry"
          description="Decidi se gli altri membri del Network possono contattare l'organizzazione dal profilo. La modifica non cancella lo storico."
        />
        <div className="flex flex-col gap-4 rounded-2xl border border-[#edf1f6] bg-[#fbfcfe] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#34445c]">
              {inquiryPreferences.inquiries_enabled ? "Inquiry abilitate" : "Inquiry disabilitate"}
            </p>
            <p className="mt-1 text-sm text-[#718197]">
              {inquiryPreferences.inquiries_enabled
                ? "Il profilo può ricevere nuove richieste commerciali governate."
                : "Il profilo resta visibile, ma non accetta nuove inquiry."}
            </p>
          </div>
          <form action={setInquiryPreferences}>
            <input type="hidden" name="organization_id" value={managed.organization_id} />
            <input type="hidden" name="inquiries_enabled" value={inquiryPreferences.inquiries_enabled ? "false" : "true"} />
            <button className={inquiryPreferences.inquiries_enabled ? secondaryButton : primaryButton}>
              {inquiryPreferences.inquiries_enabled ? "Disabilita inquiry" : "Abilita inquiry"}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dbe5f1] bg-[#f8faff] p-5">
        <p className="text-sm font-semibold text-[#33445e]">Governance del profilo</p>
        <p className="mt-2 text-sm leading-6 text-[#68788e]">
          Le modifiche effettuate qui sono registrate come dichiarazioni dell&apos;azienda e conservano la provenance.
          Claim, identità legale e verification restano indipendenti e sotto controllo della piattaforma.
        </p>
      </section>
    </div>
  );
}
