import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { CollectionService } from '../collection.service';
import { ToastService } from '../../../core/services/toast.service';
import { BankPaymentMethod, UserDeposit } from '../collection.model';

@Component({
  selector: 'app-register-deposit-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent, DecimalPipe,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './register-deposit-modal.component.html',
})
export class RegisterDepositModalComponent {
  open    = input<boolean>(false);
  deposit = input<UserDeposit | null>(null);

  registered = output<{ deposit: UserDeposit }>();
  cancelled  = output<void>();

  methods    = signal<BankPaymentMethod[]>([]);
  saving     = signal(false);
  file: File | null = null;
  previewUrl: string | null = null;
  previewFullUrl: string | null = null;

  showGuide = false;

  form = {
    amount:            '',
    payment_method_id: null as number | null,
    operation_number:  '',
    deposit_date:      new Date().toISOString().slice(0, 10),
    deposit_time:      '',
  };

  private svc   = inject(CollectionService);
  private toast = inject(ToastService);

  constructor() {
    this.svc.paymentMethods().subscribe({ next: m => this.methods.set(m) });

    effect(() => {
      const d = this.deposit();
      if (d) {
        this.form.amount            = d.amount;
        this.form.payment_method_id = d.payment_method_id ?? null;
        this.form.operation_number  = d.operation_number;
        this.form.deposit_date      = d.deposit_date ? d.deposit_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        this.form.deposit_time      = d.deposit_time ?? '';
        this.file = null;
        this.previewUrl = null;
      }
    });
  }

  get isOpen():     boolean { return this.open() || !!this.deposit(); }
  get isEditMode(): boolean { return !!this.deposit(); }

  get selectedMethod(): BankPaymentMethod | null {
    if (!this.form.payment_method_id) return null;
    return this.methods().find(m => m.id === this.form.payment_method_id) ?? null;
  }

  get opNumberError(): string | null {
    const op = this.form.operation_number;
    if (!op) return null;
    const m = this.selectedMethod;
    if (!m) return null;
    if (m.op_format === 'numeric'      && !/^\d+$/.test(op))       return 'Solo números';
    if (m.op_format === 'alpha'        && !/^[a-zA-Z]+$/.test(op)) return 'Solo letras';
    if (m.op_min_length && op.length < m.op_min_length) return `Mínimo ${m.op_min_length} caracteres`;
    if (m.op_max_length && op.length > m.op_max_length) return `Máximo ${m.op_max_length} caracteres`;
    return null;
  }

  /** Deuda actual del repartidor — no se puede depositar más de lo que debe. */
  readonly debt = computed(() => this.svc.debt()?.debt ?? 0);

  get exceedsDebt(): boolean {
    return this.debt() > 0 && +this.form.amount > this.debt() + 0.005;
  }

  get isValid(): boolean {
    return !!(
      +this.form.amount > 0 &&
      !this.exceedsDebt &&
      this.form.payment_method_id &&
      this.form.operation_number &&
      !this.opNumberError &&
      this.form.deposit_date &&
      (this.isEditMode || this.file)
    );
  }

  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.file = file;
    this.previewUrl = null;
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => { this.previewUrl = reader.result as string; };
      reader.readAsDataURL(file);
    }
  }

  openPreview(url: string): void { this.previewFullUrl = url; }

  submit(): void {
    if (this.saving() || !this.isValid) return;
    this.saving.set(true);

    const fd = new FormData();
    fd.append('amount',            this.form.amount);
    fd.append('payment_method_id', String(this.form.payment_method_id!));
    fd.append('operation_number',  this.form.operation_number);
    fd.append('deposit_date',      this.form.deposit_date);
    if (this.form.deposit_time) fd.append('deposit_time', this.form.deposit_time);
    if (this.file) fd.append('voucher', this.file);

    const d = this.deposit();
    const req = d ? this.svc.updateDeposit(d.id, fd) : this.svc.registerDeposit(fd);

    req.subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.success(d ? 'Depósito corregido y reenviado.' : 'Depósito registrado. Pendiente de validación.');
        this.resetForm();
        this.registered.emit({ deposit: res.deposit });
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al registrar el depósito.');
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    if (!this.saving()) { this.resetForm(); this.cancelled.emit(); }
  }

  private resetForm(): void {
    this.form = {
      amount: '', payment_method_id: null, operation_number: '',
      deposit_date: new Date().toISOString().slice(0, 10), deposit_time: '',
    };
    this.file       = null;
    this.previewUrl = null;
    this.previewFullUrl = null;
    this.showGuide  = false;
  }
}
