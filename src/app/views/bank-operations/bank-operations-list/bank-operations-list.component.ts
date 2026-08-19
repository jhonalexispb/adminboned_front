import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent,
  SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { BankOperationService, BankOperationFilters } from '../bank-operation.service';
import { BankOperation, BANK_OPERATION_SOURCES } from '../bank-operation.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-bank-operations-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, FaIconComponent, Select,
    BadgeComponent, ButtonDirective, CardComponent, CardBodyComponent, SpinnerComponent, TableDirective,
    PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './bank-operations-list.component.html',
})
export class BankOperationsListComponent implements OnInit {
  items    = signal<BankOperation[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);
  duplicatesCount = signal(0);

  readonly faTriangleExclamation = faTriangleExclamation;
  readonly SOURCES = BANK_OPERATION_SOURCES;

  sourceOptions = [
    { value: null,         label: 'Todos los orígenes' },
    { value: 'collection', label: 'Cobro a cliente' },
    { value: 'deposit',    label: 'Depósito de caja' },
    { value: 'advance',    label: 'Viáticos entregados' },
    { value: 'return',     label: 'Devolución de viáticos' },
    { value: 'expense',    label: 'Gasto de viáticos' },
  ];

  filters: BankOperationFilters = { page: 1, per_page: 30, only_duplicates: false };

  constructor(private svc: BankOperationService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.list(this.filters).subscribe({
      next: r => {
        this.items.set(r.data);
        this.total.set(r.meta.total);
        this.lastPage.set(r.meta.last_page);
        this.duplicatesCount.set(r.duplicates_count);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.filters.page = 1; this.load(); }
  onPage(p: number): void { this.filters.page = p; this.load(); }
}
