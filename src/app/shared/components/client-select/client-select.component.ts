import { Component, OnInit, signal, model, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Select } from 'primeng/select';
import { ClientService } from '../../../views/clients/client.service';
import { ClientOption, toClientOption } from '../../../views/clients/client.model';

@Component({
  selector: 'app-client-select',
  standalone: true,
  imports: [FormsModule, FaIconComponent, Select],
  templateUrl: './client-select.component.html',
})
export class ClientSelectComponent implements OnInit {
  value       = model<ClientOption | null>(null);
  placeholder = input('Buscar por nombre, RUC, DNI o dirección...');
  disabled    = input(false);

  clients = signal<ClientOption[]>([]);

  constructor(private clientSvc: ClientService) {}

  ngOnInit(): void {
    this.clientSvc.list({ active: true, per_page: 500 }).subscribe(res => {
      this.clients.set(res.data.map(toClientOption));
    });
  }
}
