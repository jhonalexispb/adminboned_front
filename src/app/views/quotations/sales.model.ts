// ── Cotizaciones ──────────────────────────────────────────────────────────────

export interface QuotationItem {
  id?: number;
  product_id: number;
  product_name?: string | null;
  product_laboratory?: string | null;
  lot_id: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

export interface Quotation {
  id: number;
  code: string;
  client: {
    id: number; name: string; business_name: string; phone: string | null; email: string | null;
    ruc: string | null; dni: string | null; address: string | null;
    district: { id: number; name: string; province?: { id: number; name: string; department?: { id: number; name: string } | null } | null } | null;
  } | null;
  seller: { id: number; name: string } | null;
  /** true si seller es null porque todavía es solo un candidato en vivo (zona/fecha de tu comisión abierta) — no se te asignó de verdad hasta cerrarla. */
  pending_commission: boolean;
  /** true si, además, la zona también la cubre otra comisión abierta — puede terminar comisionándose a otro vendedor. */
  shared_zone: boolean;
  created_by: { id: number; name: string } | null;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  subtotal: string;
  discount: string;
  total: string;
  public_token: string | null;
  token_expires_at: string | null;
  notes: string | null;
  document_type: 'invoice' | 'receipt' | 'sale_note' | null;
  origin: 'admin' | 'catalog';
  approved_at: string | null;
  shipping_type: 'local' | 'province' | null;
  carrier: { id: number; name: string; phone: string | null; ruc: string | null; address: string | null; district: { id: number; name: string; province?: { id: number; name: string; department?: { id: number; name: string } | null } | null } | null } | null;
  items?: QuotationItem[];
  order_id?:             number | null;
  order_status?:         string | null;
  order_has_document?:   boolean;
  order_payments_count?: number;
  order_sale_document?:  { document_type: 'invoice' | 'receipt' | 'sale_note'; full_number: string | null; status: string } | null;
  order_shipping_guide?: { full_number: string | null; sunat_status: string } | null;
  created_at: string;
  updated_at: string;
}

export interface Carrier {
  id: number;
  name: string;
  phone: string | null;
  ruc: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  active: boolean;
  district: {
    id: number; name: string;
    province?: { id: number; name: string; department?: { id: number; name: string } | null } | null;
  } | null;
}

/** Payload para crear la cabecera de una cotización (sin ítems). */
export interface QuotationPayload {
  client_id: number;
  document_type?: 'invoice' | 'receipt' | 'sale_note' | null;
  notes?: string | null;
  shipping_type?: 'local' | 'province' | null;
  carrier_id?: number | null;
}

/** Payload para agregar / reemplazar un producto en la cotización. */
export interface QuotationAddItemPayload {
  product_id: number;
  quantity: number;
}

// ── Órdenes de venta ──────────────────────────────────────────────────────────

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string | null;
  product_laboratory?: string | null;
  lot_id: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  already_returned?: number;
  returnable_quantity?: number;
}

export interface OrderShippingGuide {
  id: number;
  series: string | null;
  number: string | null;
  full_number: string | null;
  sunat_status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'voided';
  sunat_message: string | null;
  transfer_date: string | null;
  carrier_name: string;
  carrier_ruc: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  cdr_url: string | null;
}

