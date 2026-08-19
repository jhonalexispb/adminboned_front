export interface Bank {
  id: number;
  name: string;
  active: boolean;
  account_number?: string | null;
  account_type?: string | null;
}

export interface BankPaymentMethod {
  id: number;
  bank_id: number;
  bank?: Bank;
  name: string;
  op_format: 'numeric' | 'alphanumeric' | 'alpha';
  op_min_length: number | null;
  op_max_length: number | null;
  guide_image_url: string | null;
  active: boolean;
}

export interface OrderCollection {
  id: number;
  code: string;
  order_id: number;
  order?: { id: number; code: string; client: { id: number; name: string; business_name: string } | null } | null;
  amount: string;
  collection_form: 'cash' | 'transfer';
  registered_by: number;
  registered_by_name?: string;
  bank?: Bank | null;
  payment_method_id?: number | null;
  payment_method?: BankPaymentMethod | null;
  operation_number?: string | null;
  operation_date?: string | null;
  operation_time?: string | null;
  voucher_path?: string | null;
  voucher_url?: string | null;
  status: 'collected' | 'pending' | 'validated' | 'rejected';
  notes?: string | null;
  has_cross_duplicate?: boolean;
  validated_by?: string | null;
  validated_at?: string | null;
  created_at: string;
}

export interface UserDeposit {
  id: number;
  code: string;
  source?: 'collection' | 'viatico';
  deposited_by: number;
  deposited_by_name?: string;
  amount: string;
  bank?: Bank | null;
  payment_method_id?: number | null;
  payment_method?: BankPaymentMethod | null;
  operation_number: string;
  deposit_date: string;
  deposit_time?: string | null;
  voucher_path: string;
  voucher_url?: string;
  notes?: string | null;
  status: 'pending' | 'validated' | 'rejected';
  has_cross_duplicate?: boolean;
  validated_by?: string | null;
  validated_at?: string | null;
  created_at: string;
}

export interface Collector {
  id: number;
  name: string;
}

export interface MyDebt {
  cash_collected: number;
  deposited: number;
  deposited_pending: number;
  debt: number;
  transfer_validated: number;
}

export interface CashHistoryCoverage {
  code: string;
  date: string;
  status: 'validated' | 'pending';
  amount: number;
}

export interface CashHistoryDay {
  date: string;
  cash_collected: number;
  deposited: number;
  deposited_pending: number;
  running_debt: number;
  covered_by: CashHistoryCoverage[];
  uncovered: number;
}

export interface UserDebtCollection {
  id: number;
  code: string;
  amount: number;
  covered_amount: number;
  uncovered_amount: number;
  date: string;
  days_ago: number;
  order_code: string | null;
  client_name: string | null;
}

export interface UserDebtSummary {
  id: number;
  name: string;
  cash_total: number;
  deposited: number;
  pending_deposits: number;
  total_debt: number;
  collections: UserDebtCollection[];
}

export const COLLECTION_STATUS_LABEL: Record<string, string> = {
  collected: 'Cobrado',
  pending:   'Pendiente',
  validated: 'Validado',
  rejected:  'Rechazado',
};

export const COLLECTION_STATUS_COLOR: Record<string, string> = {
  collected: 'info',
  pending:   'warning',
  validated: 'success',
  rejected:  'danger',
};

export const DEPOSIT_STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  validated: 'Validado',
  rejected:  'Rechazado',
};

export const DEPOSIT_STATUS_COLOR: Record<string, string> = {
  pending:   'warning',
  validated: 'success',
  rejected:  'danger',
};

export const OP_FORMAT_LABEL: Record<string, string> = {
  numeric:      'Solo números',
  alpha:        'Solo letras',
  alphanumeric: 'Letras y números',
};
