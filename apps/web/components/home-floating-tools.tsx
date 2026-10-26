"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./home-floating-tools.module.css";

type Tool = "weights" | "request";
const copy = {
  it: {
    weights: "Pesi e Norme", request: "Crea una richiesta",
    dismiss: "Chiudi strumento", panel: "Strumento", open: "Apri",
  },
  en: {
    weights: "Weights & Standards", request: "Create an RFQ",
    dismiss: "Close tool", panel: "Tool", open: "Open",
  },
} as const;

/**
 * HOME-CALC-FLOAT1A: an additive, home-only dock.
 * Real existing tools are mounted in same-origin iframes on first activation;
 * they are not screenshots, duplicates of business logic, or static mockups.
 * Once loaded, the iframe stays mounted when the sheet closes so unsaved form
 * values survive reopening during this page session.
 */
export function HomeFloatingTools({ locale }: { locale: "it" | "en" }) {
  const [active, setActive] = useState<Tool | null>(null);
  const [visited, setVisited] = useState<Tool[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const t = copy[locale];
  const hrefs = locale === "en"
    ? { weights: "/en/knowledge/tubes", request: "/en/distinta" }
    : { weights: "/knowledge/tubes#calcolatore-pesi", request: "/distinta" };

  function open(tool: Tool, button: HTMLButtonElement) {
    lastTrigger.current = button;
    setVisited((previous) => previous.includes(tool) ? previous : [...previous, tool]);
    setActive(tool);
  }

  function dismiss() {
    setActive(null);
    requestAnimationFrame(() => lastTrigger.current?.focus());
  }

  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActive(null);
        requestAnimationFrame(() => lastTrigger.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKey);
    };
  }, [active]);

  return (
    <>
      <nav className={styles.dock} aria-label={locale === "it" ? "Strumenti rapidi" : "Quick tools"}>
        <button type="button" className={styles.action} aria-haspopup="dialog" aria-expanded={active === "weights"}
          onClick={(event) => open("weights", event.currentTarget)}>
          <span className={styles.icon} aria-hidden="true">◎</span>{t.weights}
        </button>
        <span className={styles.separator} aria-hidden="true" />
        <button type="button" className={styles.action} aria-haspopup="dialog" aria-expanded={active === "request"}
          onClick={(event) => open("request", event.currentTarget)}>
          <span className={styles.icon} aria-hidden="true">＋</span>{t.request}
        </button>
      </nav>
      {visited.map((tool) => (
        <div key={tool} className={styles.backdrop} data-open={active === tool ? "true" : "false"}
          aria-hidden={active !== tool ? "true" : undefined}>
          <section className={styles.panel} role={active === tool ? "dialog" : undefined}
            aria-modal={active === tool ? "true" : undefined}
            aria-label={active === tool ? t[tool] : undefined}>
            <header className={styles.panelHeader}>
              <span className={styles.panelTitle}>{t[tool]}</span>
              <button ref={active === tool ? closeRef : undefined} className={styles.close}
                type="button" onClick={dismiss} aria-label={t.dismiss}>✕</button>
            </header>
            <iframe className={styles.frame} title={t[tool]} src={hrefs[tool]} loading="lazy" />
          </section>
        </div>
      ))}
    </>
  );
}
