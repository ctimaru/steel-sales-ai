import Link from "next/link";
import { ProductBrand } from "./product-brand";
import { PublicHomeNavigation } from "./public-home-navigation";
import { PublicPageLanguageSelector } from "./calculator-page-language-selector";

/**
 * HOME-CONV1A: calculator-first action persists during scroll while the
 * secondary menu scrolls out. Native <details> keeps access choice simple,
 * with no JS hydration or changes to auth/onboarding.
 */
export function PublicHomeHeader({ locale }: { locale: "it" | "en" }) {
  const en = locale === "en";
  const loginHref = en ? "/en/login" : "/login";
  const registerHref = en ? "/en/register" : "/register";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#234536] bg-[#071713] text-white">
        <div className="mx-auto flex min-h-[64px] max-w-[1180px] items-center justify-between gap-2 px-3 sm:min-h-[70px] sm:px-6 lg:px-8">
          <div className="hidden min-w-0 shrink sm:block">
            <ProductBrand href={en ? "/en" : "/"} inverse />
          </div>
          <div className="min-w-0 shrink-0 sm:hidden">
            <ProductBrand href={en ? "/en" : "/"} compact showDescriptor={false} markOnly />
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <PublicPageLanguageSelector locale={locale} surface="home" compact />
            <nav aria-label={en ? "Company account" : "Area aziende"} className="relative z-50">
              <details className="group relative">
                <summary aria-label={en ? "Company area: sign in or register" : "Area aziende: accedi o registrati"} className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-xl border border-[#436758] px-2 text-xs font-semibold text-[#e2f5e9] transition-colors hover:bg-[#183a2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8af3c0] sm:px-3 sm:text-sm [&::-webkit-details-marker]:hidden">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                  </svg>
                  <span className="sm:hidden">{en ? "Area" : "Area"}</span>
                  <span className="hidden sm:inline">{en ? "Company area" : "Area aziende"}</span>
                  <span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="absolute -right-[84px] top-full z-50 mt-2 w-[222px] rounded-xl border border-[#b9d4c4] bg-white p-2 shadow-[0_18px_40px_rgba(0,18,11,.3)] sm:right-0">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#567568]">{en ? "COMPANY WORKSPACE" : "WORKSPACE AZIENDALE"}</p>
                  <Link href={loginHref} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[#164937] hover:bg-[#edf7f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b7852]">
                    {en ? "Sign in" : "Accedi"} <span className="ml-auto" aria-hidden="true">→</span>
                  </Link>
                  <Link href={registerHref} className="flex min-h-11 items-center rounded-lg bg-[#e8f4ec] px-3 text-sm font-semibold text-[#11513a] hover:bg-[#d8eddf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b7852]">
                    {en ? "Register company" : "Registra azienda"} <span className="ml-auto" aria-hidden="true">→</span>
                  </Link>
                  <p className="px-3 pt-2 text-[11px] leading-4 text-[#526d5f]">{en ? "Company access requires review." : "L'accesso aziendale richiede revisione."}</p>
                </div>
              </details>
            </nav>
          </div>
        </div>
      </header>
      <PublicHomeNavigation locale={locale} theme="dark" />
    </>
  );
}
