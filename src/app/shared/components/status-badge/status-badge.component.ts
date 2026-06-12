import { Component, Input } from '@angular/core';
import { BadgeComponent } from '@coreui/angular';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [BadgeComponent],
  template: `
    <c-badge [color]="active ? 'success' : 'secondary'">
      {{ active ? 'Activo' : 'Inactivo' }}
    </c-badge>
  `
})
export class StatusBadgeComponent {
  @Input() active = true;
}
