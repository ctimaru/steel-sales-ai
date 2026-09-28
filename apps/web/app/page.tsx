import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductBrand } from "@/components/product-brand";
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
    <main className="min-h-screen bg-[#f5f7fb] text-[#1e2b45]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-7 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#e3eaf5] pb-6">
          <ProductBrand href="/" />
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-[#dbe5f1] bg-white px-4 py-2 text-sm font-semibold text-[#40516a] hover:border-[#bdd1f4] hover:bg-[#f3f7ff] hover:text-[#2f6fed]"
            >
              Accedi
            </Link>
            <Link
              href="/register"
              className="hidden rounded-xl bg-[#2f6fed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245ed1] sm:inline-flex"
            >
              Registra azienda
            </Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e5ff] bg-[#eef5ff] px-3 py-1.5 text-xs font-semibold text-[#2f6fed]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2f6fed]" />
              B2B intelligence for steel & tube
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#1e2b45] sm:text-6xl">
              La conoscenza commerciale della tua azienda diventa
              <span className="text-[#2f6fed]"> infrastruttura.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-[#68788e] sm:text-lg">
              Una Commercial Memory privata per il tuo lavoro quotidiano, collegata a Network, Marketplace e
              Steel Knowledge condivisi senza esporre i dati commerciali del team.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-[#2f6fed] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#245ed1]"
              >
                Accedi al workspace
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-[#dbe5f1] bg-white px-5 py-3 text-sm font-semibold text-[#40516a] hover:border-[#bdd1f4] hover:bg-[#f3f7ff] hover:text-[#2f6fed]"
              >
                Registra la tua azienda
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[#e3eaf5] pt-5 text-xs font-medium text-[#7e8da1]">
              <span>Commercial Memory privata</span>
              <span>Network condiviso</span>
              <span>Knowledge condivisa</span>
              <span>Governance & provenance</span>
            </div>
          </div>

          <div className="rounded-3xl border border-[#dbe7f7] bg-white p-4 shadow-[0_18px_60px_rgba(30,43,69,0.08)]">
            <div className="rounded-2xl border border-[#e3eaf5] bg-[#f8fbff] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Product architecture</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1e2b45]">Quattro spazi, un solo prodotto</h2>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">
                Il confine tra dati privati e superfici comuni rimane esplicito in ogni momento.
              </p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Home Workspace", "Commercial Memory · intelligence · operations", "PRIVATE"],
                ["Steel Network", "aziende · profili · capability · inquiry", "SHARED"],
                ["Marketplace", "domanda · opportunità · futuro unlock", "SHARED"],
                ["Steel Knowledge", "norme · gradi · dimensioni · pesi", "SHARED"],
              ].map(([title, body, tag]) => (
                <div key={title} className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#1e2b45]">{title}</h3>
                    <span className={tag === "PRIVATE"
                      ? "rounded-md bg-[#f2f5f9] px-2 py-1 text-[9px] font-bold tracking-[0.1em] text-[#64748b]"
                      : "rounded-md bg-[#eef5ff] px-2 py-1 text-[9px] font-bold tracking-[0.1em] text-[#2f6fed]"
                    }>
                      {tag}
                    </span>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#68788e]">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-[#d7e5ff] bg-[#eef5ff] px-4 py-3">
              <p className="text-[11px] font-semibold text-[#2f6fed]">
                Built around evidence, provenance and controlled data boundaries.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#e3eaf5] py-5 text-xs text-[#7e8da1] sm:flex-row sm:items-center sm:justify-between">
          <span>Commercial data stays private to each company workspace.</span>
          <span>Built for speed, traceability and industrial workflows.</span>
        </footer>
      </div>
    </main>
  );
}
