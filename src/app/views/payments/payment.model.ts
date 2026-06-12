export interface PaymentVoucher {
  id: number;
  image_path: string;
  url: string;
  description: string | null;
}

export interface PaymentRecord {
  id: number;
  code: string;
  order_id: number;
  order: {
    id: number;
    code: string;
    client: { id: number; name: string; business_name: string } | null;
  } | null;
  amount: string;
  payment_method: { id: number; name: string } | null;
  payment_type: 'advance' | 'cash_on_delivery';
  operation_number: string | null;
  payment_date: string | null;
  notes: string | null;
  status: 'pending' | 'validated' | 'rejected';
  vouchers: PaymentVoucher[];
  registered_by: { id: number; name: string } | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
}

export interface SellerBalance {
  seller_id: number;
  seller_name: string;
  pending_amount: number;
  validated_amount: number;
  total_count: number;
  pending_count: number;
}

export interface MyBalance {
  pending_amount: number;
  validated_amount: number;
  rejected_amount: number;
  pending_count: number;
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  validated: 'Validado',
  rejected:  'Rechazado',
};

export const PAYMENT_STATUS_COLOR: Record<string, string> = {
  pending:   'warning',
  validated: 'success',
  rejected:  'danger',
};

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  advance:          'Adelanto',
  cash_on_delivery: 'Contra entrega',
};
