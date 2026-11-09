import { canWriteOffice, officeProfileLabels, type OfficeArea } from "@/lib/office-profiles";
import { getWorkspaceContext } from "@/lib/workspace-context";

/**
 * Controllo lato server del profilo (Ufficio commerciale / Ufficio acquisti).
 * Restituisce un messaggio utente se il profilo dell'utente può solo consultare
 * quell'area, altrimenti null. Chiamare dopo aver verificato che l'utente sia
 * autenticato e prima di qualsiasi scrittura o invio.
 */
export async function officeWriteDenied(area: OfficeArea): Promise<string | null> {
  const context = await getWorkspaceContext();
  if (canWriteOffice(context.role, context.businessRole, area)) return null;
  const office = officeProfileLabels[area];
  return "Il tuo profilo consulta quest'area in sola lettura. Serve il profilo " + office + ", assegnato dalla Direzione Aziendale.";
}
