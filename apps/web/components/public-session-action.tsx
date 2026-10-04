"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type PublicSessionActionProps = {
  className?: string;
};

export function PublicSessionAction({ className = "" }: PublicSessionActionProps) {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return;
    }

    const supabase = createClient();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setAuthenticated(Boolean(data.session));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setAuthenticated(Boolean(session));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Link
      href={authenticated ? "/dashboard" : "/login?next=%2Fdashboard"}
      className={className}
    >
      {authenticated ? "Workspace" : "Accedi"}
    </Link>
  );
}
