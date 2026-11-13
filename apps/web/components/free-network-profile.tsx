import Link from "next/link";
import { NetworkProfileOverview, NetworkProfileTopBar } from "@/components/network-profile-overview";
import { NetworkProfileInventory } from "@/components/network-profile-inventory";
import { NetworkSaveToggle } from "@/components/network-save-toggle";
import { getSavedNetworkCompanyIds } from "@/lib/network-saved-set";
import { getPublishedNetworkInventory } from "@/lib/network-stock";
import {getReviewedCompanyEvidence,summarizeReviewedCompanyEvidence} from "@/lib/network-profile-evidence";
import { notFound } from "next/navigation";
import { FocusPage } from "@/components/focus-ui";
import { NetworkActivationCta, NetworkActivationHelp } from "@/components/network-activation-cta";
import {getNetworkRecipientReadiness} from "@/lib/network-recipient-readiness";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {canInteractWithNetwork,canWriteWorkspace} from "@/lib/access-policy";
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
      <FocusPage className="max-w-6xl">
        <h1 className="text-xl font-semibold text-[#173f35]">Profilo non disponibile</h1>
        <p className="mt-2 text-sm text-[#52615b]">Verifica l'attivazione della tua azienda oppure riprova.</p>
        <Link href="/network" className="mt-4 inline-block text-sm font-semibold text-[#173f35] underline">Torna alla ricerca</Link>
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
  const workspace = await getWorkspaceContext();
  const canConnect=canInteractWithNetwork(workspace.role);
  // Saved companies are private and already supported by the existing
  // Network server action; never expose the control on provisional entries.
  const canSave=!provisional && canWriteWorkspace(workspace.role);
  const savedIds=canSave ? await getSavedNetworkCompanyIds(organizationId,[companyId]) : [];
  const isSaved=savedIds.includes(companyId);
  const inventory = provisional ? [] : await getPublishedNetworkInventory(organizationId, companyId);
  const companyName=profile.company.trading_name || profile.company.legal_name;
  const reviewedSummary=summarizeReviewedCompanyEvidence(reviewedEvidence);
  const firstLocation=profile.facilities
    .map((facility)=>[facility.city,facility.region].filter(Boolean).join(" · "))
    .find(Boolean) ?? null;

  return (
    <FocusPage className="max-w-6xl">
      <NetworkProfileTopBar />
      <div className="mt-4">
        <NetworkProfileOverview
          name={companyName}
          legalName={profile.company.legal_name}
          countryCode={profile.company.country_code}
          location={firstLocation}
          primaryRole={profile.roles[0]?.name ?? null}
          roles={profile.roles.map((role)=>role.name)}
          description={profile.company.description || reviewedSummary.description}
          products={[...profile.products,...reviewedSummary.products]}
          services={reviewedSummary.services}
          evidenceSourceUrl={safeNetworkWebsiteUrl(reviewedSummary.evidenceSourceUrl)}
          sourceUrl={source}
          identityTrust={provisional ? "unconfirmed" : profile.company.verification_status==="verified" ? "verified" : profile.company.claimed_status==="claimed" ? "claimed" : "unverified"}
          technicalTopics={[
            profile.products.length ? "Prodotti pubblicati" : null,
            profile.facilities.length ? "Sedi pubblicate" : null,
            reviewedEvidence.length ? "Informazioni con fonte" : null,
          ].filter((item): item is string => Boolean(item))}
          website={website}
          stockCount={inventory.length}
          stockContent={inventory.length ? <NetworkProfileInventory items={inventory} /> : undefined}
          connectionsAvailable={Boolean((status==="available"&&canConnect) || status==="pending" || status==="connected" || canSave)}
          primaryConnectionAvailable={Boolean(status==="available"&&canConnect)}
          hasTechnicalDetails={Boolean(reviewedEvidence.length || provisional || profile.products.length || profile.facilities.length)}
          detailsTargetId="network-profile-free-evidence"
          actions={<>
            {status==="available"&&canConnect ? (
              <Link href={"/network/"+companyId+"/connect"}
                className="app-primary inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold">
                Connetti →
              </Link>
            ) : status==="pending" ? (
              <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#176647] underline"
                href="/network/connections?box=sent">Richiesta inviata · In attesa di risposta</Link>
            ) : status==="connected" ? (
              <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#176647] underline"
                href="/network/connections?box=connected">Connessione attiva · Apri connessioni</Link>
            ) : null}
            {canSave ? <NetworkSaveToggle companyId={companyId} name={companyName}
              saved={isSaved} returnTo={"/network/"+companyId} /> : null}
          </>}
        />
      </div>

      {(provisional || isWorkspaceAdmin && ["unclaimed","revoked"].includes(profile.company.claimed_status)) ? (
        <details className="mt-4 rounded-2xl border border-[#dce6e0] bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-[#175640]">Rappresenti questa azienda? Rivendica il profilo</summary>
          <div className="mt-3 space-y-3">
            <NetworkActivationHelp mode={provisional?"discovered":"published"}/>
            {provisional ? (
              <NetworkActivationCta mode="discovered" companyId={companyId}
                companyName={profile.company.legal_name} source="network_profile"/>
            ) : (
              <NetworkActivationCta mode="published" companyId={companyId}
                companyName={profile.company.legal_name} source="network_profile"/>
            )}
          </div>
        </details>
      ) : null}

      {(reviewedEvidence.length>0 || provisional || profile.products.length>0 || profile.facilities.length>0) ? (
        <details id="network-profile-free-evidence" data-testid="network-profile-free-evidence" className="mt-4 rounded-2xl border border-[#dce6e0] bg-white p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold text-[#175640]">Approfondimenti, sedi e fonti aziendali</summary>
          {reviewedEvidence.length>0 ? (
            <section aria-label="Informazioni aziendali con fonte" className="mt-5">
              <h2 className="text-base font-semibold text-[#173f35]">Attività e competenze documentate</h2>
              <p className="mt-1 text-xs text-[#52615b]">Le fonti pubbliche non equivalgono a certificazione o adesione al Network.</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {reviewedEvidence.map((entry,index)=>{
                  const value=typeof entry.field_value==="string" ? entry.field_value :
                    Array.isArray(entry.field_value) ? entry.field_value.filter((item):item is string=>typeof item==="string").join(" · ") : "";
                  const url=safeNetworkWebsiteUrl(entry.evidence_url);
                  return value ? <li key={entry.field_key+"|"+entry.evidence_url+"|"+index} className="rounded-xl border border-[#dce6e0] bg-[#fbfcfb] p-3 text-sm leading-6 text-[#43524c]">
                    <p className="text-xs font-semibold capitalize text-[#175640]">{entry.field_key==="description"?"Attività":entry.field_key==="industry"?"Settori":entry.field_key==="products"?"Prodotti":entry.field_key==="services"?"Servizi":entry.field_key}</p>
                    {value}
                    {url?<a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs font-semibold text-[#176647] underline">Fonte ↗</a>:null}
                  </li>:null;
                })}
              </ul>
            </section>
          ) : null}
          {(profile.products.length>0 || profile.facilities.length>0) ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {profile.products.length>0 ? <section>
                <h2 className="font-semibold text-[#173f35]">Prodotti dichiarati</h2>
                <p className="mt-2 text-sm text-[#43524c]">{profile.products.join(" · ")}</p>
              </section>:null}
              {profile.facilities.length>0 ? <section>
                <h2 className="font-semibold text-[#173f35]">Sedi pubblicate</h2>
                <ul className="mt-2 space-y-1 text-sm text-[#43524c]">
                  {profile.facilities.map((facility,index)=><li key={index}>{[facility.city,facility.region,facility.country_code].filter(Boolean).join(" · ") || "Località non ancora disponibili"}</li>)}
                </ul>
              </section>:null}
            </div>
          ) : null}
          {provisional ? <section className="mt-5 border-t border-[#e3ebe5] pt-4 text-xs leading-5 text-[#52615b]">
            <h2 className="font-semibold text-[#173f35]">Origine e attendibilità delle informazioni</h2>
            <p className="mt-2">Profilo ricavato da ricerca aziendale, non ancora confermato dall'azienda. La presenza nel Network non documenta capacità di fornitura né acquisti.</p>
            {profile.finished_only ? <p className="mt-2">L'utilizzo di tubi in acciaio non è documentato in modo esplicito.</p>:null}
            <div className="mt-3 flex flex-wrap gap-4">
              {source?<a href={source} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#176647] underline">Vedi fonte aziendale ↗</a>:null}
              {license?<a href={license} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#176647] underline">Licenza e attribuzione dati ↗</a>:null}
              <Link href="/company-data" className="font-semibold text-[#176647] underline">Segnala una correzione o chiedi la rimozione</Link>
            </div>
          </section>:null}
        </details>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-[#647269]">Solo dati aziendali pubblicabili. Contatti privati, offerte, prezzi e memoria commerciale non sono mostrati.</p>
    </FocusPage>
  );
}
