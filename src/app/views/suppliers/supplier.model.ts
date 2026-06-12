export interface Supplier {
  id: number;
  name: string;
  ruc: string | null;
  address: string | null;
  district: { id: number; name: string } | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  active: boolean;
  laboratories: { id: number; name: string }[];
  created_at: string;
}

export interface SupplierPayload {
  name: string;
  ruc?: string | null;
  address?: string | null;
  district_id?: number | null;
  phone?: string | null;
  email?: string | null;
  contact_name?: string | null;
  active?: boolean;
  laboratory_ids?: number[];
}
