export const REGISTRATION_APPLICATION_STATUSES = [
  "draft",
  "pending_review",
  "needs_information",
  "approved",
  "rejected",
  "activated",
] as const;

export type RegistrationApplicationStatus =
  (typeof REGISTRATION_APPLICATION_STATUSES)[number];

const REGISTRATION_APPLICATION_STATUS_SET = new Set<string>(
  REGISTRATION_APPLICATION_STATUSES,
);

export function isRegistrationApplicationStatus(
  value: string | null | undefined,
): value is RegistrationApplicationStatus {
  return Boolean(value && REGISTRATION_APPLICATION_STATUS_SET.has(value));
}
