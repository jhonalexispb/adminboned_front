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
import { DocumentAuditService, DocumentAuditFilters } from '../document-audit.service';
import { DocumentAuditRow, DOCUMENT_AUDIT_TYPE_LABELS, DocumentAuditType } from '../document-audit.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-document-audit-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, FaIconComponent, Select,
    BadgeComponent, ButtonDirective, CardComponent, CardBodyComponent, SpinnerComponent, TableDirective,
    PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './document-audit-list.component.html',
})
export class DocumentAuditListComponent implements OnInit {
  items    = signal<DocumentAuditRow[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);
  repeatedCount = signal(0);

  readonly faTriangleExclamation = faTriangleExclamation;

  typeOptions = [
    { value: null,     label: 'Todos los tipos' },
    { value: 'boleta', label: 'Boleta' },
    { value: 'factura', label: 'Factura' },
    { value: 'ticket', label: 'Ticket' },
    { value: 'otro',   label: 'Otro' },
  ];

  filters: DocumentAuditFilters = { page: 1, per_page: 30, only_repeated: false };

  constructor(private svc: DocumentAuditService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.list(this.filters).subscribe({
      next: r => {
        this.items.set(r.data);
        this.total.set(r.meta.total);
        this.lastPage.set(r.meta.last_page);
        this.repeatedCount.set(r.repeated_count);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.filters.page = 1; this.load(); }
  onPage(p: number): void { this.filters.page = p; this.load(); }

  typeLabel(type: DocumentAuditType): string {
    return DOCUMENT_AUDIT_TYPE_LABELS[type] ?? type;
  }
}
