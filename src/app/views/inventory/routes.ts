import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'stock', pathMatch: 'full' },
  {
    path: 'stock',
    loadComponent: () => import('./stock-list/stock-list.component').then(m => m.StockListComponent),
    data: { title: 'Stock' }
  },
  {
    path: 'kardex',
    loadComponent: () => import('./kardex-list/kardex-list.component').then(m => m.KardexListComponent),
    data: { title: 'Kardex' }
  },
  {
    path: 'lots',
    loadComponent: () => import('./lots-list/lots-list.component').then(m => m.LotsListComponent),
    data: { title: 'Lotes' }
  },
  {
    path: 'reservations',
    loadComponent: () => import('./reservations/reservations.component').then(m => m.ReservationsComponent),
    data: { title: 'Reservas activas' }
  },
];
