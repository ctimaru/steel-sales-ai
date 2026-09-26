import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  IdentityConfirmForm,
  type VerifiedCompanyOption,
} from "@/components/identity-confirm-form";
import { createClient } from "@/lib/supabase/server";

type QueueContact = {
  contact_id: string;
  full_name: string | null;
  email: string;
  message_count: number;
  rfq_count: number;
};

type QueueCompany = {
  company_id: string;
  name: string;
  company_type: string | null;
  country: string | null;
  vat_number: string | null;
};

type QueuePayload = {
  summary?: {
    unresolved_contacts?: number;
    verified_companies?: number;
  };
  contacts?: QueueContact[];
  verified_companies?: QueueCompany[];
  policy?: {
    domain_inference?: boolean;
  };
};

type RecoveryPayload = {
  summary?: {
    recovered_messages?: number;
    recovered_conversations?: number;
    unattributed_rfqs?: number;
    missing_legacy_message?: number;
    pending_company_confirmation?: number;
    pending_contact_resolution?: number;
    blocked_identity_conflict?: number;
  };
  policy?: {
    exact_header_only?: boolean;
    email_domain_inference?: boolean;
    filename_inference?: boolean;
    multi_message_company_requires_consensus?: boolean;
    materialize_then_finalize?: boolean;
  };
};

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export default async function IdentityReviewPage() {
  if (!configured()) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Identità aziendali</h1>
        <Card className="mt-7">
          <CardContent className="text-sm text-slate-600">
            La coda identità è disponibile quando il workspace è connesso a Supabase.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = user
    ? await supabase
        .from("organization_memberships")
        .select("organization_id,role,is_default,status")
        .eq("user_id", user.id)
        .eq("status", "active")
    : { data: null };

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  const canConfirm = membership?.role === "admin" || membership?.role === "member";

  let payload: QueuePayload = {};
  let recovery: RecoveryPayload = {};
  if (membership) {
    const [{ data: queueData }, { data: recoveryData }] = await Promise.all([
      supabase.rpc("p1_identity_confirmation_queue", {
        p_organization_id: membership.organization_id,
        p_limit: 100,
      }),
      supabase.rpc("p2_rfq_attribution_recovery_status", {
        p_organization_id: membership.organization_id,
        p_limit: 100,
      }),
    ]);
    if (queueData && typeof queueData === "object") payload = queueData as QueuePayload;
    if (recoveryData && typeof recoveryData === "object") recovery = recoveryData as RecoveryPayload;
  }

  const contacts = payload.contacts ?? [];
  const companies = payload.verified_companies ?? [];
  const companyOptions: VerifiedCompanyOption[] = companies.map((company) => ({
    companyId: company.company_id,
    name: company.name,
    vatNumber: company.vat_number,
  }));
  const recoverySummary = recovery.summary ?? {};
  const recoveredMessages = Number(recoverySummary.recovered_messages ?? 0);
  const recoveredConversations = Number(recoverySummary.recovered_conversations ?? 0);
  const unattributedRfqs = Number(recoverySummary.unattributed_rfqs ?? 0);
  const pendingCompanyRfqs = Number(recoverySummary.pending_company_confirmation ?? 0);
  const missingLegacyMessages = Number(recoverySummary.missing_legacy_message ?? 0);
  const identityConflicts = Number(recoverySummary.blocked_identity_conflict ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/review" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
            ← Correzioni
          </Link>
          <p className="mt-4 text-sm font-semibold text-slate-500">Controllo identità</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Identità aziendali</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Conferma il rapporto tra un contatto riconosciuto per email esatta e una Company già verificata.
            Il dominio email non viene mai usato per creare o associare automaticamente una Company.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="amber">{contacts.length} da confermare</Badge>
          <Badge tone="green">{companies.length} Company verificate</Badge>
        </div>
      </div>

      <Card className="mt-7 border-[#3c8192]/20 bg-[#eef5f6]">
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3c8192]">
                P2.3 · Legacy identity recovery
              </p>
              <p className="mt-2 text-sm font-semibold text-[#17343f]">
                {recoveredMessages} header legacy recuperati · {recoveredConversations} conversazioni
              </p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#45636d]">
                Il recovery usa esclusivamente sender, timestamp e content hash strutturati.
                Dominio email, filename, subject e body non vengono usati per dedurre la Company.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={unattributedRfqs > 0 ? "amber" : "green"}>
                {unattributedRfqs} RFQ senza Company
              </Badge>
              <Badge tone={pendingCompanyRfqs > 0 ? "amber" : "green"}>
                {pendingCompanyRfqs} RFQ da confermare
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/70 bg-white/70 p-3">
              <p className="text-lg font-semibold text-[#0b171e]">{contacts.length}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Contatti da mappare
              </p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/70 p-3">
              <p className="text-lg font-semibold text-[#0b171e]">{missingLegacyMessages}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Header mancanti
              </p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/70 p-3">
              <p className="text-lg font-semibold text-[#0b171e]">{identityConflicts}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Conflitti identità
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canConfirm && membership ? (
        <Card className="mt-7 border-amber-200 bg-amber-50">
          <CardContent className="text-sm text-amber-900">
            Puoi consultare la coda, ma solo Admin e Member possono confermare associazioni.
          </CardContent>
        </Card>
      ) : null}

      {companies.length === 0 ? (
        <Card className="mt-7 border-slate-200 bg-white">
          <CardContent>
            <p className="text-sm font-semibold text-slate-900">Nessuna Company verificata disponibile</p>
            <p className="mt-1 text-sm text-slate-500">
              Prima verifica una Company tramite VAT o master data. Nessuna associazione può essere confermata usando solo il dominio email.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-7 space-y-4">
        {contacts.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-slate-900">Nessuna identità in attesa</p>
              <p className="mt-1 text-sm text-slate-500">
                I contatti con Company già confermata escono automaticamente da questa coda.
              </p>
            </CardContent>
          </Card>
        ) : (
          contacts.map((contact) => (
            <Card key={contact.contact_id}>
              <CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr_300px] lg:items-center">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="amber">Da confermare</Badge>
                    <Badge tone="neutral">Email esatta</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    {contact.full_name || "Contatto senza nome"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{contact.email}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Collegamenti già deterministici
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {contact.message_count} messaggi · {contact.rfq_count} RFQ
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    La conferma creerà un audit Contact→Company e rilancerà la propagazione sui messaggi e sulle RFQ collegate.
                  </p>
                </div>

                <IdentityConfirmForm
                  contactId={contact.contact_id}
                  companies={companyOptions}
                  disabled={!canConfirm}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-400">
        La selezione è sempre manuale: Steel Sales AI mostra solo Company già verificate e non propone associazioni in base al dominio.
      </p>
    </div>
  );
}
