export function isNetworkFrontendEnabled() {
  return process.env.NETWORK_FRONTEND_ENABLED !== "false";
}

/** NET-UX1.1: default-off until protected Free-read RPC migration is accepted. */
export function isNetworkFreeReadEnabled() {
  return process.env.NETWORK_FREE_READ_ENABLED === "true";
}
