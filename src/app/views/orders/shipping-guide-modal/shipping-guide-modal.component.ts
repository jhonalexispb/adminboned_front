import { Component, OnInit, input, output, effect, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ModalComponent, ModalHeaderComponent, ModalTitleDirective,
  ModalBodyComponent, ModalFooterComponent, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { forkJoin, of, switchMap, Observable } from 'rxjs';
import { SalesService } from '../../quotations/sales.service';
import { Order } from '../../quotations/sales.model';
import { GeographyService, Department, Province, District, GeoLocation } from '../../../core/services/geography.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmpresaService } from '../../../core/services/empresa.service';

@Component({
  selector: 'app-shipping-guide-modal',
  standalone: true,
  imports: [
    DatePipe, FormsModule, FaIconComponent, Select,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective,
    ModalBodyComponent, ModalFooterComponent, SpinnerComponent,
  ],
  templateUrl: './shipping-guide-modal.component.html',
})
export class ShippingGuideModalComponent implements OnInit {
  order     = input<Order | null>(null);
  saved     = output<{ message: string; guide: any }>();
  cancelled = output<void>();

  loading    = signal(false);
  submitting = signal(false);
  fullOrder  = signal<Order | null>(null);

  form = {
    transfer_date:   new Date().toISOString().slice(0, 10),
    transfer_reason: '01',
    peso_bruto:      null as number | null,
    unidad_peso:     'KGM',
    notes:           '',
    partida_address:     '',
    partida_district_id: null as number | null,
    destination_address:     '',
    destination_district_id: null as number | null,
    mod_traslado:    '02',
    es_m1l:          true,
    carrier_name:    '',
    carrier_ruc:     '',
    carrier_nro_mtc: '',
    vehicle_plate:   '',
    conductor_tipo_doc:  '1',
    conductor_nombres:   '',
    conductor_apellidos: '',
    driver_doc:          '',
    conductor_licencia:  '',
  };

  departments   = signal<Department[]>([]);
  partProvinces = signal<Province[]>([]);
  partDistricts = signal<District[]>([]);
  llegProvinces = signal<Province[]>([]);
  llegDistricts = signal<District[]>([]);
  loadingGeo    = signal(false);
  partDeptId: number | null = null;
  partProvId: number | null = null;
  llegDeptId: number | null = null;
  llegProvId: number | null = null;

  readonly motivoOptions = [
    { code: '01', label: 'Venta' },
    { code: '02', label: 'Compra' },
    { code: '04', label: 'Traslado entre establecimientos' },
    { code: '13', label: 'Otros' },
    { code: '14', label: 'Venta sujeta a confirmación' },
    { code: '17', label: 'Traslado para transformación' },
    { code: '18', label: 'Consignación' },
  ];

  readonly tipoDocOptions = [
    { code: '1', label: 'DNI' },
    { code: '4', label: 'Carné de Extranjería' },
    { code: '7', label: 'Pasaporte' },
    { code: 'A', label: 'Otro' },
  ];

  constructor(
    private sales: SalesService,
    private geoService: GeographyService,
    private empresaService: EmpresaService,
    private toast: ToastService,
  ) {
    effect(() => {
      const o = this.order();
      if (o) this.initModal(o);
    });
  }

  ngOnInit(): void {
    this.geoService.departments().subscribe(d => this.departments.set(d));
  }

  private initModal(o: Order): void {
    this.fullOrder.set(null);
    this.loading.set(true);
    this.loadingGeo.set(true);
    this.resetGeo();

    const carrier = o.shipping?.carrier;
    this.form = {
      transfer_date: new Date().toISOString().slice(0, 10),
      transfer_reason: '01',
      peso_bruto: null,
      unidad_peso: 'KGM',
      notes: '',
      partida_address: carrier?.address ?? '',
      partida_district_id: null,
      destination_address: o.client?.address ?? '',
      destination_district_id: null,
      mod_traslado: '02',
      es_m1l: true,
      carrier_name:    carrier?.name ?? '',
      carrier_ruc:     carrier?.ruc  ?? '',
      carrier_nro_mtc: '',
      vehicle_plate: '',
      conductor_tipo_doc: '1',
      conductor_nombres: '',
      conductor_apellidos: '',
      driver_doc: '',
      conductor_licencia: '',
    };

    forkJoin({
      orderRes: this.sales.getOrder(o.id),
      empresa:  this.empresaService.get(),
    }).subscribe({
      next: ({ orderRes: res, empresa }) => {
        this.fullOrder.set(res.order);
        this.loading.set(false);
        if (res.order.client?.address) this.form.destination_address = res.order.client.address;

        const clientDistrictId  = res.order.client?.district?.id;
        const carrierDistrictId = res.order.shipping?.carrier?.district?.id;

        // Punto de partida: por defecto la dirección de la empresa; si no está
        // configurada, se usa la del transportista como respaldo.
        if (empresa?.direccion) {
          this.form.partida_address = empresa.direccion;
        } else if (res.order.shipping?.carrier?.address) {
          this.form.partida_address = res.order.shipping.carrier.address;
        }

        const locates: Array<Observable<{ loc: GeoLocation; provs: Province[]; dists: District[]; side: 'llega' | 'partida' }>> = [];
        if (clientDistrictId) {
          locates.push(this.buildLocate(this.geoService.locate(clientDistrictId), 'llega'));
        }

        const partidaSource$ = empresa?.ubigeo
          ? this.geoService.locateByUbigeo(empresa.ubigeo)
          : carrierDistrictId
            ? this.geoService.locate(carrierDistrictId)
            : null;

        if (partidaSource$) {
          locates.push(this.buildLocate(partidaSource$, 'partida'));
        }

        if (locates.length === 0) { this.loadingGeo.set(false); return; }

        forkJoin(locates).subscribe({
          next: results => {
            for (const { loc, provs, dists, side } of results) {
              if (side === 'llega') {
                this.llegProvinces.set(provs);
                this.llegDistricts.set(dists);
                this.llegDeptId = loc.department_id;
                this.llegProvId = loc.province_id;
                this.form.destination_district_id = loc.district_id;
              } else {
                this.partProvinces.set(provs);
                this.partDistricts.set(dists);
                this.partDeptId = loc.department_id;
                this.partProvId = loc.province_id;
                this.form.partida_district_id = loc.district_id;
              }
            }
            this.loadingGeo.set(false);
          },
          error: () => this.loadingGeo.set(false),
        });
      },
      error: () => {
        this.toast.error('No se pudo cargar el pedido.');
        this.loading.set(false);
        this.loadingGeo.set(false);
        this.cancelled.emit();
      },
    });
  }

  private buildLocate(source$: ReturnType<GeographyService['locate']>, side: 'llega' | 'partida') {
    return source$.pipe(
      switchMap(loc => forkJoin({
        loc:   of(loc),
        provs: this.geoService.provinces(loc.department_id),
        dists: this.geoService.districts(loc.province_id),
        side:  of(side),
      }))
    );
  }

  private resetGeo(): void {
    this.partProvinces.set([]); this.partDistricts.set([]);
    this.partDeptId = null;     this.partProvId = null;
    this.llegProvinces.set([]); this.llegDistricts.set([]);
    this.llegDeptId = null;     this.llegProvId = null;
  }

  onPartDeptChange(id: number | null): void {
    this.partDeptId = id; this.partProvId = null;
    this.form.partida_district_id = null;
    this.partProvinces.set([]); this.partDistricts.set([]);
    if (id) this.geoService.provinces(id).subscribe(p => this.partProvinces.set(p));
  }
  onPartProvChange(id: number | null): void {
    this.partProvId = id; this.form.partida_district_id = null;
    this.partDistricts.set([]);
    if (id) this.geoService.districts(id).subscribe(d => this.partDistricts.set(d));
  }
  onLlegDeptChange(id: number | null): void {
    this.llegDeptId = id; this.llegProvId = null;
    this.form.destination_district_id = null;
    this.llegProvinces.set([]); this.llegDistricts.set([]);
    if (id) this.geoService.provinces(id).subscribe(p => this.llegProvinces.set(p));
  }
  onLlegProvChange(id: number | null): void {
    this.llegProvId = id; this.form.destination_district_id = null;
    this.llegDistricts.set([]);
    if (id) this.geoService.districts(id).subscribe(d => this.llegDistricts.set(d));
  }

  get canSubmit(): boolean {
    return !!(
      this.form.destination_address?.trim() &&
      this.form.destination_district_id &&
      this.form.transfer_date &&
      this.form.peso_bruto && this.form.peso_bruto > 0 &&
      (!this.needsTransportista || !!this.form.carrier_ruc?.trim()) &&
      (!this.needsVehicle       || !!this.form.vehicle_plate?.trim())
    );
  }

  submit(): void {
    const o = this.fullOrder();
    if (!o || this.submitting()) return;
    if (!this.form.destination_address?.trim())  { this.toast.error('La dirección de destino es requerida.'); return; }
    if (!this.form.destination_district_id)      { this.toast.error('Selecciona el distrito de destino.'); return; }
    if (!this.form.transfer_date)                { this.toast.error('La fecha de traslado es requerida.'); return; }
    if (!this.form.peso_bruto || this.form.peso_bruto <= 0) { this.toast.error('El peso bruto es requerido.'); return; }
    if (this.needsTransportista && !this.form.carrier_ruc?.trim()) { this.toast.error('El RUC del transportista es requerido para transporte público.'); return; }
    if (this.needsVehicle && !this.form.vehicle_plate?.trim())     { this.toast.error('La placa del vehículo es requerida.'); return; }

    this.submitting.set(true);
    const items = (o.items ?? []).map(i => ({ product_id: i.product_id, lot_id: i.lot_id, quantity: i.quantity }));

    this.sales.createShippingGuide({
      order_id: o.id, client_id: o.client!.id,
      destination_address: this.form.destination_address,
      destination_district_id: this.form.destination_district_id,
      partida_address:     this.form.partida_address     || null,
      partida_district_id: this.form.partida_district_id || null,
      mod_traslado: this.form.mod_traslado,
      es_m1l:       this.form.es_m1l,
      carrier_name:    this.form.carrier_name    || null,
      carrier_ruc:     this.form.carrier_ruc     || null,
      carrier_nro_mtc: this.form.carrier_nro_mtc || null,
      vehicle_plate:   this.form.vehicle_plate   || null,
      conductor_tipo_doc:  this.form.conductor_tipo_doc  || null,
      conductor_nombres:   this.form.conductor_nombres   || null,
      conductor_apellidos: this.form.conductor_apellidos || null,
      driver_doc:          this.form.driver_doc          || null,
      conductor_licencia:  this.form.conductor_licencia  || null,
      transfer_date:   this.form.transfer_date,
      transfer_reason: this.form.transfer_reason,
      peso_bruto:  this.form.peso_bruto  || null,
      unidad_peso: this.form.unidad_peso,
      notes:       this.form.notes       || null,
      items,
    }).subscribe({
      next: res => {
        this.submitting.set(false);
        this.saved.emit({ message: res.message, guide: res.guide });
        if (res.sunat_success) this.toast.success('Guía aceptada por SUNAT.');
        else this.toast.error('SUNAT: ' + res.message);
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.toast.error(err?.error?.message ?? 'Error al crear la guía.');
      },
    });
  }

  close(): void { if (!this.submitting()) this.cancelled.emit(); }

  get needsVehicle():      boolean { return !this.form.es_m1l; }
  get needsTransportista(): boolean { return this.form.mod_traslado === '01' && !this.form.es_m1l; }
}
