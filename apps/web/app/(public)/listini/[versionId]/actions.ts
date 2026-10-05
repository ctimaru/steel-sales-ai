"use server";

import { revalidatePath } from "next/cache";

import {
  calculateDistintaLine,
  calculateDistintaTotals,
} from "@/lib/distinta";
import {
  getPriceListExplorerItems,
  getPriceListExplorerVersion,
} from "@/lib/price-list-explorer-server";
import type {
  DiscountScopeType,
  DiscountVisibility,
  EffectiveDiscount,
} from "@/lib/private-pricing";
import type { PricingSessionSaveInput } from "@/lib/pricing-session";
import { solveDiscountForTargetEurT } from "@/lib/reverse-pricing";
import { createClient } from "@/lib/supabase/server";

type SaveDiscountProfileInput = {
  versionId: string;
  scopeType: DiscountScopeType;
  discountPct: number;
  visibility: DiscountVisibility;
  gradeCode?: string | null;
  finishCode?: string | null;
  sectionId?: string | null;
  itemId?: string | null;
  label?: string | null;
};

export async function saveDiscountProfile(
  input: SaveDiscountProfileInput,
): Promise<{ ok: boolean; profileId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per salvare un profilo sconto." };
  }

  if (!Number.isFinite(input.discountPct) || input.discountPct < 0 || input.discountPct > 100) {
    return { ok: false, error: "Lo sconto deve essere compreso tra 0 e 100%." };
  }

  const { data, error } = await supabase.rpc("pl1_save_discount_profile", {
    p_version_id: input.versionId,
    p_scope_type: input.scopeType,
    p_discount_pct: input.discountPct,
    p_visibility: input.visibility,
    p_section_id: input.sectionId ?? null,
    p_grade_code: input.gradeCode?.trim() || null,
    p_finish_code: input.finishCode?.trim() || null,
    p_price_list_item_id: input.itemId ?? null,
    p_label: input.label?.trim() || null,
  });

  if (error) {
    console.error("PL1.7 save profile failed:", error.message);
    return {
      ok: false,
      error:
        error.message.includes("organization discount profiles require admin role")
          ? "Solo un amministratore aziendale può modificare i profili condivisi."
          : "Non è stato possibile salvare il profilo sconto.",
    };
  }

  revalidatePath("/listini/" + input.versionId);
  revalidatePath("/listini");

  return { ok: true, profileId: typeof data === "string" ? data : undefined };
}

export async function deactivateDiscountProfile(
  versionId: string,
  profileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per modificare i profili sconto." };
  }

  const { data, error } = await supabase.rpc("pl1_deactivate_discount_profile", {
    p_profile_id: profileId,
  });

  if (error || data !== true) {
    if (error) console.error("PL1.7 deactivate profile failed:", error.message);
    return {
      ok: false,
      error: "Non è stato possibile disattivare il profilo sconto.",
    };
  }

  revalidatePath("/listini/" + versionId);
  revalidatePath("/listini");

  return { ok: true };
}


function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function netPricePerMeter(
  baseEurM: number,
  fixedExtraEurM: number,
  discountPct: number,
  formula: string | null,
) {
  if (formula !== "discounted_base_plus_fixed_extra") return null;
  return baseEurM * (1 - discountPct / 100) + fixedExtraEurM;
}

