import type { Metadata } from "next";
import Link from "next/link";

import { confirmRfqOptOut } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Annulla iscrizione alle richieste di offerta · Smart Steel Sales",
  robots: { index: false, follow: false },
};

/** RFQ-MAIL1 — recipient opt-out. A confirmation click is required here so
 * that link scanners cannot unsubscribe a mailbox; mail clients use the
 * one-click POST endpoint from the List-Unsubscribe header instead. */
export default async function RfqUnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ esito?: string }>;
}) {
  const { token } = await params;
  const { esito } = await searchParams;

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-10 text-[#1d2824]">
      <div className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Smart Steel Sales · Richieste di offerta</p>
        {esito === "ok" ? (
          <>
            <h1 className="text-2xl font-semibold" data-testid="rfq-opt-out-done">Iscrizione annullata</h1>
            <p className="text-sm leading-6 text-[#52615b]">
              Questo indirizzo non riceverà altre richieste di offerta inviate tramite Smart Steel Sales.
              Puoi comunque rispondere alla richiesta già ricevuta, se lo desideri.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Non vuoi ricevere altre richieste di offerta?</h1>
            <p className="text-sm leading-6 text-[#52615b]">
              Confermando, il tuo indirizzo non riceverà più richieste di offerta inviate da buyer tramite
              Smart Steel Sales. La richiesta già ricevuta resta consultabile dal suo link.
            </p>
            {esito === "errore" ? (
              <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Link non valido o scaduto. Scrivici rispondendo all&apos;email ricevuta e rimuoveremo l&apos;indirizzo.
              </p>
            ) : null}
            <form action={confirmRfqOptOut}>
              <input type="hidden" name="token" value={token} />
              <button className="min-h-11 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white">
                Conferma: non inviarmi altre richieste
              </button>
            </form>
          </>
        )}
        <p className="text-xs text-[#52615b]">
          <Link href="/privacy" className="underline">Informativa privacy</Link>
        </p>
      </div>
    </main>
  );
}
