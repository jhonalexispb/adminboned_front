export interface Expense {
  id: number;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  document_number: string | null;
  document_image_url: string | null;
  created_at: string;
}

export interface ExpenseCategoryItem {
  id: number;
  name: string;
}
