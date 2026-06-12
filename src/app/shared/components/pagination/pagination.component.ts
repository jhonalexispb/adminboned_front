import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (lastPage() > 1) {
      <div class="d-flex align-items-center {{ wrapperClass() }}"
           [class.justify-content-between]="total() !== null"
           [class.justify-content-center]="total() === null">
        @if (total() !== null) {
          <small class="text-body-secondary">Total: {{ total() }} registros</small>
        }
        <nav>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" [class.disabled]="currentPage() === 1">
              <button class="page-link" (click)="go(currentPage() - 1)">‹</button>
            </li>
            @for (pg of pages(); track $index) {
              @if (pg === ELLIPSIS) {
                <li class="page-item disabled"><span class="page-link">…</span></li>
              } @else {
                <li class="page-item" [class.active]="pg === currentPage()">
                  <button class="page-link" (click)="go(pg)">{{ pg }}</button>
                </li>
              }
            }
            <li class="page-item" [class.disabled]="currentPage() === lastPage()">
              <button class="page-link" (click)="go(currentPage() + 1)">›</button>
            </li>
          </ul>
        </nav>
      </div>
    }
  `,
})
export class PaginationComponent {
  readonly ELLIPSIS = -1;

  currentPage  = input.required<number>();
  lastPage     = input.required<number>();
  total        = input<number | null>(null);
  wrapperClass = input('mt-3');

  pageChange = output<number>();

  pages = computed<number[]>(() => {
    const last    = this.lastPage();
    const current = this.currentPage();
    const delta   = 1;

    const result: number[] = [];
    for (let i = 1; i <= last; i++) {
      const isEdge   = i === 1 || i === last;
      const isAround = i >= current - delta && i <= current + delta;
      if (isEdge || isAround) {
        result.push(i);
      } else if (result[result.length - 1] !== this.ELLIPSIS) {
        result.push(this.ELLIPSIS);
      }
    }
    return result;
  });

  go(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) return;
    this.pageChange.emit(page);
  }
}
