import { ViaticDocumentType } from '../viaticos/viatico.model';

export type ComisionStatus = 'open' | 'closed';
export type ComisionAdvanceStatus = 'none' | 'delivered';

export interface ComisionResumenFinanciero {
  adelanto: number;
  aprobado: number;
  pendiente_revision: number;
  rechazado: number;
  vuelto_o_faltante: number | null;
}

/** Solo viene poblado (no null) mientras la comisión está abierta — ver ComisionController::ventasResumen(). */
export interface ComisionVentasResumen {
  ganado: number;
  potencial: number;
  comision_ganada: number;
  comision_potencial: number;
  porcentaje_ganado: number | null;
  porcentaje_potencial: number | null;
}

export interface ComisionTramo {
  id: number;
  min_amount: number;
  percentage: number;
}

export interface ComisionTramoInput {
  min_amount: number | null;
  percentage: number | null;
}

export interface ComisionZona {
  id: number;
  zone_type: 'department' | 'province' | 'district';
  department_id: number | null;
  department_name: string | null;
  province_id: number | null;
  province_name: string | null;
  district_id: number | null;
  district_name: string | null;
}

export interface ComisionPayment {
  paid_at: string | null;
  form: 'cash' | 'deposit' | null;
  bank_name: string | null;
  payment_method_name: string | null;
  operation_number: string | null;
  operation_date: string | null;
  operation_time: string | null;
  voucher_url: string | null;
}

export interface ComisionAdvance {
  status: ComisionAdvanceStatus;
  form: 'cash' | 'deposit' | null;
  amount: number | null;
  delivered_by_name: string | null;
  delivered_at: string | null;
  bank_name: string | null;
  payment_method_name: string | null;
  operation_number: string | null;
  operation_date: string | null;
  operation_time: string | null;
  voucher_url: string | null;
}

export interface GastoResumen {
  id: number;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_form: 'cash' | 'transfer';
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
  status: string;
  review_notes: string | null;
}

/** Pedido vendido que hoy no cae en zona/fecha de ninguna comisión abierta — informativo, ver ComisionController::sinComisionar(). */
export interface PedidoSinComisionar {
  id: number;
  code: string;
  client_business_name: string | null;
  client_name: string | null;
  client_district: string | null;
  client_province: string | null;
  client_department: string | null;
  date: string;
  total: number;
  net_collected: number;
}

export interface PedidoCandidato {
  id: number;
  code: string;
  client_business_name: string | null;
  client_name: string | null;
  client_ruc: string | null;
  client_dni: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_district: string | null;
  client_province: string | null;
  client_department: string | null;
  seller_name: string | null;
  date: string;
  total: number;
  collected_amount: number;
  credit_notes_amount: number;
  net_collected: number;
  already_commissioned: boolean;
  commissioned_to: string | null;
}

export interface ComisionPedidoResumen {
  order_id: number;
  code: string | null;
  date: string | null;
  total: number | null;
  net_collected: number | null;
  client_business_name: string | null;
  client_name: string | null;
  client_ruc: string | null;
  client_dni: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_district: string | null;
  client_province: string | null;
  client_department: string | null;
}

export interface ComisionReturn {
  id: number;
  direction: 'to_company' | 'to_seller';
  amount: number;
  form: string;
  status: string;
  operation_number: string | null;
  operation_date: string | null;
  operation_time: string | null;
  cash_settled: boolean;
  voucher_url: string | null;
  received_by_name: string | null;
}

export interface Comision {
  id: number;
  user_id: number;
  user_name: string | null;
  created_by: number;
  created_by_name: string | null;
  date_from: string;
  date_to: string;
  destination: string | null;
  zonas: ComisionZona[];
  tramos: ComisionTramo[];
  purpose: string | null;
  budget: number | null;
  notes: string | null;
  status: ComisionStatus;
  gastos_count: number;
  gastos_total: number;
  created_at: string;
  advance: ComisionAdvance;
  return: ComisionReturn | null;
  total_ventas: number | null;
  total_comision: number | null;
  payment: ComisionPayment;
  resumen_financiero: ComisionResumenFinanciero;
  ventas_resumen: ComisionVentasResumen | null;
  gastos?: GastoResumen[];
  pedidos?: ComisionPedidoResumen[];
}

export const COMISION_STATUS: Record<ComisionStatus, { label: string; color: string }> = {
  open:   { label: 'Abierta', color: 'success' },
  closed: { label: 'Cerrada', color: 'secondary' },
};

export interface ComisionZonaInput {
  zone_type: 'department' | 'province' | 'district';
  department_id?: number | null;
  province_id?: number | null;
  district_id?: number | null;
  label?: string;
}

export interface ComisionBudgetAdjustment {
  id: number;
  type: 'increase' | 'decrease';
  amount: number;
  form: 'cash' | 'deposit' | null;
  bank_name: string | null;
  payment_method_name: string | null;
  operation_number: string | null;
  operation_date: string | null;
  operation_time: string | null;
  voucher_url: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  return_id: number | null;
  return_status: string | null;
  return_form: string | null;
  return_cash_settled: boolean | null;
}
