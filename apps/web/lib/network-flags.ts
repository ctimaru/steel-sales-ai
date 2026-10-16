export function isNetworkFrontendEnabled() {
  return process.env.NETWORK_FRONTEND_ENABLED !== "false";
}

/** NET-UX1.1: activated after production RPC and access acceptance; explicit false is the rollback switch. */
export function isNetworkFreeReadEnabled() {
  return process.env.NETWORK_FREE_READ_ENABLED !== "false";
}
