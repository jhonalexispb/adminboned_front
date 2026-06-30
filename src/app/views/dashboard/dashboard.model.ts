export interface DashboardData {
  hoy: {
    ventas:  number;
    pedidos: number;
  };
  mes: {
    ventas:            number;
    compras:           number;
    gastos:            number;
    ganancia:          number;
    pedidos:           number;
    clientes:          number;
    promedio_diario:   number;
    ratio_vs_anterior: number | null;
    margen_real:       number | null;
    devoluciones: {
      total:       number;
      cantidad:    number;
      impacto_pct: number | null;
    };
  };
  mes_anterior: {
    ventas: number;
  };
  meta_diaria:        number;
  meta_mensual:       number;
  equilibrio_diario:  number;
  proyeccion: {
    dias_restantes:              number;
    necesario_diario_meta:       number;
    necesario_diario_equilibrio: number;
  };
  estado: {
    nivel:   'bien' | 'atencion' | 'cuidado' | 'neutral';
    mensaje: string;
  };
  chart: {
    labels:       number[];
    ventas:       number[];
    devoluciones: number[];
    meta:         number[];
  };
  geo: {
    provincia:    string;
    departamento: string;
    total:        number;
    clientes:     number;
    pedidos:      number;
  }[];
  pendientes: {
    cotizaciones_borrador: number;
    cotizaciones_enviadas: number;
    pedidos_sin_documento: number;
  };
}

export interface ChartMonthData {
  periodo:     string;
  meta_diaria: number;
  chart: {
    labels:       number[];
    ventas:       number[];
    devoluciones: number[];
    meta:         number[];
  };
}

export interface RotationItem {
  product_id:    number;
  name:          string;
  sku:           string | null;
  laboratory:    string | null;
  unidades:      number;
  ingresos:      number;
  stock_actual:  number;
}

export interface RotationData {
  from: string;
  to:   string;
  top_rotacion: RotationItem[];
  sin_rotacion: RotationItem[];
}
