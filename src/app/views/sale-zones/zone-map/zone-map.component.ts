import {
  Component, Input, Output, EventEmitter,
  OnChanges, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, SimpleChanges,
  signal, ViewEncapsulation,
} from '@angular/core';
import { SpinnerComponent } from '@coreui/angular';
import { Department, Province } from '../../../core/services/geography.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-zone-map',
  standalone: true,
  imports: [SpinnerComponent],
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .zone-label {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      font-size: 10px;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,.9);
      white-space: nowrap;
      pointer-events: none;
      text-align: center;
    }
    .zone-label::before { display: none !important; }
    .zm-topbar {
      position: absolute;
      top: 8px;
      left: 0;
      right: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      pointer-events: none;
    }
    .zm-back-btn {
      pointer-events: all;
      background: rgba(15,23,42,.90);
      border: 1px solid rgba(255,255,255,.18);
      color: #fff;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .zm-back-btn:hover { background: rgba(30,41,59,.98); }
    .zm-dept-badge {
      background: rgba(59,130,246,.85);
      border: 1px solid rgba(147,197,253,.3);
      color: #fff;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 700;
      pointer-events: none;
    }
  `],
  template: `
    <div class="position-relative">
      <div #mapEl [style.height]="height"
           style="border-radius:.5rem;overflow:hidden;background:#0f172a"></div>

      @if (loading()) {
        <div class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center
                    justify-content-center rounded" style="background:rgba(0,0,0,.5);z-index:500">
          <c-spinner />
        </div>
      }

      @if (mapError()) {
        <div class="alert alert-warning small mt-2 mb-0">
          No se pudo inicializar el mapa.
        </div>
      }

      @if (!loading() && !mapError()) {

        <!-- Barra superior: solo cuando hay departamento enfocado -->
        @if (focusDeptId !== null) {
          <div class="zm-topbar">
            <button class="zm-back-btn" (click)="mapBackClick.emit()">← Perú completo</button>
            @if (focusedDeptName) {
              <span class="zm-dept-badge">{{ focusedDeptName }}</span>
            }
          </div>
        }

        <!-- Leyenda: solo en vista completa -->
        @if (focusDeptId === null) {
          <div class="position-absolute bottom-0 start-0 m-2 px-2 py-1 rounded shadow-sm"
               style="background:var(--cui-body-bg);z-index:1000;border:1px solid var(--cui-border-color);font-size:11px">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span style="width:12px;height:12px;background:#22c55e;border-radius:2px;display:inline-block"></span>
              <span>Tus zonas</span>
            </div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span style="width:12px;height:12px;background:#ef4444;border-radius:2px;display:inline-block"></span>
              <span>Cobertura parcial</span>
            </div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span style="width:12px;height:12px;background:#3b82f6;border-radius:2px;display:inline-block"></span>
              <span>Otro vendedor</span>
            </div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span style="width:12px;height:12px;background:#f59e0b;border-radius:2px;display:inline-block"></span>
              <span>Compartida</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span style="width:12px;height:12px;background:#475569;border-radius:2px;display:inline-block"></span>
              <span>Sin asignar</span>
            </div>
          </div>
        }

      }
    </div>
  `,
})
export class ZoneMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() departments:     Department[] = [];
  @Input() deptAssignments: Map<number, string[]> = new Map();
  @Input() provinces:       Province[]  = [];
  @Input() provAssignments: Map<number, string[]> = new Map();
  @Input() selfDeptIds:        Set<number> = new Set();
  @Input() selfProvIds:        Set<number> = new Set();
  @Input() selfPartialDeptIds: Set<number> = new Set();
  @Input() selfPartialProvIds: Set<number> = new Set();
  @Input() selfUserName:       string | null = null;
  @Input() focusDeptId:        number | null = null;
  @Input() highlightProvId:    number | null = null;
  @Input() height = '460px';

  @Output() deptClick     = new EventEmitter<number>();
  @Output() provinceClick = new EventEmitter<number>();
  @Output() mapBackClick  = new EventEmitter<void>();

  @ViewChild('mapEl') mapEl!: ElementRef;

  loading  = signal(true);
  mapError = signal(false);

  get focusedDeptName(): string | null {
    if (this.focusDeptId == null) return null;
    return this.departments.find(d => d.id === this.focusDeptId)?.name ?? null;
  }

  private map:            L.Map     | null = null;
  private deptLayer:      L.GeoJSON | null = null; // todos los dptos (vista Perú)
  private focusDeptLayer: L.GeoJSON | null = null; // solo el dpto seleccionado
  private provLayer:      L.GeoJSON | null = null; // provincias (se activa al enfocar)
  private highlightLayer: L.GeoJSON | null = null; // borde resaltado de provincia seleccionada
  private focusDeptBounds: L.LatLngBounds | null = null;
  private pendingFocusDeptId: number | null = null;

  // GeoJSON features indexados por nombre normalizado → reutilizar sin re-fetch
  private deptFeatureIndex = new Map<string, any>();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngAfterViewInit(): Promise<void> {
    try {
      this.initMap();
      setTimeout(() => this.map?.invalidateSize(), 0);
      this.loading.set(false);
    } catch {
      this.mapError.set(true);
      this.loading.set(false);
      return;
    }
    try {
      await Promise.all([this.loadDeptGeoJSON(), this.loadProvGeoJSON()]);
      if (this.pendingFocusDeptId != null) {
        this.applyFocus(this.pendingFocusDeptId);
        this.pendingFocusDeptId = null;
      } else {
        this.refreshDeptStyles();
      }
    } catch (e) {
      console.warn('ZoneMap: GeoJSON error', e);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    if (changes['focusDeptId']) {
      if (this.deptLayer) {
        this.clearFocusState();
        if (this.focusDeptId != null) {
          this.applyFocus(this.focusDeptId);
        } else {
          this.fullPeruView();
        }
      } else if (this.focusDeptId != null) {
        this.pendingFocusDeptId = this.focusDeptId;
      }
    }

    if ((changes['deptAssignments'] || changes['departments'] || changes['selfDeptIds'] || changes['selfPartialDeptIds']) && this.deptLayer) {
      if (this.focusDeptId == null) this.refreshDeptStyles();
    }
    if ((changes['provAssignments'] || changes['provinces'] || changes['selfProvIds'] || changes['selfDeptIds'] || changes['selfPartialProvIds']) && this.provLayer) {
      if (this.focusDeptId != null) this.refreshProvStyles();
    }

    if (changes['highlightProvId'] && this.provLayer && this.focusDeptId != null) {
      this.applyProvHighlight();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  private initMap(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      preferCanvas: true,
    }).setView([-9.19, -75.01], 5);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 14 },
    ).addTo(this.map);
  }

  private async loadDeptGeoJSON(): Promise<void> {
    const res  = await fetch('/assets/geo/peru_depts.json');
    if (!res.ok) throw new Error(`Depts: ${res.status}`);
    const data = await res.json();

    this.deptLayer = L.geoJSON(data, {
      style:         (f: any) => this.deptStyle(f),
      onEachFeature: (f: any, layer: any) => this.bindDeptFeature(f, layer),
    }).addTo(this.map!);

    // Indexar features por nombre normalizado para acceso O(1)
    (data.features as any[]).forEach(f => {
      const key = this.norm(this.featureDeptName(f));
      this.deptFeatureIndex.set(key, f);
    });

    this.map!.fitBounds(this.deptLayer.getBounds(), { padding: [15, 15] });
  }

  private async loadProvGeoJSON(): Promise<void> {
    const res  = await fetch('/assets/geo/peru_provs.json');
    if (!res.ok) return;
    const data = await res.json();

    this.provLayer = L.geoJSON(data, {
      renderer:      L.svg({ padding: 0.5 }),
      style:         (f: any) => this.provStyleFor(f),
      onEachFeature: (f: any, layer: any) => this.bindProvFeature(f, layer),
    } as unknown as L.GeoJSONOptions);
    // No se añade al mapa hasta hacer focus
  }

  // ── Focus: puzzle piece ───────────────────────────────────────────────────

  private applyFocus(deptId: number): void {
    if (!this.map) return;

    // Ocultar la capa completa de departamentos — solo se verán las provincias
    if (this.deptLayer && this.map.hasLayer(this.deptLayer)) {
      this.deptLayer.remove();
    }

    // Encontrar el dept en el índice para poder crear el layer aislado
    const dept = this.departments.find(d => d.id === deptId);
    const feature = dept ? this.deptFeatureIndex.get(this.norm(dept.name)) : null;

    // 1. Mostrar solo ese departamento como polígono de borde
    if (feature) {
      this.focusDeptLayer = L.geoJSON(feature, {
        style: {
          fillOpacity: 0,        // sin relleno — las provincias son el relleno
          color:    '#93c5fd',   // borde azul claro
          weight:   2.5,
          opacity:  0.9,
        },
      }).addTo(this.map);
      this.focusDeptBounds = this.focusDeptLayer.getBounds();
    }

    // 2. Añadir las provincias con estilos ya calculados
    if (this.provLayer) {
      if (this.map.hasLayer(this.provLayer)) this.provLayer.remove();
      this.provLayer.setStyle((f: any) => this.provStyleFor(f));
      this.provLayer.addTo(this.map);
    }

    // 3. Zoom al departamento
    // El renderer SVG actualiza estilos de forma síncrona — no se necesita
    // esperar al moveend ni RAF para que los estilos se dibujen correctamente.
    const bounds = this.focusDeptLayer?.getBounds();
    if (bounds?.isValid()) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
    }
  }

  /** Limpia el estado de foco sin tocar el viewport */
  private clearFocusState(): void {
    if (this.highlightLayer) {
      this.highlightLayer.remove();
      this.highlightLayer = null;
    }
    if (this.focusDeptLayer) {
      this.focusDeptLayer.remove();
      this.focusDeptLayer = null;
    }
    this.focusDeptBounds = null;
    if (this.provLayer && this.map?.hasLayer(this.provLayer)) {
      this.provLayer.remove();
    }
    // Restaurar capa completa de departamentos si no estaba visible
    if (this.deptLayer && !this.map?.hasLayer(this.deptLayer)) {
      this.deptLayer.addTo(this.map!);
    }
  }

  /** Volver a vista completa de Perú */
  private fullPeruView(): void {
    this.refreshDeptStyles();
    if (this.deptLayer) {
      this.map?.fitBounds(this.deptLayer.getBounds(), { padding: [15, 15] });
    }
  }

  /** Resalta la provincia seleccionada en el panel y hace zoom a ella */
  private applyProvHighlight(): void {
    if (this.highlightLayer) {
      this.highlightLayer.remove();
      this.highlightLayer = null;
    }
    if (!this.highlightProvId || !this.provLayer || !this.map) return;

    let foundFeature: any = null;
    let foundBounds: L.LatLngBounds | null = null;

    this.provLayer.eachLayer((layer: any) => {
      if (foundFeature || !layer.feature) return;
      const prov = this.findProv(this.featureProvName(layer.feature));
      if (prov?.id === this.highlightProvId) {
        foundFeature = layer.feature;
        foundBounds  = (layer as any).getBounds?.() ?? null;
      }
    });

    if (foundFeature) {
      this.highlightLayer = L.geoJSON(foundFeature, {
        style: {
          fillOpacity: 0,
          color:       '#ffffff',
          weight:      4,
          opacity:     1,
          dashArray:   '8 5',
        },
      }).addTo(this.map);
    }

    const bounds = foundBounds ?? this.highlightLayer?.getBounds();
    if (bounds?.isValid()) {
      this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 10, animate: true });
    }
  }

  // ── Dept styles (vista Perú completo) ─────────────────────────────────────

  private refreshDeptStyles(): void {
    if (!this.deptLayer || !this.map) return;
    const wasOnMap = this.map.hasLayer(this.deptLayer);
    if (wasOnMap) this.deptLayer.remove();
    this.deptLayer.setStyle((f: any) => this.deptStyle(f));
    if (wasOnMap) this.deptLayer.addTo(this.map);
    this.deptLayer.eachLayer((layer: any) => {
      if (!layer.feature) return;
      const name     = this.featureDeptName(layer.feature);
      const dept     = this.findDept(name);
      const isSelf   = dept ? this.selfDeptIds.has(dept.id) : false;
      const isPartial = dept ? this.selfPartialDeptIds.has(dept.id) : false;
      const showSelf  = isSelf || isPartial;
      const vendors  = dept ? (this.deptAssignments.get(dept.id) ?? []) : [];
      layer.bindPopup(this.popupHtml(name, vendors, showSelf), { autoPan: false });
      this.applyTooltip(layer, vendors, showSelf);
    });
  }

  private deptStyle(f: any): L.PathOptions {
    const dept        = this.findDept(this.featureDeptName(f));
    const isSelf      = dept ? this.selfDeptIds.has(dept.id) : false;
    const isPartial   = dept ? this.selfPartialDeptIds.has(dept.id) : false;
    const vendors     = dept ? (this.deptAssignments.get(dept.id) ?? []) : [];

    if (isSelf && vendors.length > 0) {
      // Propio + compartido
      return { fillColor: '#22c55e', fillOpacity: 0.70, color: '#f59e0b', weight: 2.5 };
    }
    if (isSelf) {
      return { fillColor: '#22c55e', fillOpacity: 0.65, color: '#15803d', weight: 1.8 };
    }
    if (isPartial && vendors.length > 0) {
      return { fillColor: '#ef4444', fillOpacity: 0.55, color: '#f59e0b', weight: 2 };
    }
    if (isPartial) {
      return { fillColor: '#ef4444', fillOpacity: 0.50, color: '#dc2626', weight: 1.5 };
    }
    return {
      fillColor:   vendors.length > 1 ? '#f59e0b' : vendors.length === 1 ? '#3b82f6' : '#475569',
      fillOpacity: vendors.length > 0 ? 0.65 : 0.25,
      color:       '#1e293b',
      weight:      1.5,
    };
  }

  private bindDeptFeature(f: any, layer: any): void {
    const name    = this.featureDeptName(f);
    const vendors = this.vendorsForDeptFeature(f);
    layer.bindPopup(this.popupHtml(name, vendors), { autoPan: false });
    this.applyTooltip(layer, vendors);
    layer.on('mouseover', () => {
      layer.setStyle({ fillOpacity: 0.9, weight: 2.5 });
      layer.openPopup();
    });
    layer.on('mouseout', () => {
      this.deptLayer?.resetStyle(layer);
      layer.closePopup();
    });
    layer.on('click', () => {
      const dept = this.findDept(name);
      if (dept) this.deptClick.emit(dept.id);
    });
  }

  // ── Prov styles (vista departamento) ─────────────────────────────────────

  private refreshProvStyles(): void {
    if (!this.provLayer || !this.map) return;
    // Remove → setStyle → addTo garantiza que el Canvas renderer dibuje
    // con los options ya actualizados (evita race condition con requestAnimFrame)
    const wasOnMap = this.map.hasLayer(this.provLayer);
    if (wasOnMap) this.provLayer.remove();
    this.provLayer.setStyle((f: any) => this.provStyleFor(f));
    if (wasOnMap) this.provLayer.addTo(this.map);
    this.provLayer.eachLayer((layer: any) => {
      if (!layer.feature) return;
      const name    = this.featureProvName(layer.feature);
      const prov    = this.findProv(name);
      // Ocultar tooltip/popup de provincias que no son del dept enfocado
      if (this.focusDeptId != null && !prov && !this.isFeatureInFocusDept(layer.feature)) return;
      const isSelf  = prov ? (
        this.selfProvIds.has(prov.id) ||
        this.selfDeptIds.has(prov.department_id) ||
        this.selfPartialProvIds.has(prov.id)
      ) : false;
      const vendors = prov ? (this.provAssignments.get(prov.id) ?? []) : [];
      layer.bindPopup(this.popupHtml(name, vendors, isSelf), { autoPan: false });
      this.applyTooltip(layer, vendors, isSelf);
    });
  }

  private provStyleFor(f: any): L.PathOptions {
    const prov = this.findProv(this.featureProvName(f));

    if (!prov) {
      // Nombre no hizo match con la API. En modo enfocado, mostrar igual si pertenece al dpto
      if (this.focusDeptId != null) {
        if (this.isFeatureInFocusDept(f)) {
          // Límite visible aunque no hayamos podido enlazarlo a datos de la API
          return { stroke: true, fillColor: '#475569', fillOpacity: 0.22, color: '#94a3b8', weight: 1.5, opacity: 0.8, dashArray: '6 4' };
        }
      }
      return { stroke: false, fill: false, opacity: 0 };
    }

    if (this.focusDeptId != null && prov.department_id !== this.focusDeptId) {
      return { stroke: false, fill: false, opacity: 0 };
    }
    // Cubierta por zona propia (exacta de provincia O zona de dpto que la contiene)
    const isSelf        = this.selfProvIds.has(prov.id) || this.selfDeptIds.has(prov.department_id);
    const isPartialSelf = !isSelf && this.selfPartialProvIds.has(prov.id);
    const vendors       = this.provAssignments.get(prov.id) ?? [];

    const dash = '6 4';
    if (isSelf && vendors.length > 0) {
      return { stroke: true, fill: true, fillColor: '#22c55e', fillOpacity: 0.78, color: '#fde68a', weight: 2, opacity: 1, dashArray: dash };
    }
    if (isSelf) {
      return { stroke: true, fill: true, fillColor: '#22c55e', fillOpacity: 0.78, color: '#86efac', weight: 1.8, opacity: 1, dashArray: dash };
    }
    if (isPartialSelf && vendors.length > 0) {
      return { stroke: true, fill: true, fillColor: '#ef4444', fillOpacity: 0.55, color: '#fde68a', weight: 2, opacity: 1, dashArray: dash };
    }
    if (isPartialSelf) {
      return { stroke: true, fill: true, fillColor: '#ef4444', fillOpacity: 0.50, color: '#fca5a5', weight: 1.8, opacity: 1, dashArray: dash };
    }
    return {
      stroke:      true,
      fill:        true,
      fillColor:   vendors.length > 1 ? '#f59e0b' : vendors.length === 1 ? '#3b82f6' : '#475569',
      fillOpacity: vendors.length > 0 ? 0.78 : 0.28,
      color:       vendors.length > 1 ? '#fcd34d' : vendors.length === 1 ? '#93c5fd' : '#94a3b8',
      weight:      1.5,
      opacity:     1,
      dashArray:   dash,
    };
  }

  private bindProvFeature(f: any, layer: any): void {
    const name    = this.featureProvName(f);
    const prov    = this.findProv(name);
    const vendors = prov ? (this.provAssignments.get(prov.id) ?? []) : [];
    layer.bindPopup(this.popupHtml(name, vendors), { autoPan: false });
    this.applyTooltip(layer, vendors);
    layer.on('mouseover', () => {
      layer.setStyle({ fillOpacity: 0.95, weight: 2.5 });
      layer.openPopup();
    });
    layer.on('mouseout', () => {
      this.provLayer?.resetStyle(layer);
      layer.closePopup();
    });
    layer.on('click', () => {
      if (prov) this.provinceClick.emit(prov.id);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private applyTooltip(layer: any, vendors: string[], isSelf = false): void {
    layer.unbindTooltip();
    const selfLabel  = isSelf ? (this.selfUserName ?? 'Tú') : null;
    const allLabels  = [...(selfLabel ? [selfLabel] : []), ...vendors];
    if (!allLabels.length) return;
    layer.bindTooltip(allLabels.join(' · '), {
      permanent:  true,
      direction:  'center',
      className:  'zone-label',
    });
  }

  private popupHtml(name: string, vendors: string[], isSelf = false): string {
    const selfChip = isSelf
      ? `<span style="display:inline-block;background:#22c55e;color:#fff;
            padding:2px 8px;border-radius:4px;font-size:11px;margin:1px 2px;font-weight:700">
            ${this.selfUserName ?? 'Tú'}</span>`
      : '';
    const otherChips = vendors.map(v =>
      `<span style="display:inline-block;background:#3b82f6;color:#fff;
        padding:2px 8px;border-radius:4px;font-size:11px;margin:1px 2px">${v}</span>`
    ).join('');
    const chips = (selfChip + otherChips) || `<span style="color:#94a3b8;font-size:11px">Sin asignar</span>`;
    return `<b style="font-size:13px">${name}</b><br><div style="margin-top:5px">${chips}</div>`;
  }

  private vendorsForDeptFeature(f: any): string[] {
    const dept = this.findDept(this.featureDeptName(f));
    return dept ? (this.deptAssignments.get(dept.id) ?? []) : [];
  }

  private featureDeptName(f: any): string {
    return f.properties?.NOMBDEP ?? f.properties?.name ?? '';
  }

  private featureProvName(f: any): string {
    return f.properties?.NOMBPROV ?? f.properties?.name ?? '';
  }

  private featureProvDeptName(f: any): string {
    return f.properties?.NOMBDEP ?? '';
  }

  /** Devuelve true si el feature de provincia pertenece al dpto actualmente enfocado.
   *  Usa NOMBDEP primero; si falta, hace fallback a centroide dentro del bounding box. */
  private isFeatureInFocusDept(f: any): boolean {
    if (this.focusDeptId == null) return false;
    const focusDept = this.departments.find(d => d.id === this.focusDeptId);
    if (!focusDept) return false;

    // 1. Comparar por nombre de dpto en el GeoJSON
    const featDeptNorm = this.norm(this.featureProvDeptName(f));
    if (featDeptNorm && this.norm(focusDept.name) === featDeptNorm) return true;

    // 2. Fallback: centroide del polígono dentro del bounding box del dpto
    if (this.focusDeptBounds) {
      const c = this.geomCentroid(f.geometry);
      if (c && this.focusDeptBounds.contains(c)) return true;
    }

    return false;
  }

  /** Calcula el centroide aproximado de un polígono GeoJSON como [lat, lng] */
  private geomCentroid(geom: any): L.LatLngTuple | null {
    let ring: number[][] | null = null;
    if (geom?.type === 'Polygon') ring = geom.coordinates[0];
    else if (geom?.type === 'MultiPolygon') ring = geom.coordinates[0]?.[0];
    if (!ring?.length) return null;
    const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
    const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
    return [lat, lng];
  }

  private norm(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\blima province\b/g, 'lima')
      .replace(/\bsan martin\b/g, 'san martin')
      .trim();
  }

  private findDept(geoName: string): Department | undefined {
    const n = this.norm(geoName);
    return this.departments.find(d => this.norm(d.name) === n);
  }

  private findProv(geoName: string): Province | undefined {
    const n = this.norm(geoName);
    return this.provinces.find(p => this.norm(p.name) === n);
  }
}
