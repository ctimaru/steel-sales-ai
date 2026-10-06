import type { Metadata } from "next";

import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { absoluteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Crea distinta per richiesta offerta acciaio e tubi",
  description:
    "Crea gratuitamente una distinta per i tuoi fornitori: articoli, quantità, kg/m, Target €/t e Target €/m. Copiala nell'email oppure accedi per salvarla e inviarla.",
  alternates: {
    canonical: absoluteUrl("/distinta"),
  },
  openGraph: {
    title: "Crea distinta · Smart Steel Sales",
    description:
      "Buyer tool gratuito per costruire richieste di offerta acciaio e tubi con Target €/t e Target €/m.",
    url: absoluteUrl("/distinta"),
    type: "website",
  },
};

export default async function BuyerDistintaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const authenticated = Boolean(data.user);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="rounded-3xl border border-[#244d43] bg-[#123d34] px-5 py-8 text-white sm:px-7 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
          Crea distinta · gratuito
        </p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Prepara la richiesta da inviare ai tuoi fornitori.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d8e5e0] sm:text-base">
          Inserisci materiale, quantità, peso kg/m e il tuo Target €/t. Ottieni automaticamente il
          rispettivo Target €/m e copia una distinta pulita direttamente nella tua email. Nessun
          riferimento a listini produttore: è uno strumento indipendente pensato per buyer.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">
            Nessun account per creare e copiare
          </span>
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">
            Target €/t → Target €/m
          </span>
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">
            Login per salvare e inviare
          </span>
        </div>
      </header>

      <div className="mt-6">
        <BuyerDistintaBuilder
          authenticated={authenticated}
          emailConfigured={emailConfigured}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          Perché è utile
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">1. Standardizza la richiesta</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Tutti i fornitori ricevono la stessa distinta, con quantità e obiettivo prezzo leggibili.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">2. Evita conversioni manuali</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Dal Target €/t e dal peso kg/m ricaviamo il Target €/m senza fogli separati.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">3. Un solo invio, più fornitori</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Dopo il login puoi salvare la richiesta e preparare l'invio diretto a una lista di fornitori.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
