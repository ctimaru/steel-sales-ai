import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  standard?: string;
  grade?: string;
  price?: string;
  length?: string;
}>;

type EffectiveWeightRow = {
  geometry_id: string;
  material_grade_id: string | null;
  effective_status: "canonical_available" | "canonical_missing";
  effective_reference_id: string | null;
  effective_weight_kg_m: number | string | null;
  effective_weight_method: string | null;
};

type DimensionLink = {
  geometry_id: string;
  material_grade_id: string | null;
  is_normative_complete: boolean;
  applicability_type: string;
};

type CanonicalReference = {
  id: string;
  knowledge_source_id: string | null;
};

type KnowledgeSource = {
  id: string;
  source_key: string;
  provider: string;
  source_class: string;
};

function numberOrNull(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function geometryLabel(row: {
  product_family: string;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
}) {
  if (row.product_family === "round_tube") {
    return `Ø ${formatNumber(row.outer_diameter_mm)} × ${formatNumber(row.thickness_mm)} mm`;
  }
  if (row.product_family === "square_tube") {
    return `${formatNumber(row.width_mm)} × ${formatNumber(row.width_mm)} × ${formatNumber(row.thickness_mm)} mm`;
  }
  return `${formatNumber(row.width_mm)} × ${formatNumber(row.height_mm)} × ${formatNumber(row.thickness_mm)} mm`;
}

export default async function TubesStandardsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!configured) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="text-sm font-semibold">Tubi &amp; Norme</p>
          <h1 className="mt-2 text-2xl font-semibold">Archivio tecnico non disponibile in modalità demo.</h1>
          <p className="mt-2 text-sm text-amber-800">
            Collega il workspace per consultare norme, dimensioni e pesi di riferimento.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: standards }, { data: readiness }] = await Promise.all([
    supabase
      .from("steel_standards")
      .select("id,code,title,short_explanation,scope_summary,standard_system,application_category")
      .eq("status", "active")
      .order("standard_system")
      .order("code"),
    supabase.rpc("p1_shared_steel_reference_production_readiness"),
  ]);

  const selectedStandardId = params.standard || standards?.[0]?.id || "";
  const selectedStandard = standards?.find((row) => row.id === selectedStandardId);

  let gradeIds: string[] = [];
  let geometryIds: string[] = [];
  let dimensionLinks: DimensionLink[] = [];

  if (selectedStandardId) {
    const [{ data: gradeLinks }, { data: dimensionData }] = await Promise.all([
      supabase
        .from("steel_standard_grade_applicability")
        .select("material_grade_id")
        .eq("standard_id", selectedStandardId),
      supabase
        .from("steel_standard_dimension_applicability")
        .select("geometry_id,material_grade_id,is_normative_complete,applicability_type")
        .eq("standard_id", selectedStandardId),
    ]);

    dimensionLinks = (dimensionData ?? []) as DimensionLink[];
    gradeIds = [...new Set((gradeLinks ?? []).map((row) => row.material_grade_id))];
    geometryIds = [...new Set(dimensionLinks.map((row) => row.geometry_id))];
  }

  const [{ data: grades }, { data: geometries }, { data: effectiveRows }] = await Promise.all([
    gradeIds.length
      ? supabase
          .from("steel_material_grades")
          .select("id,designation,material_number,standard_system")
          .in("id", gradeIds)
          .order("designation")
      : Promise.resolve({ data: [] }),
    geometryIds.length
      ? supabase
          .from("steel_geometries")
          .select("id,product_family,outer_diameter_mm,width_mm,height_mm,thickness_mm,geometry_key")
          .in("id", geometryIds)
          .order("outer_diameter_mm", { nullsFirst: false })
          .order("width_mm", { nullsFirst: false })
          .order("thickness_mm")
      : Promise.resolve({ data: [] }),
    supabase.rpc("p1_shared_steel_effective_weight_catalog", {
      p_status: null,
      p_limit: 1000,
      p_offset: 0,
    }),
  ]);

  const selectedGradeId = params.grade || "";
  const selectedGrade = grades?.find((row) => row.id === selectedGradeId);
  const pricePerTonne = numberOrNull(params.price);
  const lengthM = numberOrNull(params.length) ?? 12;

  const effectiveMap = new Map(
    ((effectiveRows ?? []) as EffectiveWeightRow[]).map((row: EffectiveWeightRow) => [
      `${row.geometry_id}|${row.material_grade_id ?? ""}`,
      row,
    ]),
  );

  const canonicalReferenceIds = [
    ...new Set(
      ((effectiveRows ?? []) as EffectiveWeightRow[])
        .map((row) => row.effective_reference_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: canonicalReferencesData } = canonicalReferenceIds.length
    ? await supabase
        .from("steel_weight_references")
        .select("id,knowledge_source_id")
        .in("id", canonicalReferenceIds)
    : { data: [] };

  const canonicalReferences = (canonicalReferencesData ?? []) as CanonicalReference[];
  const sourceIds = [
    ...new Set(
      canonicalReferences
        .map((row) => row.knowledge_source_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: sourcesData } = sourceIds.length
    ? await supabase
        .from("knowledge_sources")
        .select("id,source_key,provider,source_class")
        .in("id", sourceIds)
    : { data: [] };

  const sourceById = new Map(
    ((sourcesData ?? []) as KnowledgeSource[]).map((source) => [source.id, source]),
  );
  const referenceById = new Map(canonicalReferences.map((reference) => [reference.id, reference]));

  const rows = (geometries ?? []).map((geometry) => {
    const key = `${geometry.id}|${selectedGradeId}`;
    const effective = effectiveMap.get(key);
    const weight = effective?.effective_weight_kg_m == null
      ? null
      : Number(effective.effective_weight_kg_m);
    const pricePerMeter =
      weight != null && pricePerTonne != null ? (pricePerTonne * weight) / 1000 : null;
    const pricePerPiece =
      pricePerMeter != null && lengthM != null ? pricePerMeter * lengthM : null;

    const dimensionEvidence = dimensionLinks.filter((link) => link.geometry_id === geometry.id);
    const isNormativeComplete = dimensionEvidence.some((link) => link.is_normative_complete);
    const canonicalReference = effective?.effective_reference_id
      ? referenceById.get(effective.effective_reference_id)
      : undefined;
    const source = canonicalReference?.knowledge_source_id
      ? sourceById.get(canonicalReference.knowledge_source_id)
      : undefined;

    return {
      geometry,
      effective,
      weight,
      pricePerMeter,
      pricePerPiece,
      isNormativeComplete,
      source,
    };
  });

  const availableCount = rows.filter(
    (row) => row.effective?.effective_status === "canonical_available",
  ).length;
  const missingCount = rows.length - availableCount;
  const readinessRow = readiness?.[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-indigo-600">Riferimenti tecnici</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Tubi &amp; Norme
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
              Consulta norme, qualità, dimensioni e pesi di riferimento. I calcoli commerciali sono disponibili solo quando esiste un peso verificato per quella combinazione.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Copertura dati</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {readinessRow?.sk5_gate_status === "ready_scoped_partial_catalog"
                ? "Copertura parziale controllata"
                : readinessRow?.sk5_gate_status ?? "Stato non disponibile"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {readinessRow?.canonical_scope_count ?? 0} riferimenti verificati ·{" "}
              {readinessRow?.missing_canonical_scope_count ?? 0} da completare
            </p>
          </div>
        </div>
      </section>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600">
          Norma
          <select
            name="standard"
            defaultValue={selectedStandardId}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            {(standards ?? []).map((standard) => (
              <option key={standard.id} value={standard.id}>
                {standard.code}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-600">
          Grado
          <select
            name="grade"
            defaultValue={selectedGradeId}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="">Senza qualità specifica</option>
            {(grades ?? []).map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.designation} · {grade.material_number}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-600">
          Prezzo €/t
          <input
            name="price"
            inputMode="decimal"
            defaultValue={params.price ?? ""}
            placeholder="es. 850"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          />
        </label>

        <div className="flex gap-2">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">
            Lunghezza m
            <input
              name="length"
              inputMode="decimal"
              defaultValue={params.length ?? "12"}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
          </label>
          <button className="mt-[22px] rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Applica
          </button>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Standard selezionato</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {selectedStandard?.code ?? "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {selectedStandard?.application_category?.replaceAll("_", " ") ?? "—"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {selectedStandard?.short_explanation ?? selectedStandard?.scope_summary ?? selectedStandard?.title ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-700">Pesi disponibili</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-950">{availableCount}</p>
          <p className="mt-1 text-xs text-emerald-700">
            utilizzabili per peso e calcolo commerciale
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-700">Pesi da completare</p>
          <p className="mt-1 text-2xl font-semibold text-amber-950">{missingCount}</p>
          <p className="mt-1 text-xs text-amber-700">nessun valore stimato automaticamente</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-slate-950">Tabella dimensionale</h2>
          <p className="mt-1 text-xs text-slate-500">
            {selectedGrade
              ? `${selectedGrade.designation} · ${selectedGrade.material_number}`
              : "Senza qualità specifica"}{" "}
            · {rows.length} geometrie collegate
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Dimensione</th>
                <th className="px-4 py-3 font-semibold">Peso kg/m</th>
                <th className="px-4 py-3 font-semibold">Metodo</th>
                <th className="px-4 py-3 font-semibold">Copertura</th>
                <th className="px-4 py-3 font-semibold">Fonte</th>
                <th className="px-4 py-3 font-semibold">€/m</th>
                <th className="px-4 py-3 font-semibold">€/pezzo</th>
                <th className="px-4 py-3 font-semibold">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ geometry, effective, weight, pricePerMeter, pricePerPiece, isNormativeComplete, source }) => {
                const available = effective?.effective_status === "canonical_available";
                return (
                  <tr key={geometry.id} className="align-top">
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {geometryLabel(geometry)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {formatNumber(weight, 4)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {effective?.effective_weight_method ?? "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={
                        isNormativeComplete
                          ? "inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                          : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      }>
                        {isNormativeComplete ? "Normativa completa" : "Copertura parziale"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {source ? (
                        <>
                          <p className="font-semibold text-slate-700">{source.provider}</p>
                          <p className="mt-0.5">{source.source_class} · {source.source_key}</p>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {pricePerTonne == null ? "Inserisci €/t" : formatNumber(pricePerMeter, 4)}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {pricePerTonne == null ? "Inserisci €/t" : formatNumber(pricePerPiece, 2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={
                          available
                            ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            : "inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                        }
                      >
                        {available ? "Canonical" : "Non supportato"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    Nessuna geometria collegata a questa norma nel catalogo corrente.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <p className="px-1 text-xs leading-5 text-slate-500">
        La copertura tecnica è ancora parziale: una dimensione o un peso possono essere mostrati come riferimento, ma vengono usati nei calcoli commerciali solo dopo verifica.
      </p>
    </div>
  );
}
