import { LoginAppearance } from '../models/login-appearance.model';

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface GreetingInfo {
  period: DayPeriod;
  salutation: string;
  message: string;
}

/** Imágenes por defecto de la escena (mañana/tarde/noche), reutilizadas en login y dashboard. */
export const SCENE_IMAGES: Record<DayPeriod, string> = {
  morning: 'assets/images/login/scene-day.webp',
  afternoon: 'assets/images/login/scene-sunset.webp',
  evening: 'assets/images/login/scene-night.webp',
  night: 'assets/images/login/scene-night.webp'
};

const MESSAGES: Record<DayPeriod, string[]> = {
  morning: [
    'Un nuevo día, nuevas oportunidades para crecer.',
    'Hoy es un gran día para superar tu meta.',
    'Empieza con energía: paso a paso se construye el éxito.',
    'Cada mañana es una nueva oportunidad de hacerlo mejor.',
    'Buen ánimo para arrancar — el equipo cuenta contigo.',
  ],
  afternoon: [
    'Vas a mitad de camino, ¡sigue así!',
    'La constancia de hoy es el resultado de mañana.',
    'Cada pedido cuenta — buen trabajo hasta ahora.',
    'Mantén el ritmo, lo estás haciendo bien.',
    'Un esfuerzo más y el día estará completo.',
  ],
  evening: [
    'El día casi termina, cierra con todo.',
    'Un buen cierre de día es el inicio de un gran mañana.',
    'Revisa tus pendientes y prepárate para un cierre exitoso.',
    'Ya falta poco — termina fuerte.',
    'Última recta del día, vamos con todo.',
  ],
  night: [
    'Descansa, mañana seguimos creciendo juntos.',
    'El esfuerzo de hoy se refleja en los resultados de mañana.',
    'Buen trabajo hoy. Es momento de recargar energías.',
    'Cierra la jornada con tranquilidad, lo hiciste bien.',
    'Mañana será un gran día — hoy ya hiciste tu parte.',
  ],
};

/**
 * Determina saludo, periodo del día y un mensaje de aliento según la hora local.
 * El mensaje se mantiene estable durante el día (varía por fecha, no por minuto).
 */
export function getGreeting(date: Date = new Date()): GreetingInfo {
  const hour = date.getHours();

  let period: DayPeriod;
  let salutation: string;

  if (hour >= 5 && hour < 12) {
    period = 'morning';
    salutation = 'Buenos días';
  } else if (hour >= 12 && hour < 19) {
    period = 'afternoon';
    salutation = 'Buenas tardes';
  } else if (hour >= 19 && hour < 23) {
    period = 'evening';
    salutation = 'Buenas noches';
  } else {
    period = 'night';
    salutation = 'Buenas noches';
  }

  const pool = MESSAGES[period];
  const seed = date.getFullYear() * 1000 + date.getMonth() * 31 + date.getDate();
  const message = pool[seed % pool.length];

  return { period, salutation, message };
}

/**
 * Resuelve la imagen de fondo del login: prioriza el evento especial activo,
 * luego el fondo configurado para el periodo del día, y por último la imagen
 * estática por defecto.
 */
export function resolveLoginBackground(
  appearance: LoginAppearance | null,
  period: DayPeriod,
  fallback: string,
): string {
  if (appearance?.event?.image_url) {
    return appearance.event.image_url;
  }

  const backgrounds = appearance?.backgrounds;
  const bySlot: Record<DayPeriod, string | null | undefined> = {
    morning: backgrounds?.morning,
    afternoon: backgrounds?.afternoon,
    evening: backgrounds?.night,
    night: backgrounds?.night,
  };

  return bySlot[period] || fallback;
}
