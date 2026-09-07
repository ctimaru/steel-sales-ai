import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  let viewerLabel = "demo@steel-sales-ai.local";

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      redirect("/login");
    }

    viewerLabel =
      typeof data.claims.email === "string" ? data.claims.email : "Utente autenticato";
  }

  return (
    <AppShell viewerLabel={viewerLabel} demoMode={!configured}>
      {children}
    </AppShell>
  );
}
