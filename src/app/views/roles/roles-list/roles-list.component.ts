import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent,
  CardHeaderComponent, SpinnerComponent,
} from '@coreui/angular';
import { UserService, RoleWithPermissions } from '../../users/user.service';
import { roleLabel, roleColor } from '../../users/user.model';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

// Agrupa permisos por prefijo de módulo
export interface PermissionGroup {
  label: string;
  permissions: string[];
}

const PERMISSION_LABELS: Record<string, string> = {
  dashboard:          'Dashboard',
  trends:             'Tendencias',
  catalog_analytics:  'Analítica del catálogo',
  products:           'Productos',
  categories:         'Categorías',
  laboratories:       'Laboratorios',
  catalog_order:      'Orden de catálogo',
  catalog_appearance: 'Apariencia catálogo',
  suppliers:          'Proveedores',
  clients:            'Clientes',
  carriers:           'Transportistas',
  banks:              'Bancos',
  stock:              'Stock',
  lots:               'Lotes',
  reservations:       'Reservas',
  kardex:             'Kardex',
  purchase_analytics: 'Análisis de compras',
  purchase_orders:    'Órdenes de compra',
  purchase_receipts:  'Recepciones',
  purchase_documents: 'Documentos de ingreso',
  catalog_requests:   'Pedidos de catálogo',
  quotations:         'Cotizaciones',
  quotations_manage:  'Supervisar cotizaciones',
  orders:             'Pedidos',
  orders_warehouse:   'Almacén',
  orders_dispatch:    'Despacho',
  collections:        'Cobranza',
  my_collections:     'Mis cobros',
  payments_manage:    'Gestionar pagos',
  returns:            'Mis devoluciones',
  returns_manage:     'Gestionar devoluciones',
  documents:          'Documentos emitidos',
  expenses:           'Gastos',
  users:              'Usuarios',
  roles:              'Roles y permisos',
  geography:          'Geografía',
  sale_zones:         'Zonas de venta',
  settings:           'Mi empresa',
  viaticos:           'Mis viáticos',
  viaticos_manage:    'Gestionar viáticos',
  comisiones:         'Comisiones',
  seguimiento:        'Seguimiento',
  bank_operations:    'Operaciones bancarias',
  document_audit:     'Auditoría de documentos',
};

const SECTION_GROUPS: { label: string; permissions: string[] }[] = [
  { label: 'Reportes',      permissions: ['dashboard', 'trends', 'catalog_analytics'] },
  { label: 'Maestros',      permissions: ['products', 'categories', 'laboratories', 'catalog_order', 'catalog_appearance', 'suppliers', 'clients', 'carriers', 'banks'] },
  { label: 'Inventario',    permissions: ['stock', 'lots', 'reservations', 'kardex'] },
  { label: 'Compras',       permissions: ['purchase_analytics', 'purchase_orders', 'purchase_receipts', 'purchase_documents'] },
  { label: 'Ventas',        permissions: ['catalog_requests', 'quotations', 'quotations_manage', 'orders', 'orders_warehouse', 'orders_dispatch'] },
  { label: 'Pagos',         permissions: ['collections', 'my_collections', 'payments_manage'] },
  { label: 'Post-venta',    permissions: ['returns', 'returns_manage', 'documents'] },
  { label: 'Finanzas',      permissions: ['expenses'] },
  { label: 'Campo',         permissions: ['viaticos', 'viaticos_manage', 'comisiones', 'seguimiento'] },
  { label: 'Auditoría',     permissions: ['bank_operations', 'document_audit'] },
  { label: 'Configuración', permissions: ['users', 'roles', 'geography', 'sale_zones', 'settings'] },
];

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, SpinnerComponent, ButtonDirective,
    PageHeaderComponent, ConfirmModalComponent,
  ],
  templateUrl: './roles-list.component.html',
})
export class RolesListComponent implements OnInit {
  roles       = signal<RoleWithPermissions[]>([]);
  allPerms    = signal<string[]>([]);
  loading     = signal(false);
  saving      = signal<number | null>(null);

  activeRole  = signal<RoleWithPermissions | null>(null);
  draftPerms  = signal<Set<string>>(new Set());

  deletingRole = signal<RoleWithPermissions | null>(null);

  renamingRole  = signal<RoleWithPermissions | null>(null);
  renameValue   = '';
  savingRename  = signal(false);

