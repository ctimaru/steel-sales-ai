import Link from "next/link";

import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import type { InvestorScope } from "@/lib/investor-business-plan";
import {
  assetLabel,
  getInvestorNarrative,
  marketingAssets,
  type MarketingAsset,
} from "@/lib/marketing-investor-narrative";
import { appRoutes } from "@/lib/routes";

function maturityLabel(value: MarketingAsset["maturity"], locale: BusinessPlanLocale) {
  if (locale === "it") {
    return value === "approved" ? "Approvato" : value === "draft" ? "Bozza" : "Pianificato";
  }
  return value === "approved" ? "Approved" : value === "draft" ? "Draft" : "Planned";
}

function visibilityLabel(value: MarketingAsset["visibility"], locale: BusinessPlanLocale) {
  if (value === "internal") return locale === "it" ? "Solo interno" : "Internal only";
  if (value === "scope_business_plan") return "Business Plan scope";
  if (value === "scope_kpi") return "KPI scope";
  return locale === "it" ? "Investor-visible" : "Investor-visible";
}

function assetHref(
  asset: MarketingAsset,
  investorMode: boolean,
  inviteToken: string | undefined,
  scopes: readonly InvestorScope[],
) {
  if (asset.key === "public-demo") return appRoutes.publicHome;

  if (!investorMode) {
    if (asset.key === "business-plan") return appRoutes.platform.businessPlan;\n    if (asset.key === "one-pager") return appRoutes.platform.marketingOnePager;\n    if (asset.key === "pitch-deck-foundation") return appRoutes.platform.marketingPitchDeck;
    if (asset.key === "kpi-dashboard") return appRoutes.platform.investorKpis;
    if (asset.key === "brand-system" || asset.key === "investor-narrative") {
      return appRoutes.platform.marketing;
    }
    return null;
  }

  if (!inviteToken) return null;
  if (asset.requiredScope && !scopes.includes(asset.requiredScope)) return null;

  if (asset.key === "business-plan") return `/investor/business-plan/${inviteToken}`;\n  if (asset.key === "one-pager") return `/investor/marketing/${inviteToken}/one-pager`;
  if (asset.key === "kpi-dashboard") return `/investor/kpi/${inviteToken}`;
  if (asset.key === "brand-system" || asset.key === "investor-narrative") {
    return `/investor/marketing/${inviteToken}`;
  }

  return null;
}

export function InvestorNarrativeLibrary({
  locale = "it",
  investorMode = false,
  inviteToken,
  scopes = [],
}: {
  locale?: BusinessPlanLocale;
  investorMode?: boolean;
  inviteToken?: string;
  scopes?: readonly InvestorScope[];
}) {
  const copy = getInvestorNarrative(locale);
  const assets = marketingAssets.filter((asset) => {
    if (!investorMode) return true;
    if (asset.visibility === "internal") return false;
    return !asset.requiredScope || scopes.includes(asset.requiredScope);
  });

  return (
    <div className="space-y-6">
      <section id="investor-narrative" className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--steel-blue-soft)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">
              MKT2 · Investor Narrative
            </span>
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              {copy.stage}
            </span>
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-[var(--text-primary)] sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">{copy.lead}</p>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {copy.cards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">{card.label}</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{card.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl bg-[var(--brand-primary-soft)] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-deep)]">
              Evidence
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--brand-deep)]">{copy.evidenceTitle}</h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--text-primary)]">
              {copy.evidence.map((item) => <li key={item}>✓ {item}</li>)}
            </ul>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--semantic-warning)]">
              Validation gap
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{copy.gapsTitle}</h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
              {copy.gaps.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </article>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--steel-blue-soft)] p-4 text-sm font-medium leading-6 text-[var(--text-primary)]">
          {copy.principle}
        </div>
      </section>

      <section id="asset-library" className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-kicker">MKT2 · Asset Library</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {locale === "it" ? "Materiali governati" : "Governed materials"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {investorMode
                ? locale === "it"
                  ? "Sono mostrati soltanto i materiali consentiti dagli scope di questo invito."
                  : "Only materials allowed by this invitation's scopes are shown."
                : locale === "it"
                  ? "La libreria separa ciò che è approvato, ciò che resta interno e ciò che deve ancora essere prodotto."
                  : "The library separates approved material, internal-only work and assets that still need to be produced."}
            </p>
          </div>
          {!investorMode ? (
            <Link
              href={appRoutes.platform.investorAccess}
              className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold"
            >
              {locale === "it" ? "Gestisci accessi" : "Manage access"}
            </Link>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const copy = assetLabel(asset, locale);
            const href = assetHref(asset, investorMode, inviteToken, scopes);
            return (
              <article key={asset.key} className="flex min-h-56 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    {asset.category}
                  </span>
                  <span className={[
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                    asset.maturity === "approved"
                      ? "bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]"
                      : asset.maturity === "draft"
                        ? "bg-[var(--steel-blue-soft)] text-[var(--steel-blue)]"
                        : "bg-amber-50 text-amber-800",
                  ].join(" ")}>
                    {maturityLabel(asset.maturity, locale)}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{copy.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{copy.detail}</p>
                <div className="mt-auto pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    {visibilityLabel(asset.visibility, locale)} · {copy.source}
                  </p>
                  {href ? (
                    <Link
                      href={href}
                      className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 text-xs font-semibold text-[var(--brand-deep)] hover:border-[var(--brand-primary)]"
                    >
                      {locale === "it" ? "Apri asset" : "Open asset"}
                    </Link>
                  ) : (
                    <span className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-dashed border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-tertiary)]">
                      {locale === "it" ? "Non pubblicato" : "Not published"}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
