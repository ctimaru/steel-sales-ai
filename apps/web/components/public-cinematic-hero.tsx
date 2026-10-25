import Link from "next/link";
import styles from "./public-cinematic-hero.module.css";

/**
 * HOME-CINE1A: static, original cinematic concept for public acquisition.
 * No external media, private data, client JavaScript or unverified AI claims.
 * The geometry/network scene is decorative; the product preview is explicitly illustrative.
 */
export function PublicCinematicHero({ locale }: { locale: "it" | "en" }) {
  const en = locale === "en";
  const links = en
    ? { builder: "/en/distinta", register: "/en/register", calculator: "/en/knowledge/tubes", knowledge: "/en/knowledge", network: "/en/network" }
    : { builder: "/distinta", register: "/register", calculator: "/knowledge/tubes?source=home&surface=hero#calcolatore-pesi", knowledge: "/knowledge", network: "#network" };

  return (
    <section aria-labelledby="home-cinematic-title" className={styles.hero}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.visual} aria-hidden="true">
        <svg className={styles.steel} viewBox="0 0 900 770" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cine-metal" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#B5CBC6" stopOpacity=".86" />
              <stop offset=".16" stopColor="#435F61" />
              <stop offset=".32" stopColor="#0B2429" />
              <stop offset=".56" stopColor="#839E9D" />
              <stop offset=".72" stopColor="#162D31" />
              <stop offset="1" stopColor="#6F918B" />
            </linearGradient>
            <linearGradient id="cine-metal-dark" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#597574" />
              <stop offset=".28" stopColor="#142C30" />
              <stop offset=".56" stopColor="#75928E" />
              <stop offset=".83" stopColor="#09191C" />
              <stop offset="1" stopColor="#6B8581" />
            </linearGradient>
            <linearGradient id="cine-emerald" x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#13A16E" stopOpacity="0" />
              <stop offset=".52" stopColor="#6CFFCE" stopOpacity=".9" />
              <stop offset="1" stopColor="#13A16E" stopOpacity=".1" />
            </linearGradient>
            <radialGradient id="cine-interior">
              <stop stopColor="#020E10" />
              <stop offset=".76" stopColor="#0A1C20" />
              <stop offset="1" stopColor="#203C3B" />
            </radialGradient>
            <filter id="cine-softlight" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          <g opacity=".24" stroke="#5DCDA6" strokeWidth="1">
            <path d="M130 640 L840 275 M210 722 L888 345 M310 746 L900 458 M450 65 L810 205" />
            <path d="M210 240 L870 630 M122 390 L820 748 M530 35 L880 590" strokeDasharray="5 14" />
          </g>
          <g opacity=".5" filter="url(#cine-softlight)">
            <path d="M65 590 Q370 430 850 180" stroke="#28D393" strokeWidth="14" />
          </g>
          <g>
            <path d="M478 270 L733 82 Q829 56 862 181 L622 434 Z" fill="url(#cine-metal)" stroke="#829D99" strokeWidth="2" />
            <path d="M506 286 L758 99" stroke="#D0E0DD" strokeOpacity=".72" strokeWidth="4" />
            <path d="M623 430 L863 181" stroke="#4BB79B" strokeOpacity=".55" strokeWidth="4" />
            <ellipse cx="507" cy="352" rx="116" ry="123" transform="rotate(-17 507 352)" fill="url(#cine-metal-dark)" stroke="#B2CAC3" strokeWidth="5" />
            <ellipse cx="507" cy="352" rx="90" ry="96" transform="rotate(-17 507 352)" fill="url(#cine-interior)" stroke="#90A6A1" strokeWidth="9" />
            <ellipse cx="507" cy="352" rx="75" ry="81" transform="rotate(-17 507 352)" stroke="#0E3431" strokeWidth="2" />
            <path d="M435 261 C497 224 572 238 601 306" stroke="#E7F6EF" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round" />
          </g>
          <g>
            <path d="M495 542 L768 366 Q822 337 865 373 L595 555" fill="url(#cine-metal-dark)" stroke="#91A6A1" strokeWidth="4" />
            <path d="M864 374 L864 515 L596 683 L595 555 Z" fill="url(#cine-metal)" stroke="#3F655C" strokeWidth="3" />
            <rect x="442" y="526" width="232" height="142" rx="27" fill="url(#cine-metal)" stroke="#C3D5CF" strokeWidth="5" />
            <rect x="463" y="546" width="191" height="102" rx="15" fill="url(#cine-interior)" stroke="#93AAA5" strokeWidth="8" />
            <path d="M478 541 L638 541" stroke="#E5F4EC" strokeOpacity=".55" strokeWidth="3" />
          </g>
          <g>
            <path d="M180 534 L420 388 L517 436 L289 583 Z" fill="url(#cine-metal)" stroke="#82938C" strokeWidth="3" />
            <path d="M517 436 L517 581 L289 708 L289 583 Z" fill="url(#cine-metal-dark)" />
            <rect x="170" y="526" width="165" height="168" rx="18" fill="url(#cine-metal-dark)" stroke="#B0C4BD" strokeWidth="5" />
            <rect x="188" y="545" width="129" height="130" rx="8" fill="url(#cine-interior)" stroke="#819D94" strokeWidth="8" />
          </g>
          <path d="M90 621 C293 454 604 547 861 284" stroke="url(#cine-emerald)" strokeWidth="2" />
          <path d="M227 683 C411 497 661 703 879 421" stroke="#1DCC93" strokeOpacity=".52" strokeWidth="1.5" strokeDasharray="4 8" />
          {[[150,575],[313,493],[460,526],[645,490],[793,339],[867,424]].map(([x,y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="13" fill="#33EFAE" opacity=".14" />
              <circle cx={x} cy={y} r="4" fill="#91FFD0" />
            </g>
          ))}
        </svg>
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
              ? "From technical specifications to new business connections. Discover steel knowledge, build your RFQ bill and explore a more intelligent commercial ecosystem."
              : "Dalle specifiche tecniche alle nuove connessioni commerciali. Calcola, crea distinte ed esplora un ecosistema più intelligente per il business dell’acciaio."}
          </p>
          <div className={styles.actions}>
            <Link href={links.builder} className={styles.primary}>
              {en ? "Create a free RFQ bill" : "Crea una distinta gratis"} <span aria-hidden="true">↗</span>
            </Link>
            <Link href={links.register} className={styles.secondary}>
              {en ? "Register your company" : "Registra la tua azienda"} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className={styles.caveat}>
            {en
              ? "Public tools require no account. Company workspaces are subject to registration, review and access permissions."
              : "Strumenti pubblici senza account. I workspace aziendali richiedono registrazione, verifica e abilitazione."}
          </p>
          <nav className={styles.quickLinks} aria-label={en ? "Discover public tools" : "Esplora gli strumenti pubblici"}>
            <Link href={links.calculator}>{en ? "Tube calculator" : "Calcolo pesi"}</Link>
            <Link href={links.network}>Network</Link>
            <Link href={links.knowledge}>{en ? "Steel knowledge" : "Scuola"}</Link>
          </nav>
        </div>
        <div className={styles.visualCaption} aria-hidden="true">
          <span className={styles.captionKicker}>01 / 03</span>
          <span>{en ? "MATERIAL · DATA · CONNECTIONS" : "MATERIA · DATI · CONNESSIONI"}</span>
        </div>
        <div className={styles.productHint} aria-hidden="true">
          <span className={styles.hintLabel}>{en ? "PLATFORM CONCEPT" : "CONCEPT DI PIATTAFORMA"}</span>
          <strong>{en ? "From a bill to an RFQ" : "Dalla distinta alla RFQ"}</strong>
          <span className={styles.hintFlow}>{en ? "Technical input · Controlled workflow" : "Dati tecnici · Processo governato"}</span>
          <span className={styles.hintFooter}>{en ? "Illustrative — not live data" : "Illustrativo — non sono dati reali"}</span>
        </div>
      </div>
    </section>
  );
}
