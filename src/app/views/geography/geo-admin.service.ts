import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminDepartment {
  id: number;
  name: string;
  code?: string | null;
}

export interface AdminProvince {
  id: number;
  name: string;
  code?: string | null;
  department_id: number;
  department_name: string;
}

export interface AdminDistrict {
  id: number;
  name: string;
  code?: string | null;
  province_id: number;
  province_name: string;
  department_id: number;
  department_name: string;
}

export interface GeoPage<T> {
  data: T[];
  meta: { total: number; last_page: number; current_page: number; per_page: number };
}

@Injectable({ providedIn: 'root' })
export class GeoAdminService {
  private base = `${environment.apiUrl}/geo/admin`;

  constructor(private http: HttpClient) {}

  // ── Departments ───────────────────────────────────────────────────────────

  listDepartments(p: object): Observable<GeoPage<AdminDepartment>> {
    return this.http.get<GeoPage<AdminDepartment>>(`${this.base}/departments`, { params: this.toParams(p) });
  }

  createDepartment(payload: object): Observable<{ department: AdminDepartment; message: string }> {
    return this.http.post<{ department: AdminDepartment; message: string }>(`${this.base}/departments`, payload);
  }

  updateDepartment(id: number, payload: object): Observable<{ department: AdminDepartment; message: string }> {
    return this.http.patch<{ department: AdminDepartment; message: string }>(`${this.base}/departments/${id}`, payload);
  }

  deleteDepartment(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/departments/${id}`);
  }

  // ── Provinces ─────────────────────────────────────────────────────────────

  listProvinces(p: object): Observable<GeoPage<AdminProvince>> {
    return this.http.get<GeoPage<AdminProvince>>(`${this.base}/provinces`, { params: this.toParams(p) });
  }

  createProvince(payload: object): Observable<{ province: AdminProvince; message: string }> {
    return this.http.post<{ province: AdminProvince; message: string }>(`${this.base}/provinces`, payload);
  }

  updateProvince(id: number, payload: object): Observable<{ province: AdminProvince; message: string }> {
    return this.http.patch<{ province: AdminProvince; message: string }>(`${this.base}/provinces/${id}`, payload);
  }

  deleteProvince(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/provinces/${id}`);
  }

  // ── Districts ─────────────────────────────────────────────────────────────

  listDistricts(p: object): Observable<GeoPage<AdminDistrict>> {
    return this.http.get<GeoPage<AdminDistrict>>(`${this.base}/districts`, { params: this.toParams(p) });
  }

  createDistrict(payload: object): Observable<{ district: AdminDistrict; message: string }> {
    return this.http.post<{ district: AdminDistrict; message: string }>(`${this.base}/districts`, payload);
  }

  updateDistrict(id: number, payload: object): Observable<{ district: AdminDistrict; message: string }> {
    return this.http.patch<{ district: AdminDistrict; message: string }>(`${this.base}/districts/${id}`, payload);
  }

  deleteDistrict(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/districts/${id}`);
  }

  private toParams(obj: Record<string, any>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== '' && v !== null && v !== undefined) p = p.set(k, String(v));
    }
    return p;
  }
}
