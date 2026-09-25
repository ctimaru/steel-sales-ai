import type { Metadata } from "next";
import Link from "next/link";

import { Input } from "@/components/ui/input";

import { requestPasswordReset } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Recupera password",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-bold tracking-[0.16em] text-slate-400">STEEL SALES AI</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Recupera la password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Inserisci l’email del tuo account. Se esiste, riceverai un link sicuro per impostare una nuova password.
        </p>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {message ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
        ) : null}

        <form action={requestPasswordReset} className="mt-7 space-y-5">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <Input className="mt-2 h-11" name="email" type="email" autoComplete="email" required />
          </label>
          <button className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white">
            Invia link di recupero
          </button>
        </form>

        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-slate-600 underline underline-offset-4">
          Torna al login
        </Link>
      </div>
    </main>
  );
}
