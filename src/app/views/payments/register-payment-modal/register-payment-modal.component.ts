import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { CollectionService } from '../collection.service';
import { SalesService } from '../../quotations/sales.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  BankPaymentMethod, OrderCollection,
  COLLECTION_STATUS_LABEL, COLLECTION_STATUS_COLOR,
} from '../collection.model';
import { Order } from '../../quotations/sales.model';

export interface PaymentEntry {
  _id:               number;
  collection_form:   'cash' | 'transfer';
  amount:            string;
  payment_method_id: number | null;
  operation_number:  string;
  operation_date:    string;
  operation_time:    string;
  file:              File | null;
  previewUrl:        string | null;
  showGuide:         boolean;
}

let _counter = 0;
function makeEntry(amount = ''): PaymentEntry {
  return {
    _id: ++_counter,
    collection_form: 'cash', amount,
    payment_method_id: null, operation_number: '',
    operation_date: new Date().toISOString().slice(0, 10),
    operation_time: '', file: null, previewUrl: null, showGuide: false,
  };
}

@Component({
  selector: 'app-register-payment-modal',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './register-payment-modal.component.html',
})
export class RegisterPaymentModalComponent {
  order   = input<Order | null>(null);
  payment = input<OrderCollection | null>(null);

  registered = output<{ order?: Order; collections: OrderCollection[] }>();
  cancelled  = output<void>();

  methods             = signal<BankPaymentMethod[]>([]);
  existingCollections = signal<OrderCollection[]>([]);
  loadingHistory      = signal(false);
  saving              = signal(false);
  entries             = signal<PaymentEntry[]>([makeEntry()]);
  previewFullUrl: string | null = null;

  readonly colStatusLabel = COLLECTION_STATUS_LABEL;
  readonly colStatusColor = COLLECTION_STATUS_COLOR;

  private collectionSvc = inject(CollectionService);
  private salesSvc      = inject(SalesService);
  private toast         = inject(ToastService);

  constructor() {
    this.collectionSvc.paymentMethods().subscribe({ next: m => this.methods.set(m) });

    effect(() => {
      const o = this.order();
      const p = this.payment();

      this.existingCollections.set([]);

      if (o) {
        this.loadingHistory.set(true);
        this.collectionSvc.listCollections({ order_id: o.id, per_page: 100 }).subscribe({
          next: res => {
            const cols: OrderCollection[] = res.data ?? [];
            this.existingCollections.set(cols);
            this.loadingHistory.set(false);
            const remaining = this.remaining(+o.total, cols);
            this.entries.set([makeEntry(remaining > 0 ? remaining.toFixed(2) : '')]);
          },
          error: () => {
            this.loadingHistory.set(false);
            this.entries.set([makeEntry(String(o.total))]);
          },
        });
      }

      if (p) {
        this.entries.set([{
          _id: ++_counter,
          collection_form:   p.collection_form,
          amount:            p.amount,
          payment_method_id: p.payment_method_id ?? null,
          operation_number:  p.operation_number ?? '',
          operation_date:    p.operation_date ? p.operation_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          operation_time:    p.operation_time ?? '',
          file: null, previewUrl: null, showGuide: false,
        }]);
      }
    });
  }

  get isOpen():     boolean { return !!(this.order() || this.payment()); }
  get isEditMode(): boolean { return !!this.payment(); }

  get totalEntered(): number {
    return this.entries().reduce((s, e) => s + (+e.amount || 0), 0);
  }

  get alreadyPaid(): number {
    return this.existingCollections()
      .filter(c => c.status !== 'rejected')
      .reduce((s, c) => s + (+c.amount || 0), 0);
  }

  private remaining(total: number, cols: OrderCollection[]): number {
    const paid = cols.filter(c => c.status !== 'rejected').reduce((s, c) => s + (+c.amount || 0), 0);
    return Math.max(0, total - paid);
  }

  methodFor(methodId: number | null): BankPaymentMethod | null {
    if (!methodId) return null;
    return this.methods().find(m => m.id === methodId) ?? null;
  }

  opNumberError(e: PaymentEntry): string | null {
    const op = e.operation_number;
    if (!op) return null;
    const m = this.methodFor(e.payment_method_id);
    if (!m) return null;
    if (m.op_format === 'numeric'  && !/^\d+$/.test(op))       return 'Solo números';
    if (m.op_format === 'alpha'    && !/^[a-zA-Z]+$/.test(op)) return 'Solo letras';
    if (m.op_min_length && op.length < m.op_min_length) return `Mínimo ${m.op_min_length} caracteres`;
    if (m.op_max_length && op.length > m.op_max_length) return `Máximo ${m.op_max_length} caracteres`;
    return null;
  }