export interface ShippingGuide {
  id: number;
  series: string | null;
  number: string | null;
  full_number: string | null;
  order_id: number;
  client: { id: number; name: string } | null;
  destination_address: string;
  partida_address: string | null;
  mod_traslado: string;
  es_m1l: boolean;
  carrier_name: string | null;
  carrier_ruc: string | null;
  vehicle_plate: string | null;
  transfer_date: string | null;
  transfer_reason: string;
  peso_bruto: string | null;
  unidad_peso: string;
  notes: string | null;
  sunat_status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'voided';
  sunat_message: string | null;
  has_pdf: boolean;
  has_xml: boolean;
  pdf_url: string | null;
  xml_url: string | null;
  cdr_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrderShipping {
  type: 'local' | 'province' | null;
  address: string | null;
  reference: string | null;
  notes: string | null;
  carrier: {
    id: number; name: string; phone: string | null; ruc: string | null; address: string | null;
    district: { id: number; name: string; province: string | null; department: string | null } | null;
  } | null;
}

export interface OrderCreditNote {
  id: number;
  full_number: string | null;
  status: string;
  total: string;
  issue_date: string | null;
  reason: string | null;
  is_internal: boolean;
  pdf_url: string | null;
  xml_url: string | null;
  cdr_url: string | null;
}

export interface OrderSaleDocument {
  id: number;
  document_type: 'invoice' | 'receipt' | 'sale_note';
  series: string | null;
  correlative: string | null;
  full_number: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'voided';
  has_xml: boolean;
  has_pdf: boolean;
  pdf_url: string | null;
  xml_url: string | null;
  cdr_url: string | null;
  sunat_message: string | null;
  /** true si se envió una comunicación de baja y SUNAT aún no confirma la anulación */
  void_pending: boolean;
  total: string;
  issue_date: string | null;
  credit_notes?: OrderCreditNote[];
}

export interface OrderStatusHistoryEntry {
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: string | null;
}

export interface Order {
  id: number;
  code: string;
  quotation_id: number | null;
  client: {
    id: number;
    name: string;
    business_name: string;
    phone: string | null;
    ruc: string | null;
    dni: string | null;
    address: string | null;
    district: { id?: number; name: string; province: string | null; department: string | null } | null;
  } | null;
  seller: { id: number; name: string } | null;
  warehouse_user: { id: number; name: string } | null;
  status: 'pending' | 'documented' | 'assembled' | 'dispatched' | 'delivered' | 'paid' | 'cancelled' | 'voided';
  warehouse_notes: string | null;
  document_type: 'invoice' | 'receipt' | 'sale_note' | null;
  subtotal: string;
  discount: string;
  total: string;
  shipping?: OrderShipping | null;
  items?: OrderItem[];
  payments_count?: number;
  payments_total?: number;
  collections_count?: number | null;
  paid_amount?: number | null;
  pending_amount?: number | null;
  rejected_count?: number | null;
  rejected_amount?: number | null;
  sale_document?: OrderSaleDocument | null;
  accepted_sale_document?: OrderSaleDocument | null;
  sale_documents?: OrderSaleDocument[];
  shipping_guide?: OrderShippingGuide | null;
  shipping_guides?: OrderShippingGuide[];
  status_history?: OrderStatusHistoryEntry[];
  created_at: string;
}

// ── Documentos de venta ───────────────────────────────────────────────────────

export interface SaleDocumentItem {
  id: number;
  product_id: number | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  igv: number;
  total: number;
}

export interface SaleDocument {
  id: number;
  order_id: number;
  document_type: 'invoice' | 'receipt' | 'sale_note';
  series: string | null;
  correlative: string | null;
  full_number: string | null;
  issue_date: string | null;
  client: { id: number; name: string; business_name: string; ruc: string | null; dni: string | null } | null;
  subtotal: string;
  igv: string;
  total: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'voided';
  /** Estado real del documento en ApiSunat (ACEPTADO/RECHAZADO/PENDIENTE/EXCEPCION/BAJA), calculado en index() */
  apisunat_status: string | null;
  apisunat_faults: string | null;
  has_xml: boolean;
  has_pdf: boolean;
  /** URL directa al PDF en ApiSunat (disponible cuando status=accepted) */
  pdf_url: string | null;
  /** URL directa al XML en ApiSunat */
  xml_url: string | null;
  /** URL directa al CDR (ZIP) en ApiSunat */
  cdr_url: string | null;
  /** Mensaje de respuesta SUNAT */
  sunat_message: string | null;
  /** true si se envió una comunicación de baja y SUNAT aún no confirma la anulación */
  void_pending: boolean;
  void_reason: string | null;
  /** true si esta nota de venta tiene NCs internas asociadas (impide anulación) */
  has_internal_credit_notes?: boolean;
  /** true si factura/boleta tiene NCs electrónicas SUNAT asociadas (impide anulación) */
  has_electronic_credit_notes?: boolean;
  notes: string | null;
  items?: SaleDocumentItem[];
  created_by: string | null;
  created_at: string;
}

// ── Notas de crédito ──────────────────────────────────────────────────────────

export interface CreditNote {
  id: number;
  series: string | null;
  correlative: string | null;
  full_number: string | null;
  issue_date: string | null;
  reason: string | null;
  subtotal: string;
  igv: string;
  total: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled';
  /** true si es una NC interna (notas de venta), generada sin pasar por ApiSunat */
  is_internal: boolean;
  /** Pedido al que pertenece el documento de venta origen de esta NC */
  order_id: number | null;
  /** Estado real en ApiSunat (solo se calcula para NC electrónicas, origin=apisunat) */
  apisunat_status: string | null;
  apisunat_faults: string | null;
  has_xml: boolean;
  has_pdf: boolean;
  /** URL directa al PDF en ApiSunat */
  pdf_url: string | null;
  /** URL directa al XML en ApiSunat */
  xml_url: string | null;
  /** URL directa al CDR (ZIP) en ApiSunat */
  cdr_url: string | null;
  /** Mensaje de respuesta SUNAT */
  sunat_message: string | null;
  sale_document: {
    id: number;
    full_number: string | null;
    document_type: 'invoice' | 'receipt' | 'sale_note';
    client: { name: string; business_name: string } | null;
  } | null;
  created_by: string | null;
  created_at: string;
}

// ── Pagos ─────────────────────────────────────────────────────────────────────

export interface PaymentRecord {
  id: number;
  code: string;
  order_id: number;
  amount: number;
  payment_method: { id: number; name: string } | null;
  payment_type: 'advance' | 'cash_on_delivery';
  operation_number: string | null;
  payment_date: string | null;
  notes: string | null;
  status: 'pending' | 'validated' | 'rejected';
  registered_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  active: boolean;
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft:     'Borrador',
  sent:      'Enviada',
  approved:  'Aprobada',
  rejected:  'Rechazada',
  cancelled: 'Cancelada',
  expired:   'Vencida',
};

export const QUOTATION_STATUS_COLORS: Record<string, string> = {
  draft:     'secondary',
  sent:      'info',
  approved:  'success',
  rejected:  'danger',
  cancelled: 'danger',
  expired:   'warning',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending:    'Pendiente',
  documented: 'Documentado',
  assembled:  'Armado',
  dispatched: 'En ruta',
  delivered:  'Entregado',
  paid:       'Cobrado',
  cancelled:  'Cancelado',
  voided:     'Doc. anulado',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending:    'warning',
  documented: 'info',
  assembled:  'primary',
  dispatched: 'warning',
  delivered:  'success',
  paid:       'success',
  cancelled:  'danger',
  voided:     'dark',
};

export const SALE_DOC_TYPE_LABELS: Record<string, string> = {
  invoice:   'Factura',
  receipt:   'Boleta',
  sale_note: 'Nota de venta',
};

export const SALE_DOC_STATUS_LABELS: Record<string, string> = {
  draft:    'Borrador',
  sent:     'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  voided:   'Anulado',
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  advance:          'Adelanto',
  cash_on_delivery: 'Contra entrega',
};
