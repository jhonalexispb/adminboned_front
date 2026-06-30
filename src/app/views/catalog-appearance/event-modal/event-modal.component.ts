import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { CatalogAppearanceService } from '../catalog-appearance.service';
import { CatalogBackground } from '../catalog-appearance.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-event-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective, SpinnerComponent],
  templateUrl: './event-modal.component.html'
})
export class EventModalComponent implements OnInit {
  @Input() event: CatalogBackground | null = null;

  form!: FormGroup;
  error = '';
  saving = signal(false);
  imageFile: File | null = null;
  previewUrl: string | null = null;

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private svc: CatalogAppearanceService,
    private toast: ToastService,
  ) {}

  get isEdit(): boolean { return !!this.event; }
  get title(): string   { return this.isEdit ? 'Editar evento' : 'Nuevo evento especial'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      label:     [this.event?.label ?? '', [Validators.maxLength(60)]],
      effect:    [this.event?.effect ?? 'none'],
      starts_at: [this.event?.starts_at ?? ''],
      ends_at:   [this.event?.ends_at ?? ''],
      active:    [this.event?.active ?? true],
    });
    this.previewUrl = this.event?.image_url ?? null;
  }

  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.imageFile = file;
    if (file) this.previewUrl = URL.createObjectURL(file);
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    if (!this.isEdit && !this.imageFile) {
      this.error = 'Selecciona una imagen para el evento.';
      return;
    }

    this.error = '';
    this.saving.set(true);

    const payload = {
      ...this.form.value,
      label: this.form.value.label || null,
      effect: this.form.value.effect || 'none',
      starts_at: this.form.value.starts_at || null,
      ends_at: this.form.value.ends_at || null,
      image: this.imageFile,
    };

    const request = this.isEdit
      ? this.svc.updateBackground(this.event!.id, payload)
      : this.svc.createBackground({ ...payload, slot: 'event' });

    request.subscribe({
      next: res => {
        this.toast.success(res.message);
        this.modal.close(res.background);
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
