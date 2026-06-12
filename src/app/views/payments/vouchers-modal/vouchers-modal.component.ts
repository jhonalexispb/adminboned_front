import { Component, input, output } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent,
  ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective,
} from '@coreui/angular';
import { PaymentRecord } from '../payment.model';

@Component({
  selector: 'app-vouchers-modal',
  standalone: true,
  imports: [
    FaIconComponent, ButtonDirective,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './vouchers-modal.component.html',
})
export class VouchersModalComponent {
  payment = input<PaymentRecord | null>(null);
  closed  = output<void>();
}
