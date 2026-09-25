export function isNetworkFrontendEnabled() {
  return process.env.NETWORK_FRONTEND_ENABLED !== "false";
}
