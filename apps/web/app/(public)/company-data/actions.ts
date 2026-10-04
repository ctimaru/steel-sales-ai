"use server";

import { createClient } from "@/lib/supabase/server";

export type CompanyDataRequestState = {
  status: "idle" | "success" | "invalid" | "error";
  message: string | null;
  requestId: string | null;
};

export const initialCompanyDataRequestState: CompanyDataRequestState = {
  status: "idle",
  message: null,
  requestId: null,
};

export async function submitCompanyDataRequest(
  _previous: CompanyDataRequestState,
  formData: FormData,
): Promise<CompanyDataRequestState> {
  const requestType = String(formData.get("request_type") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const countryCode = String(formData.get("country_code") ?? "").trim().toUpperCase();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const requestText = String(formData.get("request_text") ?? "").trim();
  const honeypot = String(formData.get("website") ?? "").trim();

  if (honeypot) {
    return { status: "success", message: "Richiesta ricevuta.", requestId: null };
  }

  if (
    !["correction", "removal", "privacy_objection", "source_question"].includes(requestType) ||
    companyName.length < 2 ||
    companyName.length > 255 ||
    (countryCode && !/^[A-Z]{2}$/.test(countryCode)) ||
    contactEmail.length < 5 ||
    contactEmail.length > 320 ||
    requestText.length < 10 ||
    requestText.length > 4000 ||
    (sourceUrl && !/^https?:\/\//i.test(sourceUrl))
  ) {
    return {
      status: "invalid",
      message: "Controlla i campi richiesti e riprova.",
      requestId: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pa1_5_submit_company_data_request", {
    p_request_type: requestType,
    p_company_name: companyName,
    p_country_code: countryCode || null,
    p_contact_email: contactEmail,
    p_source_url: sourceUrl || null,
    p_request_text: requestText,
  });

  if (error || !data || typeof data !== "object") {
    return {
      status: "error",
      message: "Non è stato possibile registrare la richiesta. Riprova più tardi.",
      requestId: null,
    };
  }

  const payload = data as { request_id?: string };
  return {
    status: "success",
    message: "Richiesta ricevuta. Sarà verificata dal team di governance dati.",
    requestId: payload.request_id ?? null,
  };
}
