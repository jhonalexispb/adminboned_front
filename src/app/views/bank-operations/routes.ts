import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const BANK_OPERATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./bank-operations-list/bank-operations-list.component').then(m => m.BankOperationsListComponent),
    canActivate: [permissionGuard('bank_operations')],
    data: { title: 'Operaciones Bancarias' },
  },
];
