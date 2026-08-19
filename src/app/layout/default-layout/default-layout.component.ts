import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { EmpresaService } from '../../core/services/empresa.service';
import { CollectionService } from '../../views/payments/collection.service';
import { UserDeposit } from '../../views/payments/collection.model';
import { RegisterDepositModalComponent } from '../../views/payments/register-deposit-modal/register-deposit-modal.component';
import { ViaticoReturnService } from '../../views/viaticos/viatico-return.service';
import { NotificationsModalComponent } from './notifications-modal/notifications-modal.component';

const LOGO_CACHE_KEY = 'empresa_logo_url';
const BRAND_NAME_CACHE_KEY = 'empresa_brand_name';

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
    RegisterDepositModalComponent, NotificationsModalComponent,
  ],
})
export class DefaultLayoutComponent implements OnInit {
  private auth = inject(AuthService);
  private empresaService = inject(EmpresaService);
  collectionService = inject(CollectionService);
  viaticoReturnService = inject(ViaticoReturnService);

  logoUrl   = signal<string | null>(localStorage.getItem(LOGO_CACHE_KEY));
  brandName = signal<string | null>(localStorage.getItem(BRAND_NAME_CACHE_KEY));

  readonly navItems = computed<INavData[]>(() => {
    const user = this.auth.user();
    if (!user) return [];
    const isSuperAdmin = user.roles.includes('super_admin');
    return filterNav(navItems, user.permissions, isSuperAdmin);
  });

  ngOnInit(): void {
    this.empresaService.getPublic().subscribe({
      next: info => {
        this.logoUrl.set(info?.logo_url ?? null);
        if (info?.logo_url) {
          localStorage.setItem(LOGO_CACHE_KEY, info.logo_url);
        } else {
          localStorage.removeItem(LOGO_CACHE_KEY);
        }

        const name = info?.nombre_comercial || info?.razon_social || null;
        this.brandName.set(name);
        if (name) {
          localStorage.setItem(BRAND_NAME_CACHE_KEY, name);
        } else {
          localStorage.removeItem(BRAND_NAME_CACHE_KEY);
        }
      },
      error: () => {},
    });
  }

  onDepositRegistered(_event: { deposit: UserDeposit }): void {
    this.collectionService.showNewDeposit.set(false);
    this.collectionService.myDebt().subscribe({ error: () => {} });
  }

  onViaticoDepositRegistered(_event: { deposit: UserDeposit }): void {
    this.viaticoReturnService.showNewDeposit.set(false);
    this.viaticoReturnService.myDebt().subscribe({ error: () => {} });
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
