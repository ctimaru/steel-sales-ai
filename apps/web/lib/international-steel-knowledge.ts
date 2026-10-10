/**
 * I18N3 English editorial layer for already-published Steel Knowledge records.
 *
 * This is original, concise explanatory copy, NOT the text of an EN standard.
 * Publication is always gated by the existing anonymous-safe K2 read models:
 * a matching public standard/grade is required before a page or sitemap item exists.
 * Grade links are discovery context only: never infer normative equivalence.
 */
export type EnglishKnowledgeStandard = {
  slug: string;
  code: string;
  group: "structural" | "pressure" | "water";
  title: string;
  summary: string;
  covers: string;
  procurement: string;
  distinction: string;
  relatedGrades: readonly string[];
};

export const englishStandards = [
  {
    slug: "en-10210", code: "EN 10210", group: "structural",
    title: "Hot-finished structural hollow sections",
    summary: "EN 10210 addresses hot-finished structural hollow sections used in steelwork. The manufacturing route, product designation and dimensional requirements must all be identified in an enquiry.",
    covers: "Part 1 sets technical delivery conditions for structural hollow sections. Part 2 addresses tolerances, dimensions and sectional properties. Circular, square and rectangular shapes belong to this product family.",
    procurement: "Specify EN 10210 and the relevant part and edition, steel grade, CHS/SHS/RHS geometry, wall thickness, bar length, quantities, inspection documents and delivery conditions.",
    distinction: "EN 10210 concerns hot-finished hollow sections. EN 10219 concerns welded cold-formed hollow sections. Equal nominal dimensions alone do not make the products interchangeable.",
    relatedGrades: ["s355j2h", "s355nh", "s355nlh"],
  },
  {
    slug: "en-10219", code: "EN 10219", group: "structural",
    title: "Cold-formed welded structural hollow sections",
    summary: "EN 10219 covers welded, cold-formed structural hollow sections. It is widely used for steel frames, fabrications and other structural applications.",
    covers: "Part 1 specifies technical delivery conditions; Part 2 deals with tolerances, dimensions and sectional properties. A section designation is not complete without its delivery requirements.",
    procurement: "State the product family, EN 10219 part and edition, grade, outside dimensions, thickness, lengths and certificates. Confirm availability and tolerances against the supplier's product range.",
    distinction: "Cold-formed production and hot-finished production have different manufacturing characteristics. EN 10219 must not be treated as a silent substitute for EN 10210.",
    relatedGrades: ["s355j2h"],
  },
  {
    slug: "en-10216-2", code: "EN 10216-2", group: "pressure",
    title: "Seamless steel tubes for elevated-temperature pressure service",
    summary: "EN 10216-2 specifies technical delivery conditions for seamless steel tubes for pressure purposes with specified elevated-temperature properties.",
    covers: "The product scope focuses on seamless pressure tubes, the specified material properties and applicable testing and supply requirements. It should be read with the required material grade.",
    procurement: "Include seamless manufacture, EN 10216-2 with edition, steel grade, OD and wall thickness, service requirements and EN 10204 inspection document expectations.",
    distinction: "EN 10217-2 addresses electric-welded pressure tubes with elevated-temperature properties; process and normative scope are different, not automatically equivalent.",
    relatedGrades: ["p235gh", "p265gh", "16mo3"],
  },
  {
    slug: "en-10217-1", code: "EN 10217-1", group: "pressure",
    title: "Welded steel tubes for room-temperature pressure service",
    summary: "EN 10217-1 is a technical delivery standard for welded, non-alloy steel tubes for pressure purposes with specified room-temperature properties.",
    covers: "It covers the relevant welded tube supply and test requirements for its intended pressure-service scope. TR1 and TR2 are distinct material quality designations.",
    procurement: "Identify the welding process where necessary, EN 10217-1, material grade and TR quality, dimensions, tolerances and inspection documentation.",
    distinction: "For specified elevated-temperature properties, examine the appropriate alternative part of the EN 10217 family instead of assuming EN 10217-1 applies.",
    relatedGrades: ["p235tr1", "p235tr2", "p265tr1", "p265tr2"],
  },
  {
    slug: "en-10217-2", code: "EN 10217-2", group: "pressure",
    title: "Electric-welded pressure tubes for elevated-temperature service",
    summary: "EN 10217-2 concerns electric-welded steel tubes for pressure purposes where elevated-temperature properties are specified.",
    covers: "The document addresses electric-welded manufacture and technical delivery conditions for its elevated-temperature pressure-tube scope.",
    procurement: "Include EN 10217-2 and edition, welding route, grade, OD, thickness, length, examination requirements and inspection certificate needs.",
    distinction: "EN 10216-2 is the corresponding seamless pressure-tube family. The same grade designation can appear in different product routes without proving interchangeability.",
    relatedGrades: ["p235gh", "p265gh"],
  },
  {
    slug: "en-10224", code: "EN 10224", group: "water",
    title: "Steel tubes and fittings for water and aqueous liquids",
    summary: "EN 10224 applies to specified steel tubes and fittings for conveying water and other aqueous liquids.",
    covers: "The standard concerns product delivery requirements for the applicable water-transport pipe and fitting applications; project conditions and coatings may call for additional specifications.",
    procurement: "Specify EN 10224, tube or fitting type, dimensions, pressure/service conditions, coatings or lining if required, connection details and applicable inspection documents.",
    distinction: "A water-service tube specification is not automatically interchangeable with structural hollow-section or general pressure-tube standards.",
    relatedGrades: [],
  },
] as const satisfies readonly EnglishKnowledgeStandard[];

