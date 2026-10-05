"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deactivateDiscountProfile,
  saveDiscountProfile,
} from "@/app/(public)/listini/[versionId]/actions";
import {
  discountScopeLabel,
  type DiscountScopeType,
  type DiscountVisibility,
  type PrivatePricingContext,
} from "@/lib/private-pricing";
import type { PriceListExplorerItem } from "@/lib/public-price-lists";

function finishLabel(value: string) {
  if (value === "self_color") return "Neri";
  if (value === "pickled_oiled") return "Decapati";
  if (value === "sendzimir") return "Zincati Sendzimir";
  return value.replaceAll("_", " ");
}

function formatDiscount(value: number | string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function PrivateDiscountProfilesPanel({
  versionId,
  items,
  context,
}: {
  versionId: string;
  items: PriceListExplorerItem[];
  context: PrivatePricingContext;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scopeType, setScopeType] = useState<DiscountScopeType>("manufacturer");
  const [visibility, setVisibility] = useState<DiscountVisibility>("personal");
  const [discountInput, setDiscountInput] = useState("");
  const [gradeCode, setGradeCode] = useState("");
  const [finishCode, setFinishCode] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grades = useMemo(
    () =>
      [...new Set(items.map((item) => item.grade_code).filter((value): value is string => Boolean(value)))].sort(),
    [items],
  );
  const finishes = useMemo(
    () =>
      [...new Set(items.map((item) => item.finish_code).filter((value): value is string => Boolean(value)))].sort(),
    [items],
  );

  if (!context.authenticated) {
    return (
      <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Prezzi privati
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
              Salva i tuoi sconti commerciali
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#66736e]">
              Il calcolo manuale resta pubblico. Accedendo puoi memorizzare profili sconto privati
              e farli applicare automaticamente agli articoli compatibili.
            </p>
          </div>
          <Link
            href={"/login?next=" + encodeURIComponent("/listini/" + versionId)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 text-sm font-semibold text-[#173f35] hover:bg-[#e5f0ec]"
          >
            Accedi
          </Link>
        </div>
      </section>
    );
  }

  if (!context.canWrite) {
    return (
      <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          Prezzi privati
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
          Profili sconto in sola lettura
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#66736e]">
          Puoi utilizzare i profili condivisi della tua azienda, ma il tuo ruolo non consente
          di creare o modificare impostazioni commerciali.
        </p>
      </section>
    );
  }

  const needsGrade = scopeType === "grade" || scopeType === "grade_finish";
  const needsFinish = scopeType === "finish" || scopeType === "grade_finish";

  function submitProfile() {
    const parsed = Number(discountInput.replace(",", "."));
    setMessage(null);
    setError(null);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError("Inserisci uno sconto compreso tra 0 e 100%.");
      return;
    }
    if (needsGrade && !gradeCode) {
      setError("Seleziona il grado a cui applicare lo sconto.");
      return;
    }
    if (needsFinish && !finishCode) {
      setError("Seleziona la finitura a cui applicare lo sconto.");
      return;
    }

    startTransition(async () => {
      const result = await saveDiscountProfile({
        versionId,
        scopeType,
        discountPct: parsed,
        visibility,
        gradeCode: needsGrade ? gradeCode : null,
        finishCode: needsFinish ? finishCode : null,
        label: label.trim() || null,
      });

      if (!result.ok) {
        setError(result.error ?? "Salvataggio non riuscito.");
        return;
      }

      setMessage("Profilo sconto salvato.");
      setDiscountInput("");
      setLabel("");
      router.refresh();
    });
  }

  function deactivate(profileId: string) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await deactivateDiscountProfile(versionId, profileId);
      if (!result.ok) {
        setError(result.error ?? "Disattivazione non riuscita.");
        return;
      }
      setMessage("Profilo disattivato.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[#cfe0d9] bg-[#f8fbfa] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Prezzi privati
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Profili sconto · {context.organizationName ?? "Workspace azienda"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#66736e]">
            I profili sono privati. Le regole più specifiche prevalgono sulle generiche;
            a parità di specificità, il tuo profilo personale prevale su quello aziendale.
          </p>
        </div>
        <span className="rounded-full bg-[#e7f1ed] px-3 py-1 text-xs font-semibold text-[#173f35]">
          {context.profiles.length} attivi
        </span>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-[#d9e5e0] bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs font-semibold text-[#43524c]">
          Ambito
          <select
            value={scopeType}
            onChange={(event) => setScopeType(event.target.value as DiscountScopeType)}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a]"
          >
            <option value="manufacturer">Produttore</option>
            <option value="price_list">Listino</option>
            <option value="version">Versione</option>
            <option value="grade">Grado</option>
            <option value="finish">Finitura</option>
            <option value="grade_finish">Grado + finitura</option>
          </select>
        </label>

        <label className="text-xs font-semibold text-[#43524c]">
          Sconto %
          <input
            inputMode="decimal"
            value={discountInput}
            onChange={(event) => setDiscountInput(event.target.value)}
            placeholder="es. 42"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a]"
          />
        </label>

        <label className="text-xs font-semibold text-[#43524c]">
          Grado
          <select
            value={gradeCode}
            onChange={(event) => setGradeCode(event.target.value)}
            disabled={!needsGrade}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none disabled:bg-[#f1f3f2] disabled:text-[#98a29e]"
          >
            <option value="">Seleziona</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-[#43524c]">
          Finitura
          <select
            value={finishCode}
            onChange={(event) => setFinishCode(event.target.value)}
            disabled={!needsFinish}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none disabled:bg-[#f1f3f2] disabled:text-[#98a29e]"
          >
            <option value="">Seleziona</option>
            {finishes.map((finish) => (
              <option key={finish} value={finish}>{finishLabel(finish)}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-[#43524c]">
          Visibilità
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as DiscountVisibility)}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a]"
          >
            <option value="personal">Solo io</option>
            {context.canManageOrganization ? (
              <option value="organization">Azienda</option>
            ) : null}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={submitProfile}
            disabled={isPending}
            className="min-h-11 w-full rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white hover:bg-[#245747] disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? "Salvataggio…" : "Salva profilo"}
          </button>
        </div>

        <label className="text-xs font-semibold text-[#43524c] md:col-span-2 xl:col-span-6">
          Etichetta opzionale
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="es. Accordo annuale Padana"
            maxLength={120}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a]"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          {message}
        </p>
      ) : null}

      {context.profiles.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {context.profiles.map((profile) => {
            const canDeactivate =
              context.canWrite &&
              (profile.visibility === "personal" || context.canManageOrganization);
            const scopeDetail =
              profile.scope_type === "grade"
                ? profile.grade_code
                : profile.scope_type === "finish"
                  ? profile.finish_code
                    ? finishLabel(profile.finish_code)
                    : null
                  : profile.scope_type === "grade_finish"
                    ? [profile.grade_code, profile.finish_code ? finishLabel(profile.finish_code) : null]
                        .filter(Boolean)
                        .join(" · ")
                    : null;

            return (
              <div
                key={profile.profile_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#dfe7e3] bg-white px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#edf5f2] px-2 py-0.5 text-[10px] font-bold text-[#173f35]">
                      {discountScopeLabel(profile.scope_type)}
                    </span>
                    <span className="rounded-full bg-[#f2f4f3] px-2 py-0.5 text-[10px] font-semibold text-[#66736e]">
                      {profile.visibility === "personal" ? "Solo io" : "Azienda"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-[#1d2824]">
                    {formatDiscount(profile.discount_pct)}%
                    {scopeDetail ? " · " + scopeDetail : ""}
                  </p>
                  {profile.label ? (
                    <p className="mt-0.5 truncate text-xs text-[#7a8781]">{profile.label}</p>
                  ) : null}
                </div>
                {canDeactivate ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => deactivate(profile.profile_id)}
                    className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#7a5149] hover:bg-rose-50 disabled:opacity-50"
                  >
                    Disattiva
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-[#718078]">
          Nessun profilo salvato per questo produttore. Il primo profilo può essere generale
          sul produttore oppure specifico per listino, versione, grado o finitura.
        </p>
      )}
    </section>
  );
}
