import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  delete(itemName: string): Promise<boolean> {
    return Swal.fire({
      title: '¿Eliminar?',
      html: `Se eliminará <strong>${itemName}</strong>.<br>Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      focusCancel: true,
      reverseButtons: true,
    }).then(result => result.isConfirmed);
  }
}
