/**
 * CALC-INT1 + CALC-INT3E.1: published public calculator routing contract.
 * Legacy IT/EN paths stay fixed; translated DE/FR/ES pages are now live.
 * The three newer languages use the English RFQ bill until that workflow
 * is independently localized. This contract makes that limitation explicit.
 * No redirects based on IP/browser language or unverified alternate URLs.
 */
export const PUBLISHED_CALCULATOR_LOCALES=["it","en","de","fr","es"] as const;
export type PublishedCalculatorLocale=(typeof PUBLISHED_CALCULATOR_LOCALES)[number];

/** No other locale may enter sitemap/hreflang without a real published page. */
export const PLANNED_CALCULATOR_LOCALES=[] as const;
export type PlannedCalculatorLocale=(typeof PLANNED_CALCULATOR_LOCALES)[number];

export const CALCULATOR_PUBLIC_ROUTES={
  it:{calculator:"/knowledge/tubes",rfqBill:"/distinta",documentLanguage:"it"},
  en:{calculator:"/en/knowledge/tubes",rfqBill:"/en/distinta",documentLanguage:"en"},
  de:{calculator:"/de/knowledge/tubes",rfqBill:"/en/distinta",documentLanguage:"de"},
  fr:{calculator:"/fr/knowledge/tubes",rfqBill:"/en/distinta",documentLanguage:"fr"},
  es:{calculator:"/es/knowledge/tubes",rfqBill:"/en/distinta",documentLanguage:"es"},
} as const satisfies Record<PublishedCalculatorLocale,{
  calculator:`/${string}`;
  rfqBill:`/${string}`;
  documentLanguage:string;
}>;

export const RESERVED_CALCULATOR_PATHS={} as const;

export function publishedCalculatorAlternatePaths():Record<PublishedCalculatorLocale,string>{
  return Object.fromEntries(
    PUBLISHED_CALCULATOR_LOCALES.map(l=>[l,CALCULATOR_PUBLIC_ROUTES[l].calculator]),
  ) as Record<PublishedCalculatorLocale,string>;
}
export function isPublishedCalculatorLocale(locale:string):locale is PublishedCalculatorLocale{
  return PUBLISHED_CALCULATOR_LOCALES.some(value=>value===locale);
}
