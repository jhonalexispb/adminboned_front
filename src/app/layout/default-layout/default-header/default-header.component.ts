import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import {
  BadgeComponent,
  BreadcrumbRouterComponent,
  ButtonDirective,
  ColorModeService,
  ContainerComponent,
  DropdownComponent,
  DropdownDividerDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  SidebarToggleDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { AuthService } from '../../../core/services/auth.service';
import { AlertsService } from '../../../core/services/alerts.service';
import { CollectionService } from '../../../views/payments/collection.service';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  imports: [
    NgTemplateOutlet, RouterLink, DecimalPipe,
    ContainerComponent, HeaderTogglerDirective, SidebarToggleDirective,
    HeaderNavComponent, BreadcrumbRouterComponent, IconDirective, BadgeComponent,
    DropdownComponent, DropdownToggleDirective, DropdownMenuDirective,
    DropdownItemDirective, DropdownDividerDirective, ButtonDirective,
  ]
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit {
  readonly #colorModeService = inject(ColorModeService);
  readonly colorMode = this.#colorModeService.colorMode;

  readonly colorModes = [
    { name: 'light', text: 'Claro',     icon: 'cilSun' },
    { name: 'dark',  text: 'Oscuro',    icon: 'cilMoon' },
    { name: 'auto',  text: 'Automático', icon: 'cilContrast' }
  ];

  readonly themeIcon = computed(() =>
    this.colorModes.find(m => m.name === this.colorMode())?.icon ?? 'cilSun'
  );

  sidebarId = input('sidebar1');

  readonly debt = computed(() => this.collectionService.debt()?.debt ?? 0);

  constructor(
    public auth: AuthService,
    public alertsService: AlertsService,
    private collectionService: CollectionService,
    private router: Router
  ) {
    super();
  }

  ngOnInit(): void {
    this.alertsService.load();
    if (this.auth.hasPermission('payments')) {
      this.collectionService.myDebt().subscribe({ error: () => {} });
    }
  }

  openNewDeposit(): void {
    this.collectionService.showNewDeposit.set(true);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: ()  => this.auth.clearSession()
    });
  }

  get alerts() { return this.alertsService.counts; }
}
