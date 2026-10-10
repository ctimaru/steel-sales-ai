import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { resendSignupConfirmation } from "@/app/verify-email/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import { RegistrationJourney } from "@/components/registration-journey";
import { maskEmail, PENDING_SIGNUP_EMAIL_COOKIE } from "@/lib/auth-email-verification";
import { safeInternalNext } from "@/lib/auth-next";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verify Your Email — Smart Steel Sales", robots: privateNoIndexRobots };

export default async function EnglishVerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ sent?: string; resent?: string; source?: string; error?: string; next?: string }>;
}) {
  const { sent, resent, source, error, next } = await searchParams;
  const nextPath = safeInternalNext(next, "/en/register");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.email_confirmed_at) redirect(nextPath);
  const cookieStore = await cookies();
  const pendingEmail = cookieStore.get(PENDING_SIGNUP_EMAIL_COOKIE)?.value ?? "";
  const masked = pendingEmail ? maskEmail(pendingEmail) : null;

  return (
    <main lang="en" className="min-h-screen bg-[#f2f4f3] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <ProductBrand href="/en" />
          <Link href="/en/login" className="text-sm font-bold text-[#52615b]">Sign in</Link>
        </header>
        <section className="mt-7 rounded-[24px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <RegistrationJourney current={1} locale="en" />
          <p className="mt-7 text-xs font-bold uppercase tracking-wider text-[#1f6b5a]">Account verification</p>
          <h1 className="mt-2 text-3xl font-bold text-[#123b34]">Check your inbox</h1>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">Before you can submit company details, we need to verify your email address. The confirmation link returns you to the English registration journey.</p>
          {sent === "1" ? <p role="status" className="mt-5 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] p-4 text-sm">A confirmation email has been requested. Check your spam folder too.</p> : null}
          {resent === "1" ? <p role="status" className="mt-5 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] p-4 text-sm">A new confirmation link has been requested.</p> : null}
          {source === "login" ? <p className="mt-5 rounded-xl bg-[#fff9e8] p-4 text-sm">Your account exists but its email has not yet been confirmed.</p> : null}
          {error ? <p role="alert" className="mt-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] p-4 text-sm text-[#9f2f24]">The verification link could not be used. Request a fresh link below.</p> : null}
          <div className="mt-7 rounded-xl border border-[#dce2df] bg-[#f8faf9] p-5">
            <p className="text-base font-bold text-[#123b34]">{masked ? `Confirmation email: ${masked}` : "Email verification"}</p>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">Open the message from Smart Steel Sales and confirm your email. Your company claim selection is preserved.</p>
            {pendingEmail ? <form action={resendSignupConfirmation} className="mt-5">
              <input type="hidden" name="next" value={nextPath} />
              <PendingSubmitButton pendingLabel="Resending…" className="app-secondary min-h-11 rounded-xl px-5 text-sm font-bold">Resend verification email</PendingSubmitButton>
            </form> : <Link href={nextPath} className="app-primary mt-5 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold">Return to registration</Link>}
          </div>
          <div className="mt-6 grid gap-3 text-sm text-[#43524c] sm:grid-cols-3">
            <div className="rounded-xl border border-[#dce2df] p-4"><strong>1. Open email</strong><p className="mt-2 text-xs">Find your confirmation message.</p></div>
            <div className="rounded-xl border border-[#dce2df] p-4"><strong>2. Verify</strong><p className="mt-2 text-xs">Follow the confirmation link.</p></div>
            <div className="rounded-xl border border-[#dce2df] p-4"><strong>3. Continue</strong><p className="mt-2 text-xs">Submit company details for review.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}
