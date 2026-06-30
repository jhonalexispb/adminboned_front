import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { CardBodyComponent, CardComponent, CardHeaderComponent, SpinnerComponent, TableDirective } from '@coreui/angular';
import { CatalogAppearanceService } from './catalog-appearance.service';
import { CatalogBackground, CatalogBanner, CatalogLoadingMessage, CatalogSettings } from './catalog-appearance.model';
import { EventModalComponent } from './event-modal/event-modal.component';
import { BannerModalComponent } from './banner-modal/banner-modal.component';
import { LoadingMessageModalComponent } from './loading-message-modal/loading-message-modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-catalog-appearance',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, CardComponent, CardBodyComponent, CardHeaderComponent,
    TableDirective, SpinnerComponent, PageHeaderComponent, ConfirmModalComponent,
  ],
  templateUrl: './catalog-appearance.component.html'
})
export class CatalogAppearanceComponent implements OnInit {
  backgrounds     = signal<CatalogBackground[]>([]);
  banners         = signal<CatalogBanner[]>([]);
  loadingMessages = signal<CatalogLoadingMessage[]>([]);
  loading         = signal(true);

  settings           = signal<CatalogSettings | null>(null);
  savingSettings     = signal(false);
  bannerDurationSeconds = 4;
  eventDisplayFrequency: 'always' | 'daily' = 'daily';
  cardImageRatio = 60;

  showConfirm   = signal(false);
  confirmTarget: { type: 'event' | 'banner' | 'message'; id: number; name: string } | null = null;

  reorderingId = signal<number | null>(null);

  constructor(
    private svc: CatalogAppearanceService,
    private ngbModal: NgbModal,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.fetchAll().then(() => this.loading.set(false));
  }

  /** Refresca los datos sin mostrar el spinner de carga completa (evita recargar toda la vista). */
  reload(): void {
    this.fetchAll();
  }

  private fetchAll(): Promise<void> {
    return Promise.all([
      new Promise<void>(resolve => this.svc.listBackgrounds().subscribe({
        next: res => { this.backgrounds.set(res); resolve(); },
        error: () => resolve(),
      })),
      new Promise<void>(resolve => this.svc.listBanners().subscribe({
        next: res => { this.banners.set(res); resolve(); },
        error: () => resolve(),
      })),
      new Promise<void>(resolve => this.svc.listLoadingMessages().subscribe({
        next: res => { this.loadingMessages.set(res); resolve(); },
        error: () => resolve(),
      })),
      new Promise<void>(resolve => this.svc.getSettings().subscribe({
        next: res => {
          this.settings.set(res);
          this.bannerDurationSeconds = res.banner_duration_ms / 1000;
          this.eventDisplayFrequency = res.event_display_frequency;
          this.cardImageRatio = res.card_image_ratio ?? 60;
          resolve();
        },
        error: () => resolve(),
      })),
    ]).then(() => {});
  }

  saveSettings(): void {
    this.savingSettings.set(true);
    this.svc.updateSettings({
      banner_duration_ms: Math.round(this.bannerDurationSeconds * 1000),
      event_display_frequency: this.eventDisplayFrequency,
      card_image_ratio: this.cardImageRatio,
    }).subscribe({
      next: res => {
        this.settings.set(res.settings);
        this.savingSettings.set(false);
        this.toast.success(res.message);
      },
      error: err => {
        this.savingSettings.set(false);
        this.toast.error(err.error?.message ?? 'Error al guardar la configuración.');
      },
    });
  }

  get events(): CatalogBackground[] {
    return this.backgrounds().filter(b => b.slot === 'event');
  }

  isEventActive(ev: CatalogBackground): boolean {
    if (!ev.active) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (ev.starts_at && ev.starts_at > today) return false;
    if (ev.ends_at && ev.ends_at < today) return false;
    return true;
  }

  openCreateEvent(): void {
    const ref = this.ngbModal.open(EventModalComponent, { centered: true, size: 'lg' });
    ref.result.then(() => this.reload(), () => {});
  }

  openEditEvent(ev: CatalogBackground): void {
    const ref = this.ngbModal.open(EventModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.event = ev;
    ref.result.then(() => this.reload(), () => {});
  }

  confirmDeleteEvent(ev: CatalogBackground): void {
    this.confirmTarget = { type: 'event', id: ev.id, name: ev.label || 'este evento' };
    this.showConfirm.set(true);
  }

  openCreateBanner(): void {
    const ref = this.ngbModal.open(BannerModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.nextSortOrder = this.banners().length;
    ref.result.then(() => this.reload(), () => {});
  }

  openEditBanner(banner: CatalogBanner): void {
    const ref = this.ngbModal.open(BannerModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.banner = banner;
    ref.result.then(() => this.reload(), () => {});
  }

  confirmDeleteBanner(banner: CatalogBanner): void {
    this.confirmTarget = { type: 'banner', id: banner.id, name: banner.title || 'este banner' };
    this.showConfirm.set(true);
  }

  openCreateLoadingMessage(): void {
    const ref = this.ngbModal.open(LoadingMessageModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.nextSortOrder = this.loadingMessages().length;
    ref.result.then(() => this.reload(), () => {});
  }

  openEditLoadingMessage(item: CatalogLoadingMessage): void {
    const ref = this.ngbModal.open(LoadingMessageModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.loadingMessage = item;
    ref.result.then(() => this.reload(), () => {});
  }

  confirmDeleteLoadingMessage(item: CatalogLoadingMessage): void {
    this.confirmTarget = { type: 'message', id: item.id, name: item.message };
    this.showConfirm.set(true);
  }

  moveLoadingMessage(item: CatalogLoadingMessage, direction: -1 | 1): void {
    const list = [...this.loadingMessages()].sort((a, b) => a.sort_order - b.sort_order);
    const index = list.findIndex(m => m.id === item.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];

    this.reorderingId.set(item.id);
    const items = list.map((m, i) => ({ id: m.id, sort_order: i }));
    this.svc.reorderLoadingMessages(items).subscribe({
      next: () => { this.reorderingId.set(null); this.reload(); },
      error: err => {
        this.reorderingId.set(null);
        this.toast.error(err.error?.message ?? 'Error al reordenar.');
      },
    });
  }

  get sortedLoadingMessages(): CatalogLoadingMessage[] {
    return [...this.loadingMessages()].sort((a, b) => a.sort_order - b.sort_order);
  }

  onConfirmDelete(): void {
    const target = this.confirmTarget;
    if (!target) return;
    this.showConfirm.set(false);

    const request = target.type === 'event'
      ? this.svc.deleteBackground(target.id)
      : target.type === 'banner'
        ? this.svc.deleteBanner(target.id)
        : this.svc.deleteLoadingMessage(target.id);

    request.subscribe({
      next: res => { this.toast.success(res.message); this.reload(); },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar.'),
    });
  }

  moveBanner(banner: CatalogBanner, direction: -1 | 1): void {
    const list = [...this.banners()].sort((a, b) => a.sort_order - b.sort_order);
    const index = list.findIndex(b => b.id === banner.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];

    this.reorderingId.set(banner.id);
    const items = list.map((b, i) => ({ id: b.id, sort_order: i }));
    this.svc.reorderBanners(items).subscribe({
      next: () => { this.reorderingId.set(null); this.reload(); },
      error: err => {
        this.reorderingId.set(null);
        this.toast.error(err.error?.message ?? 'Error al reordenar.');
      },
    });
  }

  get sortedBanners(): CatalogBanner[] {
    return [...this.banners()].sort((a, b) => a.sort_order - b.sort_order);
  }
}
