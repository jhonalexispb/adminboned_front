import { Component, OnInit, signal, computed } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faCheck, faTimes, faLocationDot, faImage,
  faSpinner, faChevronDown, faChevronUp,
} from '@fortawesome/free-solid-svg-icons';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent,
  CardHeaderComponent, ModalBodyComponent, ModalComponent,
  ModalFooterComponent, ModalHeaderComponent, SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { ViaticService, ViaticFilters } from '../viatico.service';
import { Viatico, ViaticSummary, VIATICO_STATUS, DOCUMENT_TYPE_LABELS } from '../viatico.model';
import { ViaticoReturnService } from '../viatico-return.service';
import { ViaticoReturn } from '../viatico-return.model';
import { ViaticoCategoryService } from '../viatico-category.service';
import { ViaticoCategoryItem, ViaticoCategoriesSummary } from '../viatico-category.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { FilePreviewModalComponent } from '../../../shared/components/file-preview-modal/file-preview-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { CollectionService } from '../../payments/collection.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserDeposit, DEPOSIT_STATUS_LABEL, DEPOSIT_STATUS_COLOR } from '../../payments/collection.model';
import { RegisterDepositModalComponent } from '../../payments/register-deposit-modal/register-deposit-modal.component';
import { ReturnSubmitModalComponent } from '../return-submit-modal/return-submit-modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ComisionService } from '../../comisiones/comision.service';
import { Comision } from '../../comisiones/comision.model';
import { isImageUrl } from '../../../shared/utils/attachment.util';

@Component({
  selector: 'app-manage-viaticos',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, NgClass, NgTemplateOutlet, FormsModule, CurrencyPipe,
    FaIconComponent, Select, BadgeComponent, ButtonDirective, TableDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
    PageHeaderComponent, PaginationComponent, FilePreviewModalComponent, RegisterDepositModalComponent,
    ConfirmModalComponent, ReturnSubmitModalComponent,
  ],
  templateUrl: './manage-viaticos.component.html',
})
export class ManageViaticosComponent implements OnInit {
  items    = signal<Viatico[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);
  summary  = signal<ViaticSummary | null>(null);

  reviewModal  = signal(false);
  reviewTarget = signal<Viatico | null>(null);
  /** false = vista con botones Validar/Rechazar; true = vista con motivo de rechazo. */
  rejectMode   = signal(false);
  reviewNotes  = signal('');
  reviewSaving = signal(false);

  /** Contexto de presupuesto de la comisión del gasto que se está revisando. */
  reviewItinContext = signal<Comision | null>(null);
  loadingReviewItin = signal(false);

  expandedId = signal<number | null>(null);

  // Devoluciones de vuelto: por registrar (nadie eligió aún efectivo/depósito, o quedó
  // rechazada) + comprobantes de depósito por validar + efectivo propio por rendir.
  // El registro inicial lo hace el administrador — es quien recibe o entrega el dinero
  // en persona (el vendedor solo lo ve informativo en Mis Viáticos).
  unregisteredReturns     = signal<ViaticoReturn[]>([]);
  pendingValidationReturns = signal<ViaticoReturn[]>([]);
  myCashDebts              = signal<ViaticoReturn[]>([]);

  registeringReturn = signal<ViaticoReturn | null>(null);

  // Historial completo de devoluciones de vuelto (cualquier estado, cualquier vendedor) —
  // para auditar qué se entregó/recibió y cómo, sin importar la forma de pago.
  returnsHistory         = signal<ViaticoReturn[]>([]);
  returnsHistoryTotal    = signal(0);
  returnsHistoryLastPage = signal(1);
  returnsHistoryPage     = signal(1);
  loadingReturnsHistory  = signal(false);

  /** Cuenta de acciones pendientes en la pestaña Vueltos: por registrar + por validar. */
  pendingReturnsCount = computed(() => this.unregisteredReturns().length + this.pendingValidationReturns().length);

  /** Depósitos de vuelto que requieren acción: pendientes de validar (de cualquiera) +
   * rechazados propios, que necesitan corregirse — para no perderlos en el historial. */
  depositsNeedingAction = computed(() => [
    ...this.pendingViaticoDeposits(),
    ...this.myViaticoDeposits().filter(d => d.status === 'rejected' && d.deposited_by === this.auth.user()?.id),
  ]);

  returnReviewTarget = signal<ViaticoReturn | null>(null);
  returnReviewAction = signal<'validate' | 'reject' | null>(null);
  returnReviewNotes  = signal('');
  returnReviewSaving = signal(false);

