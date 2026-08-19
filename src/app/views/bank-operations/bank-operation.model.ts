export type BankOperationSource = 'collection' | 'deposit' | 'advance' | 'return' | 'expense';

export interface BankOperation {
  source: BankOperationSource;
  source_label: string;
  id: number;
  reference: string | null;
  operation_number: string;
  operation_number_normalized: string;
  bank_name: string | null;
  payment_method_name: string | null;
  date: string | null;
  time: string | null;
  amount: number | null;
  user_name: string | null;
  status: string | null;
  created_at: string;
  is_duplicate: boolean;
}

export const BANK_OPERATION_SOURCES: Record<BankOperationSource, { label: string; color: string }> = {
  collection: { label: 'Cobro a cliente',        color: 'primary' },
  deposit:    { label: 'Depósito de caja',       color: 'info' },
  advance:    { label: 'Viáticos entregados',    color: 'warning' },
  return:     { label: 'Devolución de viáticos', color: 'secondary' },
  expense:    { label: 'Gasto de viáticos',      color: 'dark' },
};
