import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  getPublicTubeSizeHub,
  listPublicTubeSizeHubs,
  type PublicTubeSizeHub,
  type PublicTubeSizeHubSummary,
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

const loadSizeHub = cache(getPublicTubeSizeHub);

function hubTitle(hub: PublicTubeSizeHub) {
  if (hub.product_family === "round_tube") {
    return "Peso tubo Ø " + formatTubeNumber(hub.outer_diameter_mm ?? 0) + " mm per spessore";
  }
  if (hub.product_family === "square_tube") {
    return (
      "Peso profilo quadro " +
      formatTubeNumber(hub.width_mm ?? 0) +
      " × " +
      formatTubeNumber(hub.height_mm ?? 0) +
      " mm"
    );
  }
  return (
    "Peso profilo rettangolare " +
    formatTubeNumber(hub.width_mm ?? 0) +
    " × " +
    formatTubeNumber(hub.height_mm ?? 0) +
    " mm"
  );
}

function hubDescription(hub: PublicTubeSizeHub) {
  return (
    hubTitle(hub) +
    ": confronta " +
    hub.variant_count +
    " spessori da " +
    formatTubeNumber(hub.min_thickness_mm) +
    " a " +
    formatTubeNumber(hub.max_thickness_mm) +
    " mm e pesi pubblicati da " +
    formatTubeNumber(hub.min_weight_kg_m) +
    " a " +
    formatTubeNumber(hub.max_weight_kg_m) +
    " kg/m."
  );
}

function distance(a: PublicTubeSizeHubSummary, b: PublicTubeSizeHub) {
  if (b.product_family === "round_tube") {
    return Math.abs((a.outer_diameter_mm ?? 0) - (b.outer_diameter_mm ?? 0));
  }
  return (
    Math.abs((a.width_mm ?? 0) - (b.width_mm ?? 0)) +
    Math.abs((a.height_mm ?? 0) - (b.height_mm ?? 0))
  );
}

export async function tubeSizeHubMetadata(
  familySlug: PublicTubeFamilySlug,
  sizeSlug: string,
): Promise<Metadata> {
  const hub = await loadSizeHub(familySlug, sizeSlug);
  if (!hub) {
    return {
      title: "Gruppo dimensionale non disponibile",
      robots: { index: false, follow: false },
    };
  }

  const title = hubTitle(hub);
  const description = hubDescription(hub);
  const canonical = tubeSizeHubPath(familySlug, hub.size_slug);

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(canonical),
    },
    openGraph: {
      title: title + " · Scuola Smart Steel Sales",
      description,
      url: absoluteUrl(canonical),
      type: "website",
    },
  };
}

