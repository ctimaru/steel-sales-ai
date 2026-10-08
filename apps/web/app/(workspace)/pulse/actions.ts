"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validatePulsePreferences } from "@/lib/steel-pulse-personalized";
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
