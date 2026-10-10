import Link from "next/link";

type PublicLanguageSwitchProps = {
  locale: "it" | "en";
  italianHref: string;
  englishHref: string;
};

export function PublicLanguageSwitch({
  locale,
  italianHref,
  englishHref,
}: PublicLanguageSwitchProps) {
  const base =
    "inline-flex min-h-10 items-center justify-center rounded-lg px-2.5 text-xs font-bold transition";
  const current = "bg-[#e6f3ed] text-[#123b34]";
  const other = "text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]";

  return (
    <nav aria-label={locale === "it" ? "Seleziona lingua" : "Choose language"} className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#dce5e0] bg-white p-0.5">
      <Link href={italianHref} hrefLang="it" lang="it" aria-current={locale === "it" ? "page" : undefined} className={`${base} ${locale === "it" ? current : other}`}>
        IT
      </Link>
      <Link href={englishHref} hrefLang="en" lang="en" aria-current={locale === "en" ? "page" : undefined} className={`${base} ${locale === "en" ? current : other}`}>
        EN
      </Link>
    </nav>
  );
}
