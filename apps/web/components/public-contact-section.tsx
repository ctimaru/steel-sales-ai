import Link from "next/link";
import { getLinkedInCompanyUrl } from "@/lib/public-social";

export function PublicContactSection({ locale }: { locale: "it" | "en" }) {
  const english = locale === "en";
  const linkedin = getLinkedInCompanyUrl();
  return (
    <section id="get-in-touch" aria-labelledby="get-in-touch-title" className="border-y border-[#dce5e0] bg-[#123b34] text-white">
      <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b4e0d0]">Get in touch</p>
            <h2 id="get-in-touch-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
              {english ? "Let's build a more connected steel industry." : "Costruiamo insieme una filiera dell’acciaio più connessa."}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#dbeae4]">
              {english ? "For partnerships, early access or investor conversations, contact Smart Steel Sales directly." : "Per collaborazioni, accesso anticipato o opportunità di investimento, parliamone direttamente."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="mailto:hello@smartsteelsales.com?subject=Smart%20Steel%20Sales%20-%20Contact" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#123b34] hover:bg-[#e6f3ed]">hello@smartsteelsales.com</a>
            {linkedin ? <a href={linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#93bbab] px-5 text-sm font-bold text-white hover:bg-[#26564a]">LinkedIn ↗</a> : null}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-[#537b6e] bg-[#1b493e] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <p className="text-sm leading-6 text-[#e4f1eb]">
            {english ? "Investor or VC? Explore our vision and request access to the private Business Plan." : "Sei un investitore o un VC? Scopri la visione e richiedi accesso al Business Plan riservato."}
          </p>
          <Link href={english ? "/en/investors" : "/investitori"} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[#9cc7b8] px-4 text-sm font-semibold text-white hover:bg-[#326656]">
            {english ? "Investor information →" : "Opportunità per investitori →"}
          </Link>
        </div>
      </div>
    </section>
  );
}
