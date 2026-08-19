import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { CollectionService } from '../collection.service';
import { ToastService } from '../../../core/services/toast.service';
import { Bank, BankPaymentMethod, OrderCollection, UserDeposit, Collector, UserDebtSummary,
         COLLECTION_STATUS_LABEL, COLLECTION_STATUS_COLOR,
         DEPOSIT_STATUS_LABEL, DEPOSIT_STATUS_COLOR } from '../collection.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

type ValidatingItem =
  | { kind: 'deposit';  data: UserDeposit }
  | { kind: 'transfer'; data: OrderCollection };

interface ManagePaymentsFilters {
  status: string;
  person: number | null;
  operation_number: string;
  date_from: string;
  date_to: string;
  bank_id: number | null;
  payment_method_id: number | null;
}

@Component({
  selector: 'app-manage-payments',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent,
    SpinnerComponent, BadgeComponent, PageHeaderComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './manage-payments.component.html',
})
export class ManagePaymentsComponent implements OnInit {
  transfers = signal<OrderCollection[]>([]);
  deposits  = signal<UserDeposit[]>([]);
  cash      = signal<OrderCollection[]>([]);
  debts     = signal<UserDebtSummary[]>([]);
  loading   = signal(true);
  activeTab = signal<'deposits' | 'transfers' | 'cash' | 'debts'>('deposits');

  actingId       = signal<number | null>(null);
  validatingItem = signal<ValidatingItem | null>(null);
  isRejectMode   = signal(false);
  rejectNote     = '';
  voucherPreviewUrl = signal<string | null>(null);

  deletingCollection = signal<OrderCollection | null>(null);
  deletingDeposit    = signal<UserDeposit | null>(null);

  selectedDebtUser    = signal<UserDebtSummary | null>(null);
  showOnlyUncovered   = signal(false);
  downloadingDebtPdf  = signal(false);

  // Typed accessors for template narrowing
  readonly vDeposit = computed(() => {
    const v = this.validatingItem();
    return v?.kind === 'deposit' ? (v.data as UserDeposit) : null;
  });
  readonly vTransfer = computed(() => {
    const v = this.validatingItem();
    return v?.kind === 'transfer' ? (v.data as OrderCollection) : null;
  });

  readonly colStatusLabel = COLLECTION_STATUS_LABEL;
  readonly colStatusColor = COLLECTION_STATUS_COLOR;
  readonly depStatusLabel = DEPOSIT_STATUS_LABEL;
  readonly depStatusColor = DEPOSIT_STATUS_COLOR;

  constructor(
    private svc:   CollectionService,
    private toast: ToastService,
  ) {}

  /** Usuarios con cobros o depósitos registrados, para el filtro "Usuario". */
  people = signal<Collector[]>([]);

  banks       = signal<Bank[]>([]);
  bankMethods = signal<BankPaymentMethod[]>([]);

