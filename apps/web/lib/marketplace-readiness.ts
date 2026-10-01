import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type MarketplaceReadinessStatus = "ready" | "blocked" | "improve";

export type MarketplaceReadinessCheck = {
  key: string;
  label: string;
  status: MarketplaceReadinessStatus;
  description: string;
  href?: string;
  actionLabel?: string;
};

export type MarketplaceEntryReadiness = {
  buyer: {
    namedPublicationReady: boolean;
    canWrite: boolean;
    checks: MarketplaceReadinessCheck[];
  };
  supplier: {
    matchingReady: boolean;
    canRespondByRole: boolean;
    productCount: number;
    technicalSignalCount: number;
    checks: MarketplaceReadinessCheck[];
  };
  networkCompanyId: string | null;
};

export type MarketplaceIssue = {
  code: string;
  message: string;
};

const supplierRelationshipTypes = new Set([
  "produces",
  "distributes",
  "stocks",
  "processes",
]);

export async function getMarketplaceEntryReadiness(
  organizationId: string,
  role: string,
): Promise<MarketplaceEntryReadiness> {
  const canWrite = canWriteWorkspace(role);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hp11_marketplace_readiness", {
    p_organization_id: organizationId,
  });

  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as {
    network_company_id?: string | null;
    link_status?: string | null;
    publication_status?: string | null;
    supplier_product_count?: number;
    technical_signal_count?: number;
    named_publication_ready?: boolean;
    supplier_matching_ready?: boolean;
  };

  const networkCompanyId = payload.network_company_id ?? null;
  const linkReady = payload.link_status === "active";
  const profilePublished = payload.publication_status === "published";
  const productCount = Number(payload.supplier_product_count ?? 0);
  const technicalSignalCount = Number(payload.technical_signal_count ?? 0);
  const namedPublicationReady = Boolean(payload.named_publication_ready);
  const matchingReady = Boolean(payload.supplier_matching_ready);

  return {
    buyer: {
      namedPublicationReady,
      canWrite,
      checks: [
        {
          key: "buyer-write-role",
          label: "Creazione e pubblicazione",
          status: canWrite ? "ready" : "blocked",
          description: canWrite
            ? "Il tuo ruolo può creare bozze e pubblicare ricerche Marketplace."
            : "Il tuo ruolo è in sola lettura: puoi consultare il Marketplace, ma non creare o pubblicare ricerche.",
          href: canWrite ? undefined : appRoutes.home,
          actionLabel: canWrite ? undefined : "Torna al workspace",
        },
        {
          key: "buyer-network-profile",
          label: "Pubblicazione con azienda visibile",
          status: namedPublicationReady ? "ready" : "improve",
          description: namedPublicationReady
            ? "Il Company Profile è collegato e pubblicato: puoi usare la modalità named."
            : "Per mostrare il nome della tua azienda serve un Company Profile collegato e pubblicato. La modalità anonima resta disponibile.",
          href: namedPublicationReady ? undefined : appRoutes.network.manage,
          actionLabel: namedPublicationReady
            ? undefined
            : "Completa Company Profile",
        },
      ],
    },
    supplier: {
      matchingReady,
      canRespondByRole: canWrite,
      productCount,
      technicalSignalCount,
      checks: [
        {
          key: "supplier-public-profile",
          label: "Profilo supplier nel Network",
          status: linkReady && profilePublished ? "ready" : "blocked",
          description:
            linkReady && profilePublished
              ? "Il profilo è collegato alla tua organizzazione e pubblicato nel Network."
              : "Il matching considera solo Company Profile pubblicati e collegati a un’organizzazione attiva.",
          href:
            linkReady && profilePublished
              ? undefined
              : appRoutes.network.manage,
          actionLabel:
            linkReady && profilePublished
              ? undefined
              : "Sistema il Company Profile",
        },
        {
          key: "supplier-products",
          label: "Prodotti e relazione commerciale",
          status: productCount > 0 ? "ready" : "blocked",
          description:
            productCount > 0
              ? productCount === 1
                ? "1 relazione prodotto eleggibile per il matching."
                : `${productCount} relazioni prodotto eleggibili per il matching.`
              : "Dichiara almeno un prodotto come produttore, distributore, stockholder o processor per entrare nel matching.",
          href: productCount > 0 ? undefined : appRoutes.network.manage,
          actionLabel:
            productCount > 0 ? undefined : "Aggiungi prodotti",
        },
        {
          key: "supplier-technical-scope",
          label: "Precisione del matching",
          status: technicalSignalCount > 0 ? "ready" : "improve",
          description:
            technicalSignalCount > 0
              ? `${technicalSignalCount} segnal${technicalSignalCount === 1 ? "e tecnico" : "i tecnici"} dichiarat${technicalSignalCount === 1 ? "o" : "i"} tra norme, gradi e range dimensionali.`
              : "Il prodotto può essere matchato anche con scope tecnico incompleto, ma norme, gradi e range dimensionali rendono il matching più preciso.",
          href:
            technicalSignalCount > 0
              ? undefined
              : appRoutes.network.manage,
          actionLabel:
            technicalSignalCount > 0
              ? undefined
              : "Completa scope tecnico",
        },
        {
          key: "supplier-response-role",
          label: "Risposta Marketplace",
          status: canWrite ? "ready" : "blocked",
          description: canWrite
            ? "Il ruolo può creare e modificare risposte quando entitlement, unlock e listing aperta lo consentono."
            : "Il ruolo viewer può leggere le opportunità ma non creare o modificare risposte.",
          href: canWrite ? undefined : appRoutes.home,
          actionLabel: canWrite ? undefined : "Torna al workspace",
        },
      ],
    },
    networkCompanyId,
  };
}

