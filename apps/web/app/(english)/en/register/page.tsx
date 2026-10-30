import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signup } from "@/app/login/actions";
import { safeCommercialReturnTo, withCommercialReturnTo } from "@/lib/auth-next";
import { logoutRegistration } from "@/app/register/actions";
import { EnglishCompanyRegistrationForm } from "@/components/english-company-registration-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import { PublicCompanyLookup } from "@/components/public-company-lookup";
import { RegistrationJourney } from "@/components/registration-journey";
import { Input } from "@/components/ui/input";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Register Your Steel Company — English",
  robots: privateNoIndexRobots,
};
type ClaimContext = {
  ok?: boolean; code?: string; claim_ref?: string;
  legal_name?: string; trading_name?: string | null; country_code?: string;
  vat_hint?: string | null; claim_state?: "claimable" | "claim_in_progress" | "claimed";
  can_start_registration?: boolean;
};

export default async function EnglishRegistrationPage({ searchParams }: {
  searchParams: Promise<{ error?: string; message?: string; claim_ref?: string; return_to?: string }>; 
}) {
  const { error, message, claim_ref: rawRef, return_to: requestedReturn } = await searchParams;
  const returnTo = safeCommercialReturnTo(requestedReturn);
  const normalized = String(rawRef ?? "").trim().toLowerCase();
  const claimRef = /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
  if (normalized && !claimRef) redirect("/en/register");
  const registrationPath = withCommercialReturnTo(claimRef ? `/en/register?claim_ref=${encodeURIComponent(claimRef)}` : "/en/register", returnTo);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <main lang="en" className="min-h-screen bg-[#f2f4f3] px-4 py-7 text-[#1d2824] sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <ProductBrand href="/en" showDescriptor={false} />
            <nav aria-label="English account navigation" className="flex gap-3 text-sm">
              <Link href="/en" className="font-semibold text-[#52615b]">English home</Link>
              <Link href={`/en/login?next=${encodeURIComponent(registrationPath)}`} className="font-bold text-[#173f35] underline">Sign in</Link>
            </nav>
          </header>
          <div className="mt-4 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-wide text-[#1f6b5a]">Company registration · Free account</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b34] sm:text-3xl">
              {claimRef ? "Continue with your company profile" : "Create your company account"}
            </h1>
            <p className="mt-1 text-sm leading-5 text-[#52615b]">
              Start with your account. You can check your company now or after verifying your email.
            </p>
          </div>
          <div className="mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-6">
            <section id="create-account" className="min-w-0 scroll-mt-4 rounded-[24px] border border-[#cbded5] bg-white p-4 sm:p-6" data-testid="onboarding-ux2-account" aria-label="Create your account">
              <div className="hidden sm:block"><RegistrationJourney current={1} compact locale="en" /></div>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#1f6b5a]">Step 1 of 4 · Your account</p>
              <h2 className="mt-1 text-2xl font-bold text-[#123b34]">Create account</h2>
              <p className="mt-2 text-sm leading-5 text-[#52615b]">We'll email a verification link. Your company application comes next.</p>
              {error ? <p role="alert" className="mt-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] p-3 text-sm text-[#9f2f24]">We could not create the account. Please review your email and password, then try again. {error}</p> : null}
              {message ? <p role="status" className="mt-5 rounded-xl bg-[#edf5f2] p-3 text-sm">{message}</p> : null}
              {returnTo ? <p role="status" className="mt-4 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] p-3 text-sm text-[#173f35]">Your commercial destination will be retained. Your draft stays in this browser, not in the email link.</p> : null}
              <form action={signup} className="mt-4 space-y-3">
                <input type="hidden" name="next" value={registrationPath} />
                <label className="block text-sm font-bold text-[#43524c]">Work email
                  <Input name="email" type="email" autoComplete="email" required className="mt-1.5 h-12" />
                </label>
                <label className="block text-sm font-bold text-[#43524c]">Password
                  <Input name="password" type="password" autoComplete="new-password" minLength={8} required className="mt-2 h-12" />
                  <span className="mt-1 block text-xs font-normal text-[#52615b]">At least eight characters. Use a unique password.</span>
                </label>
                <p className="text-xs leading-5 text-[#52615b]">
                  Read the <Link href="/privacy" hrefLang="it" target="_blank" className="font-bold underline">Privacy notice (IT)</Link> and <Link href="/terms" hrefLang="it" target="_blank" className="font-bold underline">Terms (IT)</Link> before creating an account. Company consents are collected separately.
                </p>
                <PendingSubmitButton pendingLabel="Creating account…" className="app-primary h-12 w-full rounded-xl px-4 text-sm font-bold disabled:opacity-50">Create account</PendingSubmitButton>
              </form>
              <p className="mt-3 text-xs text-[#52615b]">Already have an account? <Link href={`/en/login?next=${encodeURIComponent(registrationPath)}`} className="font-bold underline">Sign in to continue</Link>.</p>
            </section>
            <div className="min-w-0 space-y-3">
              <div className="min-w-0 rounded-[24px] border border-[#dce2df] bg-white p-4 sm:p-6">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#1f6b5a]">Company lookup · Optional for now</p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-[#123b34]">Find your company</h1>
                <p className="mt-2 text-sm leading-5 text-[#52615b]">You can search now or after verifying your email. Existing profiles can be linked without creating duplicates.</p>
                {claimRef ? <div className="mt-5 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] p-4 text-sm">
                  <strong>Company profile selected</strong>
                  <p className="mt-1 text-[#52615b]">Your claim reference is preserved through email verification.</p>
                  <Link href="/en/register" className="mt-2 inline-flex font-bold text-[#1f6b5a] underline">Search for another company</Link>
                </div> : <div className="mt-3"><PublicCompanyLookup locale="en" context="registration" returnTo={returnTo} notFoundHref="#create-account"
                  notFoundLabel="Not listed? Continue with your account ↑" showNetworkNote={false} /></div>}
              </div>
              <div className="rounded-xl border border-[#dce2df] bg-[#f8faf9] p-3 text-xs leading-5 text-[#52615b]">
                <strong className="text-[#123b34]">Your company remains private until approved.</strong>
                <p className="mt-2">Private company tools become available only after your application is approved.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { data: lifecycleData } = await supabase.rpc("lr5_account_lifecycle_state");
  if ((lifecycleData as { access_suspended?: boolean } | null)?.access_suspended === true) {
    await supabase.auth.signOut({ scope: "global" });
    redirect("/account-closure?requested=1");
  }
  if (!user.email_confirmed_at) redirect("/en/verify-email?next=" + encodeURIComponent(registrationPath));
  const { data: memberships } = await supabase.from("organization_memberships")
    .select("organization_id,status").eq("status", "active").limit(1);
  if (memberships?.length) redirect("/dashboard");

  const { data: application } = await supabase.from("company_registration_applications")
    .select("id,application_status,legal_name,trading_name,country_code,vat_id,registration_id,website_url,primary_company_type,secondary_company_types,contact_name,contact_phone,short_description,claim_target_network_company_id")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (application && !["draft", "needs_information"].includes(application.application_status)) {
    redirect(withCommercialReturnTo("/en/registration/status", returnTo));
  }

  let claim: ClaimContext | null = null;
  let claimError = false;
  if (application?.claim_target_network_company_id) {
    const r = await supabase.rpc("pa1_4_registration_claim_context", { p_application_id: application.id });
    claim = (r.data ?? null) as ClaimContext | null;
    claimError = Boolean(r.error);
  } else if (claimRef) {
    const r = await supabase.rpc("pa1_4_company_claim_context", { p_claim_ref: claimRef });
    claim = (r.data ?? null) as ClaimContext | null;
    claimError = Boolean(r.error);
  }
  const activeClaim = claim?.ok === true && claim.code === "ok" &&
    claim.claim_ref && claim.legal_name && claim.country_code
    ? { claim_ref: claim.claim_ref, legal_name: claim.legal_name,
      trading_name: claim.trading_name ?? null, country_code: claim.country_code,
      vat_hint: claim.vat_hint ?? null }
    : null;
  const blocked = Boolean(claimRef || application?.claim_target_network_company_id) &&
    (claimError || !activeClaim || claim?.claim_state !== "claimable" || claim?.can_start_registration !== true);
  const initial = activeClaim
    ? { ...application, legal_name: activeClaim.legal_name, country_code: activeClaim.country_code,
      trading_name: application?.trading_name || activeClaim.trading_name }
    : application;

  return (
    <main lang="en" className="min-h-screen bg-[#f2f4f3] px-4 py-7 text-[#1d2824] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <ProductBrand href="/en" />
          <form action={logoutRegistration}><input type="hidden" name="registration_locale" value="en" /><button type="submit" className="text-sm font-bold text-[#52615b] underline">Sign out</button></form>
        </header>
        <div className="mt-7 rounded-[24px] border border-[#dce2df] bg-white p-5 sm:p-8">
          <RegistrationJourney current={2} locale="en" />
          <div className="mt-8 border-b border-[#e7ece9] pb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1f6b5a]">Step 3 — Company application</p>
            <h1 className="mt-2 text-3xl font-bold text-[#123b34]">{application?.application_status === "needs_information" ? "Update your application" : "Tell us about your company"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#52615b]">
              Your email is verified. We'll ask for essential company identity and business details, then send your application for human review.
            </p>
            <p className="mt-2 text-xs text-[#66736e]">Signed in as {user.email}</p>
          </div>
          {error ? <p role="alert" className="mt-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] p-4 text-sm text-[#9f2f24]">Your application could not be submitted. Please review the details and retry. {error}</p> : null}
          {message ? <p role="status" className="mt-5 rounded-xl bg-[#edf5f2] p-4 text-sm">{message}</p> : null}
          {application?.application_status === "needs_information" ? <p className="mt-5 rounded-xl bg-[#fff9e8] p-4 text-sm text-[#77551c]">The review team has requested more information. Update and resubmit your application.</p> : null}
          {!application && !claimRef ? <div className="mt-6"><PublicCompanyLookup locale="en" context="registration" returnTo={returnTo} notFoundHref="#company-form" notFoundLabel="No match? Continue with a new company ↓" showNetworkNote={false} /></div> : null}
          <div id="company-form" className="scroll-mt-5">
            {blocked ? <div className="mt-6 rounded-xl border border-[#ead7aa] bg-[#fff9e8] p-5 text-sm text-[#77551c]">
              <strong>This company profile can no longer be claimed.</strong>
              <p className="mt-2">Its status has changed or the claim reference is invalid. Please search again rather than submit a duplicate profile.</p>
              <Link href="/en/register" className="mt-3 inline-flex font-bold underline">Search for a company</Link>
            </div> : <EnglishCompanyRegistrationForm initial={initial} claim={activeClaim} returnTo={returnTo} />}
          </div>
        </div>
      </div>
    </main>
  );
}
