import type { CompanyProfileAccess } from "@/lib/company-profile-access";

export function CompanyProfileVisibility({ publicationStatus, audience }: {
  publicationStatus: string;
  audience: CompanyProfileAccess["audience"];
}) {
  const published = publicationStatus === "published";
  return (
    <section data-testid="company-profile-visibility" aria-label="Visibilità del profilo"
      className="rounded-2xl border border-[#d8e5dd] bg-[#f4f8f5] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#173f35]">Dove compaiono i tuoi dati</h2>
        <span className="rounded-full border border-[#d8e5dd] bg-white px-2.5 py-1 text-xs font-semibold text-[#435b4e]">
          {audience === "pro" ? "La tua vista: Network PRO" : audience === "free" ? "La tua vista: Network Free" : "Vista Network da verificare"}
        </span>
      </div>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[#52645b]">
        {published
          ? "Il profilo è consultabile dalle aziende registrate e abilitate nel Network. Le modifiche alla presentazione e ai dati industriali si riflettono nella scheda dopo il salvataggio."
          : "Il profilo non è ancora visibile alle altre aziende. Puoi preparare i dati; saranno consultabili nel Network quando il profilo risulterà pubblicato."}
      </p>
      <details className="mt-3 text-sm text-[#435b4e]">
        <summary className="w-fit cursor-pointer rounded font-semibold text-[#1a5144] outline-offset-4">Quali informazioni vengono mostrate?</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e0e8e3] bg-white p-3">
            <dt className="font-semibold text-[#173f35]">Scheda Free e PRO</dt>
            <dd className="mt-1 text-xs leading-5">La vista Free mostra presentazione, ruoli, famiglie prodotto e località. La vista PRO include anche logo, dettagli industriali, settori, certificazioni e contatti pubblicati. Il pulsante apre la vista disponibile per il tuo account.</dd>
          </div>
          <div className="rounded-xl border border-[#e0e8e3] bg-white p-3">
            <dt className="font-semibold text-[#173f35]">Bozze e revisione</dt>
            <dd className="mt-1 text-xs leading-5">Sedi e disponibilità hanno una propria visibilità. I contatti richiesti per la pubblicazione passano in revisione. Caricare un catalogo avvia la gestione del documento e non pubblica automaticamente il file o le disponibilità.</dd>
          </div>
          <div className="rounded-xl border border-[#e0e8e3] bg-white p-3">
            <dt className="font-semibold text-[#173f35]">Dati dal sito ufficiale</dt>
            <dd className="mt-1 text-xs leading-5">Le informazioni ricercate restano distinguibili dalle tue dichiarazioni. Ignorare una proposta evita di aggiungerla ai dati aziendali e non rimuove il dato dalla ricerca già mostrata.</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5">La scheda aziendale è condivisa all’interno del Network; non è una pagina aperta a chiunque sul web. La memoria commerciale privata resta nel tuo workspace.</p>
      </details>
    </section>
  );
}
