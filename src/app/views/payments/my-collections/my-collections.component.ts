import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { CollectionService } from '../collection.service';
import { ToastService } from '../../../core/services/toast.service';
import { Bank, BankPaymentMethod, OrderCollection, UserDeposit, CashHistoryDay,
         COLLECTION_STATUS_LABEL, COLLECTION_STATUS_COLOR,
         DEPOSIT_STATUS_LABEL, DEPOSIT_STATUS_COLOR } from '../collection.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RegisterPaymentModalComponent } from '../register-payment-modal/register-payment-modal.component';
import { RegisterDepositModalComponent } from '../register-deposit-modal/register-deposit-modal.component';

interface MyCollectionFilters {
  status: string;
  form: string;
  bank_id: number | null;
  payment_method_id: number | null;
  operation_number: string;
  date_from: string;
  date_to: string;
}

@Component({
  selector: 'app-my-collections',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, FaIconComponent, IconDirective,
    CardComponent, CardBodyComponent,
    SpinnerComponent, BadgeComponent,
    PageHeaderComponent, RegisterPaymentModalComponent, RegisterDepositModalComponent,
  ],
  templateUrl: './my-collections.component.html',
})
export class MyCollectionsComponent implements OnInit {
  private svc   = inject(CollectionService);
  private toast = inject(ToastService);

  collections  = signal<OrderCollection[]>([]);
  deposits     = signal<UserDeposit[]>([]);
  banks        = signal<Bank[]>([]);
  bankMethods  = signal<BankPaymentMethod[]>([]);
  /** Deuda compartida con el header — así un depósito hecho desde el atajo del header también actualiza esta vista. */
  debt         = this.svc.debt;
  loading      = signal(true);
  activeTab    = signal<'collections' | 'deposits' | 'history'>('collections');

  cashHistory     = signal<CashHistoryDay[]>([]);
  loadingHistory  = signal(false);

  editCollection    = signal<OrderCollection | null>(null);
  editDeposit       = signal<UserDeposit | null>(null);
  showNewDeposit    = signal(false);
  voucherPreviewUrl = signal<string | null>(null);

  readonly colStatusLabel  = COLLECTION_STATUS_LABEL;
  readonly colStatusColor  = COLLECTION_STATUS_COLOR;
  readonly depStatusLabel  = DEPOSIT_STATUS_LABEL;
  readonly depStatusColor  = DEPOSIT_STATUS_COLOR;

  filters = signal<MyCollectionFilters>({ status: '', form: '', bank_id: null, payment_method_id: null, operation_number: '', date_from: '', date_to: '' });
  downloadingPdf = signal(false);

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return !!(f.status || f.form || f.bank_id || f.payment_method_id || f.operation_number || f.date_from || f.date_to);
  });

  setFilter(key: 'status' | 'form' | 'operation_number' | 'date_from' | 'date_to', value: string): void {
    this.filters.update(f => ({ ...f, [key]: value }));
  }

  /** Al cambiar de pestaña, el filtro de Estado ya no aplica (las opciones difieren entre cobros y depósitos). */
  selectTab(tab: 'collections' | 'deposits' | 'history'): void {
    this.activeTab.set(tab);
    if (tab === 'history' && !this.cashHistory().length) {
      this.loadCashHistory();
    }
    if (this.filters().status) {
      this.filters.update(f => ({ ...f, status: '' }));
      this.loadAll();
    }
  }

  loadCashHistory(): void {
    this.loadingHistory.set(true);
    this.svc.myCashHistory().subscribe({
      next: res => { this.cashHistory.set(res.days); this.loadingHistory.set(false); },
      error: () => this.loadingHistory.set(false),
    });
  }

  applyFilters(): void {
    this.loadAll();
  }

  onBankChange(bankId: number | null): void {
    this.filters.update(f => ({ ...f, bank_id: bankId, payment_method_id: null }));
    this.bankMethods.set([]);
    if (bankId) {
      this.svc.paymentMethodsByBank(bankId).subscribe({
        next: methods => this.bankMethods.set(methods),
      });
    }
  }

  setMethodFilter(value: number | null): void {
    this.filters.update(f => ({ ...f, payment_method_id: value }));
  }

  clearFilters(): void {
    this.filters.set({ status: '', form: '', bank_id: null, payment_method_id: null, operation_number: '', date_from: '', date_to: '' });
    this.bankMethods.set([]);
    this.loadAll();
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    const tab = this.activeTab();
    this.downloadingPdf.set(true);
    const f = this.filters();
    this.svc.downloadMyCollectionsPdf({
      tab,
      form:              tab === 'collections' ? (f.form || undefined) : undefined,
      status:            tab !== 'history' ? (f.status || undefined) : undefined,
      bank_id:           tab !== 'history' ? (f.bank_id ?? undefined) : undefined,
      payment_method_id: tab !== 'history' ? (f.payment_method_id ?? undefined) : undefined,
      date_from:         tab !== 'history' ? (f.date_from || undefined) : undefined,
      date_to:           tab !== 'history' ? (f.date_to || undefined) : undefined,
    }).subscribe({
      next: blob => {
        const names: Record<typeof tab, string> = { collections: 'mis-cobros', deposits: 'mis-depositos', history: 'historial-efectivo' };
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${names[tab]}-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }

  ngOnInit(): void {
    this.loadAll();
    this.svc.banks().subscribe({ next: banks => this.banks.set(banks) });
  }

  loadAll(): void {
    this.loading.set(true);
    const f = this.filters();
    this.svc.myDebt().subscribe({ error: () => {} });
    this.svc.listCollections({
      mine: true, per_page: 50,
      status:            f.status || undefined,
      form:              f.form || undefined,
      bank_id:           f.bank_id ?? undefined,
      payment_method_id: f.payment_method_id ?? undefined,
      operation_number:  f.operation_number || undefined,
      date_from:         f.date_from || undefined,
      date_to:           f.date_to || undefined,
    }).subscribe({
      next: res => { this.collections.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.svc.listDeposits({
      mine: true, per_page: 50,
      status:            f.status || undefined,
      bank_id:           f.bank_id ?? undefined,
      payment_method_id: f.payment_method_id ?? undefined,
      operation_number:  f.operation_number || undefined,
      date_from:         f.date_from || undefined,
      date_to:           f.date_to || undefined,
    }).subscribe({
      next: res => this.deposits.set(res.data),
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

  onCollectionCorrected(event: { collections: OrderCollection[] }): void {
    const updated = event.collections[0];
    if (updated) {
      this.collections.update(list => list.map(x => x.id === updated.id ? updated : x));
    }
    this.editCollection.set(null);
    this.svc.myDebt().subscribe({ error: () => {} });
  }

  onDepositRegistered(event: { deposit: UserDeposit }): void {
    this.deposits.update(list => [event.deposit, ...list]);
    this.showNewDeposit.set(false);
    this.svc.myDebt().subscribe({ error: () => {} });
  }

  onDepositCorrected(event: { deposit: UserDeposit }): void {
    this.deposits.update(list => list.map(x => x.id === event.deposit.id ? event.deposit : x));
    this.editDeposit.set(null);
    this.svc.myDebt().subscribe({ error: () => {} });
  }
}
