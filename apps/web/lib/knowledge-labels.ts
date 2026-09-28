const productFamilyLabels: Record<string, string> = {
  round_tube: "Tubi tondi",
  square_tube: "Profili cavi quadri",
  rectangular_tube: "Profili cavi rettangolari",
};

const applicationCategoryLabels: Record<string, string> = {
  structural_hollow_sections: "Profili cavi strutturali",
  pressure_tubes: "Tubi per impieghi in pressione",
  water_transport: "Trasporto acqua e liquidi acquosi",
  line_pipe: "Line pipe",
  pipe_dimensions: "Dimensioni tubazioni",
  high_temperature_pressure_pipe: "Tubazioni per alta temperatura",
  standard_pipe: "Tubazioni di uso generale",
};

const applicabilityLabels: Record<string, string> = {
  normative: "Applicabilità normativa",
  official_reference: "Riferimento ufficiale",
  manufacturer_range: "Gamma produttore",
  supplier_range: "Gamma fornitore",
  verified_internal: "Riferimento verificato",
  reference: "Riferimento",
};

const materialFamilyLabels: Record<string, string> = {
  pressure_carbon_steel: "Acciaio al carbonio per pressione",
  pressure_alloy_steel: "Acciaio legato per pressione",
  structural_carbon_steel: "Acciaio strutturale",
  fine_grain_structural_steel: "Acciaio strutturale a grano fine",
};

const manufacturingProcessLabels: Record<string, string> = {
  hot_finished: "Finito a caldo",
  cold_formed: "Formato a freddo",
  seamless: "Senza saldatura",
  welded: "Saldato",
  electric_welded: "Saldato elettricamente",
  submerged_arc_welded: "Saldato ad arco sommerso",
};

export function productFamilyLabel(value: string) {
  return productFamilyLabels[value] ?? value.replaceAll("_", " ");
}

export function applicationCategoryLabel(value: string | null | undefined) {
  if (!value) return null;
  return applicationCategoryLabels[value] ?? value.replaceAll("_", " ");
}

export function applicabilityLabel(value: string) {
  return applicabilityLabels[value] ?? value.replaceAll("_", " ");
}

export function manufacturingProcessLabel(value: string) {
  return manufacturingProcessLabels[value] ?? value.replaceAll("_", " ");
}

export function materialFamilyLabel(value: string | null | undefined) {
  if (!value) return null;
  return materialFamilyLabels[value] ?? value.replaceAll("_", " ");
}
