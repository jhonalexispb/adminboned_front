import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Select } from 'primeng/select';
import {
  CardBodyComponent, CardComponent, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { ClientService, ClientFilters } from '../client.service';
import { Client } from '../client.model';
import { ClientModalComponent } from '../client-modal/client-modal.component';
import { CatalogAccessModalComponent } from '../catalog-access-modal/catalog-access-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';
import { GeographyService, Department, Province, District } from '../../../core/services/geography.service';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, CardComponent, CardBodyComponent,
    TableDirective, SpinnerComponent, Select,
    PageHeaderComponent, StatusBadgeComponent, ConfirmModalComponent, PaginationComponent,
    NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownItem,
  ],
  templateUrl: './clients-list.component.html'
})
export class ClientsListComponent implements OnInit {
  clients  = signal<Client[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);

  filters: ClientFilters = {
    search: '', active: '', catalog_enabled: '',
    department_id: null, province_id: null, district_id: null, seller_id: null,
    per_page: 15, page: 1,
  };
  view: 'all' | 'catalog' = 'all';

  departments = signal<Department[]>([]);
  provinces   = signal<Province[]>([]);
  districts   = signal<District[]>([]);
  sellers     = signal<{ id: number; name: string }[]>([]);
  loadingProvs = signal(false);
  loadingDists = signal(false);
  downloadingPdf = signal(false);

  showConfirm  = signal(false);
  deletingId   = signal<number | null>(null);
  deletingName = signal('');

  constructor(
    private clientService: ClientService,
    private geoSvc: GeographyService,
    private ngbModal: NgbModal,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.load();
    this.geoSvc.departments().subscribe({ next: r => this.departments.set(r) });
    this.clientService.sellers().subscribe({ next: r => this.sellers.set(r) });
  }

  onSellerChange(sellerId: number | null): void {
    this.filters.seller_id = sellerId;
    this.onSearch();
  }

  onDepartmentChange(departmentId: number | null): void {
    this.filters.department_id = departmentId;
    this.filters.province_id = null;
    this.filters.district_id = null;
    this.provinces.set([]);
    this.districts.set([]);
    if (departmentId) {
      this.loadingProvs.set(true);
      this.geoSvc.provinces(departmentId).subscribe({
        next: r => { this.provinces.set(r); this.loadingProvs.set(false); },
        error: () => this.loadingProvs.set(false),
      });
    }
    this.onSearch();
  }

  onProvinceChange(provinceId: number | null): void {
    this.filters.province_id = provinceId;
    this.filters.district_id = null;
    this.districts.set([]);
    if (provinceId) {
      this.loadingDists.set(true);
      this.geoSvc.districts(provinceId).subscribe({
        next: r => { this.districts.set(r); this.loadingDists.set(false); },
        error: () => this.loadingDists.set(false),
      });
    }
    this.onSearch();
  }

  onDistrictChange(districtId: number | null): void {
    this.filters.district_id = districtId;
    this.onSearch();
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.clientService.downloadPdf(this.filters).subscribe({
      next: blob => {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `clientes-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => {
        this.toast.error('No se pudo generar el PDF.');
        this.downloadingPdf.set(false);
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.clientService.list(this.filters).subscribe({
      next: res => {
        this.clients.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  setView(view: 'all' | 'catalog'): void {
    if (this.view === view) return;
    this.view = view;
    this.filters.catalog_enabled = view === 'catalog' ? true : '';
    this.filters.page = 1;
    this.load();
  }

  isCatalogExpired(client: Client): boolean {
    return !!client.catalog_access_expires_at && new Date(client.catalog_access_expires_at) < new Date();
  }

  catalogBadgeClass(client: Client): string {
    if (!client.catalog_enabled) return 'bg-secondary-subtle text-secondary-emphasis';
    return this.isCatalogExpired(client) ? 'bg-warning-subtle text-warning-emphasis' : 'bg-info-subtle text-info-emphasis';
  }

  catalogBadgeLabel(client: Client): string {
    if (!client.catalog_enabled) return 'Sin acceso';
    if (!client.catalog_access_expires_at) return 'Activo · sin vencimiento';
    const date = new Date(client.catalog_access_expires_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return this.isCatalogExpired(client) ? `Vencido el ${date}` : `Activo hasta ${date}`;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.filters.page = page;
    this.load();
  }

  private readonly modalOpts = { centered: true, size: 'lg', animation: false } as const;

  openCreate(): void {
    const ref = this.ngbModal.open(ClientModalComponent, this.modalOpts);
    ref.result.then(() => this.load(), () => {});
  }

  openEdit(client: Client): void {
    const ref = this.ngbModal.open(ClientModalComponent, this.modalOpts);
    ref.componentInstance.client = client;
    ref.result.then(() => this.load(), () => {});
  }

  openCatalogAccess(client: Client): void {
    const ref = this.ngbModal.open(CatalogAccessModalComponent, { centered: true, animation: false });
    ref.componentInstance.client = client;
    ref.result.then(() => this.load(), () => {});
  }

  confirmDelete(client: Client): void {
    this.deletingId.set(client.id);
    this.deletingName.set(client.business_name);
    this.showConfirm.set(true);
  }

  call(phone: string): void {
    window.location.href = 'tel:' + phone.replace(/\s/g, '');
  }

  whatsapp(phone: string): void {
    const digits = phone.replace(/\D/g, '');
    window.open(`https://wa.me/51${digits}`, '_blank');
  }

  mail(email: string): void {
    window.location.href = 'mailto:' + email;
  }

  onConfirmDelete(): void {
    const id = this.deletingId();
    if (!id) return;
    this.showConfirm.set(false);
    this.clientService.delete(id).subscribe({
      next: res  => { this.toast.success(res.message); this.load(); },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar.')
    });
  }
}
