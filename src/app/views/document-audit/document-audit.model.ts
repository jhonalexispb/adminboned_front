export type DocumentAuditType = 'boleta' | 'factura' | 'ticket' | 'otro';

export interface DocumentAuditRow {
  id: number;
  user_id: number;
  user_name: string | null;
  comision_destination: string | null;
  document_type: DocumentAuditType;
  document_number: string;
  document_number_normalized: string;
  establishment_name: string | null;
  document_date: string | null;
  amount: number;
  category: string;
  photo_url: string | null;
  status: string;
  created_at: string;
  is_repeated_number: boolean;
}

export const DOCUMENT_AUDIT_TYPE_LABELS: Record<DocumentAuditType, string> = {
  boleta: 'Boleta', factura: 'Factura', ticket: 'Ticket', otro: 'Otro',
};
