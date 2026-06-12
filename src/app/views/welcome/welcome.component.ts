import { Component, inject } from '@angular/core';
import { CardBodyComponent, CardComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CardComponent, CardBodyComponent, IconDirective],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  auth = inject(AuthService);
}
