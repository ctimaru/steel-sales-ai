import Image from "next/image";
import Link from "next/link";
import styles from "./public-photographic-tool-rail.module.css";

/**
 * HOME-CINE2A.3: five independent photographic scenes from one local atlas.
 * A deliberately simple server component: real routes only, no client JS.
 * The RFQ card requires a company sign-in; Network links to public discovery.
 */
const photoNames = ["calculator", "distinta", "rfq", "network", "school"] as const;

export function PublicPhotographicToolRail({ locale }: { locale: "it" | "en" }) {
  const en = locale === "en";
  const cards = en ? [
    { title: "Tube calculator", copy: "Check dimensions and theoretical weight.", action: "Open calculator", href: "/en/knowledge/tubes", access: "" },
    { title: "Build a bill", copy: "Prepare a clear list of your requirements.", action: "Create a bill", href: "/en/distinta", access: "" },
    { title: "Request a quote", copy: "Send and manage RFQs in your company workspace.", action: "Company sign in", href: "/en/login", access: "COMPANY ACCESS" },
    { title: "Steel Network", copy: "Discover the industry; private data stays protected.", action: "Discover Network", href: "/en/network", access: "PUBLIC PREVIEW" },
    { title: "Steel School", copy: "Standards, grades and tube knowledge.", action: "Explore knowledge", href: "/en/knowledge", access: "" },
  ] : [
    { title: "Calcolatrice", copy: "Dimensioni e peso teorico dei tubi.", action: "Apri calcolatrice", href: "/knowledge/tubes?source=home&surface=tool_rail#calcolatore-pesi", access: "" },
    { title: "Crea una distinta", copy: "Prepara il materiale che stai cercando.", action: "Crea distinta", href: "/distinta", access: "" },
    { title: "Richiedi un'offerta", copy: "Gestisci le RFQ nel tuo spazio aziendale.", action: "Accedi all'area aziende", href: "/login", access: "ACCESSO AZIENDALE" },
    { title: "Network", copy: "Esplora la filiera; i dati privati restano protetti.", action: "Scopri il Network", href: "#network", access: "ANTEPRIMA PUBBLICA" },
    { title: "Scuola dell'acciaio", copy: "Norme, gradi e conoscenza tecnica.", action: "Entra nella Scuola", href: "/knowledge", access: "" },
  ];

  return (
    <section className={styles.section} aria-labelledby="home-cine2a3-heading" data-home-cine2a3="tool-rail">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <div>
            <p className={styles.kicker}>{en ? "BUILT FOR THE STEEL INDUSTRY" : "PENSATO PER CHI LAVORA L'ACCIAIO"}</p>
            <h2 id="home-cine2a3-heading" className={styles.heading}>
              {en ? "Start here. Go further." : "Inizia da qui. Vai oltre."}
            </h2>
          </div>
          <span className={styles.mobileHint} aria-hidden="true">{en ? "SWIPE TO EXPLORE →" : "SCORRI PER ESPLORARE →"}</span>
        </div>
        <ul className={styles.rail} aria-label={en ? "Five steel tools" : "Cinque strumenti per l'acciaio"}>
          {cards.map((card, i) => (
            <li key={photoNames[i]} className={styles.card}>
              <Link href={card.href} className={styles.cardLink} data-home-cine2a3-card={photoNames[i]}>
                <span className={styles.photoFrame} aria-hidden="true">
                  <Image
                    src="/home-cine2a3-five-photo-atlas.webp"
                    alt=""
                    width={210}
                    height={420}
                    loading="lazy"
                    unoptimized
                    className={styles.photoAtlas}
                    style={{ top: `-${i * 100}%` }}
                  />
                </span>
                <span className={styles.cardContent}>
                  {card.access ? <span className={styles.access}>{card.access}</span> : <span className={styles.number}>0{i + 1} / 05</span>}
                  <strong className={styles.title}>{card.title}</strong>
                  <span className={styles.copy}>{card.copy}</span>
                  <span className={styles.action}>{card.action} <span aria-hidden="true">↗</span></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
