"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      setSubmitting(false);
      return;
    }

    if (password !== confirmation) {
      setError("Le password non coincidono.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Non è stato possibile aggiornare la password. Richiedi un nuovo link.");
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?message=Password%20aggiornata.%20Ora%20puoi%20accedere.");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-bold tracking-[0.16em] text-slate-400">STEEL SALES AI</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Imposta una nuova password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Scegli una password di almeno 8 caratteri.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-medium text-slate-700">
            Nuova password
            <Input className="mt-2 h-11" name="password" type="password" minLength={8} autoComplete="new-password" required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Conferma password
            <Input className="mt-2 h-11" name="confirmation" type="password" minLength={8} autoComplete="new-password" required />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Salvataggio…" : "Aggiorna password"}
          </button>
        </form>
      </div>
    </main>
  );
}
