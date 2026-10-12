"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import { normalizePlatformNotificationFilter } from "@/lib/platform-notifications";
import { createClient } from "@/lib/supabase/server";
import { appRoutes } from "@/lib/routes";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setPlatformNotificationState(formData:FormData) {
  const recipientId=formData.get("recipient_id"),action=formData.get("action");
  const filter=normalizePlatformNotificationFilter(formData.get("filter"));
  const page=Number(formData.get("page")??1);
  const safePage=Number.isSafeInteger(page)&&page>=1&&page<=50?page:1;
  const returnTo=`${appRoutes.platform.notifications}?filter=${filter}&page=${safePage}`;
  if(typeof recipientId!=="string"||!UUID.test(recipientId)||
     typeof action!=="string"||!["read","unread","archive","restore"].includes(action)) {
    redirect(`${returnTo}&error=invalid`);
  }
  const context=await requirePlatformConsoleContext();
  if(!context.permissions.includes("platform.console.access"))redirect("/dashboard");
  const client=await createClient();
  let success=false;
  try {
    const {data,error}=await client.rpc("nc32_platform_notification_set_state",{
      p_recipient_id:recipientId,p_action:action,
    });
    const response=data as {ok?:unknown;recipient_id?:unknown;action?:unknown}|null;
    success=!error&&response?.ok===true&&response.recipient_id===recipientId&&response.action===action;
  } catch {success=false;}
  if(!success)redirect(`${returnTo}&error=update`);
  revalidatePath(appRoutes.platform.notifications);
  revalidatePath(appRoutes.platform.home);
  redirect(returnTo);
}
