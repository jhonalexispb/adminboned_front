import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategoryOrderResponse, GroupProduct } from './catalog-order.model';

@Injectable({ providedIn: 'root' })
export class CatalogOrderService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  reorderLaboratories(order: number[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/laboratories/reorder`, { order });
  }

  reorderCategories(order: number[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/categories/reorder`, { order });
  }

  getCategoryOrder(laboratoryId: number): Observable<CategoryOrderResponse> {
    return this.http.get<CategoryOrderResponse>(`${this.apiUrl}/laboratories/${laboratoryId}/category-order`);
  }

  setCategoryOrder(laboratoryId: number, order: number[]): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/laboratories/${laboratoryId}/category-order`, { order });
  }

  resetCategoryOrder(laboratoryId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/laboratories/${laboratoryId}/category-order`);
  }

  getProductsByGroup(laboratoryId: number, categoryId: number): Observable<{ products: GroupProduct[] }> {
    return this.http.get<{ products: GroupProduct[] }>(
      `${this.apiUrl}/laboratories/${laboratoryId}/categories/${categoryId}/products`
    );
  }

  reorderProductsInGroup(laboratoryId: number, categoryId: number, order: number[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.apiUrl}/laboratories/${laboratoryId}/categories/${categoryId}/products/reorder`,
      { order }
    );
  }
}
