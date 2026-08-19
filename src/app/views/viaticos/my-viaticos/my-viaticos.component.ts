import { Component, OnInit, signal, computed } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { forkJoin } from 'rxjs';
import {
  faSpinner, faTrash, faPencil, faImage,
  faPlus, faEye, faReceipt,
} from '@fortawesome/free-solid-svg-icons';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent,
  CardFooterComponent, CardHeaderComponent, ModalBodyComponent, ModalComponent,
  ModalFooterComponent, ModalHeaderComponent, SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { ViaticService } from '../viatico.service';
import {
  Viatico, VIATICO_STATUS, ViaticCategory, ViaticStatus, ViaticPaymentForm,
  ViaticDocumentType, DOCUMENT_TYPE_LABELS,
} from '../viatico.model';
import { ViaticoCategoryService } from '../viatico-category.service';
import { ViaticoCategoryItem } from '../viatico-category.model';
import { Comision, GastoResumen, COMISION_STATUS } from '../../comisiones/comision.model';
import { ComisionService, ComisionFilters } from '../../comisiones/comision.service';
import { ViaticoReturnService } from '../viatico-return.service';
import { ViaticoReturn } from '../viatico-return.model';
import { ReturnSubmitModalComponent } from '../return-submit-modal/return-submit-modal.component';
import { CollectionService } from '../../payments/collection.service';
import { BankPaymentMethod } from '../../payments/collection.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { FilePreviewModalComponent } from '../../../shared/components/file-preview-modal/file-preview-modal.component';
import { isImageUrl } from '../../../shared/utils/attachment.util';
import { ToastService } from '../../../core/services/toast.service';

type GastoFormShape = {
  date: string; category: ViaticCategory | ''; description: string; amount: number | null;
  payment_form: ViaticPaymentForm; payment_method_id: number | null;
  operation_number: string; operation_date: string; operation_time: string;
  document_type: ViaticDocumentType | ''; document_number: string;
  establishment_name: string; document_date: string;
  lat: number | null; lng: number | null; accuracy: number | null;
};

@Component({
  selector: 'app-my-viaticos',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, NgClass, NgTemplateOutlet, FormsModule, CurrencyPipe,
    FaIconComponent, Select, BadgeComponent, ButtonDirective, TableDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent, CardFooterComponent, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
    PageHeaderComponent, PaginationComponent, ConfirmModalComponent, FilePreviewModalComponent,
    ReturnSubmitModalComponent,
  ],
  templateUrl: './my-viaticos.component.html',
})
export class MyViaticosComponent implements OnInit {
  activeTab = signal<'actual' | 'historial' | 'vueltos'>('actual');

  // Tab "Comisión actual": comisiones no cerradas, con gastos ya cargados —
  // sin necesidad de expandir nada para verlos.
  currentComisiones = signal<Comision[]>([]);
  loadingCurrent      = signal(false);

  // Tab "Historial": comisiones cerradas, con filtros/paginación y expandible (como antes)
  comisiones = signal<Comision[]>([]);
  loading     = signal(false);
  total       = signal(0);
  lastPage    = signal(1);
  viewModalOpen   = signal(false);
  viewingComision = signal<Comision | null>(null);
  viewingDetail   = signal<Comision | null>(null);
  loadingDetail   = signal(false);

  // Modal de gasto
  gastoModal      = signal(false);
  editingGasto    = signal<GastoResumen | null>(null);
  activeComision  = signal<Comision | null>(null);
  savingGasto     = signal(false);

  // Confirm eliminar gasto
  showConfirm   = signal(false);
  deletingId    = signal<number | null>(null);
  deletingLabel = signal('');

  // GPS (interno — no se muestra en la UI, se captura y envía en segundo plano)
  gpsLoading = signal(false);
  gpsError   = signal<string | null>(null);

  // Foto / factura (un solo archivo, imagen o pdf) / voucher de transferencia
  photoPreview   = signal<string | null>(null);
  photoFile      = signal<File | null>(null);
  photoIsPdf     = signal(false);
  voucherPreview = signal<string | null>(null);
  voucherFile    = signal<File | null>(null);
  voucherIsPdf   = signal(false);

  // Datos del documento (opcional, todo-o-nada)
  showDocumentFields = signal(false);

  // Categorías
  categories = signal<ViaticoCategoryItem[]>([]);
  categoryOptions = computed(() =>
    this.categories().map(c => ({ value: c.name, label: c.name }))
  );
  showNewCategory  = signal(false);
  newCategoryName  = '';
  creatingCategory = signal(false);

  // Medios de pago (transferencia)
  methods = signal<BankPaymentMethod[]>([]);

