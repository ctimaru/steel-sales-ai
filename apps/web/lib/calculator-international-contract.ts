/**
 * CALC-INT1: immutable public calculator URL / workflow contract.
 *
 * Existing Italian and English URLs must not be renamed: Search Console,
 * internal links and the calculator -> bill of materials handoff use them.
 * Upcoming translations are NOT published routes until an actual localized
 * page, translated calculator UI, HTML lang and reciprocal hreflang exist.
 *
 * This module intentionally has no Next.js or browser dependencies so it can
 * be checked by the SEO/route regression suite.
 */
export const PUBLISHED_CALCULATOR_LOCALES = ["it", "en"] as const;
export type PublishedCalculatorLocale = (typeof PUBLISHED_CALCULATOR_LOCALES)[number];

export const PLANNED_CALCULATOR_LOCALES = ["de", "fr", "es"] as const;
export type PlannedCalculatorLocale = (typeof PLANNED_CALCULATOR_LOCALES)[number];

export const CALCULATOR_PUBLIC_ROUTES = {
  it: {
    calculator: "/knowledge/tubes",
    rfqBill: "/distinta",
    documentLanguage: "it",
  },
  en: {
    calculator: "/en/knowledge/tubes",
    rfqBill: "/en/distinta",
    documentLanguage: "en",
  },
} as const satisfies Record<PublishedCalculatorLocale, {
  calculator: `/${string}`;
  rfqBill: `/${string}`;
  documentLanguage: string;
}>;

/**
 * Reserved paths are for planning only: do not create hreflang or sitemap
 * entries for these until CALC-INT4/5 content and release gates are complete.
 * Keeping the same slug avoids a redirect/migration of already indexed URLs.
 */
export const RESERVED_CALCULATOR_PATHS = {
  de: "/de/knowledge/tubes",
  fr: "/fr/knowledge/tubes",
  es: "/es/knowledge/tubes",
} as const satisfies Record<PlannedCalculatorLocale, `/${string}`>;

export function publishedCalculatorAlternatePaths(): Record<PublishedCalculatorLocale, string> {
  return {
    it: CALCULATOR_PUBLIC_ROUTES.it.calculator,
    en: CALCULATOR_PUBLIC_ROUTES.en.calculator,
  };
}

export function isPublishedCalculatorLocale(locale: string): locale is PublishedCalculatorLocale {
  return PUBLISHED_CALCULATOR_LOCALES.some((value) => value === locale);
}
