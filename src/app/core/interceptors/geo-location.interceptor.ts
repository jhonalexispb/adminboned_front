import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { GeoTrackingService } from '../services/geo-tracking.service';

// Solo se adjunta en mutaciones (las que suelen disparar una fila en activity_log).
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const geoLocationInterceptor: HttpInterceptorFn = (req, next) => {
  const geo = inject(GeoTrackingService);
  const pos = geo.currentPosition();

  if (MUTATION_METHODS.includes(req.method) && pos) {
    req = req.clone({
      setHeaders: {
        'X-Geo-Lat': String(pos.lat),
        'X-Geo-Lng': String(pos.lng),
        'X-Geo-Accuracy': String(pos.accuracy),
      },
    });
  }

  return next(req);
};
