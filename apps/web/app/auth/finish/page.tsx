"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ProductBrand } from "@/components/product-brand";
import { Input } from "@/components/ui/input";
import { safeInternalNext } from "@/lib/auth-next";
import { createClient } from "@/lib/supabase/client";

type OrganizationInvitationContext = {
  invitation_id: string;
  organization_id: string;
  organization_name: string | null;
  email: string;
  role: string;
  business_role: string | null;
  status: string;
  expires_at: string;
};

function permissionLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "viewer") return "Viewer";
  return "Member";
}

function businessRoleLabel(role: string | null) {
  if (role === "sales_director") return "Sales Director";
  if (role === "salesperson") return "Commerciale";
  if (role === "operations") return "Operations";
  return "Non assegnato";
}

export default function AuthFinishPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "invite" | "error">("loading");
  const [inviteKind, setInviteKind] = useState<"organization" | "platform">("organization");
  const [organizationInvitation, setOrganizationInvitation] =
    useState<OrganizationInvitationContext | null>(null);
  const [organizationInvitationId, setOrganizationInvitationId] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const isInvite = url.searchParams.get("invited") === "1";
      const isStaffInvite = url.searchParams.get("staff") === "1";
      const isSignup = url.searchParams.get("signup") === "1";
      const isRecovery = url.searchParams.get("recovery") === "1";
      const nextPath = safeInternalNext(url.searchParams.get("next"), "/register");
      const invitationId = url.searchParams.get("invitation_id");
      const setPassword = url.searchParams.get("set_password") !== "0";
      const code = url.searchParams.get("code");

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search,
            );
          }
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) {
          throw userError ?? new Error("Sessione di autenticazione non disponibile.");
        }

        if (isInvite && isStaffInvite) {
          if (!cancelled) {
            setInviteKind("platform");
            setMode("invite");
          }
          return;
        }

        if (isInvite) {
          if (!invitationId) {
            await supabase.auth.signOut();
            throw new Error("Invito aziendale non identificabile. Richiedi un nuovo invito.");
          }

          const { data: contextData, error: contextError } = await supabase.rpc(
            "hp8_invitation_context",
            { p_invitation_id: invitationId },
          );
          if (contextError) {
            await supabase.auth.signOut();
            throw new Error("Invito non disponibile per questo account.");
          }

          const invitation = contextData as OrganizationInvitationContext;
          if (invitation.status === "accepted") {
            router.replace("/legal/accept?source=team_invite&next=" + encodeURIComponent("/dashboard?joined=1"));
            router.refresh();
            return;
          }
          if (invitation.status !== "pending") {
            await supabase.auth.signOut();
            throw new Error(
              invitation.status === "expired"
                ? "Questo invito è scaduto. Chiedi all’amministratore di reinviarlo."
                : "Questo invito non è più utilizzabile.",
            );
          }

          if (!setPassword) {
            const { data: claimData, error: claimError } = await supabase.rpc(
              "hp8_claim_organization_invitation",
              { p_invitation_id: invitationId },
            );
            if (claimError) throw claimError;

            const claim = (claimData ?? {}) as {
              claimed?: boolean;
              idempotent_replay?: boolean;
              status?: string;
            };

            if (
              claim.claimed !== true &&
              !(claim.idempotent_replay === true && claim.status === "accepted")
            ) {
              await supabase.auth.signOut();
              throw new Error("L’invito è scaduto o è stato revocato.");
            }

            router.replace("/legal/accept?source=team_invite&next=" + encodeURIComponent("/dashboard?joined=1"));
            router.refresh();
            return;
          }

          if (!cancelled) {
            setInviteKind("organization");
            setOrganizationInvitation(invitation);
            setOrganizationInvitationId(invitationId);
            setMode("invite");
          }
          return;
        }

        if (isRecovery) {
          router.replace("/reset-password");
          router.refresh();
          return;
        }

        if (isSignup) {
          router.replace(nextPath);
          router.refresh();
          return;
        }

        router.replace("/dashboard");
        router.refresh();
      } catch (authError) {
        if (cancelled) return;
        setError(
          authError instanceof Error
            ? authError.message
            : "Link di autenticazione non valido o scaduto.",
        );
        setMode("error");
      }
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function completeInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(passwordError.message);
      setSubmitting(false);
      return;
    }

    if (inviteKind === "platform") {
      const { data: claimData, error: claimError } = await supabase.rpc(
        "sa2_claim_platform_staff_invitation",
      );
      if (claimError) {
        setError(claimError.message);
        setSubmitting(false);
        return;
      }

      const payload = (claimData ?? {}) as { claimed?: boolean };
      if (payload.claimed !== true) {
        setError("Invito Platform Staff non trovato, scaduto o già utilizzato.");
        setSubmitting(false);
        return;
      }

      const { data: platformContext } = await supabase.rpc("platform_access_context");
      const authority = (platformContext ?? {}) as {
        staff_status?: string | null;
        permissions?: string[];
      };

      if (
        authority.staff_status === "active" &&
        authority.permissions?.includes("platform.console.access")
      ) {
        router.replace("/platform");
      } else {
        router.replace("/staff/access?activated=1");
      }
      router.refresh();
      return;
    }

    if (!organizationInvitationId) {
      await supabase.auth.signOut();
      setError("Invito aziendale non identificabile. Richiedi un nuovo invito.");
      setSubmitting(false);
      return;
    }

    const { data: claimData, error: claimError } = await supabase.rpc(
      "hp8_claim_organization_invitation",
      { p_invitation_id: organizationInvitationId },
    );
    if (claimError) {
      setError(claimError.message);
      setSubmitting(false);
      return;
    }

    const claim = (claimData ?? {}) as {
      claimed?: boolean;
      idempotent_replay?: boolean;
      status?: string;
    };
    if (
      claim.claimed !== true &&
      !(claim.idempotent_replay === true && claim.status === "accepted")
    ) {
      await supabase.auth.signOut();
      setError("L’invito è scaduto o è stato revocato. Richiedi un nuovo invito.");
      setSubmitting(false);
      return;
    }

    router.replace("/legal/accept?source=team_invite&next=" + encodeURIComponent("/dashboard?joined=1"));
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f4f3] px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md rounded-[28px] border border-[#dce2df] bg-white p-6 shadow-[0_14px_44px_rgba(18,61,52,0.07)] sm:p-8">
        <ProductBrand href="/" />

        {mode === "loading" ? (
          <>
            <p className="app-kicker mt-8">Verifica account</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
              Stiamo completando l’accesso
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Verifichiamo il link e prepariamo automaticamente il prossimo passaggio.
            </p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#e7ece9]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#438d7a]" />
            </div>
          </>
        ) : null}

        {mode === "invite" ? (
          <>
            <p className="app-kicker mt-8">Invito</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
              {inviteKind === "platform"
                ? "Attiva il tuo accesso Platform"
                : `Entra in ${organizationInvitation?.organization_name ?? "Smart Steel Sales"}`}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              {inviteKind === "platform"
                ? "Imposta una password personale. Le autorizzazioni previste per il tuo ruolo verranno applicate dopo la verifica dell’identità."
                : "L’azienda e i ruoli sono già determinati dall’invito. Imposta una password personale per completare il primo accesso."}
            </p>

            {inviteKind === "organization" && organizationInvitation ? (
              <div className="mt-5 rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4 text-sm text-[#52615b]">
                <p>
                  Permesso:{" "}
                  <strong>{permissionLabel(organizationInvitation.role)}</strong>
                </p>
                <p className="mt-1">
                  Ruolo commerciale:{" "}
                  <strong>
                    {businessRoleLabel(organizationInvitation.business_role)}
                  </strong>
                </p>
              </div>
            ) : null}

            <form onSubmit={completeInvitation} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-[#43524c]">
                Nuova password
                <Input
                  className="mt-2 h-11"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
                <span className="mt-1.5 block text-xs text-[#7b8782]">
                  Almeno 8 caratteri. Usa una password personale e non riutilizzata.
                </span>
              </label>

              {error ? (
                <p className="rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-3 py-2 text-sm text-[#9f2f24]">
                  {error}
                </p>
              ) : null}

              <button
                disabled={submitting}
                className="app-primary h-11 w-full rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Salvataggio…"
                  : inviteKind === "platform"
                    ? "Attiva accesso Platform"
                    : "Entra nel workspace"}
              </button>
            </form>
          </>
        ) : null}

        {mode === "error" ? (
          <>
            <p className="app-kicker mt-8">Accesso non completato</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
              Link non utilizzabile
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              {error ?? "Il link potrebbe essere scaduto o già utilizzato."}
            </p>
            <a
              href="/login"
              className="app-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
            >
              Torna al login
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}
