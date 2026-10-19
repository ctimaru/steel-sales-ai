import Link from "next/link";
import {getReviewedCompanyEvidence} from "@/lib/network-profile-evidence";
import { notFound } from "next/navigation";
import { FocusPage } from "@/components/focus-ui";
import { NetworkActivationCta, NetworkActivationHelp } from "@/components/network-activation-cta";
import {getNetworkRecipientReadiness} from "@/lib/network-recipient-readiness";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {canInteractWithNetwork} from "@/lib/access-policy";
import { getFreeNetworkProfile, getProNetworkDiscoveryProfile, safeNetworkWebsiteUrl } from "@/lib/network-free";

export async function FreeNetworkProfileView({
  organizationId, companyId, accessMode="free", isWorkspaceAdmin=false,
}: { organizationId: string; companyId: string; accessMode?:"free"|"pro"; isWorkspaceAdmin?:boolean }) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(companyId)) notFound();
  let profile;
  try {
    profile = accessMode==="pro"
      ? await getProNetworkDiscoveryProfile(organizationId,companyId)
      : await getFreeNetworkProfile(organizationId, companyId);
  } catch {
    return (
      <FocusPage className="max-w-[960px]">
        <h1 className="text-xl font-semibold text-[#173f35]">Profilo non disponibile</h1>
        <p className="mt-2 text-sm text-[#52615b]">Verifica l'attivazione della tua azienda oppure riprova.</p>
        <Link href="/network" className="mt-4 inline-block text-sm font-semibold text-[#173f35] underline">Torna a Esplora aziende</Link>
      </FocusPage>
    );
  }
  if (!profile) notFound();
  const reviewedEvidence=await getReviewedCompanyEvidence(organizationId,companyId,accessMode).catch(()=>[]);
  const website = safeNetworkWebsiteUrl(profile.company.website_url);
  const source = safeNetworkWebsiteUrl(profile.source_url);
  const license = safeNetworkWebsiteUrl(profile.license_url);
  const provisional = profile.company.discovery_status==="unconfirmed";
  const status=provisional?"unavailable":(await getNetworkRecipientReadiness(organizationId,[companyId]).catch(()=>null))?.get(companyId);
  const canConnect=canInteractWithNetwork((await getWorkspaceContext()).role);
  return (
    <FocusPage className="max-w-[960px]">
      <Link href="/network" className="text-sm font-semibold text-[#173f35] underline">← Torna a Esplora aziende</Link>
      <section className="mt-5 rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-xs font-semibold text-[#173f35]">
          {provisional ? "Scoperta dal Network · Da confermare" : "Profilo Network Free"}
        </span>
        <h1 className="mt-3 text-2xl font-semibold text-[#173f35]">{profile.company.trading_name || profile.company.legal_name}</h1>
        <p className="mt-2 text-sm text-[#52615b]">{profile.company.country_code} · {profile.roles.map((r) => r.name).join(" · ") || "Ruolo da completare"}{provisional ? " · Ruolo indicativo" : ""}</p>
        {provisional ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-[#6e4c19]">
          Questo profilo nasce da una ricerca aziendale e non è ancora stato confermato dall'azienda. La presenza nel Network non implica rapporti commerciali, verifica della sede o acquisto di prodotti siderurgici.
          {profile.finished_only ? " L'uso di tubi in acciaio non è documentato in modo esplicito." : ""}
          <div className="mt-2 flex flex-wrap gap-4">
            {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Vedi fonte aziendale ↗</a> : null}
            {license ? <a href={license} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Licenza e attribuzione dei dati ↗</a> : null}
            <Link href="/company-data" className="font-semibold underline">Segnala una correzione o chiedi la rimozione →</Link>
          </div>
        </div> : null}
        {reviewedEvidence.length>0 ? <section aria-label="Informazioni aziendali con fonte" className="mt-5 rounded-xl border border-[#d5e5da] bg-[#f8fbf9] p-4">
          <h2 className="text-base font-semibold text-[#173f35]">Attività e competenze</h2>
          <p className="mt-1 text-xs text-[#52615b]">Informazioni ricavate da fonti aziendali consultabili; non equivalgono a certificazione o adesione al Network.</p>
          <ul className="mt-3 space-y-3">{reviewedEvidence.map((entry,index)=>{
            const value=typeof entry.field_value==="string"?entry.field_value:Array.isArray(entry.field_value)?entry.field_value.filter((x):x is string=>typeof x==="string").join(" · "):"";
            const url=safeNetworkWebsiteUrl(entry.evidence_url);
            return value ? <li key={index} className="text-sm leading-6 text-[#43524c]">
              <span className="block text-xs font-semibold capitalize text-[#175640]">{entry.field_key==="description"?"Attività":entry.field_key==="industry"?"Settori":entry.field_key==="products"?"Prodotti":entry.field_key==="services"?"Servizi":entry.field_key}</span>
              {value}
              {url?<a href={url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-semibold text-[#176647] underline">Fonte ↗</a>:null}
            </li> : null;
          })}</ul>
        </section> : null}
        {profile.company.description ? <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#43524c]">{profile.company.description}</p> : null}
        {website ? <a href={website} target="_blank" rel="noopener noreferrer" className="app-secondary mt-5 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold">Visita sito aziendale</a> : null}
        <section aria-label="Attivazione del profilo aziendale"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-[#bcd7c8] bg-[#f1f8f3] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg">
            <h2 className="text-sm font-semibold text-[#173f35]">
              {provisional ? "Rappresenti questa azienda?" :
                profile.company.claimed_status==="claimed" ? "Azienda già rappresentata nel Network" : "Questa è la tua azienda?"}
            </h2>
            <div className="mt-1">
              <NetworkActivationHelp mode={provisional?"discovered":"published"}/>
            </div>
          </div>
          {provisional ?
            <NetworkActivationCta mode="discovered" companyId={companyId}
              companyName={profile.company.legal_name} source="network_profile"/> :
            isWorkspaceAdmin && ["unclaimed","revoked"].includes(profile.company.claimed_status) ?
              <NetworkActivationCta mode="published" companyId={companyId}
                companyName={profile.company.legal_name} source="network_profile" /> :
            null}
        </section>
        {status==="available"&&canConnect ? <Link href={"/network/"+companyId+"/connect"}
          className="app-primary mt-5 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold">Richiedi connessione →</Link>
        : <p className="mt-4 text-xs leading-5 text-[#647269]">
          {status==="pending" ? <Link className="font-semibold text-[#176647] underline" href="/network/connections?box=sent">Richiesta già inviata · In attesa di risposta →</Link> :
           status==="connected" ? <Link className="font-semibold text-[#176647] underline" href="/network/connections?box=sent">Connessione già accettata · Apri richieste →</Link> :
           status===undefined ? "Disponibilità delle connessioni temporaneamente non verificabile." :
           provisional ? "Azienda scoperta · Da confermare: nessuna richiesta viene inviata." :
           !canConnect ? "Per inviare richieste serve il ruolo di amministratore o collaboratore commerciale." :
           "Questa azienda non può attualmente ricevere richieste sulla piattaforma."}
         </p>}

        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-base font-semibold text-[#173f35]">Prodotti dichiarati</h2>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">{profile.products.join(" · ") || "Non ancora disponibili"}</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#173f35]">Sedi pubblicate</h2>
            {profile.facilities.length ? (
              <ul className="mt-2 space-y-2 text-sm text-[#52615b]">
                {profile.facilities.map((f, index) => (
                  <li key={index}>{[f.city, f.region, f.country_code].filter(Boolean).join(" · ")}</li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-[#52615b]">Località non ancora disponibili</p>}
          </div>
        </div>
      </section>
      <p className="mt-4 text-xs text-[#647269]">
        Questo profilo include solo dati aziendali condivisibili. Contatti privati,
        storico commerciale, offerte e prezzi restano esclusi. Le richieste di connessione possono essere inviate solo ad aziende attive e raggiungibili sulla piattaforma. I profili da confermare non ricevono inviti automatici.
      </p>
    </FocusPage>
  );
}
