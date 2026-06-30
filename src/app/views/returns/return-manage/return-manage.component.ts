import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent, SpinnerComponent } from '@coreui/angular';
import { Select } from 'primeng/select';
import { ReturnsService } from '../returns.service';
import { ReturnRecord, RETURN_STATUS_LABELS, RETURN_STATUS_COLORS } from '../returns.model';
import { SalesService } from '../../quotations/sales.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ManageReturnModalComponent } from '../manage-return-modal/manage-return-modal.component';
import { ClientSelectComponent } from '../../../shared/components/client-select/client-select.component';
import { ClientOption } from '../../clients/client.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-return-manage',
  standalone: true,
  imports: [
    DatePipe, FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent, Select, PageHeaderComponent,
    ManageReturnModalComponent, ClientSelectComponent, PaginationComponent,
  ],
  templateUrl: './return-manage.component.html',
})
export class ReturnManageComponent implements OnInit {
  returns  = signal<ReturnRecord[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);

  selected      = signal<ReturnRecord | null>(null);
  loadingDetail = signal(false);

  selectedClient: ClientOption | null = null;

  filters = {
    status: 'pending', client_id: undefined as number | undefined,
    date_from: '', date_to: '',
    per_page: 20, page: 1,
  };

  readonly statusOptions = [
    { label: 'Pendientes', value: 'pending'   },
    { label: 'Procesadas', value: 'accepted'  },
    { label: 'Rechazadas', value: 'cancelled' },
    { label: 'Todas',      value: ''          },
  ];
  readonly statusLabels = RETURN_STATUS_LABELS;
  readonly statusColors = RETURN_STATUS_COLORS;
  readonly actionColors: Record<string, string> = {
    credit_note: 'success',
    void:        'info',
    internal:    'secondary',
  };

  constructor(
    private svc:   ReturnsService,
    private sales: SalesService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.list(this.filters).subscribe({
      next: res => {
        this.returns.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  onClientFilterChange(c: ClientOption | null): void {
    this.selectedClient = c;
    this.filters.client_id = c?.id;
    this.onSearch();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.lastPage()) return;
    this.filters.page = p; this.load();
  }

  // ── Modal procesar ────────────────────────────────────────────────────────

  openProcess(r: ReturnRecord): void {
    this.selected.set(r);
    if (!r.items?.length) {
      this.loadingDetail.set(true);
      this.svc.get(r.id).subscribe({
        next: res => {
          this.selected.set(res.return);
          this.loadingDetail.set(false);
        },
        error: () => this.loadingDetail.set(false),
      });
    }
  }

  closeModal(): void {
    this.selected.set(null);
    this.loadingDetail.set(false);
  }

  onProcessed(r: ReturnRecord): void {
    this.returns.update(list => list.filter(x => x.id !== r.id));
    this.total.update(n => n - 1);
    this.closeModal();
  }

  onRejected(r: ReturnRecord): void {
    this.returns.update(list => list.filter(x => x.id !== r.id));
    this.total.update(n => n - 1);
    this.closeModal();
  }

  onReverted(r: ReturnRecord): void {
    this.returns.update(list => list.filter(x => x.id !== r.id));
    this.total.update(n => n - 1);
    this.closeModal();
    this.toast.success('Solicitud revertida. El usuario podrá editarla.');
  }

  clientName(r: ReturnRecord): string {
    const c = r.order?.client;
    return c ? (c.business_name || c.name) : '—';
  }

  openNcFile(type: 'pdf' | 'xml' | 'zip'): void {
    const nc = this.selected()?.credit_note;
    if (!nc) return;
    const url = type === 'pdf' ? nc.pdf_url : type === 'xml' ? nc.xml_url : nc.cdr_url;
    if (url) window.open(url, '_blank');
  }
}
