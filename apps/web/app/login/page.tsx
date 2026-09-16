import type { Metadata } from "next";

import { Input } from "@/components/ui/input";

import { login, signup } from "./actions";

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
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold tracking-[0.16em] text-slate-300">
            STEEL SALES AI
          </div>
          <h1 className="mt-16 max-w-xl text-5xl font-semibold leading-[1.05]">
            La memoria commerciale del tuo business siderurgico.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
            Importa email e documenti, ritrova offerte e prezzi storici e interroga le fonti con evidenza verificabile.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          P1 · Commercial Memory · Parser v4 · Knowledge Graph con provenance
        </p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <p className="text-sm font-semibold text-slate-500">Steel Sales AI</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Accedi al workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Accedi oppure crea il primo account della tua azienda. Gli utenti invitati usano la stessa schermata dopo aver impostato la password.
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
              <Input className="mt-2" name="email" type="email" autoComplete="email" required />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <Input
                className="mt-2"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Accedi
            </button>
            <button
              type="submit"
              formAction={signup}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition hover:border-slate-400"
            >
              Crea un nuovo workspace
            </button>
          </form>

          <p className="mt-6 text-xs leading-5 text-slate-400">
            La creazione del workspace parte dopo la verifica email. I ruoli e i permessi sono applicati lato database tramite RLS.
          </p>
        </div>
      </section>
    </main>
  );
}
