import "server-only";
import {createHmac,timingSafeEqual} from "node:crypto";
import type {NetworkProTerritory} from "@/lib/network-pro-catalog";

export type NetProBillingInterval="monthly"|"annual";
export type NetProPriceSelection={
  territory:NetworkProTerritory;interval:NetProBillingInterval;moduleCount:1|2|3|4;
};
export type StripeObject=Record<string,unknown>;

export function netProBillingEnabled():boolean{
  // Checkout must not start unless the customer can also manage and cancel
  // their subscription. A complete 16-price catalog avoids partial offerings.
  if(process.env.NETPRO_BILLING_ENABLED!=="true"||
     !/^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY||"")||
     !(process.env.STRIPE_WEBHOOK_SECRET||"").startsWith("whsec_")||
     !process.env.SUPABASE_SERVICE_ROLE_KEY||
     !/^bpc_[A-Za-z0-9]{10,}$/.test(process.env.STRIPE_NETPRO_PORTAL_CONFIGURATION_ID||"")||
     !trustedBillingOrigin())return false;
  try{
    const priceMap=JSON.parse(process.env.STRIPE_NETPRO_PRICE_IDS_JSON||"{}") as Record<string,unknown>;
    return (["IT","EU"] as const).every(area=>
      (["monthly","annual"] as const).every(interval=>
        ([1,2,3,4] as const).every(count=>
          typeof priceMap[area+":"+interval+":"+count]==="string" &&
          /^price_[A-Za-z0-9]{10,}$/.test(priceMap[area+":"+interval+":"+count] as string)
        )
      )
    );
  }catch{return false;}
}

export function stripePriceId(input:NetProPriceSelection):string|null{
  if(!netProBillingEnabled())return null;
  try{
    const mapping=JSON.parse(process.env.STRIPE_NETPRO_PRICE_IDS_JSON||"{}") as Record<string,unknown>;
    const key=[input.territory,input.interval,input.moduleCount].join(":");
    const value=mapping[key];
    return typeof value==="string"&&/^price_[A-Za-z0-9]{10,}$/.test(value)?value:null;
  }catch{return null;}
}

export function trustedBillingOrigin():string|null{
  try{
    const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||"");
    if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=="/")return null;
    if(origin.protocol!=="https:" && !(process.env.NODE_ENV!=="production"&&
      origin.protocol==="http:"&&["localhost","127.0.0.1"].includes(origin.hostname)))return null;
    return origin.origin;
  }catch{return null;}
}

export async function stripeCall<T=StripeObject>(
  path:string,options?:{method?:"GET"|"POST";params?:URLSearchParams;idempotencyKey?:string},
):Promise<T>{
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key||!/^sk_(test|live)_/.test(key)||!path.startsWith("/")||path.startsWith("//"))
    throw new Error("stripe_unconfigured");
  const response=await fetch("https://api.stripe.com/v1"+path,{
    method:options?.method||"GET",
    headers:{
      Authorization:"Bearer "+key,
      // Pin the invoice-line and subscription-item shapes used in F.2.
      "Stripe-Version":"2025-06-30.basil",
      ...(options?.params?{"Content-Type":"application/x-www-form-urlencoded"}:{}),
      ...(options?.idempotencyKey?{"Idempotency-Key":options.idempotencyKey}:{}),
    },
    body:options?.params?.toString(),
    cache:"no-store",
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new Error("stripe_request_failed_"+response.status);
  return await response.json() as T;
}

export async function verifiedStripePrice(id:string,interval:NetProBillingInterval){
  if(!/^price_[A-Za-z0-9]{10,}$/.test(id))throw new Error("invalid_price_id");
  const price=await stripeCall<{
    id:string;active:boolean;currency:string;unit_amount:number|null;
    recurring?:{interval:string;interval_count?:number};type:string;
    tax_behavior?:string|null;
  }>("/prices/"+encodeURIComponent(id));
  if(price.id!==id||price.active!==true||price.currency!=="eur"||
     !Number.isSafeInteger(price.unit_amount)|| (price.unit_amount??0)<=0 ||
     price.type!=="recurring"||price.tax_behavior!=="exclusive"||
     price.recurring?.interval_count!==1||
     price.recurring?.interval!==(interval==="monthly"?"month":"year"))
    throw new Error("stripe_price_not_approved");
  return price;
}

/**
 * A valid configuration ID alone is not enough: buyers must actually be able
 * to update payment details, review invoices and cancel without an operator.
 * Plan/price changes stay disabled until atomic replacements are supported.
 */
export async function verifyNetworkProPortalReady():Promise<void>{
  const id=process.env.STRIPE_NETPRO_PORTAL_CONFIGURATION_ID||"";
  if(!/^bpc_[A-Za-z0-9]{10,}$/.test(id))throw new Error("portal_not_configured");
  const portal=await stripeCall<{
    id:string;active:boolean;livemode:boolean;
    features?:{
      invoice_history?:{enabled:boolean};
      payment_method_update?:{enabled:boolean};
      subscription_cancel?:{enabled:boolean;mode:string};
      subscription_update?:{enabled:boolean};
    };
  }>("/billing_portal/configurations/"+encodeURIComponent(id));
  const expectedLive=process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")===true;
  if(portal.id!==id||portal.active!==true||portal.livemode!==expectedLive||
     portal.features?.invoice_history?.enabled!==true||
     portal.features?.payment_method_update?.enabled!==true||
     portal.features?.subscription_cancel?.enabled!==true||
     portal.features?.subscription_cancel?.mode!=="at_period_end"||
     portal.features?.subscription_update?.enabled!==false)
    throw new Error("portal_requires_self_service_cancellation_and_restricted_plan_changes");
}

export function verifyStripeSignature(payload:string,header:string|null,secret:string,nowSeconds=Math.floor(Date.now()/1000)):boolean{
  if(!header||!secret.startsWith("whsec_"))return false;
  const entries=new Map(header.split(",").map(part=>part.trim().split("=",2) as [string,string]));
  const timestamp=Number(entries.get("t"));
  if(!Number.isSafeInteger(timestamp)||timestamp<=0||
     Math.abs(nowSeconds-timestamp)>300)return false;
  const expected=Uint8Array.from(createHmac("sha256",secret).update(timestamp+"."+payload).digest());
  const signatures=header.split(",").filter(x=>x.trim().startsWith("v1="));
  return signatures.some(item=>{
    const hex=item.trim().slice(3);
    if(!/^[0-9a-f]{64}$/i.test(hex))return false;
    const received=Uint8Array.from(Buffer.from(hex,"hex"));
    return received.length===expected.length&&timingSafeEqual(received,expected);
  });
}

export function stripeId(value:unknown,prefix:string):value is string{
  return typeof value==="string"&&value.startsWith(prefix+"_")&&
    /^[A-Za-z0-9_]{5,150}$/.test(value);
}