  // ── Tab "Vueltos": mi deuda de efectivo y depósitos que la pagan ──────────
  /** Deuda compartida con el header — un depósito registrado desde el atajo del header también actualiza esta vista. */
  viaticoDebt            = this.returnSvc.debt;
  myViaticoDeposits       = signal<UserDeposit[]>([]);
  pendingViaticoDeposits  = signal<UserDeposit[]>([]);
  showNewViaticoDeposit   = signal(false);
  depositsSubTab          = signal<'pending' | 'historial' | 'returns'>('pending');
  editViaticoDeposit      = signal<UserDeposit | null>(null);
  loadingViaticoDeposits  = signal(false);

  validatingDeposit     = signal<UserDeposit | null>(null);
  depositRejectMode     = signal(false);
  depositReviewNotes    = signal('');
  depositReviewSaving   = signal(false);
  deletingDeposit        = signal<UserDeposit | null>(null);

  readonly DEPOSIT_STATUS_LABEL = DEPOSIT_STATUS_LABEL;
  readonly DEPOSIT_STATUS_COLOR = DEPOSIT_STATUS_COLOR;

  readonly faCheck       = faCheck;
  readonly faTimes       = faTimes;
  readonly faLocationDot = faLocationDot;
  readonly faImage       = faImage;
  readonly faSpinner     = faSpinner;
  readonly faChevronDown = faChevronDown;
  readonly faChevronUp   = faChevronUp;

  readonly STATUS     = VIATICO_STATUS;
  readonly DOCUMENT_TYPE_LABELS = DOCUMENT_TYPE_LABELS;

  users: { id: number; name: string }[] = [];

  // Tabs
  activeTab = signal<'gastos' | 'vueltos' | 'categorias'>('gastos');

  // Categorías
  categories = signal<ViaticoCategoryItem[]>([]);
  categoriesSummary = signal<ViaticoCategoriesSummary | null>(null);
  loadingCategories = signal(false);

