"use client";

import Link from "next/link";
import { useState } from "react";

type PersonaKey = "merchant" | "user" | "processor" | "producer";

type Persona = {
  label: string;
  question: string;
  benefit: string;
  who: string;
  search: string;
  emphasis?: string;
};

const personas: Record<PersonaKey, Persona> = {
  merchant: {
    label: "Commerciante",
    question: "Sei un commerciante?",
    benefit:
      "Trova nuove fonti di approvvigionamento, amplia il portafoglio prodotti e individua alternative quando un cliente chiede qualcosa che oggi non copri.",
    who:
      "Produttori, terzisti e utilizzatori. Puoi costruire una rete di fornitori e partner senza partire ogni volta da zero.",
    search:
      "Famiglia prodotto, norma, grado, area geografica, capability e mercati serviti.",
    emphasis:
      "Chi produce cosa: individua produttori per famiglia, norma, grado e capability.",
  },
  user: {
    label: "Utilizzatore",
    question: "Sei un utilizzatore?",
    benefit:
      "Riduci il tempo necessario per trovare fornitori adatti e crea alternative qualificate per materiali, lavorazioni e aree geografiche.",
    who:
      "Produttori, commercianti e terzisti coerenti con il materiale o la lavorazione che ti serve.",
    search:
      "Prodotto, norma, grado, disponibilità dichiarata, area e capability di servizio o trasformazione.",
  },
  processor: {
    label: "Terzista",
    question: "Sei un terzista?",
    benefit:
      "Rendi visibili le tue capability e trova aziende che possono aver bisogno delle lavorazioni che offri.",
    who:
      "Produttori, commercianti e utilizzatori che operano nei segmenti compatibili con i tuoi servizi.",
    search:
      "Tipo di lavorazione, materiali trattati, mercati serviti, aree operative e aziende della filiera.",
  },
  producer: {
    label: "Produttore",
    question: "Sei un produttore?",
    benefit:
      "Amplia i canali commerciali e individua distributori, trasformatori e utilizzatori nei mercati che vuoi sviluppare.",
    who:
      "Commercianti, terzisti e utilizzatori rilevanti per i tuoi prodotti e per le aree che vuoi presidiare.",
    search:
      "Prodotti, norme, gradi, capability, mercati e profili aziendali utili allo sviluppo commerciale.",
  },
};

const order: PersonaKey[] = ["merchant", "user", "processor", "producer"];

export function PublicNetworkRoleExplorer() {
  const [active, setActive] = useState<PersonaKey>("merchant");
  const persona = personas[active];

  return (
    <section
      id="network"
      className="border-b border-[#dce2df] bg-white"
      aria-labelledby="network-value-title"\n      aria-label="Network per Produttori, Commercianti, Terzisti e Utilizzatori"
    >
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
            Network
          </p>
          <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-bold text-[#173f35]">
            Privato · Premium
          </span>
        </div>

        <div className="mt-2 max-w-3xl">
          <h2
            id="network-value-title"
            className="text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl"
          >
            La filiera steel, utile in base al tuo ruolo.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Il Network non è una semplice lista di aziende: serve a capire chi può esserti utile,
            chi produce o lavora cosa e dove trovare nuove relazioni commerciali.
          </p>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold text-[#66736e]">Tu che azienda sei?</p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Scegli il tuo ruolo nella filiera"
          >
            {order.map((key) => {
              const selected = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(key)}
                  className={[
                    "rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                    selected
                      ? "border-[#2f7c69] bg-[#173f35] text-white"
                      : "border-[#d8e0dc] bg-white text-[#52615b] hover:border-[#9dbab0] hover:text-[#173f35]",
                  ].join(" ")}
                >
                  {personas[key].label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="mt-5 rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5 sm:p-6"
          role="tabpanel"
        >
          <p className="text-lg font-semibold text-[#1d2824]">{persona.question}</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Che beneficio hai
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[#52615b]">{persona.benefit}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Chi puoi trovare
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[#52615b]">{persona.who}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Cosa puoi cercare
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[#52615b]">{persona.search}</p>
            </div>
          </div>

          {persona.emphasis ? (
            <div className="mt-4 rounded-xl border border-[#c7ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#173f35]">
              {persona.emphasis}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cfd9d5] bg-white px-4 text-sm font-semibold text-[#52615b] hover:bg-[#f2f5f4] hover:text-[#173f35]"
            >
              Accedi al Network
            </Link>
            <Link
              href="/register"
              className="platform-primary inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold"
            >
              Registra azienda
            </Link>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-[#7a8782]">
            La directory completa, i filtri avanzati e i profili dettagliati restano visibili solo
            alle aziende registrate e abilitate.
          </p>
        </div>
      </div>
    </section>
  );
}
