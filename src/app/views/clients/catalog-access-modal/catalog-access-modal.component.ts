import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { SpinnerComponent } from '@coreui/angular';
import { ClientService } from '../client.service';
import { Client } from '../client.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-catalog-access-modal',
  standalone: true,
  imports: [FormsModule, DatePipe, FaIconComponent, SpinnerComponent],
  templateUrl: './catalog-access-modal.component.html'
})
export class CatalogAccessModalComponent implements OnInit {
  @Input() client!: Client;

  saving = signal(false);
  error  = '';

  /** '7' | '15' | '30' | '60' | '90' | 'custom' | 'none' */
  durationOption = '30';
  customDate = '';

  constructor(
    public modal: NgbActiveModal,
    private clientService: ClientService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.durationOption = this.client.catalog_enabled && !this.client.catalog_access_expires_at ? 'none' : '30';
  }

  get isEnabled(): boolean {
    return this.client.catalog_enabled;
  }

  get isExpired(): boolean {
    return !!this.client.catalog_access_expires_at && new Date(this.client.catalog_access_expires_at) < new Date();
  }

  activate(): void {
    let expiresAt: string | null = null;

    if (this.durationOption === 'custom') {
      if (!this.customDate) {
        this.error = 'Selecciona una fecha y hora de vencimiento.';
        return;
      }
      expiresAt = this.customDate;
    } else if (this.durationOption !== 'none') {
      const days = Number(this.durationOption);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }

    this.save(true, expiresAt);
  }

  deactivate(): void {
    this.save(false, null);
  }

  private save(enabled: boolean, expiresAt: string | null): void {
    this.saving.set(true);
    this.error = '';
    this.clientService.updateCatalogAccess(this.client.id, {
      catalog_enabled: enabled,
      catalog_access_expires_at: expiresAt,
    }).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.modal.close(res.client);
      },
      error: err => {
        this.error = err.error?.message ?? 'Error al actualizar el acceso al catálogo.';
        this.saving.set(false);
      }
    });
  }
}
