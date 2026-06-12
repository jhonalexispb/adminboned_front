import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DniResult {
  dni: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo: string;
}

export interface RucResult {
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  estado: string;       // ACTIVO | BAJA PROVISIONAL | BAJA DEFINITIVA | BAJA DE OFICIO
  condicion: string;    // HABIDO | NO HABIDO | NO HALLADO
  puede_facturar: boolean;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConsultationService {
  private url = `${environment.apiUrl}/consult`;

  constructor(private http: HttpClient) {}

  dni(number: string): Observable<DniResult> {
    return this.http.get<DniResult>(`${this.url}/dni/${number}`);
  }

  ruc(number: string): Observable<RucResult> {
    return this.http.get<RucResult>(`${this.url}/ruc/${number}`);
  }
}
