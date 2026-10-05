import type { Metadata } from "next";

import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { legalRobots } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termini d’uso",
  description: "Condizioni di utilizzo delle superfici pubbliche e degli strumenti Smart Steel Sales.",
  alternates: { canonical: absoluteUrl("/terms") },
  robots: legalRobots(),
};

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Condizioni pubbliche"
      title="Termini d’uso"
      intro="Condizioni provvisorie per l’uso delle superfici pubbliche durante la fase di sviluppo. Le condizioni SaaS B2B complete saranno definite nel blocco LR8 prima del lancio commerciale."
    >
      <LegalSection title="1. Natura del servizio">
        <p>
          Smart Steel Sales è una piattaforma in sviluppo per il settore acciaio e tubo. Alcune aree
          sono pubbliche e gratuite; Network, Commercial Memory e altri prodotti sono o saranno
          riservati a utenti e aziende autorizzate.
        </p>
      </LegalSection>

      <LegalSection title="2. Contenuti tecnici">
        <p>
          Articoli, sintesi di norme, collegamenti tra gradi, pesi, dimensioni e altri contenuti della
          Scuola hanno finalità informativa e di supporto operativo. Non sostituiscono norme ufficiali,
          certificati, disegni, specifiche contrattuali, documentazione del produttore o valutazioni
          professionali richieste nel caso concreto.
        </p>
      </LegalSection>

      <LegalSection title="3. Calcolatore pesi">
        <p>
          I risultati del calcolatore sono ottenuti secondo le modalità e assunzioni mostrate
          nell’interfaccia. Valori reali di fornitura possono differire per tolleranze, geometrie
          effettive, raggi, processi produttivi e documentazione specifica del prodotto.
        </p>
        <p>
          Prima di assumere impegni commerciali, produttivi o strutturali, l’utente deve verificare
          il dato sulla norma applicabile e sulla documentazione ufficiale del fornitore/produttore.
        </p>
      </LegalSection>

      <LegalSection title="4. Profili aziendali e claim">
        <p>
          La presenza di una scheda minima o di un profilo claimable non costituisce certificazione,
          raccomandazione, approvazione commerciale o garanzia di affidabilità dell’azienda.
        </p>
        <p>
          Il claim è soggetto a verifiche e può essere rifiutato, sospeso o richiesto nuovamente
          se le informazioni fornite non consentono di accertare il rapporto con l’azienda.
        </p>
      </LegalSection>

      <LegalSection title="5. Uso corretto">
        <p>
          Non è consentito utilizzare il servizio per accessi abusivi, scraping non autorizzato,
          aggiramento dei controlli di accesso, caricamento di contenuti illeciti o violazione di
          diritti altrui. Le condizioni dettagliate di utilizzo dei servizi privati saranno definite
          prima del lancio commerciale.
        </p>
      </LegalSection>

      <LegalSection title="6. Disponibilità e sviluppo">
        <p>
          Il prodotto è in sviluppo continuo. Funzioni, dataset, interfacce e disponibilità possono
          cambiare. Gli utenti non devono fare affidamento sulla permanenza indefinita di funzionalità
          sperimentali o gratuite.
        </p>
      </LegalSection>

      <LegalSection title="7. Proprietà intellettuale">
        <p>
          Marchi, interfacce, codice, testi originali e organizzazione dei contenuti restano soggetti
          ai rispettivi diritti. Fonti normative, documenti di terzi e contenuti esterni restano di
          titolarità dei rispettivi aventi diritto e sono richiamati secondo le fonti indicate.
        </p>
      </LegalSection>

      <LegalSection title="8. Accettazione account e versioni">
        <p>
          Per gli account che accedono alle aree private Smart Steel Sales registra in modo versionato
          l’accettazione dei Termini separatamente dalla presa visione dell’informativa privacy.
          La presa visione dell’informativa non viene trattata come consenso al trattamento.
        </p>
        <p>
          Quando una futura versione dei Termini introdurrà modifiche che richiedono una nuova
          accettazione, la piattaforma potrà richiederla prima di proseguire nell’area autenticata.
        </p>
      </LegalSection>

      <LegalSection title="9. Evoluzione dei termini">
        <p>
          Questi termini pubblici saranno sostituiti o integrati dalle condizioni SaaS B2B LR8 prima
          dell’attivazione commerciale di piani a pagamento, rinnovi e servizi contrattuali.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
