"use client";

import { useEffect, useState } from "react";

export function CalculatorInstallGuide({ locale = "it" }: { locale?: "it" | "en" }) {
  const english = locale === "en";
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
        <span className="sm:hidden">{english ? "Install" : "Installa"}</span>
        <span className="hidden sm:inline">{english ? "Add to Home" : "Aggiungi a Home"}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[#cddbd6] bg-white p-4 text-left shadow-[0_16px_40px_rgba(11,47,39,0.16)]">
        <p className="text-sm font-bold text-[#173f35]">{english ? "Use the calculator like an app" : "Usa il calcolatore come un’app"}</p>
        {isIOS ? (
          <p className="mt-2 text-xs leading-5 text-[#52615b]">
            {english ? <>On iPhone or iPad: open Safari’s <strong>Share</strong> menu and choose <strong>Add to Home Screen</strong>.</> : <>Su iPhone o iPad: apri il menu <strong>Condividi</strong> di Safari e scegli <strong>Aggiungi alla schermata Home</strong>.</>}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[#52615b]">
            {english ? <>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>. Your shortcut opens Smart Steel Sales like an app, with direct access to the calculator.</> : <>Apri il menu del browser e scegli <strong>Installa app</strong> oppure <strong>Aggiungi alla schermata Home</strong>. Il collegamento apre Smart Steel Sales in modalità app e il manifest include un accesso rapido al calcolatore.</>}
          </p>
        )}
        <p className="mt-2 text-[10px] leading-4 text-[#7b8782]">
          {english ? "No account required to use the calculator." : "Nessun account richiesto per usare il calcolatore."}
        </p>
      </div>
    </details>
  );
}
