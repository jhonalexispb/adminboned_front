import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';

import { IconDirective } from '@coreui/icons-angular';
import {
  ContainerComponent,
  INavData,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective,
} from '@coreui/angular';

import { DefaultHeaderComponent } from './';
import { NavItem, navItems } from './_nav';
import { AuthService } from '../../core/services/auth.service';
import { CollectionService } from '../../views/payments/collection.service';
import { UserDeposit } from '../../views/payments/collection.model';
import { RegisterDepositModalComponent } from '../../views/payments/register-deposit-modal/register-deposit-modal.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    SidebarComponent, SidebarHeaderComponent, SidebarBrandComponent,
    SidebarNavComponent, SidebarFooterComponent,
    SidebarToggleDirective, SidebarTogglerDirective,
    ContainerComponent, DefaultHeaderComponent,
    IconDirective, NgScrollbar, RouterOutlet, RouterLink, ShadowOnScrollDirective,
    RegisterDepositModalComponent,
  ],
})
export class DefaultLayoutComponent {
  private auth = inject(AuthService);
  collectionService = inject(CollectionService);

  readonly navItems = computed<INavData[]>(() => {
    const user = this.auth.user();
    if (!user) return [];
    const isSuperAdmin = user.roles.includes('super_admin');
    return filterNav(navItems, user.permissions, isSuperAdmin);
  });

  onDepositRegistered(_event: { deposit: UserDeposit }): void {
    this.collectionService.showNewDeposit.set(false);
    this.collectionService.myDebt().subscribe({ error: () => {} });
  }
}

function filterNav(items: NavItem[], userPerms: string[], isSuperAdmin: boolean): INavData[] {
  const visible = items.filter(item =>
    !item.permission || isSuperAdmin || userPerms.includes(item.permission)
  );

  // Eliminar encabezados de sección que quedaron sin items debajo
  return visible.filter((item, i) => {
    if (!item.title) return true;
    const next = visible[i + 1];
    return !!next && !next.title;
  });
}
