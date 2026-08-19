import { Component, OnInit, HostListener, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BadgeComponent, CardBodyComponent, CardComponent, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { SaleZonesService } from '../sale-zones.service';
import { ComisionService } from '../../comisiones/comision.service';
import { UserService } from '../../users/user.service';
import { UserItem } from '../../users/user.model';
import {
  UserSaleZone, UserZoneConfig, ZoneClient, ZoneClientException,
  ClientSearchItem, UserZoneOverview,
} from '../sale-zones.model';
import { GeographyService, Department, Province, District, GeoSearchResult } from '../../../core/services/geography.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ZoneMapComponent } from '../zone-map/zone-map.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-sale-zones-list',
  standalone: true,
  imports: [
    FormsModule, Select,
    CardComponent, CardBodyComponent, BadgeComponent, SpinnerComponent,
    PageHeaderComponent, ZoneMapComponent, ConfirmModalComponent,
  ],
  templateUrl: './sale-zones-list.component.html',
  styleUrl:    './sale-zones-list.component.scss',
})
export class SaleZonesListComponent implements OnInit {

  // ── Responsive map height ─────────────────────────────────────────────────
  mapHeight = signal(this.calcMapHeight());

  @HostListener('window:resize')
  onResize() { this.mapHeight.set(this.calcMapHeight()); }

