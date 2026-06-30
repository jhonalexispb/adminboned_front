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
  doc_logo_url?: string;
  apisunat_persona_id?: string;
  apisunat_token_set?: boolean;
  meta_diaria?: number;
  catalog_request_seller_mode?: 'client_assignment' | 'reviewer';
  catalog_whatsapp_number?: string;
  catalog_show_lot_breakdown?: boolean;
  catalog_stale_order_days?: number;
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

  /** Datos de marca para pantallas públicas (login, catálogo) — no requiere autenticación. */
  getPublic(): Observable<{ razon_social: string | null; nombre_comercial: string | null; logo_url: string | null; catalog_whatsapp_number: string | null }> {
    return this.http.get<{ razon_social: string | null; nombre_comercial: string | null; logo_url: string | null; catalog_whatsapp_number: string | null }>(`${this.base}/public`);
  }

  save(data: Partial<Empresa> & { apisunat_persona_token?: string }): Observable<Empresa> {
    return this.http.put<Empresa>(this.base, data);
  }

  uploadLogo(file: File): Observable<{ logo_url: string }> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<{ logo_url: string }>(`${this.base}/logo`, form);
  }

  uploadDocLogo(file: File): Observable<{ doc_logo_url: string }> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<{ doc_logo_url: string }>(`${this.base}/doc-logo`, form);
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
