import { Component, model } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ReturnLine } from '../returns.model';
import { OrderItem } from '../../quotations/sales.model';

@Component({
  selector: 'app-return-items-editor',
  standalone: true,
  imports: [DatePipe, FormsModule, FaIconComponent],
  templateUrl: './return-items-editor.component.html',
})
export class ReturnItemsEditorComponent {
  lines = model.required<ReturnLine[]>();

  get selectedLines(): ReturnLine[] {
    return this.lines().filter(l => l.selected && l.returnQty > 0);
  }

  maxReturnable(item: OrderItem): number {
    return item.returnable_quantity ?? item.quantity;
  }

  toggleAll(checked: boolean): void {
    this.lines.update(ls => ls.map(l => ({ ...l, selected: checked && this.maxReturnable(l.orderItem) > 0 })));
  }
}
