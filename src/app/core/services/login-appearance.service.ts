import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginAppearance } from '../models/login-appearance.model';

const APPEARANCE_CACHE_KEY = 'login_appearance';

@Injectable({ providedIn: 'root' })
export class LoginAppearanceService {
  private base = environment.apiUrl;

  readonly appearance = signal<LoginAppearance | null>(this.loadCached());

  constructor(private http: HttpClient) {
    this.fetch().subscribe({
      next: appearance => {
        this.appearance.set(appearance);
        localStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(appearance));
      },
      error: () => {},
    });
  }

  /** Fondos del login del panel (mañana/tarde/noche/evento) — endpoint público, no requiere autenticación. */
  fetch(): Observable<LoginAppearance> {
    return this.http.get<LoginAppearance>(`${this.base}/login-appearance`);
  }

  private loadCached(): LoginAppearance | null {
    try {
      const raw = localStorage.getItem(APPEARANCE_CACHE_KEY);
      return raw ? JSON.parse(raw) as LoginAppearance : null;
    } catch {
      return null;
    }
  }
}
