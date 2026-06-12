import { Component, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [FaIconComponent],
  template: `
    @if (loading.loading()) {
      <div class="loading-overlay">
        <div class="loading-box">
          <div class="loading-spinner mb-3">
            <fa-icon icon="circle-notch" [animation]="'spin'" size="3x" />
          </div>
          <p class="loading-message mb-0">{{ loading.message() }}</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .loading-box {
      background: white;
      border-radius: 16px;
      padding: 2.5rem 3rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      min-width: 220px;
    }
    .loading-spinner {
      color: #321fdb;
    }
    .loading-message {
      font-size: 1.05rem;
      font-weight: 500;
      color: #333;
    }
  `]
})
export class LoadingOverlayComponent {
  loading = inject(LoadingService);
}
