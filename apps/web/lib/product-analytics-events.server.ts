import { track } from "@vercel/analytics/server";

export type ServerProductAnalyticsEventName =
  | "registration_account_created"
  | "registration_submit"
  | "distinta_save"
  | "rfq_start"
  | "rfq_dispatch_launch";

export async function trackServerProductEvent(
  name: ServerProductAnalyticsEventName,
  properties?: Record<string, string | number | boolean>,
) {
  try {
    await track(name, properties);
  } catch (error) {
    console.warn("Product analytics event unavailable:", name, error);
  }
}
