export interface PurchaseOrderItem {
  id?: number;
  product_id: number;
  product_name?: string | null;
  product_laboratory?: string | null;
  expected_quantity: number;
  bonus_quantity?: number;
  received_quantity?: number;
  validated_bonus_quantity?: number;
  pending_received_quantity?: number;
  pending_received_bonus_quantity?: number;
  unit_cost: number;
  expected_lot?: string | null;
  expected_expiry_date?: string | null;
  notes?: string | null;
}

export interface PurchaseOrder {
  id: number;
  code: string;
  supplier: { id: number; name: string; ruc: string | null } | null;
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
  all_pending_covered?: boolean;
  expected_date: string | null;
  subtotal: string;
  notes: string | null;
  items?: PurchaseOrderItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderPayload {
  supplier_id: number;
  expected_date?: string | null;
  notes?: string | null;
  items: {
    product_id: number;
    expected_quantity: number;
    bonus_quantity?: number;
    unit_cost: number;
    expected_lot?: string | null;
    expected_expiry_date?: string | null;
    notes?: string | null;
  }[];
}

export interface PurchaseReceiptItem {
  id?: number;
  product_id: number;
  product_name?: string | null;
  product_laboratory?: string | null;
  lot_id?: number | null;       // resuelto al validar
  lot_number?: string | null;   // ingresado en formulario
  expiry_date?: string | null;  // ingresado en formulario
  quantity: number;
  bonus_quantity?: number;
  unit_cost: number;
  notes?: string | null;
}

export interface PurchaseReceipt {
  id: number;
  code: string;
  purchase_order_id: number | null;
  supplier: { id: number; name: string } | null;
  document_type: 'invoice' | 'guide' | 'note';
  document_number: string | null;
  document_date: string | null;
  due_date: string | null;
  payment_condition: string | null;
  currency: string;
  subtotal: string;
  status: 'pending' | 'validated';
  notes: string | null;
  document_file_url?: string | null;
  items?: PurchaseReceiptItem[];
  created_by: string | null;
  created_at: string;
}

export interface PurchaseReceiptPayload {
  purchase_order_id?: number | null;
  supplier_id: number;
  document_type: 'invoice' | 'guide' | 'note';
  document_number?: string | null;
  document_date?: string | null;
  due_date?: string | null;
  payment_condition?: string | null;
  currency?: string;
  notes?: string | null;
  items: {
    product_id: number;
    lot_number?: string | null;
    expiry_date?: string | null;
    quantity: number;
    bonus_quantity?: number;
    unit_cost: number;
    notes?: string | null;
  }[];
}

export interface PatchReceiptDocumentPayload {
  document_type: 'invoice' | 'guide' | 'note';
  document_number?: string | null;
  document_date?: string | null;
  due_date?: string | null;
  payment_condition?: string | null;
  currency?: string;
  notes?: string | null;
}

export const PAYMENT_CONDITION_LABELS: Partial<Record<string, string>> = {
  contado:    'Contado',
  credito_7:  'Crédito 7 días',
  credito_15: 'Crédito 15 días',
  credito_30: 'Crédito 30 días',
  credito_60: 'Crédito 60 días',
  credito_90: 'Crédito 90 días',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft:     'Borrador',
  sent:      'Enviado',
  partial:   'Parcial',
  received:  'Recibido',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  draft:     'secondary',
  sent:      'info',
  partial:   'warning',
  received:  'success',
  cancelled: 'danger',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  invoice: 'Factura',
  guide:   'Guía',
  note:    'Nota',
};

// ── Analytics ─────────────────────────────────────────────────────────────

export interface TopSoldProduct {
  product_id: number;
  product_name: string;
  product_laboratory?: string | null;
  sku: string | null;
  total_sold: number;
  current_stock: number;
  min_stock: number;
  needs_reorder: boolean;
  last_cost: string | null;
  last_supplier: string | null;
}

export interface LowStockProduct {
  product_id: number;
  product_name: string;
  product_laboratory?: string | null;
  sku: string | null;
  current_stock: number;
  min_stock: number;
  last_cost: string | null;
  last_supplier: string | null;
}

export interface SupplierCostEntry {
  supplier_id: number | null;
  supplier_name: string;
  cost_price: string;
  date: string;
  source: string;
  notes: string | null;
}

export interface PurchaseAnalytics {
  top_sold: TopSoldProduct[];
  low_stock: LowStockProduct[];
  supplier_comparison: SupplierCostEntry[];
}
