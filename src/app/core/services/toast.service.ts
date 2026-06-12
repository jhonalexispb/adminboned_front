import { Injectable, signal } from '@angular/core';
import Swal from 'sweetalert2';

export interface Toast {
  id: number;
  message: string;
  color: 'success' | 'warning' | 'info';
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId  = 0;

  /** Toast verde — feedback positivo no bloqueante */
  success(message: string): void {
    this.add(message, 'success', 'check-circle');
  }

  /** Toast azul — información no bloqueante */
  info(message: string): void {
    this.add(message, 'info', 'circle-info');
  }

  /** Modal SweetAlert2 — errores que el usuario debe notar */
  error(message: string, title = 'Error'): void {
    Swal.fire({
      icon: 'error',
      title,
      text: message,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Aceptar',
    });
  }

  /** Toast naranja — advertencia no bloqueante */
  warning(message: string): void {
    this.add(message, 'warning', 'triangle-exclamation');
  }

  /** Modal SweetAlert2 — confirmación destructiva o importante */
  confirm(
    title: string,
    text: string,
    options?: { confirmText?: string; cancelText?: string; icon?: 'warning' | 'question' }
  ): Promise<boolean> {
    return Swal.fire({
      icon:              options?.icon ?? 'warning',
      title,
      text,
      showCancelButton:  true,
      confirmButtonText: options?.confirmText ?? 'Sí, continuar',
      cancelButtonText:  options?.cancelText  ?? 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor:  '#6c757d',
      reverseButtons:    true,
    }).then(r => r.isConfirmed);
  }

  remove(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private add(message: string, color: Toast['color'], icon: string): void {
    const id = ++this.nextId;
    this.toasts.update(list => [...list, { id, message, color, icon }]);
    setTimeout(() => this.remove(id), 4000);
  }
}
