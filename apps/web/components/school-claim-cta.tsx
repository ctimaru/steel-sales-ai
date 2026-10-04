import Link from "next/link";

export function SchoolClaimCta() {
  return (
    <section
      aria-labelledby="school-claim-title"
      className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <div className="overflow-hidden rounded-3xl border border-[#c9ddd5] bg-[#123d34] text-white">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
              Dalla Scuola alla tua azienda
            </p>
            <h2 id="school-claim-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Questa informazione ti serve nel lavoro?
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d8e5e0]">
              Cerca la tua azienda per nome o Partita IVA e verifica se il profilo può essere
              rivendicato. La ricerca pubblica mostra solo l&apos;identità minima: il Network
              completo resta privato e separato dalla Scuola.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href="/azienda"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-[#173f35] transition hover:bg-[#edf5f2]"
            >
              Trova la tua azienda
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Registra una nuova azienda
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
