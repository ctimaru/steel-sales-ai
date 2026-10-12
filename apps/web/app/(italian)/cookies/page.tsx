import type { Metadata } from "next";
import Link from "next/link";

import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { legalRobots } from "@/lib/legal";
import { PUBLIC_STORAGE_INVENTORY } from "@/lib/public-storage-inventory";
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
      intro="Smart Steel Sales distingue le tecnologie necessarie o richieste dall’utente dagli strumenti statistici non essenziali. Google Analytics usa Consent Mode v2: il tag può caricarsi con consenso negato, senza cookie analytics, e passa alla misurazione completa solo dopo consenso."
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

      <LegalSection title="2. Preferenza analytics e durata della scelta">
        <p>
          La scelta “Accetta” / “Accetta necessari” viene conservata localmente nel browser
          insieme a versione del consenso, versione dell’informativa e data della decisione.
        </p>
        <p>
          Finché le condizioni del trattamento restano sostanzialmente invariate, Smart Steel Sales
          non ripropone il banner prima di sei mesi. La scelta viene richiesta nuovamente se cambia
          la versione dell’informativa/consenso oppure, in ogni caso, dopo la scadenza del periodo.
          L’utente può sempre riaprire la linguetta “Privacy” e cambiare decisione prima della scadenza.
        </p>
      </LegalSection>

      <LegalSection title="3. Google Analytics 4">
        <p>
          Google Analytics 4 è utilizzato sulle sole superfici pubbliche per comprendere visitatori,
          sorgenti di traffico, landing page e utilizzo dei contenuti pubblici. Smart Steel Sales usa
          Google Consent Mode v2 in modalità avanzata: il tag può essere caricato prima della scelta,
          con analytics storage negato per impostazione predefinita e senza impostare cookie analytics.
        </p>
        <p>
          Quando il consenso analytics è negato o non ancora espresso, Google può ricevere ping tecnici
          senza cookie previsti dalla modalità di consenso avanzata. La configurazione Smart Steel Sales
          mantiene sempre disattivati ad storage, ad user data, ad personalization e Google signals.
          Le aree Network, Workspace e Platform non vengono misurate da questa integrazione GA4.
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
          equivale ad accettare le statistiche. Senza una scelta positiva analytics storage resta negato:
          non vengono impostati cookie analytics e il tag resta limitato ai segnali consentiti dalla
          modalità avanzata senza consenso.
        </p>
      </LegalSection>

      <LegalSection title="5. Gestione e revoca">
        <p>
          Dopo aver espresso una scelta, la linguetta “Privacy” consente di riaprire
          il pannello e revocare il consenso. Il rifiuto non impedisce l’uso delle funzioni pubbliche
          essenziali del sito.
        </p>
      </LegalSection>

      <LegalSection title="6. Inventario cookie e storage pubblico">
        <p>
          L’inventario seguente descrive le tecnologie note utilizzate dalle superfici pubbliche.
          I nomi dinamici del provider di autenticazione possono variare per progetto o versione.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="bg-[#f3f6f4] text-[#43524c]">
                <th className="border-b border-[#dce2df] px-3 py-2 font-bold">Tecnologia</th>
                <th className="border-b border-[#dce2df] px-3 py-2 font-bold">Nome</th>
                <th className="border-b border-[#dce2df] px-3 py-2 font-bold">Categoria</th>
                <th className="border-b border-[#dce2df] px-3 py-2 font-bold">Provider</th>
                <th className="border-b border-[#dce2df] px-3 py-2 font-bold">Finalità</th>
                <th className="border-b border-[#dce2df] px-3 py-2 font-bold">Attivazione / durata</th>
              </tr>
            </thead>
            <tbody>
              {PUBLIC_STORAGE_INVENTORY.map((item) => (
                <tr key={item.name} className="align-top">
                  <td className="border-b border-[#edf1ef] px-3 py-3 font-semibold text-[#43524c]">{item.technology}</td>
                  <td className="border-b border-[#edf1ef] px-3 py-3 font-mono text-[11px] text-[#173f35]">{item.name}</td>
                  <td className="border-b border-[#edf1ef] px-3 py-3">{item.category}</td>
                  <td className="border-b border-[#edf1ef] px-3 py-3">{item.provider}</td>
                  <td className="border-b border-[#edf1ef] px-3 py-3">{item.purpose}</td>
                  <td className="border-b border-[#edf1ef] px-3 py-3">
                    <span className="block">{item.activation}</span>
                    <span className="mt-1 block text-[#7b8782]">{item.duration}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="7. Informativa privacy">
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
