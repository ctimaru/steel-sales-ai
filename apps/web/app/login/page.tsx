import type { Metadata } from "next";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { privateNoIndexRobots } from "@/lib/seo";
import { ProductBrand } from "@/components/product-brand";

import { login } from "./actions";

export const metadata: Metadata = {
  title: "Accedi",
  robots: privateNoIndexRobots,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="grid min-h-screen bg-[#f5f7fb] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden border-r border-[#e3eaf5] bg-[#f8fbff] p-12 lg:flex lg:flex-col lg:justify-between">
        <div>
          <ProductBrand href="/" />
          <span className="mt-16 inline-flex rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
            Steel Sales AI
          </span>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.05] text-[#1e2b45]">
            Il sistema operativo commerciale per il settore siderurgico.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[#68788e]">
            Workspace privato per memoria e operatività, collegato a Network, Marketplace e Knowledge condivisi.
          </p>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
            <p className="font-semibold text-[#1e2b45]">Home Workspace</p>
            <p className="mt-1 leading-6 text-[#68788e]">Email, offerte, prezzi, ordini e documenti rimangono privati.</p>
          </div>
          <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
            <p className="font-semibold text-[#1e2b45]">Shared ecosystem</p>
            <p className="mt-1 leading-6 text-[#68788e]">Network, Marketplace e Knowledge hanno confini espliciti.</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <ProductBrand href="/" compact />
          </div>

          <p className="mt-6 text-sm font-semibold text-[#2f6fed] lg:mt-0">Bentornato</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45]">
            Accedi al tuo workspace
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#68788e]">
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
            <label className="block text-sm font-medium text-[#40516a]">
              Email
              <Input className="mt-2 h-11" name="email" type="email" autoComplete="email" required />
            </label>
            <label className="block text-sm font-medium text-[#40516a]">
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
              <Link href="/forgot-password" className="text-xs font-semibold text-[#68788e] underline underline-offset-4 hover:text-[#1e2b45]">
                Password dimenticata?
              </Link>
            </div>
            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-[#2f6fed] text-sm font-semibold text-white shadow-sm transition hover:bg-[#245ed1]"
            >
              Accedi
            </button>
          </form>

          <div className="mt-8 border-t border-[#e1e8f2] pt-6">
            <p className="text-sm font-semibold text-[#2f4059]">La tua azienda non è ancora su Steel Sales AI?</p>
            <p className="mt-1 text-sm leading-6 text-[#68788e]">
              Crea il tuo account e invia la richiesta di registrazione aziendale. L’accesso al workspace viene attivato dopo approvazione.
            </p>
            <Link
              href="/register"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#dbe5f1] bg-white text-sm font-semibold text-[#40516a] transition hover:border-[#bdd1f4] hover:bg-[#f3f7ff] hover:text-[#2f6fed]"
            >
              Registra la tua azienda
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
