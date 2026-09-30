import type { Metadata } from "next";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import { Input } from "@/components/ui/input";
import { privateNoIndexRobots } from "@/lib/seo";

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
    <main className="grid min-h-screen bg-[#f2f4f3] lg:grid-cols-[1.02fr_0.98fr]">
      <section className="hidden bg-[#123d34] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <ProductBrand href="/" inverse />
          <span className="mt-16 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d9e8e2]">
            Smart Steel Sales
          </span>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em]">
            Il lavoro commerciale, finalmente in un unico posto.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[#c6d8d1]">
            Memoria commerciale privata, Network industriale, Marketplace e conoscenza tecnica
            costruiti intorno al settore steel.
          </p>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="font-semibold text-white">Workspace privato</p>
            <p className="mt-1 leading-6 text-[#c6d8d1]">
              Email, offerte, prezzi, ordini e documenti restano nella tua azienda.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="font-semibold text-white">Ecosistema condiviso</p>
            <p className="mt-1 leading-6 text-[#c6d8d1]">
              Network e Marketplace hanno confini espliciti e governance separata.
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-white px-5 py-8 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <ProductBrand href="/" />
          </div>

          <p className="app-kicker mt-8 lg:mt-0">Bentornato</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1d2824]">
            Accedi al tuo workspace
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Usa le credenziali associate alla tua azienda. Se stai registrando una nuova azienda,
            continua dal percorso dedicato.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]"
            >
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-3 text-sm text-[#173f35]">
              {message}
            </div>
          ) : null}

          <form action={login} className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-[#43524c]">
              Email
              <Input
                className="mt-2 h-11"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
              />
            </label>

            <label className="block text-sm font-medium text-[#43524c]">
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
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-[#66736e] underline decoration-[#cbd5d0] underline-offset-4 hover:text-[#173f35]"
              >
                Password dimenticata?
              </Link>
            </div>

            <button
              type="submit"
              className="app-primary h-11 w-full rounded-xl text-sm font-semibold"
            >
              Accedi
            </button>
          </form>

          <div className="mt-8 rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5">
            <p className="text-sm font-semibold text-[#1d2824]">
              La tua azienda non è ancora su Smart Steel Sales?
            </p>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Crea un account, inserisci i dati aziendali e invia la richiesta. Il workspace viene
              aperto solo dopo revisione.
            </p>
            <Link
              href="/register"
              className="app-secondary mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold"
            >
              Registra la tua azienda
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
