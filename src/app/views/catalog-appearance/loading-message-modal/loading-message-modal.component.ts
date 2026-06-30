import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SpinnerComponent } from '@coreui/angular';
import { CatalogAppearanceService } from '../catalog-appearance.service';
import { CatalogLoadingMessage } from '../catalog-appearance.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-loading-message-modal',
  standalone: true,
  imports: [ReactiveFormsModule, SpinnerComponent],
  templateUrl: './loading-message-modal.component.html'
})
export class LoadingMessageModalComponent implements OnInit {
  @Input() loadingMessage: CatalogLoadingMessage | null = null;
  @Input() nextSortOrder = 0;

  form!: FormGroup;
  error = '';
  saving = signal(false);

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private svc: CatalogAppearanceService,
    private toast: ToastService,
  ) {}

  get isEdit(): boolean { return !!this.loadingMessage; }
  get title(): string   { return this.isEdit ? 'Editar mensaje' : 'Nuevo mensaje de carga'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      message: [this.loadingMessage?.message ?? '', [Validators.required, Validators.maxLength(160)]],
      active:  [this.loadingMessage?.active ?? true],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.error = '';
    this.saving.set(true);

    const request = this.isEdit
      ? this.svc.updateLoadingMessage(this.loadingMessage!.id, this.form.value)
      : this.svc.createLoadingMessage({ ...this.form.value, sort_order: this.nextSortOrder });

    request.subscribe({
      next: res => {
        this.toast.success(res.message);
        this.modal.close(res.item);
      },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      }
    });
  }
}