export function marketplaceIssueFromError(error: string): MarketplaceIssue {
  const normalized = error.trim();
  const lower = normalized.toLowerCase();

  if (
    lower.includes(
      "named marketplace publication requires an active published network company profile",
    )
  ) {
    return {
      code: "buyer_profile_not_published",
      message:
        "Per pubblicare con azienda visibile devi prima avere un Company Profile collegato e pubblicato nel Network.",
    };
  }

  if (lower.includes("marketplace request requires at least one product line")) {
    return {
      code: "request_line_required",
      message:
        "Aggiungi almeno una linea prodotto completa prima di pubblicare la ricerca.",
    };
  }

  if (lower.includes("organization marketplace request rate limit exceeded")) {
    return {
      code: "request_rate_limited",
      message:
        "Hai raggiunto il limite temporaneo di nuove ricerche Marketplace. Riprova più tardi.",
    };
  }

  if (lower.includes("material grade requires a selected standard")) {
    return {
      code: "grade_requires_standard",
      message:
        "Per indicare un grado materiale devi prima selezionare la norma di riferimento.",
    };
  }

  if (lower.includes("material grade is not canonically linked to selected standard")) {
    return {
      code: "grade_standard_mismatch",
      message:
        "Il grado selezionato non appartiene alla norma scelta. Correggi norma o grado.",
    };
  }

  if (lower.includes("steel standard is not mapped to this marketplace product family")) {
    return {
      code: "standard_product_mismatch",
      message:
        "La norma selezionata non è compatibile con questa famiglia prodotto.",
    };
  }

  if (lower.includes("marketplace response right not available")) {
    return {
      code: "response_right_unavailable",
      message:
        "Il diritto di risposta non è disponibile: controlla entitlement, unlock e stato dell’opportunità.",
    };
  }

  if (lower.includes("marketplace request is no longer open")) {
    return {
      code: "request_not_open",
      message:
        "L’opportunità non è più aperta e non può ricevere nuove risposte.",
    };
  }

  if (lower.includes("active marketplace entitlement required")) {
    return {
      code: "entitlement_required",
      message:
        "Serve un entitlement Marketplace attivo per inviare questa risposta.",
    };
  }

  if (lower.includes("marketplace detail unlock required")) {
    return {
      code: "unlock_required",
      message:
        "Apri prima il dettaglio governato dell’opportunità per completare l’unlock.",
    };
  }

  if (lower.includes("quote response requires at least one priced response line")) {
    return {
      code: "priced_line_required",
      message:
        "Una quotazione richiede almeno una linea con prezzo e valuta.",
    };
  }

  if (lower.includes("interest response requires a message or structured response line")) {
    return {
      code: "interest_content_required",
      message:
        "Per inviare una manifestazione di interesse aggiungi un messaggio oppure almeno una linea strutturata.",
    };
  }

  if (lower.includes("marketplace response validity cannot be in the past")) {
    return {
      code: "response_validity_past",
      message:
        "La validità della risposta deve essere oggi o una data futura.",
    };
  }

  if (lower.includes("offered delivery date cannot be in the past")) {
    return {
      code: "delivery_date_past",
      message:
        "La data di consegna offerta non può essere nel passato.",
    };
  }

  if (lower.includes("requested delivery date cannot be in the past")) {
    return {
      code: "requested_delivery_date_past",
      message:
        "La data di consegna richiesta non può essere nel passato.",
    };
  }

  if (
    normalized &&
    !/exception|sql|postgres|function|relation|schema|rpc/i.test(normalized)
  ) {
    return { code: "validation", message: normalized };
  }

  return {
    code: "marketplace_operation_failed",
    message:
      "Operazione Marketplace non completata. Controlla i requisiti mostrati nella pagina e riprova.",
  };
}
