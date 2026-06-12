import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { BankService } from '../bank.service';
import { ToastService } from '../../../core/services/toast.service';
import { Bank, BankPaymentMethod, OP_FORMAT_LABEL } from '../../payments/collection.model';

@Component({
  selector: 'app-bank-method-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './bank-method-modal.component.html',
})
export class BankMethodModalComponent {
  open   = input<boolean>(false);
  bank   = input<Bank | null>(null);
  method = input<BankPaymentMethod | null>(null);

  saved     = output<BankPaymentMethod>();
  cancelled = output<void>();

  saving       = signal(false);
  guideFile: File | null = null;
  guidePreview: string | null = null;

  form = {
    name:           '',
    op_format:      'numeric' as 'numeric' | 'alphanumeric' | 'alpha',
    op_min_length:  null as number | null,
    op_max_length:  null as number | null,
  };

  readonly formatOptions = [
    { value: 'numeric',      label: OP_FORMAT_LABEL['numeric'] },
    { value: 'alphanumeric', label: OP_FORMAT_LABEL['alphanumeric'] },
    { value: 'alpha',        label: OP_FORMAT_LABEL['alpha'] },
  ];

  private svc   = inject(BankService);
  private toast = inject(ToastService);

  constructor() {
    effect(() => {
      void this.open(); // track open to reset on each open
      const m = this.method();
      if (m) {
        this.form.name          = m.name;
        this.form.op_format     = m.op_format;
        this.form.op_min_length = m.op_min_length;
        this.form.op_max_length = m.op_max_length;
      } else {
        this.form = { name: '', op_format: 'numeric', op_min_length: null, op_max_length: null };
      }
      this.guideFile    = null;
      this.guidePreview = null;
    });
  }

  get isOpen():     boolean { return this.open() || !!this.method(); }
  get isEditMode(): boolean { return !!this.method(); }

  get isValid(): boolean {
    return !!this.form.name.trim();
  }

  onGuideSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.guideFile    = file;
    this.guidePreview = null;
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => { this.guidePreview = reader.result as string; };
      reader.readAsDataURL(file);
    }
  }

  submit(): void {
    if (this.saving() || !this.isValid) return;
    const b = this.bank();
    if (!b) return;

    this.saving.set(true);
    const fd = new FormData();
    fd.append('name',      this.form.name.trim());
    fd.append('op_format', this.form.op_format);
    if (this.form.op_min_length != null) fd.append('op_min_length', String(this.form.op_min_length));
    if (this.form.op_max_length != null) fd.append('op_max_length', String(this.form.op_max_length));
    if (this.guideFile) fd.append('guide_image', this.guideFile);

    const m   = this.method();
    const req = m
      ? this.svc.updateMethod(b.id, m.id, fd)
      : this.svc.createMethod(b.id, fd);

    req.subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.success(m ? 'Medio de pago actualizado.' : 'Medio de pago creado.');
        this.saved.emit(res.method);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    if (!this.saving()) this.cancelled.emit();
  }
}
