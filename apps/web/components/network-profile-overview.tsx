import Link from "next/link";
import type { ReactNode } from "react";
import { NetworkProfileHub, type NetworkProfileHubSection } from "@/components/network-profile-hub";

/**
 * NET-PROFILE-UX2 — the same commercial company experience in Free and Pro.
 * Receives only authorized profile data and already-gated actions from its caller.
 * Never manufactures stock, phone numbers, websites, verification or capabilities.
 */
export function NetworkProfileTopBar() {
  return (
    <nav aria-label="Percorso Network" data-testid="network-profile-breadcrumb"
      className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <Link href="/network"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dbe6df] bg-white px-3.5 text-sm font-semibold text-[#205440] transition hover:border-[#a9c9b5] hover:bg-[#f2f8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205440]">
        <span aria-hidden="true">←</span>
        <span className="sm:hidden">Network</span><span className="hidden sm:inline">Torna alle aziende</span>
      </Link>
      <span className="hidden text-xs font-medium text-[#667a6c] sm:inline">Network <span aria-hidden="true">/</span> Scheda aziendale</span>
    </nav>
  );
}

/** NET-PROFILE-UX5.C — identity, source and field provenance stay separate.
 * A sourced or claimed profile never implies a verified product or supplier. */
export type NetworkIdentityTrust = "verified" | "claimed" | "unconfirmed" | "unverified";

function NetworkProfileTrustSignals({
  identityTrust, hasWebSource, hasCompanyDeclarations, hasVerifiedFields,
}: {
  identityTrust: NetworkIdentityTrust;
  hasWebSource: boolean;
  hasCompanyDeclarations: boolean;
  hasVerifiedFields: boolean;
}) {
  const identity = identityTrust === "verified" ? "Azienda verificata"
    : identityTrust === "claimed" ? "Profilo rivendicato"
    : identityTrust === "unconfirmed" ? "Identità da confermare"
    : "Identità non verificata";
  return (
    <div data-testid="network-profile-trust-signals"
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
      <span data-testid="network-profile-identity-status"
        className="rounded-full border border-[#d5e4da] bg-[#f3f8f4] px-2.5 py-1 font-semibold text-[#315941]">{identity}</span>
      {hasWebSource ? <span className="rounded-full border border-[#dfe7e1] bg-white px-2.5 py-1 font-medium text-[#516b59]">Fonte web disponibile</span> : null}
      {hasCompanyDeclarations ? <span className="rounded-full border border-[#dfe7e1] bg-white px-2.5 py-1 font-medium text-[#516b59]">Dati dichiarati dall’azienda</span> : null}
      {hasVerifiedFields ? <span className="rounded-full border border-[#d5e4da] bg-[#ecf6ef] px-2.5 py-1 font-medium text-[#235942]">Elementi verificati</span> : null}
    </div>
  );
}

/**
 * NET-PROFILE-UX7 — compact business identity and five accessible tabs.
 * Destinations remain stable for every company, even sparse ones;
 * all visible claims and actions still come only from authorized data.
 */
