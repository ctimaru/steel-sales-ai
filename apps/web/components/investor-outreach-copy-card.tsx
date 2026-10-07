"use client";

import { useState } from "react";

export function InvestorOutreachCopyCard({
  label,
  subject,
  body,
}: {
  label: string;
  subject: string;
  body: string;
}) {
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  async function copy(value: string, kind: "subject" | "body") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">
            {label}
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{subject}</p>
        </div>
        <button
          type="button"
          onClick={() => copy(subject, "subject")}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)]"
        >
          {copied === "subject" ? "Copiato" : "Copia oggetto"}
        </button>
      </div>
      <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--surface-subtle)] p-4 font-sans text-xs leading-6 text-[var(--text-secondary)]">
        {body}
      </pre>
      <button
        type="button"
        onClick={() => copy(body, "body")}
        className="mt-3 rounded-lg bg-[var(--brand-deep)] px-3 py-2 text-[11px] font-semibold text-white"
      >
        {copied === "body" ? "Copiato" : "Copia messaggio"}
      </button>
    </article>
  );
}
