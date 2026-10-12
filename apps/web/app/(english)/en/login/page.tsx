import type { Metadata } from "next";
import Link from "next/link";

import { login } from "@/app/login/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import { Input } from "@/components/ui/input";
import { safeInternalNext } from "@/lib/auth-next";
import { privateNoIndexRobots } from "@/lib/seo";

export const metadata: Metadata = { title: "Sign In — Smart Steel Sales", robots: privateNoIndexRobots };

export default async function EnglishLoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;
  const nextPath = safeInternalNext(next, "/en/register");
  const registrationHref = nextPath.startsWith("/en/register") ? nextPath : "/en/register";
  return (
    <main lang="en" className="min-h-screen bg-[#f2f4f3] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-md">
        <header className="flex items-center justify-between gap-3">
          <ProductBrand href="/en" />
          <Link href="/en" className="text-sm font-semibold text-[#52615b]">English home</Link>
        </header>
        <section className="mt-8 rounded-[24px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1f6b5a]">Existing account</p>
          <h1 className="mt-3 text-3xl font-bold text-[#123b34]">Sign in to Smart Steel Sales</h1>
          <p className="mt-3 text-sm leading-6 text-[#52615b]">Continue an existing company application, or access your company workspace after approval. The private workspace currently uses Italian.</p>
          {error ? <p role="alert" className="mt-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] p-4 text-sm text-[#9f2f24]">Sign-in was unsuccessful. Check your credentials or verify your email, then try again.</p> : null}
          {message ? <p role="status" className="mt-5 rounded-xl bg-[#edf5f2] p-4 text-sm">{message}</p> : null}
          <form action={login} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className="block text-sm font-bold text-[#43524c]">Email
              <Input name="email" type="email" autoComplete="email" required className="mt-2 h-11" />
            </label>
            <label className="block text-sm font-bold text-[#43524c]">Password
              <Input name="password" type="password" autoComplete="current-password" required minLength={8} className="mt-2 h-11" />
            </label>
            <PendingSubmitButton pendingLabel="Signing in…" className="app-primary h-11 w-full rounded-xl text-sm font-bold">Sign in</PendingSubmitButton>
          </form>
          <p className="mt-5 text-sm text-[#52615b]">Need a company account? <Link href={registrationHref} className="font-bold text-[#1f6b5a] underline">Register in English</Link>.</p>
          <p className="mt-3 text-xs text-[#52615b]">Password recovery currently uses an Italian-language interface: <Link href="/forgot-password" hrefLang="it" className="underline">Reset password (IT)</Link>.</p>
        </section>
      </div>
    </main>
  );
}
