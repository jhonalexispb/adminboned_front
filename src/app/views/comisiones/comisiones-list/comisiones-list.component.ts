import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faPlus, faPencil, faTrash, faEye, faSpinner, faLock, faLockOpen,
  faCheck, faImage, faMoneyBillWave, faCircleCheck, faCircleXmark, faBuilding,
} from '@fortawesome/free-solid-svg-icons';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent,
  ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { ComisionService, ComisionFilters } from '../comision.service';
import {
  Comision, ComisionZona, ComisionZonaInput, ComisionTramoInput, ComisionBudgetAdjustment, COMISION_STATUS,
  PedidoCandidato, PedidoSinComisionar,
} from '../comision.model';
import { ComisionZonePickerComponent } from '../comision-zone-picker/comision-zone-picker.component';
import { SaleZonesService } from '../../sale-zones/sale-zones.service';
import { CollectionService } from '../../payments/collection.service';
import { BankPaymentMethod } from '../../payments/collection.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { FilePreviewModalComponent } from '../../../shared/components/file-preview-modal/file-preview-modal.component';
import { ToastService } from '../../../core/services/toast.service';

function round2(n: number): number { return Math.round(n * 100) / 100; }

type ClientDataFields = {
  client_business_name: string | null;
  client_name: string | null;
  client_ruc: string | null;
  client_dni: string | null;
  client_phone: string | null;
  client_district: string | null;
  client_province: string | null;
  client_department: string | null;
};

type ComisionFormShape = {
  user_id: number | null;
  date_from: string;
  date_to: string;
  destination: string;
  purpose: string;
  budget: number | null;
  notes: string;
};

type AdvanceFormShape = {
  form: 'cash' | 'deposit';
  amount: number | null; // solo se usa en el flujo de abono (budget/increase)
  payment_method_id: number | null;
  operation_number: string;
  operation_date: string;
  operation_time: string;
  notes: string;
};

@Component({
  selector: 'app-comisiones-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule,
    FaIconComponent, Select, BadgeComponent, ButtonDirective, TableDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    PageHeaderComponent, PaginationComponent, ConfirmModalComponent, FilePreviewModalComponent,
    ComisionZonePickerComponent,
  ],
  templateUrl: './comisiones-list.component.html',
})
export class ComisionesListComponent implements OnInit {
  items    = signal<Comision[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);

  activeTab = signal<'list' | 'sin-comisionar'>('list');
  sinComisionar        = signal<PedidoSinComisionar[]>([]);
  loadingSinComisionar = signal(false);
  sinComisionarFilters: { date_from: string; date_to: string } = {
    date_from: ComisionesListComponent.firstDayOfMonth(),
    date_to:   ComisionesListComponent.today(),
  };

  private static firstDayOfMonth(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }
  private static today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  sellers = signal<{ id: number; name: string }[]>([]);
  methods = signal<BankPaymentMethod[]>([]);

  expandedId   = signal<number | null>(null);
  expandedItem = signal<Comision | null>(null);
  loadingExpanded = signal(false);

  readonly STATUS = COMISION_STATUS;
  readonly faPlus = faPlus;
  readonly faPencil = faPencil;
  readonly faTrash = faTrash;
  readonly faEye = faEye;
  readonly faSpinner = faSpinner;
  readonly faLock = faLock;
  readonly faLockOpen = faLockOpen;
  readonly faCheck = faCheck;
  readonly faImage = faImage;
  readonly faMoneyBillWave = faMoneyBillWave;
  readonly faCircleCheck = faCircleCheck;
  readonly faCircleXmark = faCircleXmark;
  readonly faBuilding = faBuilding;

