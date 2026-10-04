import Link from "next/link";
import type { ReactNode } from "react";

import { ProductBrand } from "@/components/product-brand";
import {
  LEGAL_VERSION,
  legalIdentity,
  legalIdentityConfigured,
  legalIdentityRows,
} from "@/lib/legal";

export function LegalPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const identity = legalIdentity();
  const configured = legalIdentityConfigured(identity);

  return (
    <main className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <header className="border-b border-[#dce2df] bg-white">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <ProductBrand href="/" />
          <Link
            href="/"
            className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
          >
            Torna al sito
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Pagine legali" className="flex flex-wrap gap-2 text-xs font-semibold">
          {[
            ["/privacy", "Privacy"],
            ["/cookies", "Cookie & tracking"],
            ["/terms", "Termini d’uso"],
            ["/legal", "Informazioni legali"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full border border-[#d7dfdb] bg-white px-3 py-1.5 text-[#52615b] hover:border-[#8fb5a8] hover:text-[#173f35]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <section className="mt-6 rounded-[28px] border border-[#dce2df] bg-white p-6 shadow-[0_14px_44px_rgba(18,61,52,0.06)] sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#173f35] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5d6a65] sm:text-base">{intro}</p>

          {!configured ? (
            <div className="mt-6 rounded-2xl border border-[#e5c7a4] bg-[#fff8ef] p-4 text-sm leading-6 text-[#714b21]">
              <p className="font-bold">Informativa provvisoria · dati identificativi da completare</p>
              <p className="mt-1">
                La struttura della presente pagina è già pubblicata, ma l’identità e i recapiti reali del
                Titolare del trattamento / prestatore del servizio non sono ancora configurati. La pagina
                resta esclusa dall’indicizzazione fino al completamento. Nessun dato societario viene inventato.
              </p>
            </div>
          ) : null}

          <div className="mt-7 grid gap-2 rounded-2xl border border-[#e1e7e4] bg-[#f8faf9] p-4 text-sm">
            {legalIdentityRows(identity).map(([label, value]) => (
              <div key={label} className="grid gap-1 sm:grid-cols-[210px_1fr]">
                <span className="font-semibold text-[#52615b]">{label}</span>
                <span className="text-[#1d2824]">{value ?? "Da configurare"}</span>
              </div>
            ))}
            <div className="grid gap-1 sm:grid-cols-[210px_1fr]">
              <span className="font-semibold text-[#52615b]">Versione informativa</span>
              <span className="text-[#1d2824]">{LEGAL_VERSION}</span>
            </div>
          </div>

          <article className="legal-copy mt-8 space-y-7">{children}</article>
        </section>
      </div>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-[#173f35]">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-7 text-[#52615b]">{children}</div>
    </section>
  );
}
