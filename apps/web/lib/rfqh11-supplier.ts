export type SupplierLatestPrice = {
  rfq_id: string;
  at: string;
  revision_no: number;
  description: string;
  standard_code: string | null;
  grade_code: string | null;
  finish_code: string | null;
  eur_t: number | string | null;
  eur_m: number | string | null;
};

export type SupplierDirectoryItem = {
  id: string;
  identity_key: string;
  organization_id: string;
  display_name: string | null;
  email: string | null;
  preferred: boolean;
  tags: string[];
  notes: string | null;
  supplier_organization_id: string | null;
  supplier_network_company_id: string | null;
  supplier_company_id: string | null;
  supplier_contact_id: string | null;
  supplier_network_contact_id: string | null;
  saved_in_network: boolean;
  first_used_at: string;
  last_used_at: string;
  last_rfq_id: string | null;
  rfq_count: number;
  responded_rfq_count: number;
  declined_rfq_count: number;
  response_rate_pct: number | string;
  avg_response_hours: number | string | null;
  last_response_at: string | null;
  quoted_rfq_count: number;
  avg_lead_time_days: number | string | null;
  last_quote_at: string | null;
  award_count: number;
  awarded_total_eur: number | string;
  last_award_at: string | null;
  po_count: number;
  confirmed_po_count: number;
  last_po_at: string | null;
  latest_price: SupplierLatestPrice | null;
};

export type SupplierDirectoryData = {
  contract?: string;
  summary?: {
    supplier_count?: number;
    preferred_count?: number;
    with_quotes_count?: number;
    with_awards_count?: number;
    with_confirmed_po_count?: number;
    used_last_90d_count?: number;
  };
  items?: SupplierDirectoryItem[];
};

export type SupplierDetailData = {
  contract?: string;
  profile?: {
    id: string;
    identity_key: string;
    organization_id: string;
    display_name: string | null;
    email: string | null;
    preferred: boolean;
    tags: string[];
    notes: string | null;
    supplier_organization_id: string | null;
    supplier_network_company_id: string | null;
    supplier_company_id: string | null;
    supplier_contact_id: string | null;
    supplier_network_contact_id: string | null;
    first_used_at: string;
    last_used_at: string;
    last_rfq_id: string | null;
  };
  summary?: {
    rfq_count?: number;
    responded_rfq_count?: number;
    response_rate_pct?: number | string;
    avg_response_hours?: number | string | null;
    last_response_at?: string | null;
    award_count?: number;
    awarded_total_eur?: number | string;
    awarded_total_tonnes?: number | string;
    po_count?: number;
    confirmed_po_count?: number;
  };
  private_company?: {
    id: string;
    name: string;
    country: string | null;
    vat_number: string | null;
    website: string | null;
  } | null;
  private_contact?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  } | null;
  rfq_history?: Array<{
    rfq_id: string;
    rfq_title: string;
    rfq_status: string;
    rfq_due_at: string | null;
    rfq_created_at: string;
    supplier_status: string;
    sent_at: string | null;
    responded_at: string | null;
    declined_at: string | null;
    awarded_at: string | null;
    quote: {
      id: string;
      revision_no: number;
      status: string;
      submitted_at: string | null;
      lead_time_days: number | null;
      incoterm: string | null;
      payment_terms: string | null;
    } | null;
    purchase_order: {
      id: string;
      ref: string;
      status: string;
      total_eur: number | string;
      total_tonnes: number | string;
      issued_at: string | null;
      delivery_date: string | null;
    } | null;
  }>;
  price_history?: Array<{
    rfq_id: string;
    rfq_title: string;
    quote_id: string;
    revision_no: number;
    submitted_at: string;
    lead_time_days: number | null;
    incoterm: string | null;
    payment_terms: string | null;
    line_position: number;
    description: string;
    standard_code: string | null;
    grade_code: string | null;
    finish_code: string | null;
    eur_t: number | string | null;
    eur_m: number | string | null;
    offered_quantity: number | string | null;
    offered_quantity_mode: string | null;
  }>;
};
