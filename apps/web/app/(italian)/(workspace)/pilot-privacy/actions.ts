"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function withdrawPilotAnalytics(formData: FormData) {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) {
    redirect("/pilot-privacy?result=invalid");
  }
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) redirect("/login");
  const { error } = await client.rpc("prod_next1e_set_analytics_preference", {
    p_organization_id: organizationId,
    p_decision: "denied",
    p_notice_version: "withdrawn",
  });
  if (error) redirect("/pilot-privacy?result=blocked");
  revalidatePath("/pilot-privacy");
  redirect("/pilot-privacy?result=updated");
}
