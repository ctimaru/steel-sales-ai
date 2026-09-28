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
    <div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <header className="border-b border-[#dce2df] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <ProductBrand href="/" />
            <Link
              href="/knowledge"
              className="hidden border-l border-[#dce2df] pl-5 text-sm font-semibold text-[#43524c] hover:text-[#173f35] sm:block"
            >
              Steel Knowledge
            </Link>
          </div>

          <nav className="flex items-center gap-2" aria-label="Navigazione Steel Knowledge">
            <Link
              href="/knowledge"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#5d6a65] hover:bg-[#eef2f0] hover:text-[#173f35] md:inline-flex"
            >
              Knowledge
            </Link>
            <Link
              href="/knowledge/norme"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#5d6a65] hover:bg-[#eef2f0] hover:text-[#173f35] md:inline-flex"
            >
              Norme
            </Link>
            <Link
              href="/knowledge/gradi"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#5d6a65] hover:bg-[#eef2f0] hover:text-[#173f35] md:inline-flex"
            >
              Gradi
            </Link>
            <Link
              href="/knowledge/tubes"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#5d6a65] hover:bg-[#eef2f0] hover:text-[#173f35] lg:inline-flex"
            >
              Pesi & dimensioni
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-[#d7dfdb] bg-white px-3.5 py-2 text-sm font-semibold text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f0f4f2] hover:text-[#173f35]"
            >
              Apri workspace
            </Link>
            <Link
              href="/register"
              className="hidden rounded-xl bg-[#173f35] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#226657] sm:inline-flex"
            >
              Registra azienda
            </Link>
          </nav>
        </div>
        <div className="border-t border-[#e2e7e4] bg-[#f7f8f7] md:hidden">
          <nav
            className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6"
            aria-label="Sezioni Steel Knowledge"
          >
            {[
              ["/knowledge", "Home"],
              ["/knowledge/norme", "Norme"],
              ["/knowledge/gradi", "Gradi"],
              ["/knowledge/tubes", "Pesi & dimensioni"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="shrink-0 rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#edf5f2] hover:text-[#173f35]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t border-[#dce2df] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-[#66736e] sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="font-semibold text-[#1d2824]">Steel Knowledge</p>
            <p className="mt-1 max-w-2xl text-xs leading-5">
              Contenuti tecnici e strumenti pubblici per il settore acciaio e tubo. Le sintesi non sostituiscono
              il testo ufficiale delle norme né le specifiche contrattuali applicabili.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-xs font-semibold">
            <Link href="/" className="hover:text-[#173f35]">Steel Sales AI</Link>
            <Link href="/knowledge" className="hover:text-[#173f35]">Knowledge</Link>
            <Link href="/dashboard" className="hover:text-[#173f35]">Workspace</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
