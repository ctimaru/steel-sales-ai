import Link from "next/link";
import Script from "next/script";
import { communityIntakeConfig, communityPath } from "@/lib/community-intake-config";
import { submitCommunityInterest } from "@/lib/community-intake-actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
export function CommunityInterestPage({locale,kind,result}:{locale:"it"|"en";kind:"partner"|"investor";result?:string}) {
  const en=locale==="en", investor=kind==="investor";
  const config=communityIntakeConfig();
  const home=en?"/en/project":"/progetto";
  const subject=investor?(en?"Investor interest":"Interesse investitori"):(en?"Founding Partners interest":"Interesse Founding Partners");
  const contact="mailto:hello@smartsteelsales.com?subject="+encodeURIComponent(subject+" — Smart Steel Sales");
  const field="mt-1 block w-full min-w-0 rounded-xl border border-[var(--border-strong)] bg-white px-3 py-3 text-sm";
  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6" lang={locale}>
    <Link href={home} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-deep)]">{en?"← The project":"← Il progetto"}</Link>
    <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-8">
      <p className="app-kicker">SMART STEEL SALES · 2027</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{investor?(en?"Investor interest":"Interesse investitori"):"Founding Partners"}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{en?"A non-binding request to hear from our team. No account, payment, reservation or investment offer.":"Una richiesta non vincolante di contatto con il nostro team. Nessun account, pagamento, prenotazione o offerta di investimento."}</p>
      <nav aria-label={en?"Interest type":"Tipo di interesse"} className="mt-5 grid grid-cols-2 gap-2">
        {(["partner","investor"] as const).map(k=><Link key={k} href={communityPath(locale,k)} aria-current={kind===k?"page":undefined} className={"rounded-xl border px-3 py-3 text-center text-sm font-semibold "+(kind===k?"app-selected-solid":"app-secondary")}>{k==="partner"?(en?"Companies":"Aziende"):(en?"Investors":"Investitori")}</Link>)}
      </nav>
      {!config.enabled ? <div role="status" className="mt-5 rounded-xl border border-[var(--border)] p-4 text-sm leading-6">{en?"The form is not open yet. You can contact us directly by email.":"Il modulo non è ancora aperto. Puoi contattarci direttamente via email."} <a href={contact} className="font-semibold underline">hello@smartsteelsales.com</a></div> :
      result==="received" ? <div role="status" className="mt-5 rounded-xl bg-[var(--brand-primary-soft)] p-4 text-sm text-[var(--brand-deep)]">{en?"Thank you. Your interest has been received. It is not a confirmed membership or investment.":"Grazie. La manifestazione di interesse è stata ricevuta. Non equivale a un’adesione o investimento confermato."}</div> :
      <form action={submitCommunityInterest} className="mt-5 grid gap-4" data-testid="community-interest-form">
        {result?<p role="alert" className="text-sm text-[var(--semantic-error)]">{en?"Unable to submit. Check your details and try again.":"Invio non riuscito. Controlla i dati e riprova."}</p>:null}
        <input type="hidden" name="locale" value={locale}/><input type="hidden" name="kind" value={kind}/>
        <label className="text-sm font-medium">{en?"Full name":"Nome e cognome"}<input name="name" autoComplete="name" required minLength={2} maxLength={120} className={field}/></label>
        <label className="text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required maxLength={254} className={field}/></label>
        <label className="text-sm font-medium">{en?(investor?"Organization (optional)":"Company"):(investor?"Organizzazione (facoltativa)":"Azienda")}<input name="organization" autoComplete="organization" required={!investor} maxLength={160} className={field}/></label>
        <div hidden aria-hidden="true"><label>Website<input name="website_check" tabIndex={-1} autoComplete="off"/></label></div>
        <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="privacy" required className="mt-1 size-4 shrink-0"/><span>{en?"I have read the privacy notice and request a reply about this interest.":"Ho letto l’informativa privacy e chiedo di essere ricontattato per questa manifestazione di interesse."} <Link href="/privacy" className="font-semibold underline">Privacy</Link>.</span></label>
        <div className="cf-turnstile min-w-0" data-sitekey={config.siteKey} data-action="community_interest" data-size="flexible" data-language={locale}/>
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive"/>
        <PendingSubmitButton pendingLabel={en?"Sending…":"Invio in corso…"} className="public-primary-cta min-h-12 w-full rounded-xl px-4 py-3 text-sm font-bold">{en?"Send non-binding interest":"Invia manifestazione di interesse"}</PendingSubmitButton>
      </form>}
    </section>
  </main>;
}
