"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  PENDING_SIGNUP_EMAIL_COOKIE,
  pendingSignupEmailCookieOptions,
} from "@/lib/auth-email-verification";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    redirect("/login?error=Accedi%20prima%20di%20registrare%20la%20tua%20azienda");
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
    redirect("/verify-email?source=registration");
  }

  const legalName = field(formData, "legal_name");
  const tradingName = field(formData, "trading_name");
  const countryCode = field(formData, "country_code").toUpperCase();
  const vatId = field(formData, "vat_id");
  const registrationId = field(formData, "registration_id");
  const websiteUrl = field(formData, "website_url");
  const primaryCompanyType = field(formData, "primary_company_type");
  const contactName = field(formData, "contact_name");
  const contactPhone = field(formData, "contact_phone");
  const shortDescription = field(formData, "short_description");
  const secondaryCompanyTypes = formData
    .getAll("secondary_company_types")
    .map((value) => String(value))
    .filter((value) => COMPANY_TYPES.has(value) && value !== primaryCompanyType);

  if (
    !legalName ||
    !/^[A-Z]{2}$/.test(countryCode) ||
    !COMPANY_TYPES.has(primaryCompanyType) ||
    !contactName
  ) {
    redirect("/register?error=Completa%20i%20campi%20obbligatori%20prima%20di%20inviare");
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
      redirect(`/register?error=${encodeURIComponent("Non è stato possibile aggiornare la richiesta.")}`);
    }
  } else {
    const { data: created, error: createError } = await supabase
      .from("company_registration_applications")
      .insert(payload)
      .select("id")
      .single();

    if (createError || !created) {
      redirect(`/register?error=${encodeURIComponent("Non è stato possibile creare la richiesta.")}`);
    }

    applicationId = created.id;
  }

  const { error: submitError } = await supabase.rpc("p0a_submit_registration_application", {
    p_application_id: applicationId,
  });

  if (submitError) {
    redirect(`/register?error=${encodeURIComponent("La richiesta è stata salvata ma non inviata. Riprova.")}`);
  }

  redirect("/registration/status?submitted=1");
}

export async function logoutRegistration() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SIGNUP_EMAIL_COOKIE);
  redirect("/login");
}

