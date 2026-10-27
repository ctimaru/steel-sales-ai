import Link from "next/link";
import styles from "./home-cinematic-tools.module.css";

type Locale = "it" | "en";
const toolCards = {
  it: [
    { number: "01", title: "Norme e pesi", eyebrow: "CALCOLO TECNICO", description: "Geometrie, norme e peso teorico dei tubi.", href: "/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi", mark: "◯", access: "Pubblico" },
    { number: "02", title: "Distinta", eyebrow: "RICHIESTE TECNICHE", description: "Organizza materiali e quantità in un unico elenco.", href: "/distinta", mark: "▤", access: "Pubblico" },
    { number: "03", title: "Network", eyebrow: "FILIERA INDUSTRIALE", description: "Scopri aziende e ruoli della filiera dell'acciaio.", href: "#network", mark: "◎", access: "Anteprima" },
    { number: "04", title: "Commerciale", eyebrow: "WORKSPACE AZIENDALE", description: "Dalla richiesta alle offerte, con controllo umano.", href: "/register", mark: "↗", access: "Aziende abilitate" },
    { number: "05", title: "Scuola", eyebrow: "CONOSCENZA STEEL", description: "Esplora norme, gradi e riferimenti tecnici.", href: "/knowledge", mark: "⌑", access: "Pubblico" },
  ],
  en: [
    { number: "01", title: "Standards & weights", eyebrow: "TECHNICAL CALCULATION", description: "Tube geometries, standards and theoretical weight.", href: "/en/knowledge/tubes", mark: "◯", access: "Public" },
    { number: "02", title: "RFQ builder", eyebrow: "TECHNICAL REQUESTS", description: "Structure materials and quantities in one bill.", href: "/en/distinta", mark: "▤", access: "Public" },
    { number: "03", title: "Network", eyebrow: "STEEL SUPPLY CHAIN", description: "Explore the roles and companies in the steel industry.", href: "/en/network", mark: "◎", access: "Preview" },
    { number: "04", title: "Commercial workspace", eyebrow: "COMPANY WORKSPACE", description: "From enquiries to quotations, with human oversight.", href: "/en/register", mark: "↗", access: "Approved companies" },
    { number: "05", title: "Knowledge", eyebrow: "STEEL KNOWLEDGE", description: "Explore standards, grades and technical references.", href: "/en/knowledge", mark: "⌑", access: "Public" },
  ],
} as const;

export function HomeCinematicTools({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return (
    <section className={styles.section} aria-labelledby="home-tools-title" id="home-tools">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div>
            <p className={styles.kicker}>{en ? "ONE CONNECTED ECOSYSTEM" : "UN SOLO ECOSISTEMA"}</p>
            <h2 id="home-tools-title">{en ? "Five tools. One steel workflow." : "Cinque strumenti. Un unico percorso."}</h2>
          </div>
          <p>{en ? "From technical requirements to industry knowledge and governed commercial relationships." : "Dai dati tecnici alla conoscenza e alle relazioni commerciali, senza passaggi inutili."}</p>
        </div>
        <div className={styles.gallery}>
          {toolCards[locale].map((tool) => (
            <Link key={tool.number} href={tool.href} className={styles.card} aria-label={tool.title}>
              <span className={styles.cardTop}><span>{tool.eyebrow}</span><span>{tool.number} / 05</span></span>
              <span className={styles.mark} aria-hidden="true">{tool.mark}</span>
              <span className={styles.cardBody}>
                <strong>{tool.title}</strong>
                <span className={styles.description}>{tool.description}</span>
              </span>
              <span className={styles.cardFoot}><span>{tool.access}</span><span aria-hidden="true">↗</span></span>
            </Link>
          ))}
        </div>
        <p className={styles.footnote}>{en ? "Company-only features require registration, review and appropriate permissions." : "Le funzioni aziendali richiedono registrazione, verifica e autorizzazioni appropriate."}</p>
      </div>
    </section>
  );
}