  private calcMapHeight(): string {
    return window.innerWidth < 992 ? '280px' : '560px';
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  activeTab = signal<'config' | 'overview'>('config');

  // ── Global ────────────────────────────────────────────────────────────────
  users          = signal<UserItem[]>([]);
  zonesEnabled   = signal(false);
  togglingGlobal = signal(false);
  loadingUsers   = signal(false);

  // ── Vendedor seleccionado ─────────────────────────────────────────────────
  selectedUserId = signal<number | null>(null);
  config         = signal<UserZoneConfig | null>(null);
  loadingConfig  = signal(false);
  togglingAll    = signal(false);

  // ── Geografía ─────────────────────────────────────────────────────────────
  departments  = signal<Department[]>([]);
  provinces    = signal<Province[]>([]);
  districts    = signal<District[]>([]);
  loadingDepts = signal(false);
  loadingProvs = signal(false);
  loadingDists = signal(false);

  // ── Búsqueda global de geo (buscador rápido) ─────────────────────────────
  geoSearchQuery   = signal('');
  geoSearchResults = signal<GeoSearchResult[]>([]);
  geoSearchLoading = signal(false);
  private geoSearchTimeout: any = null;
  private pendingProvNav: number | null = null;
  private pendingDistNav: number | null = null;

  // ── Búsqueda en los paneles ───────────────────────────────────────────────
  deptSearch = signal('');
  provSearch = signal('');
  distSearch = signal('');

  filteredDepts = computed(() => {
    const s = this.deptSearch().toLowerCase();
    return s ? this.departments().filter(d => d.name.toLowerCase().includes(s)) : this.departments();
  });
  filteredProvs = computed(() => {
    const s = this.provSearch().toLowerCase();
    return s ? this.provinces().filter(p => p.name.toLowerCase().includes(s)) : this.provinces();
  });
  filteredDists = computed(() => {
    const s = this.distSearch().toLowerCase();
    return s ? this.districts().filter(d => d.name.toLowerCase().includes(s)) : this.districts();
  });

  // ── Selector jerárquico 3 paneles ─────────────────────────────────────────
  navDeptId      = signal<number | null>(null);
  navProvId      = signal<number | null>(null);

  // ── Navegación del mapa de cobertura (independiente del tab config) ────────
  overviewNavDeptId  = signal<number | null>(null);
  overviewProvinces  = signal<Province[]>([]);
  pendingDistIds = signal<Set<number>>(new Set());
  savingZone     = signal(false);
  addingBatch    = signal(false);

  // Pre-check dept/prov
  preCheckConflicts = signal<string[]>([]);
  checkingConflicts = signal(false);
  private checkTimeout: any = null;

  // Conflictos en distritos pendientes
  pendingDistrictConflicts = computed<string[]>(() => {
    const result = new Set<string>();
    for (const id of this.pendingDistIds()) {
      this.distAssignments().get(id)?.forEach(v => result.add(v));
    }
    return [...result];
  });

  // ── Panel clientes ────────────────────────────────────────────────────────
  expandedZoneId     = signal<number | null>(null);
  zoneClientsMap     = signal<Map<number, ZoneClient[]>>(new Map());
  loadingZoneClients = signal(false);
  activeZoneTab      = signal<'active' | 'blocked'>('active');
  zoneClientSearch   = signal('');

  // ── Acceso especial ───────────────────────────────────────────────────────
  clientSearch        = signal('');
  clientResults       = signal<ClientSearchItem[]>([]);
  clientSearchLoading = signal(false);
  addingException     = signal(false);
  private searchTimeout: any = null;

  // ── Cobertura ─────────────────────────────────────────────────────────────
  overview        = signal<UserZoneOverview[]>([]);
  loadingOverview = signal(false);
  expandedOverviewUserId = signal<number | null>(null);

  // ── Mapas de asignación (incluye bubble-up desde zonas hija) ─────────────
  deptAssignments = signal<Map<number, string[]>>(new Map());
  provAssignments = signal<Map<number, string[]>>(new Map());
  distAssignments = signal<Map<number, string[]>>(new Map());

  // Mapas de zonas exactas (para bubble-down)
  private deptZoneVendors = signal<Map<number, string[]>>(new Map());
  private provZoneVendors = signal<Map<number, string[]>>(new Map());

  // ── Zonas propias del usuario actual (para colorear en verde en el mapa) ──
  /** IDs de departamentos con zona exacta de dpto del usuario seleccionado */
  selfDeptIds = computed<Set<number>>(() => {
    const zones = this.config()?.zones ?? [];
    return new Set(zones.filter(z => z.zone_type === 'department').map(z => z.department_id!));
  });

  /** IDs de provincias con zona exacta de provincia del usuario seleccionado */
  selfProvIds = computed<Set<number>>(() => {
    const zones = this.config()?.zones ?? [];
    return new Set(zones.filter(z => z.zone_type === 'province').map(z => z.province_id!));
  });

  /** Deptos donde el usuario tiene sub-zonas pero NO zona exacta de dpto */
  selfPartialDeptIds = computed<Set<number>>(() => {
    const zones   = this.config()?.zones ?? [];
    const exactIds = this.selfDeptIds();
    return new Set(
      zones
        .filter(z => z.zone_type !== 'department' && z.department_id != null && !exactIds.has(z.department_id))
        .map(z => z.department_id!),
    );
  });

  /** Provincias donde el usuario tiene distritos sueltos pero NO zona exacta de provincia ni de dpto */
  selfPartialProvIds = computed<Set<number>>(() => {
    const zones        = this.config()?.zones ?? [];
    const exactProvIds = this.selfProvIds();
    const exactDeptIds = this.selfDeptIds();
    return new Set(
      zones
        .filter(z =>
          z.zone_type === 'district' &&
          z.province_id != null &&
          !exactProvIds.has(z.province_id) &&
          (z.department_id == null || !exactDeptIds.has(z.department_id)),
        )
        .map(z => z.province_id!),
    );
  });

  /** Nombre del usuario seleccionado para mostrarlo en el mapa */
  get selfUserName(): string | null {
    return this.selectedUser?.name ?? null;
  }

  /** true si el vendedor seleccionado tiene una Comisión abierta — sus zonas quedan congeladas. */
  get isLocked(): boolean {
    return !!this.config()?.locked;
  }

  constructor(
    private svc: SaleZonesService,
    private userSvc: UserService,
    private geoSvc: GeographyService,
    private comisionSvc: ComisionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadUsers();
    this.loadDepts();
    this.loadOverview();
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  setTab(tab: 'config' | 'overview'): void {
    this.activeTab.set(tab);
  }

  // ── Global ────────────────────────────────────────────────────────────────

  loadSettings(): void {
    this.svc.settings().subscribe({ next: r => this.zonesEnabled.set(r.sale_zones_enabled) });
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.userSvc.listUsers({ permission: 'quotations', per_page: 100 }).subscribe({
      next: res => {
        this.users.set(res.data.filter(u => !u.deleted_at && u.active));
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false),
    });
  }

  // Si se va a desactivar y hay comisiones abiertas, se avisa antes: a partir de ese momento
  // las ventas en las zonas de esos vendedores dejan de generar comisión.
  confirmDisableGlobal = signal(false);
  openComisionesCount  = signal(0);

  toggleGlobal(): void {
    if (this.togglingGlobal()) return;
    if (this.zonesEnabled()) {
      this.togglingGlobal.set(true);
      this.comisionSvc.index({ status: 'open', per_page: 1 }).subscribe({
        next: r => {
          this.togglingGlobal.set(false);
          if (r.total > 0) {
            this.openComisionesCount.set(r.total);
            this.confirmDisableGlobal.set(true);
          } else {
            this.doToggleGlobal(false);
          }
        },
        error: () => { this.togglingGlobal.set(false); this.doToggleGlobal(false); },
      });
      return;
    }
    this.doToggleGlobal(true);
  }

  confirmDisableGlobalProceed(): void {
    this.confirmDisableGlobal.set(false);
    this.doToggleGlobal(false);
  }

  private doToggleGlobal(enabled: boolean): void {
    this.togglingGlobal.set(true);
    this.svc.updateSettings(enabled).subscribe({
      next: res => {
        this.zonesEnabled.set(res.sale_zones_enabled);
        this.toast.success(res.message);
        this.togglingGlobal.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error.');
        this.togglingGlobal.set(false);
      },
    });
  }

  // ── Vendedor ──────────────────────────────────────────────────────────────

  onUserChange(id: number | null): void {
    this.selectedUserId.set(id);
    this.resetZoneState();
    this.buildAssignmentMaps();
    if (!id) return;
    this.loadConfig(id);
  }

  get selectedUser(): UserItem | null {
    const id = this.selectedUserId();
    return this.users().find(u => u.id === id) ?? null;
  }

  private loadConfig(userId: number): void {
    this.loadingConfig.set(true);
    this.svc.getUserZones(userId).subscribe({
      next: r => { this.config.set(r); this.loadingConfig.set(false); },
      error: () => this.loadingConfig.set(false),
    });
  }

  private resetZoneState(): void {
    this.config.set(null);
    this.expandedZoneId.set(null);
    this.zoneClientsMap.set(new Map());
    this.clientSearch.set('');
    this.clientResults.set([]);
    this.clientSearchLoading.set(false);
    this.navDeptId.set(null);
    this.navProvId.set(null);
    this.pendingDistIds.set(new Set());
    this.provinces.set([]);
    this.districts.set([]);
    this.preCheckConflicts.set([]);
    this.deptSearch.set('');
    this.provSearch.set('');
    this.distSearch.set('');
    this.zoneClientSearch.set('');
    this.activeZoneTab.set('active');
  }

  // ── Toggle acceso completo ────────────────────────────────────────────────

  toggleAllowAll(): void {
    const id = this.selectedUserId();
    if (!id || this.togglingAll() || this.isLocked) return;
    this.togglingAll.set(true);
    this.svc.toggleAllowAll(id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.config.update(c => c ? { ...c, allow_all_clients: res.allow_all_clients } : c);
        this.togglingAll.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error.');
        this.togglingAll.set(false);
      },
    });
  }

