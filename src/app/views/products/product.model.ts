export interface ProductImage {
  id: number;
  url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface PriceTier {
  id?: number;
  min_quantity: number;
  price: number;
  active: boolean;
}

export interface CostHistory {
  id: number;
  cost_price: string;
  source: string;
  user: string | null;
  notes: string | null;
  created_at: string;
}

export interface LotInfo {
  id: number;
  lot_number: string;
  expiry_date: string | null;
  stock: number;
  reserved_stock: number;
  available_stock: number;
}

export interface Product {
  id: number;
  sku: string | null;
  name: string;
  description: string | null;
  category: { id: number; name: string; sort_order?: number; color?: string | null } | null;
  laboratory: { id: number; name: string; sort_order?: number; logo_url?: string | null; banner_url?: string | null } | null;
  base_price: string;
  cost_price: string | null;
  tracks_lot: boolean;
  tracks_expiry: boolean;
  min_stock: number;
  igv_type: 'gravado' | 'exonerado' | 'inafecto';
  active: boolean;
  sort_order: number;
  primary_image_url?: string | null;
  lots_info?: {
    count: number;
    total_stock: number;
    available_stock: number;
    nearest_expiry: { lot_number: string; expiry_date: string; stock: number } | null;
    lots: LotInfo[];
  } | null;
  images: ProductImage[];
  price_tiers: PriceTier[];
  cost_history: CostHistory[];
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryEntry {
  id: number;
  type: 'sale' | 'cost';
  date: string;
  price: string;
  source: string;
  supplier_id?: number | null;
  supplier?: string | null;
  tiers_snapshot?: { min_quantity: number; price: string; active: boolean }[] | null;
  notes: string | null;
  user: string | null;
}

export interface SalesMonthly {
  month: string;
  units: number;
  revenue: number;
}

export interface SalesAnalysis {
  monthly: SalesMonthly[];
  summary: {
    units_30d: number;
    units_90d: number;
    revenue_90d: number;
    avg_price_90d: number | null;
    current_stock: number;
    avg_monthly_units: number;
    rotation_months: number | null;
    last_sale_date: string | null;
  };
}

export interface PricingData {
  product: {
    id: number;
    sku: string | null;
    name: string;
    base_price: string;
    cost_price: string | null;
    category: string | null;
    laboratory: string | null;
  };
  price_tiers: PriceTier[];
  price_history: PriceHistoryEntry[];
  cost_history: PriceHistoryEntry[];
  timeline: PriceHistoryEntry[];
  sales_analysis: SalesAnalysis;
}

export interface ProductImportSummary {
  total: number;
  created: number;
  updated: number;
  laboratories_created: string[];
  categories_created: string[];
  updated_products: string[];
  errors: { row: number; message: string }[];
}

export interface ProductPayload {
  sku?: string | null;
  name: string;
  description?: string | null;
  category_id: number;
  laboratory_id: number;
  base_price: number;
  cost_price?: number | null;
  tracks_lot?: boolean;
  tracks_expiry?: boolean;
  min_stock?: number;
  igv_type?: 'gravado' | 'exonerado' | 'inafecto';
  active?: boolean;
  price_tiers?: { min_quantity: number; price: number; active: boolean }[];
}
