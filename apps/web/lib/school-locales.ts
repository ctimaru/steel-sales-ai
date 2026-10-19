import type { CalculatorSiteLocale } from "@/lib/international-calculator-landing";

/** Published School homepages. Never map languages to non-existent article translations. */
export const SCHOOL_HUB_ROUTES: Record<CalculatorSiteLocale,string> = {
  it:"/knowledge", en:"/en/knowledge", de:"/de/knowledge", fr:"/fr/knowledge", es:"/es/knowledge",
};
