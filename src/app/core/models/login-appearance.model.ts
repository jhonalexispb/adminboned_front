export interface LoginAppearanceBackgrounds {
  morning: string | null;
  afternoon: string | null;
  night: string | null;
}

export interface LoginAppearanceEvent {
  image_url: string;
  label: string | null;
}

export interface LoginAppearance {
  backgrounds: LoginAppearanceBackgrounds;
  event: LoginAppearanceEvent | null;
}
