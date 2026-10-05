import { FocusHeader, FocusLink, FocusPage, FocusPanel } from "@/components/focus-ui";
import { appRoutes } from "@/lib/routes";

export default function SchoolPage() {
  return (
    <FocusPage>
      <FocusHeader
        eyebrow="Scuola"
        title="Conoscenza tecnica, senza rumore"
        description="Il calcolatore è il punto di partenza operativo. Norme, gradi e knowledge privata restano a un click quando servono."
      />

      <FocusPanel>
        <p className="app-kicker">Strumento principale</p>
        <FocusLink
          href={appRoutes.knowledge.schoolTubes}
          title="Pesi & dimensioni"
          description="Calcola kg/m, peso barra e tonnellaggio, poi passa alle tabelle dimensionali."
          meta="Calcolatore"
          primary
        />

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <FocusLink
            href={appRoutes.knowledge.schoolStandards}
            title="Norme"
            description="Consulta il catalogo tecnico per norma."
          />
          <FocusLink
            href={appRoutes.knowledge.schoolGrades}
            title="Gradi"
            description="Trova qualità, famiglie e riferimenti."
          />
          <FocusLink
            href={appRoutes.knowledge.explorer}
            title="Knowledge Explorer"
            description="Ricerca privata sui documenti del workspace."
            meta="Privato"
          />
          <FocusLink
            href={appRoutes.knowledge.catalog}
            title="Catalogo tecnico"
            description="Apri la base pubblica completa della Scuola."
            meta="Pubblico"
          />
        </div>
      </FocusPanel>
    </FocusPage>
  );
}
