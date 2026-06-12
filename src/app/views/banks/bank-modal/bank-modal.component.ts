import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { BankService } from '../bank.service';
import { ToastService } from '../../../core/services/toast.service';
import { Bank } from '../../payments/collection.model';

@Component({
  selector: 'app-bank-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './bank-modal.component.html',
})
export class BankModalComponent {
  open = input<boolean>(false);
  bank = input<Bank | null>(null);

  saved     = output<Bank>();
  cancelled = output<void>();

  name   = '';
  saving = signal(false);

  constructor(private svc: BankService, private toast: ToastService) {
    effect(() => {
      const b = this.bank();
      this.name = b ? b.name : '';
    });
  }

  get isEditMode(): boolean { return !!this.bank(); }
  get isValid():    boolean { return this.name.trim().length > 0; }

  submit(): void {
    if (this.saving() || !this.isValid) return;
    this.saving.set(true);
    const b = this.bank();
    const req = b
      ? this.svc.update(b.id, { name: this.name.trim() })
      : this.svc.create(this.name.trim());

    req.subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.success(b ? 'Banco actualizado.' : 'Banco creado.');
        this.saved.emit(res.bank);
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
