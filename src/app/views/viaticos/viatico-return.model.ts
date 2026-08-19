export type ViaticoReturnForm = 'pending' | 'cash' | 'deposit';
export type ViaticoReturnStatus = 'pending' | 'validated' | 'rejected';
export type ViaticoReturnDirection = 'to_company' | 'to_seller';

export interface ViaticoReturnDebt {
  cash_received: number;
  deposited: number;
  deposited_pending: number;
  debt: number;
}

export interface ViaticoReturn {
  id: number;
  comision_id: number;
  comision_destination: string | null;
  comision_date_from: string | null;
  comision_date_to: string | null;
  user_id: number;
  user_name: string | null;
  direction: ViaticoReturnDirection;
  amount: number;
  form: ViaticoReturnForm;
  bank_name: string | null;
  payment_method_id: number | null;
  payment_method_name: string | null;
  operation_number: string | null;
  operation_date: string | null;
  operation_time: string | null;
  voucher_url: string | null;
  received_by_name: string | null;
  cash_settled: boolean;
  cash_settled_at: string | null;
  status: ViaticoReturnStatus;
  validated_by_name: string | null;
  validated_at: string | null;
  notes: string | null;
  created_at: string;
}