  // ── Geografía ─────────────────────────────────────────────────────────────

  private loadDepts(): void {
    this.loadingDepts.set(true);
    this.geoSvc.departments().subscribe({
      next: r => { this.departments.set(r); this.loadingDepts.set(false); },
      error: () => this.loadingDepts.set(false),
    });
  }

  // ── Navegación mapa de cobertura ─────────────────────────────────────────

  selectOverviewDept(id: number): void {
    if (this.overviewNavDeptId() === id) return;
    this.overviewNavDeptId.set(id);
    this.overviewProvinces.set([]);
    this.loadingProvs.set(true);
    this.geoSvc.provinces(id).subscribe({
      next: r => {
        this.overviewProvinces.set(r);
        this.loadingProvs.set(false);
        // Bubble-down: vendedores con zona exacta de dpto → propagar a sus provincias
        const deptVendors = this.deptZoneVendors().get(id) ?? [];
        if (deptVendors.length) {
          this.provAssignments.update(m => {
            const nm = new Map(m);
            for (const p of r) {
              const arr = [...new Set([...(nm.get(p.id) ?? []), ...deptVendors])];
              nm.set(p.id, arr);
            }
            return nm;
          });
        }
      },
      error: () => this.loadingProvs.set(false),
    });
  }

  clearOverviewDept(): void {
    this.overviewNavDeptId.set(null);
    this.overviewProvinces.set([]);
  }

  // ── Navegación 3 paneles ──────────────────────────────────────────────────

  clearNavDept(): void {
    this.navDeptId.set(null);
    this.navProvId.set(null);
    this.pendingDistIds.set(new Set());
    this.provinces.set([]);
    this.districts.set([]);
    this.provSearch.set('');
    this.distSearch.set('');
    this.preCheckConflicts.set([]);
  }

  // ── Búsqueda rápida de geo ────────────────────────────────────────────────

  onGeoSearchChange(q: string): void {
    this.geoSearchQuery.set(q);
    clearTimeout(this.geoSearchTimeout);
    if (q.trim().length < 2) { this.geoSearchResults.set([]); return; }
    this.geoSearchLoading.set(true);
    this.geoSearchTimeout = setTimeout(() => {
      this.geoSvc.search(q.trim()).subscribe({
        next: r => { this.geoSearchResults.set(r); this.geoSearchLoading.set(false); },
        error: () => this.geoSearchLoading.set(false),
      });
    }, 350);
  }

  navigateToGeoResult(result: GeoSearchResult): void {
    this.geoSearchQuery.set('');
    this.geoSearchResults.set([]);
    if (result.type === 'province') {
      this.pendingProvNav = result.id;
      this.selectNavDept(result.department_id);
    } else {
      this.pendingProvNav  = result.province_id!;
      this.pendingDistNav  = result.id;
      this.selectNavDept(result.department_id);
    }
  }

  selectNavDept(id: number): void {
    if (this.navDeptId() === id) return;
    this.navDeptId.set(id);
    this.navProvId.set(null);
    this.pendingDistIds.set(new Set());
    this.provinces.set([]);
    this.districts.set([]);
    this.provSearch.set('');
    this.distSearch.set('');
    this.preCheckConflicts.set([]);
    this.loadingProvs.set(true);

    this.geoSvc.provinces(id).subscribe({
      next: r => {
        this.provinces.set(r);
        this.loadingProvs.set(false);
        // Bubble-down: vendedores con zona exacta de dpto → aparecen en todas sus provincias
        const deptVendors = this.deptZoneVendors().get(id) ?? [];
        if (deptVendors.length) {
          this.provAssignments.update(m => {
            const nm = new Map(m);
            for (const p of r) {
              const arr = [...new Set([...(nm.get(p.id) ?? []), ...deptVendors])];
              nm.set(p.id, arr);
            }
            return nm;
          });
        }
        // Navegación pendiente desde el buscador rápido
        if (this.pendingProvNav != null) {
          const provId = this.pendingProvNav;
          this.pendingProvNav = null;
          setTimeout(() => this.selectNavProv(provId), 0);
        }
      },
      error: () => this.loadingProvs.set(false),
    });

    this.schedulePreCheck('department', id, null, null);
  }

