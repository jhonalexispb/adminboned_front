export interface UserSaleZone {
  id: number;
  zone_type: 'department' | 'province' | 'district';
  department_id: number | null;
  province_id: number | null;
  district_id: number | null;
  label: string;
}

export interface ZoneClientException {
  client_id:       number;
  client_name:     string;
  ruc:             string | null;
  dni:             string | null;
  phone:           string | null;
  address:         string | null;
  district_name:   string | null;
  province_name:   string | null;
  department_name: string | null;
  type:            'block' | 'allow';
}

export interface UserZoneConfig {
  allow_all_clients: boolean;
  zones: UserSaleZone[];
  exceptions: ZoneClientException[];
  /** true si el vendedor tiene una Comisión abierta — sus zonas quedan congeladas hasta que se cierre. */
  locked: boolean;
  locked_until: string | null;
}

export interface ZoneClient {
  id: number;
  business_name: string | null;
  person_name: string | null;
  ruc: string | null;
  dni: string | null;
  phone: string | null;
  address: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  blocked: boolean;
}

export interface ZoneWithConflicts extends UserSaleZone {
  shared_with: string[];
}

export interface UserZoneOverview {
  user_id: number;
  user_name: string;
  zones: ZoneWithConflicts[];
}

export interface ClientSearchItem {
  id:            number;
  business_name: string | null;
  name:          string | null;
  ruc:           string | null;
  dni:           string | null;
  phone:         string | null;
  address:       string | null;
  district: {
    id:   number;
    name: string;
    province: {
      id:   number;
      name: string;
      department: { id: number; name: string } | null;
    } | null;
  } | null;
}
