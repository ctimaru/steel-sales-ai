import type { Metadata } from "next";
import Link from "next/link";

import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { PrivacyProcessingMatrix } from "@/components/privacy-processing-matrix";
import { legalRobots } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Informativa privacy di Smart Steel Sales sul trattamento dei dati personali.",
  alternates: { canonical: absoluteUrl("/privacy") },
  robots: legalRobots(),
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="GDPR · Informativa privacy"
      title="Privacy Policy"
      intro="Questa informativa descrive il trattamento dei dati personali nelle superfici pubbliche e nei principali flussi di Smart Steel Sales. Finché i dati identificativi del Titolare e la retention matrix non sono completati, la policy resta una versione operativa provvisoria e non indicizzata."
    >
      <LegalSection title="1. Ambito">
        <p>
          L’informativa copre il sito pubblico Smart Steel Sales, la Scuola, il calcolatore pesi,
          la ricerca/claim azienda, registrazione, login e le funzioni necessarie all’accesso ai
          prodotti privati.
        </p>
        <p>
          Il Network, la Commercial Memory e le altre aree autenticate hanno confini di accesso
          separati; i relativi trattamenti verranno dettagliati ulteriormente prima dell’onboarding
          commerciale.
        </p>
      </LegalSection>

      <LegalSection title="2. Categorie di dati trattati">
        <ul className="list-disc space-y-2 pl-5">
          <li>dati tecnici di navigazione necessari al funzionamento e alla sicurezza del servizio;</li>
          <li>dati account, come email e informazioni di autenticazione gestite tramite il provider di autenticazione;</li>
          <li>dati di registrazione aziendale, inclusi ragione sociale, paese, sito, P.IVA/identificativi societari ove forniti;</li>
          <li>dati del referente della richiesta, come nome e, facoltativamente, telefono;</li>
          <li>dati necessari al claim e alla verifica dell’identità/ruolo rispetto a un profilo aziendale;</li>
          <li>dati statistici sulle superfici pubbliche solo se l’utente accetta Google Analytics.</li>
        </ul>
        <p>
          Le misure, quantità e preferiti del calcolatore possono essere salvati localmente nel browser
          per la funzione di riuso quotidiano; il layer WC4 non li invia al backend.
        </p>
      </LegalSection>

      <PrivacyProcessingMatrix />

      <LegalSection title="3. Finalità e basi giuridiche">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            erogazione di registrazione, autenticazione, claim e servizi richiesti: esecuzione di misure
            precontrattuali o contrattuali, ove applicabile;
          </li>
          <li>
            sicurezza, prevenzione abusi, integrità e affidabilità della piattaforma: interesse legittimo
            del Titolare, da bilanciare con i diritti degli interessati;
          </li>
          <li>adempimento di obblighi di legge: obbligo legale, ove applicabile;</li>
          <li>
            Google Analytics sulle pagine pubbliche: consenso, revocabile in qualsiasi momento tramite
            “Preferenze statistiche”.
          </li>
        </ul>
        <p>
          La base giuridica e il flusso informativo ex art. 14 per eventuali dati personali ricavati da
          fonti pubblicamente accessibili nei profili aziendali sono oggetto del blocco LR4 e devono
          essere finalizzati prima di scalare il database pubblico.
        </p>
      </LegalSection>

      <LegalSection title="4. Dati aziendali provenienti da fonti pubbliche">
        <p>
          Smart Steel Sales può predisporre schede aziendali minime a partire da informazioni pubbliche.
          I dati puramente riferiti a persone giuridiche non sono, di per sé, dati personali; eventuali
          informazioni che identificano persone fisiche richiedono invece una specifica governance GDPR.
        </p>
        <p>
          Il programma LR4 prevede provenance della fonte, processi di rettifica/opposizione/rimozione e,
          quando applicabile, informativa ai sensi dell’art. 14 GDPR.
        </p>
      </LegalSection>

      <LegalSection title="5. Destinatari e fornitori">
        <p>
          Per erogare il servizio possono essere utilizzati fornitori cloud, hosting, database,
          autenticazione, invio email, infrastruttura applicativa e analytics. Il registro LR6
          consoliderà per ciascun fornitore ruolo, DPA, subprocessors, localizzazione e garanzie
          per eventuali trasferimenti internazionali.
        </p>
        <p>
          L’architettura attuale utilizza, tra gli altri, Supabase, Vercel, Railway e Google Analytics
          per specifiche funzioni tecniche. L’uso di Google Analytics è limitato alle superfici pubbliche
          e subordinato al consenso.
        </p>
      </LegalSection>

      <LegalSection title="6. Trasferimenti fuori dallo SEE">
        <p>
          Alcuni fornitori tecnologici possono comportare trattamenti o accessi da Paesi esterni allo
          Spazio Economico Europeo. Le garanzie applicabili, incluse eventuali decisioni di adeguatezza
          o clausole contrattuali standard, saranno riportate nel registro fornitori LR6 e nella versione
          definitiva di questa informativa.
        </p>
      </LegalSection>

      <LegalSection title="7. Conservazione">
        <p>
          I dati vengono conservati secondo il principio di limitazione della conservazione e per il tempo
          necessario alle finalità per cui sono trattati, oltre agli eventuali periodi richiesti da obblighi
          legali o dalla tutela di diritti. La retention matrix con periodi specifici per account,
          registrazioni, claim, log, email e analytics è in fase di formalizzazione nel programma LR3/LR6.
        </p>
      </LegalSection>

      <LegalSection title="8. Diritti degli interessati">
        <p>
          Nei casi previsti dal GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione,
          portabilità, opposizione e revocare il consenso senza pregiudicare la liceità del trattamento
          precedente alla revoca.
        </p>
        <p>
          È inoltre possibile proporre reclamo al Garante per la protezione dei dati personali. Il canale
          privacy operativo sarà quello indicato nei dati del Titolare in cima alla pagina appena configurato.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookie e analytics">
        <p>
          I dettagli su cookie, local storage e Google Analytics sono disponibili nella{" "}
          <Link href="/cookies" className="font-semibold text-[#1a5144] underline underline-offset-4">
            Cookie & Tracking Policy
          </Link>.
        </p>
      </LegalSection>

      <LegalSection title="10. Aggiornamenti">
        <p>
          La policy sarà aggiornata quando cambieranno i trattamenti, i fornitori, le basi giuridiche
          o i dati identificativi del Titolare. La versione pubblicata è indicata nella parte iniziale.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
