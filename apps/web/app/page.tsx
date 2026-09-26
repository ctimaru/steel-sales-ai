import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function PublicHomePage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-indigo-300">STEEL SALES AI</p>
            <p className="mt-1 text-sm text-slate-400">Commercial Memory + Steel Industry Network</p>
          </div>
          <Link
            href="/login"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Accedi
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-semibold text-indigo-300">B2B intelligence per il settore siderurgico</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
              La memoria commerciale della tua azienda, collegata a un Network industriale condiviso.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Cerca ciò che la tua organizzazione sa già, scopri aziende e capability nel Network e crea interazioni B2B governate senza esporre dati commerciali privati.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Accedi al workspace
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Registra la tua azienda
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              ["Commercial Memory", "Storico privato di richieste, offerte, ordini, prezzi e fonti."],
              ["Steel Network", "Directory condivisa di aziende, prodotti, capability, mercati e certificazioni."],
              ["Interaction Layer", "Save, Follow e Inquiry con privacy e governance esplicite."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 py-5 text-xs text-slate-500">
          I dati commerciali privati restano separati dal Network condiviso.
        </footer>
      </div>
    </main>
  );
}
