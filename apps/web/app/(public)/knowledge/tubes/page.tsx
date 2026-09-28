import type { Metadata } from "next";
import Link from "next/link";

import {
  PublicTubeWeightCalculator,
  type PublicTubeCalculatorInitialValues,
} from "@/components/public-tube-weight-calculator";
import {
  listPublicTubeDimensionPages,
  listPublicTubeFamilyHubs,
} from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";
import {
  getTubeFamilyBySlug,
  tubeFamilyHubPath,
} from "@/lib/tube-seo";

export const metadata: Metadata = {
  title: "Calcolo peso tubo acciaio: kg/m, barra e tonnellate",
  description:
    "Calcolatore pubblico per il peso teorico di tubi tondi, profili quadri e rettangolari in acciaio. Calcola kg/m, peso barra e tonnellate e confronta i risultati con riferimenti tecnici pubblicati.",
  alternates: {
    canonical: absoluteUrl("/knowledge/tubes"),
  },
  openGraph: {
    title: "Calcolo peso tubo acciaio · Steel Knowledge",
    description:
      "Calcola il peso di tubi tondi, quadri e rettangolari e confronta il risultato teorico con pesi tecnici pubblicati.",
    url: absoluteUrl("/knowledge/tubes"),
    type: "article",
  },
};

const faq = [
  {
    question: "Come si calcola il peso al metro di un tubo tondo in acciaio?",
    answer:
      "Si calcola l’area della corona circolare usando diametro esterno e spessore, poi si moltiplica l’area per la densità del materiale. Il calcolatore usa 7.850 kg/m³ come densità di default, modificabile.",
  },
  {
    question: "Il peso teorico è uguale al peso riportato dal produttore?",
    answer:
      "Non necessariamente. Il calcolo geometrico usa dimensioni nominali e una densità impostata, mentre un valore pubblicato può riflettere geometria reale della sezione, raggi degli spigoli, arrotondamenti e convenzioni del catalogo.",
  },
  {
    question: "Come si calcola il peso di una barra da 6 o 12 metri?",
    answer:
      "Si moltiplica il peso in kg/m per la lunghezza della barra. Il peso totale si ottiene moltiplicando ancora per il numero di barre.",
  },
  {
    question: "Il calcolatore può essere usato per profili quadri e rettangolari?",
    answer:
      "Sì. Per SHS e RHS il calcolo teorico usa una geometria idealizzata a spigoli vivi. Quando esiste un riferimento tecnico pubblicato per la stessa misura viene mostrato separatamente.",
  },
];

type SearchParams = Promise<{
  family?: string;
  od?: string;
  width?: string;
  height?: string;
  thickness?: string;
  length?: string;
  quantity?: string;
  density?: string;
}>;

