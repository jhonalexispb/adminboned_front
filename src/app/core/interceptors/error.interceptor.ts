import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ErrorService } from '../services/error.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(ErrorService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {

      // Errores de servidor (5xx) o de red (status 0)
      if (error.status >= 500 || error.status === 0) {
        const message = error.status === 0
          ? 'No se pudo conectar con el servidor. Verifica tu conexión.'
          : (error.error?.message ?? error.message ?? 'Error interno del servidor.');

        errorService.showUnexpected(error.status, message, req.url);
      }

      // Los errores de validación (4xx) los manejan los componentes individualmente
      return throwError(() => error);
    })
  );
};
