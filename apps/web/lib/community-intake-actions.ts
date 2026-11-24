"use server";
import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { communityIntakeConfig, communityNoticeVersion, communityPath } from "@/lib/community-intake-config";

function digest(value:string) { return createHmac("sha256",process.env.MKT9_COMMUNITY_OTP_SECRET!).update(value).digest("hex"); }
function intakeDb() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.MKT9_COMMUNITY_SUPABASE_SECRET!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}); }
const cookieOptions={httpOnly:true,secure:true,sameSite:"lax" as const,path:"/",maxAge:600};
export async function submitCommunityInterest(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "it";
  const kind = form.get("kind") === "investor" ? "investor" : "partner";
  const back = communityPath(locale, kind);
  const config = communityIntakeConfig();
  if (!config.enabled) redirect(back + "&result=closed");
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const name = text("name"), email = text("email").toLowerCase(), organization = text("organization");
  const token = text("cf-turnstile-response");
  if (!["partner","investor"].includes(text("kind")) || name.length < 2 || name.length > 120 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      organization.length > 160 || (kind === "partner" && !organization) ||
      text("privacy") !== "on" || text("website_check") || !token || token.length > 2048) {
    redirect(back + "&result=invalid");
  }
  let verified = false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method:"POST", body:new URLSearchParams({secret:process.env.MKT9_TURNSTILE_SECRET!,response:token}),
      cache:"no-store", signal:AbortSignal.timeout(8000),
    });
    const result = await response.json() as {success?:boolean;hostname?:string;action?:string};
    verified = response.ok && result.success === true && result.hostname === config.hostname && result.action === "community_interest";
  } catch { /* fail closed without logging PII */ }
  if (!verified) redirect(back + "&result=invalid");
  const id=randomUUID(), code=String(randomInt(0,100000000)).padStart(8,"0");
  const jar=await cookies();
  jar.delete("mkt9_community_receipt");
  // Uniform response even when the email budget is exhausted. No PII in cookie or URL.
  jar.set("mkt9_community_pending",id,cookieOptions);
  try {
    const {data,error}=await intakeDb().rpc("mkt9_reserve_email",{
      p_id:id,p_email_digest:digest("email:"+email),p_code_digest:digest("code:"+id+":"+code),
      p_challenge_digest:createHash("sha256").update(token).digest("hex"),
      p_payload:{kind,locale,name,email,organization:organization||null,notice_version:communityNoticeVersion},
    });
    if(!error && data===true) {
      await fetch("https://api.resend.com/emails",{
        method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY!,"Content-Type":"application/json","Idempotency-Key":"mkt9-"+id},
        body:JSON.stringify({from:process.env.MKT9_COMMUNITY_EMAIL_FROM!,to:[email],
          subject:locale==="en"?"Smart Steel Sales — verification code":"Smart Steel Sales — codice di verifica",
          text:locale==="en"?"Your verification code is "+code+". It expires in 10 minutes. Ignore this email if you did not request it. No account or investment is created.":"Il tuo codice di verifica è "+code+". Scade tra 10 minuti. Se non hai richiesto il codice, ignora questa email. Nessun account o investimento viene creato."}),
        cache:"no-store",signal:AbortSignal.timeout(8000),
      });
      // Provider acceptance is not mailbox ownership. No retries or raw provider logs here.
    }
  } catch { /* uniform response; no PII or credentials in logs */ }
  redirect(back+"&result=verify");
}

export async function confirmCommunityEmail(form:FormData) {
  const locale=form.get("locale")==="en"?"en":"it",kind=form.get("kind")==="investor"?"investor":"partner";
  const back=communityPath(locale,kind);
  if(!communityIntakeConfig().enabled) redirect(back+"&result=closed");
  const jar=await cookies(),id=jar.get("mkt9_community_pending")?.value||"",code=String(form.get("code")??"").trim();
  if(!/^[0-9a-f-]{36}$/.test(id)||!/^\d{8}$/.test(code)) redirect(back+"&result=verify-error");
  let accepted=false;
  try {
    const {data,error}=await intakeDb().rpc("mkt9_confirm_email",{p_id:id,p_code_digest:digest("code:"+id+":"+code)});
    accepted=!error&&data===true;
  } catch { /* fail closed */ }
  if(!accepted) redirect(back+"&result=verify-error");
  jar.delete("mkt9_community_pending");
  jar.set("mkt9_community_receipt","confirmed",{...cookieOptions,maxAge:120});
  redirect(back+"&result=received");
}