  showNewRoleForm = signal(false);
  newRoleName     = '';
  savingNew       = signal(false);

  readonly roleLabel = (name: string, display?: string) => roleLabel(name, display);
  readonly roleColor = roleColor;
  readonly permLabel = (p: string) => PERMISSION_LABELS[p] ?? p;

  permGroups = computed<PermissionGroup[]>(() => {
    const available = new Set(this.allPerms());
    return SECTION_GROUPS
      .map(g => ({ label: g.label, permissions: g.permissions.filter(p => available.has(p)) }))
      .filter(g => g.permissions.length > 0);
  });

  constructor(
    private svc: UserService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.rolesManage().subscribe({
      next: res => {
        this.roles.set(res.roles);
        this.allPerms.set(res.permissions);
        this.loading.set(false);
        if (res.roles.length) this.selectRole(res.roles[0]);
      },
      error: () => this.loading.set(false),
    });
  }

  selectRole(role: RoleWithPermissions): void {
    this.activeRole.set(role);
    this.draftPerms.set(new Set(role.permissions));
  }

  togglePerm(perm: string): void {
    this.draftPerms.update(s => {
      const next = new Set(s);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
  }

  hasPerm(perm: string): boolean {
    return this.draftPerms().has(perm);
  }

  isDirty(): boolean {
    const role = this.activeRole();
    if (!role) return false;
    const current = new Set(role.permissions);
    const draft   = this.draftPerms();
    if (current.size !== draft.size) return true;
    for (const p of draft) if (!current.has(p)) return true;
    return false;
  }

  saveRole(): void {
    const role = this.activeRole();
    if (!role || !this.isDirty()) return;
    this.saving.set(role.id);
    this.svc.updateRole(role.id, [...this.draftPerms()]).subscribe({
      next: res => {
        this.saving.set(null);
        this.toast.success(res.message);
        this.roles.update(list => list.map(r => r.id === res.role.id ? res.role : r));
        this.activeRole.set(res.role);
        this.draftPerms.set(new Set(res.role.permissions));
      },
      error: (err: any) => {
        this.saving.set(null);
        this.toast.error(err.error?.message ?? 'Error al guardar.');
      },
    });
  }

  createRole(): void {
    if (!this.newRoleName.trim()) return;
    this.savingNew.set(true);
    this.svc.createRole({ display_name: this.newRoleName.trim(), permissions: [] }).subscribe({
      next: res => {
        this.savingNew.set(false);
        this.toast.success(res.message);
        this.roles.update(list => [...list, res.role]);
        this.newRoleName = '';
        this.showNewRoleForm.set(false);
        this.selectRole(res.role);
      },
      error: (err: any) => {
        this.savingNew.set(false);
        this.toast.error(err.error?.message ?? 'Error al crear rol.');
      },
    });
  }

  startRename(role: RoleWithPermissions): void {
    this.renamingRole.set(role);
    this.renameValue = role.name;
  }

  cancelRename(): void {
    this.renamingRole.set(null);
    this.renameValue = '';
  }

  doRename(): void {
    const role = this.renamingRole();
    if (!role || !this.renameValue.trim()) return;
    this.savingRename.set(true);
    this.svc.renameRole(role.id, this.renameValue.trim()).subscribe({
      next: res => {
        this.savingRename.set(false);
        this.toast.success(res.message);
        this.roles.update(list => list.map(r => r.id === res.role.id ? res.role : r));
        if (this.activeRole()?.id === res.role.id) {
          this.activeRole.set(res.role);
          this.draftPerms.set(new Set(res.role.permissions));
        }
        this.renamingRole.set(null);
        this.renameValue = '';
      },
      error: (err: any) => {
        this.savingRename.set(false);
        this.toast.error(err.error?.message ?? 'Error al renombrar.');
      },
    });
  }

  confirmDeleteRole(role: RoleWithPermissions): void {
    this.deletingRole.set(role);
  }

  doDeleteRole(): void {
    const role = this.deletingRole();
    if (!role) return;
    this.svc.deleteRole(role.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.deletingRole.set(null);
        const updated = this.roles().filter(r => r.id !== role.id);
        this.roles.set(updated);
        if (updated.length) this.selectRole(updated[0]);
        else this.activeRole.set(null);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.deletingRole.set(null);
      },
    });
  }
}
