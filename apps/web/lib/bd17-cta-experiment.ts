/**
 * BD17: short-lived (per browser tab) 50/50 A/B allocation for the public
 * calculator → RFQ login handoff. No user IDs, contact data or server cookies.
 */
export type Bd17Arm = "control" | "clarity";
export type Bd17Action = "view" | "click";
export type Bd17TabStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
const ARM_KEY = "sss.bd17.cta.arm.v1";
const eventName = {
  control: { view: "bd17_cta_control_view", click: "bd17_cta_control_click" },
  clarity: { view: "bd17_cta_clarity_view", click: "bd17_cta_clarity_click" },
} as const;
export function chooseBd17Arm(storage: Bd17TabStorage | null, random: number): Bd17Arm {
  try {
    const saved = storage?.getItem(ARM_KEY);
    if (saved === "control" || saved === "clarity") return saved;
    const arm: Bd17Arm = random < 0.5 ? "control" : "clarity";
    storage?.setItem(ARM_KEY, arm);
    return arm;
  } catch {
    // Private mode/no storage: preserve the existing experience, don't assign
    // an untrackable changing variant for every render.
    return "control";
  }
}
export function recordBd17Once(
  storage: Bd17TabStorage | null,
  arm: Bd17Arm,
  action: Bd17Action,
  track: (name: "bd17_cta_control_view" | "bd17_cta_control_click" |
    "bd17_cta_clarity_view" | "bd17_cta_clarity_click") => void,
): boolean {
  if (!storage) return false;
  const key = "sss.bd17.cta." + arm + "." + action + ".v1";
  try {
    if (storage.getItem(key) === "1") return false;
    track(eventName[arm][action]);
    storage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}
