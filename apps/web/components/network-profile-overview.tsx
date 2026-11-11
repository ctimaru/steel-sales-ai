import type { ReactNode } from "react";

/** NET-PROFILE-UX1.A — one commercial first screen for published and discovered companies.
 * This component is display-only: the caller supplies only already-authorized public data
 * and server-gated actions. Stock/arrivals are deliberately absent until UX1.B publication.
 */
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

  return (
    <section aria-label="Profilo aziendale" data-testid="network-profile-ux1a" className="overflow-hidden rounded-3xl border border-[#dce6e0] bg-white shadow-sm">
      <div className="border-b border-[#e6ede8] bg-gradient-to-br from-[#f3f8f5] via-white to-white px-4 py-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-start gap-3 sm:gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d6e3dc] bg-white text-lg font-bold text-[#175640] sm:h-[72px] sm:w-[72px] sm:text-xl">
            {logoUrl ? <img src={logoUrl} alt={"Logo " + name} className="max-h-full max-w-full object-contain p-2" /> : <span aria-hidden="true">{initials}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#446a5b]">Profilo aziendale</p>
            <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-[#173f35] sm:text-3xl">{name}</h1>
            {legalName && legalName !== name ? <p className="mt-1 text-xs text-[#52615b]">{legalName}</p> : null}
            {location || countryCode ? <p className="mt-1.5 text-sm text-[#52615b]">{[location, countryCode && !location?.includes(countryCode) ? countryCode : null].filter(Boolean).join(" · ")}</p> : null}
            {visibleRoles.length ? <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleRoles.map((role, index) => <span key={role} className={index === 0 ? "rounded-full bg-[#e5f1ea] px-2.5 py-1 text-xs font-semibold text-[#175640]" : "rounded-full border border-[#e0e8e2] bg-white px-2.5 py-1 text-xs text-[#43554b]"}>{role}</span>)}
            </div> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <section aria-label="Attività e prodotti" className="min-w-0 rounded-2xl border border-[#e1e9e4] bg-[#fbfcfb] p-4 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#52615b]">Attività e prodotti</p>
          <h2 className="mt-1 text-lg font-semibold text-[#173f35]">Cosa fa e cosa offre</h2>
          {description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#43524c]">{description}</p> : null}
          {!description && primaryRole ? <p className="mt-3 text-sm leading-6 text-[#43524c]">Attività classificata nel Network come {primaryRole.toLowerCase()}.</p> : null}
          {visibleProducts.length ? <div className="mt-4">
            <p className="text-xs font-semibold text-[#43524c]">Prodotti</p>
            <div className="mt-2 flex flex-wrap gap-2">{visibleProducts.map((product) => <span key={product} className="rounded-lg border border-[#cbdcd1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#285b43]">{product}</span>)}</div>
          </div> : null}
          {visibleServices.length ? <div className="mt-4">
            <p className="text-xs font-semibold text-[#43524c]">Specializzazioni e servizi</p>
            <div className="mt-2 flex flex-wrap gap-2">{visibleServices.map((service) => <span key={service} className="rounded-lg border border-[#e1e7e3] bg-white px-2.5 py-1.5 text-xs text-[#43524c]">{service}</span>)}</div>
          </div> : null}
        </section>
        <div className="min-w-0 space-y-3">
          {actions ? <section aria-label="Azioni commerciali" className="space-y-2 rounded-2xl border border-[#dce6e0] bg-white p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-[#173f35]">Azioni commerciali</h2>
            {actions}
          </section> : null}
          <section aria-label="Contatti aziendali" data-testid="network-profile-header-contact" className="rounded-2xl border border-[#dce6e0] bg-white p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-[#173f35]">Contatti</h2>
            <div className="mt-3 space-y-2 text-sm">
              {email ? <div className="min-w-0"><p className="text-[11px] text-[#65756c]">Email</p><a data-testid="network-company-public-email" href={"mailto:" + email} className="break-all font-semibold text-[#176647] underline underline-offset-2">{email}</a></div> : null}
              {phone ? <div><p className="text-[11px] text-[#65756c]">Telefono</p><a data-testid="network-company-public-phone" href={"tel:" + phone.replace(/[^\d+]/g, "")} className="font-semibold text-[#176647] underline underline-offset-2">{phone}</a></div> : null}
              {website ? <div className="min-w-0"><p className="text-[11px] text-[#65756c]">Sito ufficiale</p><a href={website} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-[#176647] underline underline-offset-2">Visita il sito ↗</a></div> : null}
              {!hasContacts ? <p className="text-xs leading-5 text-[#52615b]">Recapiti diretti non pubblicati.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
