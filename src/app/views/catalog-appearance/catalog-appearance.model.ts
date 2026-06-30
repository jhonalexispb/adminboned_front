export type BackgroundSlot = 'morning' | 'afternoon' | 'night' | 'event';

export type EventEffect = 'none' | 'confetti' | 'snow' | 'fireworks' | 'balloons';

export interface CatalogBackground {
  id: number;
  slot: BackgroundSlot;
  image_url: string;
  label: string | null;
  effect: EventEffect | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

export interface CatalogBanner {
  id: number;
  image_url: string;
  link_url: string | null;
  product_id: number | null;
  product_name: string | null;
  product_lab_name: string | null;
  title: string | null;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface CatalogLoadingMessage {
  id: number;
  message: string;
  active: boolean;
  sort_order: number;
}

export interface CatalogSettings {
  banner_duration_ms: number;
  event_display_frequency: 'always' | 'daily';
  card_image_ratio: number;
}
