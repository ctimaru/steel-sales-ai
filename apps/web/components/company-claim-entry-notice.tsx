import Link from "next/link";
import { ProductBrand } from "@/components/product-brand";
import type { CompanyClaimEntryFailure } from "@/lib/company-claim-entry";

export function CompanyClaimEntryNotice({
  status,
  locale = "it",
  retryHref,
}: {
  status: CompanyClaimEntryFailure;
  locale?: "it" | "en";
  retryHref?: string;
}) {
  const english = locale === "en";
  const title = status === "not_admin"
    ? (english ? "Ask your company administrator" : "Serve un amministratore della tua azienda")
    : status === "target_unavailable"
      ? (english ? "Company profile unavailable" : "Profilo aziendale non disponibile")
      : (english ? "We could not open the selected profile" : "Non è stato possibile aprire il profilo selezionato");
  const body = status === "not_admin"
    ? (english
      ? "Only an administrator of your active company account can request management of a company profile. Ask your administrator to continue from the company search."
      : "Solo un amministratore del tuo account aziendale può richiedere la gestione di un profilo. Chiedi al tuo amministratore di proseguire dalla ricerca azienda.")
    : status === "target_unavailable"
      ? (english
        ? "The selected profile is no longer available through this reference. Search for your company again to check its current status."
        : "Il profilo selezionato non è più disponibile con questo riferimento. Cerca di nuovo la tua azienda per controllarne lo stato aggiornato.")
      : (english
        ? "Your company selection is retained. Try again to continue; no management request has been submitted."
        : "La selezione della tua azienda è conservata. Riprova per continuare: nessuna richiesta di gestione è stata inviata.");

  return (
    <main lang={locale} className="min-h-screen bg-[#f2f4f3] px-4 py-7 text-[#1d2824] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <ProductBrand href={english ? "/en" : "/"} />
        <section className="mt-7 rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-8" aria-labelledby="claim-entry-heading">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1a5144]">{english ? "Company profile" : "Profilo aziendale"}</p>
          <h1 id="claim-entry-heading" className="mt-2 break-words text-2xl font-semibold">{title}</h1>
          <p role={status === "unavailable" ? "alert" : "status"} className="mt-3 text-sm leading-6 text-[#52615b]">{body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {status === "unavailable" && retryHref ? (
              <a href={retryHref} className="app-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{english ? "Try again" : "Riprova"}</a>
            ) : null}
            <Link href={english ? "/en/network" : "/azienda"} className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{english ? "Search for your company" : "Cerca la tua azienda"}</Link>
            <Link href="/company/profile" className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{english ? "Your company profile" : "Il tuo profilo aziendale"}</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
