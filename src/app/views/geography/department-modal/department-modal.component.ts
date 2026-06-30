import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { GeoAdminService, AdminDepartment } from '../geo-admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-department-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective, SpinnerComponent],
  templateUrl: './department-modal.component.html',
})
export class DepartmentModalComponent implements OnInit {
  @Input() department: AdminDepartment | null = null;

  form!: FormGroup;
  saving = signal(false);
  error  = '';

  get isEdit(): boolean { return !!this.department; }
  get title(): string   { return this.isEdit ? 'Editar departamento' : 'Nuevo departamento'; }

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private svc: GeoAdminService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.department?.name ?? '', [Validators.required, Validators.maxLength(100)]],
      code: [this.department?.code ?? '', [Validators.maxLength(10)]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.error = '';
    this.saving.set(true);
    const payload = { name: this.form.value.name.trim(), code: this.form.value.code?.trim() || null };
    const req = this.isEdit
      ? this.svc.updateDepartment(this.department!.id, payload)
      : this.svc.createDepartment(payload);
    req.subscribe({
      next: res => { this.toast.success(res.message); this.modal.close(res.department); },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors ? (Object.values(errors)[0] as string[])[0] : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      },
    });
  }
}
