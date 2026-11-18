"use client";

import {useCallback,useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";

type OwnerFact={
  id:string;
  value:string;
  kind:string;
  product_scope:string;
  review_status:"pending"|"confirmed"|"removed";
};
const labels:Record<string,string>={
  technical_standard:"Norma",steel_grade:"Qualità",
  section_shape:"Sezione",dimension_range:"Dimensioni",
  manufacturing_process:"Processo",
};
export function ProducerStructuredModeration({companyId}:{
  companyId:string|null;
}){
  const [items,setItems]=useState<OwnerFact[]>([]);
  const [loading,setLoading]=useState(false);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const refresh=useCallback(async()=>{
    if(!companyId)return;
    setLoading(true);
    try{
      const {data,error:failure}=await createClient().rpc(
        "netproducers1_structured_owner_manage",{
          p_operation:"list",p_company:companyId,p_fact:null,
        });
      if(failure)throw failure;
      if(data?.contract!=="netproducers-structured-owner-v1"||!Array.isArray(data.items))
        throw new Error("Unexpected catalogue moderation response");
      setItems(data.items as OwnerFact[]);
      setError("");
    }catch{
      setError("La gestione dei dati richiede un profilo produttore verificato con un amministratore autorizzato.");
    }finally{setLoading(false);}
  },[companyId]);
  useEffect(()=>{void refresh();},[refresh]);
  async function action(factId:string,operation:"confirm"|"remove"|"restore"){
    if(!companyId||busyId)return;
    setBusyId(factId);setNotice("");setError("");
    try{
      const {data,error:failure}=await createClient().rpc(
        "netproducers1_structured_owner_manage",{
          p_operation:operation,p_company:companyId,p_fact:factId,
        });
      if(failure||data?.contract!=="netproducers-structured-owner-v1"||
         data?.status!==operation)throw failure||new Error("Review failed");
      setNotice(operation==="confirm"?"Attributo confermato dall'azienda.":
        operation==="remove"?"Attributo rimosso immediatamente dalla consultazione pubblica.":
          "Attributo ripubblicato come da confermare.");
      await refresh();
    }catch{
      setError("Operazione non riuscita. Verifica l'accesso aziendale e riprova.");
    }finally{setBusyId(null);}
  }
  return <section className="rounded-2xl border border-[#dce8df] bg-white p-4 sm:p-6"
    data-testid="producer-structured-moderation">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#2c7550]">
          Controllo dell'azienda
        </p>
        <h2 className="mt-1 text-lg font-bold text-[#1d4632]">
          Conferma o rimuovi i dati pubblicati
        </h2>
      </div>
      <button type="button" disabled={loading||!!busyId} onClick={()=>void refresh()}
        className="min-h-10 rounded-lg border border-[#c6d8cb] px-4 text-xs font-bold text-[#246046]">
        Aggiorna
      </button>
    </div>
    <p className="mt-2 text-xs leading-5 text-[#63786a]">
      I dati osservati sono già consultabili. Un amministratore verificato può
      confermare un singolo attributo, rimuoverlo subito o ripubblicarlo.
      La conferma riguarda soltanto il valore indicato: non attesta
      una combinazione di norme, qualità e misure né la disponibilità.
    </p>
    {loading?<p className="mt-4 text-sm text-[#5f7866]">Lettura dei dati aziendali…</p>:null}
    {notice?<p className="mt-3 text-sm font-semibold text-[#24714c]" role="status">{notice}</p>:null}
    {error?<p className="mt-3 text-sm text-[#a44133]" role="alert">{error}</p>:null}
    {items.length?<div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
      {items.map(item=><div key={item.id}
        className={"flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 "+
        (item.review_status==="removed"?"border-[#e4d2cc] bg-[#fffaf7]":"border-[#e4ebe5] bg-[#fbfdfb]")}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[#284636]">{item.value}</p>
          <p className="mt-1 text-[11px] text-[#657c6c]">
            {labels[item.kind]??item.kind} · {item.product_scope.replaceAll("-"," ")}
            {" · "+(item.review_status==="confirmed"?"Confermato dall'azienda":
              item.review_status==="removed"?"Non pubblicato":"Da confermare")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.review_status!=="removed"?
            <>
              {item.review_status!=="confirmed"?
                <button disabled={!!busyId} type="button"
                  onClick={()=>void action(item.id,"confirm")}
                  className="min-h-9 rounded-lg bg-[#18583d] px-3 text-[11px] font-bold text-white disabled:opacity-50">
                  Conferma</button>:null}
              <button disabled={!!busyId} type="button"
                onClick={()=>void action(item.id,"remove")}
                className="min-h-9 rounded-lg border border-[#ddbaab] px-3 text-[11px] font-bold text-[#963e31] disabled:opacity-50">
                Rimuovi</button>
            </>
          :<button disabled={!!busyId} type="button"
            onClick={()=>void action(item.id,"restore")}
            className="min-h-9 rounded-lg border border-[#bdcfbf] px-3 text-[11px] font-bold text-[#236548] disabled:opacity-50">
            Ripubblica</button>}
        </div>
      </div>)}
    </div>:!loading&&!error?<p className="mt-4 text-xs text-[#718477]">
      Nessun attributo pubblicato per questa azienda.
    </p>:null}
  </section>;
}
