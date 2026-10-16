"use client";

import { useEffect, useState } from "react";
import { tubeCalculatorText, type TubeCalculatorLocale } from "@/lib/tube-calculator-locale";

export function CalculatorInstallGuide({ locale = "it" }: { locale?: TubeCalculatorLocale }) {
  const t=(value:string)=>tubeCalculatorText(value,locale);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIOS(ios);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean(navigatorWithStandalone.standalone),
    );
  }, []);

  if (isStandalone) return null;

  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-3 py-2 text-xs font-bold text-[#173f35] marker:content-none hover:border-[#438d7a]">
        <span className="sm:hidden">{t("Installa")}</span>
        <span className="hidden sm:inline">{t("Aggiungi a Home")}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[#cddbd6] bg-white p-4 text-left shadow-[0_16px_40px_rgba(11,47,39,0.16)]">
        <p className="text-sm font-bold text-[#173f35]">{t("Usa il calcolatore come un’app")}</p>
        {isIOS ? (
          <p className="mt-2 text-xs leading-5 text-[#52615b]">
            {t("Su iPhone o iPad: apri il menu Condividi di Safari e scegli Aggiungi alla schermata Home.")}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[#52615b]">
            {t("Apri il menu del browser e scegli Installa app oppure Aggiungi alla schermata Home. Il collegamento apre Smart Steel Sales in modalità app e il manifest include un accesso rapido al calcolatore.")}
          </p>
        )}
        <p className="mt-2 text-xs leading-5 text-[#52615b]">
          {t("Nessun account richiesto per usare il calcolatore.")}
        </p>
      </div>
    </details>
  );
}
