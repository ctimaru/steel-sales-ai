import Link from "next/link";

type Locale = "it" | "en";

const items = {
  it: [
    { label: "Network", href: "#network" },
    { label: "Scuola", href: "/knowledge" },
    { label: "Crea distinta", href: "/distinta" },
    { label: "Calcolo pesi", href: "/knowledge/tubes?source=home&surface=header#calcolatore-pesi" },
    { label: "Trova azienda", href: "/azienda" },
  ],
  en: [
    { label: "Network", href: "/en/network" },
    { label: "Knowledge", href: "/en/knowledge" },
    { label: "RFQ builder", href: "/en/distinta" },
    { label: "Weight calculator", href: "/en/knowledge/tubes" },
    { label: "Contact", href: "#get-in-touch" },
  ],
} as const;

export function PublicHomeNavigation({ locale }: { locale: Locale }) {
  const links = items[locale];
  const main = links.slice(0, 3);
  const extra = links.slice(3);
  const linkClass = "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-[#43564f] transition-colors hover:bg-[#edf4f0] hover:text-[#173f35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]";

  return (
    <>
      <nav aria-label={locale === "it" ? "Navigazione principale" : "Main navigation"} className="hidden min-w-0 items-center justify-center gap-0.5 xl:flex">
        {links.map((item) => <Link key={item.label} href={item.href} className={linkClass}>{item.label}</Link>)}
      </nav>
      <nav aria-label={locale === "it" ? "Navigazione mobile" : "Mobile navigation"} className="border-t border-[#edf1ee] xl:hidden">
        <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-1 px-3 py-1.5 sm:px-6">
          {main.map((item) => <Link key={item.label} href={item.href} className="flex min-h-10 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-semibold leading-4 text-[#43564f] hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{item.label}</Link>)}
          <details className="group relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-1 rounded-lg border border-[#dce5e0] px-2 text-xs font-semibold text-[#173f35] marker:hidden hover:bg-[#edf4f0] [&::-webkit-details-marker]:hidden">
              {locale === "it" ? "Altro" : "More"} <span aria-hidden="true" className="text-[10px] group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 min-w-[190px] rounded-xl border border-[#dce5e0] bg-white p-2 shadow-lg">
              {extra.map((item) => <Link key={item.label} href={item.href} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[#36574c] hover:bg-[#edf4f0]">{item.label}</Link>)}
            </div>
          </details>
        </div>
      </nav>
    </>
  );
}
