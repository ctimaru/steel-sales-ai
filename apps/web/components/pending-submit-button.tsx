"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type PendingSubmitButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "disabled" | "children"
> & {
  children: ReactNode;
  pendingLabel?: ReactNode;
  disabled?: boolean;
};

export function PendingSubmitButton({
  children,
  pendingLabel = "Operazione in corso…",
  disabled = false,
  className,
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const blocked = disabled || pending;

  return (
    <button
      {...props}
      type="submit"
      disabled={blocked}
      aria-disabled={blocked}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