  isEntryValid(e: PaymentEntry): boolean {
    if (!e.amount || +e.amount <= 0) return false;
    if (e.collection_form === 'transfer') {
      if (!e.payment_method_id || !e.operation_number || !e.operation_date || !e.operation_time) return false;
      if (this.opNumberError(e)) return false;
      if (!this.isEditMode && !e.file) return false;
    }
    return true;
  }

  get isOverPaid(): boolean {
    if (this.isEditMode || !this.order()) return false;
    return (this.alreadyPaid + this.totalEntered) > +this.order()!.total;
  }

  get isValid(): boolean {
    return this.entries().length > 0 && this.entries().every(e => this.isEntryValid(e)) && !this.isOverPaid;
  }

  addEntry(): void { this.entries.update(l => [...l, makeEntry()]); }
  removeEntry(id: number): void { this.entries.update(l => l.filter(e => e._id !== id)); }
  patch(id: number, changes: Partial<PaymentEntry>): void {
    this.entries.update(l => l.map(e => e._id === id ? { ...e, ...changes } : e));
  }

  onFileSelected(event: Event, id: number): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) { this.patch(id, { file: null, previewUrl: null }); return; }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.patch(id, { file, previewUrl: reader.result as string });
      reader.readAsDataURL(file);
    } else {
      this.patch(id, { file, previewUrl: null });
    }
  }

  private buildFormData(e: PaymentEntry, orderId: number): FormData {
    const fd = new FormData();
    fd.append('order_id',        String(orderId));
    fd.append('amount',          e.amount);
    fd.append('collection_form', e.collection_form);
    if (e.collection_form === 'transfer') {
      fd.append('payment_method_id', String(e.payment_method_id!));
      fd.append('operation_number',  e.operation_number);
      fd.append('operation_date',    e.operation_date);
      fd.append('operation_time', e.operation_time);
      if (e.file)           fd.append('voucher', e.file);
    }
    return fd;
  }

  submit(): void {
    if (this.saving() || !this.isValid) return;
    const p = this.payment();
    const o = this.order();
    this.saving.set(true);

    if (this.isEditMode && p) {
      const e  = this.entries()[0];
      const fd = new FormData();
      fd.append('amount',          e.amount);
      fd.append('collection_form', e.collection_form);
      if (e.collection_form === 'transfer') {
        fd.append('payment_method_id', String(e.payment_method_id!));
        fd.append('operation_number',  e.operation_number);
        fd.append('operation_date',    e.operation_date);
        fd.append('operation_time', e.operation_time);
        if (e.file)           fd.append('voucher', e.file);
      }
      this.collectionSvc.updateCollection(p.id, fd).subscribe({
        next: res => {
          this.saving.set(false);
          this.toast.success('Cobro corregido y reenviado para validación.');
          this.registered.emit({ collections: [res.collection] });
        },
        error: (err: any) => {
          this.toast.error(err.error?.message ?? 'Error al actualizar.');
          this.saving.set(false);
        },
      });
      return;
    }

    if (o) {
      from(this.entries().map(e => this.buildFormData(e, o.id))).pipe(
        concatMap(fd => this.collectionSvc.registerCollection(fd)),
        toArray(),
      ).subscribe({
        next: results => {
          const collections  = results.map(r => r.collection);
          const totalCovered = this.alreadyPaid + this.totalEntered;
          const isFullyPaid  = totalCovered >= +o.total;

          const finish = (order?: any) => {
            this.saving.set(false);
            this.toast.success(
              results.length === 1
                ? results[0].message
                : `${results.length} cobros registrados correctamente.`
            );
            if (!isFullyPaid) {
              const falta = +o.total - totalCovered;
              this.toast.warning(`Pago parcial. Falta cobrar S/ ${falta.toFixed(2)}.`);
            }
            this.registered.emit({ order, collections });
          };

          if (isFullyPaid) {
            this.salesSvc.updateOrderStatus(o.id, 'paid').subscribe({
              next: orderRes => finish(orderRes.order),
              error: () => {
                this.saving.set(false);
                this.toast.error('Cobros registrados pero no se pudo actualizar el estado del pedido.');
              },
            });
          } else {
            finish();
          }
        },
        error: (err: any) => {
          this.toast.error(err.error?.message ?? 'Error al registrar el cobro.');
          this.saving.set(false);
        },
      });
    }
  }

  openPreview(url: string): void { this.previewFullUrl = url; }
  cancel(): void { if (!this.saving()) this.cancelled.emit(); }
}
