import Link from "next/link";

import type { NetworkAccessState } from "@/lib/network-access";
import { appRoutes } from "@/lib/routes";

function stateCopy(state: NetworkAccessState["state"]) {
  if (state === "expired") {
    return {
      eyebrow: "Accesso scaduto",
      title: "Riattiva l'accesso al Network",
      body: "Il tuo precedente accesso al Network è terminato. Directory, filtri avanzati e intelligence B2B restano protetti finché l'entitlement non viene riattivato.",
    };
  }

  if (state === "revoked") {
    return {
      eyebrow: "Accesso non attivo",
      title: "Il Network è attualmente bloccato per questa azienda",
      body: "L'accesso al prodotto Network non è attivo. Il profilo della tua azienda e il claim restano separati e continuano a essere gestibili.",
    };
  }

  return {
    eyebrow: "Modulo premium",
    title: "Sblocca il Network di Smart Steel Sales",
    body: "Il Network è un prodotto privato per aziende registrate: directory ricca, filtri avanzati, capability, mercati, follow, activity e inquiry B2B.",
  };
}

export function NetworkAccessGate({
  access,
  organizationName,
}: {
  access: NetworkAccessState;
  organizationName: string;
}) {
  const copy = stateCopy(access.state);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4 sm:py-8">
      <section className="overflow-hidden rounded-[28px] border border-[#d7dfdb] bg-white shadow-[0_12px_36px_rgba(18,61,52,0.05)]">
        <div className="h-1.5 bg-[#173f35]" />
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#173f35] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                Network · Privato
              </span>
              <span className="rounded-full bg-[#edf5f2] px-3 py-1.5 text-[10px] font-bold text-[#173f35]">
                {copy.eyebrow}
              </span>
            </div>

            <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#66736e] sm:text-base">
              {copy.body}
            </p>

            <div className="mt-6 rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Azienda
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1d2824]">{organizationName}</p>
              <p className="mt-1 text-xs text-[#66736e]">
                Stato accesso: {access.state === "locked" ? "non attivo" : access.state}.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={appRoutes.company.profile}
                className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold"
              >
                Gestisci il profilo azienda
              </Link>
              <Link
                href={appRoutes.home}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
              >
                Torna alla Home
              </Link>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#87938e]">
              PA1.3 non introduce un checkout fittizio: pagamento e packaging verranno collegati
              allo stesso entitlement quando il modulo billing sarà pronto.
            </p>
          </div>

          <div className="grid content-start gap-3">
            {[
              ["Directory ricca", "Aziende della filiera organizzate e ricercabili."],
              ["Filtri avanzati", "Ruoli, prodotti, capability, mercati e geografia."],
              ["Relazioni", "Salvati, follow, activity e segnali utili."],
              ["Inquiry B2B", "Contatto governato dentro il Network."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-[#e0e6e3] bg-[#f8faf9] p-4">
                <p className="text-sm font-semibold text-[#1d2824]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#66736e]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e0e6e3] bg-[#f8faf9] px-5 py-4">
        <p className="text-xs leading-5 text-[#66736e]">
          <strong className="text-[#1d2824]">Claim e profilo aziendale restano separati.</strong>{" "}
          Non serve acquistare il Network per rivendicare la propria azienda o mantenerne aggiornato il profilo.
        </p>
      </section>
    </div>
  );
}
