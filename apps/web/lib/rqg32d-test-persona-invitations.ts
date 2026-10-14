import type { PlatformStaffRoleKey } from "@/lib/platform-access-contract";

/**
 * RQG3.2d — fixed TEST identities only. These addresses cannot receive email.
 * Owner authorizes an invitation; only the invited user may claim it on login.
 * No implicit privileges, role grants, legal acceptance or tenant membership.
 */
export const RQG32D_PLATFORM_TEST_INVITATIONS: ReadonlyArray<{
  id: string;
  email: string;
  role: PlatformStaffRoleKey;
  label: string;
}> = [
  { id: "registration", email: "rqg32-registration@smartsteelsales.test", role: "registration_admin", label: "Registration" },
  { id: "claims", email: "rqg32-claims@smartsteelsales.test", role: "claims_verification_admin", label: "Company Claims" },
  { id: "trust", email: "rqg32-trust@smartsteelsales.test", role: "network_trust_admin", label: "Network Trust" },
  { id: "auditor", email: "rqg32-auditor@smartsteelsales.test", role: "platform_auditor", label: "Auditor" },
];
