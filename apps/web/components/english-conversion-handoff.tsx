import Link from "next/link";

/**
 * I18N5 — Shared static, consent-free international handoff.
 * Never assumes that English registration, marketplace publishing or RFQ dispatch
 * is available. All account/approval gates remain with existing Italian routes.
 */
type EnglishConversionContext = "knowledge" | "rfq" | "network";

const contextCopy: Record<EnglishConversionContext, {
  eyebrow: string;
  heading: string;
  description: string;
  supportingHref: string;
  supportingLabel: string;
}> = {
  knowledge: {
    eyebrow: "From public knowledge to practical work",
    heading: "Ready to put those specifications to work?",
    description:
      "Explore the free RFQ builder before you register. If your business needs a company workspace and commercial workflows, request access through our reviewed onboarding process.",
    supportingHref: "/en/distinta",
    supportingLabel: "Try the free RFQ builder",
  },
  rfq: {
    eyebrow: "Your next step",
    heading: "From a copied RFQ to a connected company workspace.",
    description:
      "This free builder prepares text for your supplier email. It does not save or send RFQs. Company registration is the first step toward access to the platform’s governed purchasing workflows.",
    supportingHref: "/en/knowledge/standards",
    supportingLabel: "Review steel standards",
  },
  network: {
    eyebrow: "Join the steel supply chain",
    heading: "Discover the network. Request access for your company.",
    description:
      "Buyers, processors, distributors and producers can start the company onboarding process. Existing company profiles can be checked before submitting a new application.",
    supportingHref: "/en/knowledge",
    supportingLabel: "Explore free steel knowledge",
  },
};

export function EnglishConversionHandoff({ context }: { context: EnglishConversionContext }) {
  const copy = contextCopy[context];

  return (
    <section aria-label="English company onboarding and next steps" className="border-y border-[#dce5e0] bg-white">
      <div className="mx-auto grid max-w-[1120px] gap-7 px-4 py-11 sm:px-6 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] md:items-center lg:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#1f6b5a]">{copy.eyebrow}</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-[#123b34] sm:text-3xl">{copy.heading}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#52615b]">{copy.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href={copy.supportingHref} hrefLang="en" className="inline-flex min-h-11 items-center text-sm font-bold text-[#1f6b5a] underline underline-offset-4">
              {copy.supportingLabel} →
            </Link>
            <Link href="/en/login" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#52615b] underline underline-offset-4">
              Already registered? Sign in
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-[#c7ded3] bg-[#f1f8f4] p-5 sm:p-6">
          <p className="text-sm font-bold text-[#123b34]">Company onboarding</p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-[#52615b]">
            <li><span className="font-bold text-[#1f6b5a]">1.</span> Check whether your company already has a profile</li>
            <li><span className="font-bold text-[#1f6b5a]">2.</span> Create an account and verify your email</li>
            <li><span className="font-bold text-[#1f6b5a]">3.</span> Submit your company request for review</li>
          </ol>
          <Link href="/en/register" className="platform-primary mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-center text-sm font-bold">
            Start company registration →
          </Link>
          <p className="mt-3 text-xs leading-5 text-[#52615b]">
            The company application is available in English; the private workspace and legal documents currently remain in Italian. Company approval is required before private access.
          </p>
        </div>
      </div>
    </section>
  );
}