export async function PublicTubeSizeHubPage({
  familySlug,
  sizeSlug,
}: {
  familySlug: PublicTubeFamilySlug;
  sizeSlug: string;
}) {
  const family = getTubeFamilyBySlug(familySlug);
  const hub = await loadSizeHub(familySlug, sizeSlug);
  if (!family || !hub) notFound();

  const allHubs = await listPublicTubeSizeHubs(familySlug);
  const related = allHubs
    .filter((item) => item.size_slug !== hub.size_slug)
    .sort((a, b) => distance(a, hub) - distance(b, hub))
    .slice(0, 6);

  const title = hubTitle(hub);
  const description = hubDescription(hub);
  const sizeLabel = tubeSizeHubLabel(hub);

  const faq = [
    {
      question: "Quanto pesa " + sizeLabel + "?",
      answer:
        "Il peso dipende dallo spessore. In questo gruppo i riferimenti pubblicati vanno da " +
        formatTubeNumber(hub.min_weight_kg_m) +
        " a " +
        formatTubeNumber(hub.max_weight_kg_m) +
        " kg/m per spessori da " +
        formatTubeNumber(hub.min_thickness_mm) +
        " a " +
        formatTubeNumber(hub.max_thickness_mm) +
        " mm.",
    },
    {
      question: "Come scelgo lo spessore corretto?",
      answer:
        "Il confronto dei pesi non determina lo spessore di progetto. Lo spessore corretto dipende da norma, grado, carichi o pressione, tolleranze e requisiti della specifica tecnica.",
    },
    {
      question: "I pesi in tabella sono calcolati o pubblicati?",
      answer:
        "La tabella usa riferimenti canonici pubblicati nel catalogo tecnico. Ogni riga conserva la propria fonte; il calcolo teorico resta disponibile separatamente nella scheda della singola dimensione.",
    },
  ];

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: absoluteUrl(tubeSizeHubPath(familySlug, hub.size_slug)),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: hub.variants.length,
      itemListElement: hub.variants.map((variant, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name:
          sizeLabel +
          " × " +
          formatTubeNumber(variant.thickness_mm) +
          " mm — " +
          formatTubeNumber(variant.weight_kg_m) +
          " kg/m",
        url: absoluteUrl("/knowledge/tubes/" + variant.dimension_slug),
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
        name: family.label,
        item: absoluteUrl(tubeFamilyHubPath(familySlug)),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: sizeLabel,
        item: absoluteUrl(tubeSizeHubPath(familySlug, hub.size_slug)),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
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
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/tubes" className="hover:text-[#1a5144]">Pesi &amp; dimensioni</Link>
        <span className="mx-2">/</span>
        <Link href={tubeFamilyHubPath(familySlug)} className="hover:text-[#1a5144]">{family.label}</Link>
        <span className="mx-2">/</span>
        <span>{sizeLabel}</span>
      </nav>

      <header className="rounded-3xl border border-[#dce2df] bg-white p-6 shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)] sm:p-8 lg:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Confronto per spessore</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[#66736e]">{description}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Spessori pubblicati", String(hub.variant_count)],
          [
            "Intervallo spessore",
            formatTubeNumber(hub.min_thickness_mm) + "–" + formatTubeNumber(hub.max_thickness_mm) + " mm",
          ],
          [
            "Intervallo peso",
            formatTubeNumber(hub.min_weight_kg_m) + "–" + formatTubeNumber(hub.max_weight_kg_m) + " kg/m",
          ],
          ["Fonti nel gruppo", String(hub.source_count)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <p className="text-xs font-semibold text-[#7e8da1]">{label}</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Tabella pesi</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Peso per ogni spessore disponibile</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          Ogni riga apre una scheda dimensionale esatta con confronto teorico, peso per barra, tonnellaggio e fonte.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#e7edf6] text-xs uppercase tracking-wide text-[#7e8da1]">
              <tr>
                <th className="px-2 py-3 font-semibold">Spessore</th>
                <th className="px-2 py-3 font-semibold">kg/m</th>
                <th className="px-2 py-3 font-semibold">Barra 6 m</th>
                <th className="px-2 py-3 font-semibold">Barra 12 m</th>
                <th className="px-2 py-3 font-semibold">Fonte</th>
                <th className="px-2 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f6]">
              {hub.variants.map((variant) => (
                <tr key={variant.dimension_slug}>
                  <td className="px-2 py-3 font-medium text-[#1d2824]">
                    {formatTubeNumber(variant.thickness_mm)} mm
                  </td>
                  <td className="px-2 py-3 text-[#40516a]">{formatTubeNumber(variant.weight_kg_m)} kg/m</td>
                  <td className="px-2 py-3 text-[#66736e]">
                    {formatTubeNumber(variant.weight_kg_m * 6, 2)} kg
                  </td>
                  <td className="px-2 py-3 text-[#66736e]">
                    {formatTubeNumber(variant.weight_kg_m * 12, 2)} kg
                  </td>
                  <td className="px-2 py-3 text-[#66736e]">
                    <a
                      href={variant.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#1a5144]"
                    >
                      {variant.source_provider} ↗
                    </a>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Link
                      href={"/knowledge/tubes/" + variant.dimension_slug}
                      className="font-semibold text-[#1a5144]"
                    >
                      Scheda →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-[#1d2824]">Come cambia il peso con lo spessore</h2>
          <p className="mt-3 text-sm leading-7 text-[#66736e]">
            A parità di dimensione esterna, aumentando lo spessore aumenta la quantità di acciaio nella sezione e quindi
            il peso al metro. La relazione non va usata per scegliere automaticamente uno spessore: il dimensionamento
            dipende dalla norma applicabile e dai requisiti di progetto.
          </p>
        </div>
        <div className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-[#1d2824]">Hai una misura diversa?</h2>
          <p className="mt-3 text-sm leading-7 text-[#66736e]">
            Usa il calcolatore pubblico per inserire dimensioni, lunghezza e quantità. Se esiste un riferimento canonico
            per la geometria scelta, il risultato pubblicato viene mostrato separatamente dalla stima teorica.
          </p>
          <Link
            href="/knowledge/tubes"
            className="school-primary-action mt-5"
          >
            Apri il calcolatore →
          </Link>
        </div>
      </section>

      {related.length ? (
        <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Cluster correlati</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Confronta dimensioni esterne vicine</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.size_slug}
                href={tubeSizeHubPath(familySlug, item.size_slug)}
                className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4 transition hover:border-[#b8d2c8]"
              >
                <p className="font-semibold text-[#1d2824]">{tubeSizeHubLabel(item)}</p>
                <p className="mt-2 text-xs text-[#66736e]">
                  {item.variant_count} spessori · {formatTubeNumber(item.min_weight_kg_m)}–
                  {formatTubeNumber(item.max_weight_kg_m)} kg/m
                </p>
                <p className="mt-3 text-xs font-semibold text-[#1a5144]">Apri cluster →</p>
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
    </div>
  );
}
