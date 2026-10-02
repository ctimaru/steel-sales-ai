"use client";

import {
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  pendingLabel?: ReactNode;
  tone?: "danger" | "warning";
  className?: string;
  disabled?: boolean;
  formAction?: ButtonHTMLAttributes<HTMLButtonElement>["formAction"];
  name?: ButtonHTMLAttributes<HTMLButtonElement>["name"];
  value?: ButtonHTMLAttributes<HTMLButtonElement>["value"];
};

export function ConfirmSubmitButton({
  children,
  title,
  description,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  pendingLabel = "Operazione in corso…",
  tone = "danger",
  className,
  disabled = false,
  formAction,
  name,
  value,
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const blocked = disabled || pending;

  function confirm() {
    const submitter = submitRef.current;
    setOpen(false);

    queueMicrotask(() => {
      submitter?.form?.requestSubmit(submitter);
    });
  }

  const confirmClass =
    tone === "danger"
      ? "bg-rose-700 text-white hover:bg-rose-800"
      : "bg-amber-600 text-white hover:bg-amber-700";

  return (
    <>
      <button
        type="button"
        disabled={blocked}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={className}
      >
        {pending ? pendingLabel : children}
      </button>

      <button
        ref={submitRef}
        type="submit"
        formAction={formAction}
        name={name}
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        hidden
      />

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-md rounded-3xl border border-[#dce2df] bg-white p-6 shadow-2xl"
          >
            <p
              className={[
                "text-[11px] font-bold uppercase tracking-[0.14em]",
                tone === "danger" ? "text-rose-700" : "text-amber-700",
              ].join(" ")}
            >
              Conferma operazione
            </p>
            <h2 id={titleId} className="mt-2 text-xl font-semibold text-[#1d2824]">
              {title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-[#66736e]">
              {description}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                className="h-10 rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#43524c] hover:bg-[#f6f8f7]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={confirm}
                className={`h-10 rounded-xl px-4 text-sm font-semibold ${confirmClass}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
