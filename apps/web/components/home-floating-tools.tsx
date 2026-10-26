"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./home-floating-tools.module.css";

type Tool = "weights" | "request";
const copy = {
  it: {
    weights: "Pesi e Norme", request: "Crea una richiesta",
    dismiss: "Chiudi strumento", fullPage: "Apri a pagina intera",
    loading: "Caricamento strumento…",
  },
  en: {
    weights: "Weights & Standards", request: "Create an RFQ",
    dismiss: "Close tool", fullPage: "Open full page",
    loading: "Loading tool…",
  },
} as const;

/** HOME-CALC-FLOAT1B: real, same-origin tools; no duplicated calculation or RFQ logic.
 * Closed dialogs retain their frames and unsaved input for this homepage session.
 * Native modal dialogs make the background inert, including keyboard navigation.
 */
export function HomeFloatingTools({ locale }: { locale: "it" | "en" }) {
  const [active, setActive] = useState<Tool | null>(null);
  const [visited, setVisited] = useState<Tool[]>([]);
  const [loaded, setLoaded] = useState<Partial<Record<Tool, boolean>>>({});
  const dockRef = useRef<HTMLElement>(null);
  const dialogs = useRef<Partial<Record<Tool, HTMLDialogElement | null>>>({});
  const closeButtons = useRef<Partial<Record<Tool, HTMLButtonElement | null>>>({});
  const frameCleanup = useRef<Partial<Record<Tool, () => void>>>({});
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
  }

  useEffect(() => {
    if (!active) return;
    const dialog = dialogs.current[active];
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeButtons.current[active]?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      lastTrigger.current?.focus({ preventScroll: true });
    };
  }, [active]);

  useEffect(() => () => {
    Object.values(frameCleanup.current).forEach(cleanup => cleanup?.());
  }, []);

  // Cookie UI remains fully operable. Lift the dock only when its horizontal
  // footprint intersects the consent banner or the compact privacy control.
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const update = () => {
      const bounds = dock.getBoundingClientRect();
      let offset = 0;
      document.querySelectorAll<HTMLElement>(
        '[data-testid="mobile-cookie-consent"], [data-testid="privacy-reopen-button"]',
      ).forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width && rect.height && rect.left < bounds.right && rect.right > bounds.left) {
          offset = Math.max(offset, innerHeight - rect.top + 12);
        }
      });
      dock.style.setProperty("--consent-offset", `${offset}px`);
      dock.dataset.positioned = "true";
    };
    const resize = new ResizeObserver(update);
    const observe = () => {
      resize.disconnect();
      resize.observe(dock);
      document.querySelectorAll<HTMLElement>(
        '[data-testid="mobile-cookie-consent"], [data-testid="privacy-reopen-button"]',
      ).forEach(element => resize.observe(element));
      update();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    observe();
    return () => {
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  function frameLoaded(tool: Tool, frame: HTMLIFrameElement) {
    frameCleanup.current[tool]?.();
    setLoaded(previous => ({ ...previous, [tool]: true }));
    // Key events do not bubble across documents. Listen in the real tool after
    // each navigation; an inner cart/search consuming Escape gets first choice.
    // If navigation leaves our origin, keep the outer close/full-page controls.
    try {
      const doc = frame.contentDocument;
      const frameWindow = frame.contentWindow;
      if (!doc || !frameWindow) return;
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          setActive(null);
        }
      };
      frameWindow.addEventListener("keydown", onKey);
      frameCleanup.current[tool] = () => frameWindow.removeEventListener("keydown", onKey);
    } catch {
      // Cross-origin destinations cannot be inspected and never receive a bridge.
    }
  }

  return (
    <>
      <nav ref={dockRef} className={styles.dock} data-testid="home-floating-dock"
        aria-label={locale === "it" ? "Strumenti rapidi" : "Quick tools"}>
        {(["weights", "request"] as const).map((tool, index) => (
          <span key={tool} className={styles.dockItem}>
            {index ? <span className={styles.separator} aria-hidden="true" /> : null}
            <button type="button" className={styles.action} aria-haspopup="dialog"
              aria-controls={`home-floating-${tool}`} aria-expanded={active === tool}
              onClick={(event) => open(tool, event.currentTarget)}>
              <span className={styles.icon} aria-hidden="true">{tool === "weights" ? "◎" : "＋"}</span>{t[tool]}
            </button>
          </span>
        ))}
      </nav>
      {visited.map((tool) => (
        <dialog key={tool} ref={node => { dialogs.current[tool] = node; }}
          id={`home-floating-${tool}`} className={styles.panel} aria-modal="true"
          aria-labelledby={`home-floating-${tool}-title`}
          onCancel={event => { event.preventDefault(); dismiss(); }}
          onClick={event => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
          }}>
          <header className={styles.panelHeader}>
            <h2 id={`home-floating-${tool}-title`} className={styles.panelTitle}>{t[tool]}</h2>
            <a href={hrefs[tool]} className={styles.fullPage}>{t.fullPage}</a>
            <button ref={node => { closeButtons.current[tool] = node; }} className={styles.close}
              type="button" onClick={dismiss} aria-label={t.dismiss}>✕</button>
          </header>
          {!loaded[tool] ? <p role="status" className={styles.loading}>{t.loading}</p> : null}
          <iframe className={styles.frame} title={t[tool]} src={hrefs[tool]} loading="lazy"
            onLoad={event => frameLoaded(tool, event.currentTarget)} />
        </dialog>
      ))}
    </>
  );
}
