"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  PENDING_SIGNUP_EMAIL_COOKIE,
  pendingSignupEmailCookieOptions,
} from "@/lib/auth-email-verification";
import { trackServerProductEvent } from "@/lib/product-analytics-events.server";
import { createClient } from "@/lib/supabase/server";
import { feedbackPath } from "@/lib/user-facing-error";

const COMPANY_TYPES = new Set([
  "producer",
  "trader_distributor",
  "processor_service_provider",
  "end_user",
]);

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function saveAndSubmitCompanyRegistration(formData: FormData) {
  const claimRef = field(formData, "claim_ref").toLowerCase();
  const validClaimRef = /^[0-9a-f]{64}$/.test(claimRef);
  const registerPath = validClaimRef
    ? "/register?claim_ref=" + encodeURIComponent(claimRef)
    : "/register";

  if (claimRef && !validClaimRef) {
    redirect(
      "/register?error=" +
        encodeURIComponent("Il riferimento di claim non è valido. Cerca nuovamente l’azienda."),
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    redirect(
      "/login?error=" +
        encodeURIComponent("Accedi prima di registrare la tua azienda") +
        "&next=" +
        encodeURIComponent(registerPath),
    );
  }

  if (!user.email_confirmed_at) {
    if (user.email) {
      const cookieStore = await cookies();
      cookieStore.set(
        PENDING_SIGNUP_EMAIL_COOKIE,
        user.email.toLowerCase(),
        pendingSignupEmailCookieOptions,
      );
    }
    redirect(
      "/verify-email?source=registration&next=" +
        encodeURIComponent(registerPath),
    );
  }

  let legalName = field(formData, "legal_name");
  let tradingName = field(formData, "trading_name");
  let countryCode = field(formData, "country_code").toUpperCase();
  const vatId = field(formData, "vat_id");
  const registrationId = field(formData, "registration_id");
  const websiteUrl = field(formData, "website_url");
  const primaryCompanyType = field(formData, "primary_company_type");
  const contactName = field(formData, "contact_name");
  const contactPhone = field(formData, "contact_phone");
  const shortDescription = field(formData, "short_description");
  const privacyAcknowledged = formData.get("privacy_acknowledged") === "on";
  const termsAccepted = formData.get("terms_accepted") === "on";
  const secondaryCompanyTypes = formData
    .getAll("secondary_company_types")
    .map((value) => String(value))
    .filter((value) => COMPANY_TYPES.has(value) && value !== primaryCompanyType);

  if (validClaimRef) {
    const { data: claimContextData, error: claimContextError } = await supabase.rpc(
      "pa1_4_company_claim_context",
      { p_claim_ref: claimRef },
    );

    const claimContext = (claimContextData ?? {}) as {
      ok?: boolean;
      legal_name?: string;
      trading_name?: string | null;
      country_code?: string;
      claim_state?: string;
      can_start_registration?: boolean;
    };

    if (
      claimContextError ||
      claimContext.ok !== true ||
      claimContext.can_start_registration !== true ||
      claimContext.claim_state !== "claimable" ||
      !claimContext.legal_name ||
      !claimContext.country_code
    ) {
      redirect(
        feedbackPath(
          registerPath,
          claimContextError ?? { code: "23505" },
          "Questo profilo non è più disponibile per il claim. Cerca nuovamente l’azienda.",
        ),
      );
    }

    legalName = claimContext.legal_name;
    tradingName = tradingName || claimContext.trading_name || "";
    countryCode = claimContext.country_code.toUpperCase();
  }

  if (
    !legalName ||
    !/^[A-Z]{2}$/.test(countryCode) ||
    !COMPANY_TYPES.has(primaryCompanyType) ||
    !contactName ||
    !privacyAcknowledged ||
    !termsAccepted
  ) {
    redirect(
      registerPath +
        (registerPath.includes("?") ? "&" : "?") +
        "error=" +
        encodeURIComponent("Completa i campi obbligatori prima di inviare"),
    );
  }

  const { error: legalAcceptanceError } = await supabase.rpc(
    "lr5_record_legal_acceptance",
    {
      p_privacy_acknowledged: true,
      p_terms_accepted: true,
      p_source: "registration",
    },
  );

  if (legalAcceptanceError) {
    redirect(
      registerPath +
        (registerPath.includes("?") ? "&" : "?") +
        "error=" +
        encodeURIComponent(
          "Non è stato possibile registrare Informativa privacy e Termini d’uso. Riprova.",
        ),
    );
  }

  const payload = {
    legal_name: legalName,
    trading_name: tradingName || null,
    country_code: countryCode,
    vat_id: vatId || null,
    registration_id: registrationId || null,
    website_url: websiteUrl || null,
    primary_company_type: primaryCompanyType,
    secondary_company_types: secondaryCompanyTypes,
    contact_name: contactName,
    contact_phone: contactPhone || null,
    short_description: shortDescription || null,
  };

  const { data: existing } = await supabase
    .from("company_registration_applications")
    .select("id,application_status")
    .in("application_status", ["draft", "needs_information"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let applicationId = existing?.id ?? null;

  if (applicationId) {
    const { error: updateError } = await supabase
      .from("company_registration_applications")
      .update(payload)
      .eq("id", applicationId);

    if (updateError) {
      redirect(
        feedbackPath(
          registerPath,
          updateError,
          "Non è stato possibile aggiornare la richiesta. Riprova.",
        ),
      );
    }
  } else {
    const { data: created, error: createError } = await supabase
      .from("company_registration_applications")
      .insert(payload)
      .select("id")
      .single();

    if (createError || !created) {
      redirect(
        feedbackPath(
          registerPath,
          createError,
          "Non è stato possibile creare la richiesta. Riprova.",
        ),
      );
    }

    applicationId = created.id;
  }

  if (validClaimRef && applicationId) {
    const { error: bindError } = await supabase.rpc(
      "pa1_4_bind_registration_claim",
      {
        p_application_id: applicationId,
        p_claim_ref: claimRef,
      },
    );

    if (bindError) {
      redirect(
        feedbackPath(
          registerPath,
          bindError,
          "Il profilo selezionato non può più essere collegato a questa registrazione. Cerca nuovamente l’azienda.",
        ),
      );
    }
  }

  const { error: submitError } = await supabase.rpc("p0a_submit_registration_application", {
    p_application_id: applicationId,
  });

  if (submitError) {
    redirect(
      feedbackPath(
        registerPath,
        submitError,
        "La richiesta è stata salvata ma non inviata. Puoi riprovare senza ricompilare i dati.",
      ),
    );
  }

  await trackServerProductEvent("registration_submit", {
    claim: validClaimRef,
    company_type: primaryCompanyType,
  });

  redirect("/registration/status?submitted=1");
}

export async function logoutRegistration() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SIGNUP_EMAIL_COOKIE);
  redirect("/login");
}



export async function restartRejectedRegistration(formData: FormData) {
  const applicationId = field(formData, "application_id");
  if (!applicationId) {
    redirect(
      "/registration/status?error=" +
        encodeURIComponent("Richiesta non valida.") +
        "&error_code=validation",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hp12_reapply_registration", {
    p_application_id: applicationId,
  });

  if (error) {
    redirect(
      feedbackPath(
        "/registration/status",
        error,
        "Non è possibile riaprire automaticamente questa registrazione. Aggiorna la pagina o contatta il referente Smart Steel Sales.",
      ),
    );
  }

  const payload = (data ?? {}) as {
    application_id?: string;
    status?: string;
  };

  if (!payload.application_id) {
    redirect(
      "/registration/status?error=" +
        encodeURIComponent(
          "La nuova bozza non è stata creata. Aggiorna la pagina e riprova.",
        ) +
        "&error_code=operation_failed&retry=1",
    );
  }

  redirect(
    "/register?message=" +
      encodeURIComponent(
        payload.status === "draft"
          ? "Nuova bozza creata dai dati della richiesta precedente. Correggi le informazioni e inviala nuovamente."
          : "Esiste già una pratica aperta. Continua da quella richiesta.",
      ),
  );
}
