import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LoginBackground, LoginBackgroundSlot } from './login-background.model';

export interface LoginBackgroundPayload {
  slot: LoginBackgroundSlot;
  image?: File | null;
  label?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LoginBackgroundService {
  private url = `${environment.apiUrl}/login-backgrounds`;

  constructor(private http: HttpClient) {}

  list(): Observable<LoginBackground[]> {
    return this.http.get<LoginBackground[]>(this.url);
  }

  create(payload: LoginBackgroundPayload): Observable<{ message: string; background: LoginBackground }> {
    return this.http.post<{ message: string; background: LoginBackground }>(this.url, this.toFormData(payload));
  }

  update(id: number, payload: Partial<LoginBackgroundPayload>): Observable<{ message: string; background: LoginBackground }> {
    return this.http.post<{ message: string; background: LoginBackground }>(`${this.url}/${id}`, this.toFormData(payload));
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
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
