import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const VIATICOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./my-viaticos/my-viaticos.component').then(m => m.MyViaticosComponent),
    canActivate: [permissionGuard('viaticos')],
    data: { title: 'Mis Viáticos' },
  },
  {
    path: 'gestionar',
    loadComponent: () => import('./manage-viaticos/manage-viaticos.component').then(m => m.ManageViaticosComponent),
    canActivate: [permissionGuard('viaticos_manage')],
    data: { title: 'Gestión de Viáticos' },
  },
];
