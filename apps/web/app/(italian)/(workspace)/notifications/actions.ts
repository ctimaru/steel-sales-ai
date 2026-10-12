"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { normalizeWorkspaceNotificationFilter } from "@/lib/workspace-notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setWorkspaceNotificationState(formData: FormData) {
  const recipientId = formData.get("recipient_id");
  const action = formData.get("action");
  const filter = normalizeWorkspaceNotificationFilter(formData.get("filter"));
  const page = Number(formData.get("page") ?? 1);
  const nextPage = Number.isSafeInteger(page) && page >= 1 && page <= 50 ? page : 1;
  const returnTo = `${appRoutes.notifications}?filter=${filter}&page=${nextPage}`;

  if (typeof recipientId !== "string" || !UUID.test(recipientId) ||
    typeof action !== "string" || !["read","unread","archive","restore"].includes(action)) {
    redirect(`${returnTo}&error=invalid`);
  }

  const context = await getWorkspaceContext();
  const client = await createClient();
  let updated = false;
  try {
    const { data, error } = await client.rpc("nc31_workspace_notification_set_state", {
      p_recipient_id: recipientId,
      p_organization_id: context.organizationId,
      p_action: action,
    });
    const result = data as { ok?: unknown; recipient_id?: unknown; action?: unknown } | null;
    updated = !error && result?.ok === true &&
      result.recipient_id === recipientId && result.action === action;
  } catch {
    updated = false;
  }

  if (!updated) redirect(`${returnTo}&error=update`);
  revalidatePath(appRoutes.notifications);
  revalidatePath(appRoutes.home);
  redirect(returnTo);
}
