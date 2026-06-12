import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { forkJoin, of, map } from 'rxjs';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective,
  SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import Swal from 'sweetalert2';
import { ReturnsService } from '../returns.service';
import { ReturnRecord, ReturnLine, RETURN_STATUS_LABELS, RETURN_STATUS_COLORS } from '../returns.model';
import { SalesService } from '../../quotations/sales.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ReturnDetailModalComponent } from '../return-detail-modal/return-detail-modal.component';
import { ReturnItemsEditorComponent } from '../return-items-editor/return-items-editor.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ClientSelectComponent } from '../../../shared/components/client-select/client-select.component';
import { ClientOption } from '../../clients/client.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-returns-list',
  standalone: true,
  imports: [
    RouterLink, DatePipe, FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent, ButtonDirective, Select, PageHeaderComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    ReturnDetailModalComponent, ReturnItemsEditorComponent, ConfirmModalComponent, ClientSelectComponent,
    PaginationComponent,
  ],
  templateUrl: './returns-list.component.html',
})
export class ReturnsListComponent implements OnInit {
  returns  = signal<ReturnRecord[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);

  selected     = signal<ReturnRecord | null>(null);
  loadingDetail = signal(false);
  downloadingNc = signal<number | null>(null);
  deletingId   = signal<number | null>(null);
  editingReturn = signal<ReturnRecord | null>(null);
  editReason   = '';
  editLines    = signal<ReturnLine[]>([]);
  loadingEditItems = signal(false);
  saving       = signal(false);

  selectedClient: ClientOption | null = null;

  filters = {
    status: '', client_id: undefined as number | undefined,
    date_from: ReturnsListComponent.firstDayOfMonth(),
    date_to:   ReturnsListComponent.today(),
    per_page: 20, page: 1,
  };

  private static firstDayOfMonth(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }
  private static today(): string { return new Date().toISOString().slice(0, 10); }

  readonly statusOptions = [
    { label: 'Todos',      value: '' },
    { label: 'Borrador',   value: 'draft' },
    { label: 'Pendiente',  value: 'pending' },
    { label: 'Procesada',  value: 'accepted' },
    { label: 'Rechazada',  value: 'cancelled' },
  ];
  readonly statusLabels = RETURN_STATUS_LABELS;
  readonly statusColors = RETURN_STATUS_COLORS;

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

  openDetail(r: ReturnRecord): void {
    this.selected.set(r);
    if (!r.items) {
      this.loadingDetail.set(true);
      this.svc.get(r.id).subscribe({
        next: res => {
          this.loadingDetail.set(false);
          if (this.selected()?.id === r.id) this.selected.set(res.return);
        },
        error: () => this.loadingDetail.set(false),
      });
    }
  }

  // ── Enviar (draft → pending) ──────────────────────────────────────────────

  async sendReturn(r: ReturnRecord): Promise<void> {
    const result = await Swal.fire({
      title: '¿Enviar solicitud?',
      html: `Una vez enviada, <b>no podrás editarla ni eliminarla</b>.<br>El equipo administrativo la revisará y gestionará.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
    });

    if (!result.isConfirmed) return;

    this.svc.send(r.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.returns.update(list => list.map(x => x.id === r.id ? res.return : x));
      },
      error: (err: any) => this.toast.error(err.error?.message ?? 'Error al enviar.'),
    });
  }

  // ── Editar motivo (solo draft) ────────────────────────────────────────────

  openEdit(r: ReturnRecord): void {
    this.editReason = r.reason;
    this.editingReturn.set(r);
    this.editLines.set([]);
    this.loadingEditItems.set(true);

    const return$ = r.items ? of(r) : this.svc.get(r.id).pipe(map(res => res.return));
    forkJoin({ ret: return$, order: this.sales.getOrder(r.order_id) }).subscribe({
      next: ({ ret, order }) => {
        const returnItems = ret.items ?? [];
        const lines: ReturnLine[] = (order.order.items ?? []).map(item => {
          const match = returnItems.find(ri => ri.product_id === item.product_id && ri.lot_id === item.lot_id);
          const maxQty = item.returnable_quantity ?? item.quantity;
          return {
            orderItem: item,
            returnQty: match ? match.quantity : Math.min(1, maxQty),
            selected:  !!match,
          };
        });
        this.editLines.set(lines);
        this.loadingEditItems.set(false);
      },
      error: () => this.loadingEditItems.set(false),
    });
  }

  get hasSelectedEditItems(): boolean {
    return this.editLines().some(l => l.selected && l.returnQty > 0);
  }

  saveEdit(): void {
    const r = this.editingReturn();
    if (!r || this.saving()) return;

    const items = this.editLines()
      .filter(l => l.selected && l.returnQty > 0)
      .map(l => ({ product_id: l.orderItem.product_id, lot_id: l.orderItem.lot_id, quantity: l.returnQty }));
    if (!items.length) return;

    this.saving.set(true);
    this.svc.update(r.id, { reason: this.editReason, items }).subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.returns.update(list => list.map(x => x.id === r.id ? res.return : x));
        this.editingReturn.set(null);
      },
      error: (err: any) => {
        this.saving.set(false);
        this.toast.error(err.error?.message ?? 'Error al actualizar.');
      },
    });
  }

  // ── Eliminar (solo draft) ─────────────────────────────────────────────────

  confirmDelete(r: ReturnRecord): void { this.deletingId.set(r.id); }

  doDelete(): void {
    const id = this.deletingId();
    if (!id) return;
    this.svc.delete(id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.returns.update(list => list.filter(x => x.id !== id));
        this.deletingId.set(null);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.deletingId.set(null);
      },
    });
  }

  clientName(r: ReturnRecord): string {
    const c = r.order?.client;
    return c ? (c.business_name || c.name) : '—';
  }

  // ── Descarga de Nota de Crédito (sin abrir el modal) ──────────────────────

  downloadCreditNote(r: ReturnRecord): void {
    const nc = r.credit_note;
    if (!nc || this.downloadingNc()) return;

    if (!nc.is_internal && nc.pdf_url) {
      window.open(nc.pdf_url, '_blank');
      return;
    }

    this.downloadingNc.set(nc.id);
    this.sales.downloadDocumentFile('credit-notes', nc.id, 'pdf').subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${nc.full_number}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingNc.set(null);
      },
      error: () => {
        this.toast.error('Error al descargar el PDF.');
        this.downloadingNc.set(null);
      },
    });
  }
}
