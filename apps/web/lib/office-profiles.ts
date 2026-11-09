import { canAdministerCompany, canWriteWorkspace } from "@/lib/access-policy";

/**
 * Profili operativi dell'azienda, assegnati dalla Direzione Aziendale.
 *
 * - `direction`  : amministratore dell'azienda o Sales Director. Opera su entrambi gli uffici.
 * - `commercial` : Ufficio commerciale (business_role "salesperson").
 * - `purchasing` : Ufficio acquisti (business_role "purchasing").
 *
 * Regola di prodotto: ogni ufficio VEDE sempre anche l'altro. Il profilo
 * decide soltanto dove si può SCRIVERE. Solo un amministratore assegna i profili.
 * Chi non ha ancora un profilo (o è "operations") conserva i permessi di
 * scrittura di prima, così nessun accesso esistente si restringe senza una scelta
 * esplicita della Direzione.
 */
export const BUSINESS_ROLES = ["sales_director", "salesperson", "purchasing", "operations"] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export type OfficeArea = "commercial" | "purchasing";
export type OfficeProfile = "direction" | OfficeArea;

export function normalizeBusinessRole(value: string | null | undefined): BusinessRole | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return (BUSINESS_ROLES as readonly string[]).includes(normalized)
    ? (normalized as BusinessRole)
    : null;
}

export function officeProfileOf(
  role: string,
  businessRole: string | null | undefined,
): OfficeProfile | null {
  if (canAdministerCompany(role)) return "direction";
  const business = normalizeBusinessRole(businessRole);
  if (business === "sales_director") return "direction";
  if (business === "salesperson") return "commercial";
  if (business === "purchasing") return "purchasing";
  return null;
}

/** Tutti gli utenti dell'azienda consultano entrambi gli uffici. */
export function canReadOffice(_role: string, _area: OfficeArea): boolean {
  return true;
}

export function canWriteOffice(
  role: string,
  businessRole: string | null | undefined,
  area: OfficeArea,
): boolean {
  if (!canWriteWorkspace(role)) return false;
  const profile = officeProfileOf(role, businessRole);
  if (profile === null || profile === "direction") return true;
  return profile === area;
}

/** Solo la Direzione Aziendale concede e cambia i profili. */
export function canManageOfficeProfiles(role: string): boolean {
  return canAdministerCompany(role);
}

export const officeProfileLabels: Record<OfficeProfile, string> = {
  direction: "Direzione aziendale",
  commercial: "Ufficio commerciale",
  purchasing: "Ufficio acquisti",
};

export function businessRoleLabel(role: string | null | undefined): string {
  const business = normalizeBusinessRole(role);
  if (business === "sales_director") return "Direzione commerciale";
  if (business === "salesperson") return officeProfileLabels.commercial;
  if (business === "purchasing") return officeProfileLabels.purchasing;
  if (business === "operations") return "Operations";
  return "Non assegnato";
}
