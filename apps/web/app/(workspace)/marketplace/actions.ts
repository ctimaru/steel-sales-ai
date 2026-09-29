"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function marketplaceError(path: string, error: string) {
  return path + (path.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(error);
}

export async function createMarketplaceRequest(formData: FormData) {
  const context = await requireWorkspaceWriteRole(appRoutes.marketplace.home);
  const title = textValue(formData, "title");
  const visibilityMode = textValue(formData, "visibility_mode") || "named";

  if (title.length < 5) {
    redirect(marketplaceError(appRoutes.marketplace.newRequest, "Inserisci un titolo più descrittivo."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_1_create_request", {
    p_organization_id: context.organizationId,
    p_title: title,
    p_visibility_mode: visibilityMode,
  });

  if (error) redirect(marketplaceError(appRoutes.marketplace.newRequest, error.message));

  const requestId = String((data as { request_id?: string } | null)?.request_id ?? "");
  if (!requestId) redirect(marketplaceError(appRoutes.marketplace.home, "Richiesta non creata."));

  revalidatePath(appRoutes.marketplace.home);
  redirect(appRoutes.marketplace.request(requestId) + "?message=" + encodeURIComponent("Bozza creata. Aggiungi almeno una linea prodotto."));
}

export async function updateMarketplaceRequest(formData: FormData) {
  await requireWorkspaceWriteRole(appRoutes.marketplace.home);
  const requestId = textValue(formData, "request_id");
  const title = textValue(formData, "title");
  const visibilityMode = textValue(formData, "visibility_mode");
  const path = appRoutes.marketplace.request(requestId);

  if (!requestId) redirect(marketplaceError(appRoutes.marketplace.home, "Richiesta non valida."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_1_update_request", {
    p_request_id: requestId,
    p_title: title,
    p_visibility_mode: visibilityMode,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.home);
  redirect(path + "?message=" + encodeURIComponent("Bozza aggiornata."));
}

export async function addMarketplaceRequestLine(formData: FormData) {
  await requireWorkspaceWriteRole(appRoutes.marketplace.home);
  const requestId = textValue(formData, "request_id");
  const path = appRoutes.marketplace.request(requestId);

  if (!requestId) redirect(marketplaceError(appRoutes.marketplace.home, "Richiesta non valida."));

  const line = {
    product_family_key: textValue(formData, "product_family_key"),
    standard_id: optionalText(formData, "standard_id"),
    material_grade_id: optionalText(formData, "material_grade_id"),
    manufacturing_process: optionalText(formData, "manufacturing_process"),
    outer_diameter_mm: optionalText(formData, "outer_diameter_mm"),
    width_mm: optionalText(formData, "width_mm"),
    height_mm: optionalText(formData, "height_mm"),
    thickness_mm: optionalText(formData, "thickness_mm"),
    length_mm: optionalText(formData, "length_mm"),
    quantity: textValue(formData, "quantity"),
    quantity_unit: textValue(formData, "quantity_unit"),
    certification: optionalText(formData, "certification"),
    delivery_country_code: textValue(formData, "delivery_country_code").toUpperCase(),
    delivery_region: optionalText(formData, "delivery_region"),
    requested_delivery_date: optionalText(formData, "requested_delivery_date"),
    notes: optionalText(formData, "notes"),
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_1_add_request_line", {
    p_request_id: requestId,
    p_line: line,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.home);
  redirect(path + "?message=" + encodeURIComponent("Linea prodotto aggiunta."));
}

export async function removeMarketplaceRequestLine(formData: FormData) {
  await requireWorkspaceWriteRole(appRoutes.marketplace.home);
  const requestId = textValue(formData, "request_id");
  const lineId = textValue(formData, "line_id");
  const path = appRoutes.marketplace.request(requestId);

  if (!requestId || !lineId) redirect(marketplaceError(appRoutes.marketplace.home, "Linea non valida."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_1_remove_request_line", {
    p_request_id: requestId,
    p_line_id: lineId,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.home);
  redirect(path + "?message=" + encodeURIComponent("Linea rimossa."));
}

export async function publishMarketplaceRequest(formData: FormData) {
  await requireWorkspaceWriteRole(appRoutes.marketplace.home);
  const requestId = textValue(formData, "request_id");
  const durationDays = Number(textValue(formData, "duration_days"));
  const path = appRoutes.marketplace.request(requestId);

  if (!requestId || ![1, 3, 7, 14, 30].includes(durationDays)) {
    redirect(marketplaceError(path || appRoutes.marketplace.home, "Durata non valida."));
  }

  const closesAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_1_publish_request", {
    p_request_id: requestId,
    p_closes_at: closesAt,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.home);
  redirect(path + "?message=" + encodeURIComponent("Ricerca pubblicata. Il feed supplier arriverà con P5.2."));
}

export async function withdrawMarketplaceRequest(formData: FormData) {
  await requireWorkspaceWriteRole(appRoutes.marketplace.home);
  const requestId = textValue(formData, "request_id");
  const path = appRoutes.marketplace.request(requestId);

  if (!requestId) redirect(marketplaceError(appRoutes.marketplace.home, "Richiesta non valida."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_1_withdraw_request", {
    p_request_id: requestId,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.home);
  redirect(path + "?message=" + encodeURIComponent("Ricerca ritirata."));
}
