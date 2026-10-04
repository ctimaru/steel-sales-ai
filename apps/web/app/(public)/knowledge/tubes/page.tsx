import type { Metadata } from "next";
import Link from "next/link";

import {
  PublicTubeWeightCalculator,
  type PublicTubeCalculatorInitialValues,
} from "@/components/public-tube-weight-calculator";
import { SchoolHero } from "@/components/school-ui";
import {
  listPublicTubeDimensionPages,
  listPublicTubeFamilyHubs,
} from "@/lib/public-knowledge";
import { robotsForParameterizedPage } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import {
  getTubeFamilyBySlug,
  tubeFamilyHubPath,
} from "@/lib/tube-seo";

const baseMetadata: Metadata = {
  title: "Calcolo peso tubo acciaio: kg/m, barra e tonnellate",
  description:
    "Calcolatore pubblico per tubi strutturali in acciaio: massa lineare secondo EN 10210 o EN 10219, oppure calcolo geometrico libero. Ottieni kg/m, peso barra e tonnellate.",
  alternates: {
    canonical: absoluteUrl("/knowledge/tubes"),
  },
  openGraph: {
    title: "Calcolo peso tubo acciaio · Scuola Smart Steel Sales",
    description:
      "Calcola kg/m, peso per barra e tonnellate secondo EN 10210 o EN 10219, con modalità libera separata.",
    url: absoluteUrl("/knowledge/tubes"),
    type: "article",
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const hasParameters = Object.values(params).some((value) => Boolean(value?.trim()));
  return {
    ...baseMetadata,
    robots: robotsForParameterizedPage(hasParameters),
  };
}

const faq = [
  {
    question: "Come si calcola il peso al metro di un tubo tondo in acciaio?",
    answer:
      "Si calcola l’area della corona circolare usando diametro esterno e spessore, poi si moltiplica l’area per la densità del materiale. Il calcolatore usa 7.850 kg/m³ come densità di default, modificabile.",
  },
  {
    question: "Perché EN 10210 ed EN 10219 possono dare pesi diversi per lo stesso quadro o rettangolare?",
    answer:
      "Per SHS e RHS le due norme usano raggi di raccordo di calcolo diversi. Questi raggi modificano l’area della sezione e quindi la massa lineare in kg/m, anche a parità di dimensioni nominali e spessore.",
  },
  {
    question: "Come si calcola il peso di una barra da 6 o 12 metri?",
    answer:
      "Si moltiplica il peso in kg/m per la lunghezza della barra. Il peso totale si ottiene moltiplicando ancora per il numero di barre.",
  },
  {
    question: "Posso ancora fare un calcolo geometrico libero?",
    answer:
      "Sì. Se selezioni Calcolo libero, il calcolatore usa la geometria idealizzata e consente di modificare la densità. Se selezioni EN 10210 o EN 10219, invece, il kg/m principale usa le regole geometriche della norma scelta.",
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
      "Calcolatore pubblico per massa lineare secondo EN 10210 o EN 10219, con modalità geometrica libera separata.",
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
      "Formula, raggi di raccordo, kg/m, peso per barra e differenza tra EN 10210, EN 10219 e calcolo libero.",
    mainEntityOfPage: absoluteUrl("/knowledge/tubes"),
    author: {
      "@type": "Organization",
      name: "Smart Steel Sales",
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

      <nav aria-label="Breadcrumb" className="school-breadcrumb">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <span>Pesi &amp; dimensioni</span>
      </nav>

      <SchoolHero
        eyebrow="Pesi & dimensioni"
        title="Calcola il peso del tubo in pochi secondi"
        description={
          <>
            Scegli EN 10210, EN 10219 oppure Calcolo libero. Nelle modalità normative il kg/m usa le regole
            geometriche della norma selezionata; il calcolo libero resta separato e mantiene la densità modificabile.
          </>
        }
        badges={["Pubblico", "Calcolatore + catalogo"]}
      />

      <PublicTubeWeightCalculator references={references} initialValues={initialValues} />\n\n      <section aria-label="Esplora il catalogo per famiglia">
        <div className="mb-4 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Catalogo dimensionale</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Esplora per famiglia e dimensione esterna</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
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
                className="rounded-2xl border border-[#d9e8e2] bg-[#f6f8f7] p-5 transition hover:border-[#b8d2c8] hover:bg-white"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                  {hub.size_hub_count} gruppi confrontabili
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[#1d2824]">{family.label}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">{family.shortDescription}</p>
                <p className="mt-4 text-xs font-semibold text-[#1a5144]">Esplora la famiglia →</p>
              </Link>
            );
          })}
        </div>
      </section>

      <article className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Guida</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
              Come si calcola il peso di un tubo in acciaio
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#66736e]">
              Il principio è semplice: si calcola l&apos;area della sezione metallica, la si converte da mm² a m² e
              la si moltiplica per la densità. Per l&apos;acciaio il calcolatore propone come convenzione iniziale
              <strong className="font-semibold text-[#40516a]"> 7.850 kg/m³</strong>, lasciando il valore modificabile.
              Il risultato è una massa lineare teorica espressa in kg/m.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-5">
                <h3 className="font-semibold text-[#1d2824]">Tubo tondo</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">
                  Con diametro esterno D e spessore t, l&apos;area teorica è π × t × (D − t). Il peso al metro è
                  quindi area × densità / 1.000.000, usando millimetri per le dimensioni.
                </p>
              </div>
              <div className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-5">
                <h3 className="font-semibold text-[#1d2824]">Profilo quadro</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">
                  In EN 10210 ed EN 10219 il peso non viene ricavato da un quadrato ideale a spigoli vivi:
                  entrano nel calcolo anche i raggi esterni e interni previsti dalla norma. Solo la modalità
                  Calcolo libero usa B² − (B − 2t)² e una densità modificabile.
                </p>
              </div>
              <div className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-5">
                <h3 className="font-semibold text-[#1d2824]">Profilo rettangolare</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">
                  Per i rettangolari EN 10210 ed EN 10219 applicano la geometria con raggi di raccordo propria
                  della norma. Questo cambia l&apos;area della sezione e quindi i kg/m. La formula a spigoli vivi
                  B × H − (B − 2t) × (H − 2t) resta disponibile esclusivamente nel Calcolo libero.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1d2824]">
              Da kg/m a peso barra e tonnellaggio
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#66736e]">
              Una volta ottenuto il kg/m, il peso della barra è semplicemente kg/m × lunghezza. Per una fornitura,
              il peso totale è peso barra × quantità; dividendo i chilogrammi totali per 1.000 si ottengono le tonnellate.
              Questo rende il calcolatore utile sia per una verifica tecnica rapida sia per ragionare su quantità commerciali.
            </p>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1d2824]">
              Peso teorico e peso pubblicato: perché possono essere diversi
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#66736e]">
              Per SHS e RHS la scelta della norma è parte del calcolo: EN 10210 ed EN 10219 usano raggi di raccordo
              diversi e possono quindi restituire masse lineari differenti per la stessa dimensione nominale.
              Il Calcolo libero resta invece una stima geometrica separata. In ogni caso la massa reale di fornitura
              può variare entro le tolleranze applicabili e va verificata sulla documentazione del produttore.
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Catalogo tecnico pubblico</p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              {references.length} pesi di riferimento disponibili
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Le geometrie pubbliche provengono dal reference database controllato. Il frontend non legge direttamente
              le tabelle interne e un calcolo arbitrario non viene mai promosso automaticamente a dato verificato.
            </p>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6">
            <h2 className="text-xl font-semibold text-[#1d2824]">Collega dimensione, materiale e norma</h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Il peso è solo una parte della specifica. Per identificare correttamente un prodotto servono anche
              norma, grado, processo e requisiti di fornitura.
            </p>
            <div className="mt-4 grid gap-3">
              <Link
                href="/knowledge/norme"
                className="school-secondary-action justify-start"
              >
                Esplora le norme →
              </Link>
              <Link
                href="/knowledge/gradi"
                className="school-secondary-action justify-start"
              >
                Esplora i gradi →
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6">
            <h2 className="text-xl font-semibold text-[#1d2824]">Domande frequenti</h2>
            <div className="mt-3 divide-y divide-[#e8eef7]">
              {faq.map((item) => (
                <div key={item.question} className="py-4">
                  <h3 className="text-sm font-semibold text-[#1d2824]">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#66736e]">{item.answer}</p>
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
