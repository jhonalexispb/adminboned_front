import { Component, OnInit, signal } from '@angular/core';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { forkJoin } from 'rxjs';
import { EmpresaService, Empresa, DocumentSeries } from '../../../core/services/empresa.service';
import { GeographyService, Department, Province, District } from '../../../core/services/geography.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-empresa',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent,
    PageHeaderComponent,
  ],
  templateUrl: './empresa.component.html',
})
export class EmpresaComponent implements OnInit {
  empresa       = signal<Empresa | null>(null);
  cargando      = signal(true);
  guardando     = signal(false);
  guardandoSeries = signal(false);
  subiendoLogo    = signal(false);
  subiendoDocLogo = signal(false);
  tabActiva     = signal<'empresa' | 'sunat' | 'facturacion' | 'metas' | 'catalogo'>('empresa');
  mostrarToken  = signal(false);

  documentSeries   = signal<DocumentSeries[]>([]);
  seriesEdits: Record<number, number> = {};
  togglingId       = signal<number | null>(null);
  deletingId       = signal<number | null>(null);
  showNewForm      = signal(false);
  guardandoNueva   = signal(false);
  nuevaSerie       = { document_type: '', series: '', current_correlative: 0 };

  readonly docTypeOptions = [
    { value: 'invoice',                label: 'Factura' },
    { value: 'receipt',                label: 'Boleta' },
    { value: 'credit_note_invoice',    label: 'NC de Factura' },
    { value: 'credit_note_receipt',    label: 'NC de Boleta' },
    { value: 'sale_note',              label: 'Nota de venta' },
    { value: 'credit_note_sale_note',  label: 'NC de Nota de Venta' },
    { value: 'shipping_guide',         label: 'Guía de Remisión' },
  ];

  private readonly seriesOrder = ['invoice', 'receipt', 'credit_note_invoice', 'credit_note_receipt', 'sale_note', 'credit_note_sale_note', 'shipping_guide'];

  private sortSeries(list: DocumentSeries[]): DocumentSeries[] {
    return [...list].sort((a, b) => {
      const ai = this.seriesOrder.indexOf(a.document_type);
      const bi = this.seriesOrder.indexOf(b.document_type);
      const order = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return order !== 0 ? order : a.series.localeCompare(b.series);
    });
  }

  form: Partial<Empresa> & { apisunat_persona_token?: string } = {
    ruc: '', razon_social: '', nombre_comercial: '', direccion: '',
    ubigeo: '', departamento: '', provincia: '', distrito: '',
    telefono: '', email: '',
    apisunat_persona_id: '', apisunat_persona_token: '',
    meta_diaria: 1500,
    catalog_request_seller_mode: 'client_assignment',
    catalog_whatsapp_number: '',
    catalog_show_lot_breakdown: false,
    catalog_stale_order_days: 3,
  };

  logoFile:    File | null = null;
  docLogoFile: File | null = null;

  // Ubigeo
  departments   = signal<Department[]>([]);
  provinces     = signal<Province[]>([]);
  districts     = signal<District[]>([]);
  selectedDeptId = signal<number | null>(null);
  selectedProvId = signal<number | null>(null);

  constructor(
    private svc: EmpresaService,
    private geoSvc: GeographyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.svc.listDocumentSeries().subscribe({
      next: res => {
        const sorted = this.sortSeries(res.data);
        this.documentSeries.set(sorted);
        this.seriesEdits = {};
        for (const s of sorted) {
          this.seriesEdits[s.id] = s.current_correlative;
        }
      },
    });

    forkJoin({
      departments: this.geoSvc.departments(),
      empresa: this.svc.get(),
    }).subscribe({
      next: ({ departments, empresa: e }) => {
        this.departments.set(departments);
        this.cargando.set(false);
        if (!e) return;
        this.empresa.set(e);
        this.form = {
          ...this.form,
          ...e,
          apisunat_persona_token: '',
        };
        // Pre-cargar provincia y distrito si ya hay datos guardados
        if (e.departamento) {
          const dept = departments.find(d =>
            d.name.toLowerCase() === e.departamento!.toLowerCase()
          );
          if (dept) {
            this.selectedDeptId.set(dept.id);
            this.geoSvc.provinces(dept.id).subscribe(ps => {
              this.provinces.set(ps);
              const prov = ps.find(p => p.name.toLowerCase() === e.provincia?.toLowerCase());
              if (prov) {
                this.selectedProvId.set(prov.id);
                this.geoSvc.districts(prov.id).subscribe(ds => this.districts.set(ds));
              }
            });
          }
        }
      },
      error: () => this.cargando.set(false),
    });
  }

  onDeptChange(deptId: number | null): void {
    this.selectedDeptId.set(deptId);
    this.selectedProvId.set(null);
    this.provinces.set([]);
    this.districts.set([]);
    this.form.provincia  = '';
    this.form.distrito   = '';
    this.form.ubigeo     = '';
    const dept = this.departments().find(d => d.id === +deptId!);
    this.form.departamento = dept?.name ?? '';
    if (deptId) this.geoSvc.provinces(+deptId).subscribe(ps => this.provinces.set(ps));
  }

  onProvChange(provId: number | null): void {
    this.selectedProvId.set(provId);
    this.districts.set([]);
    this.form.distrito = '';
    this.form.ubigeo   = '';
    const prov = this.provinces().find(p => p.id === +provId!);
    this.form.provincia = prov?.name ?? '';
    if (provId) this.geoSvc.districts(+provId).subscribe(ds => this.districts.set(ds));
  }

  onDistrictChange(districtId: number | null): void {
    if (!districtId) { this.form.ubigeo = ''; this.form.distrito = ''; return; }
    const dist = this.districts().find(d => d.id === +districtId);
    if (dist) {
      this.form.distrito = dist.name;
      this.form.ubigeo   = dist.code?.toString().padStart(6, '0') ?? '';
    }
  }

