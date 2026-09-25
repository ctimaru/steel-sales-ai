import type { Metadata } from "next";
import Link from "next/link";

import { Input } from "@/components/ui/input";

import { login } from "./actions";

export const metadata: Metadata = {
  title: "Accedi",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.08fr_0.92fr]">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold tracking-[0.16em] text-slate-300">
            STEEL SALES AI
          </div>
          <h1 className="mt-16 max-w-xl text-5xl font-semibold leading-[1.05]">
            Il sistema operativo commerciale per il settore siderurgico.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
            Memoria commerciale privata, storico prezzi, ricerca con evidenza e un network industriale costruito per produttori, commercianti, terzisti e utilizzatori.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-semibold text-slate-200">Commercial Memory</p>
            <p className="mt-1 leading-6">Email, offerte, prezzi, ordini e documenti ricercabili.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-semibold text-slate-200">Steel Industry Network</p>
            <p className="mt-1 leading-6">Profili azienda, capability e discovery industriale.</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-400">STEEL SALES AI</p>
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-500 lg:mt-0">Bentornato</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Accedi al tuo workspace
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Usa le credenziali della tua azienda. I nuovi account aziendali seguono un flusso di registrazione e approvazione separato.
          </p>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}

          <form action={login} className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <Input className="mt-2 h-11" name="email" type="email" autoComplete="email" required />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <Input
                className="mt-2 h-11"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs font-semibold text-slate-500 underline underline-offset-4 hover:text-slate-900">
                Password dimenticata?
              </Link>
            </div>
            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Accedi
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-sm font-semibold text-slate-900">La tua azienda non è ancora su Steel Sales AI?</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Crea il tuo account e invia la richiesta di registrazione aziendale. L’accesso al workspace viene attivato dopo approvazione.
            </p>
            <Link
              href="/register"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 transition hover:border-slate-500"
            >
              Registra la tua azienda
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
