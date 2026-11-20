"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  loadNetworkRdoModalCatalog,
  loadNetworkRdoModalContext,
  type NetworkRdoModalContext,
} from "@/app/(workspace)/rfq-hub/distinta/reuse-actions";
import type { BuyerDistintaCatalogOption } from "@/lib/buyer-distinta-catalog";
import { NetworkRdoDistintaPicker } from "@/components/network-rdo-distinta-picker";

const BuyerDistintaBuilder = dynamic(
  () => import("@/components/buyer-distinta-builder").then((mod) => mod.BuyerDistintaBuilder),
  { ssr: false, loading: () => (
    <p role="status" className="py-8 text-sm text-[#416450]">Caricamento della Distinta…</p>
  ) },
);
type ReadyContext = Extract<NetworkRdoModalContext, { ok: true }>;
type Mode = "saved" | "new";

/** NET-RDO-INLINE2 — Company-originated, accessible modal.
 * Native showModal traps focus and keeps the Network profile inert underneath;
 * neither opening nor loading a Distinta changes the current route.
 * Only the buyer's explicit «Scegli i fornitori» step enters the RFQ workspace.
 */
export function NetworkRdoModalLauncher({
  companyId, companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [context, setContext] = useState<ReadyContext | null>(null);
  const [contextPending, setContextPending] = useState(false);
  const [contextError, setContextError] = useState("");
  const [mode, setMode] = useState<Mode>("new");
  const [catalog, setCatalog] = useState<BuyerDistintaCatalogOption[] | null>(null);
  const [catalogPending, setCatalogPending] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    if (!opened) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [opened]);

  async function fetchCatalog() {
    if (catalog !== null || catalogPending) return;
    setCatalogPending(true);
    setCatalogError("");
    try {
      const result = await loadNetworkRdoModalCatalog(companyId);
      if (!result.ok) {
        setCatalogError(result.error || "Non è possibile aprire il configuratore.");
        return;
      }
      setCatalog(result.options);
    } catch {
      setCatalogError("Impossibile caricare la Distinta. Riprova.");
    } finally {
      setCatalogPending(false);
    }
  }

  async function fetchContext() {
    if (contextPending) return;
    setContextPending(true);
    setContextError("");
    try {
      const result = await loadNetworkRdoModalContext(companyId);
      if (!result.ok) {
        setContextError(result.error);
        return;
      }
      setContext(result);
      if (result.items.length) setMode("saved");
      else {
        setMode("new");
        void fetchCatalog();
      }
    } catch {
      setContextError("Non riesco a caricare le Distinte. Riprova.");
    } finally {
      setContextPending(false);
    }
  }

  function showModal() {
    if (dialog.current?.open) return;
    dialog.current?.showModal();
    setOpened(true);
    if (!context) void fetchContext();
  }

  function switchToNew() {
    setMode("new");
    if (catalog === null) void fetchCatalog();
  }

  function continueRdo(href: string) {
    dialog.current?.close();
    setOpened(false);
    router.push(href);
  }

  return (
    <>
      <button type="button" onClick={showModal}
        data-testid="network-profile-request-rdo"
        aria-haspopup="dialog"
        aria-controls="network-rdo-modal"
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#174f37] px-3.5 text-[13px] font-bold !bg-[#174f37] !text-white shadow-sm transition-colors hover:!bg-[#0e3c29] hover:!text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f37] [&_span]:!text-white">
        Richiedi offerta <span aria-hidden="true">✉</span>
      </button>
      <dialog ref={dialog} id="network-rdo-modal" aria-labelledby={dialogTitleId}
        onClose={() => setOpened(false)}
        data-testid="network-rdo-modal"
        className="m-auto max-h-[100dvh] w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-white p-0 text-[#183e2e] shadow-2xl backdrop:bg-[#081e15]/65 sm:max-h-[94dvh] sm:w-[min(96vw,1200px)] sm:rounded-2xl sm:border sm:border-[#c9dfd0]">
        <div className="sticky top-0 z-20 flex min-w-0 items-start justify-between gap-3 border-b border-[#dce7df] bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#548068]">Network · RDO privata</p>
            <h2 id={dialogTitleId} className="mt-1 truncate text-lg font-semibold text-[#173e2c] sm:text-xl">
              Distinta per {context?.companyName || companyName}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#5c7263]">
              Prepara la richiesta qui. Nessuna email parte senza la tua conferma.
            </p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()}
            aria-label="Chiudi la Distinta" data-testid="network-rdo-modal-close"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ccdcd0] bg-white text-xl font-bold !text-[#1b5038] hover:bg-[#f0f6f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647]">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="min-w-0 px-3 py-4 sm:px-6 sm:py-5" data-testid="network-rdo-modal-body">
          {contextPending && !context ? (
            <div role="status" className="space-y-3 py-8 text-sm text-[#426451]">
              <div className="h-3 w-40 animate-pulse rounded bg-[#e2ece4]" />
              <div className="h-12 w-full animate-pulse rounded-lg bg-[#eef4ef]" />
              Caricamento delle tue Distinte…
            </div>
          ) : contextError ? (
            <div role="alert" className="space-y-3 py-6">
              <p className="text-sm text-[#8d382b]">{contextError}</p>
              <button type="button" onClick={() => void fetchContext()}
                className="min-h-10 rounded-lg border border-[#bbd4c1] px-4 text-sm font-bold text-[#23563c]">
                Riprova
              </button>
            </div>
          ) : context ? (
            <>
              {context.items.length ? (
                <div role="tablist" aria-label="Come preparare la Distinta"
                  className="mb-5 flex flex-wrap gap-1.5 border-b border-[#e2ece5] pb-3">
                  <button type="button" role="tab" aria-selected={mode === "saved"}
                    onClick={() => setMode("saved")} data-testid="network-rdo-tab-saved"
                    className={"min-h-10 rounded-lg px-3.5 text-sm font-semibold transition-colors " +
                      (mode === "saved" ? "bg-[#175640] !text-white" : "bg-[#f0f5f1] text-[#245940] hover:bg-[#e1eee4]")}>
                    Distinte salvate ({context.items.length})
                  </button>
                  <button type="button" role="tab" aria-selected={mode === "new"}
                    onClick={switchToNew} data-testid="network-rdo-tab-new"
                    className={"min-h-10 rounded-lg px-3.5 text-sm font-semibold transition-colors " +
                      (mode === "new" ? "bg-[#175640] !text-white" : "bg-[#f0f5f1] text-[#245940] hover:bg-[#e1eee4]")}>
                    Nuova Distinta
                  </button>
                </div>
              ) : null}
              {context.listError ? <p role="status" className="mb-3 text-sm text-[#82601d]">
                Le Distinte salvate non sono disponibili. Puoi comunque crearne una nuova.
              </p> : null}
              {mode === "saved" && context.items.length ? (
                <NetworkRdoDistintaPicker
                  embedded
                  networkCompanyId={context.companyId}
                  companyName={context.companyName}
                  items={context.items}
                  newHref={"/rfq-hub/distinta?network=" + encodeURIComponent(context.companyId) + "&nuova=1"}
                  onCreateNew={switchToNew}
                  onPrepared={continueRdo}
                />
              ) : null}
              {catalog !== null ? (
                <div hidden={mode !== "new"} data-testid="network-rdo-inline-distinta" className="min-w-0">
                  <BuyerDistintaBuilder
                    authenticated workspace focusAiIntake
                    catalogOptions={catalog}
                    organizationId={context.organizationId}
                    userId={context.userId}
                    stepTwoNetworkCompanyId={context.companyId}
                    locale="it"
                  />
                </div>
              ) : mode === "new" ? (
                <div role="status" className="space-y-2 py-6 text-sm text-[#416450]">
                  {catalogError ? <p role="alert" className="text-[#9c3d26]">{catalogError}</p> :
                    <p>{catalogPending ? "Caricamento configuratore Distinta…" : "Preparazione della Distinta…"}</p>}
                  {catalogError ? <button type="button" onClick={() => void fetchCatalog()}
                    className="min-h-10 rounded-lg border border-[#bad4c1] px-3 text-sm font-semibold text-[#22563a]">
                    Riprova
                  </button> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
