"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  buildRfqh3Email,
  buildRfqh3InviteUrl,
  buildRfqh3ReminderEmail,
  createRfqh3DispatchSecurity,
  createRfqh3ReminderIdempotencyKey,
  type Rfqh3EmailLine,
} from "@/lib/rfqh3-dispatch";
import { trackServerProductEvent } from "@/lib/product-analytics-events.server";
import { createClient } from "@/lib/supabase/server";

export type SupplierCandidate = {
  identity_key: string;
  source:
    | "recent"
    | "private_contact"
    | "private_company"
    | "network_contact"
    | "network_company"
    | "platform_organization";
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  country_code: string | null;
  delivery_channel: "email" | "platform" | "both";
  supplier_company_id: string | null;
  supplier_contact_id: string | null;
  supplier_network_company_id: string | null;
  supplier_network_contact_id: string | null;
  supplier_organization_id: string | null;
  last_used_at: string | null;
  preferred: boolean;
};

export type SupplierCandidateResult = {
  ok: boolean;
  networkEnabled?: boolean;
  candidates?: SupplierCandidate[];
  error?: string;
};

type AddSupplierInput = {
  rfqId: string;
  identitySource?: SupplierCandidate["source"] | "manual";
  supplierName?: string | null;
  supplierEmail?: string | null;
  supplierCompanyId?: string | null;
  supplierContactId?: string | null;
  supplierNetworkCompanyId?: string | null;
  supplierNetworkContactId?: string | null;
  supplierOrganizationId?: string | null;
};

