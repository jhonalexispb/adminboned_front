export interface ViaticoCategoryItem {
  id: number;
  name: string;
}

export interface CategorySummaryRow {
  category: string;
  qty: number;
  total: string | number;
}

export interface CategoryUserSummaryRow extends CategorySummaryRow {
  user_id: number;
  user_name: string | null;
}

export interface ViaticoCategoriesSummary {
  categories: ViaticoCategoryItem[];
  by_category: CategorySummaryRow[];
  by_category_user: CategoryUserSummaryRow[];
}
