"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function applicationId(formData: FormData) {
  return String(formData.get("application_id") ?? "").trim();
}

function detailPath(id: string, key: "error" | "message", value: string) {
  return `/admin/registrations/${id}?${key}=${encodeURIComponent(value)}`;
}

export async function requestRegistrationInformation(formData: FormData) {
  const id = applicationId(formData);
  const note = String(formData.get("note") ?? "").trim();

  if (!id) redirect("/admin/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p0a_request_registration_information", {
    p_application_id: id,
    p_note: note || null,
  });

  if (error) {
    redirect(detailPath(id, "error", "Non è stato possibile richiedere altre informazioni."));
  }

  revalidatePath("/admin/registrations");
  revalidatePath(`/admin/registrations/${id}`);
  redirect(detailPath(id, "message", "Richiesta di integrazione inviata."));
}

export async function approveRegistrationApplication(formData: FormData) {
  const id = applicationId(formData);
  if (!id) redirect("/admin/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p0a_approve_registration_application", {
    p_application_id: id,
  });

  if (error) {
    redirect(detailPath(id, "error", "Non è stato possibile approvare la richiesta."));
  }

  revalidatePath("/admin/registrations");
  revalidatePath(`/admin/registrations/${id}`);
  redirect(detailPath(id, "message", "Richiesta approvata. Ora puoi attivare il workspace."));
}

export async function rejectRegistrationApplication(formData: FormData) {
  const id = applicationId(formData);
  const reasonCode = String(formData.get("reason_code") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!id) redirect("/admin/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p0a_reject_registration_application", {
    p_application_id: id,
    p_reason_code: reasonCode,
    p_note: note || null,
  });

  if (error) {
    redirect(detailPath(id, "error", "Non è stato possibile rifiutare la richiesta."));
  }

  revalidatePath("/admin/registrations");
  revalidatePath(`/admin/registrations/${id}`);
  redirect(detailPath(id, "message", "Richiesta rifiutata."));
}

export async function activateRegistrationApplication(formData: FormData) {
  const id = applicationId(formData);
  if (!id) redirect("/admin/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p0a_activate_registration_application", {
    p_application_id: id,
  });

  if (error) {
    redirect(detailPath(id, "error", "Non è stato possibile attivare il workspace."));
  }

  revalidatePath("/admin/registrations");
  revalidatePath(`/admin/registrations/${id}`);
  redirect(detailPath(id, "message", "Workspace aziendale attivato."));
}
