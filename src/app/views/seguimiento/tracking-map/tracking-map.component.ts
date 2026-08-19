import {
  Component, Input, OnChanges, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, SimpleChanges, signal, ViewEncapsulation,
} from '@angular/core';
import { SpinnerComponent } from '@coreui/angular';
import { TrackingPoint } from '../tracking.model';
import * as L from 'leaflet';

function pointInRing(pt: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = (yi > pt[1]) !== (yj > pt[1])
      && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lat: number, lng: number, geometry: any): boolean {
  const pt: [number, number] = [lng, lat];
  const inPolygon = (coords: number[][][]) => {
    if (!pointInRing(pt, coords[0])) return false;
    for (let k = 1; k < coords.length; k++) if (pointInRing(pt, coords[k])) return false;
    return true;
  };
  if (geometry?.type === 'Polygon') return inPolygon(geometry.coordinates);
  if (geometry?.type === 'MultiPolygon') return (geometry.coordinates as number[][][][]).some(inPolygon);
  return false;
}

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [SpinnerComponent],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="position-relative">
      <div #mapEl [style.height]="height" style="border-radius:.5rem;overflow:hidden;background:#0f172a"></div>
      @if (loading()) {
        <div class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center
                    justify-content-center rounded" style="background:rgba(0,0,0,.5);z-index:500">
          <c-spinner />
        </div>
      }
      @if (mapError()) {
        <div class="alert alert-warning small mt-2 mb-0">No se pudo inicializar el mapa.</div>
      }
    </div>
  `,
})
export class TrackingMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() points: TrackingPoint[] = [];
  @Input() assignedProvinceNames: string[] = [];
  @Input() height = '460px';

  @ViewChild('mapEl') mapEl!: ElementRef;

  loading  = signal(true);
  mapError = signal(false);

  /** Cuántos puntos de la ruta caen fuera de TODAS las provincias asignadas (informativo). */
  outsideCount = signal(0);

  private map: L.Map | null = null;
  private routeLayer: L.LayerGroup | null = null;
  private provinceOutlines: L.GeoJSON[] = [];
  private provinceGeoJSON: any = null;

  async ngAfterViewInit(): Promise<void> {
    try {
      this.map = L.map(this.mapEl.nativeElement, { zoomControl: true, preferCanvas: true })
        .setView([-9.19, -75.01], 5);
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 14 },
      ).addTo(this.map);
      setTimeout(() => this.map?.invalidateSize(), 0);
      this.loading.set(false);
    } catch {
      this.mapError.set(true);
      this.loading.set(false);
      return;
    }

    try {
      const res = await fetch('/assets/geo/peru_provs.json');
      if (res.ok) this.provinceGeoJSON = await res.json();
    } catch { /* el cruce de provincia es solo informativo — si falla, se omite */ }

    this.redraw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['points'] || changes['assignedProvinceNames']) this.redraw();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private redraw(): void {
    if (!this.map) return;

    this.routeLayer?.remove();
    this.provinceOutlines.forEach(o => o.remove());
    this.provinceOutlines = [];
    this.outsideCount.set(0);

    const provinceFeatures = this.findProvinceFeatures();
    provinceFeatures.forEach(feature => {
      const outline = L.geoJSON(feature, {
        style: { fillOpacity: 0.05, fillColor: '#3b82f6', color: '#93c5fd', weight: 2, dashArray: '6 4' },
      }).addTo(this.map!);
      this.provinceOutlines.push(outline);
    });

    if (this.points.length === 0) {
      if (this.provinceOutlines.length) {
        const bounds = this.provinceOutlines.reduce((acc, o) => acc ? acc.extend(o.getBounds()) : o.getBounds(), null as L.LatLngBounds | null);
        if (bounds) this.map.fitBounds(bounds, { padding: [30, 30] });
      }
      return;
    }

    const layer = L.layerGroup();
    const latlngs: L.LatLngTuple[] = this.points.map(p => [p.lat, p.lng]);

    L.polyline(latlngs, { color: '#22c55e', weight: 3, opacity: 0.85 }).addTo(layer);

    let outside = 0;
    this.points.forEach((p, i) => {
      const isOutside = provinceFeatures.length > 0
        ? !provinceFeatures.some(f => pointInGeometry(p.lat, p.lng, f.geometry))
        : false;
      if (isOutside) outside++;

      L.circleMarker([p.lat, p.lng], {
        radius: i === this.points.length - 1 ? 8 : 5,
        fillColor: isOutside ? '#ef4444' : '#22c55e',
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.9,
      })
        .bindPopup(`<b>${p.subject_type_label}</b><br>${p.description}<br><span style="color:#94a3b8">${p.time}</span>`)
        .addTo(layer);
    });

    this.outsideCount.set(outside);
    layer.addTo(this.map);
    this.routeLayer = layer;

    const bounds = L.latLngBounds(latlngs);
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  private findProvinceFeatures(): any[] {
    if (!this.assignedProvinceNames.length || !this.provinceGeoJSON) return [];
    const targets = new Set(this.assignedProvinceNames.map(n => this.norm(n)));
    return (this.provinceGeoJSON.features as any[]).filter(f => {
      const name = f.properties?.NOMBPROV ?? f.properties?.name ?? '';
      return targets.has(this.norm(name));
    });
  }

  private norm(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }
}
