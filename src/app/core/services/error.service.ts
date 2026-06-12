import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class ErrorService {

  /**
   * Muestra un error inesperado (5xx, red) con detalles copiables para reporte.
   */
  showUnexpected(status: number, message: string, url: string): void {
    const timestamp = new Date().toLocaleString('es-PE');
    const details   = `Hora: ${timestamp}\nURL: ${url}\nCódigo: ${status}\nMensaje: ${message}`;

    Swal.fire({
      icon:              'error',
      title:             'Ocurrió un error inesperado',
      html: `
        <p class="text-muted mb-2" style="font-size:.9rem">
          Por favor, copia los detalles y envíalos al administrador para que pueda revisarlo.
        </p>
        <textarea id="swal-error-details" class="form-control" rows="4"
                  style="font-size:.75rem;font-family:monospace;resize:none"
                  readonly>${details}</textarea>
      `,
      showCancelButton:  true,
      confirmButtonText: 'Copiar y cerrar',
      cancelButtonText:  'Cerrar',
      confirmButtonColor: '#dc3545',
      didOpen: () => {
        // Seleccionar el texto automáticamente
        const ta = document.getElementById('swal-error-details') as HTMLTextAreaElement;
        ta?.select();
      }
    }).then(result => {
      if (result.isConfirmed) {
        navigator.clipboard?.writeText(details).catch(() => {
          // Fallback si clipboard API no está disponible
          const ta = document.getElementById('swal-error-details') as HTMLTextAreaElement;
          ta?.select();
          document.execCommand('copy');
        });
      }
    });
  }

  /**
   * Confirmación genérica con SweetAlert (alternativa a ConfirmModal para acciones rápidas).
   */
  confirm(title: string, text: string): Promise<boolean> {
    return Swal.fire({
      icon:              'warning',
      title,
      text,
      showCancelButton:  true,
      confirmButtonText: 'Confirmar',
      cancelButtonText:  'Cancelar',
      confirmButtonColor: '#dc3545',
    }).then(r => r.isConfirmed);
  }
}
