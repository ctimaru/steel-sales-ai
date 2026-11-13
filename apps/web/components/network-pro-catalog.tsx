"use client";

import {useState,useTransition} from "react";
import {startNetworkProCheckout} from "@/app/(italian)/(workspace)/network/pro/checkout-actions";
import {openNetworkProCustomerPortal} from "@/app/(italian)/(workspace)/network/pro/portal-actions";
import Link from "next/link";
import {networkCountryName} from "@/lib/network-eu-countries";
import type {NetworkProAccess,NetworkProCoverage} from "@/lib/network-pro-coverage";

import {
  NETWORK_PRO_ANNUAL_DISCOUNT_PERCENT,
  NETWORK_PRO_MODULES,
  networkProQuote,
  type NetworkProModuleKey,
  type NetworkProTerritory,
} from "@/lib/network-pro-catalog";

const euro = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR", maximumFractionDigits: 0});

export function NetworkProCatalog({coverage,access,canCheckout,billingReady,hasPaidSubscription}:{
  coverage:NetworkProCoverage|null;access:NetworkProAccess|null;
  canCheckout:boolean;billingReady:boolean;hasPaidSubscription:boolean;
}) {
  const [territory, setTerritory] = useState<NetworkProTerritory>("IT");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [selected, setSelected] = useState<NetworkProModuleKey[]>(["producers", "distributors"]);
  const [isStarting,startTransition]=useTransition();
  const [checkoutError,setCheckoutError]=useState<string|null>(null);
  const quote = networkProQuote(selected, territory, billing);
  const countries=coverage?.countries.filter(row=>territory==="EU"||row.countryCode==="IT")??[];

  function toggle(key: NetworkProModuleKey) {
    setCheckoutError(null);
    setSelected((current) => current.includes(key)
      ? current.filter((entry) => entry !== key)
      : [...current, key]);
  }

  function openCheckout(){
    if(!billingReady||!canCheckout||selected.length===0||isStarting||!coverage)return;
    setCheckoutError(null);
    startTransition(async()=>{
      try{
        const result=await startNetworkProCheckout({modules:selected,territory,interval:billing});
        if(result.status==="ready"){
          window.location.assign(result.url);
          return;
        }
        setCheckoutError(result.message);
      }catch{
        setCheckoutError("Checkout temporaneamente non disponibile. Nessun addebito eseguito.");
      }
    });
  }

  function openPortal(){
    if(!canCheckout||!billingReady||isStarting)return;
    setCheckoutError(null);
    startTransition(async()=>{
      try{
        const response=await openNetworkProCustomerPortal();
        if(response.status==="ready"){window.location.assign(response.url);return;}
        setCheckoutError(response.message);
      }catch{setCheckoutError("Portale abbonamenti temporaneamente indisponibile.");}
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-5 pb-16" data-testid="network-pro-catalog">
      <nav aria-label="Percorso Network" className="text-xs">
        <Link href="/network" className="font-semibold text-[#236d52] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
          ← Torna al Network
        </Link>
      </nav>
      <header className="overflow-hidden rounded-[24px] border border-[#b8d5c6] bg-[linear-gradient(120deg,#ecf5ef_0%,#ffffff_74%)] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em]">
          <span className="rounded-full bg-[#174c3c] px-3 py-1.5 text-white">Network PRO</span>
          <span className="rounded-full border border-[#bcd3c5] bg-white px-3 py-1.5 text-[#285a47]">Catalogo in anteprima</span>
        </div>
        <h1 className="mt-4 max-w-[800px] text-2xl font-bold tracking-tight text-[#173f35] sm:text-3xl">
          Le aziende che cerchi, in un unico Network.
        </h1>
        <p className="mt-2 max-w-[790px] text-sm leading-6 text-[#435b50]">
          Scegli i moduli e il territorio per configurare una proposta commerciale.
          Visualizza le aziende realmente pubblicate prima di valutare un futuro abbonamento.
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section aria-labelledby="network-pro-modules-title" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b6c5b]">Moduli · Scegli i contenuti</p>
              <h2 id="network-pro-modules-title" className="mt-1 text-lg font-bold text-[#173f35]">Quattro moduli indipendenti</h2>
            </div>
            <span className="text-xs font-medium text-[#52665b]">{selected.length} di 4 selezionati</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {NETWORK_PRO_MODULES.map((module, index) => {
              const active = selected.includes(module.key);
              return (
                <button
                  key={module.key}
                  type="button"
                  aria-pressed={active}
                  aria-label={(active ? "Rimuovi" : "Aggiungi") + " modulo " + module.title}
                  onClick={() => toggle(module.key)}
                  className={"min-h-[216px] rounded-[20px] border p-4 text-left shadow-[0_5px_18px_rgba(17,65,47,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
                    (active ? "border-[#35765a] bg-[#f0f7f2] ring-1 ring-[#6eac88]" : "border-[#dae5dc] bg-white hover:border-[#94bea3] hover:bg-[#f7faf8]")}
                  data-testid={"network-pro-module-" + module.key}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-[0.12em] text-[#577365]">0{index + 1}</span>
                    <span aria-hidden="true" className={"flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold " +
                      (active ? "border-[#256c49] bg-[#256c49] text-white" : "border-[#b8ccc0] bg-white text-[#5e7468]")}>
                      {active ? "✓" : "+"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#173f35]">{module.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[#42574c]">{module.description}</p>
                  <p className="mt-3 text-[11px] font-semibold leading-4 text-[#386e53]">{module.audience}</p>
                  <p className="mt-2 text-[11px] font-semibold text-[#425b4c]" data-testid={"netpro1b-license-"+module.key}>
                    {access?(territory==="IT"?access.modules[module.key].italy:access.modules[module.key].europe)
                      ? "Accesso PRO attivo" : "Accesso PRO non attivo":"Stato accesso non disponibile"}
                  </p>
                </button>
              );
            })}
          </div>
          <section className="rounded-[20px] border border-[#c9dfd0] bg-white p-4 sm:p-5"
            data-testid="netpro1b-coverage" aria-label="Copertura reale Network per modulo e Paese">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b6c5b]">Copertura effettiva · dati pubblicati</p>
                <h2 className="mt-1 text-base font-bold text-[#173f35]">Quante aziende ci sono realmente?</h2>
              </div>
              {coverage?<span className="text-[11px] text-[#607467]">Rilevazione {coverage.asOf.slice(0,10)}</span>:null}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#536c5c]">
              Solo schede pubblicate e ruoli registrati nel database. Le aziende preliminari
              non sono incluse nei numeri e non costituiscono copertura commerciale pronta.
              Le carpenterie classificate come terzisti sono nel modulo
              lavorazioni: non diventano automaticamente utilizzatori finali o acquirenti di tubi.
              Un’azienda appare in più moduli solo quando ha più ruoli registrati.
            </p>
            {!coverage?
              <p className="mt-4 rounded-xl border border-[#e5d4aa] bg-[#fffaf0] p-3 text-sm text-[#6b542c]" role="status">
                Conteggi verificati temporaneamente non disponibili. Non mostriamo valori stimati.
              </p>:
              countries.length===0?
                <p className="mt-4 rounded-xl bg-[#f2f5f3] p-3 text-sm text-[#516a59]">
                  Nessuna azienda pubblicata rilevata in questo territorio.
                </p>:
                <div className="mt-4 grid gap-3">
                  {countries.map(country=><article key={country.countryCode}
                    className="rounded-xl border border-[#e0eae2] bg-[#f8fbf9] p-3"
                    data-testid={"netpro1b-country-"+country.countryCode}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#173f35]">
                        {networkCountryName(country.countryCode)||country.countryCode}
                      </h3>
                      <span className="text-sm font-bold tabular-nums text-[#174d39]">
                        {country.published.toLocaleString("it-IT")} pubblicate
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-[#596d60]">
                      {country.classified.toLocaleString("it-IT")} classificate ·{" "}
                      {country.unclassified.toLocaleString("it-IT")} senza ruolo ·{" "}
                      {country.provisional.toLocaleString("it-IT")} preliminari
                    </p>
                    {selected.length===0?
                      <p className="mt-2 text-xs text-[#66796d]">Seleziona almeno un modulo per vedere i relativi numeri.</p>:
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {NETWORK_PRO_MODULES.filter(module=>selected.includes(module.key)).map(module=>{
                          const allowed=country.countryCode==="IT"
                            ?access?.modules[module.key].italy
                            :access?.modules[module.key].europe;
                          const count=country.publishedModules[module.key];
                          const sourced=country.provisionalModules[module.key];
                          return <div key={module.key} className="rounded-lg border border-[#e2ebe4] bg-white p-2.5"
                            data-testid={"netpro1b-module-"+country.countryCode+"-"+module.key}>
                            <p className="text-[11px] font-semibold text-[#355b42]">{module.title}</p>
                            <p className="mt-1 text-lg font-bold tabular-nums text-[#183d2d]">{count}</p>
                            <p className="text-[11px] text-[#62766a]">{sourced} preliminari, non incluse</p>
                            {allowed?
                              <Link href={"/network/pro/explore?"+new URLSearchParams({module:module.key,country:country.countryCode})}
                                className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline"
                                data-testid={"netpro1b-browse-"+country.countryCode+"-"+module.key}>
                                Esplora con accesso attivo
                              </Link>:
                              <span className="mt-2 block text-[11px] font-medium text-[#7b806e]">
                                {access?"Modulo non attivo":"Accesso da verificare"}
                              </span>}
                          </div>;
                        })}
                      </div>}
                  </article>)}
                </div>}
            <p className="mt-3 text-[11px] leading-5 text-[#64776b]">
              Europa non significa copertura completa di tutti i Paesi: mostriamo soltanto
              quelli con dati effettivamente disponibili. Nessun Paese è dichiarato pronto
              alla vendita sulla sola base di questi conteggi.
            </p>
          </section>
          <section className="rounded-[20px] border border-[#dce7df] bg-white p-4 sm:p-5" aria-label="Esempi di ricerche intelligenti">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b6c5b]">Dalla directory all'intelligence</p>
            <h2 className="mt-1 text-base font-bold text-[#173f35]">L'AI parlerà il linguaggio dell'acciaio</h2>
            <p className="mt-2 text-sm leading-6 text-[#506358]">
              Esempio di domanda: <span className="font-semibold text-[#173f35]">
                {NETWORK_PRO_MODULES.find((module) => module.key === selected[0])?.example
                  ?? "Trova produttori e distributori europei di tubolari strutturali."}
              </span>
            </p>
            <p className="mt-2 text-xs leading-5 text-[#67786e]">
              La ricerca intelligente per moduli è prevista in una fase successiva; non è inclusa in questa anteprima.
              Le capacità delle aziende saranno distinte tra dichiarate, documentate e da confermare.
            </p>
          </section>
        </section>

        <aside className="order-first min-w-0 space-y-3 lg:order-last lg:sticky lg:top-24" aria-label="Configurazione e prezzi Network PRO">
          <div className="rounded-[22px] border border-[#c6d9ce] bg-white p-4 shadow-[0_12px_30px_rgba(17,65,47,0.07)] sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b6c5b]">Territorio</p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Copertura geografica">
              {([
                {key: "IT", title: "Italia"},
                {key: "EU", title: "Europa"},
              ] as const).map((area) => (
                <button key={area.key} type="button" aria-pressed={territory === area.key}
                  onClick={() => setTerritory(area.key)}
                  className={"min-h-11 rounded-xl border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
                    (territory === area.key ? "border-[#175640] bg-[#175640] text-white" : "border-[#d9e4db] bg-[#f5f8f6] text-[#244a39] hover:border-[#92b5a0]")}>
                  {area.title}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#64776a]">
              {territory === "IT" ? "Aziende con copertura italiana." : "Paesi europei disponibili, Italia inclusa. Copertura effettiva per Paese da verificare."}
            </p>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4b6c5b]">Periodicità</p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Periodicità abbonamento">
              {([
                {key: "monthly", title: "Mensile"},
                {key: "annual", title: "Annuale"},
              ] as const).map((option) => (
                <button key={option.key} type="button" aria-pressed={billing === option.key}
                  onClick={() => setBilling(option.key)}
                  className={"min-h-11 rounded-xl border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
                    (billing === option.key ? "border-[#175640] bg-[#175640] text-white" : "border-[#d9e4db] bg-[#f5f8f6] text-[#244a39] hover:border-[#92b5a0]")}>
                  {option.title}
                </button>
              ))}
            </div>
            {billing === "annual" ? <p className="mt-2 text-xs text-[#326e4d]">Sconto annuo ipotizzato: {NETWORK_PRO_ANNUAL_DISCOUNT_PERCENT}%.</p> : null}

            <div className="mt-5 border-t border-[#e1e9e3] pt-4" aria-live="polite" aria-atomic="true">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-[#274838]">{quote.count === 4 ? "Full Network" : quote.count + (quote.count === 1 ? " modulo" : " moduli")}</span>
                <span className="text-3xl font-bold tabular-nums tracking-tight text-[#173f35]" data-testid="network-pro-price">{euro.format(quote.displayedTotal)}</span>
              </div>
              <p className="mt-1 text-right text-xs text-[#586f60]">{billing === "annual" ? "all'anno" : "al mese"} · IVA esclusa</p>
              {quote.count > 1 ? <p className="mt-2 text-xs font-medium text-[#326e4d]">Sconto combinazione già applicato.</p> : null}
              {quote.count === 0 ? <p className="mt-3 text-xs text-[#926328]">Seleziona almeno un modulo per configurare l'offerta.</p> : null}
              <p className="mt-4 text-xs leading-5 text-[#52695a]">
                Prezzi proposti, ancora da validare con i clienti pilota. Nessun ordine o pagamento viene creato da questa schermata.
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[#e1e9e3] bg-[#f4f8f5] p-3">
              <p className="text-xs font-semibold text-[#244f3b]">Abbonamento Network PRO</p>
              <p className="mt-1 text-xs leading-5 text-[#596e60]">
                Seleziona i moduli e paga online. Il sistema sblocca automaticamente
                gli accessi acquistati solo dopo la conferma del pagamento.
                Nessuna richiesta o approvazione manuale.
              </p>
              {!billingReady?<p className="mt-2 text-xs font-semibold text-[#745c2c]">
                Checkout non ancora disponibile: configurazione Stripe e listino definitivo in preparazione.
              </p>:<p className="mt-2 text-xs text-[#396a51]">
                Prezzo definitivo, IVA e condizioni di rinnovo saranno mostrati nel checkout sicuro prima del pagamento.
              </p>}
            </div>
            <button type="button" onClick={openCheckout}
              disabled={!billingReady||!canCheckout||!coverage||hasPaidSubscription||selected.length===0||isStarting}
              data-testid="netpro-f1-checkout"
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#175640] px-3 text-sm font-semibold text-white hover:bg-[#124632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:bg-[#829a8d]">
              {isStarting?"Apertura pagamento sicuro…":"Abbonati e sblocca"}
            </button>
            {hasPaidSubscription&&canCheckout?
              <button type="button" onClick={openPortal} disabled={!billingReady||isStarting}
                data-testid="netpro-f2-portal"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#9bbda7] bg-white px-3 text-sm font-semibold text-[#175640] hover:bg-[#f2f8f4] disabled:opacity-50">
                Gestisci il tuo abbonamento
              </button>:null}
            {!canCheckout?<p className="mt-2 text-xs text-[#586f60]">
              Solo un amministratore aziendale può acquistare l’abbonamento.
            </p>:null}
            {checkoutError?<p role="alert" className="mt-2 rounded-lg border border-[#e1cba3] bg-[#fff9ef] p-3 text-xs text-[#765223]">
              {checkoutError}
            </p>:null}
            <Link href="/network" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#b5d2bf] bg-white px-3 text-sm font-semibold text-[#205a3d] hover:bg-[#f2f8f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
              Esplora il Network
            </Link>
          </div>
          <p className="px-1 text-xs leading-5 text-[#66776d]">
            Directory Free e gestione del profilo aziendale rimangono indipendenti dall'acquisto PRO.
            Nessun dato privato viene reso pubblico.
          </p>
        </aside>
      </div>
    </main>
  );
}
