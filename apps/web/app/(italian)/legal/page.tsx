import type { Metadata } from "next";

import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { legalIdentity, legalRobots } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Informazioni legali",
  description: "Informazioni sul prestatore del servizio Smart Steel Sales e stato legale del progetto.",
  alternates: { canonical: absoluteUrl("/legal") },
  robots: legalRobots(),
};

export default function LegalInfoPage() {
  const identity = legalIdentity();

  return (
    <LegalPageShell
      eyebrow="Trasparenza del prestatore"
      title="Informazioni legali"
      intro="Questa pagina raccoglie le informazioni identificative del soggetto che gestisce Smart Steel Sales. I dati non vengono inventati: la pagina resta provvisoria e noindex finché la configurazione del prestatore non è completa."
    >
      <LegalSection title="1. Gestore del servizio">
        <p>
          Nome / ragione sociale: <strong>{identity.controllerName ?? "Da configurare"}</strong>
        </p>
        <p>Indirizzo: <strong>{identity.address ?? "Da configurare"}</strong></p>
        <p>Partita IVA / VAT: <strong>{identity.vatId ?? "Da configurare se applicabile"}</strong></p>
        <p>
          Registro imprese / identificativo: <strong>{identity.registryId ?? "Da configurare se applicabile"}</strong>
        </p>
        <p>Email privacy/contatto: <strong>{identity.privacyEmail ?? "Da configurare"}</strong></p>
      </LegalSection>

      <LegalSection title="2. Brand e stato del progetto">
        <p>
          Smart Steel Sales è il nome del prodotto e del servizio online. Il brand non viene presentato
          come una società autonoma finché non esiste un soggetto giuridico costituito con tale identità.
        </p>
      </LegalSection>

      <LegalSection title="3. Contatti e comunicazioni">
        <p>
          Le richieste relative a privacy, dati personali e diritti GDPR devono essere inviate al
          contatto privacy indicato sopra. Prima dell’avvio commerciale verranno aggiunti gli eventuali
          ulteriori recapiti obbligatori o contrattuali.
        </p>
      </LegalSection>

      <LegalSection title="4. Versione provvisoria">
        <p>
          LR1.1 crea la superficie legale del sito; LR1.2 completerà e validerà i dati reali del
          prestatore/Titolare. LR8 introdurrà le condizioni SaaS B2B prima della vendita di piani a pagamento.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
