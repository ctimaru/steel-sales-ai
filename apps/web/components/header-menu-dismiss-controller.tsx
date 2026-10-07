"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const OPEN_HEADER_MENU_SELECTOR = "header details[open]";

function openHeaderMenus() {
  return Array.from(
    document.querySelectorAll<HTMLDetailsElement>(OPEN_HEADER_MENU_SELECTOR),
  );
}

function closeHeaderMenus() {
  for (const menu of openHeaderMenus()) {
    menu.open = false;
  }
}

export function HeaderMenuDismissController() {
  const pathname = usePathname();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target instanceof Node ? event.target : null;

      for (const menu of openHeaderMenus()) {
        if (!target || !menu.contains(target)) {
          menu.open = false;
        }
      }
    }

    function handleLinkClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("header details a[href]");
      const menu = link?.closest("details");

      if (menu instanceof HTMLDetailsElement) {
        menu.open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeHeaderMenus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleLinkClick, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleLinkClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    closeHeaderMenus();
  }, [pathname]);

  return null;
}
