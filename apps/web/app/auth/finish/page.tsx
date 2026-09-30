"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ProductBrand } from "@/components/product-brand";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function AuthFinishPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "invite" | "error">("loading");
  const [inviteKind, setInviteKind] = useState<"organization" | "platform">("organization");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const isInvite = url.searchParams.get("invited") === "1";
      const isStaffInvite = url.searchParams.get("staff") === "1";
      const isSignup = url.searchParams.get("signup") === "1";
      const isRecovery = url.searchParams.get("recovery") === "1";
      const code = url.searchParams.get("code");

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          }
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) {
          throw userError ?? new Error("Sessione di autenticazione non disponibile.");
        }

        if (isInvite) {
          if (!cancelled) {
            setInviteKind(isStaffInvite ? "platform" : "organization");
            setMode("invite");
          }
          return;
        }

        if (isRecovery) {
          router.replace("/reset-password");
          router.refresh();
          return;
        }

        if (isSignup) {
          router.replace("/register");
          router.refresh();
          return;
        }

        await supabase.rpc("claim_pending_organization_invitations");
        router.replace("/onboarding");
        router.refresh();
      } catch (authError) {
        if (cancelled) return;
        setError(authError instanceof Error ? authError.message : "Link di autenticazione non valido o scaduto.");
        setMode("error");
      }
    }

    void establishSession();
    return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f4f3] px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md rounded-[28px] border border-[#dce2df] bg-white p-6 shadow-[0_14px_44px_rgba(18,61,52,0.07)] sm:p-8">
        <ProductBrand href="/" />

        {mode === "loading" ? (
          <>
            <p className="app-kicker mt-8">Verifica account</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
              Stiamo completando l’accesso
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Verifichiamo il link e prepariamo automaticamente il prossimo passaggio.
            </p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#e7ece9]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#438d7a]" />
            </div>
          </>
        ) : null}

        {mode === "invite" ? (
          <>
            <p className="app-kicker mt-8">Invito</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
              {inviteKind === "platform" ? "Attiva il tuo accesso Platform" : "Completa il tuo invito"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              {inviteKind === "platform"
                ? "Imposta una password personale. Le autorizzazioni previste per il tuo ruolo verranno applicate dopo la verifica dell’identità."
                : "Imposta una password personale. Azienda e ruolo sono già determinati dall’invito ricevuto."}
            </p>

            <form onSubmit={completeInvitation} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-[#43524c]">
                Nuova password
                <Input
                  className="mt-2 h-11"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
                <span className="mt-1.5 block text-xs text-[#7b8782]">
                  Almeno 8 caratteri. Usa una password personale e non riutilizzata.
                </span>
              </label>

              {error ? (
                <p className="rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-3 py-2 text-sm text-[#9f2f24]">
                  {error}
                </p>
              ) : null}

              <button
                disabled={submitting}
                className="app-primary h-11 w-full rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Salvataggio…"
                  : inviteKind === "platform"
                    ? "Attiva accesso Platform"
                    : "Entra nel workspace"}
              </button>
            </form>
          </>
        ) : null}

        {mode === "error" ? (
          <>
            <p className="app-kicker mt-8">Accesso non completato</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
              Link non utilizzabile
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              {error ?? "Il link potrebbe essere scaduto o già utilizzato."}
            </p>
            <a
              href="/login"
              className="app-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
            >
              Torna al login
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}
