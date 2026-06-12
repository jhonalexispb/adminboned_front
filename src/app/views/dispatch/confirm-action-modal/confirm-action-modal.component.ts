import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';

export interface ConfirmAction {
  title:    string;
  message:  string;
  btnLabel: string;
  btnColor: string;
}

@Component({
  selector: 'app-confirm-action-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './confirm-action-modal.component.html',
})
export class ConfirmActionModalComponent {
  action     = input<ConfirmAction | null>(null);
  confirming = input(false);

  confirmed = output<string>(); // emite las notas escritas
  cancelled = output<void>();

  notes = '';

  confirm(): void   { this.confirmed.emit(this.notes); this.notes = ''; }
  cancel(): void    { this.notes = ''; this.cancelled.emit(); }
}
