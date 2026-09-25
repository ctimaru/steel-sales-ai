"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function AuthFinishPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "invite" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const isInvite = url.searchParams.get("invited") === "1";
      const isSignup = url.searchParams.get("signup") === "1";
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
          if (!cancelled) setMode("invite");
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
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function completeInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(passwordError.message);
      setSubmitting(false);
      return;
    }

    const { error: claimError } = await supabase.rpc("claim_pending_organization_invitations");
    if (claimError) {
      setError(claimError.message);
      setSubmitting(false);
      return;
    }

    router.replace("/onboarding?invited=1");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold tracking-[0.16em] text-slate-400">STEEL SALES AI</p>
        {mode === "loading" ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">Verifica account</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Stiamo completando la sessione e preparando il prossimo passaggio.
            </p>
          </>
        ) : null}

        {mode === "invite" ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">Completa il tuo invito</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Imposta una password personale. Il ruolo e l’azienda sono già determinati dall’invito e verranno applicati lato database.
            </p>
            <form onSubmit={completeInvitation} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Nuova password
                <Input className="mt-2" name="password" type="password" minLength={8} autoComplete="new-password" required />
              </label>
              {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              <button disabled={submitting} className="h-11 w-full rounded-lg bg-slate-950 text-sm font-semibold text-white disabled:opacity-50">
                {submitting ? "Salvataggio…" : "Entra nel workspace"}
              </button>
            </form>
          </>
        ) : null}

        {mode === "error" ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">Link non utilizzabile</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{error ?? "Il link potrebbe essere scaduto."}</p>
            <a href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Torna al login</a>
          </>
        ) : null}
      </div>
    </main>
  );
}
