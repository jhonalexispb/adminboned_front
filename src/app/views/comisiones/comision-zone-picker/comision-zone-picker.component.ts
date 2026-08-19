import { Component, OnChanges, SimpleChanges, signal, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus, faXmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Select } from 'primeng/select';
import { BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent } from '@coreui/angular';
import { GeographyService, Department, Province, District } from '../../../core/services/geography.service';
import { SaleZonesService } from '../../sale-zones/sale-zones.service';
import { ToastService } from '../../../core/services/toast.service';
import { ComisionZonaInput } from '../comision.model';

@Component({
  selector: 'app-comision-zone-picker',
  standalone: true,
  imports: [FormsModule, Select, FaIconComponent, CardComponent, CardHeaderComponent, CardBodyComponent, BadgeComponent],
  templateUrl: './comision-zone-picker.component.html',
})
export class ComisionZonePickerComponent implements OnChanges {
  zonas    = input<ComisionZonaInput[]>([]);
  sellerId = input<number | null>(null);

  zonasChange = output<ComisionZonaInput[]>();

  departments = signal<Department[]>([]);
  provinces   = signal<Province[]>([]);
  districts   = signal<District[]>([]);
  loadingProvs = signal(false);
  loadingDists = signal(false);
  loadingSellerZones = signal(false);

  selectedDeptId: number | null = null;
  selectedProvId: number | null = null;
  selectedDistId: number | null = null;

  readonly faPlus    = faPlus;
  readonly faXmark   = faXmark;
  readonly faSpinner = faSpinner;

  private list: ComisionZonaInput[] = [];
  private lastLoadedSellerId: number | null = null;

  constructor(
    private geoSvc: GeographyService,
    private zoneSvc: SaleZonesService,
    private toast: ToastService,
  ) {
    this.geoSvc.departments().subscribe({ next: r => this.departments.set(r) });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zonas']) this.list = [...this.zonas()];
    if (changes['sellerId']) this.onSellerIdChange();
  }

  /**
   * Estas zonas SON las Zonas de Venta del vendedor — mientras la comisión esté abierta, este
   * es el único lugar donde se editan (esa pantalla las bloquea). Al elegir vendedor, si el
   * picker todavía está vacío (alta nueva), se precargan sus zonas actuales como punto de
   * partida; en edición ya vienen las de la propia comisión, así que no se sobreescriben.
   */
  private onSellerIdChange(): void {
    const id = this.sellerId();
    if (!id) { this.lastLoadedSellerId = null; return; }
    if (id === this.lastLoadedSellerId) return;
    this.lastLoadedSellerId = id;
    if (this.list.length) return;
    this.loadingSellerZones.set(true);
    this.zoneSvc.getUserZones(id).subscribe({
      next: cfg => {
        this.loadingSellerZones.set(false);
        if (!this.list.length && cfg.zones.length) {
          this.list = cfg.zones.map(z => ({
            zone_type: z.zone_type, department_id: z.department_id,
            province_id: z.province_id, district_id: z.district_id, label: z.label,
          }));
          this.emit();
        }
      },
      error: () => this.loadingSellerZones.set(false),
    });
  }

  get current(): ComisionZonaInput[] { return this.list; }

  onDeptChange(deptId: number | null): void {
    this.selectedDeptId = deptId;
    this.selectedProvId = null;
    this.selectedDistId = null;
    this.provinces.set([]);
    this.districts.set([]);
    if (!deptId) return;
    this.loadingProvs.set(true);
    this.geoSvc.provinces(deptId).subscribe({
      next: r => { this.provinces.set(r); this.loadingProvs.set(false); },
      error: () => this.loadingProvs.set(false),
    });
  }

  onProvChange(provId: number | null): void {
    this.selectedProvId = provId;
    this.selectedDistId = null;
    this.districts.set([]);
    if (!provId) return;
    this.loadingDists.set(true);
    this.geoSvc.districts(provId).subscribe({
      next: r => { this.districts.set(r); this.loadingDists.set(false); },
      error: () => this.loadingDists.set(false),
    });
  }

  addDept(): void {
    const dept = this.departments().find(d => d.id === this.selectedDeptId);
    if (!dept) return;
    this.addZone({ zone_type: 'department', department_id: dept.id, label: `Dpto. ${dept.name}` });
  }

  addProv(): void {
    const prov = this.provinces().find(p => p.id === this.selectedProvId);
    const dept = this.departments().find(d => d.id === this.selectedDeptId);
    if (!prov) return;
    this.addZone({
      zone_type: 'province', province_id: prov.id,
      label: `Prov. ${dept?.name ?? '?'} › ${prov.name}`,
    });
  }

  addDist(): void {
    const dist = this.districts().find(d => d.id === this.selectedDistId);
    const prov = this.provinces().find(p => p.id === this.selectedProvId);
    const dept = this.departments().find(d => d.id === this.selectedDeptId);
    if (!dist) return;
    this.addZone({
      zone_type: 'district', district_id: dist.id,
      label: `Dist. ${dept?.name ?? '?'} › ${prov?.name ?? '?'} › ${dist.name}`,
    });
  }

  private addZone(z: ComisionZonaInput): void {
    const exists = this.list.some(x =>
      x.zone_type === z.zone_type &&
      x.department_id === (z.department_id ?? null) &&
      x.province_id === (z.province_id ?? null) &&
      x.district_id === (z.district_id ?? null)
    );
    if (exists) { this.toast.error('Esa zona ya está agregada.'); return; }
    this.list = [...this.list, z];
    this.emit();
  }

  removeZone(index: number): void {
    this.list = this.list.filter((_, i) => i !== index);
    this.emit();
  }

  private emit(): void {
    this.zonasChange.emit(this.list);
  }
}
