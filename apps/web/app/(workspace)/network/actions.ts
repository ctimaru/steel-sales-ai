"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordPilotUsageEvent } from "@/app/(workspace)/telemetry/actions";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin, requireWorkspaceWriteRole } from "@/lib/workspace-context";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function requestNetworkClaim(formData: FormData) {
  const context = await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const note = textValue(formData, "note");
  const authorityConfirmed = textValue(formData, "authority_confirmed") === "true";

  if (!companyId) redirect("/network?error=Claim%20non%20valido");
  if (!authorityConfirmed) {
    redirect(
      "/network/" +
        companyId +
        "/claim?error=" +
        encodeURIComponent("Conferma di essere autorizzato a rappresentare l'azienda."),
    );
  }
  if (note.length > 2000) {
    redirect(
      "/network/" +
        companyId +
        "/claim?error=" +
        encodeURIComponent("La nota non può superare 2000 caratteri."),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_6_request_company_claim", {
    p_network_company_id: companyId,
    p_organization_id: context.organizationId,
    p_note: note || "Requested from HP5 claim experience",
  });

  if (error) {
    redirect(
      "/network/" +
        companyId +
        "/claim?error=" +
        encodeURIComponent(error.message),
    );
  }

  const result = (data ?? {}) as {
    proof_status?: string;
    proof_method?: string;
    shared_company_domain?: boolean;
  };

  const message =
    result.proof_status === "verified"
      ? "Richiesta inviata. Ownership confermata tramite email aziendale; resta l'approvazione della piattaforma."
      : result.shared_company_domain
        ? "Richiesta inviata. Il dominio è condiviso da più entità legali: ownership in revisione manuale."
        : "Richiesta inviata. Ownership in revisione manuale.";

  revalidatePath("/network/" + companyId);
  revalidatePath("/network/" + companyId + "/claim");
  revalidatePath("/network/manage");
  revalidatePath("/platform/company-claims");
  redirect(
    "/network/" +
      companyId +
      "/claim?message=" +
      encodeURIComponent(message),
  );
}