export async function searchBuyerRfqSuppliers(
  rfqId: string,
  query = "",
): Promise<SupplierCandidateResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per cercare i fornitori." };
  }

  const cleanRfqId = rfqId.trim();
  if (!cleanRfqId) return { ok: false, error: "RFQ non valido." };

  const { data, error } = await supabase.rpc("rfqh2_supplier_candidates", {
    p_rfq_id: cleanRfqId,
    p_query: query.trim() || null,
    p_limit: 40,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("RFQH2 supplier candidate search failed:", error?.message);
    return { ok: false, error: "Non è stato possibile cercare i fornitori." };
  }

  const payload = data as {
    network_enabled?: unknown;
    candidates?: unknown;
  };

  const rawCandidates = Array.isArray(payload.candidates)
    ? payload.candidates.filter(
        (candidate): candidate is Omit<SupplierCandidate, "preferred"> =>
          Boolean(
            candidate &&
              typeof candidate === "object" &&
              !Array.isArray(candidate) &&
              typeof (candidate as SupplierCandidate).identity_key === "string",
          ),
      )
    : [];

  const networkCompanyIds = Array.from(
    new Set(
      rawCandidates
        .map((candidate) => candidate.supplier_network_company_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let preferredNetworkIds = new Set<string>();
  let preferredIdentityKeys = new Set<string>();

  const { data: campaign } = await supabase
    .from("buyer_rfq_campaigns")
    .select("organization_id")
    .eq("id", cleanRfqId)
    .maybeSingle();

  if (campaign?.organization_id) {
    const identityKeys = rawCandidates.map((candidate) => candidate.identity_key);

    const [savedResult, profileResult] = await Promise.all([
      networkCompanyIds.length
        ? supabase
            .from("network_saved_companies")
            .select("network_company_id")
            .eq("organization_id", campaign.organization_id)
            .eq("user_id", authData.user.id)
            .in("network_company_id", networkCompanyIds)
        : Promise.resolve({ data: [], error: null }),
      identityKeys.length
        ? supabase
            .from("buyer_supplier_profiles")
            .select("identity_key")
            .eq("organization_id", campaign.organization_id)
            .eq("owner_user_id", authData.user.id)
            .eq("preferred", true)
            .in("identity_key", identityKeys)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (savedResult.error) {
      console.error("RFQH2 Network saved supplier lookup failed:", savedResult.error.message);
    } else {
      preferredNetworkIds = new Set(
        (savedResult.data ?? []).map((row) => row.network_company_id),
      );
    }

    if (profileResult.error) {
      console.error("RFQH11 preferred supplier lookup failed:", profileResult.error.message);
    } else {
      preferredIdentityKeys = new Set(
        (profileResult.data ?? []).map((row) => row.identity_key),
      );
    }
  }

  const candidates: SupplierCandidate[] = rawCandidates.map((candidate) => ({
    ...candidate,
    preferred: Boolean(
      preferredIdentityKeys.has(candidate.identity_key) ||
        (candidate.supplier_network_company_id &&
          preferredNetworkIds.has(candidate.supplier_network_company_id)),
    ),
  }));

  return {
    ok: true,
    networkEnabled: payload.network_enabled === true,
    candidates,
  };
}

export async function addSupplierToBuyerRfq(
  input: AddSupplierInput,
): Promise<{ ok: boolean; supplierId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per modificare il RFQ." };
  }

  const rfqId = input.rfqId.trim();
  const supplierName = input.supplierName?.trim() || null;
  const supplierEmail = input.supplierEmail?.trim() || null;
  const hasResolvedIdentity = Boolean(
    input.supplierCompanyId ||
      input.supplierContactId ||
      input.supplierNetworkCompanyId ||
      input.supplierNetworkContactId ||
      input.supplierOrganizationId,
  );

  if (!rfqId) return { ok: false, error: "RFQ non valido." };
  if (!supplierEmail && !hasResolvedIdentity) {
    return { ok: false, error: "Inserisci l'email del fornitore." };
  }

  const { data, error } = await supabase.rpc("rfqh2_add_supplier", {
    p_rfq_id: rfqId,
    p_identity_source: input.identitySource ?? "manual",
    p_supplier_name: supplierName,
    p_supplier_email: supplierEmail,
    p_supplier_company_id: input.supplierCompanyId ?? null,
    p_supplier_contact_id: input.supplierContactId ?? null,
    p_supplier_network_company_id: input.supplierNetworkCompanyId ?? null,
    p_supplier_network_contact_id: input.supplierNetworkContactId ?? null,
    p_supplier_organization_id: input.supplierOrganizationId ?? null,
  });

  if (error) {
    console.error("RFQH2 add supplier failed:", error.message);
    return {
      ok: false,
      error: error.message.includes("already added")
        ? "Questo fornitore è già presente nel RFQ."
        : error.message.includes("Network access required")
          ? "Il Network non è incluso nel piano attivo di questa azienda."
          : error.message.includes("no usable email")
            ? "Questo fornitore non ha ancora un canale email o un account collegato utilizzabile."
            : error.message.includes("invalid")
              ? "L'indirizzo email del fornitore non è valido."
              : "Non è stato possibile aggiungere il fornitore.",
    };
  }

  const supplierId = typeof data === "string" ? data : null;
  if (!supplierId) {
    return { ok: false, error: "Fornitore aggiunto senza identificativo." };
  }

  revalidatePath("/marketplace/rfq-hub");
  revalidatePath("/marketplace/rfq-hub/" + rfqId);
  return { ok: true, supplierId };
}


type LaunchBuyerRfqInput = {
  rfqId: string;
  dueAt?: string | null;
  buyerMessage?: string | null;
};

async function loadRfqh3EmailContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rfqId: string,
) {
  const { data: campaign } = await supabase
    .from("buyer_rfq_campaigns")
    .select("id,title,status,organization_id,source_distinta_id,due_at,buyer_message")
    .eq("id", rfqId)
    .maybeSingle();

  if (!campaign) return null;

  const [{ data: organization }, { data: suppliers }, { data: lines }] = await Promise.all([
    supabase
      .from("organizations")
      .select("name")
      .eq("id", campaign.organization_id)
      .maybeSingle(),
    supabase
      .from("buyer_rfq_suppliers")
      .select("id,supplier_name,supplier_email_normalized,status")
      .eq("rfq_id", rfqId)
      .order("created_at", { ascending: true }),
    supabase
      .from("buyer_distinta_lines")
      .select("line_position,description,standard_code,grade_code,finish_code,quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes,note")
      .eq("distinta_id", campaign.source_distinta_id)
      .order("line_position", { ascending: true }),
  ]);

  return {
    campaign,
    organizationName: organization?.name || "Buyer Smart Steel Sales",
    suppliers: suppliers ?? [],
    lines: (lines ?? []).map((line) => ({
      position: Number(line.line_position),
      description: line.description,
      standardCode: line.standard_code,
      gradeCode: line.grade_code,
      finishCode: line.finish_code,
      quantityMode: line.quantity_mode,
      quantity: Number(line.quantity),
      barLengthM: line.bar_length_m === null ? null : Number(line.bar_length_m),
      weightKgM: Number(line.weight_kg_m),
      lineMeters: Number(line.line_meters),
      lineTonnes: Number(line.line_tonnes),
      note: line.note,
    })) satisfies Rfqh3EmailLine[],
  };
}

async function sendRfqh3Email(input: {
  apiKey: string;
  from: string;
  replyTo: string | null;
  recipient: string;
  idempotencyKey: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + input.apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.recipient],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo ? [input.replyTo] : undefined,
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };

  if (!response.ok || !body.id) {
    throw new Error(body.message || "Resend provider error");
  }

  return body.id;
}

export async function launchBuyerRfq(
  input: LaunchBuyerRfqInput,
): Promise<{ ok: boolean; sentCount?: number; failedCount?: number; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) return { ok: false, error: "Accedi per inviare la RFQ." };

  const apiKey = process.env.RESEND_API_KEY;
  const inviteSecret = process.env.RFQ_INVITE_SECRET;
  if (!apiKey || !inviteSecret) {
    return {
      ok: false,
      error: "Il canale email RFQ non è ancora configurato sul server.",
    };
  }

  const context = await loadRfqh3EmailContext(supabase, input.rfqId.trim());
  if (!context) return { ok: false, error: "RFQ non trovata." };
  if (!["draft", "ready"].includes(context.campaign.status)) {
    return { ok: false, error: "Questa RFQ è già stata avviata." };
  }
  if (!context.suppliers.length) {
    return { ok: false, error: "Aggiungi almeno un fornitore prima dell'invio." };
  }
  if (context.suppliers.some((supplier) => !supplier.supplier_email_normalized)) {
    return {
      ok: false,
      error: "Tutti i fornitori devono avere un indirizzo email utilizzabile prima del launch.",
    };
  }

  const dueAt = input.dueAt?.trim() || null;
  const buyerMessage = input.buyerMessage?.trim() || null;

  const dispatches = context.suppliers.map((supplier) => {
    const dispatchId = randomUUID();
    const security = createRfqh3DispatchSecurity({
      dispatchId,
      rfqId: context.campaign.id,
      supplierId: supplier.id,
      attemptVersion: 1,
    });
    return { supplier, dispatchId, ...security };
  });

  const { error: launchError } = await supabase.rpc("rfqh3_launch_campaign", {
    p_rfq_id: context.campaign.id,
    p_due_at: dueAt,
    p_buyer_message: buyerMessage,
    p_dispatches: dispatches.map((dispatch) => ({
      dispatch_id: dispatch.dispatchId,
      supplier_id: dispatch.supplier.id,
      token_hash: dispatch.tokenHash,
      idempotency_key: dispatch.idempotencyKey,
    })),
  });

  if (launchError) {
    console.error("RFQH3 launch failed:", launchError.message);
    return {
      ok: false,
      error: launchError.message.includes("suppressed")
        ? "Uno o più indirizzi sono bloccati per bounce o complaint."
        : launchError.message.includes("limit reached")
          ? "Limite temporaneo di invio RFQ raggiunto. Riprova più tardi."
          : "Non è stato possibile avviare la RFQ.",
    };
  }

  const from =
    process.env.RFQ_EMAIL_FROM || "Smart Steel Sales <rfq@smartsteelsales.com>";
  let sentCount = 0;
  let failedCount = 0;

  for (const dispatch of dispatches) {
    const inviteUrl = buildRfqh3InviteUrl(dispatch.token);
    const email = buildRfqh3Email({
      buyerOrganizationName: context.organizationName,
      supplierName: dispatch.supplier.supplier_name,
      title: context.campaign.title,
      buyerMessage,
      dueAt,
      inviteUrl,
      lines: context.lines,
    });

    try {
      const providerMessageId = await sendRfqh3Email({
        apiKey,
        from,
        replyTo: user.email ?? null,
        recipient: dispatch.supplier.supplier_email_normalized!,
        idempotencyKey: dispatch.idempotencyKey,
        ...email,
      });

      await supabase.rpc("rfqh3_mark_dispatch_result", {
        p_dispatch_id: dispatch.dispatchId,
        p_success: true,
        p_provider_message_id: providerMessageId,
        p_error: null,
      });
      sentCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider email error";
      await supabase.rpc("rfqh3_mark_dispatch_result", {
        p_dispatch_id: dispatch.dispatchId,
        p_success: false,
        p_provider_message_id: null,
        p_error: message,
      });
      failedCount += 1;
    }
  }

  revalidatePath("/marketplace/rfq-hub");
  revalidatePath("/marketplace/rfq-hub/" + context.campaign.id);

  if (sentCount > 0) {
    await trackServerProductEvent("rfq_dispatch_launch", {
      supplier_count: dispatches.length,
      sent_count: sentCount,
      failed_count: failedCount,
    });
  }

  return { ok: sentCount > 0, sentCount, failedCount };
}

export async function retryFailedBuyerRfq(
  rfqId: string,
): Promise<{ ok: boolean; sentCount?: number; failedCount?: number; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) return { ok: false, error: "Accedi per riprovare gli invii." };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.RFQ_INVITE_SECRET) {
    return { ok: false, error: "Il canale email RFQ non è configurato." };
  }

  const context = await loadRfqh3EmailContext(supabase, rfqId.trim());
  if (!context) return { ok: false, error: "RFQ non trovata." };

  const { data: failed } = await supabase
    .from("buyer_rfq_dispatches")
    .select("id,supplier_id,attempt_count,status")
    .eq("rfq_id", context.campaign.id)
    .eq("status", "failed");

  const failedRows = failed ?? [];
  if (!failedRows.length) return { ok: false, error: "Non ci sono invii falliti da riprovare." };

  const supplierById = new Map(context.suppliers.map((supplier) => [supplier.id, supplier]));
  const from =
    process.env.RFQ_EMAIL_FROM || "Smart Steel Sales <rfq@smartsteelsales.com>";
  let sentCount = 0;
  let failedCount = 0;

  for (const dispatch of failedRows) {
    const supplier = supplierById.get(dispatch.supplier_id);
    if (!supplier?.supplier_email_normalized) {
      failedCount += 1;
      continue;
    }

    const version = Number(dispatch.attempt_count) + 1;
    const security = createRfqh3DispatchSecurity({
      dispatchId: dispatch.id,
      rfqId: context.campaign.id,
      supplierId: supplier.id,
      attemptVersion: version,
    });

    const { error: prepareError } = await supabase.rpc("rfqh3_prepare_retry", {
      p_dispatch_id: dispatch.id,
      p_token_hash: security.tokenHash,
      p_idempotency_key: security.idempotencyKey,
    });

    if (prepareError) {
      failedCount += 1;
      continue;
    }

    const email = buildRfqh3Email({
      buyerOrganizationName: context.organizationName,
      supplierName: supplier.supplier_name,
      title: context.campaign.title,
      buyerMessage: context.campaign.buyer_message,
      dueAt: context.campaign.due_at,
      inviteUrl: buildRfqh3InviteUrl(security.token),
      lines: context.lines,
    });

    try {
      const providerMessageId = await sendRfqh3Email({
        apiKey,
        from,
        replyTo: user.email ?? null,
        recipient: supplier.supplier_email_normalized,
        idempotencyKey: security.idempotencyKey,
        ...email,
      });

      await supabase.rpc("rfqh3_mark_dispatch_result", {
        p_dispatch_id: dispatch.id,
        p_success: true,
        p_provider_message_id: providerMessageId,
        p_error: null,
      });
      sentCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider email error";
      await supabase.rpc("rfqh3_mark_dispatch_result", {
        p_dispatch_id: dispatch.id,
        p_success: false,
        p_provider_message_id: null,
        p_error: message,
      });
      failedCount += 1;
    }
  }

  revalidatePath("/marketplace/rfq-hub/" + context.campaign.id);
  return { ok: sentCount > 0, sentCount, failedCount };
}


