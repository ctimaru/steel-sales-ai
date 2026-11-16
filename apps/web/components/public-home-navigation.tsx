import Link from "next/link";
import styles from "./public-home-navigation.module.css";

type Locale = "it" | "en";

/**
 * HOME-CONV1A: the calculator is the persistent primary action in the
 * public header. Secondary navigation stays contextual and never routes
 * a guest to a private Network or RFQ workspace.
 */
const items = {
  it: [
    { label: "Distinta", href: "/distinta" },
    { label: "Trova aziende", href: "/azienda" },
    { label: "Network", href: "#network" },
    { label: "Scuola", href: "/knowledge" },
  ],
  en: [
    { label: "RFQ builder", href: "/en/distinta" },
    { label: "Network", href: "/en/network" },
    { label: "Knowledge", href: "/en/knowledge" },
    { label: "Contact", href: "#get-in-touch" },
  ],
} as const;

export function PublicHomeNavigation({ locale, theme = "light" }: { locale: Locale; theme?: "light" | "dark" }) {
  const links = items[locale];
  const dark = theme === "dark";
  const main = links.slice(0, 3);
  const extra = links.slice(3);
  const linkClass = "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " + (dark ? "text-[#d2e9db] hover:bg-[#183a2c] hover:text-white focus-visible:outline-[#85f6c4]" : "text-[#43564f] hover:bg-[#edf4f0] hover:text-[#173f35] focus-visible:outline-[#1f6b5a]") + (dark ? ` ${styles.darkDesktopLink}` : "");

  return (
    <>
      <nav aria-label={locale === "it" ? "Navigazione principale" : "Main navigation"} className="hidden min-w-0 items-center justify-center gap-0.5 border-b border-[#234536] bg-[#071713] xl:flex">
        {links.map((item) => <Link key={item.label} href={item.href} className={linkClass}>{item.label}</Link>)}
      </nav>
      <nav aria-label={locale === "it" ? "Navigazione mobile" : "Mobile navigation"} className={(dark ? "border-b border-t border-[#234536] bg-[#071713]" : "border-y border-[#edf1ee]") + " xl:hidden"}>
        <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-1 px-3 py-1.5 sm:px-6">
          {main.map((item) => <Link key={item.label} href={item.href} className={"flex min-h-10 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-semibold leading-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " + (dark ? "text-[#d4e8da] hover:bg-[#183a2c] focus-visible:outline-[#85f6c4]" : "text-[#43564f] hover:bg-[#edf4f0]") + (dark ? ` ${styles.darkMobileLink}` : "")}>{item.label}</Link>)}
          <details className="group relative">
            <summary className={"flex min-h-10 cursor-pointer list-none items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85f6c4] [&::-webkit-details-marker]:hidden " + (dark ? "border-[#466952] text-[#e1f7e9] hover:bg-[#183a2c]" : "border-[#dce5e0] text-[#173f35] hover:bg-[#edf4f0]")}>
              {locale === "it" ? "Altro" : "More"} <span aria-hidden="true" className="text-[10px] group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 min-w-[190px] rounded-xl border border-[#dce5e0] bg-white p-2 shadow-lg">
              {extra.map((item) => <Link key={item.label} href={item.href} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[#36574c] hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#237858]">{item.label}</Link>)}
            </div>
          </details>
        </div>
      </nav>
    </>
  );
}
