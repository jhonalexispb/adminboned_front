export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    /** Solo presente en /quotations: umbral configurado de días para marcar una cotización de catálogo como esperando aprobación. */
    stale_threshold_days?: number;
  };
  links: {
    next: string | null;
    prev: string | null;
  };
  /** Solo presente cuando se consulta el catálogo (`for_sale=true`): override de orden de categorías por laboratorio. */
  category_orders?: Record<number, Record<number, number>>;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
