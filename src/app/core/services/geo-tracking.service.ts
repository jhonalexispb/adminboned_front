import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Mantiene la última ubicación conocida del usuario mientras tenga tracking_enabled,
 * usando watchPosition (gratis, solo local) — NO envía nada al servidor por sí mismo.
 * geo-location.interceptor.ts lee currentPosition() y la adjunta a las requests reales.
 */
@Injectable({ providedIn: 'root' })
export class GeoTrackingService {
  readonly currentPosition = signal<GeoPosition | null>(null);

  private watchId: number | null = null;
  private auth = inject(AuthService);

  constructor() {
    effect(() => {
      const enabled = this.auth.user()?.tracking_enabled ?? false;
      if (enabled) this.start(); else this.stop();
    });
  }

  private start(): void {
    if (this.watchId !== null || !navigator.geolocation) return;
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.currentPosition.set({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      () => { /* sin permiso o sin señal — simplemente no se adjunta ubicación */ },
      { enableHighAccuracy: true },
    );
  }

  private stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.currentPosition.set(null);
  }
}
