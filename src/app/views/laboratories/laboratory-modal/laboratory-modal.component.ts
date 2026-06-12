import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { switchMap, of, forkJoin } from 'rxjs';
import { FormControlDirective } from '@coreui/angular';
import { LaboratoryService } from '../laboratory.service';
import { Laboratory } from '../laboratory.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-laboratory-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective],
  templateUrl: './laboratory-modal.component.html'
})
export class LaboratoryModalComponent implements OnInit {
  @Input() laboratory: Laboratory | null = null;

  form!: FormGroup;
  error = '';

  logoFile:   File | null = null;
  bannerFile: File | null = null;
  logoPreview:   string | null = null;
  bannerPreview: string | null = null;

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private labService: LaboratoryService,
    private toast: ToastService
  ) {}

  get isEdit(): boolean { return !!this.laboratory; }
  get title(): string   { return this.isEdit ? 'Editar laboratorio' : 'Nuevo laboratorio'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      name:        [this.laboratory?.name ?? '',        [Validators.required, Validators.maxLength(150)]],
      description: [this.laboratory?.description ?? ''],
      active:      [this.laboratory?.active ?? true]
    });

    // Previews iniciales si estamos editando
    if (this.laboratory) {
      this.logoPreview   = this.laboratory.logo_url;
      this.bannerPreview = this.laboratory.banner_url;
    }
  }

  onLogoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.logoFile = file;
    this.logoPreview = URL.createObjectURL(file);
  }

  onBannerChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.bannerFile = file;
    this.bannerPreview = URL.createObjectURL(file);
  }

  clearLogo(): void {
    this.logoFile    = null;
    this.logoPreview = null;
  }

  clearBanner(): void {
    this.bannerFile    = null;
    this.bannerPreview = null;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.error = '';

    const saveText$ = this.isEdit
      ? this.labService.update(this.laboratory!.id, this.form.value)
      : this.labService.create(this.form.value);

    let savedLab: Laboratory;

    saveText$.pipe(
      switchMap(res => {
        savedLab = res.laboratory;
        const labId = res.laboratory.id;
        const uploads$ = [];

        if (this.logoFile)   uploads$.push(this.labService.uploadLogo(labId, this.logoFile));
        if (this.bannerFile) uploads$.push(this.labService.uploadBanner(labId, this.bannerFile));

        // Si el logo o banner fue limpiado (era un existente y se borró la preview)
        if (this.isEdit && !this.logoPreview && !this.logoFile && this.laboratory!.logo_url) {
          uploads$.push(this.labService.deleteLogo(labId));
        }
        if (this.isEdit && !this.bannerPreview && !this.bannerFile && this.laboratory!.banner_url) {
          uploads$.push(this.labService.deleteBanner(labId));
        }

        return uploads$.length ? forkJoin(uploads$) : of([]);
      })
    ).subscribe({
      next: () => {
        this.toast.success(this.isEdit ? 'Laboratorio actualizado.' : 'Laboratorio creado.');
        this.modal.close(savedLab);
      },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
      }
    });
  }
}
