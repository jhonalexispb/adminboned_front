import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Department { id: number; name: string; }
export interface Province   { id: number; name: string; department_id: number; }
export interface District   { id: number; name: string; code: string; province_id: number; }
export interface GeoLocation {
  district_id: number;   district_name: string;  ubigeo: string;
  province_id: number;   province_name: string;
  department_id: number; department_name: string;
}

@Injectable({ providedIn: 'root' })
export class GeographyService {
  private base = `${environment.apiUrl}/geo`;

  constructor(private http: HttpClient) {}

  departments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.base}/departments`);
  }

  provinces(departmentId: number): Observable<Province[]> {
    const params = new HttpParams().set('department_id', departmentId);
    return this.http.get<Province[]>(`${this.base}/provinces`, { params });
  }

  districts(provinceId: number): Observable<District[]> {
    const params = new HttpParams().set('province_id', provinceId);
    return this.http.get<District[]>(`${this.base}/districts`, { params });
  }

  /** Devuelve la jerarquía completa de un distrito (para pre-cargar selectores al editar) */
  locate(districtId: number): Observable<GeoLocation> {
    return this.http.get<GeoLocation>(`${this.base}/locate/${districtId}`);
  }

  /** Igual que locate(), pero buscando por código de ubigeo (ej. el de la empresa). */
  locateByUbigeo(ubigeo: string): Observable<GeoLocation> {
    return this.http.get<GeoLocation>(`${this.base}/locate-by-ubigeo/${ubigeo}`);
  }
}
