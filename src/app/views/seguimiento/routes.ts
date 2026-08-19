import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const SEGUIMIENTO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./seguimiento/seguimiento.component').then(m => m.SeguimientoComponent),
    canActivate: [permissionGuard('seguimiento')],
    data: { title: 'Seguimiento' },
  },
];
