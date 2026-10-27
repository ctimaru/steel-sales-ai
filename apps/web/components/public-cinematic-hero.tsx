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
        <svg className={styles.globe} viewBox="0 0 480 410" xmlns="http://www.w3.org/2000/svg" fill="none" focusable="false">
          <defs>
            <radialGradient id="cine2a2-globe-fill" cx="0" cy="0" r="1" gradientTransform="translate(240 202) rotate(90) scale(181 195)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2DEDA2" stopOpacity=".18" />
              <stop offset="1" stopColor="#002719" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="cine2a2-arc" x1="74" y1="324" x2="418" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A5FFE0" stopOpacity=".08" />
              <stop offset=".56" stopColor="#8CFFD2" stopOpacity=".8" />
              <stop offset="1" stopColor="#A5FFE0" stopOpacity=".12" />
            </linearGradient>
          </defs>
          <ellipse cx="244" cy="211" rx="174" ry="165" fill="url(#cine2a2-globe-fill)" />
          <ellipse cx="244" cy="211" rx="172" ry="164" stroke="#79E9B7" strokeOpacity=".42" />
          <ellipse cx="244" cy="211" rx="103" ry="164" stroke="#79E9B7" strokeOpacity=".19" />
          <ellipse cx="244" cy="211" rx="38" ry="164" stroke="#79E9B7" strokeOpacity=".11" />
          <path d="M76 158Q242 190 414 158M72 216Q242 239 416 216M91 274Q243 308 398 274" stroke="#83F5C4" strokeOpacity=".2" />
          <path d="M117 90Q242 152 371 90M107 320Q241 272 382 320" stroke="#85D5B3" strokeOpacity=".15" />
          <g stroke="#8CF9C8" strokeOpacity=".34" strokeWidth="1">
            <path d="m166 150 24-18 35 8 24 28-18 12-12 35-23 9-26-31-26-3-10-18 32-22Z" />
            <path d="m235 234 31-18 29 23 4 32-23 28-12 36-21-20-2-35-15-27 9-19Z" />
            <path d="m264 126 35-14 48 19 24 25-13 31-32 8-13 22-23-19-25 2-20-25 19-49Z" />
            <path d="m125 223 21 8 14 30-9 27-20-15-13-29Z" />
          </g>
          <g stroke="url(#cine2a2-arc)" strokeWidth="1.3">
            <path d="M110 269Q218 91 365 142" />
            <path d="M140 154Q268 318 379 214" />
            <path d="M170 303Q306 109 398 244" strokeDasharray="4 8" />
          </g>
          <g fill="#B3FFDA">
            <circle cx="110" cy="269" r="3" />
            <circle cx="140" cy="154" r="3" />
            <circle cx="365" cy="142" r="4" className={styles.networkPulse} />
            <circle cx="379" cy="214" r="3" />
            <circle cx="170" cy="303" r="3" />
            <circle cx="398" cy="244" r="4" className={styles.networkPulse} />
            <circle cx="255" cy="181" r="3.5" className={styles.networkPulse} />
          </g>
          <circle cx="365" cy="142" r="17" stroke="#8FFFD1" strokeOpacity=".3" />
          <circle cx="255" cy="181" r="20" stroke="#8FFFD1" strokeOpacity=".24" />
        </svg>
        <span className={styles.orbitBadge + " " + styles.orbitCompany}>{en ? "COMPANIES" : "AZIENDE"}</span>
        <span className={styles.orbitBadge + " " + styles.orbitKnowledge}>{en ? "KNOWLEDGE" : "CONOSCENZA"}</span>
        <span className={styles.orbitBadge + " " + styles.orbitOpportunity}>{en ? "OPPORTUNITIES" : "OPPORTUNITÀ"}</span>
        <span className={styles.networkLabel}>{en ? "CONNECTED STEEL INDUSTRY" : "FILIERA CONNESSA"}</span>
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
              ? "From dimensions and theoretical weight to RFQ bills and commercial opportunities. One connected workflow."
              : "Dalle dimensioni al peso teorico, dalla distinta alle opportunità commerciali. Tutto in un unico percorso."}
          </p>
          <div className={styles.actions}>
            <Link href={links.calculator} className={styles.primary}>
              {en ? "Standards & weights" : "Norme e pesi"} <span aria-hidden="true">↗</span>
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
        <aside className={styles.productHint} data-home-cine-motion="product" aria-label={en ? "Illustrative technical workflow preview" : "Anteprima illustrativa del percorso tecnico"}>
          <span className={styles.hintLabel}>{en ? "TECHNICAL CALCULATOR" : "CALCOLATRICE TECNICA"}</span>
          <div className={styles.specHead}>
            <span className={styles.specIcon} aria-hidden="true">
              <svg viewBox="0 0 56 56" fill="none" focusable="false">
                <circle cx="25" cy="24" r="15" stroke="#BAFFE1" strokeWidth="4" />
                <circle cx="25" cy="24" r="9" stroke="#59CF98" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M32 37h16v13H32z" stroke="#8CF1C0" strokeWidth="2" />
              </svg>
            </span>
            <div>
              <strong>{en ? "Steel tube weight" : "Peso tubi in acciaio"}</strong>
              <span className={styles.specFamily}>CHS · SHS · RHS</span>
            </div>
          </div>
          <div className={styles.specFields} aria-label={en ? "Calculator capabilities" : "Funzioni calcolatrice"}>
            <span><b>01</b> {en ? "Standards & geometry" : "Norme e geometria"}</span>
            <span><b>02</b> {en ? "Theoretical weight" : "Peso teorico"}</span>
            <span><b>03</b> {en ? "RFQ bill ready" : "Distinta pronta per RFQ"}</span>
          </div>
          <div className={styles.workflowTrack} aria-hidden="true">
            <span><b>01</b>{en ? "Bill" : "Distinta"}</span>
            <i aria-hidden="true">›</i>
            <span><b>02</b>RFQ</span>
            <i aria-hidden="true">›</i>
            <span><b>03</b>{en ? "Offers" : "Offerte"}</span>
          </div>
          <span className={styles.hintFooter}>{en ? "Illustrative — not live data" : "Illustrativo — non sono dati reali"}</span>
        </aside>
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
