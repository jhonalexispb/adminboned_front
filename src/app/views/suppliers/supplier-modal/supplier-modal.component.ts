import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { switchMap, forkJoin, of } from 'rxjs';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { Select } from 'primeng/select';
import { SupplierService } from '../supplier.service';
import { Supplier } from '../supplier.model';
import { GeographyService, Department, Province, District } from '../../../core/services/geography.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-supplier-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective, Select, SpinnerComponent],
  templateUrl: './supplier-modal.component.html'
})
export class SupplierModalComponent implements OnInit {
  @Input() supplier: Supplier | null = null;

  form!: FormGroup;
  error = '';

  departments = signal<Department[]>([]);
  provinces   = signal<Province[]>([]);
  districts   = signal<District[]>([]);

  // Flags de carga individuales por selector
  loadingDeps  = signal(false);
  loadingProvs = signal(false);
  loadingDists = signal(false);
  saving       = signal(false);

  // Flag maestro: true mientras se hace el preload al editar
  // Evita que los listeners de valueChanges rompan la carga en cascada
  private preloading = false;

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private supplierService: SupplierService,
    private geoService: GeographyService,
    private toast: ToastService
  ) {}

  get isEdit(): boolean { return !!this.supplier; }
  get title(): string   { return this.isEdit ? 'Editar proveedor' : 'Nuevo proveedor'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      name:         [this.supplier?.name ?? '',  [Validators.required, Validators.maxLength(200)]],
      ruc:          [this.supplier?.ruc ?? ''],
      contact_name: [this.supplier?.contact_name ?? ''],
      phone:        [this.supplier?.phone ?? ''],
      email:        [this.supplier?.email ?? '', [Validators.email]],
      address:      [this.supplier?.address ?? ''],
      department_id:[null],
      province_id:  [{ value: null, disabled: true }],
      district_id:  [{ value: null, disabled: true }],
      active:       [this.supplier?.active ?? true]
    });

    // Cascada departamento → provincias
    this.form.get('department_id')!.valueChanges.subscribe(depId => {
      if (this.preloading) return;

      this.form.get('province_id')!.setValue(null, { emitEvent: false });
      this.form.get('district_id')!.setValue(null, { emitEvent: false });
      this.provinces.set([]);
      this.districts.set([]);
      this.form.get('province_id')!.disable();
      this.form.get('district_id')!.disable();

      if (!depId) return;

      this.loadingProvs.set(true);
      this.geoService.provinces(depId).subscribe(p => {
        this.provinces.set(p);
        this.form.get('province_id')!.enable();
        this.loadingProvs.set(false);
      });
    });

    // Cascada provincia → distritos
    this.form.get('province_id')!.valueChanges.subscribe(provId => {
      if (this.preloading) return;

      this.form.get('district_id')!.setValue(null, { emitEvent: false });
      this.districts.set([]);
      this.form.get('district_id')!.disable();

      if (!provId) return;

      this.loadingDists.set(true);
      this.geoService.districts(provId).subscribe(d => {
        this.districts.set(d);
        this.form.get('district_id')!.enable();
        this.loadingDists.set(false);
      });
    });

    if (this.isEdit && this.supplier!.district) {
      this.loadGeoForEdit(this.supplier!.district.id);
    } else {
      this.loadingDeps.set(true);
      this.geoService.departments().subscribe(d => {
        this.departments.set(d);
        this.loadingDeps.set(false);
      });
    }
  }

  /** Al editar: carga la jerarquía completa y pre-selecciona los tres selectores */
  private loadGeoForEdit(districtId: number): void {
    this.preloading = true;
    this.loadingDeps.set(true);

    this.geoService.locate(districtId).pipe(
      switchMap(loc =>
        forkJoin({
          loc:   of(loc),
          deps:  this.geoService.departments(),
          provs: this.geoService.provinces(loc.department_id),
          dists: this.geoService.districts(loc.province_id),
        })
      )
    ).subscribe({
      next: ({ loc, deps, provs, dists }) => {
        this.departments.set(deps);
        this.provinces.set(provs);
        this.districts.set(dists);

        // Habilita antes de patchear para que p-select muestre los valores
        this.form.get('province_id')!.enable({ emitEvent: false });
        this.form.get('district_id')!.enable({ emitEvent: false });

        // emitEvent:false evita que los listeners de valueChanges se disparen
        this.form.patchValue({
          department_id: loc.department_id,
          province_id:   loc.province_id,
          district_id:   loc.district_id,
        }, { emitEvent: false });

        this.loadingDeps.set(false);
        this.preloading = false;
      },
      error: () => {
        this.geoService.departments().subscribe(d => this.departments.set(d));
        this.loadingDeps.set(false);
        this.preloading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.error = '';
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const payload = {
      name:         raw.name,
      ruc:          raw.ruc          || null,
      contact_name: raw.contact_name || null,
      phone:        raw.phone        || null,
      email:        raw.email        || null,
      address:      raw.address      || null,
      district_id:  raw.district_id  ? Number(raw.district_id) : null,
      active:       raw.active,
    };

    const request = this.isEdit
      ? this.supplierService.update(this.supplier!.id, payload)
      : this.supplierService.create(payload);

    request.subscribe({
      next: res => {
        this.toast.success(this.isEdit ? 'Proveedor actualizado.' : 'Proveedor creado.');
        this.modal.close(res.supplier);
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
