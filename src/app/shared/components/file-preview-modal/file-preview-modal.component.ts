import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { isImageUrl } from '../../utils/attachment.util';

/**
 * Visor de comprobantes (imagen o PDF) en modal, para no perder el contexto
 * de la pantalla abriendo una pestaña nueva del navegador.
 * Uso: <app-file-preview-modal #filePreview /> y desde cualquier lugar del
 * mismo template, (click)="filePreview.open(url)".
 */
@Component({
  selector: 'app-file-preview-modal',
  standalone: true,
  imports: [FaIconComponent],
  template: `
    @if (url()) {
      <div class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
           style="z-index:9999; background:rgba(0,0,0,.88);"
           (click)="close()">
        <div style="max-width:95vw; max-height:90vh;" (click)="$event.stopPropagation()">
          @if (isImage()) {
            <img [src]="url()!" alt="Comprobante"
                 style="max-width:95vw; max-height:88vh; border-radius:6px; object-fit:contain; box-shadow:0 8px 32px rgba(0,0,0,.5); display:block;" />
          } @else {
            <iframe [src]="safeUrl()" title="Comprobante"
                    style="width:88vw; height:88vh; border:0; border-radius:6px; background:#fff;"></iframe>
          }
        </div>
        <button type="button" class="btn btn-sm btn-outline-light position-absolute"
                style="top:16px; right:16px; opacity:.85;" (click)="close()">
          <fa-icon icon="xmark" />
        </button>
        <a [href]="url()!" download
           class="btn btn-sm btn-outline-light position-absolute d-flex align-items-center gap-1"
           style="top:16px; right:76px; opacity:.85;" (click)="$event.stopPropagation()">
          <fa-icon icon="download" class="me-1" />Descargar
        </a>
      </div>
    }
  `,
})
export class FilePreviewModalComponent {
  private sanitizer = inject(DomSanitizer);

  readonly url = signal<string | null>(null);

  private readonly safeResourceUrl = computed<SafeResourceUrl | null>(() => {
    const u = this.url();
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null;
  });

  isImage(): boolean {
    return isImageUrl(this.url());
  }

  safeUrl(): SafeResourceUrl | null {
    return this.safeResourceUrl();
  }

  open(url: string): void {
    this.url.set(url);
  }

  close(): void {
    this.url.set(null);
  }
}