  guardar(): void {
    if (!this.form.ruc || !this.form.razon_social || !this.form.direccion) {
      this.toast.error('RUC, Razón Social y Dirección son obligatorios.');
      this.tabActiva.set('empresa');
      return;
    }

    this.guardando.set(true);
    this.svc.save(this.form).subscribe({
      next: e => {
        this.empresa.set(e);
        this.form.apisunat_persona_token = '';
        this.guardando.set(false);
        this.toast.success('Datos guardados correctamente.');
      },
      error: (err: any) => {
        this.toast.error(err?.error?.message ?? 'Error al guardar.');
        this.guardando.set(false);
      },
    });
  }

  onLogoChange(e: Event): void {
    this.logoFile = (e.target as HTMLInputElement).files?.[0] ?? null;
  }

  subirLogo(): void {
    if (!this.logoFile) return;
    this.subiendoLogo.set(true);
    this.svc.uploadLogo(this.logoFile).subscribe({
      next: res => {
        this.empresa.update(e => e ? { ...e, logo_url: res.logo_url } : e);
        this.logoFile = null;
        this.subiendoLogo.set(false);
        this.toast.success('Logo actualizado.');
      },
      error: () => {
        this.toast.error('Error al subir el logo.');
        this.subiendoLogo.set(false);
      },
    });
  }

  onDocLogoChange(e: Event): void {
    this.docLogoFile = (e.target as HTMLInputElement).files?.[0] ?? null;
  }

  subirDocLogo(): void {
    if (!this.docLogoFile) return;
    this.subiendoDocLogo.set(true);
    this.svc.uploadDocLogo(this.docLogoFile).subscribe({
      next: res => {
        this.empresa.update(e => e ? { ...e, doc_logo_url: res.doc_logo_url } : e);
        this.docLogoFile = null;
        this.subiendoDocLogo.set(false);
        this.toast.success('Logo de documentos actualizado.');
      },
      error: () => {
        this.toast.error('Error al subir el logo de documentos.');
        this.subiendoDocLogo.set(false);
      },
    });
  }

  guardarSeries(): void {
    const series = this.documentSeries();
    if (!series.length) return;

    this.guardandoSeries.set(true);
    const requests = series.map(s =>
      this.svc.updateDocumentSeries(s.id, { current_correlative: this.seriesEdits[s.id] ?? s.current_correlative })
    );

    forkJoin(requests).subscribe({
      next: results => {
        const sorted = this.sortSeries(results.map(r => r.data));
        this.documentSeries.set(sorted);
        this.seriesEdits = {};
        for (const s of sorted) {
          this.seriesEdits[s.id] = s.current_correlative;
        }
        this.guardandoSeries.set(false);
        this.toast.success('Correlativos actualizados.');
      },
      error: () => {
        this.guardandoSeries.set(false);
        this.toast.error('Error al guardar las series.');
      },
    });
  }

  toggleActive(s: DocumentSeries): void {
    this.togglingId.set(s.id);
    this.svc.updateDocumentSeries(s.id, { active: !s.active }).subscribe({
      next: res => {
        this.documentSeries.update(list => list.map(x => x.id === s.id ? res.data : x));
        this.togglingId.set(null);
      },
      error: () => {
        this.togglingId.set(null);
        this.toast.error('Error al cambiar el estado.');
      },
    });
  }

  crearSerie(): void {
    if (!this.nuevaSerie.document_type || !this.nuevaSerie.series) {
      this.toast.error('Tipo y serie son obligatorios.');
      return;
    }
    this.guardandoNueva.set(true);
    this.svc.createDocumentSeries({
      document_type:       this.nuevaSerie.document_type,
      series:              this.nuevaSerie.series.toUpperCase(),
      current_correlative: this.nuevaSerie.current_correlative ?? 0,
    }).subscribe({
      next: res => {
        this.documentSeries.update(list => this.sortSeries([...list, res.data]));
        this.seriesEdits[res.data.id] = res.data.current_correlative;
        this.nuevaSerie = { document_type: '', series: '', current_correlative: 0 };
        this.showNewForm.set(false);
        this.guardandoNueva.set(false);
        this.toast.success('Serie creada.');
      },
      error: (err: any) => {
        this.guardandoNueva.set(false);
        this.toast.error(err?.error?.message ?? 'Error al crear la serie.');
      },
    });
  }

  get tieneApisunat(): boolean {
    return !!this.empresa()?.apisunat_persona_id && !!this.empresa()?.apisunat_token_set;
  }

  async eliminarSerie(s: DocumentSeries): Promise<void> {
    const result = await Swal.fire({
      title: `¿Eliminar serie ${s.series}?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.deletingId.set(s.id);
    this.svc.deleteDocumentSeries(s.id).subscribe({
      next: res => {
        this.documentSeries.update(list => list.filter(x => x.id !== s.id));
        delete this.seriesEdits[s.id];
        this.deletingId.set(null);
        this.toast.success(res.message);
      },
      error: (err: any) => {
        this.deletingId.set(null);
        this.toast.error(err?.error?.message ?? 'Error al eliminar la serie.');
      },
    });
  }

  seriesBadgeColor(type: string): string {
    const map: Record<string, string> = {
      invoice:             'primary',
      receipt:             'success',
      credit_note:           'warning',
      credit_note_invoice:   'warning',
      credit_note_receipt:   'warning',
      credit_note_sale_note: 'warning',
      sale_note:             'secondary',
      shipping_guide:        'info',
    };
    return map[type] ?? 'secondary';
  }

  nextCorrelative(id: number): string {
    return String((this.seriesEdits[id] ?? 0) + 1).padStart(8, '0');
  }

}
