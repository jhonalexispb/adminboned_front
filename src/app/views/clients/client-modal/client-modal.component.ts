import {
  Component, Input, OnInit, OnDestroy, signal, AfterViewInit, NgZone,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { switchMap, forkJoin, of } from 'rxjs';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { Select } from 'primeng/select';
import * as L from 'leaflet';
import { ClientService } from '../client.service';
import { Client } from '../client.model';
import { GeographyService, Department, Province, District } from '../../../core/services/geography.service';
import { ConsultationService, RucResult } from '../../../core/services/consultation.service';
import { ToastService } from '../../../core/services/toast.service';

// Fix leaflet default marker icons
const iconDefault = L.icon({
  iconUrl:       'assets/leaflet/marker-icon.png',
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  shadowUrl:     'assets/leaflet/marker-shadow.png',
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
});

@Component({
  selector: 'app-client-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective, Select, DecimalPipe, SpinnerComponent],
  templateUrl: './client-modal.component.html'
})
export class ClientModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() client: Client | null = null;
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  form!: FormGroup;
  error = '';

  departments = signal<Department[]>([]);
  provinces   = signal<Province[]>([]);
  districts   = signal<District[]>([]);

  loadingDeps  = signal(false);
  loadingProvs = signal(false);
  loadingDists = signal(false);
  saving       = signal(false);

  private preloading = false;

  // DNI / RUC lookup
  consultingDni = signal(false);
  consultingRuc = signal(false);
  rucResult     = signal<RucResult | null>(null);
  dniError      = '';
  rucError      = '';

  // Map
  private map!: L.Map;
  private marker!: L.Marker;
  gettingLocation = signal(false);
  locationError   = '';

  // Default center: Lima, Perú
  private readonly defaultLat = -12.046374;
  private readonly defaultLng = -77.042793;

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private clientService: ClientService,
    private geoService: GeographyService,
    private consultService: ConsultationService,
    private toast: ToastService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  get isEdit(): boolean { return !!this.client; }
  get title(): string   { return this.isEdit ? 'Editar cliente' : 'Nuevo cliente'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      business_name: [this.client?.business_name ?? '', [Validators.required]],
      name:          [this.client?.name ?? '',          [Validators.maxLength(200)]],
      contact_name:  [this.client?.contact_name ?? '', [Validators.maxLength(200)]],
      dni:           [this.client?.dni ?? '',           [Validators.pattern(/^\d{8}$/)]],
      ruc:           [this.client?.ruc ?? '',           [Validators.pattern(/^\d{11}$/)]],
      phone:         [this.client?.phone ?? ''],
      email:         [this.client?.email ?? '',         [Validators.email]],
      address:       [this.client?.address ?? '', [Validators.required]],
      latitude:      [this.client?.latitude ?? null],
      longitude:     [this.client?.longitude ?? null],
      department_id: [null, [Validators.required]],
      province_id:   [{ value: null, disabled: true }, [Validators.required]],
      district_id:   [{ value: null, disabled: true }, [Validators.required]],
      active:        [this.client?.active ?? true],
    });

    // Cascade departamento → provincias
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

    // Cascade provincia → distritos
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

    if (this.isEdit && this.client!.district) {
      this.loadGeoForEdit(this.client!.district.id);
    } else {
      this.loadingDeps.set(true);
      this.geoService.departments().subscribe(d => {
        this.departments.set(d);
        this.loadingDeps.set(false);
      });
    }
  }

  consultDni(): void {
    const dni = this.form.get('dni')?.value?.trim();
    if (!dni || !/^\d{8}$/.test(dni)) return;
    this.consultingDni.set(true);
    this.dniError = '';
    this.consultService.dni(dni).subscribe({
      next: res => {
        this.form.patchValue({ contact_name: res.nombre_completo });
        this.consultingDni.set(false);
      },
      error: err => {
        this.dniError = err.error?.message ?? 'No se pudo consultar el DNI.';
        this.consultingDni.set(false);
      }
    });
  }

  consultRuc(): void {
    const ruc = this.form.get('ruc')?.value?.trim();
    if (!ruc || !/^\d{11}$/.test(ruc)) return;
    this.consultingRuc.set(true);
    this.rucError = '';
    this.rucResult.set(null);
    this.consultService.ruc(ruc).subscribe({
      next: res => {
        this.rucResult.set(res);
        // Pre-llenar nombre del negocio si está vacío
        if (!this.form.get('business_name')?.value) {
          this.form.patchValue({ business_name: res.razon_social });
        }
        if (!this.form.get('name')?.value && res.nombre_comercial) {
          this.form.patchValue({ name: res.nombre_comercial });
        }
        this.consultingRuc.set(false);
      },
      error: err => {
        this.rucError = err.error?.message ?? 'No se pudo consultar el RUC.';
        this.consultingRuc.set(false);
      }
    });
  }

  ngAfterViewInit(): void {
    // requestAnimationFrame garantiza que el browser terminó de pintar el layout
    // antes de que Leaflet mida el contenedor
    requestAnimationFrame(() => this.initMap());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    const lat = this.client?.latitude  ?? this.defaultLat;
    const lng = this.client?.longitude ?? this.defaultLng;
    const hasCoords = !!this.client?.latitude;

    // Usar nativeElement evita que Leaflet use getBoundingClientRect sobre un elemento
    // cuyo ancestro todavía tiene un transform activo
    this.map = L.map(this.mapEl.nativeElement, { zoomControl: true });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.setView([lat, lng], hasCoords ? 16 : 12);

    // Segundo frame: el browser ya pintó el mapa, ahora corregimos cualquier desajuste
    requestAnimationFrame(() => this.map.invalidateSize());

    if (hasCoords) {
      this.marker = L.marker([lat, lng], { icon: iconDefault, draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => this.onMarkerMove());
    }

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.zone.run(() => this.placeMarker(e.latlng.lat, e.latlng.lng));
    });
  }

  private placeMarker(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { icon: iconDefault, draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => this.onMarkerMove());
    }
    this.form.patchValue({ latitude: lat, longitude: lng });
    this.locationError = '';
    this.cdr.detectChanges();
  }

  private onMarkerMove(): void {
    const pos = this.marker.getLatLng();
    this.zone.run(() => {
      this.form.patchValue({ latitude: pos.lat, longitude: pos.lng });
      this.cdr.detectChanges();
    });
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationError = 'Tu navegador no soporta geolocalización.';
      return;
    }
    this.gettingLocation.set(true);
    this.locationError = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.zone.run(() => {
          const { latitude, longitude } = pos.coords;
          this.placeMarker(latitude, longitude);
          this.map.setView([latitude, longitude], 17);
          this.gettingLocation.set(false);
        });
      },
      () => {
        this.zone.run(() => {
          this.locationError = 'No se pudo obtener la ubicación. Verifica los permisos del navegador.';
          this.gettingLocation.set(false);
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  clearCoords(): void {
    this.form.patchValue({ latitude: null, longitude: null });
    if (this.marker) {
      this.marker.remove();
      this.marker = undefined!;
    }
  }

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
        this.form.get('province_id')!.enable({ emitEvent: false });
        this.form.get('district_id')!.enable({ emitEvent: false });
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
      name:          raw.name,
      business_name: raw.business_name || null,
      contact_name:  raw.contact_name  || null,
      dni:           raw.dni           || null,
      ruc:           raw.ruc           || null,
      phone:         raw.phone         || null,
      email:         raw.email         || null,
      address:       raw.address       || null,
      latitude:      raw.latitude      ? Number(raw.latitude)  : null,
      longitude:     raw.longitude     ? Number(raw.longitude) : null,
      district_id:   raw.district_id   ? Number(raw.district_id) : null,
      active:        raw.active,
    };

    const request = this.isEdit
      ? this.clientService.update(this.client!.id, payload)
      : this.clientService.create(payload);

    request.subscribe({
      next: res => {
        this.toast.success(this.isEdit ? 'Cliente actualizado.' : 'Cliente creado.');
        this.modal.close(res.client);
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