  // Devoluciones de vuelto pendientes. Las que quedaron "rechazadas" (voucher de
  // depósito inválido) el propio vendedor las corrige y reenvía aquí mismo.
  pendingReturns     = signal<ViaticoReturn[]>([]);
  returnsHistory        = signal<ViaticoReturn[]>([]);
  loadingReturnsHistory  = signal(false);
  resubmittingReturn = signal<ViaticoReturn | null>(null);

  readonly faSpinner     = faSpinner;
  readonly faTrash       = faTrash;
  readonly faPencil      = faPencil;
  readonly faImage       = faImage;
  readonly faPlus        = faPlus;
  readonly faEye         = faEye;
  readonly faReceipt     = faReceipt;

  readonly GASTO_STATUS       = VIATICO_STATUS;
  readonly COMISION_STATUS_MAP = COMISION_STATUS;

  documentTypeOptions = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

  private today      = new Date();
  private startMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);

  filters: ComisionFilters = {
    date_from: this.iso(this.startMonth),
    date_to:   this.iso(this.today),
    page:      1,
  };

  gastoForm: GastoFormShape = this.emptyGasto();

  constructor(
    private comisionSvc: ComisionService,
    private gastoSvc: ViaticService,
    private returnSvc: ViaticoReturnService,
    private categorySvc: ViaticoCategoryService,
    private paySvc: CollectionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadCurrent();
    this.loadPendingReturns();
    this.categorySvc.list().subscribe({ next: c => this.categories.set(c) });
    this.paySvc.paymentMethods().subscribe({ next: m => this.methods.set(m) });
  }

  selectTab(tab: 'actual' | 'historial' | 'vueltos'): void {
    this.activeTab.set(tab);
    if (tab === 'historial' && this.comisiones().length === 0 && !this.loading()) this.load();
    if (tab === 'vueltos' && !this.returnsHistory().length) this.loadReturnsHistory();
  }

  loadReturnsHistory(): void {
    this.loadingReturnsHistory.set(true);
    this.returnSvc.myHistory().subscribe({
      next: r => { this.returnsHistory.set(r); this.loadingReturnsHistory.set(false); },
      error: () => this.loadingReturnsHistory.set(false),
    });
  }

  loadCurrent(): void {
    this.loadingCurrent.set(true);
    this.comisionSvc.myList({ open_only: true, per_page: 50 }).subscribe({
      next: r => {
        if (r.data.length === 0) {
          this.currentComisiones.set([]);
          this.loadingCurrent.set(false);
          return;
        }
        forkJoin(r.data.map(i => this.comisionSvc.myGet(i.id))).subscribe({
          next: details => { this.currentComisiones.set(details); this.loadingCurrent.set(false); },
          error: () => { this.currentComisiones.set(r.data); this.loadingCurrent.set(false); },
        });
      },
      error: () => this.loadingCurrent.set(false),
    });
  }

  get selectedMethod(): BankPaymentMethod | null {
    if (!this.gastoForm.payment_method_id) return null;
    return this.methods().find(m => m.id === this.gastoForm.payment_method_id) ?? null;
  }

  get opNumberError(): string | null {
    const op = this.gastoForm.operation_number;
    if (!op) return null;
    const m = this.selectedMethod;
    if (!m) return null;
    if (m.op_format === 'numeric' && !/^\d+$/.test(op))       return 'Solo números';
    if (m.op_format === 'alpha'   && !/^[a-zA-Z]+$/.test(op)) return 'Solo letras';
    if (m.op_min_length && op.length < m.op_min_length) return `Mínimo ${m.op_min_length} caracteres`;
    if (m.op_max_length && op.length > m.op_max_length) return `Máximo ${m.op_max_length} caracteres`;
    return null;
  }

  get isGastoValid(): boolean {
    if (!this.gastoForm.date || !this.gastoForm.category || !this.gastoForm.amount) return false;
    if (this.gastoForm.payment_form === 'transfer') {
      const okTransfer = !!(
        this.gastoForm.payment_method_id && this.gastoForm.operation_number && !this.opNumberError &&
        this.gastoForm.operation_date && this.gastoForm.operation_time &&
        (this.voucherFile() || this.editingGasto()?.voucher_url)
      );
      if (!okTransfer) return false;
    }
    if (this.showDocumentFields()) {
      if (!this.gastoForm.document_type || !this.gastoForm.document_number.trim() ||
          !this.gastoForm.establishment_name.trim() || !this.gastoForm.document_date) return false;
    }
    return true;
  }

  createCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name || this.creatingCategory()) return;
    this.creatingCategory.set(true);
    this.categorySvc.create(name).subscribe({
      next: r => {
        this.categories.update(list => [...list, r.category].sort((a, b) => a.name.localeCompare(b.name)));
        this.gastoForm.category = r.category.name;
        this.newCategoryName = '';
        this.showNewCategory.set(false);
        this.creatingCategory.set(false);
      },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo crear la categoría.'); this.creatingCategory.set(false); },
    });
  }

  loadPendingReturns(): void {
    this.returnSvc.myPending().subscribe({ next: r => this.pendingReturns.set(r) });
  }

  openResubmitReturn(r: ViaticoReturn): void {
    this.resubmittingReturn.set(r);
  }

  onReturnResubmitted(): void {
    this.resubmittingReturn.set(null);
    this.loadPendingReturns();
  }

  load(): void {
    this.loading.set(true);
    this.comisionSvc.myList({ ...this.filters, status: 'closed' }).subscribe({
      next: r => {
        this.comisiones.set(r.data);
        this.total.set(r.total);
        this.lastPage.set(r.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPage(p: number): void { this.filters.page = p; this.load(); }
  applyFilters(): void { this.filters.page = 1; this.load(); }

  openView(comision: Comision): void {
    this.viewingComision.set(comision);
    this.viewingDetail.set(null);
    this.viewModalOpen.set(true);
    this.loadingDetail.set(true);
    this.comisionSvc.myGet(comision.id).subscribe({
      next: d => { this.viewingDetail.set(d); this.loadingDetail.set(false); },
      error: () => this.loadingDetail.set(false),
    });
  }

  openAddGasto(comision: Comision): void {
    this.activeComision.set(comision);
    this.editingGasto.set(null);
    this.gastoForm = this.emptyGasto();
    this.photoPreview.set(null);
    this.photoFile.set(null);
    this.photoIsPdf.set(false);
    this.voucherPreview.set(null);
    this.voucherFile.set(null);
    this.voucherIsPdf.set(false);
    this.showNewCategory.set(false);
    this.showDocumentFields.set(false);
    this.gpsError.set(null);
    this.captureGps();
    this.gastoModal.set(true);
  }

  openEditGasto(g: GastoResumen, comision: Comision): void {
    this.activeComision.set(comision);
    this.editingGasto.set(g);
    this.gastoForm = {
      date:               g.date,
      category:           g.category as ViaticCategory,
      description:        g.description ?? '',
      amount:              g.amount,
      payment_form:        g.payment_form ?? 'cash',
      payment_method_id:   this.methods().find(m => m.name === g.payment_method_name)?.id ?? null,
      operation_number:    g.operation_number ?? '',
      operation_date:      g.operation_date ?? this.iso(this.today),
      operation_time:      g.operation_time ?? '',
      document_type:       g.document_type ?? '',
      document_number:     g.document_number ?? '',
      establishment_name:  g.establishment_name ?? '',
      document_date:       g.document_date ?? this.iso(this.today),
      lat:         g.lat,
      lng:         g.lng,
      accuracy:    g.accuracy,
    };
    this.photoPreview.set(g.photo_url);
    this.photoFile.set(null);
    this.photoIsPdf.set(!!g.photo_url && !isImageUrl(g.photo_url));
    this.voucherPreview.set(g.voucher_url);
    this.voucherFile.set(null);
    this.voucherIsPdf.set(!!g.voucher_url && !isImageUrl(g.voucher_url));
    this.showNewCategory.set(false);
    this.showDocumentFields.set(!!g.document_type);
    this.gpsError.set(null);
    this.gastoModal.set(true);
  }

  captureGps(): void {
    if (!navigator.geolocation) { this.gpsError.set('Tu navegador no soporta geolocalización.'); return; }
    this.gpsLoading.set(true);
    this.gpsError.set(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.gastoForm.lat      = pos.coords.latitude;
        this.gastoForm.lng      = pos.coords.longitude;
        this.gastoForm.accuracy = pos.coords.accuracy;
        this.gpsLoading.set(false);
      },
      () => {
        this.gpsError.set('No se pudo obtener la ubicación. Puedes registrar sin ella.');
        this.gpsLoading.set(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  onPhoto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.photoFile.set(file);
    this.photoPreview.set(null);
    this.photoIsPdf.set(file.type === 'application/pdf');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => this.photoPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  onVoucher(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.voucherFile.set(file);
    this.voucherPreview.set(null);
    this.voucherIsPdf.set(file.type === 'application/pdf');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => this.voucherPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  saveGasto(): void {
    if (!this.isGastoValid) return;
    this.savingGasto.set(true);

    const fd = new FormData();
    fd.append('comision_id', String(this.activeComision()!.id));
    fd.append('date',          this.gastoForm.date);
    fd.append('category',      this.gastoForm.category);
    fd.append('amount',        String(this.gastoForm.amount));
    fd.append('payment_form',  this.gastoForm.payment_form);
    if (this.gastoForm.description) fd.append('description', this.gastoForm.description);
    if (this.gastoForm.lat != null) fd.append('lat',      String(this.gastoForm.lat));
    if (this.gastoForm.lng != null) fd.append('lng',      String(this.gastoForm.lng));
    if (this.gastoForm.accuracy != null) fd.append('accuracy', String(this.gastoForm.accuracy));
    if (this.photoFile()) fd.append('photo', this.photoFile()!);

    if (this.gastoForm.payment_form === 'transfer') {
      fd.append('payment_method_id', String(this.gastoForm.payment_method_id!));
      fd.append('operation_number',  this.gastoForm.operation_number);
      fd.append('operation_date',    this.gastoForm.operation_date);
      if (this.gastoForm.operation_time) fd.append('operation_time', this.gastoForm.operation_time);
      if (this.voucherFile()) fd.append('voucher', this.voucherFile()!);
    }

    if (this.showDocumentFields() && this.gastoForm.document_type) {
      fd.append('document_type',      this.gastoForm.document_type);
      fd.append('document_number',    this.gastoForm.document_number.trim());
      fd.append('establishment_name', this.gastoForm.establishment_name.trim());
      fd.append('document_date',      this.gastoForm.document_date);
    }

    const op = this.editingGasto()
      ? this.gastoSvc.update(this.editingGasto()!.id, fd)
      : this.gastoSvc.store(fd);

    op.subscribe({
      next: r => {
        this.toast.success(r.message);
        this.gastoModal.set(false);
        this.savingGasto.set(false);
        this.refreshAfterChange();
      },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo guardar el gasto.'); this.savingGasto.set(false); },
    });
  }

  confirmDeleteGasto(g: GastoResumen, comision: Comision): void {
    // refreshAfterChange() necesita saber a qué comisión pertenece el gasto eliminado
    // para refrescar la lista correcta (actual o historial) — sin esto, el gasto se
    // borraba en el backend pero la lista en pantalla se quedaba con el dato viejo.
    this.activeComision.set(comision);
    this.deletingId.set(g.id);
    this.deletingLabel.set(`gasto del ${g.date} — S/ ${g.amount}`);
    this.showConfirm.set(true);
  }

  doDeleteGasto(): void {
    const id = this.deletingId();
    if (!id) return;
    this.gastoSvc.destroy(id).subscribe({
      next: r => {
        this.toast.success(r.message);
        this.showConfirm.set(false);
        this.refreshAfterChange();
      },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo eliminar el gasto.'); this.showConfirm.set(false); },
    });
  }

  private refreshAfterChange(): void {
    const activeId = this.activeComision()?.id;
    const isCurrent = activeId != null && this.currentComisiones().some(i => i.id === activeId);

    if (isCurrent) {
      this.loadCurrent();
      return;
    }

    // Estaba en el historial (modal de detalle abierto)
    const id = this.viewingComision()?.id;
    if (!id) { this.load(); return; }
    this.comisionSvc.myGet(id).subscribe({
      next: d => {
        this.viewingDetail.set(d);
        this.comisiones.update(list =>
          list.map(i => i.id === id
            ? { ...i, gastos_count: d.gastos?.length ?? 0, gastos_total: d.gastos?.reduce((s, g) => s + g.amount, 0) ?? 0 }
            : i
          )
        );
      },
    });
  }

  gastoStatus(status: string) {
    return VIATICO_STATUS[status as ViaticStatus] ?? { label: status, color: 'secondary' };
  }

  usagePercent(comision: Comision): number {
    const adelanto = comision.resumen_financiero.adelanto;
    if (!adelanto) return 0;
    const usado = comision.resumen_financiero.aprobado + comision.resumen_financiero.pendiente_revision;
    return Math.round((usado / adelanto) * 100);
  }

  docTypeLabel(type: string | null): string {
    return type ? (DOCUMENT_TYPE_LABELS[type as ViaticDocumentType] ?? type) : '';
  }

  isImage(url: string | null | undefined): boolean {
    return isImageUrl(url);
  }

  private emptyGasto(): GastoFormShape {
    return {
      date: this.iso(this.today), category: '', description: '', amount: null,
      payment_form: 'cash', payment_method_id: null,
      operation_number: '', operation_date: this.iso(this.today), operation_time: '',
      document_type: '', document_number: '', establishment_name: '', document_date: this.iso(this.today),
      lat: null, lng: null, accuracy: null,
    };
  }

  private iso(d: Date): string { return d.toISOString().split('T')[0]; }
}
