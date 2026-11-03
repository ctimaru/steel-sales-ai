"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./commercial-rfq-workspace.module.css";

/**
 * COMM-RFQ-UX2.A: one conversation and one structural Distinta preview.
 * The mobile tabs hide presentation only: both panels remain mounted so an
 * in-flight review, draft text and edit state are never lost on tab changes.
 */
export function CommercialRfqWorkspace({
  conversation, preview, approvedCount, proposalCount,
}: {
  conversation: ReactNode;
  preview: ReactNode;
  approvedCount: number;
  proposalCount: number;
}) {
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const chatId = useId();
  const previewId = useId();
  const draftCount = approvedCount + proposalCount;

  return (
    <section data-testid="commercial-rfq-chat-workspace" aria-label="Preparazione distinta conversazionale"
      className={`min-w-0 overflow-visible rounded-2xl bg-white ${styles.workspace}`}>
      <div role="tablist" aria-label="Vista richiesta" className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-[#f2f6f3] p-1 xl:hidden">
        <button type="button" role="tab" id={chatId + "-tab"} aria-controls={chatId}
          aria-selected={mobileView === "chat"} onClick={() => setMobileView("chat")}
          className={mobileView === "chat"
            ? "min-h-11 rounded-lg bg-white px-3 text-sm font-bold text-[#175640] shadow-sm"
            : "min-h-11 rounded-lg px-3 text-sm font-semibold text-[#51645b]"}>
          Conversazione
        </button>
        <button type="button" role="tab" id={previewId + "-tab"} aria-controls={previewId}
          aria-selected={mobileView === "preview"} onClick={() => setMobileView("preview")}
          className={mobileView === "preview"
            ? "min-h-11 rounded-lg bg-white px-3 text-sm font-bold text-[#175640] shadow-sm"
            : "min-h-11 rounded-lg px-3 text-sm font-semibold text-[#51645b]"}>
          Distinta {draftCount > 0 ? `· ${draftCount}` : ""}
        </button>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(295px,1fr)] xl:items-start">
        <div id={chatId} role="tabpanel" aria-labelledby={chatId + "-tab"}
          className={mobileView === "preview" ? "hidden min-w-0 xl:block" : "min-w-0"}>
          <div data-testid="commercial-rfq-conversation-pane"
            className="min-w-0 rounded-2xl border border-[#dbe7df] bg-[#fbfdfb] p-3 sm:p-4">
            {conversation}
          </div>
        </div>
        <div id={previewId} role="tabpanel" aria-labelledby={previewId + "-tab"}
          className={mobileView === "chat" ? "hidden min-w-0 xl:block" : "min-w-0"}>
          <div data-testid="commercial-rfq-preview-pane"
            className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
            {preview}
          </div>
        </div>
      </div>
    </section>
  );
}
