import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { GeoAdminService, AdminProvince } from '../geo-admin.service';
import { GeographyService, Department } from '../../../core/services/geography.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-province-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective, SpinnerComponent],
  templateUrl: './province-modal.component.html',
})
export class ProvinceModalComponent implements OnInit {
  @Input() province: AdminProvince | null = null;

  form!: FormGroup;
  saving      = signal(false);
  error       = '';
  departments = signal<Department[]>([]);
  loadingDeps = signal(false);

  get isEdit(): boolean { return !!this.province; }
  get title(): string   { return this.isEdit ? 'Editar provincia' : 'Nueva provincia'; }

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private svc: GeoAdminService,
    private geoSvc: GeographyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name:          [this.province?.name ?? '',  [Validators.required, Validators.maxLength(100)]],
      department_id: [this.province?.department_id ?? null, [Validators.required]],
      code:          [this.province?.code ?? '', [Validators.maxLength(10)]],
    });

    this.loadingDeps.set(true);
    this.geoSvc.departments().subscribe(d => {
      this.departments.set(d);
      this.loadingDeps.set(false);
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.error = '';
    this.saving.set(true);
    const raw = this.form.value;
    const payload = {
      name:          raw.name.trim(),
      department_id: Number(raw.department_id),
      code:          raw.code?.trim() || null,
    };
    const req = this.isEdit
      ? this.svc.updateProvince(this.province!.id, payload)
      : this.svc.createProvince(payload);
    req.subscribe({
      next: res => { this.toast.success(res.message); this.modal.close(res.province); },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors ? (Object.values(errors)[0] as string[])[0] : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      },
    });
  }
}
