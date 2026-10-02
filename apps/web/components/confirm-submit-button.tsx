"use client";

import {
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const blocked = disabled || pending;

  function closeDialog() {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
        ref={triggerRef}
        type="button"
        disabled={blocked}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
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
          className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
          role="presentation"
        >
          <div
            ref={dialogRef}
            id={dialogId}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={handleDialogKeyDown}
            className="max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-3xl border border-[#dce2df] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"
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
                onClick={closeDialog}
                className="min-h-11 rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#43524c] hover:bg-[#f6f8f7]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={confirm}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${confirmClass}`}
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
