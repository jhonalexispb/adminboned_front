import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { ViaticoReturnService } from '../viatico-return.service';
import { CollectionService } from '../../payments/collection.service';
import { BankPaymentMethod } from '../../payments/collection.model';
import { ViaticoReturn } from '../viatico-return.model';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { isImageUrl } from '../../../shared/utils/attachment.util';

/**
 * Subconjunto mínimo de campos que este modal necesita. Permite abrirlo desde
 * lugares que no tienen el ViaticoReturn completo (p.ej. la vista de una
 * comisión), construyendo un objeto liviano en vez de pedirlo al backend.
 */
export type ReturnSubmitTarget = Pick<ViaticoReturn,
  'id' | 'status' | 'direction' | 'amount' | 'user_name' | 'comision_destination' | 'notes' |
  'payment_method_id' | 'operation_number' | 'operation_date' | 'operation_time' | 'voucher_url'
>;

@Component({
  selector: 'app-return-submit-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent, DecimalPipe,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './return-submit-modal.component.html',
})
export class ReturnSubmitModalComponent {
  viaticoReturn = input<ReturnSubmitTarget | null>(null);

  submitted = output<{ return: ViaticoReturn }>();
  cancelled = output<void>();

  methods   = signal<BankPaymentMethod[]>([]);
  saving    = signal(false);
  file: File | null = null;
  previewUrl: string | null = null;

  form = {
    form:               'cash' as 'cash' | 'deposit',
    received_by:        null as number | null,
    payment_method_id:  null as number | null,
    operation_number:   '',
    operation_date:     new Date().toISOString().slice(0, 10),
    operation_time:     '',
  };

  private returnSvc = inject(ViaticoReturnService);
  private paySvc    = inject(CollectionService);
  private toast     = inject(ToastService);
  private auth      = inject(AuthService);

  /** Este modal solo lo usa un administrador desde su propio panel — quien registra
   * el efectivo es siempre él mismo, ya no tiene sentido elegirlo de una lista. */
  readonly currentUserName = computed(() => this.auth.user()?.name ?? '—');

  constructor() {
    this.paySvc.paymentMethods().subscribe({ next: m => this.methods.set(m) });

    // Al abrir el modal para un nuevo registro, el "receptor" del efectivo es
    // siempre quien está registrando (el admin logueado).
    effect(() => {
      if (this.viaticoReturn()) this.form.received_by = this.auth.user()?.id ?? null;
    });

    // Al reenviar una devolución rechazada, se precargan los datos que ya se habían
    // registrado (medio de pago, N° de operación, fecha/hora) — así solo se corrige lo
    // que estaba mal, en vez de tener que volver a escribir todo desde cero. El voucher
    // no se puede precargar como archivo, pero se muestra el anterior como referencia.
    effect(() => {
      const r = this.viaticoReturn();
      if (r?.status === 'rejected') {
        this.form.form              = 'deposit';
        this.form.payment_method_id = r.payment_method_id ?? null;
        this.form.operation_number  = r.operation_number ?? '';
        this.form.operation_date    = r.operation_date ? r.operation_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        this.form.operation_time    = r.operation_time ?? '';
      }
    });
  }

  get isOpen(): boolean { return !!this.viaticoReturn(); }
  get isResend(): boolean { return this.viaticoReturn()?.status === 'rejected'; }
  get isToSeller(): boolean { return this.viaticoReturn()?.direction === 'to_seller'; }

  get selectedMethod(): BankPaymentMethod | null {
    if (!this.form.payment_method_id) return null;
    return this.methods().find(m => m.id === this.form.payment_method_id) ?? null;
  }

  get opNumberError(): string | null {
    const op = this.form.operation_number;
    if (!op) return null;
    const m = this.selectedMethod;
    if (!m) return null;
    if (m.op_format === 'numeric' && !/^\d+$/.test(op))       return 'Solo números';
    if (m.op_format === 'alpha'   && !/^[a-zA-Z]+$/.test(op)) return 'Solo letras';
    if (m.op_min_length && op.length < m.op_min_length) return `Mínimo ${m.op_min_length} caracteres`;
    if (m.op_max_length && op.length > m.op_max_length) return `Máximo ${m.op_max_length} caracteres`;
    return null;
  }

  get isValid(): boolean {
    if (this.form.form === 'cash') return !!this.form.received_by;
    return !!(
      this.form.payment_method_id && this.form.operation_number && !this.opNumberError &&
      this.form.operation_date && this.form.operation_time && (this.file || this.isResend)
    );
  }

  isImage(url: string | null | undefined): boolean {
    return isImageUrl(url);
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

  submit(): void {
    const r = this.viaticoReturn();
    if (this.saving() || !this.isValid || !r) return;
    this.saving.set(true);

    const fd = new FormData();
    fd.append('form', this.form.form);
    if (this.form.form === 'cash') {
      fd.append('received_by', String(this.form.received_by!));
    } else {
      fd.append('payment_method_id', String(this.form.payment_method_id!));
      fd.append('operation_number', this.form.operation_number);
      fd.append('operation_date', this.form.operation_date);
      if (this.form.operation_time) fd.append('operation_time', this.form.operation_time);
      if (this.file) fd.append('voucher', this.file);
    }

    const req = this.isResend ? this.returnSvc.resubmit(r.id, fd) : this.returnSvc.submit(r.id, fd);
    req.subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.resetForm();
        this.submitted.emit({ return: res.return });
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al registrar la devolución.');
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    if (!this.saving()) { this.resetForm(); this.cancelled.emit(); }
  }

  private resetForm(): void {
    this.form = {
      form: 'cash', received_by: null, payment_method_id: null, operation_number: '',
      operation_date: new Date().toISOString().slice(0, 10), operation_time: '',
    };
    this.file = null;
    this.previewUrl = null;
  }
}
