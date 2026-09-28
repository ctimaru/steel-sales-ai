import type { Metadata } from "next";
import Link from "next/link";

import { materialFamilyLabel } from "@/lib/knowledge-labels";
import {
  listPublicGrades,
  type PublicKnowledgeGradeSummary,
} from "@/lib/public-knowledge";
import { robotsForParameterizedPage } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const baseMetadata: Metadata = {
  title: "Gradi di acciaio e materiali",
  description:
    "Catalogo pubblico dei principali gradi di acciaio per tubi e profilati: P235GH, P265GH, 16Mo3, P235TR1/TR2, P265TR1/TR2, S355J2H, S355NH e S355NLH.",
  alternates: {
    canonical: absoluteUrl("/knowledge/gradi"),
  },
  openGraph: {
    title: "Gradi di acciaio e materiali · Steel Knowledge",
    description:
      "Consulta le schede pubbliche dei principali gradi di acciaio e le norme a cui risultano collegati.",
    url: absoluteUrl("/knowledge/gradi"),
    type: "website",
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  return {
    ...baseMetadata,
    robots: robotsForParameterizedPage(Boolean(params.q?.trim())),
  };
}

const gradeGroups = [
  {
    key: "pressure-elevated",
    anchor: "pressione-temperatura-elevata",
    title: "Pressione e temperatura elevata",
    description:
      "Gradi per tubi e componenti in pressione quando il servizio richiede proprietà specificate a temperatura elevata.",
    slugs: ["p235gh", "p265gh", "16mo3"],
  },
  {
    key: "pressure-room",
    anchor: "pressione-temperatura-ambiente",
    title: "Pressione a temperatura ambiente",
    description:
      "Gradi TR1 e TR2 usati in contesti di tubi per pressione con proprietà specificate a temperatura ambiente.",
    slugs: ["p235tr1", "p235tr2", "p265tr1", "p265tr2"],
  },
  {
    key: "structural",
    anchor: "profilati-cavi-strutturali",
    title: "Profilati cavi strutturali",
    description:
      "Gradi S355 per hollow sections, con famiglie di tenacità e condizioni di fornitura differenti.",
    slugs: ["s355j2h", "s355nh", "s355nlh"],
  },
] as const;

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function GradeCard({ grade }: { grade: PublicKnowledgeGradeSummary }) {
  return (
    <Link
      href={`/knowledge/gradi/${grade.slug}`}
      className="group rounded-2xl border border-[#e1e8f2] bg-white p-5 transition hover:border-[#bdd1f4] hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2f6fed]">
            {materialFamilyLabel(grade.material_family) ?? grade.standard_system ?? "Acciaio"}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[#1e2b45]">{grade.designation}</h3>
          {grade.material_number ? (
            <p className="mt-1 text-sm text-[#68788e]">Materiale {grade.material_number}</p>
          ) : null}
        </div>
        {grade.related_standard_count > 0 ? (
          <span className="rounded-full bg-[#f2f5f9] px-2.5 py-1 text-[10px] font-semibold text-[#68788e]">
            {grade.related_standard_count} norme collegate
          </span>
        ) : null}
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#68788e]">
        {grade.seo_description}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 text-xs">
        <span className="text-[#8a99ac]">Rivista {formatReviewDate(grade.last_reviewed_at)}</span>
        <span className="font-semibold text-[#2f6fed]">Apri scheda →</span>
      </div>
    </Link>
  );
}

export default async function GradesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const grades = await listPublicGrades(query);

  const grouped = gradeGroups
    .map((group) => ({
      ...group,
      grades: grades.filter((grade) => group.slugs.some((slug) => slug === grade.slug)),
    }))
    .filter((group) => group.grades.length > 0);

  const groupedSlugs = new Set<string>(gradeGroups.flatMap((group) => [...group.slugs]));
  const uncategorized = grades.filter((grade) => !groupedSlugs.has(grade.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Gradi di acciaio e materiali",
    url: absoluteUrl("/knowledge/gradi"),
    description:
      "Catalogo pubblico e revisionato di schede sui principali gradi di acciaio per tubi e profilati.",
    hasPart: grades.map((grade) => ({
      "@type": "TechArticle",
      name: grade.seo_title,
      url: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
    })),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#2f6fed]">Steel Knowledge</Link>
        <span className="mx-2">/</span>
        <span>Gradi di acciaio</span>
      </nav>

      <section className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Catalogo gradi</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
          Trova il materiale partendo dall&apos;impiego, dalla sigla o dal numero materiale
        </h1>
        <p className="mt-4 text-base leading-7 text-[#68788e]">
          Le schede spiegano come leggere una designazione, a quali norme risulta collegata e quali materiali
          sono utili da confrontare. Le relazioni servono alla discovery: non implicano equivalenza o sostituibilità
          automatica.
        </p>
      </section>

      {!query ? (
        <section className="grid gap-4 md:grid-cols-3" aria-label="Percorsi del catalogo gradi">
          {gradeGroups.map((group) => {
            const count = grades.filter((grade) => group.slugs.some((slug) => slug === grade.slug)).length;
            return (
              <a
                key={group.key}
                href={`#${group.anchor}`}
                className="rounded-2xl border border-[#dbe7f7] bg-[#f8fbff] p-5 transition hover:border-[#bdd1f4]"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
                  {count ? `${count} schede` : "In sviluppo"}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[#1e2b45]">{group.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#68788e]">{group.description}</p>
              </a>
            );
          })}
        </section>
      ) : null}

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Ricerca</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">Cerca grado, materiale o norma</h2>
            <p className="mt-1 text-sm text-[#68788e]">
              Esempi: P265GH, 1.0425, S355J2H, EN 10217-1.
            </p>
          </div>
          <form className="flex w-full max-w-xl gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Cerca P265GH, 1.0425, EN 10217-1..."
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none focus:border-[#bdd1f4] focus:ring-4 focus:ring-[#eaf2ff]"
            />
            <button className="h-11 rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245ed1]">
              Cerca
            </button>
          </form>
        </div>
      </section>

      {grades.length ? (
        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.key} id={group.anchor} className="scroll-mt-24">
              <div className="mb-4 max-w-3xl">
                <h2 className="text-2xl font-semibold text-[#1e2b45]">{group.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#68788e]">{group.description}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.grades.map((grade) => (
                  <GradeCard key={grade.material_grade_id} grade={grade} />
                ))}
              </div>
            </section>
          ))}

          {uncategorized.length ? (
            <section>
              <h2 className="text-2xl font-semibold text-[#1e2b45]">Altri gradi</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {uncategorized.map((grade) => (
                  <GradeCard key={grade.material_grade_id} grade={grade} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section className="rounded-3xl border border-dashed border-[#cbd7e6] bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-[#1e2b45]">
            Nessuna scheda pubblicata corrisponde alla ricerca
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#68788e]">
            Prova con una designazione, un numero materiale oppure il codice di una norma collegata.
          </p>
          <Link href="/knowledge/gradi" className="mt-4 inline-flex text-sm font-semibold text-[#2f6fed]">
            Azzera ricerca
          </Link>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#d7e5ff] bg-[#eef5ff] p-5">
          <p className="text-sm font-semibold text-[#1e2b45]">Vuoi partire dalla norma?</p>
          <p className="mt-1 text-sm leading-6 text-[#5f7088]">
            Le schede norma spiegano ambito, parti, processi e relazioni osservate con i materiali.
          </p>
          <Link href="/knowledge/norme" className="mt-3 inline-flex text-sm font-semibold text-[#2f6fed]">
            Esplora le norme →
          </Link>
        </div>
        <div className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
          <p className="text-sm font-semibold text-[#1e2b45]">Hai già diametro e spessore?</p>
          <p className="mt-1 text-sm leading-6 text-[#68788e]">
            Continua con il layer pesi e dimensioni per trasformare la geometria in un riferimento quantitativo.
          </p>
          <Link href="/knowledge/tubes" className="mt-3 inline-flex text-sm font-semibold text-[#2f6fed]">
            Apri pesi & dimensioni →
          </Link>
        </div>
      </section>
    </div>
  );
}
