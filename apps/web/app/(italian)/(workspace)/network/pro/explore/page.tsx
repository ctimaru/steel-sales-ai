import Link from "next/link";
import {redirect} from "next/navigation";

import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {getNetworkProScopedDirectory} from "@/lib/network-pro-coverage";
import {NETWORK_PRO_MODULES,type NetworkProModuleKey} from "@/lib/network-pro-catalog";
import {isSupportedNetworkCountry,networkCountryName} from "@/lib/network-eu-countries";
import {safeNetworkWebsiteUrl} from "@/lib/network-free";

export const dynamic="force-dynamic";

export default async function NetworkProScopedExplore({
  searchParams,
}:{
  searchParams:Promise<{module?:string;country?:string;q?:string;p?:string}>;
}){
  if(!isNetworkFrontendEnabled())redirect("/dashboard");
  const params=await searchParams;
  const module=NETWORK_PRO_MODULES.find(m=>m.key===params.module);
  const country=(params.country||"IT").trim().toUpperCase();
  const validCountry=country!=="US"&&isSupportedNetworkCountry(country);
  const q=(params.q||"").trim().slice(0,120);
  const requestedPage=Number(params.p);
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>=1?
    Math.min(requestedPage,10000):1;
  if(!module||!validCountry){
    return <main className="mx-auto max-w-4xl space-y-4 py-8">
      <h1 className="text-xl font-bold text-[#173f35]">Ricerca Network PRO non valida</h1>
      <Link className="text-sm font-semibold text-[#175640] underline" href="/network/pro">Torna ai moduli</Link>
    </main>;
  }
  const context=await getWorkspaceContext();
  const result=await getNetworkProScopedDirectory({
    organizationId:context.organizationId,
    module:module.key as NetworkProModuleKey,country,q,page,
  });
  const label=networkCountryName(country)||country;
  return <main className="mx-auto w-full max-w-[1120px] space-y-5 pb-16" data-testid="netpro1b-scoped-explore">
    <nav className="text-xs">
      <Link href="/network/pro" className="font-semibold text-[#175640] hover:underline">← Network PRO · Catalogo</Link>
    </nav>
    <header className="rounded-[24px] border border-[#d1e3d7] bg-[#f4f9f6] p-5 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#276b4b]">Network PRO · Ricerca autorizzata</p>
      <h1 className="mt-2 text-2xl font-bold text-[#173f35]">{module.title} · {label}</h1>
      <p className="mt-2 text-sm leading-6 text-[#526a5a]">
        Questa ricerca legge esclusivamente aziende pubblicate nel modulo e nel Paese consentiti.
        I profili provvisori non sono inclusi; le altre categorie restano separate.
      </p>
    </header>
    {result.status==="locked"?
      <section role="status" className="rounded-2xl border border-[#e3d4a7] bg-[#fffaf0] p-5">
        <h2 className="font-bold text-[#6a502a]">Modulo non attivo per questa azienda e questo Paese</h2>
        <p className="mt-2 text-sm text-[#6a5a3d]">
          L'accesso richiede un diritto PRO valido per {module.title} e {label}.
          La consultazione Free del Network e la gestione del profilo restano disponibili.
        </p>
        <Link href="/network/pro" className="mt-3 inline-flex min-h-10 items-center font-semibold text-[#175640] underline">Consulta i moduli</Link>
      </section>
      :result.status==="unavailable"?
      <section role="status" className="rounded-2xl border border-[#e3d4a7] bg-[#fffaf0] p-5">
        <h2 className="font-bold text-[#6a502a]">Ricerca temporaneamente non disponibile</h2>
        <p className="mt-2 text-sm">Non sono mostrati risultati parziali o dati non verificati. Riprova dalla pagina del catalogo.</p>
      </section>
      :<>
        <form method="get" className="flex flex-wrap gap-2 rounded-2xl border border-[#dbe7de] bg-white p-4">
          <input type="hidden" name="module" value={module.key}/>
          <input type="hidden" name="country" value={country}/>
          <label htmlFor="pro-module-query" className="sr-only">Cerca nome o dominio</label>
          <input id="pro-module-query" name="q" defaultValue={q} type="search" maxLength={120}
            placeholder="Ragione sociale o dominio" className="h-11 min-w-[160px] flex-1 rounded-xl border border-[#c9d8cf] bg-white px-3 text-sm text-[#1d3527]"/>
          <button type="submit" className="min-h-11 rounded-xl bg-[#175640] px-5 text-sm font-semibold text-white">Cerca</button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-[#dbe7de] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#e6eee8] p-4">
            <h2 className="font-bold text-[#173f35]">Aziende pubblicate</h2>
            <span className="text-sm tabular-nums text-[#5b7162]">{result.data.total} risultati</span>
          </div>
          {result.data.items.length===0?
            <p className="p-5 text-sm text-[#5c6e62]">Nessun profilo pubblicato corrisponde alla ricerca.</p>:
            <ul className="divide-y divide-[#e9f0ea]">
              {result.data.items.map(company=><li key={company.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#173f35]">{company.name}</p>
                  <p className="text-xs text-[#607466]">{label} · Azienda pubblicata</p>
                </div>
                {safeNetworkWebsiteUrl(company.websiteUrl)?
                  <a href={safeNetworkWebsiteUrl(company.websiteUrl)!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-lg border border-[#c7ded0] px-3 text-xs font-semibold text-[#175640]">
                    Sito aziendale
                  </a>:null}
              </li>)}
            </ul>}
        </section>
        <nav aria-label="Pagine risultati" className="flex justify-between gap-2 text-sm font-semibold">
          {page>1?
            <Link className="text-[#175640] underline" href={"/network/pro/explore?"+new URLSearchParams({module:module.key,country,q,p:String(page-1)})}>← Precedenti</Link>
            :<span/>}
          {page*result.data.limit<result.data.total?
            <Link className="text-[#175640] underline" href={"/network/pro/explore?"+new URLSearchParams({module:module.key,country,q,p:String(page+1)})}>Successive →</Link>
            :<span/>}
        </nav>
      </>}
  </main>;
}
