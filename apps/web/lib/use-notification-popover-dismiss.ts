"use client";

import { useEffect, type RefObject } from "react";

/**
 * A notification bell is a non-modal popover, not a <details> menu.
 * Dismiss on any outside pointerdown (mouse, touch, pen), even when a sticky
 * header or a higher-z-index control makes a full-screen backdrop unreliable.
 *
 * Capture phase lets the original click keep working: no preventDefault,
 * stopPropagation, or transparent button overlay.
 */
export function useNotificationPopoverDismiss({
  open,
  triggerRef,
  panelRef,
  onDismiss,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      // Do not dismiss when activating the bell again or interacting with
      // links, actions, and refresh controls inside the notification panel.
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onDismiss();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, triggerRef, panelRef, onDismiss]);
}
