import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'my', pathMatch: 'full' },
  {
    path: 'my',
    loadComponent: () => import('./returns-list/returns-list.component').then(m => m.ReturnsListComponent),
    data: { title: 'Mis devoluciones' },
  },
  {
    path: 'manage',
    loadComponent: () => import('./return-manage/return-manage.component').then(m => m.ReturnManageComponent),
    data: { title: 'Gestionar devoluciones' },
  },
  {
    path: 'new',
    loadComponent: () => import('./return-create/return-create.component').then(m => m.ReturnCreateComponent),
    data: { title: 'Nueva devolución' },
  },
  {
    path: ':id',
    loadComponent: () => import('./return-detail/return-detail.component').then(m => m.ReturnDetailComponent),
    data: { title: 'Detalle de devolución' },
  },
];
