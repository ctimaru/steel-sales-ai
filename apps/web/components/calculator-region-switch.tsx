"use client";

import { useId, useState, type ReactNode } from "react";

import type { PublicTubeCalculatorInitialValues } from "@/components/public-tube-weight-calculator";
import { UsPipeSampleCalculator, type UsPipeInitialValues } from "@/components/us-pipe-sample-calculator";
import { type InternationalCalculatorSeed } from "@/components/international-steel-calculator";
import { CalculatorInlineDistintaExperience } from "@/components/calculator-inline-distinta-experience";
import { isNewCalculatorLocale, type CalculatorSiteLocale } from "@/lib/international-calculator-landing";
import { REGION_COPY } from "@/lib/us-calculator-i18n";
import styles from "./calculator-region-switch.module.css";

// Preserve established DE/FR/ES deep links when migrating from the old light
// widget to the SAME complete EU calculator used by IT/EN.
export function internationalEuInitialValues(seed:InternationalCalculatorSeed = {}):PublicTubeCalculatorInitialValues {
  const validStandards=["en10219","en10210","geometric"];
  const validFamilies=["round_tube","square_tube","rectangular_tube"];
  return {
    standard:validStandards.includes(seed.standard??"")
      ? seed.standard as PublicTubeCalculatorInitialValues["standard"]:undefined,
    family:validFamilies.includes(seed.family??"")
      ? seed.family as PublicTubeCalculatorInitialValues["family"]:undefined,
    outerDiameter:seed.od,
    width:seed.width,height:seed.height,thickness:seed.thickness,
    length:seed.length,quantity:seed.quantity,targetTonnes:seed.target,
    density:seed.density,
  };
}

type Region = "eu" | "us";


export function CalculatorRegionSwitch({
  locale,
  initialRegion = "eu",
  requestedRegion,
  references,
  initialValues,
  euAfter,
  internationalSeed,
  usInitialValues,
}: {
  locale: CalculatorSiteLocale;
  initialRegion?: Region;
  requestedRegion?: Region;
  references?: Parameters<typeof CalculatorInlineDistintaExperience>[0]["references"];
  initialValues?: PublicTubeCalculatorInitialValues;
  euAfter?: ReactNode;
  internationalSeed?:InternationalCalculatorSeed;
  usInitialValues?:UsPipeInitialValues;
}) {
  const entryRegion=requestedRegion??initialRegion;
  const [region, setRegion] = useState<Region>(entryRegion);
  // Mount lazily, but keep each calculator mounted after its first visit.
  // This avoids duplicating hidden US SEO content on the original EN page
  // and prevents a switch from erasing entered dimensions or quantity.
  const [visited, setVisited] = useState({
    eu: entryRegion === "eu",
    us: entryRegion === "us",
  });
  const id = useId();
  const europeanId = `${id}-eu`;
  const americanId = `${id}-us`;
  const english = locale === "en";
  const regional = isNewCalculatorLocale(locale) ? REGION_COPY[locale] : null;

  function activate(next: Region) {
    if (next === region) return;
    setVisited((current) => ({ ...current, [next]: true }));
    setRegion(next);
  }

  return (
    <section className={styles.root} aria-label={regional?.region??(english ? "Steel calculator region" : "Area del calcolatore acciaio")}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{regional?.eyebrow??(english ? "SELECT CALCULATION SYSTEM" : "SCEGLI IL SISTEMA DI CALCOLO")}</p>
          <p className={styles.headline}>
            {regional?.headline??(english ? "One calculator. Two steel markets." : "Un calcolatore. Due mercati dell'acciaio.")}
          </p>
        </div>
        <div className={styles.track} data-region={region} role="group"
          aria-label={regional?.chooser??(english ? "Choose EU or US calculator" : "Scegli il calcolatore europeo o americano")}>
          <button type="button" className={styles.option}
            aria-pressed={region === "eu"} aria-controls={europeanId}
            onClick={() => activate("eu")}>
            <span className={styles.optionLabel}>{regional?.europe??(english ? "EUROPE" : "EUROPA")}</span>
            <span className={styles.optionDetail}>EN 10219 / 10210</span>
          </button>
          <button type="button" className={styles.option}
            aria-pressed={region === "us"} aria-controls={americanId}
            onClick={() => activate("us")}>
            <span className={styles.optionLabel}>USA</span>
            <span className={styles.optionDetail}>NPS / SCHEDULE</span>
          </button>
        </div>
        <p className={styles.explainer} aria-live="polite" aria-atomic="true">
          {region === "eu"
            ? regional?.eu??(english
              ? "CHS, SHS and RHS · EN 10219, EN 10210 or free geometry."
              : "Tondi, quadri e rettangolari · EN 10219, EN 10210 o geometria libera.")
            : regional?.us??(english
              ? "Limited U.S. Steel NPS/Schedule sample · API/ASTM product intent requires supplier confirmation."
              : "Campione limitato NPS/Schedule U.S. Steel · specifiche API/ASTM da confermare con il fornitore.")}
        </p>
      </div>

      <div id={europeanId} className={styles.panel} data-active={region === "eu"}
        aria-hidden={region !== "eu"} inert={region !== "eu"}>
        <div className={styles.panelInner}>
          {visited.eu ? (
            <>
              <CalculatorInlineDistintaExperience references={references??[]}
                initialValues={isNewCalculatorLocale(locale)
                  ? internationalEuInitialValues(internationalSeed)
                  : initialValues}
                locale={locale} />
              {euAfter ? <div className={styles.evidence}>{euAfter}</div> : null}
            </>
          ) : null}
        </div>
      </div>
      <div id={americanId} className={styles.panel} data-active={region === "us"}
        aria-hidden={region !== "us"} inert={region !== "us"}>
        <div className={styles.panelInner}>
          {visited.us ? <UsPipeSampleCalculator locale={locale} initialValues={usInitialValues}/> : null}
        </div>
      </div>
    </section>
  );
}
