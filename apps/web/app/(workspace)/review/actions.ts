"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function confirmReviewItem(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!configured) return;

  const supabase = await createClient();
  await supabase
    .from("commercial_review_queue")
    .update({ status: "confirmed", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/review");
  revalidatePath("/dashboard");
}
