"use server";

import { safeErrorMessage } from "@/lib/user-facing-error";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/platform-admin";
import type { KnowledgeContentType } from "@/lib/platform-knowledge";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function knowledgePath(
  key?: "message" | "error",
  message?: string,
  contentType?: KnowledgeContentType,
  pageId?: string,
) {
  const base =
    contentType && pageId
      ? `/platform/knowledge/${contentType}/${pageId}`
      : "/platform/knowledge";
  if (!key || !message) return base;
  return `${base}?${key}=${encodeURIComponent(message)}`;
}

function contentType(formData: FormData): KnowledgeContentType | null {
  const type = value(formData, "content_type");
  return type === "standard" || type === "grade" ? type : null;
}

function parseJsonArray(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${key} deve contenere un array JSON.`);
  }
  return parsed;
}

function relatedSlugs(formData: FormData) {
  return value(formData, "related_slugs")
    .split(/\r?\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

async function rpcMutation(
  functionName: string,
  args: Record<string, unknown>,
  type: KnowledgeContentType,
  pageId: string,
  successMessage: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(functionName, args);

  if (error) {
    redirect(knowledgePath("error", safeErrorMessage(error, "Operazione Knowledge non completata. Aggiorna la pagina e riprova."), type, pageId));
  }

  revalidatePath("/platform");
  revalidatePath("/platform/knowledge");
  revalidatePath(`/platform/knowledge/${type}/${pageId}`);
  redirect(knowledgePath("message", successMessage, type, pageId));
}

export async function saveKnowledgeDraft(formData: FormData) {
  await requirePlatformPermission("knowledge.edit");

  const type = contentType(formData);
  const pageId = value(formData, "page_id");
  if (!type || !pageId) {
    redirect(knowledgePath("error", "Pagina Knowledge non valida."));
  }

  let editorialSections: unknown[];
  let faq: unknown[];
  let sourceReferences: unknown[];
  try {
    editorialSections = parseJsonArray(formData, "editorial_sections_json");
    faq = parseJsonArray(formData, "faq_json");
    sourceReferences = parseJsonArray(formData, "source_references_json");
  } catch (error) {
    redirect(
      knowledgePath(
        "error",
        safeErrorMessage(error, "JSON editoriale non valido. Controlla il contenuto e riprova."),
        type,
        pageId,
      ),
    );
  }

  const payload: Record<string, unknown> = {
    seo_title: value(formData, "seo_title") || null,
    seo_description: value(formData, "seo_description") || null,
    intro: value(formData, "intro") || null,
    typical_applications: value(formData, "typical_applications") || null,
    editorial_sections: editorialSections,
    faq,
    source_references: sourceReferences,
    related_slugs: relatedSlugs(formData),
  };

  if (type === "standard") {
    payload.what_it_covers = value(formData, "what_it_covers") || null;
    payload.how_to_read = value(formData, "how_to_read") || null;
  } else {
    payload.designation_explanation =
      value(formData, "designation_explanation") || null;
  }

  await rpcMutation(
    "sa7_save_knowledge_draft",
    {
      p_content_type: type,
      p_page_id: pageId,
      p_payload: payload,
      p_note: value(formData, "note") || null,
    },
    type,
    pageId,
    "Bozza salvata. La copia pubblica non è stata modificata.",
  );
}

export async function submitKnowledgeReview(formData: FormData) {
  await requirePlatformPermission("knowledge.edit");

  const type = contentType(formData);
  const pageId = value(formData, "page_id");
  if (!type || !pageId) {
    redirect(knowledgePath("error", "Pagina Knowledge non valida."));
  }

  await rpcMutation(
    "sa7_submit_knowledge_review",
    {
      p_content_type: type,
      p_page_id: pageId,
      p_note: value(formData, "note") || null,
    },
    type,
    pageId,
    "Bozza inviata in revisione.",
  );
}

export async function reviewKnowledgeDraft(formData: FormData) {
  await requirePlatformPermission("knowledge.review");

  const type = contentType(formData);
  const pageId = value(formData, "page_id");
  const decision = value(formData, "decision");
  if (
    !type ||
    !pageId ||
    !["approve", "changes_requested"].includes(decision)
  ) {
    redirect(knowledgePath("error", "Decisione di revisione non valida."));
  }

  await rpcMutation(
    "sa7_review_knowledge_draft",
    {
      p_content_type: type,
      p_page_id: pageId,
      p_decision: decision,
      p_note: value(formData, "note") || null,
    },
    type,
    pageId,
    decision === "approve"
      ? "Bozza approvata. È pronta per una pubblicazione separata."
      : "Modifiche richieste all’Editor.",
  );
}

export async function publishKnowledgePage(formData: FormData) {
  await requirePlatformPermission("knowledge.publish");

  const type = contentType(formData);
  const pageId = value(formData, "page_id");
  const action = value(formData, "action");
  const slug = value(formData, "slug");
  if (!type || !pageId || !["publish", "unpublish"].includes(action)) {
    redirect(knowledgePath("error", "Azione di pubblicazione non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa7_publish_knowledge_page", {
    p_content_type: type,
    p_page_id: pageId,
    p_action: action,
    p_note: value(formData, "note") || null,
  });

  if (error) {
    redirect(knowledgePath("error", safeErrorMessage(error, "Operazione Knowledge non completata. Aggiorna la pagina e riprova."), type, pageId));
  }

  revalidatePath("/platform");
  revalidatePath("/platform/knowledge");
  revalidatePath(`/platform/knowledge/${type}/${pageId}`);
  revalidatePath("/knowledge");
  revalidatePath(type === "standard" ? "/knowledge/norme" : "/knowledge/gradi");
  if (slug) {
    revalidatePath(
      type === "standard"
        ? `/knowledge/norme/${slug}`
        : `/knowledge/gradi/${slug}`,
    );
  }
  revalidatePath("/sitemap.xml");

  redirect(
    knowledgePath(
      "message",
      action === "publish"
        ? "Contenuto pubblicato: la bozza approvata è ora la copia live."
        : "Contenuto rimosso dall’indice pubblico e archiviato.",
      type,
      pageId,
    ),
  );
}
