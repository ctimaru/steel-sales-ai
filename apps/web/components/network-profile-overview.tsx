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
      <span className="hidden text-xs font-medium text-[#667a6c] sm:inline">Network <span aria-hidden="true">/</span> Profilo azienda</span>
    </nav>
  );
}

export function NetworkProfileOverview({
  name,
  legalName,
  countryCode,
  location,
  primaryRole,
  roles = [],
  description,
  evidenceSourceUrl,
  products = [],
  services = [],
  website,
  email,
  phone,
  logoUrl,
  actions,
  connectionsAvailable = false,
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
  products?: string[];
  services?: string[];
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  actions?: ReactNode;
  connectionsAvailable?: boolean;
  stockCount?: number;
  stockContent?: ReactNode;
  hasTechnicalDetails?: boolean;
  detailsTargetId?: string;
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word.slice(0, 1).toUpperCase()).join("") || "SS";
  const visibleRoles = Array.from(new Set([primaryRole, ...roles].filter((role): role is string => Boolean(role)))).slice(0, 4);
  const visibleProducts = Array.from(new Set(products.filter(Boolean))).slice(0, 8);
  const visibleServices = Array.from(new Set(services.filter(Boolean))).slice(0, 6);
  const hasContacts = Boolean(email || phone || website);
  const hasCommercialDetails = Boolean(description || visibleProducts.length || visibleServices.length || visibleRoles.length);
  // NET-PROFILE-UX3: a directory entry is not a catalogue. For companies
  // without declared activity, products or services do not render a vacant
  // two-column content section. The website is the useful first action.
  const hasPublishedActivities = Boolean(description?.trim() || visibleProducts.length || visibleServices.length);

  if (!hasPublishedActivities && !stockCount && !hasTechnicalDetails) {
    return (
      <article aria-label="Profilo aziendale" data-testid="network-profile-ux1a"
        data-profile-density="compact"
        className="min-w-0 overflow-hidden rounded-[24px] border border-[#d8e6dc] bg-white shadow-[0_14px_38px_-32px_rgba(15,65,40,0.38)]">
        <div className="h-1 bg-[#1a6044]" aria-hidden="true" />
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div id="attivita" className="min-w-0 px-4 py-5 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#466d52]">Azienda nel Network</p>
            <div className="mt-4 flex min-w-0 items-start gap-3.5 sm:gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d7e5db] bg-[#f3f8f4] text-lg font-extrabold tracking-tight text-[#155338] sm:h-[72px] sm:w-[72px] sm:text-[22px]">
                {logoUrl ? <img src={logoUrl} alt={"Logo " + name} className="max-h-full max-w-full object-contain p-2" /> : <span aria-hidden="true">{initials}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-[26px] font-semibold leading-[1.13] tracking-[-0.035em] text-[#163d2a] sm:text-[34px]">{name}</h1>
                {legalName && legalName !== name ? <p className="mt-1.5 break-words text-xs text-[#5d7062] sm:text-sm">{legalName}</p> : null}
                {(location || countryCode) ? <p className="mt-2 text-sm font-medium text-[#5b705f]">{[location, countryCode && !location?.includes(countryCode) ? countryCode : null].filter(Boolean).join(" · ")}</p> : null}
                {visibleRoles.length ? <div className="mt-3 flex flex-wrap gap-1.5">
                  {visibleRoles.map((role,index)=><span key={role} className={index===0
                    ? "rounded-full bg-[#e3f0e7] px-3 py-1 text-xs font-semibold text-[#1b5b3d]"
                    : "rounded-full border border-[#dfe8e1] bg-white px-3 py-1 text-xs font-medium text-[#496954]"}>{role}</span>)}
                </div> : null}
              </div>
            </div>
            <p className="mt-5 max-w-[580px] border-t border-[#ebf0eb] pt-3 text-xs leading-5 text-[#637467]">
              Prodotti e specializzazioni non ancora pubblicati nel Network.
            </p>
          </div>
          <aside id="contatti" aria-label="Contatti aziendali" data-testid="network-profile-header-contact"
            className="flex min-w-0 flex-col justify-center gap-3 border-t border-[#e2eae3] bg-[#f8fbf8] px-4 py-4 sm:px-7 lg:border-l lg:border-t-0 lg:px-5 lg:py-6">
            {hasContacts ? <section aria-label="Contatti disponibili" className="space-y-2">
              {website ? <a href={website} target="_blank" rel="noopener noreferrer"
                className="app-primary flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17553b]">
                <span>Visita il sito aziendale</span><span aria-hidden="true">↗</span>
              </a> : null}
              {email ? <a data-testid="network-company-public-email" href={"mailto:" + email}
                className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-[#d8e5db] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#205c40]">
                <span className="break-all">{email}</span><span aria-hidden="true">↗</span>
              </a> : null}
              {phone ? <a data-testid="network-company-public-phone" href={"tel:" + phone.replace(/[^\d+]/g,"")}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#d8e5db] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#205c40]">
                <span>{phone}</span><span aria-hidden="true">↗</span>
              </a> : null}
            </section> : null}
            {actions ? <section aria-label="Azioni commerciali"
              className="space-y-2 [&_form]:w-full [&_button]:min-h-11 [&_a]:min-h-11">{actions}</section> : null}
            {!hasContacts && !actions ? <p className="text-xs leading-5 text-[#6a7b6e]">Nessun recapito pubblico disponibile.</p> : null}
          </aside>
        </div>
      </article>
    );
  }

const sections: NetworkProfileHubSection[] = [];
  if (hasPublishedActivities) {
    sections.push({
      id: "attivita",
      title: "Attività e prodotti",
      summary: visibleProducts.length ? String(visibleProducts.length) + " categorie di prodotto" : "Competenze e specializzazioni",
      icon: "products",
      content: (
        <section id="attivita" aria-label="Attività e prodotti" className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4b765b]">Attività e prodotti</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#173f35]">Cosa fa e cosa offre</h3>
          {description ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-[#47594d]">{description}</p> : null}
          {visibleProducts.length ? (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-[#315540]">Prodotti</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleProducts.map((product) => <span key={product}
                  className="rounded-xl border border-[#cfe0d2] bg-[#f4f9f5] px-3 py-2 text-xs font-semibold leading-5 text-[#24553a]">{product}</span>)}
              </div>
            </div>
          ) : null}
          {visibleServices.length ? (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-[#315540]">Specializzazioni e servizi</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleServices.map((service) => <span key={service}
                  className="rounded-xl border border-[#dce6df] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#4d6656]">{service}</span>)}
              </div>
            </div>
          ) : null}
          {evidenceSourceUrl ? <p data-testid="network-company-source-attribution"
            className="mt-4 border-t border-[#e5ece6] pt-3 text-xs text-[#61766a]">
            Informazioni da fonte pubblica, non disponibilità a magazzino.
            <a href={evidenceSourceUrl} target="_blank" rel="noopener noreferrer"
              className="ml-1 font-semibold text-[#205c40] underline underline-offset-2">Consulta la fonte ↗</a>
          </p> : null}
        </section>
      ),
    });
  }

  if (hasContacts) {
    sections.push({
      id: "contatti",
      title: "Contatti e sedi",
      summary: [email ? "Email" : null, phone ? "Telefono" : null, website ? "Sito ufficiale" : null]
        .filter(Boolean).join(" · "),
      icon: "contacts",
      content: (
        <section id="contatti" aria-label="Contatti aziendali" data-testid="network-profile-header-contact">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4b765b]">Canali pubblici</p>
          <h3 className="mt-1 text-xl font-semibold text-[#173f35]">Contatti</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {email ? <a data-testid="network-company-public-email" href={"mailto:" + email}
              className="min-w-0 rounded-xl border border-[#dce6df] bg-[#fbfdfb] p-3 text-sm font-semibold text-[#205b40] hover:border-[#9ec2a9]">
              <span className="mb-1 block text-xs font-medium text-[#627466]">Email</span>
              <span className="block break-all">{email} ↗</span>
            </a> : null}
            {phone ? <a data-testid="network-company-public-phone" href={"tel:" + phone.replace(/[^\d+]/g, "")}
              className="min-w-0 rounded-xl border border-[#dce6df] bg-[#fbfdfb] p-3 text-sm font-semibold text-[#205b40] hover:border-[#9ec2a9]">
              <span className="mb-1 block text-xs font-medium text-[#627466]">Telefono</span>
              <span>{phone} ↗</span>
            </a> : null}
            {website ? <a href={website} target="_blank" rel="noopener noreferrer"
              className="min-w-0 rounded-xl border border-[#dce6df] bg-[#fbfdfb] p-3 text-sm font-semibold text-[#205b40] hover:border-[#9ec2a9]">
              <span className="mb-1 block text-xs font-medium text-[#627466]">Sito ufficiale</span>
              <span>Visita il sito ↗</span>
            </a> : null}
          </div>
        </section>
      ),
    });
  }

  if (stockCount > 0 && stockContent) {
    sections.push({
      id: "stock",
      title: "Stock e produzioni",
      summary: String(stockCount) + (stockCount === 1 ? " posizione pubblicata" : " posizioni pubblicate"),
      icon: "stock",
      content: stockContent,
    });
  }

  if (connectionsAvailable && actions) {
    sections.push({
      id: "connessioni",
      title: "Connessioni",
      summary: "Salva, connetti e collabora",
      icon: "connections",
      content: <section id="azioni" aria-label="Azioni commerciali" className="max-w-md">
        <h3 className="text-lg font-semibold text-[#173f35]">Azioni commerciali</h3>
        <div className="mt-3 space-y-2 [&_button]:min-h-11 [&_a]:min-h-11">{actions}</div>
      </section>,
    });
  }

  if (hasTechnicalDetails && detailsTargetId) {
    sections.push({
      id: "approfondimenti",
      title: "Dati e documenti",
      summary: "Sedi, norme, fonti e certificazioni",
      icon: "documents",
      targetId: detailsTargetId,
    });
  }

  return (
    <article aria-label="Profilo aziendale" data-testid="network-profile-ux1a" data-profile-density="rich"
      className="min-w-0 space-y-4 sm:space-y-5">
      <header className="min-w-0 overflow-hidden rounded-[24px] border border-[#d9e5dc] bg-white shadow-[0_12px_32px_-26px_rgba(17,65,43,0.35)]">
        <div className="h-1.5 bg-[#1b5c40]" aria-hidden="true" />
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_308px] lg:items-start">
          <div className="min-w-0 p-4 sm:p-6 lg:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f745c]">Azienda nel Network</p>
            <div className="mt-3 flex min-w-0 items-start gap-3.5 sm:gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d7e5db] bg-[#f3f8f4] text-lg font-extrabold tracking-tight text-[#155338] sm:h-[76px] sm:w-[76px]">
                {logoUrl ? <img src={logoUrl} alt={"Logo " + name} className="max-h-full max-w-full object-contain p-2" /> : <span aria-hidden="true">{initials}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-xl font-semibold leading-[1.14] tracking-[-0.035em] text-[#163d2a] sm:text-[34px]">{name}</h1>
                {legalName && legalName !== name ? <p className="mt-1.5 break-words text-xs text-[#5d7062]">{legalName}</p> : null}
                {location || countryCode ? <p className="mt-2 text-sm font-medium text-[#5b705f]">
                  {[location, countryCode && !location?.includes(countryCode) ? countryCode : null].filter(Boolean).join(" · ")}
                </p> : null}
                {visibleRoles.length ? <div className="mt-3 flex flex-wrap gap-1.5">
                  {visibleRoles.map((role,index)=><span key={role} className={index===0
                    ? "rounded-full bg-[#e3f0e7] px-3 py-1 text-xs font-semibold text-[#1b5b3d]"
                    : "rounded-full border border-[#dfe8e1] bg-white px-3 py-1 text-xs font-medium text-[#496954]"}>{role}</span>)}
                </div> : null}
              </div>
            </div>
            {description ? <p className="mt-4 line-clamp-2 text-xs leading-5 text-[#52655a] sm:text-sm">{description}</p> : null}
          </div>
          <aside className="min-w-0 border-t border-[#e2eae3] bg-[#f8fbf8] p-4 sm:px-6 lg:border-l lg:border-t-0 lg:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#496b54]">Accesso rapido</p>
            {website ? <a href={website} target="_blank" rel="noopener noreferrer"
              className="app-primary mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white">
              <span>Visita il sito aziendale</span><span aria-hidden="true">↗</span>
            </a> : null}
            <p className="mt-3 text-xs leading-5 text-[#687b6d]">
              Esplora prodotti, contatti e informazioni pubblicate selezionando le card.
            </p>
          </aside>
        </div>
      </header>

      <NetworkProfileHub sections={sections} />
    </article>
  );
}
