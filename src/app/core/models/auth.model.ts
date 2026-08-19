export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  active: boolean;
  tracking_enabled: boolean;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
