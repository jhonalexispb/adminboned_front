import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

// Solo mostramos overlay en mutaciones, no en GETs (la tabla tiene su propio spinner)
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  const isMutation = MUTATION_METHODS.includes(req.method);

  if (isMutation) loading.show();

  return next(req).pipe(
    finalize(() => { if (isMutation) loading.hide(); })
  );
};
