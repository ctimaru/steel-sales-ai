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
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <a href="mailto:hello@smartsteelsales.com?subject=Smart%20Steel%20Sales%20-%20Contact" className="public-contact-email inline-flex min-h-11 min-w-0 w-full items-center justify-center rounded-xl border border-white bg-white px-4 py-3 text-center text-sm font-bold text-[#123b34] break-all transition-colors sm:w-auto sm:break-normal">hello@smartsteelsales.com</a>
            {linkedin ? <a href={linkedin} target="_blank" rel="noopener noreferrer" className="public-contact-linkedin inline-flex min-h-11 min-w-0 w-full items-center justify-center rounded-xl border border-[#93bbab] px-5 py-3 text-center text-sm font-bold text-white transition-colors sm:w-auto">LinkedIn ↗</a> : null}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-[#537b6e] bg-[#1b493e] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <p className="text-sm leading-6 text-[#e4f1eb]">
            {english ? "Investor or VC? Explore our vision and request access to the private Business Plan." : "Sei un investitore o un VC? Scopri la visione e richiedi accesso al Business Plan riservato."}
          </p>
          <Link href={english ? "/en/investors" : "/investitori"} className="public-contact-investor inline-flex min-h-11 min-w-0 w-full items-center justify-center rounded-lg border border-[#c7e9d9] bg-[#dff3e9] px-4 py-3 text-center text-sm font-bold text-[#123b34] transition-colors sm:w-auto">
            {english ? "Investor information →" : "Opportunità per investitori →"}
          </Link>
        </div>
      </div>
    </section>
  );
}
