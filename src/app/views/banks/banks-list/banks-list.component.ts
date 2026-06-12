import { Component, OnInit, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { BankService } from '../bank.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { Bank, BankPaymentMethod, OP_FORMAT_LABEL } from '../../payments/collection.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { BankModalComponent } from '../bank-modal/bank-modal.component';
import { BankMethodModalComponent } from '../bank-method-modal/bank-method-modal.component';

@Component({
  selector: 'app-banks-list',
  standalone: true,
  imports: [
    FaIconComponent, BadgeComponent,
    CardComponent, CardBodyComponent, SpinnerComponent,
    PageHeaderComponent, BankModalComponent, BankMethodModalComponent,
  ],
  templateUrl: './banks-list.component.html',
})
export class BanksListComponent implements OnInit {
  banks   = signal<Bank[]>([]);
  loading = signal(true);

  showModal  = signal(false);
  editBank   = signal<Bank | null>(null);
  togglingId = signal<number | null>(null);
  deletingBankId = signal<number | null>(null);

  // Methods per bank (loaded lazily)
  expandedBankId   = signal<number | null>(null);
  methodsMap       = signal<Record<number, BankPaymentMethod[]>>({});
  methodsLoading   = signal<number | null>(null);

  showMethodModal  = signal(false);
  methodModalBank  = signal<Bank | null>(null);
  editMethod       = signal<BankPaymentMethod | null>(null);
  deletingMethodId = signal<number | null>(null);

  readonly formatLabel = OP_FORMAT_LABEL;

  constructor(
    private svc:     BankService,
    private toast:   ToastService,
    private confirm: ConfirmService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: list => { this.banks.set(list); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  openCreate(): void { this.editBank.set(null); this.showModal.set(true); }
  openEdit(b: Bank):   void { this.editBank.set(b); this.showModal.set(true); }

  onSaved(bank: Bank): void {
    this.showModal.set(false);
    this.editBank.set(null);
    this.banks.update(list => {
      const idx = list.findIndex(b => b.id === bank.id);
      return idx >= 0
        ? list.map(b => b.id === bank.id ? bank : b)
        : [bank, ...list];
    });
  }

  deleteBank(b: Bank): void {
    this.confirm.delete(b.name).then(ok => {
      if (!ok) return;
      this.deletingBankId.set(b.id);
      this.svc.remove(b.id).subscribe({
        next: () => {
          this.banks.update(list => list.filter(x => x.id !== b.id));
          if (this.expandedBankId() === b.id) this.expandedBankId.set(null);
          this.deletingBankId.set(null);
          this.toast.success('Banco eliminado.');
        },
        error: (err: any) => {
          this.toast.error(err.error?.message ?? err.error?.errors?.bank?.[0] ?? 'No se puede eliminar este banco.');
          this.deletingBankId.set(null);
        },
      });
    });
  }

  toggleActive(b: Bank): void {
    this.togglingId.set(b.id);
    this.svc.update(b.id, { active: !b.active }).subscribe({
      next: res => {
        this.banks.update(list => list.map(x => x.id === res.bank.id ? res.bank : x));
        this.togglingId.set(null);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al actualizar.');
        this.togglingId.set(null);
      },
    });
  }

  toggleExpand(b: Bank): void {
    if (this.expandedBankId() === b.id) {
      this.expandedBankId.set(null);
      return;
    }
    this.expandedBankId.set(b.id);
    if (!this.methodsMap()[b.id]) {
      this.loadMethods(b.id);
    }
  }

  loadMethods(bankId: number): void {
    this.methodsLoading.set(bankId);
    this.svc.getMethods(bankId).subscribe({
      next: methods => {
        this.methodsMap.update(m => ({ ...m, [bankId]: methods }));
        this.methodsLoading.set(null);
      },
      error: () => this.methodsLoading.set(null),
    });
  }

  openCreateMethod(b: Bank): void {
    this.methodModalBank.set(b);
    this.editMethod.set(null);
    this.showMethodModal.set(true);
  }

  openEditMethod(b: Bank, m: BankPaymentMethod): void {
    this.methodModalBank.set(b);
    this.editMethod.set(m);
    this.showMethodModal.set(true);
  }

  onMethodSaved(method: BankPaymentMethod): void {
    this.showMethodModal.set(false);
    const bankId = method.bank_id;
    this.methodsMap.update(map => {
      const list = map[bankId] ?? [];
      const idx  = list.findIndex(m => m.id === method.id);
      return {
        ...map,
        [bankId]: idx >= 0
          ? list.map(m => m.id === method.id ? method : m)
          : [...list, method],
      };
    });
    this.editMethod.set(null);
  }

  toggleMethodActive(b: Bank, m: BankPaymentMethod): void {
    this.deletingMethodId.set(m.id);
    const fd = new FormData();
    fd.append('active', m.active ? '0' : '1');
    this.svc.updateMethod(b.id, m.id, fd).subscribe({
      next: res => {
        this.methodsMap.update(map => ({
          ...map,
          [b.id]: (map[b.id] ?? []).map(x => x.id === res.method.id ? res.method : x),
        }));
        this.deletingMethodId.set(null);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error.');
        this.deletingMethodId.set(null);
      },
    });
  }

  deleteMethod(b: Bank, m: BankPaymentMethod): void {
    this.confirm.delete(m.name).then(ok => {
      if (!ok) return;
      this.deletingMethodId.set(m.id);
      this.svc.deleteMethod(b.id, m.id).subscribe({
        next: () => {
          this.methodsMap.update(map => ({
            ...map,
            [b.id]: (map[b.id] ?? []).filter(x => x.id !== m.id),
          }));
          this.deletingMethodId.set(null);
          this.toast.success('Medio de pago eliminado.');
        },
        error: (err: any) => {
          const msg = err.error?.errors?.method?.[0] ?? err.error?.message ?? 'No se puede eliminar este medio de pago.';
          this.toast.error(msg);
          this.deletingMethodId.set(null);
        },
      });
    });
  }
}
