import Link from "next/link";
import { ProductBrand } from "./product-brand";
import { PublicHomeNavigation } from "./public-home-navigation";
import { PublicPageLanguageSelector } from "./calculator-page-language-selector";

/**
 * ONBOARDING-UX1: direct, one-click Sign in and Register links share the
 * existing static header. No client auth lookup or additional JS hydration.
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
            <nav aria-label={en ? "Company account" : "Area aziende"} className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link href={loginHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#6c9b83] px-3 text-xs font-semibold text-white transition hover:bg-[#183a2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8af3c0] sm:px-4 sm:text-sm">
                {en ? "Sign in" : "Accedi"}
              </Link>
              <Link href={registerHref} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e8f4ec] px-2.5 text-xs font-bold text-[#11513a] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8af3c0] sm:px-4 sm:text-sm">
                {en ? "Register" : "Registrati"}
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <PublicHomeNavigation locale={locale} theme="dark" />
    </>
  );
}
