"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { marketplaceIssueFromError } from "@/lib/marketplace-readiness";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext, requireWorkspaceWriteRole } from "@/lib/workspace-context";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function marketplaceError(path: string, error: string) {
  const issue = marketplaceIssueFromError(error);
  const separator = path.includes("?") ? "&" : "?";
  return (
    path +
    separator +
    "error=" +
    encodeURIComponent(issue.message) +
    "&blocker=" +
    encodeURIComponent(issue.code)
  );
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
  revalidatePath(appRoutes.marketplace.myRequests);
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
  revalidatePath(appRoutes.marketplace.myRequests);
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
  revalidatePath(appRoutes.marketplace.myRequests);
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
  revalidatePath(appRoutes.marketplace.myRequests);
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
  revalidatePath(appRoutes.marketplace.myRequests);
  redirect(path + "?message=" + encodeURIComponent("Ricerca pubblicata. Il teaser è ora disponibile nel feed supplier P5.2."));
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
  revalidatePath(appRoutes.marketplace.myRequests);
  redirect(path + "?message=" + encodeURIComponent("Ricerca ritirata."));
}

export async function createMarketplaceResponse(formData: FormData) {
  const requestId = textValue(formData, "request_id");
  const path = requestId
    ? appRoutes.marketplace.opportunity(requestId)
    : appRoutes.marketplace.home;
  const context = await requireWorkspaceWriteRole(path);

  if (!requestId) redirect(marketplaceError(path, "Opportunità non valida."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_4_create_response", {
    p_supplier_organization_id: context.organizationId,
    p_request_id: requestId,
    p_response_kind: textValue(formData, "response_kind") || "interest",
    p_message: optionalText(formData, "message"),
    p_valid_until: optionalText(formData, "valid_until"),
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.responses);
  redirect(path + "?message=" + encodeURIComponent("Bozza risposta creata."));
}

export async function updateMarketplaceResponse(formData: FormData) {
  const requestId = textValue(formData, "request_id");
  const responseId = textValue(formData, "response_id");
  const path = requestId
    ? appRoutes.marketplace.opportunity(requestId)
    : appRoutes.marketplace.home;
  const context = await requireWorkspaceWriteRole(path);

  if (!requestId || !responseId) {
    redirect(marketplaceError(path, "Risposta Marketplace non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_4_update_response", {
    p_supplier_organization_id: context.organizationId,
    p_response_id: responseId,
    p_response_kind: textValue(formData, "response_kind") || "interest",
    p_message: optionalText(formData, "message"),
    p_valid_until: optionalText(formData, "valid_until"),
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  redirect(path + "?message=" + encodeURIComponent("Bozza risposta aggiornata."));
}

export async function upsertMarketplaceResponseLine(formData: FormData) {
  const requestId = textValue(formData, "request_id");
  const responseId = textValue(formData, "response_id");
  const requestLineId = textValue(formData, "request_line_id");
  const path = requestId
    ? appRoutes.marketplace.opportunity(requestId)
    : appRoutes.marketplace.home;
  const context = await requireWorkspaceWriteRole(path);

  if (!requestId || !responseId || !requestLineId) {
    redirect(marketplaceError(path, "Linea risposta non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_4_upsert_response_line", {
    p_supplier_organization_id: context.organizationId,
    p_response_id: responseId,
    p_request_line_id: requestLineId,
    p_offered_quantity: optionalNumber(formData, "offered_quantity"),
    p_quantity_unit: optionalText(formData, "quantity_unit"),
    p_unit_price: optionalNumber(formData, "unit_price"),
    p_currency_code: optionalText(formData, "currency_code")?.toUpperCase() ?? null,
    p_lead_time_days: optionalNumber(formData, "lead_time_days"),
    p_offered_delivery_date: optionalText(formData, "offered_delivery_date"),
    p_notes: optionalText(formData, "notes"),
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  redirect(path + "?message=" + encodeURIComponent("Linea risposta salvata."));
}

export async function removeMarketplaceResponseLine(formData: FormData) {
  const requestId = textValue(formData, "request_id");
  const responseId = textValue(formData, "response_id");
  const requestLineId = textValue(formData, "request_line_id");
  const path = requestId
    ? appRoutes.marketplace.opportunity(requestId)
    : appRoutes.marketplace.home;
  const context = await requireWorkspaceWriteRole(path);

  if (!requestId || !responseId || !requestLineId) {
    redirect(marketplaceError(path, "Linea risposta non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_4_remove_response_line", {
    p_supplier_organization_id: context.organizationId,
    p_response_id: responseId,
    p_request_line_id: requestLineId,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  redirect(path + "?message=" + encodeURIComponent("Linea risposta rimossa."));
}

export async function submitMarketplaceResponse(formData: FormData) {
  const requestId = textValue(formData, "request_id");
  const responseId = textValue(formData, "response_id");
  const path = requestId
    ? appRoutes.marketplace.opportunity(requestId)
    : appRoutes.marketplace.home;
  const context = await requireWorkspaceWriteRole(path);

  if (!requestId || !responseId) {
    redirect(marketplaceError(path, "Risposta Marketplace non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_4_submit_response", {
    p_supplier_organization_id: context.organizationId,
    p_response_id: responseId,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.responses);
  redirect(path + "?message=" + encodeURIComponent("Risposta inviata al buyer."));
}

export async function withdrawMarketplaceResponse(formData: FormData) {
  const requestId = textValue(formData, "request_id");
  const responseId = textValue(formData, "response_id");
  const path = requestId
    ? appRoutes.marketplace.opportunity(requestId)
    : appRoutes.marketplace.home;
  const context = await requireWorkspaceWriteRole(path);

  if (!requestId || !responseId) {
    redirect(marketplaceError(path, "Risposta Marketplace non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_4_withdraw_response", {
    p_supplier_organization_id: context.organizationId,
    p_response_id: responseId,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.responses);
  redirect(path + "?message=" + encodeURIComponent("Risposta ritirata."));
}

export async function transitionMarketplaceBuyerResponse(formData: FormData) {
  const responseId = textValue(formData, "response_id");
  const action = textValue(formData, "action");
  const path = responseId
    ? appRoutes.marketplace.response(responseId)
    : appRoutes.marketplace.responses;
  const context = await requireWorkspaceWriteRole(path);

  if (!responseId || !["acknowledge", "decline", "close"].includes(action)) {
    redirect(marketplaceError(path, "Azione buyer non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_4_buyer_transition", {
    p_buyer_organization_id: context.organizationId,
    p_response_id: responseId,
    p_action: action,
  });

  if (error) redirect(marketplaceError(path, error.message));
  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.responses);
  revalidatePath(appRoutes.marketplace.myRequests);

  const label =
    action === "acknowledge"
      ? "Risposta presa in carico."
      : action === "decline"
        ? "Risposta declinata."
        : "Risposta chiusa.";
  redirect(path + "?message=" + encodeURIComponent(label));
}

export async function openMarketplaceNotification(formData: FormData) {
  const notificationId = textValue(formData, "notification_id");
  const requestId = textValue(formData, "request_id");
  const context = await getWorkspaceContext();
  const fallback = appRoutes.marketplace.notifications;

  if (!notificationId || !requestId) {
    redirect(marketplaceError(fallback, "Notifica Marketplace non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_5_notification_action", {
    p_recipient_organization_id: context.organizationId,
    p_notification_id: notificationId,
    p_action: "read",
  });

  if (error) redirect(marketplaceError(fallback, error.message));

  // P5.6B soft telemetry is best-effort and must never block the canonical
  // notification/read flow. The RPC records only active-pilot first opens.
  await supabase.rpc("p5_6b_record_notification_open", {
    p_organization_id: context.organizationId,
    p_notification_id: notificationId,
    p_request_id: requestId,
  });

  revalidatePath(fallback);
  redirect(appRoutes.marketplace.opportunity(requestId));
}

export async function dismissMarketplaceNotification(formData: FormData) {
  const notificationId = textValue(formData, "notification_id");
  const context = await getWorkspaceContext();
  const path = appRoutes.marketplace.notifications;

  if (!notificationId) {
    redirect(marketplaceError(path, "Notifica Marketplace non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_5_notification_action", {
    p_recipient_organization_id: context.organizationId,
    p_notification_id: notificationId,
    p_action: "dismiss",
  });

  if (error) redirect(marketplaceError(path, error.message));

  revalidatePath(path);
  revalidatePath(appRoutes.marketplace.home);
  redirect(path + "?message=" + encodeURIComponent("Opportunità rimossa da Per te."));
}
