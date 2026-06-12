import { Component, Input } from '@angular/core';
import { ColComponent, RowComponent } from '@coreui/angular';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [RowComponent, ColComponent],
  template: `
    <c-row class="mb-4 align-items-center">
      <c-col>
        <h2 class="mb-1">{{ title }}</h2>
        @if (subtitle) {
          <p class="text-body-secondary mb-0">{{ subtitle }}</p>
        }
      </c-col>
      <c-col xs="auto">
        <ng-content />
      </c-col>
    </c-row>
  `
})
export class PageHeaderComponent {
  @Input() title    = '';
  @Input() subtitle = '';
}
