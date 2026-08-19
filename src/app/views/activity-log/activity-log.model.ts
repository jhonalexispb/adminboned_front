export interface ActivityLog {
  id: number;
  log_name: string;
  description: string;
  subject_type: string | null;
  subject_type_label: string | null;
  subject_id: number | null;
  subject_label: string | null;
  causer_type: string | null;
  causer_id: number | null;
  causer: { id: number; name: string } | null;
  event: string | null;
  properties: {
    attributes?: Record<string, unknown>;
    old?: Record<string, unknown>;
  };
  created_at: string;
}

export interface SubjectType {
  value: string;
  label: string;
}

export interface CauserUser {
  id: number;
  name: string;
}
