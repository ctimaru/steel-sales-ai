import Link from "next/link";
import {redirect} from "next/navigation";

import {ProducerCatalogueUpload} from "@/components/producer-catalogue-upload";
import {getManagedNetworkCompany} from "@/lib/network";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {requireWorkspaceAdmin} from "@/lib/workspace-context";

export const dynamic="force-dynamic";

/**
 * B3.C2: company-managed, verified-corporate catalogue submissions.
 * There is no checkout, grant issuance or producer capability publication here.
 */
export default async function ManagedProducerCataloguesPage(){
  if(!isNetworkFrontendEnabled())redirect("/dashboard");
  await requireWorkspaceAdmin();
  const managed=await getManagedNetworkCompany();
  return <main className="mx-auto max-w-5xl space-y-5 pb-12">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/network/manage" className="text-sm font-semibold text-[#256147]">
        ← Il mio profilo aziendale
      </Link>
      <Link href="/network/pro/producers" className="text-sm font-semibold text-[#256147]">
        Esplora produttori
      </Link>
    </div>
    <header className="rounded-3xl border border-[#dce7df] bg-white p-5 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#24724e]">
        Smart Steel Sales · Network Produttori PRO
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[#1c3f30] sm:text-3xl">
        I tuoi cataloghi diventano conoscenza industriale
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#536f60]">
        Condividi un catalogo ufficiale della tua azienda. Dopo le verifiche dei diritti,
        il sistema potrà ricavare norme, gradi, forme e dimensioni, con prove dalla fonte.
        Nessun dato equivale automaticamente alla disponibilità o producibilità effettiva.
      </p>
      <div className="mt-5 grid gap-2 text-xs font-semibold text-[#37654b] sm:grid-cols-3">
        <div className="rounded-xl bg-[#f2f8f4] px-4 py-3">01 · Verifica azienda</div>
        <div className="rounded-xl bg-[#f2f8f4] px-4 py-3">02 · Carica e autorizza</div>
        <div className="rounded-xl bg-[#f2f8f4] px-4 py-3">03 · Intelligence documentata</div>
      </div>
    </header>
    <ProducerCatalogueUpload companyId={managed?.network_company_id??null}
      companyName={managed?.company.legal_name??null}/>
  </main>;
}
