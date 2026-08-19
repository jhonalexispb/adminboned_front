export interface CatalogRequestItem {
  id: number;
  product_id: number;
  product_name: string | null;
  product_sku: string | null;
  product_image_url: string | null;
  product_laboratory: string | null;
  quantity_requested: number;
  quantity_available: number | null;
  item_status: 'pending' | 'available' | 'partial' | 'unavailable';
  unit_price: string;
  subtotal: string;
  reason: string | null;
}

export interface CatalogRequest {
  id: number;
  code: string;
  client: { id: number; name: string; business_name: string; ruc: string | null; phone: string | null } | null;
  status: 'draft' | 'pending_review' | 'needs_client_action' | 'ready_to_convert' | 'converted' | 'cancelled';
  subtotal: string;
  total: string;
  client_notes: string | null;
  seller_notes: string | null;
  quotation_id: number | null;
  items?: CatalogRequestItem[];
  created_at: string;
  updated_at: string;
}

export const CATALOG_REQUEST_STATUS_LABELS: Record<string, string> = {
  draft:               'Carrito sin enviar',
  pending_review:      'Por revisar',
  needs_client_action: 'Requiere acción del cliente',
  ready_to_convert:    'Listo para convertir',
  converted:           'Convertido',
  cancelled:           'Cancelado',
};

export const CATALOG_REQUEST_STATUS_COLORS: Record<string, string> = {
  draft:               'light',
  pending_review:      'secondary',
  needs_client_action: 'warning',
  ready_to_convert:    'info',
  converted:           'success',
  cancelled:           'danger',
};

export const CATALOG_ITEM_STATUS_LABELS: Record<string, string> = {
  pending:     'Pendiente',
  available:   'Disponible',
  partial:     'Parcial',
  unavailable: 'Sin stock',
};

export const CATALOG_ITEM_STATUS_COLORS: Record<string, string> = {
  pending:     'secondary',
  available:   'success',
  partial:     'warning',
  unavailable: 'danger',
};
