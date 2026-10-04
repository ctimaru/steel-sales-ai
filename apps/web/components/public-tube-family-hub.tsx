import type { Metadata } from "next";
import Link from "next/link";

import { SchoolHero } from "@/components/school-ui";
import {
  listPublicTubeFamilyHubs,
  listPublicTubeSizeHubs,
  type PublicTubeFamilyHub,
} from "@/lib/public-knowledge";
import {
  formatTubeNumber,
  getTubeFamilyBySlug,
  tubeFamilyHubPath,
  tubeSizeHubLabel,
  tubeSizeHubPath,
  type PublicTubeFamilySlug,
} from "@/lib/tube-seo";
import { absoluteUrl } from "@/lib/site";

const familyEditorial: Record<
  PublicTubeFamilySlug,
  { title: string; intro: string; guide: string; formula: string }
> = {
  tondo: {
    title: "Pesi tubi tondi in acciaio per diametro e spessore",
    intro:
      "Esplora i diametri del catalogo pubblico e confronta, per ogni diametro esterno, gli spessori disponibili e i relativi pesi al metro pubblicati.",
    guide:
      "Nel tubo tondo il diametro esterno da solo non determina il peso: aumentando lo spessore cresce l’area della corona metallica e quindi la massa lineare. I cluster qui sotto raggruppano soltanto diametri con almeno due pesi canonici disponibili.",
    formula:
      "Per una stima teorica si può usare l’area π × t × (D − t) e una densità di riferimento. Il dato di catalogo pubblicato resta comunque separato dal calcolo geometrico.",
  },
  quadro: {
    title: "Pesi profili quadri in acciaio per sezione e spessore",
    intro:
      "Consulta le sezioni SHS raggruppate per lato esterno e confronta gli spessori con il peso al metro pubblicato.",
    guide:
      "Nei profili quadri il peso dipende dal lato, dallo spessore e dalla geometria reale degli angoli. Per questo il catalogo presenta insieme le varianti della stessa sezione invece di trattare ogni misura come un risultato isolato.",
    formula:
      "La formula geometrica a spigoli vivi è utile per una stima, ma i raggi reali dello SHS possono generare uno scostamento rispetto al peso pubblicato dal produttore.",
  },
  rettangolare: {
    title: "Pesi profili rettangolari in acciaio per sezione e spessore",
    intro:
      "Esplora le sezioni RHS con più spessori disponibili e confronta rapidamente peso al metro, intervallo di spessore e fonti.",
    guide:
      "Per un profilo rettangolare occorre leggere insieme base, altezza e spessore. I cluster K7 vengono creati solo quando la stessa sezione esterna dispone di almeno due varianti canoniche, così la pagina offre un confronto reale.",
    formula:
      "Il calcolo teorico usa l’area B × H − (B − 2t) × (H − 2t). Nei prodotti reali i raggi degli angoli e le convenzioni di catalogo possono modificare la massa lineare pubblicata.",
  },
};

export function tubeFamilyMetadata(familySlug: PublicTubeFamilySlug): Metadata {
  const family = getTubeFamilyBySlug(familySlug);
  const editorial = familyEditorial[familySlug];
  if (!family) return {};

  return {
    title: editorial.title,
    description:
      editorial.intro +
      " Tabelle per sezione, intervalli di spessore e collegamenti ai pesi esatti.",
    alternates: {
      canonical: absoluteUrl(tubeFamilyHubPath(familySlug)),
    },
    openGraph: {
      title: editorial.title + " · Scuola Smart Steel Sales",
      description: editorial.intro,
      url: absoluteUrl(tubeFamilyHubPath(familySlug)),
      type: "website",
    },
  };
}

function familyFaq(family: PublicTubeFamilyHub, familySlug: PublicTubeFamilySlug) {
  const config = getTubeFamilyBySlug(familySlug);
  if (!config) return [];

  return [
    {
      question: "Quante dimensioni sono disponibili per " + config.label.toLowerCase() + "?",
      answer:
        "Il catalogo pubblico contiene " +
        family.dimension_count +
        " pesi dimensionali canonici e " +
        family.size_hub_count +
        " gruppi di sezione con almeno due spessori confrontabili.",
    },
    {
      question: "Le tabelle mostrano pesi teorici o pubblicati?",
      answer:
        "I cluster usano i pesi canonici pubblicati nel reference database. Le formule teoriche sono mostrate separatamente nel calcolatore e nelle singole schede dimensionali.",
    },
    {
      question: "Perché alcune dimensioni non hanno una pagina di gruppo?",
      answer:
        "K7 crea una pagina di gruppo solo quando la stessa dimensione esterna ha almeno due varianti canoniche. Questo evita pagine SEO sottili con un solo dato.",
    },
  ];
}

