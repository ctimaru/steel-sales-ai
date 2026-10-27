import type { Metadata } from "next";
import { HomeCalculatorEmbedStyle } from "@/components/home-calculator-embed-style";
import { CalculatorRegionSwitch } from "@/components/calculator-region-switch";
import { listPublicTubeDimensionPages } from "@/lib/public-knowledge";

export const metadata: Metadata = { title: "Calcolatrice tecnica", robots: { index: false, follow: false } };

/** Embedded working surface only. Uses the exact calculator and bill engine from School. */
export default async function EmbeddedCalculatorIt() {
  const references = await listPublicTubeDimensionPages();
  return (
    <main data-calculator-embed="it" className="min-h-screen bg-[#f2f4f3] px-2 py-2 sm:px-3">
      <CalculatorRegionSwitch locale="it" initialRegion="eu" references={references} />
      <HomeCalculatorEmbedStyle />
    </main>
  );
}
