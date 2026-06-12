import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./trends.component').then(m => m.TrendsComponent),
    data: {
      title: $localize`Tendencias`
    }
  }
];
