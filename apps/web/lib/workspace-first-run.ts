/**
 * HOME-FIRSTRUN1: presentation-only "first access" state for the Workspace Home.
 *
 * Derived exclusively from data the Home already loads (admin setup state,
 * commercial snapshot totals, procurement summary). It never grants, restricts
 * or infers access: a wrong result only changes which step the Home shows first.
 *
 * Rules:
 * - Only admins see it (setup state is admin-only; members cannot act on it).
 * - A company that already has commercial records, active RFQs or buyer actions
 *   is never treated as first access, even if setup flags lag behind.
 * - Otherwise it is first access while essential setup is incomplete, or while
 *   no first real document has reached the private memory.
 *
 * Kept free of runtime imports so it can be unit-tested in isolation.
 */

export type FirstRunSetupInput = {
  profile_ready: boolean;
  data_ready: boolean;
  first_value_ready: boolean;
  team_ready: boolean;
  setup_completed: boolean;
  essential_completed_count: number;
  essential_total_count: number;
};

export type FirstRunInput = {
  setup: FirstRunSetupInput | null;
  /** Live RFQ + offer + order records; 0 when the workspace is not live. */
  commercialRecords: number;
  activeRfqs?: unknown;
  attentionTotal?: unknown;
};

export type FirstRunRoutes = {
  profile: string;
  memory: string;
  firstValue: string;
  team: string;
};

export type FirstRunStepId = "profile" | "memory" | "first_value" | "team";

export type FirstRunStep = {
  id: FirstRunStepId;
  label: string;
  detail: string;
  href: string;
  done: boolean;
  essential: boolean;
};

export type WorkspaceFirstRun = {
  active: boolean;
  reason: "setup_incomplete" | "no_first_document" | null;
  steps: FirstRunStep[];
  essentialCompleted: number;
  essentialTotal: number;
  nextStep: FirstRunStep | null;
};

const inactive: WorkspaceFirstRun = {
  active: false,
  reason: null,
  steps: [],
  essentialCompleted: 0,
  essentialTotal: 0,
  nextStep: null,
};

function positiveCount(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function deriveWorkspaceFirstRun(
  input: FirstRunInput,
  routes: FirstRunRoutes,
): WorkspaceFirstRun {
  const { setup } = input;
  if (!setup) return inactive;

  const hasActivity =
    positiveCount(input.commercialRecords) ||
    positiveCount(input.activeRfqs) ||
    positiveCount(input.attentionTotal);
  if (hasActivity) return inactive;

  const essentialIncomplete =
    !setup.setup_completed || !setup.profile_ready || !setup.data_ready;
  const reason: WorkspaceFirstRun["reason"] = essentialIncomplete
    ? "setup_incomplete"
    : !setup.first_value_ready
      ? "no_first_document"
      : null;
  if (!reason) return inactive;

  const steps: FirstRunStep[] = [
    {
      id: "profile",
      label: "Completa il profilo azienda",
      detail: "Nome commerciale, sito e logo rendono riconoscibile la tua azienda.",
      href: routes.profile,
      done: setup.profile_ready,
      essential: true,
    },
    {
      id: "memory",
      label: "Abilita la Commercial Memory",
      detail: "Scegli le fonti (email, PDF, Excel) e autorizza l’import.",
      href: routes.memory,
      done: setup.data_ready,
      essential: true,
    },
    {
      id: "first_value",
      label: "Importa il primo documento",
      detail: "Un’offerta, una RFQ o un ordine: l’assistente risponde solo su dati reali.",
      href: routes.firstValue,
      done: setup.first_value_ready,
      essential: false,
    },
    {
      id: "team",
      label: "Invita i colleghi",
      detail: "Facoltativo: aggiungi chi lavora con te su richieste e offerte.",
      href: routes.team,
      done: setup.team_ready,
      essential: false,
    },
  ];

  const total = Number.isFinite(setup.essential_total_count) && setup.essential_total_count > 0
    ? setup.essential_total_count
    : steps.filter((step) => step.essential).length;
  const completed = Math.min(
    total,
    Math.max(0, Number.isFinite(setup.essential_completed_count) ? setup.essential_completed_count : 0),
  );

  // Team is optional: it never becomes the "next step" that blocks the Home.
  const nextStep = steps.find((step) => !step.done && step.id !== "team") ?? null;
  // Flags can disagree (e.g. setup_completed lagging): with nothing actionable
  // left, the normal Home is the honest view.
  if (!nextStep) return inactive;

  return {
    active: true,
    reason,
    steps,
    essentialCompleted: completed,
    essentialTotal: total,
    nextStep,
  };
}
