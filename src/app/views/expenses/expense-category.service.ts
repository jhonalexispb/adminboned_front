import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExpenseCategoryItem } from './expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseCategoryService {
  private url = `${environment.apiUrl}/expense-categories`;

  constructor(private http: HttpClient) {}

  list(): Observable<{ data: ExpenseCategoryItem[] }> {
    return this.http.get<{ data: ExpenseCategoryItem[] }>(this.url);
  }

  create(name: string): Observable<{ message: string; category: ExpenseCategoryItem }> {
    return this.http.post<{ message: string; category: ExpenseCategoryItem }>(this.url, { name });
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}
