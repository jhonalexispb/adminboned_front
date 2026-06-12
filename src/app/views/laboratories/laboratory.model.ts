export interface Laboratory {
  id: number;
  name: string;
  description: string | null;
  logo: string | null;
  logo_url: string | null;
  banner: string | null;
  banner_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface LaboratoryPayload {
  name: string;
  description?: string | null;
  active?: boolean;
}
