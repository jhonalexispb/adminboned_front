import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-toaster',
  standalone: true,
  imports: [FaIconComponent],
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index:9998">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast show align-items-center text-white border-0 mb-2"
          [class.bg-success]="toast.color === 'success'"
          [class.bg-warning]="toast.color === 'warning'"
          [class.bg-info]="toast.color === 'info'"
          role="alert"
        >
          <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
              <fa-icon [icon]="toast.icon" />
              <span>{{ toast.message }}</span>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto"
              (click)="toastService.remove(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `
})
export class ToasterComponent {
  toastService = inject(ToastService);
}