  private today      = new Date();
  private startMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);

  filters: ViaticFilters = {
    date_from: this.iso(this.startMonth),
    date_to:   this.iso(this.today),
    page:      1,
  };

  categoryOptions = computed(() => [
    { value: null, label: 'Todas las categorías' },
    ...this.categories().map(c => ({ value: c.name, label: c.name })),
  ]);

  statusOptions = [
    { value: null,       label: 'Todos' },
    { value: 'pending',  label: 'Pendiente' },
    { value: 'approved', label: 'Aprobado' },
    { value: 'rejected', label: 'Rechazado' },
  ];

  userOptions: { value: number | null; label: string }[] = [{ value: null, label: 'Todos los usuarios' }];

  constructor(
    private svc: ViaticService,
    private returnSvc: ViaticoReturnService,
    private categorySvc: ViaticoCategoryService,
    private depositSvc: CollectionService,
    private itinSvc: ComisionService,
    private toast: ToastService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadReturns();
    this.returnSvc.myDebt().subscribe({ error: () => {} });
    this.categorySvc.list().subscribe({ next: c => this.categories.set(c) });
  }

  selectTab(tab: 'gastos' | 'vueltos' | 'categorias'): void {
    this.activeTab.set(tab);
    if (tab === 'categorias' && !this.categoriesSummary()) this.loadCategoriesSummary();
    if (tab === 'vueltos' && !this.myViaticoDeposits().length && !this.pendingViaticoDeposits().length) this.loadViaticoDeposits();
  }

  loadCategoriesSummary(): void {
    this.loadingCategories.set(true);
    this.categorySvc.summary({ date_from: this.filters.date_from, date_to: this.filters.date_to }).subscribe({
      next: s => { this.categoriesSummary.set(s); this.loadingCategories.set(false); },
      error: () => this.loadingCategories.set(false),
    });
  }

  loadReturns(): void {
    this.returnSvc.adminPending().subscribe({
      next: r => this.unregisteredReturns.set(r),
    });
    this.returnSvc.adminIndex({ form: 'deposit', status: 'pending' }).subscribe({
      next: r => this.pendingValidationReturns.set(r.data),
    });
    this.returnSvc.mySettleDebts().subscribe({
      next: r => this.myCashDebts.set(r),
    });
  }

  selectDepositsSubTab(tab: 'pending' | 'historial' | 'returns'): void {
    this.depositsSubTab.set(tab);
    if (tab === 'returns' && !this.returnsHistory().length) this.loadReturnsHistory();
  }

  loadReturnsHistory(page = 1): void {
    this.loadingReturnsHistory.set(true);
    this.returnsHistoryPage.set(page);
    this.returnSvc.adminIndex({ page, per_page: 20 }).subscribe({
      next: r => {
        this.returnsHistory.set(r.data);
        this.returnsHistoryTotal.set(r.total);
        this.returnsHistoryLastPage.set(r.last_page);
        this.loadingReturnsHistory.set(false);
      },
      error: () => this.loadingReturnsHistory.set(false),
    });
  }

  openRegisterReturn(r: ViaticoReturn): void {
    this.registeringReturn.set(r);
  }

  onReturnRegistered(): void {
    this.registeringReturn.set(null);
    this.loadReturns();
    this.returnSvc.myDebt().subscribe({ error: () => {} });
  }

  openValidateReturn(r: ViaticoReturn, action: 'validate' | 'reject'): void {
    this.returnReviewTarget.set(r);
    this.returnReviewAction.set(action);
    this.returnReviewNotes.set('');
  }

  doValidateReturn(): void {
    const r = this.returnReviewTarget();
    const action = this.returnReviewAction();
    if (!r || !action) return;
    if (action === 'reject' && !this.returnReviewNotes().trim()) return;

    this.returnReviewSaving.set(true);
    this.returnSvc.validateReturn(r.id, action, this.returnReviewNotes() || undefined).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.returnReviewTarget.set(null);
        this.returnReviewSaving.set(false);
        this.loadReturns();
      },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo procesar la devolución.'); this.returnReviewSaving.set(false); },
    });
  }

  loadViaticoDeposits(): void {
    this.loadingViaticoDeposits.set(true);
    this.depositSvc.listDeposits({ source: 'viatico', per_page: 50 }).subscribe({
      next: r => { this.myViaticoDeposits.set(r.data); this.loadingViaticoDeposits.set(false); },
      error: () => this.loadingViaticoDeposits.set(false),
    });
    this.depositSvc.listDeposits({ source: 'viatico', status: 'pending', per_page: 50 }).subscribe({
      next: r => this.pendingViaticoDeposits.set(r.data),
    });
  }

  onViaticoDepositRegistered(event: { deposit: UserDeposit }): void {
    this.myViaticoDeposits.update(list => [event.deposit, ...list]);
    if (event.deposit.status === 'pending') {
      this.pendingViaticoDeposits.update(list => [event.deposit, ...list]);
    }
    this.showNewViaticoDeposit.set(false);
    this.returnSvc.myDebt().subscribe({ error: () => {} });
    this.loadReturns();
  }

  onViaticoDepositCorrected(event: { deposit: UserDeposit }): void {
    this.myViaticoDeposits.update(list => list.map(d => d.id === event.deposit.id ? event.deposit : d));
    if (event.deposit.status === 'pending') {
      this.pendingViaticoDeposits.update(list =>
        list.some(x => x.id === event.deposit.id) ? list.map(x => x.id === event.deposit.id ? event.deposit : x) : [event.deposit, ...list]);
    }
    this.editViaticoDeposit.set(null);
    this.returnSvc.myDebt().subscribe({ error: () => {} });
  }

  confirmDeleteDeposit(d: UserDeposit): void {
    this.deletingDeposit.set(d);
  }

  doDeleteDeposit(): void {
    const d = this.deletingDeposit();
    if (!d) return;
    this.depositSvc.deleteDeposit(d.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.myViaticoDeposits.update(list => list.filter(x => x.id !== d.id));
        this.deletingDeposit.set(null);
        this.returnSvc.myDebt().subscribe({ error: () => {} });
      },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo eliminar el depósito.'); this.deletingDeposit.set(null); },
    });
  }

  openValidateDeposit(d: UserDeposit): void {
    this.validatingDeposit.set(d);
    this.depositRejectMode.set(false);
    this.depositReviewNotes.set('');
  }

  confirmValidateDeposit(): void {
    const d = this.validatingDeposit();
    if (!d || this.depositReviewSaving()) return;
    this.depositReviewSaving.set(true);
    this.depositSvc.validateDeposit(d.id, 'validate').subscribe({
      next: res => {
        this.toast.success(res.message);
        this.depositReviewSaving.set(false);
        this.validatingDeposit.set(null);
        this.pendingViaticoDeposits.update(list => list.filter(x => x.id !== d.id));
        this.myViaticoDeposits.update(list => list.map(x => x.id === res.deposit.id ? res.deposit : x));
        // Validar un depósito puede saldar devoluciones en efectivo (settleCovered) —
        // refrescar para que "Efectivo recibido pendiente" no quede desactualizada.
        this.returnSvc.myDebt().subscribe({ error: () => {} });
        this.loadReturns();
      },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo validar el depósito.'); this.depositReviewSaving.set(false); },
    });
  }

  confirmRejectDeposit(): void {
    const d = this.validatingDeposit();
    if (!d || this.depositReviewSaving() || !this.depositReviewNotes().trim()) return;
    this.depositReviewSaving.set(true);
    this.depositSvc.validateDeposit(d.id, 'reject', this.depositReviewNotes()).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.depositReviewSaving.set(false);
        this.validatingDeposit.set(null);
        this.pendingViaticoDeposits.update(list => list.filter(x => x.id !== d.id));
        this.myViaticoDeposits.update(list => list.map(x => x.id === res.deposit.id ? res.deposit : x));
        // Si el depósito rechazado es propio, lo dejamos listo para corregir de inmediato
        // en vez de que el usuario tenga que ir a buscarlo al historial.
        if (res.deposit.deposited_by === this.auth.user()?.id) {
          this.editViaticoDeposit.set(res.deposit);
        }
      },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo rechazar el depósito.'); this.depositReviewSaving.set(false); },
    });
  }

  load(): void {
    this.loading.set(true);
    this.svc.adminList(this.filters).subscribe({
      next: r => {
        this.items.set(r.data);
        this.total.set(r.total);
        this.lastPage.set(r.last_page);
        this.loading.set(false);
        this.buildUserOptions(r.data);
      },
      error: () => this.loading.set(false),
    });

    this.svc.summary({ date_from: this.filters.date_from, date_to: this.filters.date_to }).subscribe({
      next: s => this.summary.set(s),
    });
  }

  private buildUserOptions(data: Viatico[]): void {
    const seen = new Map<number, string>();
    data.forEach(v => { if (v.user_id && v.user_name && !seen.has(v.user_id)) seen.set(v.user_id, v.user_name); });
    this.userOptions = [{ value: null, label: 'Todos los usuarios' },
      ...Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }))];
  }

  onPage(p: number): void { this.filters.page = p; this.load(); }

  applyFilters(): void {
    this.filters.page = 1;
    this.load();
    if (this.activeTab() === 'categorias') this.loadCategoriesSummary();
  }

  toggleExpand(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  openApprove(v: Viatico): void {
    this.reviewTarget.set(v);
    this.rejectMode.set(false);
    this.reviewNotes.set('');
    this.reviewModal.set(true);
    this.loadReviewItinContext(v);
  }

  openReject(v: Viatico): void {
    this.reviewTarget.set(v);
    this.rejectMode.set(true);
    this.reviewNotes.set('');
    this.reviewModal.set(true);
    this.loadReviewItinContext(v);
  }

  private loadReviewItinContext(v: Viatico): void {
    this.reviewItinContext.set(null);
    if (!v.comision_id) return;
    this.loadingReviewItin.set(true);
    this.itinSvc.get(v.comision_id).subscribe({
      next: itin => { this.reviewItinContext.set(itin); this.loadingReviewItin.set(false); },
      error: () => this.loadingReviewItin.set(false),
    });
  }

  closeReview(): void {
    this.reviewModal.set(false);
    this.reviewTarget.set(null);
    this.rejectMode.set(false);
    this.reviewNotes.set('');
    this.reviewItinContext.set(null);
  }

  confirmApprove(): void {
    const v = this.reviewTarget();
    if (!v || this.reviewSaving()) return;
    this.reviewSaving.set(true);
    this.svc.approve(v.id).subscribe({
      next: r => { this.toast.success(r.message); this.reviewSaving.set(false); this.closeReview(); this.load(); },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo aprobar el gasto.'); this.reviewSaving.set(false); },
    });
  }

  confirmReject(): void {
    const v = this.reviewTarget();
    if (!v || this.reviewSaving() || !this.reviewNotes().trim()) return;
    this.reviewSaving.set(true);
    this.svc.reject(v.id, this.reviewNotes()).subscribe({
      next: r => { this.toast.success(r.message); this.reviewSaving.set(false); this.closeReview(); this.load(); },
      error: err => { this.toast.error(err.error?.message ?? 'No se pudo rechazar el gasto.'); this.reviewSaving.set(false); },
    });
  }

  isImage(url: string | null | undefined): boolean {
    return isImageUrl(url);
  }

  usagePercent(itin: Comision): number {
    const adelanto = itin.resumen_financiero.adelanto;
    if (!adelanto) return 0;
    const usado = itin.resumen_financiero.aprobado + itin.resumen_financiero.pendiente_revision;
    return Math.round((usado / adelanto) * 100);
  }

  private iso(d: Date): string { return d.toISOString().split('T')[0]; }
}
