import type { Metadata } from "next";
import Link from "next/link";

import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { legalRobots } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie & Tracking Policy",
  description: "Informazioni su cookie, local storage e Google Analytics utilizzati da Smart Steel Sales.",
  alternates: { canonical: absoluteUrl("/cookies") },
  robots: legalRobots(),
};

export default function CookiesPage() {
  return (
    <LegalPageShell
      eyebrow="Cookie · local storage · analytics"
      title="Cookie & Tracking Policy"
      intro="Smart Steel Sales distingue le tecnologie necessarie o richieste dall’utente dagli strumenti statistici non essenziali. Google Analytics non viene caricato prima del consenso."
    >
      <LegalSection title="1. Tecnologie necessarie e funzionali">
        <p>
          Il sito può utilizzare cookie o storage locale strettamente necessari per autenticazione,
          sicurezza, mantenimento della sessione e preferenze richieste dall’utente.
        </p>
        <p>
          Il calcolatore pesi usa local storage per funzioni come ultimi calcoli, preferiti e
          “Salva il Calcolatore”. Questi dati restano sul dispositivo nel layer di retention WC4.
        </p>
      </LegalSection>

      <LegalSection title="2. Preferenza analytics">
        <p>
          La scelta “Accetta statistiche” / “Solo necessari” viene conservata localmente nel browser
          per evitare di riproporre inutilmente la richiesta. L’utente può riaprire in qualsiasi momento
          “Preferenze statistiche” e modificare la scelta.
        </p>
      </LegalSection>

      <LegalSection title="3. Google Analytics 4">
        <p>
          Google Analytics 4 è utilizzato sulle sole superfici pubbliche per comprendere visitatori,
          sorgenti di traffico, landing page e utilizzo dei contenuti pubblici. Il relativo script viene
          caricato solo dopo consenso esplicito.
        </p>
        <p>
          La configurazione Smart Steel Sales mantiene disattivati ad storage, ad user data,
          ad personalization e Google signals. Le aree Network, Workspace e Platform non vengono
          misurate da questa integrazione GA4.
        </p>
        <p>
          Dopo il consenso, Google Analytics può utilizzare identificatori come <code>_ga</code> e
          <code> _ga_*</code>. In caso di revoca Smart Steel Sales aggiorna lo stato di consenso e
          tenta di eliminare dal browser i cookie GA accessibili al sito.
        </p>
      </LegalSection>

      <LegalSection title="4. Nessun consenso implicito">
        <p>
          Scorrere la pagina, continuare la navigazione o chiudere altri elementi dell’interfaccia non
          equivale ad accettare le statistiche. Senza una scelta positiva il tag Google Analytics non
          viene caricato.
        </p>
      </LegalSection>

      <LegalSection title="5. Gestione e revoca">
        <p>
          Dopo aver espresso una scelta, il controllo “Preferenze statistiche” consente di riaprire
          il pannello e revocare il consenso. Il rifiuto non impedisce l’uso delle funzioni pubbliche
          essenziali del sito.
        </p>
      </LegalSection>

      <LegalSection title="6. Informativa privacy">
        <p>
          Per finalità, basi giuridiche, destinatari, conservazione e diritti consulta la{" "}
          <Link href="/privacy" className="font-semibold text-[#1a5144] underline underline-offset-4">
            Privacy Policy
          </Link>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
