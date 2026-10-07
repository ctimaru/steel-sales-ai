export type StorageInventoryItem = {
  technology: "cookie" | "localStorage";
  name: string;
  category: "necessario" | "funzionale" | "statistico";
  provider: string;
  purpose: string;
  activation: string;
  duration: string;
};

export const PUBLIC_STORAGE_INVENTORY: StorageInventoryItem[] = [
  {
    technology: "localStorage",
    name: "sss.analytics-consent.v2",
    category: "necessario",
    provider: "Smart Steel Sales",
    purpose: "Memorizza decisione analytics, versione dell'informativa e data della scelta.",
    activation: "Quando l'utente sceglie Accetta o Accetta necessari.",
    duration: "6 mesi, oppure fino a cambio versione dell'informativa/consenso.",
  },
  {
    technology: "cookie",
    name: "sb-<project-ref>-auth-token*",
    category: "necessario",
    provider: "Supabase Auth",
    purpose: "Mantiene autenticazione e sessione sicura dell'account.",
    activation: "Login / autenticazione.",
    duration: "Durata tecnica della sessione/token; rinnovo gestito dal provider di autenticazione.",
  },
  {
    technology: "localStorage",
    name: "sss.weightCalculator.recents.v1",
    category: "funzionale",
    provider: "Smart Steel Sales",
    purpose: "Conserva fino a 6 calcoli recenti del calcolatore pesi sul dispositivo.",
    activation: "Uso del calcolatore.",
    duration: "Fino a cancellazione locale o uso del comando Svuota.",
  },
  {
    technology: "localStorage",
    name: "sss.weightCalculator.favorites.v1",
    category: "funzionale",
    provider: "Smart Steel Sales",
    purpose: "Conserva le configurazioni del calcolatore salvate come preferite.",
    activation: "Aggiunta esplicita ai preferiti.",
    duration: "Fino alla rimozione da parte dell'utente o cancellazione dello storage.",
  },
  {
    technology: "localStorage",
    name: "sss.weightCalculator.savedTool.v1",
    category: "funzionale",
    provider: "Smart Steel Sales",
    purpose: "Ricorda la configurazione con cui riaprire il calcolatore.",
    activation: "Scelta esplicita Salva il Calcolatore.",
    duration: "Fino alla disattivazione del salvataggio o cancellazione dello storage.",
  },
  {
    technology: "cookie",
    name: "_ga",
    category: "statistico",
    provider: "Google Analytics 4",
    purpose: "Distingue gli utenti per la misurazione statistica delle sole superfici pubbliche.",
    activation: "Solo dopo consenso analytics.",
    duration: "Fino a 2 anni secondo la configurazione predefinita GA4 e i limiti del browser.",
  },
  {
    technology: "cookie",
    name: "_ga_<container-id>",
    category: "statistico",
    provider: "Google Analytics 4",
    purpose: "Mantiene lo stato della sessione per la misurazione statistica.",
    activation: "Solo dopo consenso analytics.",
    duration: "Fino a 2 anni secondo la configurazione predefinita GA4 e i limiti del browser.",
  },
];