export async function PublicTubeFamilyHubPage({
  familySlug,
}: {
  familySlug: PublicTubeFamilySlug;
}) {
  const config = getTubeFamilyBySlug(familySlug);
  if (!config) return null;

  const [families, sizeHubs] = await Promise.all([
    listPublicTubeFamilyHubs(),
    listPublicTubeSizeHubs(familySlug),
  ]);
  const family = families.find((item) => item.family_slug === familySlug);
  if (!family) return null;

  const editorial = familyEditorial[familySlug];
  const faq = familyFaq(family, familySlug);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: editorial.title,
    description: editorial.intro,
    url: absoluteUrl(tubeFamilyHubPath(familySlug)),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: sizeHubs.length,
      itemListElement: sizeHubs.map((hub, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tubeSizeHubLabel(hub),
        url: absoluteUrl(tubeSizeHubPath(familySlug, hub.size_slug)),
      })),
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-9 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="school-breadcrumb">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/tubes" className="hover:text-[#1a5144]">Pesi &amp; dimensioni</Link>
        <span className="mx-2">/</span>
        <span>{config.label}</span>
      </nav>

      <SchoolHero
        eyebrow="Hub dimensionale"
        title={editorial.title}
        description={<>{editorial.intro}</>}
        badges={[
          `${family.dimension_count} pesi`,
          `${family.size_hub_count} gruppi confrontabili`,
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Pesi dimensionali", String(family.dimension_count)],
          ["Gruppi confrontabili", String(family.size_hub_count)],
          [
            "Spessori",
            formatTubeNumber(family.min_thickness_mm) +
              "–" +
              formatTubeNumber(family.max_thickness_mm) +
              " mm",
          ],
          [
            "Peso al metro",
            formatTubeNumber(family.min_weight_kg_m) +
              "–" +
              formatTubeNumber(family.max_weight_kg_m) +
              " kg/m",
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <p className="school-meta-label">{label}</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Naviga per dimensione</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
          Sezioni con più spessori disponibili
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          Ogni gruppo contiene almeno due riferimenti canonici: puoi quindi confrontare realmente come cambia il
          peso al metro al variare dello spessore.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sizeHubs.map((hub) => (
            <Link
              key={hub.size_slug}
              href={tubeSizeHubPath(familySlug, hub.size_slug)}
              className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4 transition hover:border-[#b8d2c8] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-[#1d2824]">{tubeSizeHubLabel(hub)}</p>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#66736e]">
                  {hub.variant_count} spessori
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#66736e]">
                t {formatTubeNumber(hub.min_thickness_mm)}–{formatTubeNumber(hub.max_thickness_mm)} mm ·{" "}
                {formatTubeNumber(hub.min_weight_kg_m)}–{formatTubeNumber(hub.max_weight_kg_m)} kg/m
              </p>
              <p className="mt-3 text-xs font-semibold text-[#1a5144]">Confronta spessori →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-[#1d2824]">Come leggere questo catalogo</h2>
          <p className="mt-3 text-sm leading-7 text-[#66736e]">{editorial.guide}</p>
          <p className="mt-4 text-sm leading-7 text-[#66736e]">{editorial.formula}</p>
        </div>

        <div className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-[#1d2824]">Dal cluster al calcolo</h2>
          <p className="mt-3 text-sm leading-7 text-[#66736e]">
            Le pagine di gruppo servono per scegliere la dimensione esterna. Le singole schede mostrano il peso
            pubblicato, mentre il calcolatore permette di modificare lunghezza, quantità e densità senza trasformare
            il risultato teorico in un dato canonico.
          </p>
          <Link
            href="/knowledge/tubes"
            className="school-primary-action mt-5"
          >
            Apri il calcolatore →
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-[#1d2824]">Domande frequenti</h2>
        <div className="mt-4 divide-y divide-[#e8eef7]">
          {faq.map((item) => (
            <div key={item.question} className="py-4">
              <h3 className="text-sm font-semibold text-[#1d2824]">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
