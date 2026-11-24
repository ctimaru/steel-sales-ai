"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
const path="/platform/fundraising";
export async function changeCommunityInterest(form:FormData) {
  await requirePlatformSuperadmin();
  const id=String(form.get("id")??""), status=String(form.get("status")??"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!["new","contacted","closed","delete"].includes(status)) redirect(path+"?community=error#community-interest");
  const db=await createClient();
  const result=status==="delete" ? await db.from("mkt9_community_interest").delete().eq("id",id).select("id").maybeSingle() :
    await db.from("mkt9_community_interest").update({status}).eq("id",id).gt("expires_at",new Date().toISOString()).select("id").maybeSingle();
  if(result.error||!result.data) redirect(path+"?community=error#community-interest");
  revalidatePath(path);
  redirect(path+"?community=updated#community-interest");
}
