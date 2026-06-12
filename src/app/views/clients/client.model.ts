export interface Client {
  id: number;
  name: string;
  business_name: string;
  dni: string | null;
  ruc: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  district: {
    id: number;
    name: string;
    province?: { id: number; name: string; department?: { id: number; name: string } } | null;
  } | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  seller_assignment: {
    seller_id: number;
    seller_name: string | null;
    reason: string | null;
  } | null;
  created_at: string;
}

export type ClientOption = Client & { label: string; addressLabel: string | null; searchText: string };

export function toClientOption(c: Client): ClientOption {
  const label = [c.business_name, c.name, c.ruc || c.dni].filter(Boolean).join(' · ');
  const addressLabel = c.district
    ? [c.district.name, c.district.province?.name, c.district.province?.department?.name]
        .filter(Boolean).join(', ')
    : null;
  return { ...c, label, addressLabel, searchText: [label, c.address, addressLabel].filter(Boolean).join(' ') };
}

export interface ClientPayload {
  name: string;
  business_name?: string | null;
  dni?: string | null;
  ruc?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  district_id?: number | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean;
}
