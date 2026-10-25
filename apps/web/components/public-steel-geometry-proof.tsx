import Link from "next/link";
import styles from "./public-cinematic-continuity.module.css";

type Locale = "it" | "en";

const geometries = [
  { code: "CHS", it: "Tondo", en: "Circular", type: "circle" },
  { code: "SHS", it: "Quadro", en: "Square", type: "square" },
  { code: "RHS", it: "Rettangolare", en: "Rectangular", type: "rectangle" },
] as const;

/**
 * HOME-CINE1C: public, server-rendered technical product proof.
 * Geometry is illustrative only: no fictitious dimensions, weights or quotes.
 * All technical calculations live in the existing real public calculator.
 */
function ShapeMark({ shape }: { shape: "circle" | "square" | "rectangle" }) {
  return (
    <svg className={styles.shapeSvg} viewBox="0 0 160 110" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`home-cine-shape-${shape}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#E5F5EE" />
          <stop offset=".26" stopColor="#7C9F95" />
          <stop offset=".52" stopColor="#2A5850" />
          <stop offset=".83" stopColor="#ACC9BD" />
          <stop offset="1" stopColor="#42675D" />
        </linearGradient>
      </defs>
      {shape === "circle" ? (
        <>
          <circle cx="80" cy="55" r="38" fill={`url(#home-cine-shape-${shape})`} stroke="#D4EEE2" strokeWidth="2" />
          <circle cx="80" cy="55" r="25" fill="#071C19" stroke="#A3C3B5" strokeWidth="3" />
          <path d="M53 28A38 38 0 0 1 107 28" stroke="#E4FFEE" strokeOpacity=".8" strokeWidth="2" />
        </>
      ) : shape === "square" ? (
        <>
          <rect x="40" y="15" width="80" height="80" rx="4" fill={`url(#home-cine-shape-${shape})`} stroke="#D4EEE2" strokeWidth="2" />
          <rect x="53" y="28" width="54" height="54" rx="2" fill="#071C19" stroke="#A3C3B5" strokeWidth="3" />
          <path d="M43 18H117" stroke="#E4FFEE" strokeOpacity=".8" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="18" y="24" width="124" height="63" rx="4" fill={`url(#home-cine-shape-${shape})`} stroke="#D4EEE2" strokeWidth="2" />
          <rect x="32" y="38" width="96" height="35" rx="2" fill="#071C19" stroke="#A3C3B5" strokeWidth="3" />
          <path d="M22 27H138" stroke="#E4FFEE" strokeOpacity=".8" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

export function PublicSteelGeometryProof({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const calcHref = en ? "/en/knowledge/tubes" : "/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi";
  const billHref = en ? "/en/distinta" : "/distinta";

  return (
    <section id="steel-tools-proof" className={styles.proof} aria-labelledby="home-cine-proof-heading">
      <div className={styles.proofInner}>
        <div className={styles.proofLead}>
          <p className={styles.kicker}>02 / {en ? "REAL TOOLS · NO ACCOUNT" : "STRUMENTI REALI · SENZA ACCOUNT"}</p>
          <h2 id="home-cine-proof-heading" className={styles.proofTitle}>
            {en ? "From steel geometry to a clearer request." : "Dalla geometria a una richiesta più chiara."}
          </h2>
          <p className={styles.proofDescription}>
            {en
              ? "Start with steel grades, standards and real theoretical-weight tools. Keep the technical details together when preparing your bill of materials."
              : "Parti da norme, gradi e calcoli di peso teorico reali. Mantieni i dati tecnici ordinati quando prepari la tua distinta."}
          </p>
          <div className={styles.proofActions}>
            <Link href={calcHref} className={styles.proofPrimary}>
              {en ? "Open tube calculator" : "Apri il calcolatore"} <span aria-hidden="true">↗</span>
            </Link>
            <Link href={billHref} className={styles.proofSecondary}>
              {en ? "Create a bill" : "Crea una distinta"} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className={styles.accessNote}>
            {en
              ? "Technical tools are public. Sending private RFQs and supplier collaboration follow company access controls."
              : "Strumenti tecnici pubblici. L’invio di RFQ private e la collaborazione tra aziende seguono le abilitazioni."}
          </p>
        </div>
        <div className={styles.proofPanel}>
          <div className={styles.panelHeading}>
            <span className={styles.panelIndicator} aria-hidden="true" />
            <span>{en ? "TUBE GEOMETRY" : "GEOMETRIE TUBOLARI"}</span>
            <span className={styles.panelRight}>CHS / SHS / RHS</span>
          </div>
          <div className={styles.geometries}>
            {geometries.map((item) => (
              <div key={item.code} className={styles.shapeCard}>
                <ShapeMark shape={item.type} />
                <strong>{item.code}</strong>
                <span>{en ? item.en : item.it}</span>
              </div>
            ))}
          </div>
          <div className={styles.process}>
            <p>{en ? "TECHNICAL-TO-COMMERCIAL FLOW" : "PERCORSO TECNICO-COMMERCIALE"}</p>
            <ol className={styles.processSteps}>
              <li>{en ? "Specifications" : "Specifiche"}</li>
              <li>{en ? "Calculation" : "Calcolo"}</li>
              <li>{en ? "Bill" : "Distinta"}</li>
              <li>RFQ</li>
            </ol>
            <span className={styles.sampleNote}>{en ? "Illustrative flow · no live company data" : "Flusso illustrativo · nessun dato aziendale reale"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** English company registration proof, aligned with the more detailed IT trust section. */
export function PublicCinematicAccessBand({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return (
    <section className={styles.accessBand} aria-labelledby="home-cine-access-title">
      <div className={styles.accessInner}>
        <div>
          <p className={styles.accessKicker}>03 / {en ? "TRUST & ACCESS" : "FIDUCIA E ACCESSO"}</p>
          <h2 id="home-cine-access-title">{en ? "Your company. A governed workspace." : "La tua azienda. Un accesso governato."}</h2>
          <p>{en
            ? "Find or register your company, verify your account and submit your application. A company workspace opens after review; full Network access requires separate authorization."
            : "Trova o registra la tua azienda, verifica l’account e invia la richiesta. Il workspace si attiva dopo la revisione; il Network completo richiede un’abilitazione distinta."}
          </p>
        </div>
        <div className={styles.accessButtons}>
          <Link href={en ? "/en/register" : "/register"} className={styles.proofPrimary}>
            {en ? "Register your company" : "Registra la tua azienda"} <span aria-hidden="true">↗</span>
          </Link>
          <Link href={en ? "/en/login" : "/login"} className={styles.proofSecondary}>
            {en ? "Already registered? Sign in" : "Hai già un account? Accedi"}
          </Link>
        </div>
      </div>
    </section>
  );
}
