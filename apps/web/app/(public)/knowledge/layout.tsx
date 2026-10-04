import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProductBrand } from "@/components/product-brand";
import { PublicSessionAction } from "@/components/public-session-action";
import { SchoolClaimCta } from "@/components/school-claim-cta";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: "Scuola",
    template: "%s · Scuola · Smart Steel Sales",
  },
  description:
    "Scuola tecnica pubblica per il settore steel e tube: norme, gradi di acciaio, dimensioni, pesi e strumenti pratici.",
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
    <div className="school-shell min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <a href="#main-content" className="skip-link">
        Vai al contenuto principale
      </a>
      <header className="border-b border-[#dce2df] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <ProductBrand href="/" />
            <Link
              href="/knowledge"
              className="hidden border-l border-[#dce2df] pl-5 text-sm font-semibold text-[#43524c] hover:text-[#173f35] sm:block"
            >
              Scuola
            </Link>
          </div>

          <nav className="flex items-center gap-2" aria-label="Navigazione Scuola">
            <Link
              href="/knowledge/articoli"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#4f5e58] hover:bg-[#eef2f0] hover:text-[#173f35] md:inline-flex"
            >
              Articoli
            </Link>
            <Link
              href="/knowledge/norme"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#4f5e58] hover:bg-[#eef2f0] hover:text-[#173f35] md:inline-flex"
            >
              Norme
            </Link>
            <Link
              href="/knowledge/gradi"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#4f5e58] hover:bg-[#eef2f0] hover:text-[#173f35] lg:inline-flex"
            >
              Gradi
            </Link>
            <Link
              href="/knowledge/tubes?source=school&surface=nav#calcolatore-pesi"
              className="hidden rounded-xl bg-[#edf5f2] px-3 py-2 text-sm font-bold text-[#173f35] hover:bg-[#d9e8e2] lg:inline-flex"
            >
              Calcolatore
            </Link>
            <PublicSessionAction className="school-secondary-action hidden sm:inline-flex" />
            <Link href="/azienda" className="school-primary-action">
              Trova azienda
            </Link>
          </nav>
        </div>
        <div className="border-t border-[#e2e7e4] bg-[#f7f8f7] md:hidden">
          <nav
            className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6"
            aria-label="Sezioni Scuola"
          >
            {[
              ["/knowledge", "Home"],
              ["/knowledge/tubes?source=school&surface=nav#calcolatore-pesi", "Calcolatore"],
              ["/knowledge/articoli", "Articoli"],
              ["/knowledge/norme", "Norme"],
              ["/knowledge/gradi", "Gradi"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="shrink-0 rounded-xl border border-[#b8c7c1] bg-white px-3 py-2 text-xs font-semibold text-[#173f35] hover:border-[#438d7a] hover:bg-[#edf5f2]"
              >
                {label}
              </Link>
            ))}
            <PublicSessionAction className="shrink-0 rounded-xl border border-[#b8c7c1] bg-white px-3 py-2 text-xs font-semibold text-[#173f35] hover:border-[#438d7a] hover:bg-[#edf5f2]" />
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>{children}</main>

      <SchoolClaimCta />

      <footer className="mt-16 border-t border-[#dce2df] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-[#66736e] sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="font-semibold text-[#1d2824]">Scuola</p>
            <p className="mt-1 max-w-2xl text-xs leading-5">
              Contenuti tecnici e strumenti pubblici per il settore acciaio e tubo. Le sintesi non sostituiscono
              il testo ufficiale delle norme né le specifiche contrattuali applicabili.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-xs font-semibold">
            <Link href="/" className="hover:text-[#173f35]">Smart Steel Sales</Link>
            <Link href="/knowledge" className="hover:text-[#173f35]">Scuola</Link>
            <Link href="/knowledge/tubes?source=school&surface=nav#calcolatore-pesi" className="hover:text-[#173f35]">Calcolatore</Link>
            <Link href="/knowledge/articoli" className="hover:text-[#173f35]">Articoli</Link>
            <PublicSessionAction className="hover:text-[#173f35]" />
          </div>
        </div>
      </footer>
    </div>
  );
}
