"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

function applicationId(formData: FormData) {
  return String(formData.get("application_id") ?? "").trim();
}

function detailPath(id: string, key: "error" | "message", value: string) {
  return `/platform/registrations/${id}?${key}=${encodeURIComponent(value)}`;
}

export async function requestRegistrationInformation(formData: FormData) {
  await requirePlatformPermission("registrations.request_information");
  const id = applicationId(formData);
  const note = String(formData.get("note") ?? "").trim();

  if (!id) redirect("/platform/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p0a_request_registration_information", {
    p_application_id: id,
    p_note: note || null,
  });

  if (error) {
    redirect(detailPath(id, "error", "Non è stato possibile richiedere altre informazioni."));
  }

  revalidatePath("/platform/registrations");
  revalidatePath(`/platform/registrations/${id}`);
  redirect(detailPath(id, "message", "Richiesta di integrazione inviata."));
}

export async function approveRegistrationApplication(formData: FormData) {
  await requirePlatformPermission("registrations.approve");
  const id = applicationId(formData);
  if (!id) redirect("/platform/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p0a_approve_registration_application", {
    p_application_id: id,
  });

  if (error) {
    redirect(detailPath(id, "error", "Non è stato possibile approvare la richiesta."));
  }

  revalidatePath("/platform/registrations");
  revalidatePath(`/platform/registrations/${id}`);
  redirect(detailPath(id, "message", "Richiesta approvata. Ora puoi attivare il workspace."));
}

export async function rejectRegistrationApplication(formData: FormData) {
  await requirePlatformPermission("registrations.reject");
  const id = applicationId(formData);
  const reasonCode = String(formData.get("reason_code") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!id) redirect("/platform/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p0a_reject_registration_application", {
    p_application_id: id,
    p_reason_code: reasonCode,
    p_note: note || null,
  });

  if (error) {
    redirect(detailPath(id, "error", "Non è stato possibile rifiutare la richiesta."));
  }

  revalidatePath("/platform/registrations");
  revalidatePath(`/platform/registrations/${id}`);
  redirect(detailPath(id, "message", "Richiesta rifiutata."));
}

export async function approveAndActivateRegistration(formData: FormData) {
  await requirePlatformPermission("registrations.approve");
  await requirePlatformPermission("registrations.activate");
  await requirePlatformPermission("registrations.bridge_network");

  const id = applicationId(formData);
  const networkCompanyId = String(formData.get("network_company_id") ?? "").trim();
  if (!id) redirect("/platform/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("hp6_approve_and_activate_registration", {
    p_application_id: id,
    p_network_company_id: networkCompanyId || null,
  });

  if (error) {
    const message = error.message.includes("identity candidates exist")
      ? "Esistono match identitari: seleziona esplicitamente la Network Company corretta."
      : error.message.includes("already controlled by another organization") ||
          error.message.includes("approved claim by another organization")
        ? "Il profilo selezionato è già controllato da un’altra Organization. Nessuna modifica è stata applicata."
        : error.message.includes("not an identity candidate")
          ? "La Network Company selezionata non corrisponde ai match identitari di questa pratica."
          : "Non è stato possibile completare approvazione e attivazione atomica.";

    redirect(detailPath(id, "error", message));
  }

  revalidatePath("/platform/registrations");
  revalidatePath("/network");
  revalidatePath("/network/manage");
  revalidatePath(`/platform/registrations/${id}`);
  redirect(
    detailPath(
      id,
      "message",
      "Registrazione approvata e workspace attivato in un’unica operazione.",
    ),
  );
}

export async function activateRegistrationApplication(formData: FormData) {
  await requirePlatformPermission("registrations.activate");
  await requirePlatformPermission("registrations.bridge_network");

  const id = applicationId(formData);
  const networkCompanyId = String(formData.get("network_company_id") ?? "").trim();
  if (!id) redirect("/platform/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = networkCompanyId
    ? await supabase.rpc("p0a_activate_registration_application_with_network", {
        p_application_id: id,
        p_network_company_id: networkCompanyId,
      })
    : await supabase.rpc("p0a_activate_registration_application", {
        p_application_id: id,
      });

  if (error) {
    const message = error.message.includes("identity candidates exist")
      ? "Esistono possibili profili Network: seleziona esplicitamente l’azienda corretta prima dell’attivazione."
      : error.message.includes("approved claim by another organization")
        ? "Il profilo Network selezionato è già collegato a un’altra organizzazione. L’attivazione è stata annullata senza creare un tenant parziale."
        : "Non è stato possibile completare l’attivazione atomica del workspace.";
    redirect(detailPath(id, "error", message));
  }

  revalidatePath("/platform/registrations");
  revalidatePath("/network");
  revalidatePath("/network/manage");
  revalidatePath(`/platform/registrations/${id}`);
  redirect(detailPath(id, "message", "Workspace e identità Network attivati correttamente."));
}


export async function bridgeRegistrationToNetwork(formData: FormData) {
  await requirePlatformPermission("registrations.bridge_network");
  const id = applicationId(formData);
  const networkCompanyId = String(formData.get("network_company_id") ?? "").trim();

  if (!id) redirect("/platform/registrations?error=Application%20non%20valida");

  const supabase = await createClient();
  const { error } = await supabase.rpc("m7_bridge_registration", {
    p_application_id: id,
    p_network_company_id: networkCompanyId || null,
  });

  if (error) {
    redirect(detailPath(id, "error", error.message));
  }

  revalidatePath("/platform/registrations");
  revalidatePath("/network");
  revalidatePath("/network/manage");
  revalidatePath("/platform/registrations/" + id);
  redirect(detailPath(id, "message", "Registration bridge Network completato."));
}
