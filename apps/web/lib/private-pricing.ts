export type DiscountScopeType =
  | "manufacturer"
  | "price_list"
  | "version"
  | "section"
  | "grade"
  | "finish"
  | "grade_finish"
  | "item";

export type DiscountVisibility = "personal" | "organization";

export type DiscountProfile = {
  profile_id: string;
  visibility: DiscountVisibility;
  scope_type: DiscountScopeType;
  discount_pct: number;
  label: string | null;
  publisher_company_id: string;
  price_list_id: string | null;
  price_list_version_id: string | null;
  section_id: string | null;
  grade_code: string | null;
  finish_code: string | null;
  price_list_item_id: string | null;
  scope_rank: number;
  updated_at: string;
};

export type EffectiveDiscount = {
  price_list_item_id: string;
  profile_id: string;
  discount_pct: number;
  visibility: DiscountVisibility;
  scope_type: DiscountScopeType;
  label: string | null;
  scope_rank: number;
};

export type PrivatePricingContext = {
  authenticated: boolean;
  canWrite: boolean;
  canManageOrganization: boolean;
  organizationName: string | null;
  profiles: DiscountProfile[];
  effectiveDiscounts: EffectiveDiscount[];
};

export const emptyPrivatePricingContext: PrivatePricingContext = {
  authenticated: false,
  canWrite: false,
  canManageOrganization: false,
  organizationName: null,
  profiles: [],
  effectiveDiscounts: [],
};

export function discountScopeLabel(scope: DiscountScopeType) {
  if (scope === "manufacturer") return "Produttore";
  if (scope === "price_list") return "Listino";
  if (scope === "version") return "Versione";
  if (scope === "section") return "Sezione";
  if (scope === "grade") return "Grado";
  if (scope === "finish") return "Finitura";
  if (scope === "grade_finish") return "Grado + finitura";
  return "Articolo";
}
