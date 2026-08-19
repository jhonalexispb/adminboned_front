export interface TrackedUser {
  id: number;
  name: string;
}

export interface TrackingPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  time: string;
  description: string;
  subject_type_label: string;
}

export interface AssignedDistrict {
  id: number;
  name: string;
  province_id: number;
  province_name: string | null;
}

export interface DistrictCheck {
  assigned_districts: AssignedDistrict[];
}
