export interface Expense {
  id: number;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  original_amount: number | null;
  document_number: string | null;
  document_image_url: string | null;
  comision_id: number | null;
  comision_destination: string | null;
  created_at: string;
}

export interface ExpenseCategoryItem {
  id: number;
  name: string;
}
