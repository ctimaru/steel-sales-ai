"use server";

import {getWorkspaceContext} from "@/lib/workspace-context";
import {createClient} from "@/lib/supabase/server";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {
  NETWORK_PRO_MODULES,
  type NetworkProModuleKey,
  type NetworkProTerritory,
} from "@/lib/network-pro-catalog";

type RequestInput={
  modules:NetworkProModuleKey[];
  territory:NetworkProTerritory;
  billing:"monthly"|"annual";
};

export type RequestOutcome=
  |{status:"recorded";requestId:string}
  |{status:"invalid"|"forbidden"|"unavailable";message:string};

const validModules=new Set<string>(NETWORK_PRO_MODULES.map(module=>module.key));

/** A non-binding commercial enquiry. Never creates a paid subscription or an entitlement. */
export async function requestNetworkProActivation(input:RequestInput):Promise<RequestOutcome>{
  if(!isNetworkFrontendEnabled())return {
    status:"unavailable",message:"Network PRO non è disponibile.",
  };
  if(!input||!Array.isArray(input.modules)||input.modules.length<1||input.modules.length>4||
     new Set(input.modules).size!==input.modules.length||
     input.modules.some(module=>typeof module!=="string"||!validModules.has(module))||
     !["IT","EU"].includes(input.territory)||
     !["monthly","annual"].includes(input.billing)){
    return {status:"invalid",message:"Seleziona moduli, territorio e periodicità validi."};
  }

  const context=await getWorkspaceContext();
  if(context.role!=="admin"||context.onboardingStatus==="suspended"){
    return {
      status:"forbidden",
      message:"Solo un amministratore aziendale può inviare una richiesta di attivazione.",
    };
  }

  try{
    const db=await createClient();
    const {data,error}=await db.rpc("netpro1e_request_activation",{
      p_organization_id:context.organizationId,
      p_module_keys:input.modules,
      p_territory:input.territory,
      p_billing_period:input.billing,
    });
    if(error){
      if(error.code==="42501")return {
        status:"forbidden",message:"Non hai il permesso di inviare questa richiesta.",
      };
      return {status:"unavailable",message:"Richiesta non registrata. Riprova più tardi."};
    }
    const record=data as Record<string,unknown>|null;
    if(record?.contract!=="netpro1e-request-v1"||
       record.status!=="requested"||
       typeof record.request_id!=="string"||
       !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(record.request_id)){
      return {status:"unavailable",message:"Impossibile verificare la registrazione della richiesta."};
    }
    return {status:"recorded",requestId:record.request_id};
  }catch{
    return {status:"unavailable",message:"Richiesta non registrata. Riprova più tardi."};
  }
}
