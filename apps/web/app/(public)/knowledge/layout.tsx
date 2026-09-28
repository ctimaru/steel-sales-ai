import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProductBrand } from "@/components/product-brand";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: "Steel Knowledge",
    template: "%s · Steel Knowledge · Steel Sales AI",
  },
  description:
    "Norme, gradi di acciaio, dimensioni, pesi e strumenti tecnici per chi lavora nel settore steel e tube.",
  alternates: {
    canonical: absoluteUrl("/knowledge"),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PublicKnowledgeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#1e2b45]">
      <header className="border-b border-[#e3eaf5] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <ProductBrand href="/" />
            <Link
              href="/knowledge"
              className="hidden border-l border-[#e3eaf5] pl-5 text-sm font-semibold text-[#40516a] hover:text-[#2f6fed] sm:block"
            >
              Steel Knowledge
            </Link>
          </div>

          <nav className="flex items-center gap-2" aria-label="Navigazione Steel Knowledge">
            <Link
              href="/knowledge"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#5f7088] hover:bg-[#f5f8fc] hover:text-[#2f6fed] md:inline-flex"
            >
              Knowledge
            </Link>
            <Link
              href="/knowledge/tubes"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#5f7088] hover:bg-[#f5f8fc] hover:text-[#2f6fed] md:inline-flex"
            >
              Pesi & dimensioni
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[#dbe5f1] bg-white px-3.5 py-2 text-sm font-semibold text-[#40516a] hover:border-[#bdd1f4] hover:bg-[#f3f7ff] hover:text-[#2f6fed]"
            >
              Accedi
            </Link>
            <Link
              href="/register"
              className="hidden rounded-xl bg-[#2f6fed] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#245ed1] sm:inline-flex"
            >
              Registra azienda
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t border-[#e3eaf5] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-[#68788e] sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="font-semibold text-[#1e2b45]">Steel Knowledge</p>
            <p className="mt-1 max-w-2xl text-xs leading-5">
              Contenuti tecnici e strumenti pubblici per il settore acciaio e tubo. Le sintesi non sostituiscono
              il testo ufficiale delle norme né le specifiche contrattuali applicabili.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-xs font-semibold">
            <Link href="/" className="hover:text-[#2f6fed]">Steel Sales AI</Link>
            <Link href="/knowledge" className="hover:text-[#2f6fed]">Knowledge</Link>
            <Link href="/login" className="hover:text-[#2f6fed]">Accedi</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
