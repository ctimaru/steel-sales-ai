export type PublicCompanyLookupItem = {
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  vat_hint: string | null;
  claim_state: "claimable" | "claim_in_progress" | "claimed";
  claim_ref: string;
};

export type PublicCompanyLookupState = {
  status: "idle" | "invalid" | "error" | "not_found" | "ok";
  mode: "name" | "vat" | null;
  items: PublicCompanyLookupItem[];
};

export const initialPublicCompanyLookupState: PublicCompanyLookupState = {
  status: "idle",
  mode: null,
  items: [],
};
