import { Component, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { MOTIVO_OPTIONS } from '../returns.model';

export interface ProcessReturnPayload {
  action_type: 'credit_note' | 'void' | 'internal';
  motivo_code?: string;
  issue_date?:  string;
}

@Component({
  selector: 'app-process-return-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent, Select,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './process-return-modal.component.html',
})
export class ProcessReturnModalComponent {
  visible    = input(false);
  processing = input(false);
  canVoid    = input(false);

  confirmed = output<ProcessReturnPayload>();
  cancelled = output<void>();

  actionType = 'credit_note';
  motivoCode = '07';
  issueDate  = new Date().toISOString().slice(0, 10);

  readonly motivoOptions = MOTIVO_OPTIONS;
  readonly actionOptions = [
    { value: 'credit_note', label: 'Nota de Crédito SUNAT' },
    { value: 'void',        label: 'Anulación SUNAT'       },
    { value: 'internal',    label: 'Solo interno'           },
  ];

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.motivoCode = '07';
        this.issueDate  = new Date().toISOString().slice(0, 10);
      }
    });
  }

  confirm(): void {
    this.confirmed.emit({
      action_type: this.actionType as any,
      motivo_code: this.actionType === 'credit_note' ? this.motivoCode : undefined,
      issue_date:  this.actionType === 'credit_note' ? this.issueDate  : undefined,
    });
  }

  cancel(): void { if (!this.processing()) this.cancelled.emit(); }
}
