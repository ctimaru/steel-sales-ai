import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/search", destination: "/commercial/search", permanent: false },
      { source: "/products", destination: "/commercial/products", permanent: false },
      { source: "/products/:productId", destination: "/commercial/products/:productId", permanent: false },
      {
        source: "/products/:productId/prices",
        destination: "/commercial/products/:productId/prices",
        permanent: false,
      },
      { source: "/customers", destination: "/commercial/companies", permanent: false },
      {
        source: "/customers/:companyId",
        destination: "/commercial/companies/:companyId",
        permanent: false,
      },
      { source: "/assistant", destination: "/commercial/assistant", permanent: false },
      { source: "/rfqs/:id", destination: "/commercial/rfqs/:id", permanent: false },
      { source: "/offers/:id", destination: "/commercial/offers/:id", permanent: false },
      { source: "/orders/:id", destination: "/commercial/orders/:id", permanent: false },
      {
        source: "/conversations/:id",
        destination: "/commercial/conversations/:id",
        permanent: false,
      },

      { source: "/uploads", destination: "/operations/uploads", permanent: false },
      { source: "/review", destination: "/operations/review", permanent: false },
      {
        source: "/review/conversation-coverage",
        destination: "/operations/review/conversation-coverage",
        permanent: false,
      },
      {
        source: "/review/conversations",
        destination: "/operations/review/conversations",
        permanent: false,
      },
      { source: "/review/coverage", destination: "/operations/review/coverage", permanent: false },
      { source: "/review/identities", destination: "/operations/review/identities", permanent: false },
      {
        source: "/review/offer-recovery",
        destination: "/operations/review/offer-recovery",
        permanent: false,
      },
      {
        source: "/review/offer-remediation",
        destination: "/operations/review/offer-remediation",
        permanent: false,
      },
      {
        source: "/review/offer-reparse",
        destination: "/operations/review/offer-reparse",
        permanent: false,
      },
      {
        source: "/review/relationships",
        destination: "/operations/review/relationships",
        permanent: false,
      },
      {
        source: "/unconverted-offers",
        destination: "/operations/review/unconverted-offers",
        permanent: false,
      },
      { source: "/alerts", destination: "/operations/alerts", permanent: false },

      { source: "/network/manage", destination: "/company/profile", permanent: false },
      { source: "/data-sources", destination: "/company/data-sources", permanent: false },
      { source: "/pilot-analytics", destination: "/company/pilot-analytics", permanent: false },
      { source: "/tubi-norme", destination: "/company/tools/tubi-norme", permanent: false },
    ];
  },
};

export default nextConfig;
