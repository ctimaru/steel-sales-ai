import Link from "next/link";
import type { ReactNode } from "react";

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
  products = [],
  services = [],
  website,
  email,
  phone,
  logoUrl,
  actions,
}: {
  name: string;
  legalName?: string | null;
  countryCode?: string | null;
  location?: string | null;
  primaryRole?: string | null;
  roles?: string[];
  description?: string | null;
  products?: string[];
  services?: string[];
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  actions?: ReactNode;
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

  if (!hasPublishedActivities) {
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
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-[#17553b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#23684b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17553b]">
                <span>Visita il sito aziendale</span><span aria-hidden="true">↗</span>
              </a> : null}
              {email ? <a data-testid="network-company-public-email" href={"mailto:" + email}
                className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-[#d8e5db] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#205c40]">
                <span className="break-all">{email}</span><span aria-hidden="true">↗</span>
              </a> : null}
              {phone ? <a data-testid="network-company-public-phone" href={"tel:" + phone.replace(/[^\\d+]/g,"")}
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

  return (
    <article aria-label="Profilo aziendale" data-testid="network-profile-ux1a"
      className="isolate min-w-0 overflow-hidden rounded-[26px] border border-[#d9e5dc] bg-white shadow-[0_12px_32px_-26px_rgba(17,65,43,0.35)] sm:rounded-[30px]">
      <div className="h-1.5 bg-[#1b5c40]" aria-hidden="true" />
      <div className="bg-[linear-gradient(120deg,#f0f7f2_0%,#ffffff_68%)] px-4 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-7 lg:px-9">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#32654b]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#287e55]" aria-hidden="true" />
          Network
          <span className="font-medium text-[#6d8375]">/ Scheda aziendale</span>
        </div>
        <div className="mt-4 grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 sm:mt-5 sm:grid-cols-[82px_minmax(0,1fr)] sm:gap-x-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#d6e4da] bg-white text-lg font-extrabold tracking-[-0.06em] text-[#16523a] shadow-sm sm:h-[82px] sm:w-[82px] sm:rounded-[22px] sm:text-2xl">
            {logoUrl ? <img src={logoUrl} alt={"Logo " + name} className="max-h-full max-w-full object-contain p-2" /> : <span aria-hidden="true">{initials}</span>}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold leading-[1.14] tracking-[-0.035em] text-[#163b2c] sm:text-[32px] lg:text-[38px]">{name}</h1>
            {legalName && legalName !== name ? <p className="mt-1.5 break-words text-xs text-[#5a6c5f] sm:text-sm">{legalName}</p> : null}
            {location || countryCode ? (
              <p className="mt-2 break-words text-xs font-medium text-[#526a5b] sm:text-sm">
                {[location, countryCode && !location?.includes(countryCode) ? countryCode : null].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          {visibleRoles.length ? (
            <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:col-start-2">
              {visibleRoles.map((role,index) => (
                <span key={role} className={index === 0
                  ? "inline-flex items-center rounded-full bg-[#dcece1] px-3 py-1 text-[11px] font-bold text-[#174d36]"
                  : "inline-flex items-center rounded-full border border-[#d7e3d9] bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#4b6555]"}>
                  {role}
                </span>
              ))}
            </div>
          ) : null}
          {description ? <p className="col-span-2 mt-1 line-clamp-2 text-xs leading-5 text-[#43524c] sm:hidden">{description}</p> : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1fr)_308px] lg:items-start">
        <div className="order-2 min-w-0 border-t border-[#e5ece6] px-4 py-5 sm:px-7 sm:py-7 lg:order-1 lg:border-r lg:border-t-0 lg:px-9">
          <section id="attivita" aria-label="Attività e prodotti" className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#62806b]">Attività e prodotti</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-[#193d2d] sm:text-[23px]">Cosa fa e cosa offre</h2>
            {description ? (
              <p className="mt-3 max-w-[680px] whitespace-pre-wrap text-sm leading-7 text-[#47594d] sm:text-[15px]">{description}</p>
            ) : null}
            {!description && primaryRole ? (
              <p className="mt-3 text-sm leading-6 text-[#526a59]">Attività classificata nel Network come {primaryRole.toLowerCase()}.</p>
            ) : null}
            {visibleProducts.length ? (
              <div className="mt-5">
                <h3 className="text-xs font-semibold text-[#315540]">Prodotti</h3>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {visibleProducts.map((product) => (
                    <span key={product} className="rounded-xl border border-[#cfe0d2] bg-[#f4f9f5] px-3 py-2 text-xs font-semibold leading-5 text-[#24553a]">{product}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {visibleServices.length ? (
              <div className="mt-5">
                <h3 className="text-xs font-semibold text-[#315540]">Specializzazioni e servizi</h3>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {visibleServices.map((service) => (
                    <span key={service} className="rounded-xl border border-[#e1e9e2] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#4d6656]">{service}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {!hasCommercialDetails ? (
              <p className="mt-3 text-sm leading-6 text-[#65776b]">Informazioni commerciali non ancora pubblicate dall'azienda.</p>
            ) : null}
          </section>
        </div>

        <div className="order-1 min-w-0 border-t border-[#e5ece6] bg-[#fafcf9] px-4 py-4 sm:px-7 sm:py-5 lg:order-2 lg:px-5 lg:py-6">
          {actions ? (
            <section aria-label="Azioni commerciali" className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#446a50]">Azioni commerciali</h2>
                <span aria-hidden="true" className="text-[#74917d]">↗</span>
              </div>
              <div className="mt-3 space-y-2.5 [&_form]:w-full [&_button]:min-h-11 [&_a]:min-h-11">
                {actions}
              </div>
            </section>
          ) : null}
          <section id="contatti" aria-label="Contatti aziendali" data-testid="network-profile-header-contact"
            className={actions ? "mt-5 border-t border-[#dce8dc] pt-4" : ""}>
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#446a50]">Contatti</h2>
            {hasContacts ? (
              <div className="mt-3 space-y-2">
                {email ? (
                  <a data-testid="network-company-public-email" href={"mailto:" + email}
                    className="group flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#e0e9e0] bg-white px-3 py-2.5 text-xs font-semibold text-[#205d40] transition hover:border-[#abcab4] hover:bg-[#f2f8f4]">
                    <span className="min-w-0"><span className="block text-[10px] font-medium text-[#63766a]">Email</span><span className="block break-all">{email}</span></span>
                    <span aria-hidden="true" className="shrink-0">↗</span>
                  </a>
                ) : null}
                {phone ? (
                  <a data-testid="network-company-public-phone" href={"tel:" + phone.replace(/[^\d+]/g, "")}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#e0e9e0] bg-white px-3 py-2.5 text-xs font-semibold text-[#205d40] transition hover:border-[#abcab4] hover:bg-[#f2f8f4]">
                    <span><span className="block text-[10px] font-medium text-[#63766a]">Telefono</span>{phone}</span><span aria-hidden="true">↗</span>
                  </a>
                ) : null}
                {website ? (
                  <a href={website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#e0e9e0] bg-white px-3 py-2.5 text-xs font-semibold text-[#205d40] transition hover:border-[#abcab4] hover:bg-[#f2f8f4]">
                    <span><span className="block text-[10px] font-medium text-[#63766a]">Sito ufficiale</span>Visita il sito</span><span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-[#617468]">Recapiti diretti non pubblicati.</p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
