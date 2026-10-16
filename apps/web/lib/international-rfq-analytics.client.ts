"use client";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentRecordIsCurrent,
  parseAnalyticsConsentRecord,
} from "@/lib/analytics-consent";
import { trackProductEvent } from "@/lib/product-analytics-events.client";
import {
  internationalRfqEventName,
  type InternationalRfqLocale,
  type InternationalRfqSegment,
  type InternationalRfqStage,
} from "@/lib/international-rfq-funnel";

/** Never emit funnel custom events without current explicit analytics opt-in. */
export function trackInternationalRfq(
  stage:InternationalRfqStage,
  locale:InternationalRfqLocale,
  segment:InternationalRfqSegment={system:"direct",standard:"unknown"},
):boolean{
  try{
    const record=parseAnalyticsConsentRecord(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
    );
    if(record?.decision!=="granted" || !analyticsConsentRecordIsCurrent(record))return false;
    // Bounded allowlisted categories only. No dimensions, prices, notes,
    // session ids, company/contact data, paths or query parameters.
    trackProductEvent(internationalRfqEventName(stage,locale),{
      system:segment.system,
      standard:segment.standard,
    });
    return true;
  }catch{
    // Browser privacy settings can disallow storage; the RFQ flow must work.
    return false;
  }
}