export async function savePricingSession(
  input: PricingSessionSaveInput,
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per salvare la distinta." };
  }

  if (!Array.isArray(input.lines) || input.lines.length < 1) {
    return { ok: false, error: "Aggiungi almeno una riga alla distinta." };
  }

  if (input.lines.length > 500) {
    return { ok: false, error: "La distinta può contenere al massimo 500 righe." };
  }

  if (!["manual", "saved", "target"].includes(input.pricingMode)) {
    return { ok: false, error: "Modalità prezzo non valida." };
  }

  const [version, items] = await Promise.all([
    getPriceListExplorerVersion(input.versionId, true),
    getPriceListExplorerItems(input.versionId, true),
  ]);

  if (!version) {
    return { ok: false, error: "Il listino non è disponibile per il tuo account." };
  }

  if (version.pricing_formula !== "discounted_base_plus_fixed_extra") {
    return {
      ok: false,
      error: "Questa formula commerciale non è ancora salvabile in modo deterministico.",
    };
  }

  const itemMap = new Map(items.map((item) => [item.item_id, item]));
  const selectedIds = new Set(input.lines.map((line) => line.itemId));

  if (selectedIds.size !== input.lines.length) {
    return { ok: false, error: "La distinta contiene articoli duplicati." };
  }

  let effectiveDiscountByItem = new Map<string, EffectiveDiscount>();

  if (input.pricingMode === "saved") {
    const { data, error } = await supabase.rpc("pl1_effective_discounts_for_version", {
      p_version_id: input.versionId,
    });

    if (error) {
      console.error("PL1.11 saved pricing lookup failed:", error.message);
      return { ok: false, error: "Non è stato possibile risolvere i profili sconto." };
    }

    effectiveDiscountByItem = new Map(
      (Array.isArray(data) ? (data as EffectiveDiscount[]) : []).map((row) => [
        row.price_list_item_id,
        row,
      ]),
    );
  }

  const manualDiscountPct =
    input.pricingMode === "manual" ? numberValue(input.manualDiscountPct) : null;
  const targetEurT =
    input.pricingMode === "target" ? numberValue(input.targetEurT) : null;

  if (
    input.pricingMode === "manual" &&
    (manualDiscountPct === null || manualDiscountPct < 0 || manualDiscountPct > 100)
  ) {
    return { ok: false, error: "Lo sconto manuale deve essere compreso tra 0 e 100%." };
  }

  if (input.pricingMode === "target" && (targetEurT === null || targetEurT <= 0)) {
    return { ok: false, error: "Il target €/t deve essere maggiore di zero." };
  }

  const lineSnapshots: Array<Record<string, unknown>> = [];
  const lineCalculations: ReturnType<typeof calculateDistintaLine>[] = [];

  for (let index = 0; index < input.lines.length; index += 1) {
    const draft = input.lines[index];
    const item = itemMap.get(draft.itemId);

    if (!item) {
      return {
        ok: false,
        error: "Uno degli articoli selezionati non appartiene al listino corrente.",
      };
    }

    const baseEurM = numberValue(item.base_eur_m);
    const fixedExtraEurM = numberValue(item.fixed_extra_eur_m);
    const weightKgM = numberValue(item.resolved_weight_kg_m);

    if (baseEurM === null || fixedExtraEurM === null || !item.price_per_m_ready) {
      return {
        ok: false,
        error: "Una riga non dispone di Base/Extra governati.",
      };
    }

    let appliedDiscountPct: number;
    let discountSource: "manual" | "saved_profile" | "target";
    let discountProfileId: string | null = null;

    if (input.pricingMode === "target") {
      const reverse = solveDiscountForTargetEurT({
        formula: version.pricing_formula,
        targetEurT: targetEurT as number,
        baseEurM,
        fixedExtraEurM,
        weightKgM,
        pricePerTReady: item.price_per_t_ready,
      });

      if (reverse.status !== "ready" || reverse.discountPct === null) {
        return {
          ok: false,
          error:
            "Il target €/t non è risolvibile per " +
            item.dimension_label +
            ". Correggi o rimuovi la riga prima di salvare.",
        };
      }

      appliedDiscountPct = reverse.discountPct;
      discountSource = "target";
    } else if (input.pricingMode === "saved") {
      const effective = effectiveDiscountByItem.get(item.item_id) ?? null;
      appliedDiscountPct = Number(effective?.discount_pct ?? 0);
      discountSource = "saved_profile";
      discountProfileId = effective?.profile_id ?? null;
    } else {
      appliedDiscountPct = manualDiscountPct as number;
      discountSource = "manual";
    }

    if (
      !Number.isFinite(appliedDiscountPct) ||
      appliedDiscountPct < 0 ||
      appliedDiscountPct > 100
    ) {
      return { ok: false, error: "Una riga contiene uno sconto non valido." };
    }

    const netEurM = netPricePerMeter(
      baseEurM,
      fixedExtraEurM,
      appliedDiscountPct,
      version.pricing_formula,
    );

    if (netEurM === null || netEurM < 0) {
      return { ok: false, error: "Una riga non produce un prezzo €/m valido." };
    }

    const quantity = numberValue(draft.quantity);
    const barLengthM = numberValue(draft.barLengthM);

    if (quantity === null || quantity <= 0) {
      return {
        ok: false,
        error: "Completa la quantità di tutte le righe prima di salvare.",
      };
    }

    const calculation = calculateDistintaLine({
      quantityMode: draft.quantityMode,
      quantity,
      barLengthM: barLengthM ?? 0,
      weightKgM,
      netEurM,
    });

    if (
      calculation.issue !== null ||
      calculation.meters === null ||
      calculation.lineTotalEur === null
    ) {
      return {
        ok: false,
        error:
          "La riga " +
          item.dimension_label +
          " non è completa. Verifica quantità, lunghezza barra o peso.",
      };
    }

    const netEurT =
      item.price_per_t_ready && weightKgM !== null && weightKgM > 0
        ? (netEurM / weightKgM) * 1000
        : null;

    lineCalculations.push(calculation);
    lineSnapshots.push({
      line_position: index + 1,
      price_list_item_id: item.item_id,
      dimension_label_snapshot: item.dimension_label,
      shape_code_snapshot: item.shape_code,
      standard_code_snapshot: item.standard_code ?? item.standard_raw ?? "",
      grade_code_snapshot: item.grade_code ?? item.grade_raw ?? "",
      finish_code_snapshot: item.finish_code ?? item.finish_raw ?? "",
      thickness_mm_snapshot: Number(item.thickness_mm),
      note_snapshot: item.note_raw ?? "",
      quantity_mode: draft.quantityMode,
      quantity,
      bar_length_m: draft.quantityMode === "bars" ? barLengthM : null,
      line_meters: calculation.meters,
      weight_kg_m_snapshot: weightKgM,
      weight_reference_id_snapshot: "",
      weight_resolution_mode_snapshot: item.weight_resolution_mode ?? "",
      formula_version_snapshot: version.manufacturer_version_code,
      line_tonnes: calculation.tonnes,
      base_eur_m_snapshot: baseEurM,
      fixed_extra_eur_m_snapshot: fixedExtraEurM,
      applied_discount_pct: appliedDiscountPct,
      discount_source: discountSource,
      discount_profile_id: discountProfileId ?? "",
      net_eur_m: netEurM,
      net_eur_t: netEurT,
      line_total: calculation.lineTotalEur,
      price_per_t_ready_snapshot: item.price_per_t_ready,
      price_per_t_status_snapshot: item.price_per_t_status,
      source_locator_snapshot:
        item.source_page === null ? {} : { page: item.source_page },
    });
  }

  const totals = calculateDistintaTotals(lineCalculations);

  const defaultTitle =
    version.list_name +
    " · " +
    version.manufacturer_version_code +
    " · " +
    new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());

  const sessionPayload = {
    price_list_version_id: version.version_id,
    title: input.title?.trim() || defaultTitle,
    pricing_mode: input.pricingMode,
    manual_discount_pct:
      input.pricingMode === "manual" ? manualDiscountPct : "",
    target_eur_t: input.pricingMode === "target" ? targetEurT : "",
    currency_code: version.currency_code,
    pricing_formula: version.pricing_formula,
    list_name_snapshot: version.list_name,
    list_code_snapshot: version.list_code,
    manufacturer_version_snapshot: version.manufacturer_version_code,
    manufacturer_revision_snapshot: version.manufacturer_revision_code ?? "",
    source_date_snapshot: version.source_date ?? "",
    line_count: lineSnapshots.length,
    total_meters: totals.totalMeters,
    total_tonnes: totals.totalTonnes,
    total_value: totals.totalValueEur,
    weighted_average_eur_t: totals.weightedAverageEurT ?? "",
    meters_complete: totals.metersComplete,
    tonnes_complete: totals.tonnesComplete,
    value_complete: totals.valueComplete,
    weighted_average_status: totals.weightedAverageStatus,
  };

  const { data, error } = await supabase.rpc("pl1_create_pricing_session_snapshot", {
    p_session: sessionPayload,
    p_lines: lineSnapshots,
  });

  if (error) {
    console.error("PL1.11 session save failed:", error.message);
    return { ok: false, error: "Non è stato possibile salvare la distinta." };
  }

  const sessionId = typeof data === "string" ? data : null;
  if (!sessionId) {
    return { ok: false, error: "Salvataggio completato senza identificativo sessione." };
  }

  revalidatePath("/listini/storico");
  revalidatePath("/listini/storico/" + sessionId);

  return { ok: true, sessionId };
}
