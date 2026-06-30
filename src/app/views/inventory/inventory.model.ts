export interface StockItem {
  lot_id:          number;
  lot_number:      string | null;
  expiry_date:     string | null;
  is_default:      boolean;
  status:          'active' | 'blocked';
  quantity:        number;
  reserved_stock:  number;
  available_stock: number;
  product: {
    id:            number;
    sku:           string | null;
    name:          string;
    min_stock:     number;
    current_stock: number;
    tracks_lot:    boolean;
    tracks_expiry: boolean;
    laboratory:    { id: number; name: string } | null;
  };
}

export interface KardexEntry {
  id: number;
  product: { id: number; sku: string | null; name: string; laboratory: { id: number; name: string } | null } | null;
  lot: { id: number; lot_number: string | null; expiry_date: string | null; is_default: boolean } | null;
  movement_type: 'in' | 'out' | 'adjustment' | 'return';
  quantity: number;
  unit_cost: string | null;
  stock_after: number;
  reference_type: string | null;
  reference_id: number | null;
  reference_meta: {
    code: string;
    document_type: string;
    document_label: string;
    document_number: string | null;
  } | {
    order_id: number | null;
    order_code: string | null;
    document: {
      id: number;
      document_type: 'invoice' | 'receipt' | 'sale_note' | 'credit_note';
      full_number: string | null;
      status: string;
    } | null;
    seller: { id: number; name: string } | null;
  } | null;
  notes: string | null;
  user: { id: number; name: string } | null;
  created_at: string;
}

export interface Lot {
  id: number;
  product_id: number;
  product: { id: number; sku: string | null; name: string; laboratory: { id: number; name: string } | null } | null;
  lot_number: string | null;
  expiry_date: string | null;
  is_default: boolean;
  status: 'active' | 'blocked';
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  created_at: string;
}

export interface ActiveReservation {
  type:     'quotation' | 'order';
  id:       number;
  code:     string;
  status:   string;
  seller:   string;
  quantity: number;
  age_days: number;
}

export interface ReservationGroup {
  product_id:          number;
  product_sku:         string | null;
  product_name:        string;
  product_laboratory:  string | null;
  current_stock:   number;
  reserved_stock:  number;
  available_stock: number;
  oversold:        boolean;
  reservations:    ActiveReservation[];
}

export interface StockAlert {
  available_stock:        number;
  current_stock:          number;
  reserved_stock:         number;
  affected_reservations:  ActiveReservation[];
}

export interface AdjustmentReason {
  value: string;
  label: string;
}

export const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  { value: 'counting_error', label: 'Error de conteo' },
  { value: 'damage',         label: 'Daño / Merma' },
  { value: 'theft',          label: 'Robo' },
  { value: 'expiry',         label: 'Vencimiento' },
  { value: 'supplier_error', label: 'Error de proveedor' },
  { value: 'other',          label: 'Otro' },
];

export const MOVEMENT_LABELS: Record<string, string> = {
  in:         'Entrada',
  out:        'Salida',
  adjustment: 'Ajuste',
  return:     'Devolución',
};