export type EnglishKnowledgeGrade = {
  slug: string;
  designation: string;
  group: "structural" | "pressure-high" | "pressure-room";
  title: string;
  summary: string;
  designationMeaning: string;
  procurement: string;
  difference: string;
  relatedStandards: readonly string[];
};

export const englishGrades = [
  {
    slug: "s355j2h", designation: "S355J2H", group: "structural",
    title: "Structural hollow-section steel grade",
    summary: "S355J2H is a steel grade designation encountered in structural hollow sections. It describes a material, not by itself the manufacturing process or the full product specification.",
    designationMeaning: "S identifies structural steel, 355 is the nominal strength class, J2 identifies a toughness designation and H refers to hollow-section products. Actual requirements depend on the standard, product thickness and supply condition.",
    procurement: "Specify S355J2H together with EN 10210 or EN 10219 as applicable, the desired CHS/SHS/RHS geometry and inspection documents.",
    difference: "The same designation can be encountered in different structural hollow-section product families; supplier evidence does not grant automatic substitution.",
    relatedStandards: ["en-10210", "en-10219"],
  },
  {
    slug: "s355nh", designation: "S355NH", group: "structural",
    title: "Normalised or normalising-rolled structural hollow-section steel",
    summary: "S355NH is a structural hollow-section grade associated with a normalised or normalising-rolled delivery condition in applicable product specifications.",
    designationMeaning: "The suffixes convey material characteristics and delivery requirements; they are not optional decorative text in a purchase order.",
    procurement: "Check the full EN product standard and edition, delivery condition, wall thickness and certification before requesting S355NH.",
    difference: "Do not substitute S355NH for S355J2H or S355NLH solely on the basis of the common S355 designation.",
    relatedStandards: ["en-10210"],
  },
  {
    slug: "s355nlh", designation: "S355NLH", group: "structural",
    title: "Structural hollow-section steel with specified toughness class",
    summary: "S355NLH belongs to a structural hollow-section material family with a distinct delivery and impact-toughness designation.",
    designationMeaning: "N, L and H form part of the full grade identity. The required testing and delivery requirements must be confirmed from the applicable edition of the product standard.",
    procurement: "State S355NLH in full, with the product standard, section size and required test documentation.",
    difference: "Similar S355 grades are not automatically equivalent; toughness and delivery conditions may differ.",
    relatedStandards: ["en-10210"],
  },
  {
    slug: "p235gh", designation: "P235GH", group: "pressure-high",
    title: "Pressure steel for elevated-temperature service",
    summary: "P235GH is a steel grade used in products designed for pressure applications where specified elevated-temperature properties may be required.",
    designationMeaning: "P indicates a pressure-related steel grade family; GH distinguishes an elevated-temperature designation. The full grade does not, alone, establish a tube manufacturing route.",
    procurement: "Provide P235GH with EN 10216-2 for seamless products or EN 10217-2 for appropriate welded products, after verifying project requirements.",
    difference: "P235GH is different from P265GH. Never infer grade substitution or dimensional capability from a catalogue association.",
    relatedStandards: ["en-10216-2", "en-10217-2"],
  },
  {
    slug: "p265gh", designation: "P265GH", group: "pressure-high",
    title: "Pressure steel grade P265GH",
    summary: "P265GH is commonly specified for pressure-bearing steel products where elevated-temperature properties are important.",
    designationMeaning: "The grade identifies a material family and strength classification; it does not replace an EN tube product standard or test requirements.",
    procurement: "Identify seamless or welded manufacture, the relevant EN 10216-2 or EN 10217-2 product scope, dimensions and certificates.",
    difference: "P265GH and P235GH remain different material grades even when listed alongside one another in supplier offerings.",
    relatedStandards: ["en-10216-2", "en-10217-2"],
  },
  {
    slug: "16mo3", designation: "16Mo3", group: "pressure-high",
    title: "Molybdenum-alloyed pressure-service steel",
    summary: "16Mo3 is a molybdenum-alloyed steel encountered in elevated-temperature pressure applications, including applicable seamless tube product ranges.",
    designationMeaning: "16Mo3 is composition-oriented; its name is not a direct statement of allowable temperature, pressure or service life.",
    procurement: "Verify 16Mo3 with the precise product standard such as EN 10216-2, dimensional and service requirements, and required test records.",
    difference: "16Mo3 must not be automatically exchanged for P235GH or P265GH; their designation systems and material characteristics differ.",
    relatedStandards: ["en-10216-2"],
  },
  {
    slug: "p235tr1", designation: "P235TR1", group: "pressure-room",
    title: "Pressure-tube steel quality TR1",
    summary: "P235TR1 denotes a pressure-tube grade for applications with specified room-temperature properties and TR1 quality requirements.",
    designationMeaning: "TR1 identifies a particular quality designation; it should not be omitted when preparing a supplier enquiry.",
    procurement: "Include the exact grade, product route and product standard, dimensions and inspection certificate requirements.",
    difference: "TR1 and TR2 are distinct quality levels; a change should be approved against the technical specification.",
    relatedStandards: ["en-10217-1"],
  },
  {
    slug: "p235tr2", designation: "P235TR2", group: "pressure-room",
    title: "Pressure-tube steel quality TR2",
    summary: "P235TR2 denotes a specified TR2 quality of pressure-tube steel used for room-temperature applications.",
    designationMeaning: "TR2 forms part of the complete grade designation; it is not interchangeable with TR1 without verifying applicable requirements.",
    procurement: "State P235TR2 explicitly and confirm the applicable welded or seamless product scope and required documentation.",
    difference: "P235TR2 and P235TR1 share the base designation but have different quality requirements.",
    relatedStandards: ["en-10217-1"],
  },
  {
    slug: "p265tr1", designation: "P265TR1", group: "pressure-room",
    title: "P265-series pressure-tube steel quality TR1",
    summary: "P265TR1 is a pressure-tube material designation with room-temperature properties and TR1 quality requirements.",
    designationMeaning: "The P265 base and TR1 suffix both matter when identifying an ordered material.",
    procurement: "Confirm P265TR1 against the intended welding or seamless route, correct product standard and service conditions.",
    difference: "P265TR1 is not a blanket substitute for P235TR1 or P265TR2.",
    relatedStandards: ["en-10217-1"],
  },
  {
    slug: "p265tr2", designation: "P265TR2", group: "pressure-room",
    title: "P265-series pressure-tube steel quality TR2",
    summary: "P265TR2 describes the TR2 quality variant of the P265 pressure-tube steel family.",
    designationMeaning: "The TR2 suffix specifies a distinct material quality and must be retained in product and certificate references.",
    procurement: "Combine P265TR2 with its applicable product standard, actual process, dimensions and inspection documentation.",
    difference: "P265TR1 and P265TR2 are related grades but are not automatic equivalents.",
    relatedStandards: ["en-10217-1"],
  },
] as const satisfies readonly EnglishKnowledgeGrade[];

export function englishStandardForSlug(slug: string): EnglishKnowledgeStandard | null {
  return englishStandards.find((item) => item.slug === slug) ?? null;
}

export function englishGradeForSlug(slug: string): EnglishKnowledgeGrade | null {
  return englishGrades.find((item) => item.slug === slug) ?? null;
}

export function englishKnowledgeSearch(query: string, text: string): boolean {
  return !query.trim() || text.toLocaleLowerCase("en").includes(query.trim().toLocaleLowerCase("en"));
}
