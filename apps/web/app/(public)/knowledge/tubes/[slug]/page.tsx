import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { SchoolHero } from "@/components/school-ui";
import {
  getPublicTubeDimension,
  listPublicTubeSizeHubs,
  type PublicTubeDimension,
  type PublicTubeRelatedDimension,
} from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";
import {
  getTubeFamilyByProductFamily,
  tubeFamilyHubPath,
  tubeSizeHubPath,
  tubeSizeSlug,
} from "@/lib/tube-seo";

const loadDimension = cache(getPublicTubeDimension);

function formatNumber(value: number, digits = 3) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function familyName(family: PublicTubeDimension["product_family"]) {
  if (family === "round_tube") return "tubo tondo";
  if (family === "square_tube") return "profilo quadro";
  return "profilo rettangolare";
}

function dimensionLabel(dimension: {
  product_family: PublicTubeDimension["product_family"];
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number;
}) {
  if (dimension.product_family === "round_tube") {
    return formatNumber(dimension.outer_diameter_mm ?? 0) + " × " + formatNumber(dimension.thickness_mm) + " mm";
  }
  return (
    formatNumber(dimension.width_mm ?? 0) +
    " × " +
    formatNumber(dimension.height_mm ?? 0) +
    " × " +
    formatNumber(dimension.thickness_mm) +
    " mm"
  );
}

function theoreticalWeight(dimension: PublicTubeDimension, density = 7850) {
  const t = dimension.thickness_mm;
  let areaMm2 = 0;

  if (dimension.product_family === "round_tube") {
    const d = dimension.outer_diameter_mm ?? 0;
    areaMm2 = Math.PI * t * (d - t);
  } else {
    const width = dimension.width_mm ?? 0;
    const height = dimension.height_mm ?? 0;
    areaMm2 = width * height - (width - 2 * t) * (height - 2 * t);
  }

  return {
    areaMm2,
    kgM: (areaMm2 * density) / 1_000_000,
  };
}

function calculatorHref(dimension: PublicTubeDimension) {
  const query = new URLSearchParams({
    family: dimension.product_family,
    thickness: String(dimension.thickness_mm),
    length: "12",
    quantity: "1",
    density: "7850",
  });

  if (dimension.product_family === "round_tube") {
    query.set("od", String(dimension.outer_diameter_mm ?? ""));
  } else {
    query.set("width", String(dimension.width_mm ?? ""));
    query.set("height", String(dimension.height_mm ?? ""));
  }

  return "/knowledge/tubes?" + query.toString();
}

function relatedLabel(dimension: PublicTubeRelatedDimension) {
  return dimensionLabel(dimension);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dimension = await loadDimension(slug);

  if (!dimension) {
    return {
      title: "Dimensione tubo non disponibile",
      robots: { index: false, follow: false },
    };
  }

  const size = dimensionLabel(dimension);
  const product = familyName(dimension.product_family);
  const title = "Peso " + product + " " + size + ": " + formatNumber(dimension.weight_kg_m) + " kg/m";
  const description =
    "Peso di riferimento per " +
    product +
    " " +
    size +
    ": " +
    formatNumber(dimension.weight_kg_m) +
    " kg/m. Calcola peso barra da 6 e 12 metri, tonnellaggio e confronta il valore pubblicato con il calcolo teorico.";

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl("/knowledge/tubes/" + dimension.dimension_slug),
    },
    openGraph: {
      title: title + " · Scuola Smart Steel Sales",
      description,
      url: absoluteUrl("/knowledge/tubes/" + dimension.dimension_slug),
      type: "article",
      publishedTime: dimension.published_at,
    },
  };
}

