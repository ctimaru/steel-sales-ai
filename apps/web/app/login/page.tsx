import type { Metadata } from "next";

import { Input } from "@/components/ui/input";

import { login } from "./actions";

export const metadata: Metadata = {
  title: "Accedi",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
            Ricerca richieste, offerte, ordini e consegne con tracciabilità fino alla
            mail sorgente.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          MVP · Database Supabase · Parser v3.1 · 504 email archiviate
        </p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <p className="text-sm font-semibold text-slate-500">Steel Sales AI</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Accedi al workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Usa l’utente Supabase Auth associato all’app.
          </p>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
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
                required
              />
            </label>
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Accedi
            </button>
          </form>

          <p className="mt-6 text-xs leading-5 text-slate-400">
            In ambiente locale senza chiavi Supabase puoi usare direttamente /dashboard
            in modalità demo.
          </p>
        </div>
      </section>
    </main>
  );
}
