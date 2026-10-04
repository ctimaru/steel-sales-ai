import type { Metadata } from "next";
import Link from "next/link";

import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { COMPANY_DIRECTORY_ART14_NOTICE_VERSION } from "@/lib/company-directory-privacy";
import { legalRobots } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Informativa dati aziendali da fonti pubbliche",
  description:
    "Informativa Smart Steel Sales per dati professionali ottenuti indirettamente nel contesto Company Directory e claim.",
  alternates: { canonical: absoluteUrl("/privacy/company-directory") },
  robots: legalRobots(),
};

export default function CompanyDirectoryPrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="GDPR · Art. 14 · Company Directory"
      title="Informativa dati aziendali da fonti pubbliche"
      intro="Questa informativa è il riferimento LR4 per eventuali dati personali professionali ottenuti indirettamente nel contesto delle identità aziendali Smart Steel Sales. Il Network resta un prodotto privato e a pagamento: il lookup pubblico espone solo dati minimi riferiti all’azienda, non contatti personali."
    >
      <LegalSection title="1. Quando si applica">
        <p>
          Si applica quando Smart Steel Sales tratta informazioni che possono identificare una persona
          fisica in relazione a un’azienda e tali informazioni non sono state raccolte direttamente
          dall’interessato. Esempi possibili sono nome professionale, ruolo e recapiti di lavoro.
        </p>
        <p>
          I dati puramente riferiti alla persona giuridica — come ragione sociale, paese, sito aziendale
          e identificativi societari — sono governati separatamente e non vengono trasformati
          automaticamente in dati personali.
        </p>
      </LegalSection>

      <LegalSection title="2. Fonti e categorie di dati">
        <p>
          Le fonti ammesse devono superare il gate PA1.5 su condizioni di riuso, diritti sulle banche dati,
          provenance e minimizzazione. Quando un record personale viene ammesso a review, viene mantenuta
          evidenza della provenienza e della data di acquisizione.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>identità professionale e ruolo aziendale;</li>
          <li>email, telefono o altro canale professionale pubblicato nel contesto dell’azienda;</li>
          <li>relazione con l’azienda e fonte pubblicamente accessibile da cui il dato è stato ricavato;</li>
          <li>evidenze di governance necessarie a documentare LIA, informativa e opposizione/rimozione.</li>
        </ul>
        <p>
          Smart Steel Sales non usa la Commercial Memory privata dei clienti come fonte per popolare la
          Company Directory.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalità e base giuridica">
        <p>
          L’eventuale trattamento di un contatto personale professionale può essere autorizzato solo dopo
          una valutazione documentata del legittimo interesse ai sensi dell’art. 6, par. 1, lett. f) GDPR:
          interesse perseguito, necessità del trattamento e bilanciamento con diritti e aspettative
          dell’interessato.
        </p>
        <p>
          Se la valutazione non è positiva, il contatto resta bloccato. Il claim di un’azienda e la verifica
          della titolarità del profilo non costituiscono, da soli, una base giuridica per pubblicare dati
          personali.
        </p>
      </LegalSection>

      <LegalSection title="4. Quando ricevi questa informativa">
        <p>
          Per i dati ottenuti indirettamente, Smart Steel Sales adotta come regola operativa il termine
          più restrittivo: informativa entro un mese dall’acquisizione oppure, se avvengono prima, al
          momento della prima comunicazione con l’interessato o prima/al momento della prima divulgazione
          del dato a un altro destinatario.
        </p>
        <p>
          Un’eventuale eccezione prevista dall’art. 14, par. 5 GDPR non viene presunta automaticamente:
          deve essere motivata e registrata caso per caso.
        </p>
      </LegalSection>

      <LegalSection title="5. Destinatari e visibilità">
        <p>
          Il Network non è una directory pubblica liberamente navigabile. Un contatto che supera LR4 può
          essere visibile agli utenti autenticati di organizzazioni con entitlement Network attivo,
          secondo i controlli di accesso della piattaforma. Il lookup pubblico per nome/P.IVA non espone
          contatti personali.
        </p>
      </LegalSection>

      <LegalSection title="6. Conservazione e riesame">
        <p>
          Una decisione LR4 sulla pubblicabilità di un contatto ha validità massima di 12 mesi. Alla
          scadenza il record non è più restituito dalle superfici Network finché non viene riesaminato.
          I candidati personali respinti vengono trattati secondo la retention matrix LR3.2; le evidenze
          di governance possono essere conservate separatamente per accountability.
        </p>
      </LegalSection>

      <LegalSection title="7. Diritti e opposizione">
        <p>
          Quando il trattamento si basa sul legittimo interesse, l’interessato può esercitare i diritti
          previsti dal GDPR, incluso il diritto di opposizione nei casi applicabili. Può inoltre chiedere
          accesso, rettifica, cancellazione o limitazione e proporre reclamo all’autorità di controllo.
        </p>
        <p>
          Per segnalazioni relative a una scheda aziendale è disponibile anche il canale di
          correzione/rimozione già previsto dalla governance del prodotto; le richieste formali privacy
          saranno gestite tramite il canale privacy del Titolare e il playbook LR7.
        </p>
      </LegalSection>

      <LegalSection title="8. Claim e verifica aziendale">
        <p>
          Il claim assegna diritti di gestione del profilo solo dopo una prova di controllo
          dell’organizzazione, ad esempio verifica del dominio email aziendale o review manuale.
          Claim, verifica del profilo e autorizzazione a divulgare dati personali restano tre decisioni
          distinte.
        </p>
      </LegalSection>

      <LegalSection title="9. Versione e informazioni generali">
        <p>
          Versione informativa specifica: <strong>{COMPANY_DIRECTORY_ART14_NOTICE_VERSION}</strong>.
          Questa pagina integra la{" "}
          <Link href="/privacy" className="font-semibold text-[#1a5144] underline underline-offset-4">
            Privacy Policy generale
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
