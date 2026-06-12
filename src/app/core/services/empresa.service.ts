import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Empresa {
  id?: number;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string;
  direccion: string;
  ubigeo?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  telefono?: string;
  email?: string;
  logo_url?: string;
  apisunat_persona_id?: string;
  apisunat_token_set?: boolean;
  meta_diaria?: number;
}

export interface DocumentSeries {
  id: number;
  document_type: string;
  document_type_label: string;
  series: string;
  current_correlative: number;
  next_correlative: string;
  active: boolean;
  has_documents: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private base      = `${environment.apiUrl}/empresa`;
  private seriesUrl = `${environment.apiUrl}/document-series`;

  constructor(private http: HttpClient) {}

  get(): Observable<Empresa | null> {
    return this.http.get<Empresa | null>(this.base);
  }

  save(data: Partial<Empresa> & { apisunat_persona_token?: string }): Observable<Empresa> {
    return this.http.put<Empresa>(this.base, data);
  }

  uploadLogo(file: File): Observable<{ logo_url: string }> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<{ logo_url: string }>(`${this.base}/logo`, form);
  }

  listDocumentSeries(params?: { document_type?: string; active?: boolean }): Observable<{ data: DocumentSeries[] }> {
    return this.http.get<{ data: DocumentSeries[] }>(this.seriesUrl, { params: params as any });
  }

  updateDocumentSeries(id: number, data: Partial<Pick<DocumentSeries, 'current_correlative' | 'active'>>): Observable<{ data: DocumentSeries }> {
    return this.http.patch<{ data: DocumentSeries }>(`${this.seriesUrl}/${id}`, data);
  }

  createDocumentSeries(data: { document_type: string; series: string; current_correlative: number }): Observable<{ message: string; data: DocumentSeries }> {
    return this.http.post<{ message: string; data: DocumentSeries }>(this.seriesUrl, data);
  }

  deleteDocumentSeries(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.seriesUrl}/${id}`);
  }
}
