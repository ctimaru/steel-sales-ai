"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validatePulsePreferences } from "@/lib/steel-pulse-personalized";
import { validatePulseAction, validatePulseSourceUrl } from "@/lib/steel-pulse-engagement";
import { createClient } from "@/lib/supabase/server";

/** Individual topics only; no organization id or workspace commercial data. */
export async function savePulseInterests(formData: FormData) {
  const preferences = validatePulsePreferences({
    topics: formData.getAll("topics"),
    role_interest: formData.get("role_interest"),
    language_code: formData.get("language_code"),
  });
  if (!preferences) redirect("/pulse?error=invalid");

  const supabase = await createClient();
  const { data: { user }, error: identityError } = await supabase.auth.getUser();
  if (identityError || !user) redirect("/login?next=%2Fpulse");

  let saved = false;
  try {
    const { data, error } = await supabase.rpc("sp5_save_feed_preferences", {
      p_topics: preferences.topics,
      p_role_interest: preferences.role_interest,
      p_language_code: preferences.language_code,
    });
    saved = !error && !!validatePulsePreferences(data);
  } catch {
    saved = false;
  }
  if (!saved) redirect("/pulse?error=unavailable");
  revalidatePath("/pulse");
  redirect("/pulse?saved=1");
}


/** An explicit first-party action only. Never accepts an identity or tenant ID. */
export async function setPulseArticleEngagement(formData: FormData) {
  const sourceUrl = formData.get("source_url");
  const action = formData.get("engagement_action");
  const selectedView = formData.get("view");
  const view = selectedView === "saved" || selectedView === "unread" ? selectedView : "all";
  const nextPath = view === "all" ? "/pulse" : "/pulse?view=" + view;
  if (!validatePulseSourceUrl(sourceUrl) || !validatePulseAction(action)) {
    redirect(nextPath + (view === "all" ? "?" : "&") + "engagement_error=invalid");
  }

  const supabase = await createClient();
  const { data: { user }, error: identityError } = await supabase.auth.getUser();
  if (identityError || !user) redirect("/login?next=%2Fpulse");

  let success = false;
  try {
    const { data, error } = await supabase.rpc("sp6_set_article_engagement", {
      p_source_url: sourceUrl,
      p_action: action,
    });
    success = !error && !!data && typeof data.saved === "boolean" &&
      typeof data.read === "boolean";
  } catch {
    success = false;
  }

  revalidatePath("/pulse");
  redirect(nextPath + (view === "all" ? "?" : "&") +
    (success ? "engagement_updated=1" : "engagement_error=unavailable"));
}
