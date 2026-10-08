"use client";

import { useFormStatus } from "react-dom";

export function NotificationFormButton({
  label, tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        "inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35] disabled:opacity-60",
        tone === "primary"
          ? "bg-[#173f35] text-white hover:bg-[#265d4c]"
          : "border border-[#d8e4df] bg-white text-[#365749] hover:bg-[#edf5f2]",
      ].join(" ")}
    >
      {pending ? "Salvataggio…" : label}
    </button>
  );
}
