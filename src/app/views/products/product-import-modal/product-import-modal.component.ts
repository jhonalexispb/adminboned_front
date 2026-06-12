import { Component, inject, input, output, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { ProductService } from '../product.service';
import { ProductImportSummary } from '../product.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-import-modal',
  standalone: true,
  imports: [
    FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './product-import-modal.component.html',
})
export class ProductImportModalComponent {
  visible = input(false);

  imported = output<void>();
  cancelled = output<void>();

  importing = signal(false);
  downloading = signal(false);
  summary = signal<ProductImportSummary | null>(null);
  file: File | null = null;

  private svc   = inject(ProductService);
  private toast = inject(ToastService);

  onFileSelected(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  downloadTemplate(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.svc.downloadTemplate().subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_productos.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo descargar la plantilla.');
        this.downloading.set(false);
      },
    });
  }

  submit(): void {
    if (!this.file || this.importing()) return;
    this.importing.set(true);
    this.svc.importExcel(this.file).subscribe({
      next: res => {
        this.summary.set(res.summary);
        this.importing.set(false);
        if (res.summary.created || res.summary.updated) this.imported.emit();
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'Error al importar el archivo.');
        this.importing.set(false);
      },
    });
  }

  close(): void {
    if (this.importing()) return;
    this.file = null;
    this.summary.set(null);
    this.cancelled.emit();
  }
}
