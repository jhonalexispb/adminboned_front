import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackgroundSlot, CatalogBackground, CatalogBanner, CatalogLoadingMessage, CatalogSettings } from './catalog-appearance.model';

export interface BackgroundPayload {
  slot: BackgroundSlot;
  image?: File | null;
  label?: string | null;
  effect?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active?: boolean;
}

export interface LoadingMessagePayload {
  message?: string;
  active?: boolean;
  sort_order?: number;
}

export interface BannerPayload {
  image?: File | null;
  link_url?: string | null;
  product_id?: number | null;
  title?: string | null;
  sort_order?: number;
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogAppearanceService {
  private backgroundsUrl     = `${environment.apiUrl}/catalog-appearance/backgrounds`;
  private bannersUrl         = `${environment.apiUrl}/catalog-banners`;
  private loadingMessagesUrl = `${environment.apiUrl}/catalog-loading-messages`;
  private settingsUrl        = `${environment.apiUrl}/catalog-appearance/settings`;

  constructor(private http: HttpClient) {}

  listBackgrounds(): Observable<CatalogBackground[]> {
    return this.http.get<CatalogBackground[]>(this.backgroundsUrl);
  }

  createBackground(payload: BackgroundPayload): Observable<{ message: string; background: CatalogBackground }> {
    return this.http.post<{ message: string; background: CatalogBackground }>(this.backgroundsUrl, this.toFormData(payload));
  }

  updateBackground(id: number, payload: Partial<BackgroundPayload>): Observable<{ message: string; background: CatalogBackground }> {
    return this.http.post<{ message: string; background: CatalogBackground }>(`${this.backgroundsUrl}/${id}`, this.toFormData(payload));
  }

  deleteBackground(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.backgroundsUrl}/${id}`);
  }

  listBanners(): Observable<CatalogBanner[]> {
    return this.http.get<CatalogBanner[]>(this.bannersUrl);
  }

  createBanner(payload: BannerPayload): Observable<{ message: string; banner: CatalogBanner }> {
    return this.http.post<{ message: string; banner: CatalogBanner }>(this.bannersUrl, this.toFormData(payload));
  }

  updateBanner(id: number, payload: Partial<BannerPayload>): Observable<{ message: string; banner: CatalogBanner }> {
    const form = this.toFormData(payload);
    form.append('_method', 'PUT');
    return this.http.post<{ message: string; banner: CatalogBanner }>(`${this.bannersUrl}/${id}`, form);
  }

  deleteBanner(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.bannersUrl}/${id}`);
  }

  reorderBanners(items: { id: number; sort_order: number }[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.bannersUrl}/reorder`, { items });
  }

  listLoadingMessages(): Observable<CatalogLoadingMessage[]> {
    return this.http.get<CatalogLoadingMessage[]>(this.loadingMessagesUrl);
  }

  createLoadingMessage(payload: LoadingMessagePayload): Observable<{ message: string; item: CatalogLoadingMessage }> {
    return this.http.post<{ message: string; item: CatalogLoadingMessage }>(this.loadingMessagesUrl, payload);
  }

  updateLoadingMessage(id: number, payload: LoadingMessagePayload): Observable<{ message: string; item: CatalogLoadingMessage }> {
    return this.http.put<{ message: string; item: CatalogLoadingMessage }>(`${this.loadingMessagesUrl}/${id}`, payload);
  }

  deleteLoadingMessage(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.loadingMessagesUrl}/${id}`);
  }

  reorderLoadingMessages(items: { id: number; sort_order: number }[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.loadingMessagesUrl}/reorder`, { items });
  }

  getPublicAppearance(): Observable<{ banners: Pick<CatalogBanner, 'id' | 'image_url' | 'link_url' | 'title' | 'product_id'>[]; settings: CatalogSettings }> {
    return this.http.get<{ banners: Pick<CatalogBanner, 'id' | 'image_url' | 'link_url' | 'title' | 'product_id'>[]; settings: CatalogSettings }>(`${environment.apiUrl}/catalog/appearance`);
  }

  getSettings(): Observable<CatalogSettings> {
    return this.http.get<CatalogSettings>(this.settingsUrl);
  }

  updateSettings(payload: CatalogSettings): Observable<{ message: string; settings: CatalogSettings }> {
    return this.http.put<{ message: string; settings: CatalogSettings }>(this.settingsUrl, payload);
  }

  private toFormData(payload: Record<string, any>): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      if (value instanceof File) {
        form.append(key, value);
      } else if (typeof value === 'boolean') {
        form.append(key, value ? '1' : '0');
      } else {
        form.append(key, String(value));
      }
    }
    return form;
  }
}
