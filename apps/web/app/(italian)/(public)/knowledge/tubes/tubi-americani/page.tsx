import type { Metadata } from "next";
import Link from "next/link";

import { UsPipeSampleCalculator } from "@/components/us-pipe-sample-calculator";
import { CALCULATOR_STANDARDS } from "@/lib/calculator-standards-registry";
import { absoluteUrl } from "@/lib/site";

const path = "/knowledge/tubes/tubi-americani";
const other = "/en/knowledge/tubes/american-pipe";

export const metadata: Metadata = {
  title: "Calcolo peso tubi americani — NPS, Schedule e API 5L",
  description: "Calcola peso teorico in kg/m, lb/ft e per barra su un campione documentato di tubi NPS/Schedule U.S. Steel. Differenze tra API 5L, ASME B36.10 e ASTM.",
  alternates: { canonical: absoluteUrl(path),
    languages: { it: absoluteUrl(path), en: absoluteUrl(other) } },
  openGraph: { title: "Peso tubi NPS e Schedule · Smart Steel Sales",
    description: "Dimensioni campione del produttore, calcolo teorico e riferimenti API/ASME/ASTM.",url:absoluteUrl(path),type:"article" },
};

export default function AmericanPipeItalianPage() {
  const selected = CALCULATOR_STANDARDS.filter(x =>
    ["api5l","asme-b3610","astm-a53","astm-a106","astm-a500"].includes(x.id));
  const jsonLd = {
    "@context":"https://schema.org","@type":"WebApplication",
    name:"Calcolo peso tubi americani NPS / Schedule",
    operatingSystem:"Web",applicationCategory:"EngineeringApplication",
    isAccessibleForFree:true,inLanguage:"it",url:absoluteUrl(path),
    description:"Calcolo geometrico teorico su un campione dimensionale del produttore, non tabella normativa ASME completa.",
  };
  return (
    <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/>
      <div className="flex justify-end">
        <Link href={other} hrefLang="en" lang="en" className="inline-flex min-h-10 items-center rounded-lg border border-[#c7ded3] bg-white px-3 text-xs font-bold text-[#123b34]">🇬🇧 English version →</Link>
      </div>
      <header>
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#1a5144]">Scuola · Tubi e norme americane</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#123b34] sm:text-4xl">Calcolo peso tubi americani NPS, Schedule e API 5L</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#52615b]">
          Seleziona una misura NPS/Schedule effettivamente documentata da U.S. Steel, confronta
          il peso teorico e quello pubblicato e ottieni kg/m, lb/ft e tonnellate.
          Il campione non sostituisce le tabelle dimensionali normative ASME.
        </p>
      </header>
      <UsPipeSampleCalculator locale="it"/>
      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-bold text-[#123b34]">Differenza fra norme API, ASME, ASTM ed EN</h2>
        <p className="mt-3 text-sm leading-7 text-[#52615b]">
          API 5L è una specifica di prodotto per line pipe; la sua 47ª edizione è stata pubblicata
          nel giugno 2026. ASME B36.10 fornisce il sistema dimensionale NPS/Schedule.
          ASTM A53 e ASTM A106 sono specifiche di prodotto con applicazioni diverse.
          Nessuna di queste identificazioni certifica automaticamente grado, PSL, processo, tolleranze o peso.
        </p>
        <p className="mt-3 text-sm leading-7 text-[#52615b]">
          Per profili strutturali quadri e rettangolari americani (ASTM A500), non assumiamo
          automaticamente i raggi del calcolo EN 10219. Per tubi strutturali europei consulta il
          <Link href="/knowledge/tubes" className="font-bold text-[#156449] underline"> calcolatore EN 10219 / EN 10210</Link>.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {selected.map(item=>(
            <div key={item.id} className="rounded-xl border border-[#dce5e0] p-4">
              <h3 className="text-sm font-bold text-[#123b34]">{item.title}</h3>
              <p className="mt-2 text-xs leading-6 text-[#52615b]">{item.noteIt}</p>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-block text-xs font-bold text-[#156449] underline">Ente normativo →</a>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-[#dce5e0] bg-white p-6">
        <h2 className="text-xl font-bold text-[#123b34]">Formula per il peso teorico</h2>
        <p className="mt-3 text-sm leading-7 text-[#52615b]">
          Per un tubo tondo con diametro esterno D e spessore nominale t, l'area geometrica è
          π × t × (D − t) mm². Moltiplichiamo per 7.850 kg/m³ e dividiamo per 1.000.000
          per ottenere kg/m teorici. La massa pubblicata dal catalogo U.S. Steel è mostrata separatamente.
          I dati presenti riguardano soltanto alcune combinazioni NPS 6, 8, 10 e 12,
          non la copertura completa delle dimensioni o degli Schedule.
        </p>
      </section>
    </div>
  );
}
