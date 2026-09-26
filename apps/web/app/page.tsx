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
    <main className="min-h-screen bg-[#0b171e] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden px-6 py-7 lg:px-8">
        <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full border border-[#3c8192]/10" />
        <div className="pointer-events-none absolute -right-8 top-40 h-44 w-44 rounded-full border border-[#6e9eab]/10" />
        <div className="pointer-events-none absolute bottom-20 left-[-120px] h-72 w-72 rounded-full border border-[#c36e32]/8" />

        <header className="relative z-10 flex items-center justify-between border-b border-white/8 pb-6">
          <ProductBrand href="/" inverse />
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-white/12 px-4 py-2 text-sm font-semibold text-[#d5e4e8] hover:border-[#6e9eab]/40 hover:bg-white/[0.05]"
            >
              Accedi
            </Link>
            <Link
              href="/register"
              className="hidden rounded-xl bg-[#1b4c5d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#28677a] sm:inline-flex"
            >
              Registra azienda
            </Link>
          </div>
        </header>

        <section className="relative z-10 grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6e9eab]/20 bg-[#28677a]/10 px-3 py-1.5 text-xs font-semibold text-[#9fc1c9]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c36e32]" />
              B2B intelligence for steel & tube
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">
              La conoscenza commerciale della tua azienda diventa
              <span className="text-[#86adb7]"> infrastruttura.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-[#91a3ab] sm:text-lg">
              Ricerca storico, prezzi, RFQ e offerte. Scopri aziende e capability nel Network.
              Costruisci relazioni B2B senza esporre la memoria commerciale privata del tuo team.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0b171e] shadow-[0_8px_30px_rgba(0,0,0,0.16)] hover:bg-[#eef5f6]"
              >
                Accedi al workspace
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-[#6e9eab]/30 bg-[#1b4c5d] px-5 py-3 text-sm font-semibold text-white hover:bg-[#28677a]"
              >
                Registra la tua azienda
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/8 pt-5 text-xs font-medium text-[#71858e]">
              <span>Commercial Memory privata</span>
              <span>Steel Industry Network</span>
              <span>Governance & provenance</span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[22px] border border-white/10 bg-[#10232c]/80 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-3">
                <div>
                  <p className="text-xs font-semibold text-[#d5e4e8]">Steel intelligence workspace</p>
                  <p className="mt-1 text-[11px] text-[#71858e]">One operating surface for commercial memory + network</p>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#3c8192]" />
                  <span className="h-2 w-2 rounded-full bg-[#c36e32]" />
                </div>
              </div>

              <div className="grid gap-3 p-3 sm:grid-cols-2">
                {[
                  ["Commercial Memory", "RFQ · offerte · ordini · prezzi", "PRIVATE"],
                  ["Steel Network", "aziende · prodotti · capability", "SHARED"],
                  ["AI Search", "ricerca cross-documento con fonti", "FAST"],
                  ["B2B Interaction", "save · follow · inquiry", "CONTROLLED"],
                ].map(([title, body, tag]) => (
                  <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-sm font-semibold text-white">{title}</h2>
                      <span className="rounded-md bg-[#0b171e] px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-[#7fa8b3]">
                        {tag}
                      </span>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[#82959e]">{body}</p>
                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full w-3/5 rounded-full bg-[#3c8192]/70" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mx-3 mb-3 rounded-2xl border border-[#c36e32]/15 bg-[#c36e32]/[0.055] px-4 py-3">
                <p className="text-[11px] font-semibold text-[#d8a07b]">Built around evidence, not black-box answers.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="relative z-10 flex flex-col gap-2 border-t border-white/8 py-5 text-xs text-[#61747d] sm:flex-row sm:items-center sm:justify-between">
          <span>Commercial data stays private to each company workspace.</span>
          <span>Built for speed, traceability and industrial workflows.</span>
        </footer>
      </div>
    </main>
  );
}
