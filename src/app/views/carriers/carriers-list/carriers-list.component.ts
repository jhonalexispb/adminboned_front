import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, CardHeaderComponent,
  FormControlDirective, SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { Subject, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { SalesService } from '../../quotations/sales.service';
import { Carrier } from '../../quotations/sales.model';
import { GeographyService, Department, Province, District } from '../../../core/services/geography.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-carriers-list',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    FormControlDirective, SpinnerComponent, TableDirective,
    Select, PageHeaderComponent,
  ],
  templateUrl: './carriers-list.component.html',
})
export class CarriersListComponent implements OnInit, OnDestroy {
  carriers   = signal<Carrier[]>([]);
  loading    = signal(true);
  saving     = signal(false);
  deletingId = signal<number | null>(null);

  search       = signal('');
  filterActive = signal<boolean | ''>('');

  filtered = computed(() => {
    const s = this.search().toLowerCase().trim();
    const a = this.filterActive();
    return this.carriers().filter(c => {
      const matchSearch = !s
        || c.name.toLowerCase().includes(s)
        || (c.phone ?? '').includes(s)
        || (c.ruc ?? '').toLowerCase().includes(s);
      const matchActive = a === '' || c.active === a;
      return matchSearch && matchActive;
    });
  });

  form!: FormGroup;
  editingId = signal<number | null>(null);
  showForm  = signal(false);

  // Geography cascade
  departments  = signal<Department[]>([]);
  provinces    = signal<Province[]>([]);
  districts    = signal<District[]>([]);
  loadingProvs = signal(false);
  loadingDists = signal(false);
  private preloading  = false;
  private geoDestroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private sales: SalesService,
    private geoService: GeographyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.geoService.departments().subscribe(d => this.departments.set(d));
  }

  ngOnDestroy(): void {
    this.geoDestroy$.next();
    this.geoDestroy$.complete();
  }

  private buildForm(carrier?: Carrier): void {
    this.geoDestroy$.next();
    this.preloading = false;
    this.provinces.set([]);
    this.districts.set([]);

    this.form = this.fb.group({
      name:          [carrier?.name    ?? '',   [Validators.required]],
      ruc:           [carrier?.ruc     ?? null, [Validators.pattern(/^\d{11}$/)]],
      phone:         [carrier?.phone   ?? null],
      address:       [carrier?.address ?? null],
      notes:         [carrier?.notes   ?? null],
      active:        [carrier?.active  ?? true],
      department_id: [null],
      province_id:   [{ value: null, disabled: true }],
      district_id:   [{ value: null, disabled: true }],
    });

    this.form.get('department_id')!.valueChanges
      .pipe(takeUntil(this.geoDestroy$))
      .subscribe(depId => {
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

    this.form.get('province_id')!.valueChanges
      .pipe(takeUntil(this.geoDestroy$))
      .subscribe(provId => {
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

    if (carrier?.district?.id) {
      this.loadGeoForEdit(carrier.district.id);
    }
  }

  private loadGeoForEdit(districtId: number): void {
    this.preloading = true;
    this.geoService.locate(districtId).pipe(
      switchMap(loc => forkJoin({
        loc:   of(loc),
        provs: this.geoService.provinces(loc.department_id),
        dists: this.geoService.districts(loc.province_id),
      }))
    ).subscribe({
      next: ({ loc, provs, dists }) => {
        this.provinces.set(provs);
        this.districts.set(dists);
        this.form.get('province_id')!.enable({ emitEvent: false });
        this.form.get('district_id')!.enable({ emitEvent: false });
        this.form.patchValue({
          department_id: loc.department_id,
          province_id:   loc.province_id,
          district_id:   loc.district_id,
        }, { emitEvent: false });
        this.preloading = false;
      },
      error: () => { this.preloading = false; },
    });
  }

  load(): void {
    this.loading.set(true);
    this.sales.listCarriers(false).subscribe({
      next: cs => { this.carriers.set(cs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.editingId.set(null);
    this.buildForm();
    this.showForm.set(true);
  }

  openEdit(c: Carrier): void {
    this.editingId.set(c.id);
    this.buildForm(c);
    this.showForm.set(true);
  }

  cancel(): void {
    this.geoDestroy$.next();
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    this.saving.set(true);

    const payload = {
      name:        raw.name,
      ruc:         raw.ruc      || null,
      phone:       raw.phone    || null,
      address:     raw.address  || null,
      notes:       raw.notes    || null,
      active:      raw.active,
      district_id: raw.district_id ? Number(raw.district_id) : null,
    };

    const id = this.editingId();
    const obs$ = id
      ? this.sales.updateCarrier(id, payload)
      : this.sales.createCarrier(payload);

    obs$.subscribe({
      next: res => {
        this.toast.success(res.message);
        this.load();
        this.cancel();
        this.saving.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      },
    });
  }

  delete(c: Carrier): void {
    if (!confirm(`¿Eliminar a "${c.name}"?`)) return;
    this.deletingId.set(c.id);
    this.sales.deleteCarrier(c.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.load();
        this.deletingId.set(null);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.deletingId.set(null);
      },
    });
  }
}
