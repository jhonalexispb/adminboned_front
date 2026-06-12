import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ProductPayload, ProductImage, PricingData, ProductImportSummary } from './product.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface ProductFilters {
  search?: string;
  category_id?: number | null | '';
  laboratory_id?: number | null | '';
  supplier_id?: number | null;
  active?: boolean | '';
  per_page?: number;
  page?: number;
  for_sale?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private url = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  list(filters: ProductFilters = {}): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams();
    if (filters.search)                                        params = params.set('search', filters.search);
    if (filters.category_id !== '' && filters.category_id)    params = params.set('category_id', String(filters.category_id));
    if (filters.laboratory_id !== '' && filters.laboratory_id) params = params.set('laboratory_id', String(filters.laboratory_id));
    if (filters.active !== '' && filters.active !== undefined) params = params.set('active', String(filters.active));
    if (filters.per_page)                                      params = params.set('per_page', String(filters.per_page));
    if (filters.page)                                          params = params.set('page', String(filters.page));
    if (filters.supplier_id)                                   params = params.set('supplier_id', String(filters.supplier_id));
    if (filters.for_sale)                                      params = params.set('for_sale', 'true');
    return this.http.get<PaginatedResponse<Product>>(this.url, { params });
  }

  get(id: number, forSale = false): Observable<{ product: Product }> {
    let params = new HttpParams();
    if (forSale) params = params.set('for_sale', '1');
    return this.http.get<{ product: Product }>(`${this.url}/${id}`, { params });
  }

  getPricing(id: number): Observable<PricingData> {
    return this.http.get<PricingData>(`${this.url}/${id}/pricing`);
  }

  create(payload: ProductPayload): Observable<{ message: string; product: Product }> {
    return this.http.post<{ message: string; product: Product }>(this.url, payload);
  }

  update(id: number, payload: ProductPayload | Partial<ProductPayload>): Observable<{ message: string; product: Product }> {
    return this.http.put<{ message: string; product: Product }>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }

  deactivate(id: number): Observable<{ message: string; product: Product }> {
    return this.http.patch<{ message: string; product: Product }>(`${this.url}/${id}/deactivate`, {});
  }

  // Image management
  uploadImages(productId: number, files: File[]): Observable<{ message: string; images: ProductImage[] }> {
    const fd = new FormData();
    files.forEach(f => fd.append('images[]', f));
    return this.http.post<{ message: string; images: ProductImage[] }>(`${this.url}/${productId}/images`, fd);
  }

  setPrimaryImage(productId: number, imageId: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.url}/${productId}/images/${imageId}/set-primary`, {});
  }

  deleteImage(productId: number, imageId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${productId}/images/${imageId}`);
  }

  reorderImages(productId: number, order: number[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.url}/${productId}/images/reorder`, { order });
  }

  // Importación masiva
  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.url}/import/template`, { responseType: 'blob' });
  }

  importExcel(file: File): Observable<{ message: string; summary: ProductImportSummary }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ message: string; summary: ProductImportSummary }>(`${this.url}/import`, fd);
  }
}
