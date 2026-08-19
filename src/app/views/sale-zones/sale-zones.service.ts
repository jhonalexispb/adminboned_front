import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  UserSaleZone, UserZoneConfig, ZoneClient, ZoneClientException, ClientSearchItem, UserZoneOverview,
} from './sale-zones.model';

@Injectable({ providedIn: 'root' })
export class SaleZonesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/sale-zones`;

  overview(): Observable<{ users: UserZoneOverview[] }> {
    return this.http.get<{ users: UserZoneOverview[] }>(`${this.base}/overview`);
  }

  checkZone(params: {
    zone_type: string;
    department_id?: number | null;
    province_id?: number | null;
    district_id?: number | null;
    exclude_user_id?: number | null;
  }): Observable<{ conflicts: string[] }> {
    let p = new HttpParams().set('zone_type', params.zone_type);
    if (params.department_id)   p = p.set('department_id',   params.department_id);
    if (params.province_id)     p = p.set('province_id',     params.province_id);
    if (params.district_id)     p = p.set('district_id',     params.district_id);
    if (params.exclude_user_id) p = p.set('exclude_user_id', params.exclude_user_id);
    return this.http.get<{ conflicts: string[] }>(`${this.base}/check-zone`, { params: p });
  }

  settings(): Observable<{ sale_zones_enabled: boolean }> {
    return this.http.get<{ sale_zones_enabled: boolean }>(`${this.base}/settings`);
  }

  updateSettings(enabled: boolean): Observable<{ message: string; sale_zones_enabled: boolean }> {
    return this.http.post<{ message: string; sale_zones_enabled: boolean }>(
      `${this.base}/settings`, { sale_zones_enabled: enabled },
    );
  }

  getUserZones(userId: number): Observable<UserZoneConfig> {
    return this.http.get<UserZoneConfig>(`${this.base}/${userId}`);
  }

  toggleAllowAll(userId: number): Observable<{ message: string; allow_all_clients: boolean }> {
    return this.http.patch<{ message: string; allow_all_clients: boolean }>(
      `${this.base}/${userId}/allow-all`, {},
    );
  }

  addZone(userId: number, data: {
    zone_type: 'department' | 'province' | 'district';
    department_id?: number | null;
    province_id?: number | null;
    district_id?: number | null;
  }): Observable<{ message: string; zone: UserSaleZone; conflicts: string[] }> {
    return this.http.post<{ message: string; zone: UserSaleZone; conflicts: string[] }>(
      `${this.base}/${userId}/zones`, data,
    );
  }

  removeZone(userId: number, zoneId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${userId}/zones/${zoneId}`);
  }

  zoneClients(userId: number, zoneId: number): Observable<{ clients: ZoneClient[] }> {
    return this.http.get<{ clients: ZoneClient[] }>(
      `${this.base}/${userId}/zones/${zoneId}/clients`,
    );
  }

  addException(userId: number, clientId: number, type: 'block' | 'allow'): Observable<{ message: string; exception: ZoneClientException }> {
    return this.http.post<{ message: string; exception: ZoneClientException }>(
      `${this.base}/${userId}/exceptions`, { client_id: clientId, type },
    );
  }

  removeException(userId: number, clientId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/${userId}/exceptions/${clientId}`,
    );
  }

  searchClients(search: string): Observable<{ data: ClientSearchItem[] }> {
    const params = new HttpParams().set('search', search).set('per_page', '15').set('active', '1');
    return this.http.get<{ data: ClientSearchItem[] }>(`${environment.apiUrl}/clients`, { params });
  }
}
