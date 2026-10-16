import Link from "next/link";
import { notFound } from "next/navigation";
import { FocusPage } from "@/components/focus-ui";
import { getFreeNetworkProfile, safeNetworkWebsiteUrl } from "@/lib/network-free";

export async function FreeNetworkProfileView({
  organizationId, companyId,
}: { organizationId: string; companyId: string }) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(companyId)) notFound();
  let profile;
  try {
    profile = await getFreeNetworkProfile(organizationId, companyId);
  } catch {
    return (
      <FocusPage className="max-w-[960px]">
        <h1 className="text-xl font-semibold text-[#173f35]">Profilo non disponibile</h1>
        <p className="mt-2 text-sm text-[#52615b]">Verifica l'attivazione della tua azienda oppure riprova.</p>
        <Link href="/network" className="mt-4 inline-block text-sm font-semibold text-[#173f35] underline">Torna alla directory</Link>
      </FocusPage>
    );
  }
  if (!profile) notFound();
  const website = safeNetworkWebsiteUrl(profile.company.website_url);
  const source = safeNetworkWebsiteUrl(profile.source_url);
  const license = safeNetworkWebsiteUrl(profile.license_url);
  const provisional = profile.company.discovery_status==="unconfirmed";
  return (
    <FocusPage className="max-w-[960px]">
      <Link href="/network" className="text-sm font-semibold text-[#173f35] underline">← Torna alla directory</Link>
      <section className="mt-5 rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-xs font-semibold text-[#173f35]">
          {provisional ? "Scoperta dal Network · Da confermare" : "Profilo Network Free"}
        </span>
        <h1 className="mt-3 text-2xl font-semibold text-[#173f35]">{profile.company.trading_name || profile.company.legal_name}</h1>
        <p className="mt-2 text-sm text-[#52615b]">{profile.company.country_code} · {profile.roles.map((r) => r.name).join(" · ") || "Ruolo da completare"}{provisional ? " · Ruolo indicativo" : ""}</p>
        {provisional ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-[#6e4c19]">
          Questo profilo nasce da una ricerca aziendale e non è ancora stato confermato dall'azienda. La presenza nel Network non implica rapporti commerciali, verifica della sede o acquisto di prodotti siderurgici.
          {profile.finished_only ? " L'uso di tubi in acciaio non è documentato in modo esplicito." : ""}
          <div className="mt-2 flex flex-wrap gap-4">
            {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Vedi fonte aziendale ↗</a> : null}
            {license ? <a href={license} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Licenza e attribuzione dei dati ↗</a> : null}
            <Link href="/company-data" className="font-semibold underline">Segnala una correzione o chiedi la rimozione →</Link>
          </div>
        </div> : null}
        {profile.company.description ? <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#43524c]">{profile.company.description}</p> : null}
        {website ? <a href={website} target="_blank" rel="noopener noreferrer" className="app-secondary mt-5 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold">Visita sito aziendale</a> : null}
        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-base font-semibold text-[#173f35]">Prodotti dichiarati</h2>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">{profile.products.join(" · ") || "Non ancora disponibili"}</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#173f35]">Sedi pubblicate</h2>
            {profile.facilities.length ? (
              <ul className="mt-2 space-y-2 text-sm text-[#52615b]">
                {profile.facilities.map((f, index) => (
                  <li key={index}>{[f.city, f.region, f.country_code].filter(Boolean).join(" · ")}</li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-[#52615b]">Località non ancora disponibili</p>}
          </div>
        </div>
      </section>
      <p className="mt-4 text-xs text-[#647269]">
        Questo profilo include solo dati aziendali condivisibili. Contatti privati,
        storico commerciale, offerte e prezzi restano esclusi. Le connessioni arriveranno con NET-UX6.
      </p>
    </FocusPage>
  );
}