export default async function TubeDimensionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dimension = await loadDimension(slug);
  if (!dimension) notFound();

  const size = dimensionLabel(dimension);
  const product = familyName(dimension.product_family);
  const family = getTubeFamilyByProductFamily(dimension.product_family);
  const sizeSlug = tubeSizeSlug(dimension);
  const sizeHubs = family ? await listPublicTubeSizeHubs(family.slug) : [];
  const sizeHub = sizeHubs.find((item) => item.size_slug === sizeSlug) ?? null;
  const theoretical = theoreticalWeight(dimension);
  const deltaPercent =
    theoretical.kgM !== 0
      ? ((dimension.weight_kg_m - theoretical.kgM) / theoretical.kgM) * 100
      : 0;

  const weight6m = dimension.weight_kg_m * 6;
  const weight12m = dimension.weight_kg_m * 12;
  const metresPerTonne = 1000 / dimension.weight_kg_m;
  const bars6PerTonne = 1000 / weight6m;
  const bars12PerTonne = 1000 / weight12m;

  const title = "Peso " + product + " " + size;
  const faq = [
    {
      question: "Quanto pesa al metro un " + product + " " + size + "?",
      answer:
        "Il riferimento pubblico presente in Scuola Smart Steel Sales è " +
        formatNumber(dimension.weight_kg_m) +
        " kg/m, con fonte " +
        dimension.source_provider +
        ".",
    },
    {
      question: "Quanto pesa una barra da 6 o 12 metri?",
      answer:
        "Usando il peso pubblicato di " +
        formatNumber(dimension.weight_kg_m) +
        " kg/m, una barra da 6 m pesa circa " +
        formatNumber(weight6m, 2) +
        " kg e una barra da 12 m circa " +
        formatNumber(weight12m, 2) +
        " kg.",
    },
    {
      question: "Perché il peso teorico può essere diverso dal peso pubblicato?",
      answer:
        dimension.product_family === "round_tube"
          ? "Il calcolo teorico usa dimensioni nominali e densità 7.850 kg/m³. Il dato pubblicato può differire per convenzioni di catalogo, tolleranze, densità adottata e arrotondamenti."
          : "Per i profili cavi il calcolo teorico usa una sezione idealizzata a spigoli vivi. Il prodotto reale ha raggi agli angoli e può seguire convenzioni di catalogo diverse, quindi il peso pubblicato può differire.",
    },
  ];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title + ": " + formatNumber(dimension.weight_kg_m) + " kg/m",
    description:
      "Peso al metro, peso barra da 6 e 12 metri, tonnellaggio e confronto teorico per " + product + " " + size + ".",
    mainEntityOfPage: absoluteUrl("/knowledge/tubes/" + dimension.dimension_slug),
    datePublished: dimension.published_at,
    author: {
      "@type": "Organization",
      name: "Smart Steel Sales",
    },
    citation: dimension.source_url,
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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Scuola Smart Steel Sales",
        item: absoluteUrl("/knowledge"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Pesi & dimensioni",
        item: absoluteUrl("/knowledge/tubes"),
      },
      ...(family
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: family.label,
              item: absoluteUrl(tubeFamilyHubPath(family.slug)),
            },
          ]
        : []),
      ...(family && sizeHub
        ? [
            {
              "@type": "ListItem",
              position: 4,
              name:
                dimension.product_family === "round_tube"
                  ? "Ø " + formatNumber(dimension.outer_diameter_mm ?? 0) + " mm"
                  : formatNumber(dimension.width_mm ?? 0) +
                    " × " +
                    formatNumber(dimension.height_mm ?? 0) +
                    " mm",
              item: absoluteUrl(tubeSizeHubPath(family.slug, sizeHub.size_slug)),
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: family && sizeHub ? 5 : family ? 4 : 3,
        name: size,
        item: absoluteUrl("/knowledge/tubes/" + dimension.dimension_slug),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="school-breadcrumb">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/tubes" className="hover:text-[#1a5144]">Pesi &amp; dimensioni</Link>
        {family ? (
          <>
            <span className="mx-2">/</span>
            <Link href={tubeFamilyHubPath(family.slug)} className="hover:text-[#1a5144]">{family.label}</Link>
          </>
        ) : null}
        {family && sizeHub ? (
          <>
            <span className="mx-2">/</span>
            <Link href={tubeSizeHubPath(family.slug, sizeHub.size_slug)} className="hover:text-[#1a5144]">
              {dimension.product_family === "round_tube"
                ? "Ø " + formatNumber(dimension.outer_diameter_mm ?? 0) + " mm"
                : formatNumber(dimension.width_mm ?? 0) +
                  " × " +
                  formatNumber(dimension.height_mm ?? 0) +
                  " mm"}
            </Link>
          </>
        ) : null}
        <span className="mx-2">/</span>
        <span>{size}</span>
      </nav>

      <SchoolHero
        eyebrow={product}
        title={title}
        description={
          <>
            Il riferimento disponibile per questa geometria è{" "}
            <strong className="font-semibold text-[#1d2824]">
              {formatNumber(dimension.weight_kg_m)} kg/m
            </strong>.
            Qui trovi peso per barra, conversione in tonnellate, confronto geometrico e dimensioni vicine
            già presenti nel catalogo.
          </>
        }
        badges={["Peso pubblicato", dimension.source_provider]}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Peso al metro", formatNumber(dimension.weight_kg_m) + " kg/m"],
          ["Barra 6 m", formatNumber(weight6m, 2) + " kg"],
          ["Barra 12 m", formatNumber(weight12m, 2) + " kg"],
          ["Metri per tonnellata", formatNumber(metresPerTonne, 2) + " m/t"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <p className="school-meta-label">{label}</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Calcolo rapido</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Da {formatNumber(dimension.weight_kg_m)} kg/m alla quantità commerciale
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#66736e]">
            Il peso per barra deriva direttamente dal valore pubblicato: kg/m × lunghezza. Una tonnellata teorica
            corrisponde a circa {formatNumber(bars6PerTonne, 2)} barre da 6 m oppure {formatNumber(bars12PerTonne, 2)} barre
            da 12 m. I numeri di barre per tonnellata sono rapporti matematici e non tengono conto di tolleranze,
            sfridi o vincoli logistici.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4">
              <p className="school-meta-label">Circa barre da 6 m / t</p>
              <p className="mt-1 text-lg font-semibold text-[#1d2824]">{formatNumber(bars6PerTonne, 2)}</p>
            </div>
            <div className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4">
              <p className="school-meta-label">Circa barre da 12 m / t</p>
              <p className="mt-1 text-lg font-semibold text-[#1d2824]">{formatNumber(bars12PerTonne, 2)}</p>
            </div>
          </div>

          <Link
            href={calculatorHref(dimension)}
            className="school-primary-action mt-6"
          >
            Apri questa misura nel calcolatore →
          </Link>
        </div>

        <div className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Confronto teorico</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">Geometria nominale a 7.850 kg/m³</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-4 border-b border-[#dfe8f4] pb-3 text-sm">
              <span className="text-[#66736e]">Area teorica</span>
              <strong className="text-[#1d2824]">{formatNumber(theoretical.areaMm2, 2)} mm²</strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[#dfe8f4] pb-3 text-sm">
              <span className="text-[#66736e]">Peso teorico</span>
              <strong className="text-[#1d2824]">{formatNumber(theoretical.kgM)} kg/m</strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[#66736e]">Scostamento pubblicato / teorico</span>
              <strong className="text-[#1d2824]">{formatNumber(deltaPercent, 2)}%</strong>
            </div>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#66736e]">
            {dimension.product_family === "round_tube"
              ? "Il valore teorico usa diametro e spessore nominali. Il peso pubblicato resta il riferimento distinto mostrato in alto."
              : "Per SHS/RHS la formula usa spigoli vivi; i raggi reali degli angoli sono una delle ragioni per cui il dato pubblicato può differire."}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Fonte del peso</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">{dimension.source_provider}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#66736e]">
          Il valore di {formatNumber(dimension.weight_kg_m)} kg/m proviene dal riferimento tecnico indicato qui sotto.
          Scuola Smart Steel Sales mostra la fonte pubblica e mantiene separati i dati di catalogo dai calcoli geometrici.
          Un peso pubblicato non sostituisce le tolleranze, la norma di prodotto o il certificato della fornitura.
        </p>
        <a
          href={dimension.source_url}
          target="_blank"
          rel="noreferrer"
          className="school-inline-link mt-4 inline-flex"
        >
          {dimension.source_name ?? dimension.source_provider} ↗
        </a>
      </section>

      {family && sizeHub ? (
        <section className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-5 sm:p-6">
          <p className="text-sm font-semibold text-[#1d2824]">Vuoi confrontare tutti gli spessori?</p>
          <p className="mt-1 text-sm leading-6 text-[#66736e]">
            Questa dimensione esterna ha {sizeHub.variant_count} riferimenti canonici nello stesso cluster.
          </p>
          <Link
            href={tubeSizeHubPath(family.slug, sizeHub.size_slug)}
            className="mt-3 inline-flex text-sm font-semibold text-[#1a5144]"
          >
            Apri il confronto per spessore →
          </Link>
        </section>
      ) : null}

      {dimension.related_dimensions.length ? (
        <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Dimensioni correlate</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Confronta misure vicine</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Prima vengono proposti gli altri spessori della stessa dimensione esterna, poi le geometrie più vicine
            disponibili nel catalogo.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dimension.related_dimensions.map((related) => (
              <Link
                key={related.dimension_slug}
                href={"/knowledge/tubes/" + related.dimension_slug}
                className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4 transition hover:border-[#b8d2c8]"
              >
                <p className="font-semibold text-[#1d2824]">{relatedLabel(related)}</p>
                <p className="mt-2 text-sm text-[#66736e]">{formatNumber(related.weight_kg_m)} kg/m</p>
                <p className="mt-3 text-xs font-semibold text-[#1a5144]">Apri scheda →</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/knowledge/tubes"
          className="rounded-2xl border border-[#dce2df] bg-white p-5 text-sm font-semibold text-[#1a5144] hover:border-[#b8d2c8]"
        >
          ← Calcolatore e dimensioni
        </Link>
        <Link
          href="/knowledge/norme"
          className="rounded-2xl border border-[#dce2df] bg-white p-5 text-sm font-semibold text-[#1a5144] hover:border-[#b8d2c8]"
        >
          Esplora le norme →
        </Link>
        <Link
          href="/knowledge/gradi"
          className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-5 text-sm font-semibold text-[#1a5144] hover:border-[#b8d2c8]"
        >
          Esplora i gradi →
        </Link>
      </section>
    </div>
  );
}
