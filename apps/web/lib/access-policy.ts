export type OrganizationRole = "admin" | "member" | "viewer";

export type WorkspaceCapability =
  | "commercial_read"
  | "network_read"
  | "network_interact"
  | "commercial_write"
  | "company_admin"
  | "platform_control";

const organizationCapabilities: Record<OrganizationRole, ReadonlySet<WorkspaceCapability>> = {
  viewer: new Set(["commercial_read", "network_read"]),
  member: new Set([
    "commercial_read",
    "network_read",
    "network_interact",
    "commercial_write",
  ]),
  admin: new Set([
    "commercial_read",
    "network_read",
    "network_interact",
    "commercial_write",
    "company_admin",
  ]),
};

export function normalizeOrganizationRole(role: string): OrganizationRole {
  if (role === "admin" || role === "viewer") return role;
  return "member";
}

export function hasOrganizationCapability(
  role: string,
  capability: WorkspaceCapability,
): boolean {
  if (capability === "platform_control") return false;
  return organizationCapabilities[normalizeOrganizationRole(role)].has(capability);
}

export function canWriteWorkspace(role: string): boolean {
  return hasOrganizationCapability(role, "commercial_write");
}

export function canInteractWithNetwork(role: string): boolean {
  return hasOrganizationCapability(role, "network_interact");
}

export function canAdministerCompany(role: string): boolean {
  return hasOrganizationCapability(role, "company_admin");
}