export function NetworkProfileOverview({
  name,
  legalName,
  countryCode,
  location,
  primaryRole,
  roles = [],
  description,
  evidenceSourceUrl,
  sourceUrl,
  industrialSource = false,
  identityTrust = "unverified",
  hasCompanyDeclarations = false,
  hasVerifiedFields = false,
  technicalTopics = [],
  standards = [],
  products = [],
  services = [],
  website,
  email,
  phone,
  logoUrl,
  actions,
  connectionsAvailable = false,
  primaryConnectionAvailable = false,
  stockCount = 0,
  stockContent,
  hasTechnicalDetails = false,
  detailsTargetId,
}: {
  name: string;
  legalName?: string | null;
  countryCode?: string | null;
  location?: string | null;
  primaryRole?: string | null;
  roles?: string[];
  description?: string | null;
  evidenceSourceUrl?: string | null;
  sourceUrl?: string | null;
  industrialSource?: boolean;
  identityTrust?: NetworkIdentityTrust;
  hasCompanyDeclarations?: boolean;
  hasVerifiedFields?: boolean;
  technicalTopics?: string[];
  standards?: string[];
  products?: string[];
  services?: string[];
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  actions?: ReactNode;
  connectionsAvailable?: boolean;
  primaryConnectionAvailable?: boolean;
  stockCount?: number;
  stockContent?: ReactNode;
  hasTechnicalDetails?: boolean;
  detailsTargetId?: string;
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase()).join("") || "SS";
  const visibleProducts = Array.from(new Set(products.filter(Boolean))).slice(0, 12);
  const visibleServices = Array.from(new Set(services.filter(Boolean))).slice(0, 10);
  const visibleStandards = Array.from(new Set(standards.filter(Boolean))).slice(0, 12);
  const visibleRoles = Array.from(new Set([primaryRole, ...roles].filter((role): role is string => Boolean(role)))).slice(0, 3);
  const hasActivities = Boolean(description?.trim() || visibleProducts.length || visibleServices.length || visibleStandards.length);
  const hasStock = stockCount > 0 && stockContent !== undefined;
  const trustSourceUrl = sourceUrl || evidenceSourceUrl;
  const hasWebSource = Boolean(trustSourceUrl);
  const countryName = countryCode === "IT" ? "Italia" : countryCode === "RO" ? "Romania" : countryCode === "DE" ? "Germania"
    : countryCode === "FR" ? "Francia" : countryCode === "ES" ? "Spagna" : countryCode || null;
  const companyMeta = [location || countryName, primaryRole].filter(Boolean).join(" · ");
  const sectionTitleClass = "text-lg font-semibold tracking-tight text-[#173f35] sm:text-xl";
  const emptyStateClass = "border-l-2 border-[#cfe1d4] py-2 pl-3 text-sm leading-6 text-[#53675b]";
  const publicSourceLink = trustSourceUrl ? (
    <a href={trustSourceUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center rounded-xl border border-[#bad6c3] bg-[#f5faf6] px-4 text-sm font-semibold text-[#19523a] transition hover:bg-[#e9f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205a40]">
      {industrialSource ? "Consulta la fonte tecnica" : "Consulta la fonte pubblica"} <span aria-hidden="true" className="ml-2">↗</span>
    </a>
  ) : null;

  const sections: NetworkProfileHubSection[] = [
    {
      id: "attivita",
      title: "Attività e prodotti",
      summary: "Prodotti, lavorazioni, norme",
      icon: "products",
      content: (
        <section id="attivita" aria-label="Attività e prodotti" className="min-w-0 space-y-4">
          <div>
            <h3 className={sectionTitleClass}>Attività e prodotti</h3>
            <p className="mt-2 text-sm leading-6 text-[#647369]">
              Prodotti commercializzati o fabbricati, lavorazioni e competenze tecniche pubblicate.
            </p>
          </div>
          {description ? <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-[#45594c]">{description}</p> : null}
          {visibleProducts.length ? (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#2d6245]">Prodotti</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleProducts.map((product) => <span key={product}
                  className="rounded-xl border border-[#d5e6d8] bg-[#f3f9f4] px-3 py-2 text-xs font-semibold text-[#24573c]">{product}</span>)}
              </div>
            </div>
          ) : null}
          {visibleServices.length ? (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#2d6245]">Lavorazioni e specializzazioni</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleServices.map((service) => <span key={service}
                  className="rounded-xl border border-[#dfe9e0] bg-white px-3 py-2 text-xs font-medium text-[#536a58]">{service}</span>)}
              </div>
            </div>
          ) : null}
          {visibleStandards.length ? (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#2d6245]">Norme pubblicate</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleStandards.map((standard) => <span key={standard}
                  className="rounded-lg border border-[#d8e5dc] bg-[#f7faf8] px-3 py-1.5 text-xs font-semibold text-[#305d46]">{standard}</span>)}
              </div>
            </div>
          ) : null}
          {!hasActivities ? <p className={emptyStateClass}>
            Prodotti e specializzazioni non ancora pubblicati nel Network.
          </p> : null}
          {evidenceSourceUrl ? <p data-testid="network-company-source-attribution"
            className="border-t border-[#e7ece8] pt-3 text-xs leading-5 text-[#60776b]">
            Informazioni da fonte pubblica, non disponibilità a magazzino.
            <a href={evidenceSourceUrl} target="_blank" rel="noopener noreferrer"
              className="ml-1 font-semibold text-[#235c41] underline underline-offset-2">Consulta la fonte ↗</a>
          </p> : null}
        </section>
      ),
    },
    {
      id: "stock",
      title: "Stock e produzioni",
      summary: "Magazzino e prossimi arrivi",
      icon: "stock",
      count: hasStock ? stockCount : undefined,
      content: (
        <section id="stock" aria-label="Stock e produzioni" className="min-w-0 space-y-4">
          <div>
            <h3 className={sectionTitleClass}>Stock e produzioni</h3>
            <p className="mt-2 text-sm leading-6 text-[#647369]">Disponibilità pubblicate, arrivi programmati e produzioni comunicate dall'azienda.</p>
          </div>
          {hasStock ? stockContent : <p className={emptyStateClass}>
            Nessuna disponibilità o produzione pubblicata per questa azienda. Non significa che non abbia materiale.
          </p>}
        </section>
      ),
    },
    {
      id: "contatti",
      title: "Contatti e sedi",
      summary: "Recapiti e stabilimenti",
      icon: "contacts",
      content: (
        <section id="contatti" aria-label="Contatti aziendali" data-testid="network-profile-header-contact" className="min-w-0 space-y-4">
          <div>
            <h3 className={sectionTitleClass}>Contatti e sedi</h3>
            <p className="mt-2 text-sm leading-6 text-[#647369]">Solo contatti e località pubblicati nel Network.</p>
          </div>
          {location ? <p className="text-sm font-semibold text-[#345c44]">{location}</p> : null}
          {(email || phone || website) ? (
            <dl className="divide-y divide-[#e5ece7] border-y border-[#e5ece7] text-sm">
              {email ? <div className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-5">
                <dt className="w-28 shrink-0 text-xs font-semibold text-[#627466]">Email</dt>
                <dd className="min-w-0"><a data-testid="network-company-public-email" href={"mailto:" + email}
                  className="break-all font-semibold text-[#205b40] underline-offset-2 hover:underline">{email} ↗</a></dd>
              </div> : null}
              {phone ? <div className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-5">
                <dt className="w-28 shrink-0 text-xs font-semibold text-[#627466]">Telefono</dt>
                <dd className="min-w-0"><a data-testid="network-company-public-phone" href={"tel:" + phone.replace(/[^\d+]/g, "")}
                  className="font-semibold text-[#205b40] underline-offset-2 hover:underline">{phone} ↗</a></dd>
              </div> : null}
              {website ? <div className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-5">
                <dt className="w-28 shrink-0 text-xs font-semibold text-[#627466]">Sito ufficiale</dt>
                <dd className="min-w-0"><a href={website} target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-[#205b40] underline-offset-2 hover:underline">Visita il sito ↗</a></dd>
              </div> : null}
            </dl>
          ) : !location ? <p className={emptyStateClass}>Nessun recapito o stabilimento pubblicato per questa azienda.</p> : null}
        </section>
      ),
    },
    {
      id: "connessioni",
      title: "Connessioni",
      summary: "Relazioni e opportunità",
      icon: "connections",
      content: (
        <section aria-label="Connessioni" className="min-w-0 space-y-4">
          <div>
            <h3 className={sectionTitleClass}>Connessioni</h3>
            <p className="mt-2 text-sm leading-6 text-[#647369]">
              Gestisci le relazioni commerciali con questa azienda, quando consentite dal tuo accesso.
            </p>
          </div>
          {connectionsAvailable && actions ? <div data-testid="network-profile-quick-actions"
            aria-label="Azioni commerciali" className="flex max-w-sm flex-col gap-2 [&_form]:w-full [&_button]:min-h-11 [&_a]:min-h-11">
            {actions}
          </div> : (
            <p className={emptyStateClass}>
              Nessuna azione commerciale disponibile per questo profilo con i permessi attuali.
            </p>
          )}
        </section>
      ),
    },
    {
      id: "approfondimenti",
      title: "Documenti e fonti",
      summary: "Certificazioni e informazioni",
      icon: "documents",
      targetId: hasTechnicalDetails ? detailsTargetId : undefined,
      targetLabel: technicalTopics.length ? "Apri dati tecnici pubblicati" : "Apri informazioni e fonti",
      content: (
        <section aria-label="Documenti e fonti" data-testid="network-profile-trust-panel" className="min-w-0 space-y-4">
          <div>
            <h3 className={sectionTitleClass}>Documenti e fonti</h3>
            <p className="mt-2 text-sm leading-6 text-[#647369]">
              Origine delle informazioni, attendibilità ed eventuali documenti pubblicati.
            </p>
          </div>
          <NetworkProfileTrustSignals identityTrust={identityTrust} hasWebSource={hasWebSource}
            hasCompanyDeclarations={hasCompanyDeclarations} hasVerifiedFields={hasVerifiedFields} />
          <p className="max-w-3xl text-sm leading-6 text-[#566b5d]">
            Un profilo rivendicato indica chi lo gestisce. La verifica riguarda l'azienda o singoli dati:
            non garantisce capacità di fornitura, stock o certificazioni non pubblicate.
          </p>
          {publicSourceLink || <p className={emptyStateClass}>Nessuna fonte web consultabile pubblicata per questa scheda.</p>}
          {industrialSource && publicSourceLink ? <p className="text-xs leading-5 text-[#526c60]" data-testid="network-industrial-source-disclaimer">
            Fonte industriale osservata e collegata alla scheda. Non equivale a conferma dell'azienda, certificazione o disponibilità di una misura.
          </p> : null}
          {technicalTopics.length ? <div className="border-t border-[#e7ece8] pt-4">
            <p className="text-sm font-semibold text-[#2e5941]">Informazioni presenti nel Network</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {technicalTopics.slice(0, 6).map((topic) =>
                <span key={topic} className="rounded-lg border border-[#dce8df] bg-[#f7faf8] px-2.5 py-1 text-xs font-medium text-[#526b59]">{topic}</span>)}
            </div>
          </div> : null}
        </section>
      ),
    },
  ];

  return (
    <article aria-label="Profilo aziendale" data-testid="network-profile-ux1a"
      data-profile-density={hasActivities || hasStock ? "rich" : "compact"}
      data-profile-layout="compact-tabs"
      className="min-w-0 space-y-4">
      <header className="min-w-0 border-b border-[#dce7df] pb-4 pt-1 sm:pb-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e6f0e9] text-lg font-extrabold tracking-tight text-[#145b40] sm:h-16 sm:w-16 sm:text-xl">
              {logoUrl ? <img src={logoUrl} alt={"Logo " + name} className="max-h-full max-w-full object-contain p-1.5" /> : <span aria-hidden="true">{initials}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#548068]">Network · Scheda aziendale</p>
              <h1 className="mt-1 break-words text-[25px] font-semibold leading-[1.12] tracking-[-0.03em] text-[#173b2b] sm:text-[32px]">{name}</h1>
              {legalName && legalName !== name ? <p className="mt-1 break-words text-xs text-[#6b7c70]">{legalName}</p> : null}
              {companyMeta ? <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#536c5c]">{companyMeta}</p> : null}
              {!primaryRole && visibleRoles.length ? <p className="mt-1 text-xs text-[#536c5c]">{visibleRoles.join(" · ")}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end"
            data-testid="network-profile-hero-actions">
            <span className="inline-flex min-h-9 items-center rounded-lg bg-[#eef5f0] px-2.5 text-[11px] font-semibold text-[#3f6750]">
              {identityTrust === "verified" ? "Azienda verificata" :
                identityTrust === "claimed" ? "Profilo rivendicato" :
                identityTrust === "unconfirmed" ? "Identità da confermare" : "Identità non verificata"}
            </span>
            {website ? <a href={website} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#a9cbb5] bg-white px-3.5 text-[13px] font-semibold text-[#215840] transition hover:bg-[#f1f8f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#276a4d]">
              Sito aziendale <span aria-hidden="true">↗</span>
            </a> : null}
          </div>
        </div>
      </header>

      <NetworkProfileHub sections={sections} />
    </article>
  );
}
