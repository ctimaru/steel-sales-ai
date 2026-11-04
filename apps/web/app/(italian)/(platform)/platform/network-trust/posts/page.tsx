import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { GovernanceWorkspaceNav } from "@/components/governance-workspace-nav";
import { loadCompanyPostModerationQueue } from "@/lib/company-posts";
import { companyPostReportReasonLabel } from "@/lib/company-posts-model";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";

import { moderateCompanyPost } from "./actions";

/**
 * CPOST1: moderation queue for company posts. Lists posts hidden after
 * reports and published posts with open reports. Reading needs
 * network_trust.posts_read; every decision needs network_trust.posts_moderate.
 * Staff sees the company, never the author's identity.
 */
function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
}

export default async function PlatformCompanyPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformPermission("network_trust.posts_read");
  const [queue, access, params] = await Promise.all([
    loadCompanyPostModerationQueue(),
    getPlatformAccessContext(),
    searchParams,
  ]);
  const permissions = access?.permissions ?? [];
  const canModerate = permissions.includes("network_trust.posts_moderate");
  const hidden = queue?.filter((item) => item.status === "hidden").length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GovernanceWorkspaceNav current="trust" permissions={permissions} />

      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">CPOST1 · Network Trust</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18263d]">Post delle aziende</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
          I post sono pubblicati subito dalle aziende verificate. Qui arrivano quelli segnalati: dopo segnalazioni
          da tre aziende diverse il post viene nascosto in automatico finché non decidi. Ripristinare chiude le
          segnalazioni come infondate; nascondere o rimuovere le chiude come accolte. La rimozione è definitiva.
        </p>
        <Link href="/platform/network-trust" className="mt-4 inline-flex text-xs font-semibold text-[#1a5144] underline-offset-4 hover:underline">
          ← Torna a Network Trust
        </Link>
      </section>

      {params.message ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{params.message}</div>
      ) : null}
      {params.error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{params.error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["In coda", queue?.length ?? "—"],
          ["Nascosti in attesa", queue ? hidden : "—"],
          ["Pubblicati con segnalazioni", queue ? queue.length - hidden : "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-2xl font-semibold text-[#1d2824]">{String(value)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#8fa1a9]">{label}</p>
          </div>
        ))}
      </section>

      {!canModerate ? (
        <p className="rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-4 text-sm text-[#52615b]">
          Accesso in sola lettura: per decidere serve il permesso di moderazione dei post.
        </p>
      ) : null}

      {queue === null ? (
        <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          La coda non è leggibile adesso. Riprova tra poco.
        </p>
      ) : queue.length === 0 ? (
        <p role="status" data-testid="company-posts-queue-empty" className="rounded-2xl border border-[#dce2df] bg-white p-6 text-sm text-[#52615b]">
          Nessun post da moderare.
        </p>
      ) : (
        <ul className="space-y-4" data-testid="company-posts-queue">
          {queue.map((item) => (
            <li key={item.id}>
              <article className="rounded-2xl border border-[#dce2df] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1d2824]">{item.companyName}</p>
                    <p className="mt-0.5 text-xs text-[#66736e]">
                      Pubblicato {when(item.createdAt)}{item.editedAt ? " · modificato " + when(item.editedAt) : ""}
                      {item.companyVerification !== "verified" ? " · spunta non più attiva" : ""}
                    </p>
                  </div>
                  <span className={"rounded-full px-3 py-1 text-xs font-semibold " +
                    (item.status === "hidden" ? "bg-amber-100 text-amber-800" : "bg-[#e1ece8] text-[#1a5144]")}>
                    {item.status === "hidden" ? "Nascosto in attesa" : "Pubblicato"} · {item.openReports} segnalazioni aperte
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-line break-words rounded-xl bg-[#f8faf9] p-4 text-sm leading-6 text-[#1d2824]">{item.body}</p>

                {item.reports.length ? (
                  <ul className="mt-4 space-y-2">
                    {item.reports.map((report) => (
                      <li key={report.id} className="rounded-xl border border-[#eef1ef] px-3 py-2 text-xs text-[#43524c]">
                        <span className="font-semibold">{companyPostReportReasonLabel(report.reason)}</span>
                        <span className="text-[#8fa1a9]"> · {when(report.createdAt)}</span>
                        {report.details ? <p className="mt-1 whitespace-pre-line text-[#52615b]">{report.details}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {canModerate ? (
                  <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#eef1ef] pt-4">
                    {item.status === "hidden" ? (
                      <form action={moderateCompanyPost}>
                        <input type="hidden" name="post_id" value={item.id} />
                        <input type="hidden" name="decision" value="restore" />
                        <button type="submit" className="rounded-xl border border-[#cfe0d8] bg-[#e1ece8] px-3 py-2 text-xs font-semibold text-[#1a5144]">
                          Ripristina (segnalazioni infondate)
                        </button>
                      </form>
                    ) : (
                      <form action={moderateCompanyPost}>
                        <input type="hidden" name="post_id" value={item.id} />
                        <input type="hidden" name="decision" value="hide" />
                        <button type="submit" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                          Nascondi
                        </button>
                      </form>
                    )}
                    <form action={moderateCompanyPost} className="flex min-w-[260px] flex-1 flex-wrap items-end gap-2">
                      <input type="hidden" name="post_id" value={item.id} />
                      <input type="hidden" name="decision" value="remove" />
                      <label className="min-w-[200px] flex-1 text-xs font-semibold text-[#43524c]">
                        Nota per l’audit (obbligatoria per rimuovere)
                        <input name="note" required maxLength={2000}
                          className="mt-1 w-full rounded-xl border border-[#d7dfdb] px-3 py-2 text-xs font-normal text-[#1d2824]" />
                      </label>
                      <ConfirmSubmitButton
                        title="Rimuovere definitivamente questo post?"
                        description="Il post sparisce dal feed e non può essere ripristinato. Le segnalazioni aperte vengono chiuse come accolte e la decisione resta nel registro."
                        confirmLabel="Rimuovi post"
                        pendingLabel="Rimozione…"
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Rimuovi
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
