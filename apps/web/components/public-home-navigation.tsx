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
    { label: "Il progetto", href: "/progetto" },
  ],
  en: [
    { label: "RFQ builder", href: "/en/distinta" },
    { label: "Network", href: "/en/network" },
    { label: "Knowledge", href: "/en/knowledge" },
    { label: "Contact", href: "#get-in-touch" },
    { label: "The project", href: "/en/project" },
  ],
} as const;

/** Section links shared by the desktop bar and the mobile ☰ menu (HOME-MOBILE-A1). */
export function publicHomeLinks(locale: Locale) {
  return items[locale];
}

/**
 * Desktop (xl+) section bar. Below xl the same links live in the header ☰ menu
 * (PublicHomeMenu, "Navigazione mobile"), so the phone shows a single header row.
 */
export function PublicHomeNavigation({ locale, theme = "light" }: { locale: Locale; theme?: "light" | "dark" }) {
  const links = items[locale];
  const dark = theme === "dark";
  const linkClass = "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " + (dark ? "text-[#d2e9db] hover:bg-[#183a2c] hover:text-white focus-visible:outline-[#85f6c4]" : "text-[#43564f] hover:bg-[#edf4f0] hover:text-[#173f35] focus-visible:outline-[#1f6b5a]") + (dark ? ` ${styles.darkDesktopLink}` : "");

  return (
    <nav aria-label={locale === "it" ? "Navigazione principale" : "Main navigation"} className={"hidden min-w-0 items-center justify-center gap-0.5 xl:flex " + (dark ? "border-b border-[#234536] bg-[#071713]" : "border-y border-[#edf1ee]")}>
      {links.map((item) => <Link key={item.label} href={item.href} className={linkClass}>{item.label}</Link>)}
    </nav>
  );
}