  private today      = new Date();
  private startMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);

  filters: ComisionFilters = {
    date_from: this.iso(this.startMonth),
    date_to:   this.iso(this.today),
    user_id:   null,
    status:    null,
    page:      1,
  };

  statusOptions = [
    { value: null,     label: 'Todos' },
    { value: 'open',   label: 'Abierta' },
    { value: 'closed', label: 'Cerrada' },
  ];

  sellerOptions = computed(() => [
    { value: null, label: 'Todos los vendedores' },
    ...this.sellers().map(s => ({ value: s.id, label: s.name })),
  ]);

  // ── Modal crear/editar ─────────────────────────────────────────────────────
  formModal   = signal(false);
  editingItem = signal<Comision | null>(null);
  savingForm  = signal(false);
  zonas       = signal<ComisionZonaInput[]>([]);
  tramos      = signal<ComisionTramoInput[]>([]);

  // Simulador de tramos: monto de prueba → % y comisión resultante (solo cálculo local).
  simulatedVentas: number | null = null;

  // Estado de Zonas de Venta para el vendedor seleccionado — sin esto activo, asignarle
  // zonas en la comisión no genera comisión real (el backend también lo valida).
  checkingSaleZones = signal(false);
  saleZonesGlobalOn = signal(true);
  sellerSeesAllClients = signal(false);
  fixingSaleZones = signal(false);
  get saleZonesActiveForSeller(): boolean {
    return this.saleZonesGlobalOn() && !this.sellerSeesAllClients();
  }

  form: ComisionFormShape = this.emptyForm();

  get isEditMode(): boolean { return !!this.editingItem(); }
  get advanceDelivered(): boolean { return this.editingItem()?.advance.status === 'delivered'; }

  // ── Confirmar eliminar ────────────────────────────────────────────────────
  deletingItem = signal<Comision | null>(null);
  deleting     = signal(false);

  // ── Modal cerrar ──────────────────────────────────────────────────────────
  closeModal  = signal(false);
  closeTarget = signal<Comision | null>(null);
  closeReason = '';
  closing     = signal(false);
  loadingCandidatos = signal(false);
  cobrados    = signal<PedidoCandidato[]>([]);
  noCobrados  = signal<PedidoCandidato[]>([]);
  selectedOrderIds = signal<Set<number>>(new Set());
  pedidosTab = signal<'cobrados' | 'no_cobrados'>('cobrados');

  selectedOrders = computed(() =>
    this.cobrados().filter(o => this.selectedOrderIds().has(o.id))
  );
  selectedNetTotal = computed(() =>
    round2(this.selectedOrders().reduce((s, o) => s + o.net_collected, 0))
  );
  /** Simulación local con los mismos tramos de la comisión que se está cerrando. */
  closePreview = computed<{ percentage: number; comision: number } | null>(() => {
    const target = this.closeTarget();
    const monto = this.selectedNetTotal();
    if (!target || monto <= 0) return null;
    const aplicable = [...target.tramos]
      .filter(t => t.min_amount <= monto)
      .sort((a, b) => a.min_amount - b.min_amount)
      .at(-1);
    if (!aplicable) return null;
    return { percentage: aplicable.percentage, comision: round2(monto * aplicable.percentage / 100) };
  });

  // ── Reabrir ───────────────────────────────────────────────────────────────
  reopeningId = signal<number | null>(null);

  // ── Modal entregar viáticos ───────────────────────────────────────────────
  advanceModal  = signal(false);
  advanceTarget = signal<Comision | null>(null);
  advanceSaving = signal(false);
  advanceForm: AdvanceFormShape = this.emptyAdvanceForm();
  voucherFile: File | null = null;
  voucherPreview = signal<string | null>(null);

  // ── Modal pagar comisión ──────────────────────────────────────────────────
  payModal   = signal(false);
  payTarget  = signal<Comision | null>(null);
  paySaving  = signal(false);
  payForm: AdvanceFormShape = this.emptyAdvanceForm();
  payVoucherFile: File | null = null;
  payVoucherPreview = signal<string | null>(null);

  // ── Modal ajuste de presupuesto (abono / reducción) ──────────────────────
  budgetModal   = signal(false);
  budgetTarget  = signal<Comision | null>(null);
  budgetMode    = signal<'increase' | 'decrease'>('increase');
  budgetSaving  = signal(false);
  budgetForm: AdvanceFormShape & { decreaseAmount: number | null; decreaseNotes: string } = {
    ...this.emptyAdvanceForm(), decreaseAmount: null, decreaseNotes: '',
  };
  budgetVoucherFile: File | null = null;
  budgetVoucherPreview = signal<string | null>(null);
  budgetHistory = signal<ComisionBudgetAdjustment[]>([]);
  loadingBudgetHistory = signal(false);

  constructor(
    private svc: ComisionService,
    private paySvc: CollectionService,
    private saleZonesSvc: SaleZonesService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.svc.sellers().subscribe({ next: s => this.sellers.set(s) });
    this.paySvc.paymentMethods().subscribe({ next: m => this.methods.set(m) });
    // Se carga de una (no solo al entrar al tab) para que el número junto al tab avise sin tener que hacer clic.
    this.loadSinComisionar();
  }

  selectTab(tab: 'list' | 'sin-comisionar'): void {
    this.activeTab.set(tab);
  }

  loadSinComisionar(): void {
    this.loadingSinComisionar.set(true);
    this.svc.sinComisionar(this.sinComisionarFilters).subscribe({
      next: r => { this.sinComisionar.set(r.data); this.loadingSinComisionar.set(false); },
      error: () => this.loadingSinComisionar.set(false),
    });
  }

  zoneLabel(z: ComisionZona): string {
    return z.zone_type === 'department' ? `Dpto. ${z.department_name ?? '?'}`
      : z.zone_type === 'province' ? `Prov. ${z.province_name ?? '?'}`
      : `Dist. ${z.district_name ?? '?'}`;
  }

  load(): void {
    this.loading.set(true);
    this.svc.index(this.filters).subscribe({
      next: r => {
        this.items.set(r.data);
        this.total.set(r.total);
        this.lastPage.set(r.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPage(p: number): void { this.filters.page = p; this.load(); }
  applyFilters(): void { this.filters.page = 1; this.load(); }

  usagePercent(c: Comision): number {
    const adelanto = c.resumen_financiero.adelanto;
    if (!adelanto) return 0;
    const usado = c.resumen_financiero.aprobado + c.resumen_financiero.pendiente_revision;
    return Math.round((usado / adelanto) * 100);
  }

  // ── Ver detalle (modal) ──────────────────────────────────────────────────

  openDetail(c: Comision): void {
    this.expandedId.set(c.id);
    this.expandedItem.set(null);
    this.loadingExpanded.set(true);
    this.svc.get(c.id).subscribe({
      next: d => { this.expandedItem.set(d); this.loadingExpanded.set(false); },
      error: () => this.loadingExpanded.set(false),
    });
  }

  closeDetail(): void {
    this.expandedId.set(null);
    this.expandedItem.set(null);
  }

  private refreshExpanded(id: number): void {
    this.svc.get(id).subscribe({ next: d => this.expandedItem.set(d) });
  }

  // ── Crear / editar ────────────────────────────────────────────────────────

  openCreate(): void {
    this.editingItem.set(null);
    this.form = this.emptyForm();
    this.zonas.set([]);
    this.tramos.set([]);
    this.simulatedVentas = null;
    this.saleZonesGlobalOn.set(true);
    this.sellerSeesAllClients.set(false);
    this.formModal.set(true);
  }

  openEdit(c: Comision): void {
    this.editingItem.set(c);
    this.form = {
      user_id:     c.user_id,
      date_from:   c.date_from,
      date_to:     c.date_to,
      destination: c.destination ?? '',
      purpose:     c.purpose ?? '',
      budget:      c.budget,
      notes:       c.notes ?? '',
    };
    this.zonas.set(c.zonas.map(z => ({
      zone_type: z.zone_type, department_id: z.department_id, province_id: z.province_id,
      district_id: z.district_id,
      label: z.zone_type === 'department' ? `Dpto. ${z.department_name ?? '?'}`
        : z.zone_type === 'province' ? `Prov. ${z.province_name ?? '?'}`
        : `Dist. ${z.district_name ?? '?'}`,
    })));
    this.tramos.set(c.tramos.map(t => ({ min_amount: t.min_amount, percentage: t.percentage })));
    this.simulatedVentas = null;
    this.checkSaleZonesFor(c.user_id);
    this.formModal.set(true);
  }

  // ── Zonas de Venta del vendedor seleccionado ─────────────────────────────

  onSellerChange(): void {
    this.checkSaleZonesFor(this.form.user_id);
  }

  private checkSaleZonesFor(userId: number | null): void {
    if (!userId) { this.saleZonesGlobalOn.set(true); this.sellerSeesAllClients.set(false); return; }
    this.checkingSaleZones.set(true);
    this.saleZonesSvc.settings().subscribe({
      next: s => this.saleZonesGlobalOn.set(s.sale_zones_enabled),
      error: () => this.saleZonesGlobalOn.set(true),
    });
    this.saleZonesSvc.getUserZones(userId).subscribe({
      next: cfg => { this.sellerSeesAllClients.set(cfg.allow_all_clients); this.checkingSaleZones.set(false); },
      error: () => this.checkingSaleZones.set(false),
    });
  }

  activateSaleZonesGlobal(): void {
    if (this.fixingSaleZones()) return;
    this.fixingSaleZones.set(true);
    this.saleZonesSvc.updateSettings(true).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.saleZonesGlobalOn.set(true);
        this.fixingSaleZones.set(false);
      },
      error: err => { this.toast.error(err.error?.message ?? 'Error.'); this.fixingSaleZones.set(false); },
    });
  }

  activateSaleZonesForSeller(): void {
    const userId = this.form.user_id;
    if (!userId || this.fixingSaleZones()) return;
    this.fixingSaleZones.set(true);
    this.saleZonesSvc.toggleAllowAll(userId).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.sellerSeesAllClients.set(r.allow_all_clients);
        this.fixingSaleZones.set(false);
      },
      error: err => { this.toast.error(err.error?.message ?? 'Error.'); this.fixingSaleZones.set(false); },
    });
  }

  // ── Tramos de comisión ───────────────────────────────────────────────────

  addTramo(): void {
    this.tramos.update(list => [...list, { min_amount: null, percentage: null }]);
  }

  removeTramo(index: number): void {
    this.tramos.update(list => list.filter((_, i) => i !== index));
  }

  get tramosOrdenados(): ComisionTramoInput[] {
    return [...this.tramos()].sort((a, b) => (a.min_amount ?? 0) - (b.min_amount ?? 0));
  }

  get tramosDuplicados(): boolean {
    const montos = this.tramos().map(t => t.min_amount).filter((v): v is number => v != null);
    return new Set(montos).size !== montos.length;
  }

  /** Simulación puramente local: no llama al backend, solo aplica la misma regla de umbral. */
  get simulatedResult(): { percentage: number; comision: number } | null {
    const monto = this.simulatedVentas;
    if (monto == null || monto < 0) return null;
    const aplicable = this.tramosOrdenados
      .filter(t => t.min_amount != null && t.percentage != null && t.min_amount <= monto)
      .at(-1);
    if (!aplicable) return null;
    return { percentage: aplicable.percentage!, comision: round2(monto * aplicable.percentage! / 100) };
  }

  closeFormModal(): void {
    this.formModal.set(false);
    this.editingItem.set(null);
  }

  get isFormValid(): boolean {
    const tramosOk = this.tramos().every(t => t.min_amount != null && t.percentage != null) && !this.tramosDuplicados;
    return !!(this.form.user_id && this.form.date_from && this.form.date_to && this.form.date_to >= this.form.date_from && tramosOk);
  }

  saveForm(): void {
    if (!this.isFormValid || this.savingForm()) return;
    this.savingForm.set(true);

    const payload: any = {
      date_from:   this.form.date_from,
      date_to:     this.form.date_to,
      destination: this.form.destination || null,
      purpose:     this.form.purpose || null,
      budget:      this.form.budget,
      notes:       this.form.notes || null,
      zonas:       this.zonas().map(z => ({
        zone_type: z.zone_type, department_id: z.department_id ?? null,
        province_id: z.province_id ?? null, district_id: z.district_id ?? null,
      })),
      tramos:      this.tramos().map(t => ({ min_amount: t.min_amount, percentage: t.percentage })),
    };

    const editing = this.editingItem();
    if (!editing || !this.advanceDelivered) payload.user_id = this.form.user_id;
    if (editing && this.advanceDelivered) delete payload.budget;

    const op = editing ? this.svc.update(editing.id, payload) : this.svc.store(payload);
    op.subscribe({
      next: r => {
        this.toast.success(r.message);
        this.savingForm.set(false);
        this.closeFormModal();
        this.load();
        if (editing && this.expandedId() === editing.id) this.refreshExpanded(editing.id);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo guardar la comisión.');
        this.savingForm.set(false);
      },
    });
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  confirmDelete(c: Comision): void { this.deletingItem.set(c); }

  doDelete(): void {
    const c = this.deletingItem();
    if (!c || this.deleting()) return;
    this.deleting.set(true);
    this.svc.destroy(c.id).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.deleting.set(false);
        this.deletingItem.set(null);
        if (this.expandedId() === c.id) { this.expandedId.set(null); this.expandedItem.set(null); }
        this.load();
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo eliminar la comisión.');
        this.deleting.set(false);
        this.deletingItem.set(null);
      },
    });
  }

  // ── Cerrar ────────────────────────────────────────────────────────────────

  openClose(c: Comision): void {
    this.closeTarget.set(c);
    this.closeReason = '';
    this.cobrados.set([]);
    this.noCobrados.set([]);
    this.selectedOrderIds.set(new Set());
    this.pedidosTab.set('cobrados');
    this.closeModal.set(true);

    this.loadingCandidatos.set(true);
    this.svc.pedidosCandidatos(c.id).subscribe({
      next: r => {
        this.cobrados.set(r.cobrados);
        this.noCobrados.set(r.no_cobrados);
        // Preseleccionar los pedidos elegibles y aún libres — el admin puede desmarcar.
        this.selectedOrderIds.set(new Set(r.cobrados.filter(o => !o.already_commissioned).map(o => o.id)));
        this.loadingCandidatos.set(false);
      },
      error: () => this.loadingCandidatos.set(false),
    });
  }

  toggleOrder(id: number): void {
    this.selectedOrderIds.update(s => {
      const ns = new Set(s);
      ns.has(id) ? ns.delete(id) : ns.add(id);
      return ns;
    });
  }

  /** Nombre comercial (name), si existe y es distinto de la razón social — se muestra debajo. */
  clientTradeName(o: ClientDataFields): string | null {
    return o.client_name && o.client_name !== o.client_business_name ? o.client_name : null;
  }

  /** Línea de documento + teléfono, lo que haya disponible. */
  clientDetail(o: ClientDataFields): string {
    const parts: string[] = [];
    if (o.client_ruc) parts.push('RUC ' + o.client_ruc);
    else if (o.client_dni) parts.push('DNI ' + o.client_dni);
    if (o.client_phone) parts.push(o.client_phone);
    return parts.join(' · ');
  }

  /** Distrito · Provincia · Departamento del cliente. */
  clientLocation(o: ClientDataFields): string {
    return [o.client_district, o.client_province, o.client_department].filter(Boolean).join(' · ');
  }

  confirmClose(): void {
    const c = this.closeTarget();
    if (!c || this.closing()) return;
    this.closing.set(true);
    const orderIds = [...this.selectedOrderIds()];
    this.svc.close(c.id, this.closeReason || undefined, orderIds).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.closing.set(false);
        this.closeModal.set(false);
        this.closeTarget.set(null);
        this.load();
        if (this.expandedId() === c.id) this.refreshExpanded(c.id);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo cerrar la comisión.');
        this.closing.set(false);
      },
    });
  }

  // ── Reabrir ───────────────────────────────────────────────────────────────

  reopen(c: Comision): void {
    if (this.reopeningId()) return;
    this.reopeningId.set(c.id);
    this.svc.reopen(c.id).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.reopeningId.set(null);
        this.load();
        if (this.expandedId() === c.id) this.refreshExpanded(c.id);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo reabrir la comisión.');
        this.reopeningId.set(null);
      },
    });
  }

  // ── Entregar viáticos ─────────────────────────────────────────────────────

  openAdvance(c: Comision): void {
    this.advanceTarget.set(c);
    this.advanceForm = this.emptyAdvanceForm();
    this.voucherFile = null;
    this.voucherPreview.set(null);
    this.advanceModal.set(true);
  }

  closeAdvanceModal(): void {
    this.advanceModal.set(false);
    this.advanceTarget.set(null);
  }

  get advanceSelectedMethod(): BankPaymentMethod | null {
    if (!this.advanceForm.payment_method_id) return null;
    return this.methods().find(m => m.id === this.advanceForm.payment_method_id) ?? null;
  }

  get isAdvanceValid(): boolean {
    if (this.advanceForm.form === 'cash') return true;
    return !!(
      this.advanceForm.payment_method_id && this.advanceForm.operation_number &&
      this.advanceForm.operation_date && this.advanceForm.operation_time && this.voucherFile
    );
  }

  onVoucherSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.voucherFile = file;
    this.voucherPreview.set(null);
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.voucherPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  submitAdvance(): void {
    const c = this.advanceTarget();
    if (!c || !this.isAdvanceValid || this.advanceSaving()) return;
    this.advanceSaving.set(true);

    const fd = new FormData();
    fd.append('form', this.advanceForm.form);
    if (this.advanceForm.notes) fd.append('notes', this.advanceForm.notes);
    if (this.advanceForm.form === 'deposit') {
      fd.append('payment_method_id', String(this.advanceForm.payment_method_id!));
      fd.append('operation_number', this.advanceForm.operation_number);
      fd.append('operation_date', this.advanceForm.operation_date);
      fd.append('operation_time', this.advanceForm.operation_time);
      if (this.voucherFile) fd.append('voucher', this.voucherFile);
    }

    this.svc.deliverAdvance(c.id, fd).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.advanceSaving.set(false);
        this.closeAdvanceModal();
        this.load();
        if (this.expandedId() === c.id) this.refreshExpanded(c.id);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo registrar la entrega.');
        this.advanceSaving.set(false);
      },
    });
  }

  // ── Pagar comisión ────────────────────────────────────────────────────────

  openPay(c: Comision): void {
    this.payTarget.set(c);
    this.payForm = this.emptyAdvanceForm();
    this.payVoucherFile = null;
    this.payVoucherPreview.set(null);
    this.payModal.set(true);
  }

  closePayModal(): void {
    this.payModal.set(false);
    this.payTarget.set(null);
  }

  get paySelectedMethod(): BankPaymentMethod | null {
    if (!this.payForm.payment_method_id) return null;
    return this.methods().find(m => m.id === this.payForm.payment_method_id) ?? null;
  }

  get isPayValid(): boolean {
    if (this.payForm.form === 'cash') return true;
    return !!(
      this.payForm.payment_method_id && this.payForm.operation_number &&
      this.payForm.operation_date && this.payForm.operation_time && this.payVoucherFile
    );
  }

  onPayVoucherSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.payVoucherFile = file;
    this.payVoucherPreview.set(null);
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.payVoucherPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  submitPay(): void {
    const c = this.payTarget();
    if (!c || !this.isPayValid || this.paySaving()) return;
    this.paySaving.set(true);

    const fd = new FormData();
    fd.append('form', this.payForm.form);
    if (this.payForm.form === 'deposit') {
      fd.append('payment_method_id', String(this.payForm.payment_method_id!));
      fd.append('operation_number', this.payForm.operation_number);
      fd.append('operation_date', this.payForm.operation_date);
      fd.append('operation_time', this.payForm.operation_time);
      if (this.payVoucherFile) fd.append('voucher', this.payVoucherFile);
    }

    this.svc.pagarComision(c.id, fd).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.paySaving.set(false);
        this.closePayModal();
        this.load();
        if (this.expandedId() === c.id) this.refreshExpanded(c.id);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo registrar el pago.');
        this.paySaving.set(false);
      },
    });
  }

  // ── Ajuste de presupuesto ─────────────────────────────────────────────────

  openBudgetAdjust(c: Comision, mode: 'increase' | 'decrease'): void {
    this.budgetTarget.set(c);
    this.budgetMode.set(mode);
    this.budgetForm = { ...this.emptyAdvanceForm(), decreaseAmount: null, decreaseNotes: '' };
    this.budgetVoucherFile = null;
    this.budgetVoucherPreview.set(null);
    this.budgetModal.set(true);
    this.loadBudgetHistory(c.id);
  }

  closeBudgetModal(): void {
    this.budgetModal.set(false);
    this.budgetTarget.set(null);
  }

  loadBudgetHistory(id: number): void {
    this.loadingBudgetHistory.set(true);
    this.svc.budgetAdjustments(id).subscribe({
      next: r => { this.budgetHistory.set(r); this.loadingBudgetHistory.set(false); },
      error: () => this.loadingBudgetHistory.set(false),
    });
  }

  onBudgetVoucherSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.budgetVoucherFile = file;
    this.budgetVoucherPreview.set(null);
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.budgetVoucherPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  get budgetSelectedMethod(): BankPaymentMethod | null {
    if (!this.budgetForm.payment_method_id) return null;
    return this.methods().find(m => m.id === this.budgetForm.payment_method_id) ?? null;
  }

  get isBudgetIncreaseValid(): boolean {
    if (!this.budgetForm.amount || this.budgetForm.amount <= 0) return false;
    if (this.budgetForm.form === 'cash') return true;
    return !!(
      this.budgetForm.payment_method_id && this.budgetForm.operation_number &&
      this.budgetForm.operation_date && this.budgetForm.operation_time && this.budgetVoucherFile
    );
  }

  get isBudgetDecreaseValid(): boolean {
    return !!(this.budgetForm.decreaseAmount && this.budgetForm.decreaseAmount > 0);
  }

  submitBudgetIncrease(): void {
    const c = this.budgetTarget();
    if (!c || !this.isBudgetIncreaseValid || this.budgetSaving()) return;
    this.budgetSaving.set(true);

    const fd = new FormData();
    fd.append('amount', String(this.budgetForm.amount));
    fd.append('form', this.budgetForm.form);
    if (this.budgetForm.notes) fd.append('notes', this.budgetForm.notes);
    if (this.budgetForm.form === 'deposit') {
      fd.append('payment_method_id', String(this.budgetForm.payment_method_id!));
      fd.append('operation_number', this.budgetForm.operation_number);
      fd.append('operation_date', this.budgetForm.operation_date);
      fd.append('operation_time', this.budgetForm.operation_time);
      if (this.budgetVoucherFile) fd.append('voucher', this.budgetVoucherFile);
    }

    this.svc.increaseBudget(c.id, fd).subscribe({
      next: r => this.onBudgetAdjustSuccess(r.message, c.id),
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo registrar el abono.');
        this.budgetSaving.set(false);
      },
    });
  }

  submitBudgetDecrease(): void {
    const c = this.budgetTarget();
    if (!c || !this.isBudgetDecreaseValid || this.budgetSaving()) return;
    this.budgetSaving.set(true);

    this.svc.decreaseBudget(c.id, {
      amount: this.budgetForm.decreaseAmount!,
      notes: this.budgetForm.decreaseNotes || undefined,
    }).subscribe({
      next: r => this.onBudgetAdjustSuccess(r.message, c.id),
      error: err => {
        this.toast.error(err.error?.message ?? 'No se pudo registrar la reducción.');
        this.budgetSaving.set(false);
      },
    });
  }

  private onBudgetAdjustSuccess(message: string, id: number): void {
    this.toast.success(message);
    this.budgetSaving.set(false);
    this.closeBudgetModal();
    this.load();
    if (this.expandedId() === id) this.refreshExpanded(id);
  }

  isImage(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url);
  }

  private emptyForm(): ComisionFormShape {
    return {
      user_id: null, date_from: this.iso(this.today), date_to: this.iso(this.today),
      destination: '', purpose: '', budget: null, notes: '',
    };
  }

  private emptyAdvanceForm(): AdvanceFormShape {
    return {
      form: 'cash', amount: null, payment_method_id: null,
      operation_number: '', operation_date: this.iso(this.today), operation_time: '', notes: '',
    };
  }

  private iso(d: Date): string { return d.toISOString().split('T')[0]; }
}