export async function sendBuyerRfqReminders(
  rfqId: string,
): Promise<{
  ok: boolean;
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) return { ok: false, error: "Accedi per inviare i promemoria." };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.RFQ_INVITE_SECRET) {
    return { ok: false, error: "Il canale email RFQ non è configurato." };
  }

  const context = await loadRfqh3EmailContext(supabase, rfqId.trim());
  if (!context) return { ok: false, error: "RFQ non trovata." };
  if (!["launched", "collecting"].includes(context.campaign.status)) {
    return { ok: false, error: "Questa RFQ non è aperta ai promemoria." };
  }

  const { data: dispatches, error: dispatchError } = await supabase
    .from("buyer_rfq_dispatches")
    .select("id,supplier_id,attempt_count,reminder_count,status")
    .eq("rfq_id", context.campaign.id)
    .order("created_at", { ascending: true });

  if (dispatchError) {
    console.error("RFQH3 reminder dispatch lookup failed:", dispatchError.message);
    return { ok: false, error: "Non è stato possibile preparare i promemoria." };
  }

  const supplierById = new Map(
    context.suppliers.map((supplier) => [supplier.id, supplier]),
  );
  const from =
    process.env.RFQ_EMAIL_FROM || "Smart Steel Sales <rfq@smartsteelsales.com>";

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const dispatch of dispatches ?? []) {
    const supplier = supplierById.get(dispatch.supplier_id);
    if (!supplier?.supplier_email_normalized) {
      skippedCount += 1;
      continue;
    }

    const reminderSequence = Number(dispatch.reminder_count) + 1;
    const idempotencyKey = createRfqh3ReminderIdempotencyKey(
      dispatch.id,
      reminderSequence,
    );

    const { data: prepared, error: prepareError } = await supabase.rpc(
      "rfqh3_prepare_reminder",
      {
        p_dispatch_id: dispatch.id,
        p_idempotency_key: idempotencyKey,
      },
    );

    if (prepareError) {
      skippedCount += 1;
      continue;
    }

    const preparedPayload =
      prepared && typeof prepared === "object" && !Array.isArray(prepared)
        ? (prepared as {
            attempt_count?: unknown;
            reminder_sequence?: unknown;
          })
        : null;

    const attemptVersion = Number(
      preparedPayload?.attempt_count ?? dispatch.attempt_count,
    );
    const preparedSequence = Number(
      preparedPayload?.reminder_sequence ?? reminderSequence,
    );

    if (!Number.isFinite(attemptVersion) || attemptVersion < 1) {
      skippedCount += 1;
      continue;
    }

    const security = createRfqh3DispatchSecurity({
      dispatchId: dispatch.id,
      rfqId: context.campaign.id,
      supplierId: supplier.id,
      attemptVersion,
    });

    const email = buildRfqh3ReminderEmail({
      buyerOrganizationName: context.organizationName,
      supplierName: supplier.supplier_name,
      title: context.campaign.title,
      dueAt: context.campaign.due_at,
      inviteUrl: buildRfqh3InviteUrl(security.token),
      reminderSequence: preparedSequence,
    });

    try {
      const providerMessageId = await sendRfqh3Email({
        apiKey,
        from,
        replyTo: user.email ?? null,
        recipient: supplier.supplier_email_normalized,
        idempotencyKey,
        ...email,
      });

      const { error: markError } = await supabase.rpc(
        "rfqh3_mark_reminder_result",
        {
          p_dispatch_id: dispatch.id,
          p_idempotency_key: idempotencyKey,
          p_success: true,
          p_provider_message_id: providerMessageId,
          p_error: null,
        },
      );

      if (markError) {
        console.error("RFQH3 reminder success ledger failed:", markError.message);
        failedCount += 1;
        continue;
      }

      sentCount += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Provider email error";

      await supabase.rpc("rfqh3_mark_reminder_result", {
        p_dispatch_id: dispatch.id,
        p_idempotency_key: idempotencyKey,
        p_success: false,
        p_provider_message_id: null,
        p_error: message,
      });
      failedCount += 1;
    }
  }

  revalidatePath("/marketplace/rfq-hub/" + context.campaign.id);

  return {
    ok: true,
    sentCount,
    failedCount,
    skippedCount,
  };
}
