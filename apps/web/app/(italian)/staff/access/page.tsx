import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/(workspace)/actions";
import { ProductBrand } from "@/components/product-brand";
import {
  PLATFORM_STAFF_ROLE_TEMPLATES,
  type PlatformStaffRoleKey,
} from "@/lib/platform-access-contract";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Platform Staff Access",
  robots: privateNoIndexRobots,
};

function roleLabel(role: PlatformStaffRoleKey) {
  return (
    PLATFORM_STAFF_ROLE_TEMPLATES.find((item) => item.key === role)?.label ??
    role
  );
}

export default async function StaffAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string }>;
}) {
  const { activated } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  await supabase.rpc("sa2_claim_platform_staff_invitation");

  const { data, error } = await supabase.rpc("platform_access_context");
  if (error || !data) {
    redirect("/login?error=Accesso%20Platform%20non%20disponibile");
  }

  const context = data as {
    authority_type: "platform_owner" | "platform_staff" | "none";
    is_platform_owner: boolean;
    is_platform_staff: boolean;
    staff_status: "active" | "suspended" | "revoked" | null;
    roles: PlatformStaffRoleKey[];
    permissions: string[];
  };

  if (context.is_platform_owner) {
    redirect("/platform");
  }

  const active = context.staff_status === "active";
  const suspended = context.staff_status === "suspended";
  const revoked = context.staff_status === "revoked";
  const canOpenPlatform =
    active && context.permissions.includes("platform.console.access");

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-[#e1e8f2] bg-white p-6 shadow-sm sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <ProductBrand href="/" compact />
            <form action={logout}>
              <button className="rounded-xl border border-[#dbe5f1] bg-white px-3 py-2 text-xs font-semibold text-[#65758b] hover:bg-[#eef3fa]">
                Esci
              </button>
            </form>
          </div>

          <p className="mt-8 text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">
            Platform Staff
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45]">
            Accesso amministrativo
          </h1>

          {activated === "1" ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Identità verificata e invito Platform acquisito correttamente.
            </div>
          ) : null}

          {!context.is_platform_staff ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-950">
                Nessun accesso Platform Staff attivo
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Non risulta un invito Platform valido associato a questa email.
                Verifica di aver usato lo stesso indirizzo invitato dal Platform
                Owner.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-[#40516a]">
                    {authData.user.email}
                  </p>
                  <p className="mt-1 text-xs text-[#8290a4]">
                    Stato accesso Platform
                  </p>
                </div>
                <span
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                    active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : suspended
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {active ? "Attivo" : suspended ? "Sospeso" : "Revocato"}
                </span>
              </div>

              <section className="mt-7 rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#71819a]">
                  Ruoli assegnati
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {context.roles.length ? (
                    context.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-[#dce6f3] bg-white px-3 py-1.5 text-xs font-semibold text-[#40516a]"
                      >
                        {roleLabel(role)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[#8290a4]">
                      Nessun role template attivo.
                    </span>
                  )}
                </div>
              </section>

              {active ? (
                <div className="mt-6 rounded-2xl border border-[#dbe7f7] bg-[#f1f6ff] p-5">
                  <p className="font-semibold text-[#173468]">
                    Profilo Platform Staff attivo
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#5f718a]">
                    Il tuo account amministrativo è separato dai workspace
                    aziendali e non concede accesso automatico ai dati commerciali
                    privati dei tenant.
                  </p>
                  {canOpenPlatform ? (
                    <Link
                      href="/platform"
                      className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245ed1]"
                    >
                      Apri Platform Console
                    </Link>
                  ) : null}
                </div>
              ) : suspended ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="font-semibold text-amber-950">
                    Accesso temporaneamente sospeso
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    I role template restano registrati, ma nessuna permission
                    Platform è effettiva finché il Platform Owner non riattiva
                    l&apos;account.
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="font-semibold text-slate-800">
                    Accesso revocato
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    La revoca è definitiva per questa assegnazione. Un eventuale
                    nuovo accesso richiede un nuovo invito del Platform Owner.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="mt-8 border-t border-[#e8eef7] pt-5">
            <Link
              href="/"
              className="text-sm font-semibold text-[#68788e] hover:text-[#1e2b45]"
            >
              Torna al sito pubblico
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
