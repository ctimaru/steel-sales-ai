import Link from "next/link";
import { redirect } from "next/navigation";

import {
  blockInquirySenderOrganization,
  reportNetworkInquiry,
  transitionNetworkInquiry,
} from "@/app/(workspace)/network/actions";
import { canInteractWithNetwork } from "@/lib/access-policy";
import { getActiveOrganizationContext, getNetworkInquiries } from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

function statusClass(status: string) {
  if (status === "responded") return "bg-emerald-50 text-emerald-700";
  if (status === "declined" || status === "blocked") return "bg-red-50 text-red-700";
  if (status === "read") return "bg-blue-50 text-blue-700";
  if (status === "closed" || status === "withdrawn") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

export default async function NetworkInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    box?: string;
    error?: string;
    message?: string;
  }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const params = await searchParams;
  const box = params.box === "sent" ? "sent" : "received";
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/network?error=Nessuna%20organization%20attiva");

  const result = await getNetworkInquiries(context.organization_id, box);
  const canInteract = canInteractWithNetwork(context.role);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
            ← Torna al Network
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">P4 · Interaction Layer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Inquiry</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Interazioni B2B private tra organizzazioni. Non sono messaggi pubblici né segnali di reputazione.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
          {result.total} {box === "received" ? "ricevute" : "inviate"}
        </span>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {params.error}
        </div>
      ) : null}
      {params.message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {params.message}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Link
          href="/network/inquiries?box=received"
          className={
            "rounded-xl px-4 py-2 text-sm font-semibold " +
            (box === "received" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600")
          }
        >
          Ricevute
        </Link>
        <Link
          href="/network/inquiries?box=sent"
          className={
            "rounded-xl px-4 py-2 text-sm font-semibold " +
            (box === "sent" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600")
          }
        >
          Inviate
        </Link>
      </div>

      {result.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">Nessuna inquiry {box === "received" ? "ricevuta" : "inviata"}</p>
          <p className="mt-2 text-sm text-slate-500">
            Le inquiry si avviano dai Company Profile eleggibili nel Network.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {result.items.map((inquiry) => {
            const canRecipientAct =
              canInteract && box === "received" && ["submitted", "read"].includes(inquiry.status);
            const canWithdraw = canInteract && box === "sent" && inquiry.status === "submitted";
            const canClose = canInteract && ["submitted", "read", "responded", "declined"].includes(inquiry.status);

            return (
              <article key={inquiry.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                      {box === "received"
                        ? "Da " + inquiry.sender_organization_name
                        : "A " + inquiry.recipient_company_name}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{inquiry.subject}</h2>
                    <p className="mt-2 text-xs text-slate-400">
                      {new Date(inquiry.submitted_at).toLocaleString("it-IT")}
                    </p>
                  </div>
                  <span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + statusClass(inquiry.status)}>
                    {inquiry.status}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{inquiry.body}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {canInteract && box === "received" && inquiry.status === "submitted" ? (
                    <form action={transitionNetworkInquiry}>
                      <input type="hidden" name="inquiry_id" value={inquiry.id} />
                      <input type="hidden" name="organization_id" value={context.organization_id} />
                      <input type="hidden" name="new_status" value="read" />
                      <input type="hidden" name="box" value={box} />
                      <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700">
                        Segna letta
                      </button>
                    </form>
                  ) : null}

                  {canRecipientAct ? (
                    <>
                      <form action={transitionNetworkInquiry}>
                        <input type="hidden" name="inquiry_id" value={inquiry.id} />
                        <input type="hidden" name="organization_id" value={context.organization_id} />
                        <input type="hidden" name="new_status" value="responded" />
                        <input type="hidden" name="box" value={box} />
                        <button className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">
                          Segna risposta
                        </button>
                      </form>
                      <form action={transitionNetworkInquiry}>
                        <input type="hidden" name="inquiry_id" value={inquiry.id} />
                        <input type="hidden" name="organization_id" value={context.organization_id} />
                        <input type="hidden" name="new_status" value="declined" />
                        <input type="hidden" name="box" value={box} />
                        <button className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">
                          Rifiuta
                        </button>
                      </form>
                    </>
                  ) : null}

                  {canWithdraw ? (
                    <form action={transitionNetworkInquiry}>
                      <input type="hidden" name="inquiry_id" value={inquiry.id} />
                      <input type="hidden" name="organization_id" value={context.organization_id} />
                      <input type="hidden" name="new_status" value="withdrawn" />
                      <input type="hidden" name="box" value={box} />
                      <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700">
                        Ritira
                      </button>
                    </form>
                  ) : null}

                  {canClose ? (
                    <form action={transitionNetworkInquiry}>
                      <input type="hidden" name="inquiry_id" value={inquiry.id} />
                      <input type="hidden" name="organization_id" value={context.organization_id} />
                      <input type="hidden" name="new_status" value="closed" />
                      <input type="hidden" name="box" value={box} />
                      <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">
                        Chiudi
                      </button>
                    </form>
                  ) : null}
                </div>

                {canInteract ? <details className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600">Sicurezza e moderazione</summary>
                  <div className="mt-3 space-y-3">
                    <form action={reportNetworkInquiry} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                      <input type="hidden" name="inquiry_id" value={inquiry.id} />
                      <input type="hidden" name="organization_id" value={context.organization_id} />
                      <input type="hidden" name="box" value={box} />
                      <select name="reason" defaultValue="spam" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                        <option value="spam">Spam</option>
                        <option value="inappropriate">Contenuto inappropriato</option>
                        <option value="fraud_suspicious">Frode / sospetto</option>
                        <option value="other">Altro</option>
                      </select>
                      <input
                        name="details"
                        maxLength={2000}
                        placeholder="Dettagli opzionali"
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                      />
                      <button className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">
                        Segnala
                      </button>
                    </form>

                    {box === "received" && context.role === "admin" ? (
                      <form action={blockInquirySenderOrganization}>
                        <input type="hidden" name="blocking_organization_id" value={context.organization_id} />
                        <input type="hidden" name="blocked_organization_id" value={inquiry.sender_organization_id} />
                        <button className="h-9 rounded-lg bg-red-700 px-3 text-xs font-semibold text-white">
                          Blocca organizzazione mittente
                        </button>
                      </form>
                    ) : null}
                  </div>
                </details> : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
