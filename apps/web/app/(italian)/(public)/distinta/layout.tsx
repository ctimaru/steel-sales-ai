import Link from "next/link";
import type { ReactNode } from "react";

import { ProductBrand } from "@/components/product-brand";
import { PublicSessionAction } from "@/components/public-session-action";

export default function BuyerDistintaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <a href="#main-content" className="skip-link">
        Vai al contenuto principale
      </a>

      <header className="border-b border-[#dce2df] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <ProductBrand href="/" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigazione pubblica">
            <Link href="/knowledge" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Scuola
            </Link>
            <Link href="/knowledge/tubes?source=distinta&surface=nav#calcolatore-pesi" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Calcolo pesi
            </Link>
            <Link href="/distinta" className="rounded-lg bg-[#edf5f2] px-3 py-2 text-sm font-bold text-[#173f35]">
              Crea distinta
            </Link>
            <Link href="/azienda" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Trova azienda
            </Link>
          </nav>
          <PublicSessionAction className="rounded-lg border border-[#d7dfdb] bg-white px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]" />
        </div>

        <div className="border-t border-[#e2e7e4] bg-[#f7f8f7] md:hidden">
          <nav className="mx-auto flex max-w-[1180px] gap-2 overflow-x-auto px-4 py-2.5 sm:px-6" aria-label="Navigazione distinta">
            {[
              ["/knowledge", "Scuola"],
              ["/knowledge/tubes?source=distinta&surface=nav#calcolatore-pesi", "Calcolo pesi"],
              ["/distinta", "Crea distinta"],
              ["/azienda", "Trova azienda"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={
                  label === "Crea distinta"
                    ? "shrink-0 rounded-xl border border-[#9ebfb3] bg-[#edf5f2] px-3 py-2 text-xs font-bold text-[#173f35]"
                    : "shrink-0 rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#52615b]"
                }
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>{children}</main>

      <footer className="mt-16 border-t border-[#dce2df] bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-7 text-xs text-[#718078] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/distinta" className="font-semibold hover:text-[#173f35]">Crea distinta</Link>
            <Link href="/knowledge" className="font-semibold hover:text-[#173f35]">Scuola</Link>
            <Link href="/knowledge/tubes" className="font-semibold hover:text-[#173f35]">Calcolo pesi</Link>
            <Link href="/azienda" className="font-semibold hover:text-[#173f35]">Trova azienda</Link>
            <Link href="/privacy" className="font-semibold hover:text-[#173f35]">Privacy</Link>
            <Link href="/terms" className="font-semibold hover:text-[#173f35]">Termini</Link>
          </div>
          <span>Smart Steel Sales · Buyer tools for steel & tube.</span>
        </div>
      </footer>
    </div>
  );
}
