import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  getPublicTubeDimension,
  type PublicTubeDimension,
  type PublicTubeRelatedDimension,
} from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

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
      title: title + " · Steel Knowledge",
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
        "Il riferimento pubblico presente in Steel Knowledge è " +
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
      name: "Steel Sales AI",
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
        name: "Steel Knowledge",
        item: absoluteUrl("/knowledge"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Pesi & dimensioni",
        item: absoluteUrl("/knowledge/tubes"),
      },
      {
        "@type": "ListItem",
        position: 3,
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

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#2f6fed]">Steel Knowledge</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/tubes" className="hover:text-[#2f6fed]">Pesi &amp; dimensioni</Link>
        <span className="mx-2">/</span>
        <span>{size}</span>
      </nav>

      <header className="rounded-3xl border border-[#dce7f7] bg-white p-6 shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)] sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
            {product}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            Peso pubblicato
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[#68788e]">
          Il riferimento disponibile per questa geometria è{" "}
          <strong className="font-semibold text-[#1e2b45]">{formatNumber(dimension.weight_kg_m)} kg/m</strong>.
          Qui trovi il peso per barra, la conversione in tonnellate, il confronto con il calcolo geometrico e
          le dimensioni vicine già presenti nel catalogo.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Peso al metro", formatNumber(dimension.weight_kg_m) + " kg/m"],
          ["Barra 6 m", formatNumber(weight6m, 2) + " kg"],
          ["Barra 12 m", formatNumber(weight12m, 2) + " kg"],
          ["Metri per tonnellata", formatNumber(metresPerTonne, 2) + " m/t"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
            <p className="text-xs font-semibold text-[#7e8da1]">{label}</p>
            <p className="mt-1 text-xl font-semibold text-[#1e2b45]">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Calcolo rapido</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
            Da {formatNumber(dimension.weight_kg_m)} kg/m alla quantità commerciale
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#68788e]">
            Il peso per barra deriva direttamente dal valore pubblicato: kg/m × lunghezza. Una tonnellata teorica
            corrisponde a circa {formatNumber(bars6PerTonne, 2)} barre da 6 m oppure {formatNumber(bars12PerTonne, 2)} barre
            da 12 m. I numeri di barre per tonnellata sono rapporti matematici e non tengono conto di tolleranze,
            sfridi o vincoli logistici.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Circa barre da 6 m / t</p>
              <p className="mt-1 text-lg font-semibold text-[#1e2b45]">{formatNumber(bars6PerTonne, 2)}</p>
            </div>
            <div className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Circa barre da 12 m / t</p>
              <p className="mt-1 text-lg font-semibold text-[#1e2b45]">{formatNumber(bars12PerTonne, 2)}</p>
            </div>
          </div>

          <Link
            href={calculatorHref(dimension)}
            className="mt-6 inline-flex rounded-xl bg-[#2f6fed] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245ed1]"
          >
            Apri questa misura nel calcolatore →
          </Link>
        </div>

        <div className="rounded-3xl border border-[#dbe7f7] bg-[#f8fbff] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Confronto teorico</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1e2b45]">Geometria nominale a 7.850 kg/m³</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-4 border-b border-[#dfe8f4] pb-3 text-sm">
              <span className="text-[#68788e]">Area teorica</span>
              <strong className="text-[#1e2b45]">{formatNumber(theoretical.areaMm2, 2)} mm²</strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[#dfe8f4] pb-3 text-sm">
              <span className="text-[#68788e]">Peso teorico</span>
              <strong className="text-[#1e2b45]">{formatNumber(theoretical.kgM)} kg/m</strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[#68788e]">Scostamento pubblicato / teorico</span>
              <strong className="text-[#1e2b45]">{formatNumber(deltaPercent, 2)}%</strong>
            </div>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#68788e]">
            {dimension.product_family === "round_tube"
              ? "Il valore teorico usa diametro e spessore nominali. Il peso pubblicato resta il riferimento distinto mostrato in alto."
              : "Per SHS/RHS la formula usa spigoli vivi; i raggi reali degli angoli sono una delle ragioni per cui il dato pubblicato può differire."}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Fonte del peso</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">{dimension.source_provider}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#68788e]">
          Il valore di {formatNumber(dimension.weight_kg_m)} kg/m proviene dal riferimento tecnico indicato qui sotto.
          Steel Knowledge mostra la fonte pubblica e mantiene separati i dati di catalogo dai calcoli geometrici.
          Un peso pubblicato non sostituisce le tolleranze, la norma di prodotto o il certificato della fornitura.
        </p>
        <a
          href={dimension.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-sm font-semibold text-[#2f6fed]"
        >
          {dimension.source_name ?? dimension.source_provider} ↗
        </a>
      </section>

      {dimension.related_dimensions.length ? (
        <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Dimensioni correlate</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">Confronta misure vicine</h2>
          <p className="mt-2 text-sm leading-6 text-[#68788e]">
            Prima vengono proposti gli altri spessori della stessa dimensione esterna, poi le geometrie più vicine
            disponibili nel catalogo.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dimension.related_dimensions.map((related) => (
              <Link
                key={related.dimension_slug}
                href={"/knowledge/tubes/" + related.dimension_slug}
                className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-4 transition hover:border-[#bdd1f4]"
              >
                <p className="font-semibold text-[#1e2b45]">{relatedLabel(related)}</p>
                <p className="mt-2 text-sm text-[#68788e]">{formatNumber(related.weight_kg_m)} kg/m</p>
                <p className="mt-3 text-xs font-semibold text-[#2f6fed]">Apri scheda →</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-[#1e2b45]">Domande frequenti</h2>
        <div className="mt-4 divide-y divide-[#e8eef7]">
          {faq.map((item) => (
            <div key={item.question} className="py-4">
              <h3 className="text-sm font-semibold text-[#1e2b45]">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/knowledge/tubes"
          className="rounded-2xl border border-[#e1e8f2] bg-white p-5 text-sm font-semibold text-[#2f6fed] hover:border-[#bdd1f4]"
        >
          ← Calcolatore e dimensioni
        </Link>
        <Link
          href="/knowledge/norme"
          className="rounded-2xl border border-[#e1e8f2] bg-white p-5 text-sm font-semibold text-[#2f6fed] hover:border-[#bdd1f4]"
        >
          Esplora le norme →
        </Link>
        <Link
          href="/knowledge/gradi"
          className="rounded-2xl border border-[#d7e5ff] bg-[#eef5ff] p-5 text-sm font-semibold text-[#2f6fed] hover:border-[#bdd1f4]"
        >
          Esplora i gradi →
        </Link>
      </section>
    </div>
  );
}
