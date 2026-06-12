import { Component, Input, Output, EventEmitter } from '@angular/core';
import {
  ButtonDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective
} from '@coreui/angular';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [
    ModalComponent, ModalHeaderComponent, ModalTitleDirective,
    ModalBodyComponent, ModalFooterComponent, ButtonDirective
  ],
  template: `
    <c-modal [visible]="visible" (visibleChange)="onVisibleChange($event)">
      <c-modal-header>
        <h5 cModalTitle>{{ title }}</h5>
      </c-modal-header>
      <c-modal-body>{{ message }}</c-modal-body>
      <c-modal-footer>
        <button cButton color="secondary" (click)="cancel.emit()">{{ cancelLabel }}</button>
        <button cButton [color]="confirmColor" (click)="confirm.emit()">{{ confirmLabel }}</button>
      </c-modal-footer>
    </c-modal>
  `
})
export class ConfirmModalComponent {
  @Input() visible      = false;
  @Input() title        = 'Confirmar';
  @Input() message      = '¿Estás seguro?';
  @Input() confirmLabel = 'Confirmar';
  @Input() confirmColor = 'danger';
  @Input() cancelLabel  = 'Cancelar';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel  = new EventEmitter<void>();

  onVisibleChange(v: boolean) {
    if (!v) this.cancel.emit();
  }
}
