import type { OrderItem } from '../quotations/sales.model';

export interface ReturnItem {
  id: number;
  product_id: number;
  product_name: string | null;
  lot_id: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  quantity: number;
}

/** Línea editable de productos a devolver, usada en "Nueva solicitud" y al editar una solicitud en borrador. */
export interface ReturnLine {
  orderItem: OrderItem;
  returnQty: number;
  selected:  boolean;
}

export interface ReturnRecord {
  id: number;
  code: string;
  order_id: number;
  type: 'full' | 'partial';
  reason: string;
  status: 'draft' | 'pending' | 'accepted' | 'cancelled';
  action_type: 'credit_note' | 'void' | 'internal' | null;
  notes: string | null;
  order: {
    id: number;
    code: string;
    total: string;
    client: { id: number; name: string; business_name: string } | null;
  } | null;
  sale_document: {
    id: number;
    document_type: 'invoice' | 'receipt' | 'sale_note';
    full_number: string;
    status: string;
    issue_date: string | null;
    total: string;
  } | null;
  items?: ReturnItem[];
  credit_note: {
    id: number;
    full_number: string;
    status: string;
    total: string;
    is_internal: boolean;
    has_xml: boolean;
    has_pdf: boolean;
    pdf_url: string | null;
    xml_url: string | null;
    cdr_url: string | null;
  } | null;
  created_by: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface ReturnPayload {
  order_id: number;
  reason: string;
  notes?: string | null;
  items: { product_id: number; lot_id: number | null; quantity: number }[];
}

export const RETURN_STATUS_LABELS: Record<string, string> = {
  draft:     'Borrador',
  pending:   'Pendiente',
  accepted:  'Procesada',
  cancelled: 'Rechazada',
};

export const RETURN_STATUS_COLORS: Record<string, string> = {
  draft:     'secondary',
  pending:   'warning',
  accepted:  'success',
  cancelled: 'danger',
};

export const MOTIVO_OPTIONS = [
  { label: 'Anulación de la operación',  value: '01' },
  { label: 'Anulación por error en RUC', value: '02' },
  { label: 'Devolución total',            value: '06' },
  { label: 'Devolución por ítem',         value: '07' },
  { label: 'Disminución en el valor',     value: '09' },
];
