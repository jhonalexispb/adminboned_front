export interface CategoryOrderItem {
  id: number;
  name: string;
  sort_order: number;
}

export interface CategoryOrderResponse {
  has_override: boolean;
  categories: CategoryOrderItem[];
}

export interface GroupProduct {
  id: number;
  name: string;
  sku: string | null;
  sort_order: number;
  primary_image_url: string | null;
}
