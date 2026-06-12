export interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  deleted_at: string | null;
  roles: string[];
  created_at: string;
}

export interface RoleOption {
  id: number;
  name: string;
  display_name: string;
}

export const ROLE_LABEL: Record<string, string> = {
  super_admin:   'Super Admin',
  admin:         'Administrador',
  vendedor:      'Vendedor',
  almacen:       'Almacén',
  transportista: 'Transportista',
};

export const ROLE_COLOR: Record<string, string> = {
  super_admin:   'danger',
  admin:         'primary',
  vendedor:      'success',
  almacen:       'warning',
  transportista: 'info',
};

export function roleLabel(name: string, displayName?: string): string {
  if (displayName) return displayName;
  return ROLE_LABEL[name] ?? name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function roleColor(name: string): string {
  return ROLE_COLOR[name] ?? 'secondary';
}
