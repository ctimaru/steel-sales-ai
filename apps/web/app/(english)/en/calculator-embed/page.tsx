import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { HomeCalculatorEmbedStyle } from "@/components/home-calculator-embed-style";
import { CalculatorRegionSwitch } from "@/components/calculator-region-switch";
import { listPublicTubeDimensionPages } from "@/lib/public-knowledge";

export const metadata: Metadata = { title: "Steel tube calculator", robots: { index: false, follow: false } };
const cachedReferences = unstable_cache(listPublicTubeDimensionPages, ["home-calc-embed1-references"], { revalidate: 86400 });

/** Same shared technical calculator and inline bill, without a second site shell. */
export default async function EmbeddedCalculatorEn() {
  const references = await cachedReferences();
  return (
    <main data-calculator-embed="en" className="min-h-screen bg-[#f2f4f3] px-2 py-2 sm:px-3">
      <CalculatorRegionSwitch locale="en" initialRegion="eu" references={references} />
      <HomeCalculatorEmbedStyle />
    </main>
  );
}