  selectNavProv(id: number): void {
    if (this.navProvId() === id) return;
    this.navProvId.set(id);
    this.pendingDistIds.set(new Set());
    this.districts.set([]);
    this.distSearch.set('');
    this.preCheckConflicts.set([]);
    this.loadingDists.set(true);

    this.geoSvc.districts(id).subscribe({
      next: r => {
        this.districts.set(r);
        this.loadingDists.set(false);
        // Bubble-down: vendedores con zona exacta de prov o de su dpto → aparecen en todos sus distritos
        const provVendors = this.provZoneVendors().get(id) ?? [];
        const deptVendors = this.deptZoneVendors().get(this.navDeptId()!) ?? [];
        const toAdd = [...new Set([...provVendors, ...deptVendors])];
        if (toAdd.length) {
          this.distAssignments.update(m => {
            const nm = new Map(m);
            for (const d of r) {
              const arr = [...new Set([...(nm.get(d.id) ?? []), ...toAdd])];
              nm.set(d.id, arr);
            }
            return nm;
          });
        }
        // Navegación pendiente de distrito desde el buscador rápido
        if (this.pendingDistNav != null) {
          const distId = this.pendingDistNav;
          this.pendingDistNav = null;
          // Resaltar el distrito haciendo scroll al elemento
          setTimeout(() => {
            const el = document.getElementById(`dist-${distId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      },
      error: () => this.loadingDists.set(false),
    });

    this.schedulePreCheck('province', null, id, null);
  }

  togglePendingDist(distId: number): void {
    this.pendingDistIds.update(s => {
      const ns = new Set(s);
      ns.has(distId) ? ns.delete(distId) : ns.add(distId);
      return ns;
    });
  }

  private schedulePreCheck(
    type: 'department' | 'province' | 'district',
    deptId: number | null, provId: number | null, distId: number | null,
  ): void {
    clearTimeout(this.checkTimeout);
    this.checkTimeout = setTimeout(() => {
      this.checkingConflicts.set(true);
      this.svc.checkZone({
        zone_type: type, department_id: deptId, province_id: provId,
        district_id: distId, exclude_user_id: this.selectedUserId(),
      }).subscribe({
        next: res => { this.preCheckConflicts.set(res.conflicts); this.checkingConflicts.set(false); },
        error: () => this.checkingConflicts.set(false),
      });
    }, 400);
  }

  // ── Agregar zonas ─────────────────────────────────────────────────────────

  addDeptZone(): void {
    const deptId = this.navDeptId();
    const userId = this.selectedUserId();
    if (!deptId || !userId || this.savingZone() || this.isLocked) return;
    this.savingZone.set(true);
    this.svc.addZone(userId, { zone_type: 'department', department_id: deptId }).subscribe({
      next: res => {
        // Agregar zona de dpto y limpiar zonas de provincia/distrito del mismo dpto
        this.config.update(c => c ? { ...c, zones: [...c.zones, res.zone] } : c);

        const subZoneIds = (this.config()?.zones ?? [])
          .filter(z => z.department_id === deptId && z.zone_type !== 'department')
          .map(z => z.id);

        const finish = () => {
          this.savingZone.set(false);
          const name = this.departments().find(d => d.id === deptId)?.name ?? '';
          this.toast.success(`Zona de departamento — ${name} asignada.`);
          this.loadOverview();
        };

        if (subZoneIds.length) {
          this.removeZonesSequentially(userId, subZoneIds, finish);
        } else {
          finish();
        }
      },
      error: (err: any) => {
        this.toast.error(err.error?.errors
          ? Object.values(err.error.errors).flat().join(' ')
          : err.error?.message ?? 'Error.');
        this.savingZone.set(false);
      },
    });
  }

  addProvZone(): void {
    const provId = this.navProvId();
    const userId = this.selectedUserId();
    if (!provId || !userId || this.savingZone() || this.isLocked) return;
    this.savingZone.set(true);
    this.svc.addZone(userId, { zone_type: 'province', province_id: provId }).subscribe({
      next: res => {
        // Agregar zona de provincia y limpiar distritos sueltos de esa provincia
        this.config.update(c => c ? { ...c, zones: [...c.zones, res.zone] } : c);

        const subZoneIds = (this.config()?.zones ?? [])
          .filter(z => z.province_id === provId && z.zone_type === 'district')
          .map(z => z.id);

        const finish = () => {
          this.savingZone.set(false);
          this.loadOverview();
          // Auto-promoción: si todas las provincias del dpto quedan cubiertas → promover a dpto
          this.tryPromoteToDept();
        };

        if (subZoneIds.length) {
          this.removeZonesSequentially(userId, subZoneIds, finish);
        } else {
          finish();
        }
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error.');
        this.savingZone.set(false);
      },
    });
  }

  addPendingDistricts(): void {
    const userId = this.selectedUserId();
    if (!userId || this.addingBatch() || this.isLocked) return;
    const ids = [...this.pendingDistIds()];
    if (!ids.length) return;
    this.addingBatch.set(true);

    const addNext = (i: number) => {
      if (i >= ids.length) {
        // Todos los distritos guardados → intentar promoción automática
        const promoted = this.tryPromoteDistrictsToProvince();
        if (!promoted) {
          this.addingBatch.set(false);
          this.pendingDistIds.set(new Set());
          this.toast.success(`${ids.length} ${ids.length === 1 ? 'distrito agregado' : 'distritos agregados'}.`);
          this.loadOverview();
        }
        return;
      }
      this.svc.addZone(userId, { zone_type: 'district', district_id: ids[i] }).subscribe({
        next: res => {
          this.config.update(c => c ? { ...c, zones: [...c.zones, res.zone] } : c);
          addNext(i + 1);
        },
        error: (err: any) => {
          const msg: string = err.error?.message ?? '';
          if (!msg.toLowerCase().includes('ya está asignada')) {
            this.toast.error(msg || 'Error al agregar distrito.');
          }
          addNext(i + 1);
        },
      });
    };
    addNext(0);
  }

  removeZone(zone: UserSaleZone): void {
    const id = this.selectedUserId();
    if (!id || this.isLocked) return;
    this.svc.removeZone(id, zone.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.config.update(c => c ? { ...c, zones: c.zones.filter(z => z.id !== zone.id) } : c);
        if (this.expandedZoneId() === zone.id) {
          this.expandedZoneId.set(null);
          this.zoneClientSearch.set('');
          this.activeZoneTab.set('active');
        }
        this.loadOverview();
      },
      error: (err: any) => this.toast.error(err.error?.message ?? 'Error.'),
    });
  }

  // ── Helpers para operaciones en serie ─────────────────────────────────────

  /** Elimina zonas por ID una a una y ejecuta onDone al terminar. */
  private removeZonesSequentially(userId: number, zoneIds: number[], onDone: () => void): void {
    if (!zoneIds.length) { onDone(); return; }
    const [first, ...rest] = zoneIds;
    this.svc.removeZone(userId, first).subscribe({
      next: () => {
        this.config.update(c => c ? { ...c, zones: c.zones.filter(z => z.id !== first) } : c);
        this.removeZonesSequentially(userId, rest, onDone);
      },
      error: () => this.removeZonesSequentially(userId, rest, onDone),
    });
  }

  /** Agrega zonas en serie y ejecuta onDone al terminar. */
  private addZonesSequentially(
    userId: number,
    items: Array<{ zone_type: 'department' | 'province' | 'district'; department_id?: number; province_id?: number; district_id?: number }>,
    onDone: () => void,
  ): void {
    if (!items.length) { onDone(); return; }
    const [first, ...rest] = items;
    this.svc.addZone(userId, first).subscribe({
      next: res => {
        this.config.update(c => c ? { ...c, zones: [...c.zones, res.zone] } : c);
        this.addZonesSequentially(userId, rest, onDone);
      },
      error: () => this.addZonesSequentially(userId, rest, onDone),
    });
  }

  // ── Auto-promoción: distritos → provincia ────────────────────────────────

  /**
   * Si todos los distritos de la provincia actual tienen zona exacta,
   * los consolida en 1 zona de provincia. Retorna true si inició la promoción.
   */
  private tryPromoteDistrictsToProvince(): boolean {
    const provId = this.navProvId();
    const dists  = this.districts();
    if (!provId || !dists.length) return false;

    const zones   = this.config()!.zones;
    const distIds = new Set(dists.map(d => d.id));
    const allExact = dists.every(d => zones.some(z => z.zone_type === 'district' && z.district_id === d.id));
    if (!allExact) return false;

    // Todos cubiertos → reemplazar por zona de provincia
    const userId    = this.selectedUserId()!;
    const toRemove  = zones.filter(z => z.zone_type === 'district' && distIds.has(z.district_id!)).map(z => z.id);

    this.removeZonesSequentially(userId, toRemove, () => {
      this.svc.addZone(userId, { zone_type: 'province', province_id: provId }).subscribe({
        next: res => {
          this.config.update(c => c ? {
            ...c,
            zones: [...c.zones.filter(z => !distIds.has(z.district_id ?? -1)), res.zone],
          } : c);
          this.pendingDistIds.set(new Set());
          this.addingBatch.set(false);
          const name = this.provinces().find(p => p.id === provId)?.name ?? '';
          this.toast.success(`Zona consolidada: provincia de ${name}`);
          this.loadOverview();
          this.tryPromoteToDept();
        },
        error: () => this.addingBatch.set(false),
      });
    });
    return true;
  }

  // ── Auto-promoción: provincias → departamento ─────────────────────────────

  /**
   * Si todas las provincias del departamento actual tienen zona exacta de provincia,
   * las consolida en 1 zona de departamento.
   */
  private tryPromoteToDept(): void {
    const deptId = this.navDeptId();
    const provs  = this.provinces();
    if (!deptId || !provs.length) return;

    const zones   = this.config()!.zones;
    const provIds = new Set(provs.map(p => p.id));

    // Ya hay zona de dpto → nada que hacer
    if (zones.some(z => z.zone_type === 'department' && z.department_id === deptId)) return;

    // Todas las provincias deben tener zona exacta de provincia
    const allExact = provs.every(p => zones.some(z => z.zone_type === 'province' && z.province_id === p.id));
    if (!allExact) return;

    const userId   = this.selectedUserId()!;
    const toRemove = zones.filter(z => z.zone_type === 'province' && provIds.has(z.province_id!)).map(z => z.id);

    this.removeZonesSequentially(userId, toRemove, () => {
      this.svc.addZone(userId, { zone_type: 'department', department_id: deptId }).subscribe({
        next: res => {
          this.config.update(c => c ? {
            ...c,
            zones: [...c.zones.filter(z => !provIds.has(z.province_id ?? -1)), res.zone],
          } : c);
          const name = this.departments().find(d => d.id === deptId)?.name ?? '';
          this.toast.success(`Zona consolidada: departamento de ${name}`);
          this.loadOverview();
        },
      });
    });
  }

  // ── Auto-expansión: provincia → distritos (quitar 1 distrito) ───────────

  /** Expande zona de provincia en distritos individuales, excluyendo excludeDistId. */
  private demoteProvinceToDistricts(excludeDistId: number): void {
    const userId  = this.selectedUserId()!;
    const provId  = this.navProvId()!;
    const zones   = this.config()!.zones;
    const provZone = zones.find(z => z.zone_type === 'province' && z.province_id === provId);
    if (!provZone) return;

    this.savingZone.set(true);
    this.removeZonesSequentially(userId, [provZone.id], () => {
      const toAdd = this.districts()
        .filter(d => d.id !== excludeDistId)
        .map(d => ({ zone_type: 'district' as const, district_id: d.id }));

      this.addZonesSequentially(userId, toAdd, () => {
        this.savingZone.set(false);
        const name = this.provinces().find(p => p.id === provId)?.name ?? '';
        this.toast.success(`Provincia ${name} expandida en distritos.`);
        this.loadOverview();
      });
    });
  }

  // ── Auto-expansión: departamento → provincias + distritos ─────────────────

  /** Expande zona de departamento: deja provincias individuales y excluye un distrito. */
  private demoteDeptToProvincesAndDistricts(excludeDistId: number): void {
    const userId  = this.selectedUserId()!;
    const deptId  = this.navDeptId()!;
    const provId  = this.navProvId()!;
    const zones   = this.config()!.zones;
    const deptZone = zones.find(z => z.zone_type === 'department' && z.department_id === deptId);
    if (!deptZone) return;

    this.savingZone.set(true);
    this.removeZonesSequentially(userId, [deptZone.id], () => {
      const provItems = this.provinces()
        .filter(p => p.id !== provId)
        .map(p => ({ zone_type: 'province' as const, province_id: p.id }));

      const distItems = this.districts()
        .filter(d => d.id !== excludeDistId)
        .map(d => ({ zone_type: 'district' as const, district_id: d.id }));

      this.addZonesSequentially(userId, [...provItems, ...distItems], () => {
        this.savingZone.set(false);
        this.toast.success('Departamento expandido. Distrito excluido.');
        this.loadOverview();
      });
    });
  }

  /** Expande zona de departamento en provincias individuales, excluyendo una provincia. */
  removeDeptIntoProvinces(excludeProvId: number): void {
    const userId   = this.selectedUserId()!;
    const deptId   = this.navDeptId()!;
    const zones    = this.config()!.zones;
    const deptZone = zones.find(z => z.zone_type === 'department' && z.department_id === deptId);
    if (!deptZone || this.savingZone() || this.isLocked) return;

    this.savingZone.set(true);
    this.removeZonesSequentially(userId, [deptZone.id], () => {
      const toAdd = this.provinces()
        .filter(p => p.id !== excludeProvId)
        .map(p => ({ zone_type: 'province' as const, province_id: p.id }));

      this.addZonesSequentially(userId, toAdd, () => {
        this.savingZone.set(false);
        const name = this.provinces().find(p => p.id === excludeProvId)?.name ?? '';
        this.toast.success(`Provincia ${name} excluida del departamento.`);
        this.loadOverview();
      });
    });
  }

  // ── Auto-mark: zonas de zona padre cubren hijos ───────────────────────────

  isDeptAssignedToCurrentUser(deptId: number): boolean {
    return this.config()?.zones.some(z =>
      z.zone_type === 'department' && z.department_id === deptId
    ) ?? false;
  }

  isDeptExactlyAssigned(deptId: number): boolean {
    return this.isDeptAssignedToCurrentUser(deptId);
  }

  /** El usuario tiene alguna zona dentro del depto pero NO zona exacta del depto */
  isDeptPartiallyAssigned(deptId: number): boolean {
    const zones = this.config()?.zones ?? [];
    if (zones.some(z => z.zone_type === 'department' && z.department_id === deptId)) return false;
    return zones.some(z => z.department_id === deptId);
  }

  isProvAssignedToCurrentUser(provId: number): boolean {
    const zones = this.config()?.zones ?? [];
    if (zones.some(z => z.zone_type === 'province' && z.province_id === provId)) return true;
    const prov = this.provinces().find(p => p.id === provId);
    return !!prov && zones.some(z => z.zone_type === 'department' && z.department_id === prov.department_id);
  }

  isProvExactlyAssigned(provId: number): boolean {
    return this.config()?.zones.some(z =>
      z.zone_type === 'province' && z.province_id === provId
    ) ?? false;
  }

  /** El usuario tiene distritos en esta provincia pero NO zona exacta de la provincia */
  isProvPartiallyAssigned(provId: number): boolean {
    const zones = this.config()?.zones ?? [];
    if (zones.some(z => z.zone_type === 'province' && z.province_id === provId)) return false;
    return zones.some(z => z.zone_type === 'district' && z.province_id === provId);
  }

  isDistAssignedToCurrentUser(distId: number): boolean {
    const zones = this.config()?.zones ?? [];
    if (zones.some(z => z.zone_type === 'district' && z.district_id === distId)) return true;
    const dist = this.districts().find(d => d.id === distId);
    if (!dist) return false;
    if (zones.some(z => z.zone_type === 'province' && z.province_id === dist.province_id)) return true;
    const prov = this.provinces().find(p => p.id === dist.province_id);
    return !!prov && zones.some(z => z.zone_type === 'department' && z.department_id === prov.department_id);
  }

  isDistExactlyAssigned(distId: number): boolean {
    return this.config()?.zones.some(z =>
      z.zone_type === 'district' && z.district_id === distId
    ) ?? false;
  }

  removeDeptZone(): void {
    const zone = this.config()?.zones.find(
      z => z.zone_type === 'department' && z.department_id === this.navDeptId()
    );
    if (zone) this.removeZone(zone);
  }

  removeProvZone(): void {
    const zone = this.config()?.zones.find(
      z => z.zone_type === 'province' && z.province_id === this.navProvId()
    );
    if (zone) this.removeZone(zone);
  }

  toggleDistZone(distId: number): void {
    if (this.isLocked) return;
    if (this.isDistExactlyAssigned(distId)) {
      // Tiene zona exacta → quitar
      const zone = this.config()?.zones.find(z => z.zone_type === 'district' && z.district_id === distId);
      if (zone) this.removeZone(zone);
    } else if (this.isDistAssignedToCurrentUser(distId)) {
      // Cubierto por zona padre → expander (demote)
      const zones  = this.config()?.zones ?? [];
      const provId = this.navProvId();
      const covByProv = provId && zones.some(z => z.zone_type === 'province' && z.province_id === provId);
      if (covByProv) {
        this.demoteProvinceToDistricts(distId);
      } else {
        this.demoteDeptToProvincesAndDistricts(distId);
      }
    } else {
      // No asignado → alternar pendiente
      this.togglePendingDist(distId);
    }
  }

  // ── Panel clientes ────────────────────────────────────────────────────────

  toggleZoneClients(zone: UserSaleZone): void {
    if (this.expandedZoneId() === zone.id) {
      this.expandedZoneId.set(null);
      this.zoneClientSearch.set('');
      this.activeZoneTab.set('active');
      return;
    }
    this.expandedZoneId.set(zone.id);
    this.zoneClientSearch.set('');
    this.activeZoneTab.set('active');
    if (this.zoneClientsMap().has(zone.id)) return;
    const id = this.selectedUserId();
    if (!id) return;
    this.loadingZoneClients.set(true);
    this.svc.zoneClients(id, zone.id).subscribe({
      next: res => {
        this.zoneClientsMap.update(m => { const nm = new Map(m); nm.set(zone.id, res.clients); return nm; });
        this.loadingZoneClients.set(false);
      },
      error: () => this.loadingZoneClients.set(false),
    });
  }

  allClientsForZone(zoneId: number): ZoneClient[] {
    return this.zoneClientsMap().get(zoneId) ?? [];
  }

  filteredClientsForZone(zoneId: number): ZoneClient[] {
    const tab    = this.activeZoneTab();
    const search = this.zoneClientSearch().toLowerCase().trim();
    return this.allClientsForZone(zoneId)
      .filter(c => tab === 'blocked' ? c.blocked : !c.blocked)
      .filter(c => {
        if (!search) return true;
        return [c.business_name, c.person_name, c.ruc, c.dni, c.phone]
          .some(v => v?.toLowerCase().includes(search));
      });
  }

  activeCount(zoneId: number):  number { return this.allClientsForZone(zoneId).filter(c => !c.blocked).length; }
  blockedCount(zoneId: number): number { return this.allClientsForZone(zoneId).filter(c => c.blocked).length; }

  toggleBlockClient(zoneId: number, client: ZoneClient): void {
    const id = this.selectedUserId();
    if (!id) return;
    if (client.blocked) {
      this.svc.removeException(id, client.id).subscribe({
        next: res => {
          this.toast.success(res.message);
          this.updateZoneClient(zoneId, client.id, false);
          this.config.update(c => c ? { ...c, exceptions: c.exceptions.filter(e => e.client_id !== client.id) } : c);
        },
        error: (err: any) => this.toast.error(err.error?.message ?? 'Error.'),
      });
    } else {
      this.svc.addException(id, client.id, 'block').subscribe({
        next: res => {
          this.toast.success(res.message);
          this.updateZoneClient(zoneId, client.id, true);
          this.config.update(c => c ? { ...c, exceptions: [...c.exceptions, res.exception] } : c);
        },
        error: (err: any) => this.toast.error(err.error?.message ?? 'Error.'),
      });
    }
  }

  private updateZoneClient(zoneId: number, clientId: number, blocked: boolean): void {
    this.zoneClientsMap.update(m => {
      const nm   = new Map(m);
      const list = (nm.get(zoneId) ?? []).map(c => c.id === clientId ? { ...c, blocked } : c);
      nm.set(zoneId, list);
      return nm;
    });
  }

  // ── Excepciones ───────────────────────────────────────────────────────────

  onClientSearchChange(val: string): void {
    clearTimeout(this.searchTimeout);
    this.clientSearch.set(val);
    if (!val.trim()) {
      this.clientResults.set([]);
      this.clientSearchLoading.set(false);
      return;
    }
    this.clientSearchLoading.set(true);
    this.searchTimeout = setTimeout(() => {
      this.svc.searchClients(val).subscribe({
        next: res => {
          const existing = new Set(this.config()?.exceptions.map(e => e.client_id) ?? []);
          this.clientResults.set(res.data.filter(c => !existing.has(c.id)));
          this.clientSearchLoading.set(false);
        },
        error: () => this.clientSearchLoading.set(false),
      });
    }, 300);
  }

  addAllowException(client: ClientSearchItem): void {
    const id = this.selectedUserId();
    if (!id || this.addingException()) return;
    this.addingException.set(true);
    this.svc.addException(id, client.id, 'allow').subscribe({
      next: res => {
        this.toast.success(res.message);
        this.config.update(c => c ? { ...c, exceptions: [...c.exceptions, res.exception] } : c);
        this.clientSearch.set('');
        this.clientResults.set([]);
        this.addingException.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error.');
        this.addingException.set(false);
      },
    });
  }

  removeAllowException(exc: ZoneClientException): void {
    const id = this.selectedUserId();
    if (!id) return;
    this.svc.removeException(id, exc.client_id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.config.update(c => c ? { ...c, exceptions: c.exceptions.filter(e => e.client_id !== exc.client_id) } : c);
      },
      error: (err: any) => this.toast.error(err.error?.message ?? 'Error.'),
    });
  }

  get allowExceptions(): ZoneClientException[] {
    return this.config()?.exceptions.filter(e => e.type === 'allow') ?? [];
  }

  // ── Cobertura ─────────────────────────────────────────────────────────────

  loadOverview(): void {
    this.loadingOverview.set(true);
    this.svc.overview().subscribe({
      next: res => {
        this.overview.set(res.users);
        this.loadingOverview.set(false);
        this.buildAssignmentMaps();
      },
      error: () => this.loadingOverview.set(false),
    });
  }

  private buildAssignmentMaps(): void {
    const excludeId = this.selectedUserId();
    const dMap  = new Map<number, string[]>();
    const pMap  = new Map<number, string[]>();
    const diMap = new Map<number, string[]>();
    // Mapas para bubble-down (solo zonas exactas de ese nivel)
    const dExact = new Map<number, string[]>();
    const pExact = new Map<number, string[]>();

    const add = (map: Map<number, string[]>, id: number, name: string) => {
      const arr = map.get(id) ?? [];
      if (!arr.includes(name)) arr.push(name);
      map.set(id, arr);
    };

    for (const usr of this.overview()) {
      if (usr.user_id === excludeId) continue;
      for (const z of usr.zones) {
        // Bubble-up: zona de distrito agrega al dpto y prov padre
        if (z.department_id != null) add(dMap,  z.department_id, usr.user_name);
        if (z.province_id   != null) add(pMap,  z.province_id,   usr.user_name);
        if (z.district_id   != null) add(diMap, z.district_id,   usr.user_name);
        // Exactos para bubble-down
        if (z.zone_type === 'department' && z.department_id != null) add(dExact, z.department_id, usr.user_name);
        if (z.zone_type === 'province'   && z.province_id   != null) add(pExact, z.province_id,   usr.user_name);
      }
    }

    this.deptAssignments.set(dMap);
    this.provAssignments.set(pMap);
    this.distAssignments.set(diMap);
    this.deptZoneVendors.set(dExact);
    this.provZoneVendors.set(pExact);

    // Re-aplicar bubble-down a paneles ya cargados
    this.applyBubbleDownToLoadedPanels();
  }

  private applyBubbleDownToLoadedPanels(): void {
    const deptId = this.navDeptId();
    if (!deptId) return;
    const deptVendors = this.deptZoneVendors().get(deptId) ?? [];
    if (deptVendors.length && this.provinces().length) {
      this.provAssignments.update(m => {
        const nm = new Map(m);
        for (const p of this.provinces()) {
          const arr = [...new Set([...(nm.get(p.id) ?? []), ...deptVendors])];
          nm.set(p.id, arr);
        }
        return nm;
      });
    }
    const provId = this.navProvId();
    if (!provId) return;
    const provVendors = this.provZoneVendors().get(provId) ?? [];
    const toAdd = [...new Set([...provVendors, ...deptVendors])];
    if (toAdd.length && this.districts().length) {
      this.distAssignments.update(m => {
        const nm = new Map(m);
        for (const d of this.districts()) {
          const arr = [...new Set([...(nm.get(d.id) ?? []), ...toAdd])];
          nm.set(d.id, arr);
        }
        return nm;
      });
    }
  }

  toggleOverviewUser(userId: number): void {
    this.expandedOverviewUserId.set(
      this.expandedOverviewUserId() === userId ? null : userId
    );
  }

  get hasAnyConflict(): boolean {
    return this.overview().some(u => u.zones.some(z => z.shared_with.length > 0));
  }

  userHasZoneConflict(usr: UserZoneOverview): boolean {
    return usr.zones.some(z => z.shared_with.length > 0);
  }

  get totalUsersWithZones(): number { return this.overview().filter(u => u.zones.length > 0).length; }
  get totalZonesAssigned(): number  { return this.overview().reduce((s, u) => s + u.zones.length, 0); }
  get totalWithConflicts(): number  { return this.overview().filter(u => this.userHasZoneConflict(u)).length; }

  // ── Helpers ───────────────────────────────────────────────────────────────

  zoneBadgeColor(type: string): string {
    return type === 'department' ? 'primary' : type === 'province' ? 'info' : 'success';
  }

  zoneBadgeLabel(type: string): string {
    return type === 'department' ? 'Dpto.' : type === 'province' ? 'Prov.' : 'Dist.';
  }
}
