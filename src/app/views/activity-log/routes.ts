import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./activity-log-list/activity-log-list.component').then(m => m.ActivityLogListComponent),
  },
];
