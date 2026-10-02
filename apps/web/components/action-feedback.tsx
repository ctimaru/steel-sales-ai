import type { ReactNode } from "react";

type ActionFeedbackProps = {
  status: "idle" | "success" | "error";
  message?: ReactNode;
  pending?: boolean;
  pendingMessage?: ReactNode;
  id?: string;
  className?: string;
};

export function ActionFeedback({
  status,
  message,
  pending = false,
  pendingMessage = "Operazione in corso…",
  id,
  className = "",
}: ActionFeedbackProps) {
  const content = pending ? pendingMessage : message;
  if (!content) return null;

  const isError = status === "error";

  return (
    <p
      id={id}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={[
        "text-xs leading-5",
        isError ? "text-red-700" : "text-emerald-700",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {content}
    </p>
  );
}
