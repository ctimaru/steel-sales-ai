import type { Metadata } from "next";
import Link from "next/link";

import { FocusHeader, FocusPanel } from "@/components/focus-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import { Input } from "@/components/ui/input";
import { safeInternalNext } from "@/lib/auth-next";
import { privateNoIndexRobots } from "@/lib/seo";

import { login } from "./actions";

export const metadata: Metadata = {
  title: "Accedi",
  robots: privateNoIndexRobots,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;
  const nextPath = next ? safeInternalNext(next, "/dashboard") : null;
  const registrationHref = nextPath?.startsWith("/register") ? nextPath : "/register";

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center justify-between gap-4">
          <ProductBrand href="/" />
          <Link href="/" className="text-xs font-semibold text-[#66736e] hover:text-[#173f35]">
            Torna al sito
          </Link>
        </div>

        <div className="mt-10">
          <FocusHeader
            eyebrow="Accesso"
            title="Accedi al tuo workspace"
            description="Email e password. Tutto il resto viene dopo l’accesso, nel contesto corretto."
          />
        </div>

        <FocusPanel className="mt-5">
          {error ? (
            <div role="alert" className="mb-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]">
              {error}
            </div>
          ) : null}

          {message ? (
            <div role="status" aria-live="polite" className="mb-5 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-3 text-sm text-[#173f35]">
              {message}
            </div>
          ) : null}

          <form action={login} className="space-y-5">
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <label className="block text-sm font-medium text-[#43524c]">
              Email
              <Input className="mt-2 h-11" name="email" type="email" autoComplete="email" inputMode="email" required />
            </label>

            <label className="block text-sm font-medium text-[#43524c]">
              Password
              <Input className="mt-2 h-11" name="password" type="password" autoComplete="current-password" minLength={8} required />
            </label>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs font-semibold text-[#66736e] underline decoration-[#cbd5d0] underline-offset-4 hover:text-[#173f35]">
                Password dimenticata?
              </Link>
            </div>

            <PendingSubmitButton
              pendingLabel="Accesso in corso…"
              className="app-primary h-11 w-full rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Accedi
            </PendingSubmitButton>
          </form>
        </FocusPanel>

        <div className="mt-5 text-center text-sm text-[#66736e]">
          La tua azienda non è ancora attiva?{" "}
          <Link href={registrationHref} className="font-semibold text-[#173f35] underline decoration-[#b8d2c8] underline-offset-4">
            Registra o verifica l’azienda
          </Link>
        </div>
      </div>
    </main>
  );
}