export default async function PublicTubeWeightsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const [references, familyHubs] = await Promise.all([
    listPublicTubeDimensionPages(),
    listPublicTubeFamilyHubs(),
  ]);
  const supportedFamilies = new Set(["round_tube", "square_tube", "rectangular_tube"]);
  const initialValues: PublicTubeCalculatorInitialValues = {
    family: supportedFamilies.has(params.family ?? "")
      ? (params.family as PublicTubeCalculatorInitialValues["family"])
      : undefined,
    outerDiameter: params.od,
    width: params.width,
    height: params.height,
    thickness: params.thickness,
    length: params.length,
    quantity: params.quantity,
    density: params.density,
  };

  const calculatorJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calcolatore peso tubo acciaio",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/knowledge/tubes"),
    description:
      "Calcolatore pubblico di peso teorico per tubi tondi e profilati cavi quadri e rettangolari in acciaio.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Come calcolare il peso di un tubo in acciaio",
    description:
      "Formula, densità, kg/m, peso per barra e differenza tra calcolo teorico e peso tecnico pubblicato.",
    mainEntityOfPage: absoluteUrl("/knowledge/tubes"),
    author: {
      "@type": "Organization",
      name: "Steel Sales AI",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#2f6fed]">Steel Knowledge</Link>
        <span className="mx-2">/</span>
        <span>Pesi &amp; dimensioni</span>
      </nav>

      <header className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Pesi &amp; dimensioni · pubblico</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-5xl">
          Calcolo peso tubo acciaio
        </h1>
        <p className="mt-4 text-base leading-7 text-[#68788e]">
          Inserisci dimensioni, lunghezza e quantità per ottenere peso al metro, peso per barra e tonnellaggio.
          Il calcolo teorico resta sempre distinto dai pesi tecnici pubblicati presenti nel catalogo.
        </p>
      </header>

      <section aria-label="Esplora il catalogo per famiglia">
        <div className="mb-4 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Catalogo dimensionale</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">Esplora per famiglia e dimensione esterna</h2>
          <p className="mt-2 text-sm leading-6 text-[#68788e]">
            Usa gli hub per confrontare più spessori della stessa sezione; usa il calcolatore quando vuoi partire da
            una misura libera.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {familyHubs.map((hub) => {
            const family = getTubeFamilyBySlug(hub.family_slug);
            if (!family) return null;
            return (
              <Link
                key={hub.family_slug}
                href={tubeFamilyHubPath(hub.family_slug)}
                className="rounded-2xl border border-[#dbe7f7] bg-[#f8fbff] p-5 transition hover:border-[#bdd1f4] hover:bg-white"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
                  {hub.size_hub_count} gruppi confrontabili
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[#1e2b45]">{family.label}</h3>
                <p className="mt-2 text-sm leading-6 text-[#68788e]">{family.shortDescription}</p>
                <p className="mt-4 text-xs font-semibold text-[#2f6fed]">Esplora la famiglia →</p>
              </Link>
            );
          })}
        </div>
      </section>

      <PublicTubeWeightCalculator references={references} initialValues={initialValues} />

      <article className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Guida</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
              Come si calcola il peso di un tubo in acciaio
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#68788e]">
              Il principio è semplice: si calcola l&apos;area della sezione metallica, la si converte da mm² a m² e
              la si moltiplica per la densità. Per l&apos;acciaio il calcolatore propone come convenzione iniziale
              <strong className="font-semibold text-[#40516a]"> 7.850 kg/m³</strong>, lasciando il valore modificabile.
              Il risultato è una massa lineare teorica espressa in kg/m.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-5">
                <h3 className="font-semibold text-[#1e2b45]">Tubo tondo</h3>
                <p className="mt-2 text-sm leading-6 text-[#68788e]">
                  Con diametro esterno D e spessore t, l&apos;area teorica è π × t × (D − t). Il peso al metro è
                  quindi area × densità / 1.000.000, usando millimetri per le dimensioni.
                </p>
              </div>
              <div className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-5">
                <h3 className="font-semibold text-[#1e2b45]">Profilo quadro</h3>
                <p className="mt-2 text-sm leading-6 text-[#68788e]">
                  Per un lato esterno B, il modello geometrico usa B² − (B − 2t)². È un&apos;idealizzazione a
                  spigoli vivi: nei profili reali i raggi degli angoli possono produrre un peso pubblicato diverso.
                </p>
              </div>
              <div className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-5">
                <h3 className="font-semibold text-[#1e2b45]">Profilo rettangolare</h3>
                <p className="mt-2 text-sm leading-6 text-[#68788e]">
                  Con base B e altezza H, il modello usa B × H − (B − 2t) × (H − 2t). Anche qui il risultato
                  rappresenta una sezione ideale e non sostituisce il valore tecnico pubblicato per uno specifico prodotto.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1e2b45]">
              Da kg/m a peso barra e tonnellaggio
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#68788e]">
              Una volta ottenuto il kg/m, il peso della barra è semplicemente kg/m × lunghezza. Per una fornitura,
              il peso totale è peso barra × quantità; dividendo i chilogrammi totali per 1.000 si ottengono le tonnellate.
              Questo rende il calcolatore utile sia per una verifica tecnica rapida sia per ragionare su quantità commerciali.
            </p>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1e2b45]">
              Peso teorico e peso pubblicato: perché possono essere diversi
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#68788e]">
              Un calcolo geometrico parte da dimensioni nominali e densità. Un catalogo tecnico può invece utilizzare
              geometria effettiva della sezione, raggi interni ed esterni, convenzioni di calcolo o arrotondamenti.
              Inoltre le tolleranze dimensionali del prodotto reale incidono sulla massa effettiva. Per questo Steel
              Knowledge mostra i due valori separatamente e indica la fonte quando esiste un riferimento verificato.
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[#dbe7f7] bg-[#f8fbff] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Catalogo tecnico pubblico</p>
            <h2 className="mt-2 text-xl font-semibold text-[#1e2b45]">
              {references.length} pesi di riferimento disponibili
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">
              Le geometrie pubbliche provengono dal reference database controllato. Il frontend non legge direttamente
              le tabelle interne e un calcolo arbitrario non viene mai promosso automaticamente a dato verificato.
            </p>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6">
            <h2 className="text-xl font-semibold text-[#1e2b45]">Collega dimensione, materiale e norma</h2>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">
              Il peso è solo una parte della specifica. Per identificare correttamente un prodotto servono anche
              norma, grado, processo e requisiti di fornitura.
            </p>
            <div className="mt-4 grid gap-3">
              <Link
                href="/knowledge/norme"
                className="rounded-xl border border-[#e1e8f2] bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-[#2f6fed]"
              >
                Esplora le norme →
              </Link>
              <Link
                href="/knowledge/gradi"
                className="rounded-xl border border-[#e1e8f2] bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-[#2f6fed]"
              >
                Esplora i gradi →
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6">
            <h2 className="text-xl font-semibold text-[#1e2b45]">Domande frequenti</h2>
            <div className="mt-3 divide-y divide-[#e8eef7]">
              {faq.map((item) => (
                <div key={item.question} className="py-4">
                  <h3 className="text-sm font-semibold text-[#1e2b45]">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#68788e]">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-950">Uso del risultato</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Il calcolo è uno strumento tecnico informativo. Per ordini, certificazione, conformità o verifiche
              strutturali utilizza sempre i dati della specifica applicabile e la documentazione del produttore.
            </p>
          </aside>
        </div>
      </article>
    </div>
  );
}
