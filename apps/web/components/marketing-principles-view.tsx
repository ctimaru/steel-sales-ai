import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import {
  getMarketingCopy,
  MARKETING_SYSTEM_VERSION,
  marketingPalette,
} from "@/lib/marketing-content";

export function MarketingPrinciplesView({
  locale = "it",
  investorMode = false,
}: {
  locale?: BusinessPlanLocale;
  investorMode?: boolean;
}) {
  const copy = getMarketingCopy(locale);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[var(--brand-deep)] text-white">
        <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/85">
                {copy.eyebrow}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/75">
                {MARKETING_SYSTEM_VERSION}
              </span>
              {investorMode ? (
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/75">
                  {locale === "it" ? "Vista investor" : "Investor view"}
                </span>
              ) : null}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/80">{copy.subtitle}</p>
          </div>
          <div className="self-end rounded-2xl border border-white/10 bg-white/[0.07] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
              {locale === "it" ? "Tesi visiva" : "Visual thesis"}
            </p>
            <p className="mt-3 text-sm font-medium leading-6 text-white">{copy.thesis}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <p className="app-kicker">{locale === "it" ? "Sistema" : "System"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{copy.architectureTitle}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{copy.architectureIntro}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {copy.roles.map(([name, role, detail]) => (
            <article key={name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-deep)]">{name}</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{role}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-kicker">UXC1</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {locale === "it" ? "Palette accessibile" : "Accessible palette"}
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {locale === "it" ? "Contrasto indicato contro bianco quando applicabile." : "Contrast shown against white where applicable."}
          </p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {marketingPalette.map((item) => {
            const darkText = item.hex === "#DDF5EC" || item.hex === "#F6F8F7" || item.hex === "#FFFFFF";
            return (
              <article key={item.variable} className="overflow-hidden rounded-2xl border border-[var(--border)]">
                <div
                  className="flex min-h-24 items-end p-4"
                  style={{ backgroundColor: item.hex, color: darkText ? "#0F1720" : "#FFFFFF" }}
                >
                  <div>
                    <p className="text-sm font-semibold">{item.token}</p>
                    <p className="mt-1 font-mono text-xs opacity-80">{item.hex}</p>
                  </div>
                </div>
                <div className="bg-[var(--surface-base)] p-4">
                  <p className="font-mono text-[10px] text-[var(--steel-blue)]">{item.variable}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {locale === "it" ? item.roleIt : item.roleEn}
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    {locale === "it" ? "Contrasto" : "Contrast"} · {item.contrast}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
          <p className="app-kicker">{locale === "it" ? "Gerarchia" : "Hierarchy"}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{copy.densityTitle}</h2>
          <div className="mt-5 space-y-3">
            {copy.density.map(([share, family, role]) => (
              <div key={share} className="grid grid-cols-[72px_1fr] gap-3 rounded-xl bg-[var(--surface-subtle)] p-4">
                <p className="text-xl font-semibold text-[var(--brand-deep)]">{share}</p>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{family}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
          <p className="app-kicker">WCAG 2.2 AA</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{copy.accessibilityTitle}</h2>
          <ul className="mt-5 space-y-3">
            {copy.accessibility.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[10px] font-bold text-[var(--brand-deep)]">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <p className="app-kicker">{locale === "it" ? "Messaging" : "Messaging"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{copy.messagingTitle}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--text-secondary)]">{copy.messaging}</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-[var(--brand-primary-soft)] p-5">
            <h3 className="font-semibold text-[var(--brand-deep)]">✓ {copy.doTitle}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-primary)]">
              {copy.doItems.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
            <h3 className="font-semibold text-[var(--text-primary)]">× {copy.dontTitle}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
              {copy.dontItems.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--steel-blue-soft)] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">Investor lens</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{copy.investorTitle}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--text-secondary)]">{copy.investorBody}</p>
      </section>
    </div>
  );
}
