import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { switchMap, of, forkJoin } from 'rxjs';
import { GeoAdminService, AdminDistrict } from '../geo-admin.service';
import { GeographyService, Department, Province } from '../../../core/services/geography.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-district-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective, SpinnerComponent],
  templateUrl: './district-modal.component.html',
})
export class DistrictModalComponent implements OnInit {
  @Input() district: AdminDistrict | null = null;

  form!: FormGroup;
  saving      = signal(false);
  error       = '';
  departments = signal<Department[]>([]);
  provinces   = signal<Province[]>([]);
  loadingDeps  = signal(false);
  loadingProvs = signal(false);
  private preloading = false;

  get isEdit(): boolean { return !!this.district; }
  get title(): string   { return this.isEdit ? 'Editar distrito' : 'Nuevo distrito'; }

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private svc: GeoAdminService,
    private geoSvc: GeographyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name:          [this.district?.name ?? '',  [Validators.required, Validators.maxLength(100)]],
      department_id: [this.district?.department_id ?? null, [Validators.required]],
      province_id:   [{ value: this.district?.province_id ?? null, disabled: !this.district }, [Validators.required]],
      code:          [this.district?.code ?? '', [Validators.maxLength(6)]],
    });

    this.form.get('department_id')!.valueChanges.subscribe(depId => {
      if (this.preloading) return;
      this.form.get('province_id')!.setValue(null, { emitEvent: false });
      this.provinces.set([]);
      this.form.get('province_id')!.disable();
      if (!depId) return;
      this.loadingProvs.set(true);
      this.geoSvc.provinces(depId).subscribe(p => {
        this.provinces.set(p);
        this.form.get('province_id')!.enable();
        this.loadingProvs.set(false);
      });
    });

    if (this.isEdit && this.district) {
      this.loadGeoForEdit(this.district.department_id, this.district.province_id);
    } else {
      this.loadingDeps.set(true);
      this.geoSvc.departments().subscribe(d => {
        this.departments.set(d);
        this.loadingDeps.set(false);
      });
    }
  }

  private loadGeoForEdit(departmentId: number, provinceId: number): void {
    this.preloading = true;
    this.loadingDeps.set(true);
    forkJoin({
      deps:  this.geoSvc.departments(),
      provs: this.geoSvc.provinces(departmentId),
    }).subscribe({
      next: ({ deps, provs }) => {
        this.departments.set(deps);
        this.provinces.set(provs);
        this.form.get('province_id')!.enable({ emitEvent: false });
        this.form.patchValue({ department_id: departmentId, province_id: provinceId }, { emitEvent: false });
        this.loadingDeps.set(false);
        this.preloading = false;
      },
      error: () => {
        this.geoSvc.departments().subscribe(d => this.departments.set(d));
        this.loadingDeps.set(false);
        this.preloading = false;
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.error = '';
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      name:        raw.name.trim(),
      province_id: Number(raw.province_id),
      code:        raw.code?.trim() || null,
    };
    const req = this.isEdit
      ? this.svc.updateDistrict(this.district!.id, payload)
      : this.svc.createDistrict(payload);
    req.subscribe({
      next: res => { this.toast.success(res.message); this.modal.close(res.district); },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors ? (Object.values(errors)[0] as string[])[0] : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      },
    });
  }
}
