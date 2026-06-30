export type LoginBackgroundSlot = 'morning' | 'afternoon' | 'night' | 'event';

export interface LoginBackground {
  id: number;
  slot: LoginBackgroundSlot;
  image_url: string;
  label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}
