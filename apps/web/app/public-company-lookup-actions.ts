"use server";

import { queryPublicCompany } from "@/lib/public-company-lookup";
import {
  initialPublicCompanyLookupState,
  type PublicCompanyLookupItem,
  type PublicCompanyLookupState,
} from "@/lib/public-company-lookup-contract";

export type { PublicCompanyLookupItem, PublicCompanyLookupState };
export { initialPublicCompanyLookupState };

export async function lookupPublicCompany(
  _previous: PublicCompanyLookupState,
  formData: FormData,
): Promise<PublicCompanyLookupState> {
  return queryPublicCompany(
    formData.get("company_query"),
    formData.get("company_website"),
  );
}
