import { redirect } from "next/navigation";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { appRoutes } from "@/lib/routes";

export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!UUID.test(id))redirect(`${appRoutes.platform.notifications}?unavailable=1`);
  await requirePlatformConsoleContext();
  const client=await createClient();
  let result:{type?:unknown;id?:unknown}|null=null;
  try {
    const {data,error}=await client.rpc("nc32_platform_notification_destination",{
      p_recipient_id:id,
    });
    if(!error&&data&&typeof data==="object"&&!Array.isArray(data))
      result=data as {type?:unknown;id?:unknown};
  } catch {result=null;}

  const targetId=typeof result?.id==="string"&&UUID.test(result.id)?result.id:null;
  if(result?.type==="registration"&&targetId)
    redirect(appRoutes.platform.registration(targetId));
  if(result?.type==="claims")redirect(appRoutes.platform.claims);
  if(result?.type==="platform")redirect(appRoutes.platform.home);
  redirect(`${appRoutes.platform.notifications}?unavailable=1`);
}
