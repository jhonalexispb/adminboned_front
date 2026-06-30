import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { GeoAdminService, AdminDepartment, AdminProvince, AdminDistrict } from '../geo-admin.service';
import { GeographyService, Department, Province } from '../../../core/services/geography.service';
import { DepartmentModalComponent } from '../department-modal/department-modal.component';
import { ProvinceModalComponent } from '../province-modal/province-modal.component';
import { DistrictModalComponent } from '../district-modal/district-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';

type Tab = 'departments' | 'provinces' | 'districts';

@Component({
  selector: 'app-geography-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, TableDirective, SpinnerComponent,
    PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './geography-list.component.html',
})
export class GeographyListComponent implements OnInit {
  tab = signal<Tab>('departments');

  // Departments
  departments   = signal<AdminDepartment[]>([]);
  depsLoading   = signal(false);
  depsTotal     = signal(0);
  depsLastPage  = signal(1);
  depsFilters   = { search: '', page: 1, per_page: 15 };

  // Provinces
  provinces     = signal<AdminProvince[]>([]);
  provsLoading  = signal(false);
  provsTotal    = signal(0);
  provsLastPage = signal(1);
  provsFilters  = { search: '', department_id: '', page: 1, per_page: 15 };

  // Districts
  districts     = signal<AdminDistrict[]>([]);
  distsLoading  = signal(false);
  distsTotal    = signal(0);
  distsLastPage = signal(1);
  distsFilters  = { search: '', department_id: '', province_id: '', page: 1, per_page: 20 };

  // Filter data
  allDepartments    = signal<Department[]>([]);
  filteredProvinces = signal<Province[]>([]);

  private readonly modalOpts = { centered: true, animation: false } as const;

  constructor(
    private svc: GeoAdminService,
    private geoSvc: GeographyService,
    private ngbModal: NgbModal,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
    this.geoSvc.departments().subscribe(d => this.allDepartments.set(d));
  }

  setTab(t: Tab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
    if (t === 'departments' && !this.departments().length) this.loadDepartments();
    if (t === 'provinces'   && !this.provinces().length)   this.loadProvinces();
    if (t === 'districts'   && !this.districts().length)   this.loadDistricts();
  }

  // ── Departments ───────────────────────────────────────────────────────────

  loadDepartments(): void {
    this.depsLoading.set(true);
    this.svc.listDepartments(this.depsFilters).subscribe({
      next: res => {
        this.departments.set(res.data);
        this.depsTotal.set(res.meta.total);
        this.depsLastPage.set(res.meta.last_page);
        this.depsLoading.set(false);
      },
      error: () => this.depsLoading.set(false),
    });
  }

  onDepsSearch(): void { this.depsFilters.page = 1; this.loadDepartments(); }
  depsGoToPage(p: number): void {
    if (p < 1 || p > this.depsLastPage()) return;
    this.depsFilters.page = p;
    this.loadDepartments();
  }

  openCreateDep(): void {
    const ref = this.ngbModal.open(DepartmentModalComponent, this.modalOpts);
    ref.result.then(() => { this.loadDepartments(); this.geoSvc.departments().subscribe(d => this.allDepartments.set(d)); }, () => {});
  }

  openEditDep(dep: AdminDepartment): void {
    const ref = this.ngbModal.open(DepartmentModalComponent, this.modalOpts);
    ref.componentInstance.department = dep;
    ref.result.then(() => { this.loadDepartments(); this.geoSvc.departments().subscribe(d => this.allDepartments.set(d)); }, () => {});
  }

  // ── Provinces ─────────────────────────────────────────────────────────────

  loadProvinces(): void {
    this.provsLoading.set(true);
    this.svc.listProvinces(this.provsFilters).subscribe({
      next: res => {
        this.provinces.set(res.data);
        this.provsTotal.set(res.meta.total);
        this.provsLastPage.set(res.meta.last_page);
        this.provsLoading.set(false);
      },
      error: () => this.provsLoading.set(false),
    });
  }

  onProvsSearch(): void { this.provsFilters.page = 1; this.loadProvinces(); }
  onProvsDeptChange(): void { this.provsFilters.page = 1; this.loadProvinces(); }
  provsGoToPage(p: number): void {
    if (p < 1 || p > this.provsLastPage()) return;
    this.provsFilters.page = p;
    this.loadProvinces();
  }

  openCreateProv(): void {
    const ref = this.ngbModal.open(ProvinceModalComponent, this.modalOpts);
    ref.result.then(() => this.loadProvinces(), () => {});
  }

  openEditProv(prov: AdminProvince): void {
    const ref = this.ngbModal.open(ProvinceModalComponent, this.modalOpts);
    ref.componentInstance.province = prov;
    ref.result.then(() => this.loadProvinces(), () => {});
  }

  // ── Districts ─────────────────────────────────────────────────────────────

  loadDistricts(): void {
    this.distsLoading.set(true);
    this.svc.listDistricts(this.distsFilters).subscribe({
      next: res => {
        this.districts.set(res.data);
        this.distsTotal.set(res.meta.total);
        this.distsLastPage.set(res.meta.last_page);
        this.distsLoading.set(false);
      },
      error: () => this.distsLoading.set(false),
    });
  }

  onDistsSearch(): void { this.distsFilters.page = 1; this.loadDistricts(); }
  onDistsDeptChange(): void {
    this.distsFilters.province_id = '';
    this.filteredProvinces.set([]);
    this.distsFilters.page = 1;
    this.loadDistricts();
    if (this.distsFilters.department_id) {
      this.geoSvc.provinces(Number(this.distsFilters.department_id)).subscribe(p => this.filteredProvinces.set(p));
    }
  }
  onDistsProvChange(): void { this.distsFilters.page = 1; this.loadDistricts(); }
  distsGoToPage(p: number): void {
    if (p < 1 || p > this.distsLastPage()) return;
    this.distsFilters.page = p;
    this.loadDistricts();
  }

  openCreateDist(): void {
    const ref = this.ngbModal.open(DistrictModalComponent, this.modalOpts);
    ref.result.then(() => this.loadDistricts(), () => {});
  }

  openEditDist(dist: AdminDistrict): void {
    const ref = this.ngbModal.open(DistrictModalComponent, this.modalOpts);
    ref.componentInstance.district = dist;
    ref.result.then(() => this.loadDistricts(), () => {});
  }
}
