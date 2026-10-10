import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutRegistration, restartRejectedRegistration } from "@/app/register/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import { RegistrationJourney } from "@/components/registration-journey";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company Registration Status — English", robots: privateNoIndexRobots };
type Recovery = {
  application?: {
    id: string; status: string; legal_name: string; updated_at: string;
    rejection_reason_code?: string | null; rejection_note?: string | null;
    information_request_note?: string | null;
  } | null;
  can_reapply?: boolean;
};
const states: Record<string, {
  title: string; explanation: string; tone: string; step: 1 | 2 | 3 | 4;
}> = {
  draft: { title: "Your application is a draft", explanation: "Complete company details and send your application for review.", tone: "bg-[#f8faf9]", step: 2 },
  needs_information: { title: "More information is needed", explanation: "The review team needs you to update and resubmit the company details.", tone: "bg-[#fff9e8]", step: 2 },
  pending_review: { title: "Your application is under review", explanation: "The platform team is reviewing the company identity and registration. No further action is required unless we request it.", tone: "bg-[#edf5f2]", step: 3 },
  approved: { title: "Your company has been approved", explanation: "Workspace activation and company identity linking are being finalized. Approval does not mean a commercial endorsement.", tone: "bg-[#edf5f2]", step: 4 },
  rejected: { title: "Your application was not approved", explanation: "This application cannot be activated as submitted. Review the reason and any next steps below.", tone: "bg-[#fff5f3]", step: 3 },
  activated: { title: "Your company workspace is active", explanation: "You can complete setup and access your workspace. The private product interface currently uses Italian.", tone: "bg-[#edf5f2]", step: 4 },
};
const rejectionReasons: Record<string, string> = {
  duplicate_application: "Another company profile or application needs to be resolved first.",
  unverifiable_identity: "Company identity could not be verified sufficiently.",
  incomplete_information: "The information was insufficient to complete review.",
  unsupported_business: "This company is outside the currently supported business scope.",
  abuse_or_spam: "The application did not pass platform integrity checks.",
  other: "Manual review resulted in a decision not to activate the application.",
};

export default async function EnglishRegistrationStatusPage({ searchParams }: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { submitted, error } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/en/login?next=" + encodeURIComponent("/en/registration/status"));
  const { data: lifecycle } = await supabase.rpc("lr5_account_lifecycle_state");
  if ((lifecycle as { access_suspended?: boolean } | null)?.access_suspended === true) {
    await supabase.auth.signOut({ scope: "global" });
    redirect("/account-closure?requested=1");
  }

  // Existing RLS-backed owner-only recovery contract. No unrestricted company table reads.
  const { data, error: recoveryError } = await supabase.rpc("hp12_registration_recovery_state", { p_application_id: null });
  if (recoveryError) throw new Error("registration_recovery_state_unavailable");
  const recovery = (data ?? {}) as Recovery;
  const application = recovery.application;
  if (!application) redirect("/en/register");
  const state = states[application.status] ?? {
    title: "Registration is being processed",
    explanation: "Your company application is recorded. Check back for updates.",
    tone: "bg-[#f8faf9]", step: 3 as const,
  };

  return (
    <main lang="en" className="min-h-screen bg-[#f2f4f3] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <ProductBrand href="/en" />
          <form action={logoutRegistration}><input type="hidden" name="registration_locale" value="en" /><button type="submit" className="text-sm font-bold text-[#52615b] underline">Sign out</button></form>
        </header>
        <section className="mt-7 rounded-[24px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <RegistrationJourney current={state.step} locale="en" />
          <p className="mt-7 text-xs font-bold uppercase tracking-wider text-[#1f6b5a]">Company registration</p>
          <h1 className="mt-2 text-3xl font-bold text-[#123b34]">{application.legal_name}</h1>
          <p className="mt-3 text-sm text-[#52615b]">Application status and any required next steps.</p>
          {submitted === "1" ? <p role="status" className="mt-5 rounded-xl bg-[#edf5f2] p-4 text-sm text-[#173f35]">Your company application has been submitted for review. You may sign out and return later.</p> : null}
          {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] p-4 text-sm text-[#9f2f24]">We could not complete that action. Please try again or contact support.</p> : null}
          <div className={`mt-6 rounded-xl border border-[#dce2df] p-5 ${state.tone}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#52615b]">Current status</p>
            <h2 className="mt-2 text-xl font-bold text-[#123b34]">{state.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[#43524c]">{state.explanation}</p>
          </div>
          {application.status === "needs_information" && application.information_request_note ? <div className="mt-5 rounded-xl border border-[#ead7aa] bg-[#fff9e8] p-5">
            <h3 className="text-sm font-bold">Requested updates</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{application.information_request_note}</p>
          </div> : null}
          {application.status === "rejected" ? <div className="mt-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] p-5 text-sm">
            <h3 className="font-bold">Review outcome</h3>
            <p className="mt-2 leading-6">{rejectionReasons[application.rejection_reason_code ?? ""] ?? "Manual review is required before another application can proceed."}</p>
            {application.rejection_note ? <p className="mt-3 whitespace-pre-wrap leading-6">{application.rejection_note}</p> : null}
          </div> : null}
          <div className="mt-7 flex flex-wrap gap-3">
            {(application.status === "draft" || application.status === "needs_information") ? <Link href="/en/register"
              className="app-primary inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold">Update company details →</Link> : null}
            {application.status === "rejected" && recovery.can_reapply === true ? <form action={restartRejectedRegistration}>
              <input type="hidden" name="registration_locale" value="en" />
              <input type="hidden" name="application_id" value={application.id} />
              <PendingSubmitButton pendingLabel="Starting…" className="app-primary min-h-11 rounded-xl px-5 text-sm font-bold">Request a new review</PendingSubmitButton>
            </form> : null}
            {application.status === "activated" ? <Link href="/onboarding" hrefLang="it" className="app-primary inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold">Open workspace setup (IT) →</Link> : null}
            <Link href="/en" className="app-secondary inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold">Back to English home</Link>
          </div>
          <p className="mt-6 text-xs leading-6 text-[#52615b]">Company registration never automatically activates access. Private company and RFQ data are restricted to authorized accounts.</p>
        </section>
      </div>
    </main>
  );
}
