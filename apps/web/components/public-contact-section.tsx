import { getLinkedInCompanyUrl } from "@/lib/public-social";

export function PublicContactSection({ locale }: { locale: "it" | "en" }) {
  const linkedinUrl = getLinkedInCompanyUrl();
  const english = locale === "en";

  return (
    <section id="get-in-touch" aria-labelledby="get-in-touch-title" lang={locale} className="border-y border-[#dce5e0] bg-[#123b34] text-white">
      <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b4e0d0]">Get in touch</p>
          <h2 id="get-in-touch-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {english ? "Let's connect across the steel industry." : "Connettiamoci nel mondo dell’acciaio."}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#dbeae4] sm:text-base">
            {english
              ? "Building a steel supply chain business? Reach out to discuss collaboration, early access and Smart Steel Sales."
              : "Operi nella filiera dell’acciaio? Contattaci per collaborazioni, accesso anticipato e informazioni su Smart Steel Sales."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          {linkedinUrl ? (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={english ? "Open the Smart Steel Sales LinkedIn company page (new tab)" : "Apri la pagina LinkedIn di Smart Steel Sales (nuova scheda)"}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-[#123b34] transition hover:bg-[#e6f3ed]"
            >
              {english ? "Contact us on LinkedIn" : "Contattaci su LinkedIn"}
              <span className="ml-2" aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="inline-flex min-h-12 items-center rounded-xl border border-[#88b5a4] px-5 text-sm font-semibold text-white">
              {english ? "LinkedIn company page coming soon" : "Pagina LinkedIn aziendale in preparazione"}
            </span>
          )}
          <p className="text-xs leading-5 text-[#c2d8ce]">
            {linkedinUrl
              ? english
                ? "Opens LinkedIn; select Message on our company page to write to us."
                : "Si apre LinkedIn: seleziona Messaggio sulla pagina aziendale per scriverci."
              : english
                ? "The direct link will be enabled once our official page is live."
                : "Il collegamento si attiverà quando la pagina ufficiale sarà pubblicata."}
          </p>
        </div>
      </div>
    </section>
  );
}
