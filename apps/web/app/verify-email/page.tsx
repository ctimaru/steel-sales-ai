import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductBrand } from "@/components/product-brand";
import { RegistrationJourney } from "@/components/registration-journey";
import {
  maskEmail,
  PENDING_SIGNUP_EMAIL_COOKIE,
} from "@/lib/auth-email-verification";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

import { resendSignupConfirmation } from "./actions";

export const metadata: Metadata = {
  title: "Verifica la tua email",
  robots: privateNoIndexRobots,
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    resent?: string;
    source?: string;
    error?: string;
  }>;
}) {
  const { sent, resent, source, error } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (authData.user?.email_confirmed_at) {
    redirect("/register");
  }

  const cookieStore = await cookies();
  const pendingEmail =
    cookieStore.get(PENDING_SIGNUP_EMAIL_COOKIE)?.value ?? "";
  const maskedEmail = pendingEmail ? maskEmail(pendingEmail) : null;

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <ProductBrand href="/" />
          <Link
            href="/login"
            className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
          >
            Torna al login
          </Link>
        </div>

        <div className="mt-6 rounded-[28px] border border-[#dce2df] bg-white p-5 shadow-[0_14px_44px_rgba(18,61,52,0.06)] sm:p-8 lg:p-10">
          <RegistrationJourney current={1} />

          <div className="mt-8 max-w-2xl">
            <p className="app-kicker">Verifica account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1d2824] sm:text-4xl">
              Controlla la tua email
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Prima di raccogliere i dati aziendali dobbiamo verificare che l&apos;indirizzo email
              sia realmente sotto il tuo controllo.
            </p>
          </div>

          {sent === "1" ? (
            <div className="mt-6 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-3 text-sm leading-6 text-[#173f35]">
              Se questo indirizzo è in attesa di verifica, abbiamo richiesto l&apos;invio del link.
              Controlla anche Spam, Promozioni e Posta indesiderata.
            </div>
          ) : null}

          {resent === "1" ? (
            <div className="mt-6 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-3 text-sm leading-6 text-[#173f35]">
              Nuovo link richiesto. L&apos;email può impiegare qualche istante ad arrivare.
            </div>
          ) : null}

          {source === "login" ? (
            <div className="mt-6 rounded-xl border border-[#ead7aa] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#77551c]">
              Il tuo account esiste, ma l&apos;email non risulta ancora confermata. Verificala prima
              di accedere.
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#9f2f24]"
            >
              {error}
            </div>
          ) : null}

          <section className="mt-7 rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e1ece8] text-[#1a5144]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1d2824]">
                  {maskedEmail
                    ? "Link inviato a " + maskedEmail
                    : "Email di verifica"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">
                  Apri il messaggio di Steel Sales AI e premi <strong>Conferma email</strong>. Dopo
                  la verifica tornerai automaticamente al percorso di registrazione aziendale.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-[#e2e7e4] pt-5">
              {pendingEmail ? (
                <form action={resendSignupConfirmation}>
                  <button
                    type="submit"
                    className="app-secondary inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold sm:w-auto"
                  >
                    Reinvia email di verifica
                  </button>
                </form>
              ) : (
                <Link
                  href="/register"
                  className="app-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
                >
                  Torna alla registrazione
                </Link>
              )}
            </div>
          </section>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Apri l’email", "Cerca il messaggio di verifica inviato da Steel Sales AI."],
              ["2", "Conferma", "Premi il pulsante contenuto nel messaggio."],
              ["3", "Continua", "Completa i dati aziendali dopo la verifica."],
            ].map(([number, title, body]) => (
              <div key={number} className="rounded-2xl border border-[#e2e7e4] bg-white p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a5144] text-xs font-bold text-white">
                  {number}
                </span>
                <p className="mt-3 text-sm font-semibold text-[#1d2824]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#7b8782]">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 border-t border-[#e7ece9] pt-5 text-sm leading-6 text-[#66736e]">
            <p>
              Hai usato un indirizzo sbagliato?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#173f35] underline decoration-[#b8d2c8] underline-offset-4"
              >
                Riparti dalla registrazione
              </Link>
              .
            </p>
            <p className="mt-2">
              Se l&apos;account è già stato verificato, puoi semplicemente{" "}
              <Link
                href="/login"
                className="font-semibold text-[#173f35] underline decoration-[#b8d2c8] underline-offset-4"
              >
                accedere
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
