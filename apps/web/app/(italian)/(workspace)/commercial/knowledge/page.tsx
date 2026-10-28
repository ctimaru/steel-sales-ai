import type { Metadata } from "next";
import { KnowledgeExplorer } from "@/components/knowledge-explorer";
import { privateNoIndexRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Memoria documentale · Commerciale",
  robots: privateNoIndexRobots,
};

/** Commercial Memory is a tenant-private Commercial tool; existing RLS/actions unchanged. */
export default function CommercialKnowledgePage() {
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#23694e]">Commerciale · Memoria aziendale</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#173f35]">Documenti e memoria commerciale</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52615b]">
        Cerca documenti, offerte e ordini nei limiti dei permessi della tua azienda.
        Questi contenuti non entrano nella School pubblica.
      </p>
    </header>
    <KnowledgeExplorer locale="it" />
  </main>;
}
