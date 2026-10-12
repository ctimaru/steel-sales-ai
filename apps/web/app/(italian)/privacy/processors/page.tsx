import type { Metadata } from "next";

import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import {
  PROCESSOR_TRANSFER_REGISTER,
  PROCESSOR_TRANSFER_REGISTER_VERSION,
} from "@/lib/processor-transfer-register";
import { legalRobots } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Fornitori e trasferimenti dati",
  description:
    "Registro di trasparenza dei principali fornitori e trasferimenti internazionali di Smart Steel Sales.",
  alternates: { canonical: absoluteUrl("/privacy/processors") },
  robots: legalRobots(),
};

const PUBLIC_ENTRIES = PROCESSOR_TRANSFER_REGISTER.filter(
  (entry) => entry.launchState !== "operational-only",
);

function stateLabel(state: (typeof PUBLIC_ENTRIES)[number]["launchState"]) {
  if (state === "approved-baseline") return "Baseline approvata";
  if (state === "approved-with-transfer") return "Trasferimento documentato";
  if (state === "conditional") return "Verifica contrattuale/configurazione aperta";
  if (state === "blocked-for-customer-personal-data")
    return "Non approvato per dati personali cliente";
  return "Operativo";
}

export default function ProcessorRegisterPage() {
  return (
    <LegalPageShell
      eyebrow="GDPR · LR6"
      title="Fornitori e trasferimenti dati"
      intro={`Registro di trasparenza LR6, versione ${PROCESSOR_TRANSFER_REGISTER_VERSION}. Riporta i principali fornitori che possono trattare dati personali per erogare Smart Steel Sales e lo stato delle verifiche sui trasferimenti internazionali. Non sostituisce il DPA o i termini del singolo fornitore.`}
    >
      <LegalSection title="1. Criterio">
        <p>
          Smart Steel Sales distingue tra fornitori che trattano dati per conto della piattaforma,
          servizi con possibili trasferimenti fuori dallo SEE e strumenti operativi che non devono
          ricevere dati personali dei clienti nel normale flusso di produzione.
        </p>
        <p>
          Una voce indicata come &quot;verifica aperta&quot; o &quot;non approvata&quot; non viene
          presentata come conforme per supposizione: resta un gate prima dell&apos;uso commerciale
          del relativo trattamento.
        </p>
      </LegalSection>

      <LegalSection title="2. Registro dei principali fornitori">
        <div className="space-y-4">
          {PUBLIC_ENTRIES.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-[#d7e3df] bg-white/80 p-5 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[#123f36]">{entry.provider}</h3>
                  <p className="text-sm text-[#527068]">{entry.service}</p>
                </div>
                <span className="w-fit rounded-full bg-[#edf5f2] px-3 py-1 text-xs font-semibold text-[#1a5144]">
                  {stateLabel(entry.launchState)}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold text-[#244c43]">Uso e localizzazione</dt>
                  <dd className="mt-1 text-[#4b625d]">{entry.publicSummary}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#244c43]">Garanzia di trasferimento</dt>
                  <dd className="mt-1 text-[#4b625d]">{entry.transferMechanism}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#244c43]">Conservazione / stato</dt>
                  <dd className="mt-1 text-[#4b625d]">{entry.retention}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="3. AI e Commercial Memory">
        <p>
          Le funzioni di embedding/RAG del worker utilizzano attualmente un percorso Hugging Face
          Inference Providers. Poiché il provider di inferenza effettivo e la relativa catena
          contrattuale/localizzazione devono essere fissati e verificati, l&apos;invio di dati
          personali dei clienti a tale percorso non è approvato per il lancio commerciale.
        </p>
      </LegalSection>

      <LegalSection title="4. Aggiornamenti">
        <p>
          Il registro viene riesaminato quando cambia un fornitore, la regione di esecuzione,
          un subprocessor, il meccanismo di trasferimento o una configurazione che modifica il
          trattamento. Le fonti contrattuali e le evidenze operative complete sono mantenute nel
          registro interno di accountability.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
