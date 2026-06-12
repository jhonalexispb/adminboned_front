import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserItem, RoleOption } from './user.model';

interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface RoleWithPermissions {
  id: number;
  name: string;
  display_name: string;
  permissions: string[];
  users_count: number;
}

export interface RolesManageResponse {
  roles: RoleWithPermissions[];
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listUsers(params: { search?: string; role?: string; per_page?: number; page?: number } = {}): Observable<PaginatedResponse<UserItem>> {
    let p = new HttpParams();
    if (params.search)   p = p.set('search', params.search);
    if (params.role)     p = p.set('role', params.role);
    if (params.per_page) p = p.set('per_page', params.per_page);
    if (params.page)     p = p.set('page', params.page);
    return this.http.get<PaginatedResponse<UserItem>>(`${this.base}/users`, { params: p });
  }

  createUser(data: { name: string; email: string; password: string; phone?: string; roles: string[] }): Observable<{ message: string; user: UserItem }> {
    return this.http.post<{ message: string; user: UserItem }>(`${this.base}/users`, data);
  }

  updateUser(id: number, data: { name: string; email: string; password?: string; phone?: string; active: boolean; roles: string[] }): Observable<{ message: string; user: UserItem }> {
    return this.http.patch<{ message: string; user: UserItem }>(`${this.base}/users/${id}`, data);
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/users/${id}`);
  }

  restoreUser(id: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.base}/users/${id}/restore`, {});
  }

  // Roles
  listRoles(): Observable<RoleOption[]> {
    return this.http.get<RoleOption[]>(`${this.base}/roles`);
  }

  rolesManage(): Observable<RolesManageResponse> {
    return this.http.get<RolesManageResponse>(`${this.base}/roles/manage`);
  }

  createRole(data: { display_name: string; permissions: string[] }): Observable<{ message: string; role: RoleWithPermissions }> {
    return this.http.post<{ message: string; role: RoleWithPermissions }>(`${this.base}/roles`, data);
  }

  updateRole(id: number, permissions: string[]): Observable<{ message: string; role: RoleWithPermissions }> {
    return this.http.patch<{ message: string; role: RoleWithPermissions }>(`${this.base}/roles/${id}`, { permissions });
  }

  renameRole(id: number, display_name: string): Observable<{ message: string; role: RoleWithPermissions }> {
    return this.http.patch<{ message: string; role: RoleWithPermissions }>(`${this.base}/roles/${id}/rename`, { display_name });
  }

  deleteRole(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/roles/${id}`);
  }
}
