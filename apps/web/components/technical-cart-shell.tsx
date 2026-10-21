"use client";

/**
 * CALC-NEXT1E — technical cart interaction shell shared between public
 * calculators and the private RFQ workbench. No commerce model is imported.
 * Consumers own their rows, tenant permissions, drafts and private prices.
 */
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./technical-cart-shell.module.css";

type TechnicalCartShellProps = {
  visible: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  count: number;
  title: string;
  eyebrow: string;
  summary: string;
  closeLabel: string;
  dialogId: string;
  titleId: string;
  bodyId?: string;
  dialogAriaLabel?: string;
  triggerTestId: string;
  overlayTestId: string;
  wide?: boolean;
  /** Use narrow 460px drawer only for the technical bill, not private workbench. */
  compact?: boolean;
  /** Private workspace only: return focus to the initiating inline/HUD CTA. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** Private workspace only: focus a row after opening the dialog. */
  pendingFocusRowRef?: RefObject<string | null>;
  children: ReactNode;
  /** Optional fixed footer outside the scrollable body. */
  footer?: ReactNode;
};

export function TechnicalCartShell({
  visible, open, onOpen, onClose, count, title, eyebrow, summary, closeLabel,
  dialogId, titleId, bodyId, dialogAriaLabel, triggerTestId, overlayTestId,
  wide = false, compact = false, restoreFocusRef, pendingFocusRowRef, children, footer,
}: TechnicalCartShellProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keep Escape behavior current without restarting focus/scroll effects on
  // each price, row or RFQ state update in a consuming editor.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const rowId = pendingFocusRowRef?.current;
    if (pendingFocusRowRef) pendingFocusRowRef.current = null;
    const row = rowId ? document.getElementById("buyer-row-" + rowId) : null;
    (row ?? dialog).focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(element => element.getClientRects().length > 0);
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      const origin = restoreFocusRef?.current;
      if (origin?.isConnected) origin.focus({ preventScroll: true });
      else triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open, restoreFocusRef, pendingFocusRowRef]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {visible ? (
        <button type="button" data-testid={triggerTestId} ref={triggerRef}
          aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}
          onClick={onOpen} className={styles.trigger}>
          <span aria-hidden="true" className={styles.icon}>▤</span>
          <span className={styles.triggerContent}>
            <span className={styles.triggerTitle}>{title} · {count}</span>
            <span className={styles.triggerSummary}>{summary}</span>
          </span>
          <span aria-hidden="true" className={styles.arrow}>↗</span>
        </button>
      ) : null}
      {open ? (
        <div data-testid={overlayTestId} className={styles.overlay}>
          <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
          <div id={dialogId} role="dialog" aria-modal="true" ref={dialogRef}
            aria-labelledby={dialogAriaLabel ? undefined : titleId}
            aria-label={dialogAriaLabel}
            tabIndex={-1} className={wide ? styles.dialogWide : compact ? styles.dialogCompact : styles.dialog}>
            <div className={styles.header}>
              <div className={styles.headingContent}>
                <p className={styles.eyebrow}>{eyebrow}</p>
                <h2 id={titleId} className={styles.heading}>{title} · {count}</h2>
                <p className={styles.summary}>{summary}</p>
              </div>
              <button type="button" onClick={onClose} className={styles.close}>
                {closeLabel} ×
              </button>
            </div>
            <div id={bodyId} className={styles.body}>{children}</div>
            {footer ? <div className={styles.footer}>{footer}</div> : null}
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
