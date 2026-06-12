import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchaseService } from '../purchase.service';
import { PurchaseOrder, ORDER_STATUS_LABELS } from '../purchase.model';

@Component({
  selector: 'app-order-print',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './order-print.component.html',
})
export class OrderPrintComponent implements OnInit {
  order   = signal<PurchaseOrder | null>(null);
  loading = signal(true);

  statusLabel = ORDER_STATUS_LABELS;
  today = new Date();

  badgeClass(status: string): string {
    const map: Record<string, string> = {
      draft: 'secondary', sent: 'info', partial: 'warning',
      received: 'success', cancelled: 'danger',
    };
    return map[status] ?? 'secondary';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.purchaseService.getOrder(id).subscribe({
      next: res => {
        this.order.set(res.order);
        this.loading.set(false);
        setTimeout(() => window.print(), 400);
      },
      error: () => this.router.navigate(['/purchases/orders']),
    });
  }
}