  filters = signal<ManagePaymentsFilters>({ status: '', person: null, operation_number: '', date_from: '', date_to: '', bank_id: null, payment_method_id: null });
  downloadingPdf = signal(false);

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return !!(f.status || f.person || f.operation_number || f.date_from || f.date_to || f.bank_id || f.payment_method_id);
  });

  ngOnInit(): void {
    this.loadAll();
    this.svc.collectors().subscribe({ next: c => this.people.set(c) });
    this.svc.banks().subscribe({ next: b => this.banks.set(b) });
  }

  loadAll(): void {
    this.loading.set(true);
    const f = this.filters();
    this.svc.listDeposits({
      per_page: 100,
      status: f.status || undefined, deposited_by: f.person ?? undefined,
      operation_number: f.operation_number || undefined,
      date_from: f.date_from || undefined, date_to: f.date_to || undefined,
      bank_id: f.bank_id ?? undefined, payment_method_id: f.payment_method_id ?? undefined,
    }).subscribe({
      next: res => { this.deposits.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.svc.listCollections({
      form: 'transfer', per_page: 100,
      status: f.status || undefined, registered_by: f.person ?? undefined,
      operation_number: f.operation_number || undefined,
      date_from: f.date_from || undefined, date_to: f.date_to || undefined,
      bank_id: f.bank_id ?? undefined, payment_method_id: f.payment_method_id ?? undefined,
    }).subscribe({
      next: res => this.transfers.set(res.data),
    });
    this.svc.listCollections({
      form: 'cash', per_page: 100,
      registered_by: f.person ?? undefined,
      operation_number: f.operation_number || undefined,
      date_from: f.date_from || undefined, date_to: f.date_to || undefined,
    }).subscribe({
      next: res => this.cash.set(res.data),
    });
    this.svc.debtsSummary().subscribe({
      next: res => this.debts.set(res.users),
      error: () => {},
    });
  }

  pendingDeposits  = () => this.deposits().filter(d => d.status === 'pending');
  pendingTransfers = () => this.transfers().filter(c => c.status === 'pending');

  setFilter(key: keyof ManagePaymentsFilters, value: string | number | null): void {
    this.filters.update(f => ({ ...f, [key]: value }));
  }

  /** Al cambiar de pestaña, el filtro de Estado ya no aplica (no se muestra en la pestaña de efectivo). */
  selectTab(tab: 'deposits' | 'transfers' | 'cash' | 'debts'): void {
    this.activeTab.set(tab);
    if (this.filters().status) {
      this.filters.update(f => ({ ...f, status: '' }));
      this.loadAll();
    }
  }

  applyFilters(): void {
    this.loadAll();
  }

  onBankChange(bankId: number | null): void {
    this.filters.update(f => ({ ...f, bank_id: bankId, payment_method_id: null }));
    this.bankMethods.set([]);
    if (bankId) {
      this.svc.paymentMethodsByBank(bankId).subscribe({ next: m => this.bankMethods.set(m) });
    }
  }

  clearFilters(): void {
    this.filters.set({ status: '', person: null, operation_number: '', date_from: '', date_to: '', bank_id: null, payment_method_id: null });
    this.bankMethods.set([]);
    this.loadAll();
  }

  daysLabel(days: number): string {
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return `${days}d`;
  }

  uncoveredCount(u: UserDebtSummary): number {
    return u.collections.filter(c => c.uncovered_amount > 0).length;
  }

  downloadDebtPdf(userId: number): void {
    if (this.downloadingDebtPdf()) return;
    this.downloadingDebtPdf.set(true);
    this.svc.downloadDebtDetailPdf(userId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `deuda-${userId}-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingDebtPdf.set(false);
      },
      error: () => this.downloadingDebtPdf.set(false),
    });
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    const activeTab = this.activeTab();
    if (activeTab === 'debts') return;
    this.downloadingPdf.set(true);
    const f   = this.filters();
    const tab = activeTab;
    this.svc.downloadPaymentsPdf({
      tab,
      status: f.status || undefined, registered_by: f.person ?? undefined,
      date_from: f.date_from || undefined, date_to: f.date_to || undefined,
      bank_id: f.bank_id ?? undefined, payment_method_id: f.payment_method_id ?? undefined,
    }).subscribe({
      next: blob => {
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement('a');
        const names = { deposits: 'depositos', transfers: 'transferencias', cash: 'efectivo' } as const;
        a.href      = url;
        a.download  = `${names[tab]}-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }

  clientName(c: OrderCollection): string {
    const cl = c.order?.client;
    return cl ? (cl.business_name || cl.name) : '—';
  }

  isImage(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url);
  }

  openVoucher(url: string): void {
    if (this.isImage(url)) {
      this.voucherPreviewUrl.set(url);
    } else {
      window.open(url, '_blank');
    }
  }

  openValidate(item: UserDeposit, kind: 'deposit'): void;
  openValidate(item: OrderCollection, kind: 'transfer'): void;
  openValidate(item: any, kind: 'deposit' | 'transfer'): void {
    this.validatingItem.set({ kind, data: item } as ValidatingItem);
    this.isRejectMode.set(false);
    this.rejectNote = '';
  }

  closeValidate(): void {
    this.validatingItem.set(null);
    this.isRejectMode.set(false);
    this.rejectNote = '';
  }

  confirmValidate(): void {
    const vi = this.validatingItem();
    if (!vi) return;
    this.actingId.set(vi.data.id);

    const req = vi.kind === 'deposit'
      ? this.svc.validateDeposit(vi.data.id, 'validate')
      : this.svc.validateCollection(vi.data.id, 'validate');

    (req as any).subscribe({
      next: (res: any) => {
        if (vi.kind === 'deposit') {
          this.deposits.update(list => list.map(x => x.id === res.deposit.id ? res.deposit : x));
        } else {
          this.transfers.update(list => list.map(x => x.id === res.collection.id ? res.collection : x));
        }
        this.actingId.set(null);
        this.closeValidate();
        this.toast.success(vi.kind === 'deposit' ? 'Depósito validado.' : 'Transferencia validada.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al validar.');
        this.actingId.set(null);
      },
    });
  }

  confirmReject(): void {
    const vi = this.validatingItem();
    if (!vi) return;
    this.actingId.set(vi.data.id);

    const req = vi.kind === 'deposit'
      ? this.svc.validateDeposit(vi.data.id, 'reject', this.rejectNote || undefined)
      : this.svc.validateCollection(vi.data.id, 'reject', this.rejectNote || undefined);

    (req as any).subscribe({
      next: (res: any) => {
        if (vi.kind === 'deposit') {
          this.deposits.update(list => list.map(x => x.id === res.deposit.id ? res.deposit : x));
        } else {
          this.transfers.update(list => list.map(x => x.id === res.collection.id ? res.collection : x));
        }
        this.actingId.set(null);
        this.closeValidate();
        this.toast.success('Rechazado correctamente.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al rechazar.');
        this.actingId.set(null);
      },
    });
  }

  confirmDeleteCollection(): void {
    const c = this.deletingCollection();
    if (!c) return;
    this.svc.deleteCollection(c.id).subscribe({
      next: () => {
        this.transfers.update(list => list.filter(x => x.id !== c.id));
        this.cash.update(list => list.filter(x => x.id !== c.id));
        this.deletingCollection.set(null);
        this.toast.success('Cobro eliminado.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar el cobro.');
        this.deletingCollection.set(null);
      },
    });
  }

  confirmDeleteDeposit(): void {
    const d = this.deletingDeposit();
    if (!d) return;
    this.svc.deleteDeposit(d.id).subscribe({
      next: () => {
        this.deposits.update(list => list.filter(x => x.id !== d.id));
        this.deletingDeposit.set(null);
        this.toast.success('Depósito eliminado.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar el depósito.');
        this.deletingDeposit.set(null);
      },
    });
  }
}
