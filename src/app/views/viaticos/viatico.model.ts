export type ViaticCategory = string;
export type ViaticStatus   = 'pending' | 'approved' | 'rejected';
export type ViaticPaymentForm = 'cash' | 'transfer';
export type ViaticDocumentType = 'boleta' | 'factura' | 'ticket' | 'otro';

export const DOCUMENT_TYPE_LABELS: Record<ViaticDocumentType, string> = {
  boleta: 'Boleta', factura: 'Factura', ticket: 'Ticket', otro: 'Otro',
};

export interface Viatico {
  id: number;
  user_id: number;
  user_name: string | null;
  comision_id: number | null;
  comision_destination: string | null;
  comision_date_from: string | null;
  comision_date_to: string | null;
  date: string;
  category: ViaticCategory;
  description: string | null;
  amount: number;
  payment_form: ViaticPaymentForm;
  bank_name: string | null;
  payment_method_name: string | null;
  operation_number: string | null;
  operation_date: string | null;
  operation_time: string | null;
  voucher_url: string | null;
  photo_url: string | null;
  document_type: ViaticDocumentType | null;
  document_number: string | null;
  establishment_name: string | null;
  document_date: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  status: ViaticStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface ViaticSummary {
  total: number;
  total_amount: number;
  pending_amount: number;
  approved_amount: number;
  rejected_amount: number;
  pending_count: number;
}

export const VIATICO_STATUS: Record<ViaticStatus, { label: string; color: string }> = {
  pending:  { label: 'Pendiente', color: 'warning' },
  approved: { label: 'Aprobado',  color: 'success' },
  rejected: { label: 'Rechazado', color: 'danger'  },
};
