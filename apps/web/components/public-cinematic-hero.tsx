import Link from "next/link";
import styles from "./public-cinematic-hero.module.css";

/**
 * HOME-CINE1B: cinematic experience without video, JavaScript or WebGL.
 * Local poster remains readable without motion; all animated elements are decorative.
 * Network hints and RFQ stages illustrate a user-governed flow, not live company data.
 */
export function PublicCinematicHero({ locale }: { locale: "it" | "en" }) {
  const en = locale === "en";
  const links = en
    ? { builder: "/en/distinta", calculator: "/en/knowledge/tubes", knowledge: "/en/knowledge", network: "/en/network" }
    : { builder: "/distinta", calculator: "/knowledge/tubes?source=home&surface=hero#calcolatore-pesi", knowledge: "/knowledge", network: "#network" };

  return (
    <>
    <section aria-labelledby="home-cinematic-title" className={styles.hero}>
      <div className={styles.ambient} data-home-cine-motion="photo" aria-hidden="true" />
      <div className={styles.intelligenceOverlay} data-home-cine-motion="network" aria-hidden="true">
        <svg viewBox="0 0 560 410" xmlns="http://www.w3.org/2000/svg" fill="none" focusable="false">
          <defs>
            <linearGradient id="cine1b-network" x1="12" y1="0" x2="480" y2="360" gradientUnits="userSpaceOnUse">
              <stop stopColor="#64FFBE" stopOpacity=".08" />
              <stop offset=".48" stopColor="#64FFBE" stopOpacity=".72" />
              <stop offset="1" stopColor="#64FFBE" stopOpacity=".12" />
            </linearGradient>
          </defs>
          <g stroke="url(#cine1b-network)" strokeWidth="1.2">
            <path d="M38 275 129 159 254 210 377 87 499 153 441 333 280 359 38 275Z" />
            <path d="M129 159 441 333M254 210 499 153M377 87 280 359" strokeDasharray="5 10" />
          </g>
          <g fill="#84FFD3">
            <circle cx="38" cy="275" r="3" />
            <circle cx="129" cy="159" r="3" />
            <circle cx="254" cy="210" r="4" className={styles.networkPulse} />
            <circle cx="377" cy="87" r="3" />
            <circle cx="499" cy="153" r="4" className={styles.networkPulse} />
            <circle cx="441" cy="333" r="3" />
            <circle cx="280" cy="359" r="3" />
          </g>
          <circle cx="254" cy="210" r="17" stroke="#70EDBB" strokeOpacity=".25" />
          <circle cx="499" cy="153" r="21" stroke="#70EDBB" strokeOpacity=".19" />
        </svg>
        <span className={styles.networkLabel}>{en ? "CONNECTED INDUSTRY" : "FILIERA CONNESSA"}</span>
      </div>

      <div className={styles.container}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <span className={styles.signal} aria-hidden="true" />
            Super Intelligence Ready <span className={styles.eyebrowDivider} aria-hidden="true">/</span>
            {en ? "STEEL & TUBE" : "INDUSTRIA STEEL & TUBE"}
          </p>
          <h1 id="home-cinematic-title" className={styles.title}>
            {en ? "Steel has a new" : "L’acciaio ha una"}
            <span>{en ? " intelligence." : " nuova intelligenza."}</span>
          </h1>
          <p className={styles.description}>
            {en
              ? "Start with the tube calculator: choose your dimensions, check theoretical weight, then build a clear RFQ bill. From technical requirements to business connections."
              : "Inizia dalla calcolatrice: scegli le dimensioni, verifica il peso teorico e crea la tua distinta. Dalle specifiche tecniche alle nuove opportunità commerciali."}
          </p>
          <div className={styles.actions}>
            <Link href={links.calculator} className={styles.primary}>
              {en ? "Open tube calculator" : "Apri calcolatrice"} <span aria-hidden="true">↗</span>
            </Link>
            <Link href={links.builder} className={styles.secondary}>
              {en ? "Create a free RFQ bill" : "Crea una distinta gratis"} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className={styles.caveat}>
            {en
              ? "Public tools require no account. Company workspaces are subject to registration, review and access permissions."
              : "Strumenti pubblici senza account. I workspace aziendali richiedono registrazione, verifica e abilitazione."}
          </p>
          <nav className={styles.quickLinks} aria-label={en ? "Discover public tools" : "Esplora gli strumenti pubblici"}>
            <Link href="#steel-tools-proof">{en ? "How it works" : "Come funziona"}</Link>
            <Link href={links.network}>Network</Link>
            <Link href={links.knowledge}>{en ? "Steel knowledge" : "Scuola"}</Link>
          </nav>
        </div>
        <div className={styles.visualCaption} aria-hidden="true">
          <span className={styles.captionKicker}>01 / 03</span>
          <span>{en ? "MATERIAL · DATA · CONNECTIONS" : "MATERIA · DATI · CONNESSIONI"}</span>
        </div>
        <div className={styles.productHint} data-home-cine-motion="product" aria-hidden="true">
          <span className={styles.hintLabel}>{en ? "PLATFORM CONCEPT" : "CONCEPT DI PIATTAFORMA"}</span>
          <strong>{en ? "From a bill to an RFQ" : "Dalla distinta alla RFQ"}</strong>
          <div className={styles.workflowTrack}>
            <span><b>01</b>{en ? "Bill" : "Distinta"}</span>
            <i aria-hidden="true">›</i>
            <span><b>02</b>RFQ</span>
            <i aria-hidden="true">›</i>
            <span><b>03</b>{en ? "Offers" : "Offerte"}</span>
          </div>
          <span className={styles.hintFlow}>{en ? "Technical input · Controlled workflow" : "Dati tecnici · Processo governato"}</span>
          <span className={styles.hintFooter}>{en ? "Illustrative — not live data" : "Illustrativo — non sono dati reali"}</span>
        </div>
      </div>
    </section>
    <section className={styles.bridge} aria-label={en ? "From material to business intelligence" : "Dalla materia all'intelligenza commerciale"}>
      <div className={styles.bridgeInner}>
        <p className={styles.bridgeEyebrow}>{en ? "ONE CONNECTED WORKFLOW" : "UN UNICO PERCORSO"}</p>
        <ol className={styles.bridgeSteps}>
          <li><span>01</span><strong>{en ? "Technical knowledge" : "Conoscenza tecnica"}</strong></li>
          <li><span>02</span><strong>{en ? "Bill & RFQ" : "Distinta e RFQ"}</strong></li>
          <li><span>03</span><strong>{en ? "Business connections" : "Relazioni commerciali"}</strong></li>
        </ol>
      </div>
    </section>
    </>
  );
}