export async function updateManagedNetworkProfile(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/manage?error=Profilo%20non%20valido");

  const supabase = await createClient();
  const { error } = await supabase.rpc("m8_update_managed_network_company", {
    p_network_company_id: companyId,
    p_trading_name: textValue(formData, "trading_name") || null,
    p_website_url: textValue(formData, "website_url") || null,
    p_description: textValue(formData, "description") || null,
  });

  if (error) {
    redirect("/network/manage?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/manage");
  revalidatePath("/network/" + companyId);
  redirect("/network/manage?message=Profilo%20Network%20aggiornato");
}


function managedProfilePath(key: "message" | "error", value: string) {
  return "/network/manage?" + key + "=" + encodeURIComponent(value);
}

function revalidateManagedProfile(companyId: string) {
  revalidatePath("/network/manage");
  revalidatePath("/network/" + companyId);
  revalidatePath("/network");
}

export async function setManagedCompanyRole(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const roleKey = textValue(formData, "role_key");
  const enabled = textValue(formData, "enabled") !== "false";
  const isPrimary = textValue(formData, "is_primary") === "true";

  if (!companyId || !roleKey) redirect(managedProfilePath("error", "Ruolo non valido."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_set_role", {
    p_network_company_id: companyId,
    p_role_key: roleKey,
    p_enabled: enabled,
    p_is_primary: isPrimary,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", enabled ? "Ruolo aziendale aggiornato." : "Ruolo rimosso."));
}

export async function setManagedCompanySubtype(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const subtypeKey = textValue(formData, "subtype_key");
  const enabled = textValue(formData, "enabled") !== "false";

  if (!companyId || !subtypeKey) redirect(managedProfilePath("error", "Sottotipo non valido."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_set_subtype", {
    p_network_company_id: companyId,
    p_subtype_key: subtypeKey,
    p_enabled: enabled,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", enabled ? "Sottotipo aggiunto." : "Sottotipo rimosso."));
}

export async function setManagedCompanyProduct(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const productKey = textValue(formData, "product_key");
  const relationshipType = textValue(formData, "relationship_type");
  const facilityId = textValue(formData, "facility_id") || null;
  const enabled = textValue(formData, "enabled") !== "false";

  if (!companyId || !productKey || !relationshipType) {
    redirect(managedProfilePath("error", "Relazione prodotto non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_set_product", {
    p_network_company_id: companyId,
    p_product_key: productKey,
    p_relationship_type: relationshipType,
    p_facility_id: facilityId,
    p_enabled: enabled,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", enabled ? "Prodotto aggiunto al profilo." : "Relazione prodotto rimossa."));
}

export async function setManagedProductStandardScope(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const companyProductId = textValue(formData, "company_product_id");
  const standardId = textValue(formData, "standard_id");
  const enabled = textValue(formData, "enabled") !== "false";

  if (!companyId || !companyProductId || !standardId) {
    redirect(managedProfilePath("error", "Norma tecnica non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7e_set_product_standard", {
    p_company_product_id: companyProductId,
    p_standard_id: standardId,
    p_enabled: enabled,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(
    managedProfilePath(
      "message",
      enabled ? "Norma aggiunta allo scope tecnico." : "Norma rimossa dallo scope tecnico.",
    ),
  );
}

export async function setManagedProductGradeScope(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const companyProductId = textValue(formData, "company_product_id");
  let standardId = textValue(formData, "standard_id");
  let materialGradeId = textValue(formData, "material_grade_id");
  const combinedScope = textValue(formData, "grade_scope");
  const enabled = textValue(formData, "enabled") !== "false";

  if ((!standardId || !materialGradeId) && combinedScope.includes(":")) {
    [standardId, materialGradeId] = combinedScope.split(":", 2);
  }

  if (!companyId || !companyProductId || !standardId || !materialGradeId) {
    redirect(managedProfilePath("error", "Grado materiale non valido."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7e_set_product_grade", {
    p_company_product_id: companyProductId,
    p_standard_id: standardId,
    p_material_grade_id: materialGradeId,
    p_enabled: enabled,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(
    managedProfilePath(
      "message",
      enabled ? "Grado aggiunto allo scope tecnico." : "Grado rimosso dallo scope tecnico.",
    ),
  );
}

export async function upsertManagedProductDimensionScope(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const companyProductId = textValue(formData, "company_product_id");
  const dimensionType = textValue(formData, "dimension_type");
  const minMm = Number(textValue(formData, "min_mm"));
  const maxMm = Number(textValue(formData, "max_mm"));

  if (
    !companyId ||
    !companyProductId ||
    !dimensionType ||
    !Number.isFinite(minMm) ||
    !Number.isFinite(maxMm) ||
    minMm <= 0 ||
    maxMm < minMm
  ) {
    redirect(managedProfilePath("error", "Range dimensionale non valido."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7e_upsert_product_dimension", {
    p_company_product_id: companyProductId,
    p_dimension_type: dimensionType,
    p_min_mm: minMm,
    p_max_mm: maxMm,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", "Range dimensionale aggiornato."));
}

export async function removeManagedProductDimensionScope(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const companyProductId = textValue(formData, "company_product_id");
  const dimensionType = textValue(formData, "dimension_type");

  if (!companyId || !companyProductId || !dimensionType) {
    redirect(managedProfilePath("error", "Range dimensionale non valido."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7e_remove_product_dimension", {
    p_company_product_id: companyProductId,
    p_dimension_type: dimensionType,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", "Range dimensionale rimosso."));
}

export async function upsertManagedFacility(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const facilityId = textValue(formData, "facility_id") || null;

  if (!companyId) redirect(managedProfilePath("error", "Profilo non valido."));

  const payload = {
    name: textValue(formData, "name"),
    facility_type: textValue(formData, "facility_type"),
    address_line_1: textValue(formData, "address_line_1") || null,
    address_line_2: textValue(formData, "address_line_2") || null,
    postal_code: textValue(formData, "postal_code") || null,
    city: textValue(formData, "city") || null,
    region: textValue(formData, "region") || null,
    country_code: textValue(formData, "country_code").toUpperCase(),
    website_url: textValue(formData, "website_url") || null,
    publication_status: textValue(formData, "publication_status") || "published",
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_upsert_facility", {
    p_network_company_id: companyId,
    p_facility_id: facilityId,
    p_payload: payload,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", facilityId ? "Sede aggiornata." : "Sede aggiunta al profilo."));
}

export async function archiveManagedFacility(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const facilityId = textValue(formData, "facility_id");
  if (!companyId || !facilityId) redirect(managedProfilePath("error", "Sede non valida."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_archive_facility", {
    p_network_company_id: companyId,
    p_facility_id: facilityId,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", "Sede archiviata."));
}

export async function setManagedFacilityCapability(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const facilityId = textValue(formData, "facility_id");
  const capabilityKey = textValue(formData, "capability_key");
  const enabled = textValue(formData, "enabled") !== "false";

  if (!companyId || !facilityId || !capabilityKey) {
    redirect(managedProfilePath("error", "Capability non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_set_facility_capability", {
    p_network_company_id: companyId,
    p_facility_id: facilityId,
    p_capability_key: capabilityKey,
    p_enabled: enabled,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", enabled ? "Capability aggiunta." : "Capability rimossa."));
}

export async function setManagedCompanyMarket(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const marketKey = textValue(formData, "market_key");
  const enabled = textValue(formData, "enabled") !== "false";

  if (!companyId || !marketKey) redirect(managedProfilePath("error", "Mercato non valido."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_set_market", {
    p_network_company_id: companyId,
    p_market_key: marketKey,
    p_enabled: enabled,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", enabled ? "Mercato aggiunto." : "Mercato rimosso."));
}

export async function upsertManagedCertification(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const certificationId = textValue(formData, "certification_id") || null;
  if (!companyId) redirect(managedProfilePath("error", "Profilo non valido."));

  const payload = {
    certification_type_key: textValue(formData, "certification_type_key"),
    facility_id: textValue(formData, "facility_id") || null,
    issuer: textValue(formData, "issuer") || null,
    certificate_identifier: textValue(formData, "certificate_identifier") || null,
    valid_from: textValue(formData, "valid_from") || null,
    valid_to: textValue(formData, "valid_to") || null,
    scope_text: textValue(formData, "scope_text") || null,
    evidence_reference: textValue(formData, "evidence_reference") || null,
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_upsert_certification", {
    p_network_company_id: companyId,
    p_certification_id: certificationId,
    p_payload: payload,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", certificationId ? "Certificazione aggiornata." : "Certificazione aggiunta."));
}

export async function removeManagedCertification(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const certificationId = textValue(formData, "certification_id");
  if (!companyId || !certificationId) {
    redirect(managedProfilePath("error", "Certificazione non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7b_remove_certification", {
    p_network_company_id: companyId,
    p_certification_id: certificationId,
  });

  if (error) redirect(managedProfilePath("error", error.message));
  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", "Certificazione rimossa."));
}


const COMPANY_LOGO_BUCKET = "network-company-media";
const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;
const COMPANY_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function uploadManagedCompanyLogo(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const file = formData.get("logo");

  if (!companyId) redirect(managedProfilePath("error", "Profilo non valido."));
  if (!file || typeof file === "string" || file.size === 0) {
    redirect(managedProfilePath("error", "Seleziona un file immagine."));
  }
  if (!COMPANY_LOGO_MIME_TYPES.has(file.type)) {
    redirect(managedProfilePath("error", "Formato logo non supportato. Usa PNG, JPEG o WebP."));
  }
  if (file.size > COMPANY_LOGO_MAX_BYTES) {
    redirect(managedProfilePath("error", "Il logo non può superare 2 MB."));
  }

  const supabase = await createClient();
  const logoPath = companyId + "/logo";
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(logoPath, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    redirect(managedProfilePath("error", uploadError.message));
  }

  const { error: profileError } = await supabase.rpc("p3_7d_set_logo_path", {
    p_network_company_id: companyId,
    p_logo_path: logoPath,
  });

  if (profileError) {
    await supabase.storage.from(COMPANY_LOGO_BUCKET).remove([logoPath]);
    redirect(managedProfilePath("error", profileError.message));
  }

  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", "Logo aziendale aggiornato."));
}

export async function removeManagedCompanyLogo(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const logoPath = textValue(formData, "logo_path");

  if (!companyId) redirect(managedProfilePath("error", "Profilo non valido."));

  const supabase = await createClient();
  const { error: profileError } = await supabase.rpc("p3_7d_set_logo_path", {
    p_network_company_id: companyId,
    p_logo_path: null,
  });

  if (profileError) redirect(managedProfilePath("error", profileError.message));

  if (logoPath) {
    const { error: removeError } = await supabase.storage
      .from(COMPANY_LOGO_BUCKET)
      .remove([logoPath]);

    if (removeError) {
      revalidateManagedProfile(companyId);
      redirect(
        managedProfilePath(
          "message",
          "Logo rimosso dal profilo. La pulizia del file storage richiede una verifica tecnica.",
        ),
      );
    }
  }

  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", "Logo aziendale rimosso."));
}

export async function upsertManagedPublicContact(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const contactId = textValue(formData, "contact_id") || null;

  if (!companyId) redirect(managedProfilePath("error", "Profilo non valido."));

  const payload = {
    contact_type: textValue(formData, "contact_type"),
    display_name: textValue(formData, "display_name") || null,
    email: textValue(formData, "email") || null,
    phone: textValue(formData, "phone") || null,
    website_url: textValue(formData, "website_url") || null,
    facility_id: textValue(formData, "facility_id") || null,
    publication_status: textValue(formData, "publication_status") || "published",
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7d_upsert_contact", {
    p_network_company_id: companyId,
    p_contact_id: contactId,
    p_payload: payload,
  });

  if (error) redirect(managedProfilePath("error", error.message));

  revalidateManagedProfile(companyId);
  redirect(
    managedProfilePath(
      "message",
      contactId ? "Contatto pubblico aggiornato." : "Contatto pubblico aggiunto.",
    ),
  );
}

export async function archiveManagedPublicContact(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const contactId = textValue(formData, "contact_id");

  if (!companyId || !contactId) {
    redirect(managedProfilePath("error", "Contatto pubblico non valido."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_7d_archive_contact", {
    p_network_company_id: companyId,
    p_contact_id: contactId,
  });

  if (error) redirect(managedProfilePath("error", error.message));

  revalidateManagedProfile(companyId);
  redirect(managedProfilePath("message", "Contatto pubblico archiviato."));
}


async function activeOrganizationId() {
  await requireWorkspaceWriteRole();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) redirect("/network?error=Nessuna%20organization%20attiva");

  return { supabase, userId, organizationId: membership.organization_id };
}

export async function saveNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network?error=Azienda%20non%20valida");

  const { supabase, userId, organizationId } = await activeOrganizationId();
  const { error } = await supabase.from("network_saved_companies").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      network_company_id: companyId,
    },
    { onConflict: "organization_id,user_id,network_company_id", ignoreDuplicates: true },
  );

  if (error) {
    redirect("/network/" + companyId + "?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_saved_created",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_company_profile" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/saved");
  redirect("/network/" + companyId + "?message=Azienda%20salvata");
}

export async function removeSavedNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/saved?error=Azienda%20non%20valida");

  const { supabase, userId, organizationId } = await activeOrganizationId();
  const { error } = await supabase
    .from("network_saved_companies")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("network_company_id", companyId);

  if (error) {
    redirect("/network/saved?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_saved_removed",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_saved_companies" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/saved");
  redirect("/network/saved?message=Azienda%20rimossa%20dai%20salvati");
}


export async function submitNetworkInquiry(formData: FormData) {
  await requireWorkspaceWriteRole();
  const companyId = textValue(formData, "network_company_id");
  const organizationId = textValue(formData, "organization_id");
  const subject = textValue(formData, "subject");
  const body = textValue(formData, "body");

  if (!companyId || !organizationId) {
    redirect("/network?error=Inquiry%20non%20valida");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_submit_inquiry", {
    p_sender_organization_id: organizationId,
    p_recipient_network_company_id: companyId,
    p_subject: subject,
    p_body: body,
  });

  if (error) {
    redirect("/network/" + companyId + "/inquiry?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_inquiry_submitted",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_inquiry_compose" },
  });
  revalidatePath("/network/inquiries");
  redirect("/network/inquiries?box=sent&message=Inquiry%20inviata");
}

export async function transitionNetworkInquiry(formData: FormData) {
  await requireWorkspaceWriteRole();
  const inquiryId = textValue(formData, "inquiry_id");
  const organizationId = textValue(formData, "organization_id");
  const newStatus = textValue(formData, "new_status");
  const box = textValue(formData, "box") === "sent" ? "sent" : "received";

  if (!inquiryId || !organizationId || !newStatus) {
    redirect("/network/inquiries?error=Transizione%20non%20valida");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_transition_inquiry", {
    p_inquiry_id: inquiryId,
    p_actor_organization_id: organizationId,
    p_new_status: newStatus,
  });

  if (error) {
    redirect("/network/inquiries?box=" + box + "&error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_inquiry_state_changed",
    entityType: "network_inquiry",
    entityId: inquiryId,
    metadata: { surface: "network_inquiries" },
  });
  revalidatePath("/network/inquiries");
  redirect("/network/inquiries?box=" + box + "&message=Stato%20inquiry%20aggiornato");
}

export async function reportNetworkInquiry(formData: FormData) {
  await requireWorkspaceWriteRole();
  const inquiryId = textValue(formData, "inquiry_id");
  const organizationId = textValue(formData, "organization_id");
  const reason = textValue(formData, "reason");
  const details = textValue(formData, "details");
  const box = textValue(formData, "box") === "sent" ? "sent" : "received";

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_report_inquiry", {
    p_inquiry_id: inquiryId,
    p_reporter_organization_id: organizationId,
    p_reason: reason,
    p_details: details || null,
  });

  if (error) {
    redirect("/network/inquiries?box=" + box + "&error=" + encodeURIComponent(error.message));
  }

  redirect("/network/inquiries?box=" + box + "&message=Segnalazione%20inviata");
}

export async function setInquiryPreferences(formData: FormData) {
  await requireWorkspaceAdmin();
  const organizationId = textValue(formData, "organization_id");
  const enabled = textValue(formData, "inquiries_enabled") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_set_inquiry_preferences", {
    p_organization_id: organizationId,
    p_inquiries_enabled: enabled,
  });

  if (error) {
    redirect("/network/manage?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/manage");
  redirect("/network/manage?message=Preferenze%20inquiry%20aggiornate");
}

export async function blockInquirySenderOrganization(formData: FormData) {
  await requireWorkspaceWriteRole();
  const blockingOrganizationId = textValue(formData, "blocking_organization_id");
  const blockedOrganizationId = textValue(formData, "blocked_organization_id");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_block_organization", {
    p_blocking_organization_id: blockingOrganizationId,
    p_blocked_organization_id: blockedOrganizationId,
  });

  if (error) {
    redirect("/network/inquiries?box=received&error=" + encodeURIComponent(error.message));
  }

  redirect("/network/inquiries?box=received&message=Organizzazione%20bloccata");
}


export async function followNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network?error=Azienda%20non%20valida");

  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_follow_company", {
    p_organization_id: organizationId,
    p_network_company_id: companyId,
  });

  if (error) {
    redirect("/network/" + companyId + "?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_follow_created",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_company_profile" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/following");
  revalidatePath("/network/activity");
  redirect("/network/" + companyId + "?message=Azienda%20seguita");
}

export async function unfollowNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/following?error=Azienda%20non%20valida");

  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_unfollow_company", {
    p_organization_id: organizationId,
    p_network_company_id: companyId,
  });

  if (error) {
    redirect("/network/following?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_follow_removed",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_following" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/following");
  revalidatePath("/network/activity");
  redirect("/network/following?message=Follow%20rimosso");
}

export async function markNetworkActivityRead(formData: FormData) {
  const activityEventId = textValue(formData, "activity_event_id");
  const companyId = textValue(formData, "network_company_id");
  if (!activityEventId) redirect("/network/activity?error=Activity%20non%20valida");

  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_mark_activity_read", {
    p_organization_id: organizationId,
    p_activity_event_id: activityEventId,
  });

  if (error) {
    redirect("/network/activity?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/activity");
  if (companyId) {
    await recordPilotUsageEvent({
      eventName: "network_activity_item_opened",
      entityType: "network_company",
      entityId: companyId,
      metadata: { surface: "network_activity" },
    });
    redirect("/network/" + companyId);
  }
  redirect("/network/activity");
}

export async function markAllNetworkActivityRead() {
  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_mark_all_activity_read", {
    p_organization_id: organizationId,
  });

  if (error) {
    redirect("/network/activity?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/activity");
  redirect("/network/activity?message=Activity%20segnate%20come%20lette");
}
