"use client";

import { useState } from "react";

export function InvestorShareLink({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/investor/access/${shareToken}`;

  async function copyLink() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-[#f2f4f3] px-2.5 py-2 text-[11px] text-[#52615b]">
        {path}
      </code>
      <button
        type="button"
        onClick={copyLink}
        className="shrink-0 rounded-lg border border-[#cbd8d3] bg-white px-3 py-2 text-xs font-semibold text-[#345047] hover:bg-[#f4f7f5]"
      >
        {copied ? "Copiato" : "Copia link"}
      </button>
    </div>
  );
}
